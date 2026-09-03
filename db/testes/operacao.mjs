// Roda as MESMAS consultas criticas do lib/food.ts contra um Postgres de teste.
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

const HUB = new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const db = new PGlite();
const semExt = (t) => t.replace(/CREATE EXTENSION[^;]+;/gi, "");
let falhas = 0;
const checa = (c, m) => { console.log((c ? "OK    " : "FALHA ") + m); if (!c) falhas++; };

await db.exec(semExt(fs.readFileSync(HUB + "schema.sql", "utf8")));
await db.exec(semExt(fs.readFileSync(HUB + "migration_0003_food.sql", "utf8")));
await db.exec(semExt(fs.readFileSync(HUB + "migration_0004_food_edicao.sql", "utf8")));
await db.exec(`
  INSERT INTO hubs (nome, slug) VALUES ('T','t');
  INSERT INTO negocios (hub_id, slug, nome) SELECT id,'b','Boteco' FROM hubs LIMIT 1;
`);
await db.exec(semExt(fs.readFileSync(HUB + "seed-food-demo.sql", "utf8"))
  .replace(/gen_random_bytes\((\d+)\)/g, "gen_random_uuid()::text::bytea"));

const loja = (await db.query("SELECT * FROM food_lojas LIMIT 1")).rows[0];
const neg = loja.negocio_id;
const mesa = (await db.query("SELECT * FROM food_mesas ORDER BY ordem LIMIT 1")).rows[0];

// --- contador do numero do pedido (consulta real do criarPedido)
const sqlContador = `INSERT INTO food_contadores (loja_id, dia, ultimo) VALUES ($1, CURRENT_DATE, 1)
   ON CONFLICT (loja_id, dia) DO UPDATE SET ultimo = food_contadores.ultimo + 1
   RETURNING ultimo`;
const n1 = await db.query(sqlContador, [loja.id]);
const n2 = await db.query(sqlContador, [loja.id]);
checa(n1.rows[0].ultimo === 1 && n2.rows[0].ultimo === 2, "numero do pedido nao repete no mesmo dia");

// --- sessao + pedido + itens
const ses = (await db.query(
  `INSERT INTO food_sessoes (negocio_id, loja_id, mesa_id, codigo) VALUES ($1,$2,$3,'AB12') RETURNING *`,
  [neg, loja.id, mesa.id])).rows[0];
const prod = (await db.query("SELECT id, area_id, nome, preco FROM food_produtos WHERE preco > 0 LIMIT 1")).rows[0];
const ped = (await db.query(
  `INSERT INTO food_pedidos
     (negocio_id, loja_id, numero_dia, canal, sessao_id, mesa_id, status, subtotal, taxa_entrega, total, aprovado_em)
   VALUES ($1,$2,$3,'mesa',$4,$5,'aprovado',$6,0,$6, now()) RETURNING *`,
  [neg, loja.id, 3, ses.id, mesa.id, prod.preco])).rows[0];
await db.query(
  `INSERT INTO food_itens (negocio_id, pedido_id, produto_id, area_id, nome_snapshot, qtd, preco_unit, preco_total, opcoes_json, status)
   VALUES ($1,$2,$3,$4,$5,1,$6,$6,$7,'pendente')`,
  [neg, ped.id, prod.id, prod.area_id, prod.nome, prod.preco,
   JSON.stringify([{ grupo: "Acompanhamento", nome: "Mandioca", preco: 0 }])]);

// --- enfileirar comanda (consulta do enfileirarComanda)
const impressoras = await db.query(
  `SELECT i.*, a.nome AS area_nome FROM food_impressoras i
     LEFT JOIN food_areas a ON a.id = i.area_id
    WHERE i.loja_id = $1 AND i.ativa = true AND $2 = ANY(i.imprime)`, [loja.id, "comanda"]);
checa(impressoras.rows.length === 1, "impressora da cozinha encontrada para a fila");

await db.query(
  `INSERT INTO food_print_jobs (negocio_id, impressora_id, pedido_id, tipo, conteudo)
   VALUES ($1,$2,$3,'comanda',$4)`,
  [neg, impressoras.rows[0].id, ped.id, "PEDIDO #3\n1x Costela"]);

// --- a impressora pergunta se tem trabalho (temJobPendente)
const pend = await db.query(
  `SELECT EXISTS (SELECT 1 FROM food_print_jobs j
      JOIN food_impressoras i ON i.id = j.impressora_id
     WHERE i.chave = $1 AND i.ativa = true AND j.status = 'pendente') AS existe`,
  [impressoras.rows[0].chave]);
checa(pend.rows[0].existe === true, "CloudPRNT: servidor responde que tem comanda");

// --- a impressora baixa o job (proximoJob, com SKIP LOCKED)
const job = await db.query(
  `UPDATE food_print_jobs SET status='entregue', entregue_em=now(), tentativas=tentativas+1
    WHERE id = (SELECT id FROM food_print_jobs WHERE impressora_id=$1 AND status='pendente'
                 ORDER BY criado_em LIMIT 1 FOR UPDATE SKIP LOCKED)
    RETURNING id, conteudo`, [impressoras.rows[0].id]);
checa(!!job.rows[0] && job.rows[0].conteudo.includes("Costela"),
  "CloudPRNT: comanda entregue com o texto certo");

const vazio = await db.query(
  `SELECT EXISTS (SELECT 1 FROM food_print_jobs WHERE impressora_id=$1 AND status='pendente') AS e`,
  [impressoras.rows[0].id]);
checa(vazio.rows[0].e === false, "a mesma comanda nao sai duas vezes");

// --- KDS (itensDaCozinha)
const kds = await db.query(
  `SELECT i.*, p.numero_dia FROM food_itens i JOIN food_pedidos p ON p.id = i.pedido_id
    WHERE i.negocio_id=$1 AND p.loja_id=$2 AND p.status IN ('aprovado','em_producao','pronto')
      AND i.status IN ('pendente','em_producao','pronto')`, [neg, loja.id]);
checa(kds.rows.length === 1, "item aparece na tela da cozinha");

// --- marcar pronto derruba o pedido para pronto (mudarStatusItem)
await db.query("UPDATE food_itens SET status='pronto', pronto_em=now() WHERE pedido_id=$1", [ped.id]);
await db.query(
  `UPDATE food_pedidos p
      SET status = CASE WHEN NOT EXISTS (SELECT 1 FROM food_itens i WHERE i.pedido_id=p.id
                          AND i.status IN ('pendente','em_producao')) THEN 'pronto' ELSE p.status END
    WHERE p.id = $1 AND p.status IN ('aprovado','em_producao','pronto')`, [ped.id]);
const st = (await db.query("SELECT status FROM food_pedidos WHERE id=$1", [ped.id])).rows[0];
checa(st.status === "pronto", "pedido vira pronto quando o ultimo item fica pronto");

// --- mapa de mesas (mapaMesas)
const mapa = await db.query(
  `SELECT m.numero, s.id AS sessao_id, s.total,
          COALESCE((SELECT COUNT(*) FROM food_itens i JOIN food_pedidos p ON p.id=i.pedido_id
                     WHERE p.sessao_id=s.id AND i.status IN ('pendente','em_producao')),0) AS itens_pendentes
     FROM food_mesas m
     LEFT JOIN food_sessoes s ON s.mesa_id=m.id AND s.status IN ('aberta','conta_pedida','aguardando_pagamento')
    WHERE m.loja_id=$1 AND m.ativa=true ORDER BY m.ordem`, [loja.id]);
checa(mapa.rows[0].sessao_id !== null && Number(mapa.rows[0].itens_pendentes) === 0,
  "mapa de mesas mostra a mesa ocupada e sem item pendente");

// --- fechar a conta (recalcularSessao + pagamento)
await db.query(
  `INSERT INTO food_pagamentos (negocio_id, loja_id, sessao_id, metodo, valor, gorjeta, status, confirmado_em)
   VALUES ($1,$2,$3,'pix',$4,0,'confirmado', now())`, [neg, loja.id, ses.id, prod.preco]);
await db.query(
  `WITH soma AS (SELECT COALESCE(SUM(i.preco_total),0) AS sub FROM food_itens i
                   JOIN food_pedidos p ON p.id=i.pedido_id
                  WHERE p.sessao_id=$1 AND p.status<>'cancelado' AND i.status<>'cancelado'),
        pago AS (SELECT COALESCE(SUM(valor+gorjeta),0) AS pg FROM food_pagamentos
                  WHERE sessao_id=$1 AND status='confirmado')
   UPDATE food_sessoes s
      SET subtotal=soma.sub,
          taxa_servico = CASE WHEN l.taxa_servico_automatica THEN ROUND(soma.sub*l.taxa_servico_pct/100,2) ELSE s.taxa_servico END,
          total = soma.sub + CASE WHEN l.taxa_servico_automatica THEN ROUND(soma.sub*l.taxa_servico_pct/100,2) ELSE s.taxa_servico END,
          pago = pago.pg
     FROM soma, pago, food_lojas l WHERE s.id=$1 AND l.id=s.loja_id`, [ses.id]);
const conta = (await db.query("SELECT subtotal, taxa_servico, total, pago FROM food_sessoes WHERE id=$1", [ses.id])).rows[0];
checa(Number(conta.subtotal) === Number(prod.preco) && Number(conta.pago) === Number(prod.preco),
  `conta fecha certo (consumo ${conta.subtotal}, servico ${conta.taxa_servico}, pago ${conta.pago})`);

await db.query("UPDATE food_sessoes SET status='fechada', fechada_em=now() WHERE id=$1", [ses.id]);
const novaSessao = await db.query(
  `INSERT INTO food_sessoes (negocio_id, loja_id, mesa_id, codigo) VALUES ($1,$2,$3,'XY99') RETURNING id`,
  [neg, loja.id, mesa.id]);
checa(!!novaSessao.rows[0], "mesa fechada aceita comanda nova (proximo cliente senta)");

// --- resumo do dia (resumoDoDia)
const dia = await db.query(
  `SELECT COUNT(*)::text AS pedidos, COALESCE(SUM(total),0)::text AS faturamento
     FROM food_pedidos WHERE negocio_id=$1 AND loja_id=$2 AND dia=CURRENT_DATE AND status<>'cancelado'`,
  [neg, loja.id]);
checa(Number(dia.rows[0].pedidos) >= 1, `relatorio do dia soma ${dia.rows[0].pedidos} pedido(s), ${dia.rows[0].faturamento} de venda`);

console.log(falhas === 0 ? "\nTUDO PASSOU" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
