// ============================================================================
// Testes da máquina de estados do KDS, contra um Postgres DE VERDADE rodando
// em memória (PGlite). Não sobe o app, não toca no banco de produção.
//
//   node db/testes/kds.mjs
//
// Importa a camada de serviço real (`lib/food-kds-sql.ts`), não uma cópia das
// consultas: se a regra mudar no app, o teste quebra junto.
// ============================================================================
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import {
  ErroKds, desfazerItem, estadoKds, historicoItem, liberarEsgotadosVencidos,
  marcar86, moverItem, moverPedido, moverSessao, podeItem, resumoPorArea, revisaoKds,
} from "../../lib/food-kds-sql.ts";
import { ErroRegra, extraDoItem } from "../../lib/food-regras.ts";
import { pode } from "../../lib/food-permissoes.ts";
import { ErroEntrada, dinheiro, texto, uuid } from "../../lib/food-validar.ts";
import { relatorioCompleto } from "../../lib/food-relatorios.ts";
import {
  conferirCupom, creditarPontos, identificarNaMesa, registrarAvaliacao,
  registrarUsoDeCupom, resgatarPontos, resumoDeAvaliacoes,
} from "../../lib/food-vendas.ts";
import {
  ErroFiscal, cpfValido, ehErroPermanente, formaDePagamento, montarNfce,
  proximaTentativa, referenciaDaNota,
} from "../../lib/food-fiscal-nota.ts";

const DB = new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const semExt = (t) => t.replace(/CREATE EXTENSION[^;]+;/gi, "");
let falhas = 0;
let testes = 0;

function checa(cond, msg) {
  testes++;
  console.log((cond ? "OK    " : "FALHA ") + msg);
  if (!cond) falhas++;
}
async function recusa(codigo, msg, fn) {
  testes++;
  try {
    await fn();
    console.log("FALHA " + msg + " -> não recusou");
    falhas++;
  } catch (e) {
    // vale qualquer erro de regra com codigo: ErroKds, ErroVenda, ErroRegra
    const ok = e instanceof Error && e.codigo === codigo;
    console.log((ok ? "OK    " : "FALHA ") + msg + (ok ? "" : ` -> esperava ${codigo}, veio ${e?.codigo ?? e?.message}`));
    if (!ok) falhas++;
  }
}

const db = new PGlite();
for (const arq of ["schema.sql", "migration_0003_food.sql", "migration_0004_food_edicao.sql", "migration_0005_kds.sql", "migration_0006_fuso.sql", "migration_0007_operacao.sql", "migration_0008_dispositivos.sql", "migration_0009_vendas.sql", "migration_0010_fiscal.sql"]) {
  try {
    await db.exec(semExt(fs.readFileSync(DB + arq, "utf8")));
    console.log("OK    aplicou " + arq);
  } catch (e) {
    console.log("FALHA aplicou " + arq + " -> " + e.message);
    process.exit(1);
  }
  testes++;
}

// ---------------------------------------------------------------------------
// Cenário: um boteco com bar e chapa, uma mesa, uma comanda e uma rodada com
// dois itens (uma caipirinha no bar, uma picanha na chapa).
// ---------------------------------------------------------------------------
await db.exec(`
  INSERT INTO hubs (nome, slug) VALUES ('Teste','teste');
  INSERT INTO negocios (hub_id, slug, nome) SELECT id, 'boteco', 'Boteco' FROM hubs LIMIT 1;
`);
const neg = (await db.query("SELECT id FROM negocios LIMIT 1")).rows[0].id;

await db.query(
  `INSERT INTO food_lojas (negocio_id, slug, nome, tempo_preparo_min) VALUES ($1,'boteco','Boteco',25)`, [neg]);
const loja = (await db.query("SELECT id FROM food_lojas LIMIT 1")).rows[0].id;

await db.query(`INSERT INTO food_areas (negocio_id, loja_id, nome, meta_min) VALUES ($1,$2,'Bar',3),($1,$2,'Chapa',18)`, [neg, loja]);
const areas = (await db.query("SELECT id, nome FROM food_areas ORDER BY nome")).rows;
const bar = areas.find((a) => a.nome === "Bar").id;
const chapa = areas.find((a) => a.nome === "Chapa").id;

await db.query(`INSERT INTO food_categorias (negocio_id, loja_id, nome) VALUES ($1,$2,'Geral')`, [neg, loja]);
const cat = (await db.query("SELECT id FROM food_categorias LIMIT 1")).rows[0].id;

await db.query(
  `INSERT INTO food_produtos (negocio_id, loja_id, categoria_id, area_id, nome, preco)
   VALUES ($1,$2,$3,$4,'Caipirinha',22),($1,$2,$3,$5,'Picanha na chapa',129)`,
  [neg, loja, cat, bar, chapa]);
const prods = (await db.query("SELECT id, nome, area_id FROM food_produtos ORDER BY nome")).rows;
const caipirinha = prods.find((p) => p.nome === "Caipirinha");
const picanha = prods.find((p) => p.nome.startsWith("Picanha"));

await db.query(`INSERT INTO food_mesas (negocio_id, loja_id, numero, token) VALUES ($1,$2,'7','tok-mesa-7')`, [neg, loja]);
const mesa = (await db.query("SELECT id FROM food_mesas LIMIT 1")).rows[0].id;

await db.query(
  `INSERT INTO food_sessoes (negocio_id, loja_id, mesa_id, codigo, subtotal, total)
   VALUES ($1,$2,$3,'ABC7',151,151)`, [neg, loja, mesa]);
const sessao = (await db.query("SELECT id FROM food_sessoes LIMIT 1")).rows[0].id;

await db.query(
  `INSERT INTO food_pedidos (negocio_id, loja_id, numero_dia, canal, sessao_id, mesa_id, status, subtotal, total)
   VALUES ($1,$2,1,'mesa',$3,$4,'aprovado',151,151)`, [neg, loja, sessao, mesa]);
const pedido = (await db.query("SELECT id FROM food_pedidos LIMIT 1")).rows[0].id;

await db.query(
  `INSERT INTO food_itens (negocio_id, pedido_id, produto_id, area_id, nome_snapshot, qtd, preco_unit, preco_total)
   VALUES ($1,$2,$3,$4,'Caipirinha',1,22,22),($1,$2,$5,$6,'Picanha na chapa',1,129,129)`,
  [neg, pedido, caipirinha.id, bar, picanha.id, chapa]);
const itens = (await db.query("SELECT id, nome_snapshot FROM food_itens ORDER BY nome_snapshot")).rows;
const iCaipi = itens.find((i) => i.nome_snapshot === "Caipirinha").id;
const iPicanha = itens.find((i) => i.nome_snapshot.startsWith("Picanha")).id;

const kds = { tipo: "kds", id: "tablet-1", nome: "Cozinha 1", origem: "tablet da chapa" };
const garcom = { tipo: "garcom", id: "g1", nome: "Marcos", origem: "tablet do salão" };
const status = async (id) => (await db.query("SELECT status FROM food_itens WHERE id = $1", [id])).rows[0].status;
const eventos = async (id) => (await db.query("SELECT COUNT(*)::int AS n FROM food_item_eventos WHERE item_id = $1 AND ator_tipo <> 'sistema'", [id])).rows[0].n;

console.log("\n--- tabela de transições ---");
checa(podeItem("pendente", "em_producao"), "pendente vai para em_producao");
checa(podeItem("em_producao", "pronto"), "em_producao vai para pronto");
checa(podeItem("pronto", "entregue"), "pronto vai para entregue");
checa(!podeItem("entregue", "pendente"), "entregue NÃO volta para pendente");
checa(!podeItem("cancelado", "pronto"), "cancelado NÃO vira pronto");
checa(!podeItem("pendente", "entregue"), "pendente NÃO pula direto para entregue");

console.log("\n--- 1. transição válida grava evento com autor e origem ---");
const r1 = await moverItem(db, { negocioId: neg, itemId: iPicanha, para: "em_producao", ator: kds });
checa(r1.de === "pendente" && r1.para === "em_producao" && !r1.repetido, "picanha entrou em produção");
checa((await status(iPicanha)) === "em_producao", "status gravado no banco");
const ev1 = (await db.query("SELECT * FROM food_item_eventos WHERE item_id = $1", [iPicanha])).rows[0];
checa(ev1.de === "pendente" && ev1.para === "em_producao", "evento com de e para");
checa(ev1.ator_tipo === "kds" && ev1.ator_nome === "Cozinha 1" && ev1.origem === "tablet da chapa",
  "evento com quem, de onde");
const carimbo = (await db.query("SELECT producao_em FROM food_itens WHERE id = $1", [iPicanha])).rows[0].producao_em;
checa(!!carimbo, "em_producao gravou started_at (producao_em)");

console.log("\n--- 2. transição inválida é recusada com erro claro ---");
await recusa("TRANSICAO_INVALIDA", "em_producao não volta para pendente",
  () => moverItem(db, { negocioId: neg, itemId: iPicanha, para: "pendente", ator: kds }));
await recusa("ESTADO_DESCONHECIDO", "estado inventado é recusado",
  () => moverItem(db, { negocioId: neg, itemId: iPicanha, para: "voando", ator: kds }));
await recusa("ITEM_NAO_ENCONTRADO", "item de outro negócio não é tocado",
  () => moverItem(db, { negocioId: "00000000-0000-0000-0000-000000000000", itemId: iPicanha, para: "pronto", ator: kds }));

console.log("\n--- 3. transição repetida é idempotente ---");
const r2 = await moverItem(db, { negocioId: neg, itemId: iPicanha, para: "pronto", ator: kds });
const prontoEm1 = (await db.query("SELECT pronto_em FROM food_itens WHERE id = $1", [iPicanha])).rows[0].pronto_em;
const antes = await eventos(iPicanha);
const r3 = await moverItem(db, { negocioId: neg, itemId: iPicanha, para: "pronto", ator: garcom });
const prontoEm2 = (await db.query("SELECT pronto_em FROM food_itens WHERE id = $1", [iPicanha])).rows[0].pronto_em;
checa(!r2.repetido && r3.repetido, "o segundo 'pronto' volta marcado como repetido");
checa((await eventos(iPicanha)) === antes, "não gerou evento duplicado");
checa(String(prontoEm1) === String(prontoEm2), "ready_at não se move no segundo clique");

console.log("\n--- 4. dois atores ao mesmo tempo, e o reenvio da rede ruim ---");
// A corrida de verdade é serializada pelo FOR UPDATE do Postgres. PGlite é uma
// conexão só e não exercita isso; o que se garante aqui é o efeito que importa:
// quem chega depois não escreve de novo, seja pela trava, seja pela chave.
const evAntes = await eventos(iPicanha);
const a4 = await moverItem(db, { negocioId: neg, itemId: iPicanha, para: "entregue", ator: kds, chave: "tablet-1:entrega:99" });
const b4 = await moverItem(db, { negocioId: neg, itemId: iPicanha, para: "entregue", ator: garcom });
const c4 = await moverItem(db, { negocioId: neg, itemId: iPicanha, para: "entregue", ator: kds, chave: "tablet-1:entrega:99" });
checa((await status(iPicanha)) === "entregue", "item terminou entregue");
checa(!a4.repetido && b4.repetido && c4.repetido, "o outro garçom e o reenvio voltam como repetidos");
checa((await eventos(iPicanha)) === evAntes + 1, "um evento só para a transição disputada");

console.log("\n--- 5. cancelamento exige motivo e autor ---");
await recusa("MOTIVO_OBRIGATORIO", "cancelar sem motivo é recusado",
  () => moverItem(db, { negocioId: neg, itemId: iCaipi, para: "cancelado", ator: garcom }));
await moverItem(db, { negocioId: neg, itemId: iCaipi, para: "cancelado", ator: garcom, motivo: "cliente desistiu" });
const canc = (await db.query("SELECT status, cancelado_motivo, cancelado_por FROM food_itens WHERE id = $1", [iCaipi])).rows[0];
checa(canc.status === "cancelado" && canc.cancelado_motivo === "cliente desistiu" && canc.cancelado_por === "Marcos",
  "cancelamento gravou motivo e autor");
await recusa("TRANSICAO_INVALIDA", "cancelado é terminal",
  () => moverItem(db, { negocioId: neg, itemId: iCaipi, para: "pronto", ator: kds }));

console.log("\n--- 6. atalho pendente -> pronto registra a passagem ---");
await db.query(
  `INSERT INTO food_itens (negocio_id, pedido_id, produto_id, area_id, nome_snapshot, qtd, preco_unit, preco_total)
   VALUES ($1,$2,$3,$4,'Chope 500',2,18,36)`, [neg, pedido, caipirinha.id, bar]);
const iChope = (await db.query("SELECT id FROM food_itens WHERE nome_snapshot = 'Chope 500'")).rows[0].id;
await moverItem(db, { negocioId: neg, itemId: iChope, para: "pronto", ator: kds });
const linha = await historicoItem(db, neg, iChope);
checa(linha.length === 2 && linha[0].para === "em_producao" && linha[1].para === "pronto",
  "gravou o evento intermediário do atalho");
checa(linha[0].ator_tipo === "sistema", "o intermediário é do sistema, não do garçom");
const chopeCarimbos = (await db.query("SELECT producao_em, pronto_em FROM food_itens WHERE id = $1", [iChope])).rows[0];
checa(!!chopeCarimbos.producao_em && !!chopeCarimbos.pronto_em, "carimbou started_at e ready_at");

console.log("\n--- 7. desfazer de 10 segundos ---");
const und = await desfazerItem(db, { negocioId: neg, itemId: iChope, ator: kds });
checa(und.para === "em_producao" && (await status(iChope)) === "em_producao", "desfez o último passo");
checa((await db.query("SELECT pronto_em FROM food_itens WHERE id = $1", [iChope])).rows[0].pronto_em === null,
  "desfazer limpou o ready_at");
await db.query("UPDATE food_item_eventos SET criado_em = now() - interval '5 minutes' WHERE item_id = $1", [iChope]);
await recusa("JANELA_EXPIRADA", "fora da janela, desfazer é recusado",
  () => desfazerItem(db, { negocioId: neg, itemId: iChope, ator: kds }));

console.log("\n--- 8. reconexão sem perda de ticket ---");
const rev1 = await revisaoKds(db, loja);
const estado1 = await estadoKds(db, neg, loja);
// a "conexão caiu" aqui e a cozinha marcou o chope pronto pelo outro tablet
await moverItem(db, { negocioId: neg, itemId: iChope, para: "pronto", ator: garcom });
const rev2 = await revisaoKds(db, loja);
checa(rev1 !== rev2, "a revisão muda quando algo acontece");
const estado2 = await estadoKds(db, neg, loja);
const chopeNoEstado = estado2.find((i) => i.id === iChope);
checa(!!chopeNoEstado && chopeNoEstado.status === "pronto",
  "o fetch completo depois de reconectar traz o estado novo");
checa(estado1.length === estado2.length, "nenhum ticket sumiu no caminho");
checa(!estado2.some((i) => i.id === iCaipi), "item cancelado sai da tela");
checa(!estado2.some((i) => i.id === iPicanha), "item entregue sai da tela");

console.log("\n--- 9. meta de tempo por praça ---");
checa(chopeNoEstado.meta_min === 3, "item do bar herdou a meta de 3 minutos da praça");
const resumo = await resumoPorArea(db, neg, loja);
checa(resumo.some((r) => r.area_nome === "Bar"), "resumo por praça responde para o painel do salão");

console.log("\n--- 10. botão 86 ---");
const rev3 = await revisaoKds(db, loja);
await marcar86(db, { negocioId: neg, lojaId: loja, produtoId: picanha.id, esgotado: true, ator: kds });
const p86 = (await db.query("SELECT esgotado, esgotado_ate FROM food_produtos WHERE id = $1", [picanha.id])).rows[0];
checa(p86.esgotado === true && !!p86.esgotado_ate, "produto marcado como esgotado com validade");
checa((await revisaoKds(db, loja)) !== rev3, "a revisão do cardápio muda, e o celular na mesa recarrega");
await db.query("UPDATE food_produtos SET esgotado_ate = now() - interval '1 hour' WHERE id = $1", [picanha.id]);
checa((await liberarEsgotadosVencidos(db, loja)) === 1, "o 86 vencido volta sozinho para o cardápio");

console.log("\n--- 11. máquina de estados da comanda ---");
await recusa("TRANSICAO_INVALIDA", "aberta não pula direto para paga",
  () => moverSessao(db, { negocioId: neg, sessaoId: sessao, para: "paga", ator: garcom }));
await moverSessao(db, { negocioId: neg, sessaoId: sessao, para: "conta_pedida", ator: { tipo: "cliente" } });
await moverSessao(db, { negocioId: neg, sessaoId: sessao, para: "em_pagamento", ator: garcom });
await recusa("CONTA_EM_ABERTO", "paga é recusada com a conta em aberto",
  () => moverSessao(db, { negocioId: neg, sessaoId: sessao, para: "paga", ator: garcom }));
await db.query("UPDATE food_sessoes SET pago = total WHERE id = $1", [sessao]);
const pg = await moverSessao(db, { negocioId: neg, sessaoId: sessao, para: "paga", ator: garcom });
checa(pg.para === "paga" && !pg.fiscalEnfileirado, "comanda paga (sem fiscal ligado, não enfileira)");
const evS = (await db.query("SELECT COUNT(*)::int AS n FROM food_sessao_eventos WHERE sessao_id = $1", [sessao])).rows[0].n;
checa(evS === 3, "cada passo da comanda virou evento");
await moverSessao(db, { negocioId: neg, sessaoId: sessao, para: "fechada", ator: garcom });
checa((await db.query("SELECT status FROM food_sessoes WHERE id = $1", [sessao])).rows[0].status === "fechada",
  "comanda fechada");
await recusa("TRANSICAO_INVALIDA", "comanda fechada é terminal",
  () => moverSessao(db, { negocioId: neg, sessaoId: sessao, para: "aberta", ator: garcom }));

console.log("\n--- 12. fiscal que falha não desfaz o pagamento ---");
await db.query("UPDATE food_lojas SET fiscal_ativo = true WHERE id = $1", [loja]);
await db.query(
  `INSERT INTO food_sessoes (negocio_id, loja_id, mesa_id, codigo, status, subtotal, total, pago)
   VALUES ($1,$2,$3,'ZZ99','em_pagamento',50,50,50)`, [neg, loja, mesa]);
const s2 = (await db.query("SELECT id FROM food_sessoes WHERE codigo = 'ZZ99'")).rows[0].id;
const pg2 = await moverSessao(db, { negocioId: neg, sessaoId: s2, para: "paga", ator: garcom });
checa(pg2.fiscalEnfileirado, "comanda paga entrou na fila fiscal");
await db.query("UPDATE food_fiscal_fila SET status = 'erro', erro = 'SEFAZ fora do ar' WHERE sessao_id = $1", [s2]);
checa((await db.query("SELECT status FROM food_sessoes WHERE id = $1", [s2])).rows[0].status === "paga",
  "SEFAZ fora do ar não devolve a comanda para aberta");
await recusa("MOTIVO_OBRIGATORIO", "fechar com saldo em aberto exige motivo", async () => {
  await db.query("UPDATE food_sessoes SET pago = 10 WHERE id = $1", [s2]);
  await moverSessao(db, { negocioId: neg, sessaoId: s2, para: "fechada", ator: garcom });
});
const fech = await moverSessao(db, {
  negocioId: neg, sessaoId: s2, para: "fechada", ator: garcom, motivo: "recebido na maquininha",
});
checa(fech.saldoAberto === 40, "o valor que faltou ficou registrado");
const evAberto = (await db.query(
  "SELECT valor_aberto FROM food_sessao_eventos WHERE sessao_id = $1 AND para = 'fechada'", [s2])).rows[0];
checa(Number(evAberto.valor_aberto) === 40, "e foi gravado no evento da comanda");

console.log("\n--- 13. 'sai tudo': o pedido inteiro de uma vez ---");
await db.query(
  `INSERT INTO food_pedidos (negocio_id, loja_id, numero_dia, canal, status, subtotal, total)
   VALUES ($1,$2,2,'balcao','aprovado',60,60)`, [neg, loja]);
const ped2 = (await db.query("SELECT id FROM food_pedidos WHERE numero_dia = 2")).rows[0].id;
await db.query(
  `INSERT INTO food_itens (negocio_id, pedido_id, produto_id, area_id, nome_snapshot, qtd, preco_unit, preco_total, status)
   VALUES ($1,$2,$3,$4,'Porção A',1,30,30,'pendente'),
          ($1,$2,$3,$4,'Porção B',1,30,30,'em_producao'),
          ($1,$2,$3,$4,'Porção C',1,30,30,'cancelado')`,
  [neg, ped2, caipirinha.id, bar]);
const tudo = await moverPedido(db, { negocioId: neg, pedidoId: ped2, para: "pronto", ator: kds });
checa(tudo.movidos === 2 && tudo.pulados === 0, "moveu os dois itens vivos e ignorou o cancelado");
const st2 = (await db.query("SELECT status FROM food_pedidos WHERE id = $1", [ped2])).rows[0].status;
checa(st2 === "pronto", "o pedido virou pronto porque o último item ficou pronto");
const repetir = await moverPedido(db, { negocioId: neg, pedidoId: ped2, para: "pronto", ator: kds });
checa(repetir.movidos === 0 && repetir.repetidos === 2, "repetir 'sai tudo' é idempotente");

console.log("\n--- 14. mesa que foi embora sem consumir ---");
await db.query(
  `INSERT INTO food_sessoes (negocio_id, loja_id, mesa_id, codigo, status, subtotal, total, pago)
   VALUES ($1,$2,$3,'VAZ1','aberta',0,0,0)`, [neg, loja, mesa]);
const s3 = (await db.query("SELECT id FROM food_sessoes WHERE codigo = 'VAZ1'")).rows[0].id;
const f3 = await moverSessao(db, { negocioId: neg, sessaoId: s3, para: "fechada", ator: garcom });
checa(f3.para === "fechada" && f3.saldoAberto === 0, "comanda sem consumo fecha direto, sem motivo");

console.log("\n--- 15. o dia e a hora são os da CASA, não os do servidor ---");
const tz = (await db.query("SELECT current_setting('TimeZone') AS tz")).rows[0].tz;
const dias = (await db.query(
  `SELECT food_dia_loja($1) AS casa,
          CURRENT_DATE AS servidor,
          (now() AT TIME ZONE 'America/Sao_Paulo')::date AS brasilia`, [loja])).rows[0];
checa(String(dias.casa) === String(dias.brasilia),
  `o dia da loja segue o fuso dela (banco em ${tz})`);

// Daqui para baixo o relogio e FIXO, com food_aberta_em(). Regra de horario
// testada com "a hora de agora" passa ou falha conforme a hora em que a suite
// roda, e isso e teste que mente.
const SEX = 5, SAB = 6;
await db.query("DELETE FROM food_horarios WHERE loja_id = $1", [loja]);
await db.query(
  `INSERT INTO food_horarios (negocio_id, loja_id, dia_semana, abre, fecha) VALUES
     ($1,$2,$3,'11:30','14:00'),
     ($1,$2,$4,'18:00','02:00')`,
  [neg, loja, SEX, SAB]);   // sexta no almoco, sabado a noite virando a madrugada

const aberta = async (quando) =>
  (await db.query("SELECT food_aberta_em($1, $2::timestamp) AS a", [loja, quando])).rows[0].a;

checa(await aberta("2026-09-04 12:00") === true, "sexta ao meio-dia: aberta no almoco");
checa(await aberta("2026-09-04 16:00") === false, "sexta as 16h: fechada entre o almoco e a janta");
checa(await aberta("2026-09-05 21:00") === true, "sabado as 21h: aberta");
checa(await aberta("2026-09-06 01:30") === true,
  "domingo 01:30 ainda e a noite de sabado (faixa que vira a madrugada)");
checa(await aberta("2026-09-06 03:00") === false, "domingo as 3h, depois de fechar: fechada");
checa(await aberta("2026-09-06 12:00") === false, "domingo ao meio-dia: fechada, nao tem faixa");

await db.query("DELETE FROM food_horarios WHERE loja_id = $1", [loja]);
checa(await aberta("2026-09-06 12:00") === true,
  "casa sem horario cadastrado conta como aberta, senao o dono fica sem vender");

// o numero do pedido nasce com o dia da casa
await db.query("DELETE FROM food_horarios WHERE loja_id = $1", [loja]);
const diaPedido = (await db.query(
  "SELECT dia, food_dia_loja(loja_id) AS casa FROM food_pedidos ORDER BY criado_em DESC LIMIT 1")).rows[0];
checa(String(diaPedido.dia) === String(diaPedido.casa) || diaPedido.dia === null,
  "o pedido nasce com o dia da casa");

console.log("\n--- 16. as regras do cardápio valem no servidor ---");
const churrasco = { id: "p1", nome: "Picanha" };
const gPonto = {
  id: "g1", produto_id: "p1", nome: "Ponto da carne",
  minimo: 1, maximo: 1, obrigatorio: true, tipo_preco: "soma",
};
const gAdicional = {
  id: "g2", produto_id: "p1", nome: "Adicionais",
  minimo: 0, maximo: 2, obrigatorio: false, tipo_preco: "soma",
};
const gSabores = {
  id: "g3", produto_id: "p1", nome: "Sabores",
  minimo: 1, maximo: 2, obrigatorio: true, tipo_preco: "maior",
};
const op = (id, grupo, preco, extra = {}) => ({
  id, nome: `op ${id}`, preco_extra: preco, grupo_id: grupo, grupo_produto: "p1", ...extra,
});

function recusaRegra(msg, fn) {
  testes++;
  try {
    fn();
    console.log("FALHA " + msg + " -> não recusou");
    falhas++;
  } catch (e) {
    const ok = e instanceof ErroRegra;
    console.log((ok ? "OK    " : "FALHA ") + msg + (ok ? ` ("${e.message}")` : ` -> ${e.message}`));
    if (!ok) falhas++;
  }
}

recusaRegra("grupo obrigatório vazio é recusado",
  () => extraDoItem(churrasco, [gPonto], []));
recusaRegra("passar do máximo do grupo é recusado",
  () => extraDoItem(churrasco, [gAdicional], [op("a", "g2", 5), op("b", "g2", 5), op("c", "g2", 5)]));
recusaRegra("opção de outro produto é recusada",
  () => extraDoItem(churrasco, [gPonto], [{ ...op("x", "g1", 0), grupo_produto: "outro-produto" }]));
recusaRegra("opção esgotada é recusada",
  () => extraDoItem(churrasco, [gPonto], [op("y", "g1", 0, { esgotada: true })]));

checa(extraDoItem(churrasco, [gPonto, gAdicional], [op("mal", "g1", 0), op("bacon", "g2", 7.5)]) === 7.5,
  "soma normal dos adicionais");
checa(extraDoItem(churrasco, [gSabores], [op("calabresa", "g3", 8), op("portuguesa", "g3", 12)]) === 12,
  "meia a meia cobra o sabor MAIS CARO, não a soma");
checa(extraDoItem(churrasco, [{ ...gSabores, tipo_preco: "media" }],
  [op("a", "g3", 10), op("b", "g3", 20)]) === 15, "tipo de preço média divide entre os escolhidos");
checa(extraDoItem(churrasco, [gAdicional], []) === 0, "grupo opcional vazio não cobra nada");

console.log("\n--- 17. papéis: quem pode o quê ---");
checa(pode("garcom", "receber_pagamento"), "garçom recebe pagamento");
checa(!pode("garcom", "cortesia"), "garçom NÃO dá cortesia");
checa(!pode("garcom", "desconto"), "garçom NÃO dá desconto");
checa(!pode("garcom", "fechar_em_aberto"), "garçom NÃO fecha conta devendo");
checa(!pode("garcom", "cancelar_producao"), "garçom NÃO cancela prato que já está na chapa");
checa(pode("garcom", "cancelar_pendente"), "garçom cancela item que a cozinha nem começou");
checa(pode("gerente", "cortesia") && pode("gerente", "desconto") && pode("gerente", "fechar_em_aberto"),
  "gerente passa em tudo que envolve dinheiro que não entrou");
checa(!pode("cozinha", "receber_pagamento"), "cozinha NÃO mexe em dinheiro");
checa(pode("cozinha", "marcar_86"), "cozinha marca o que acabou");
checa(!pode(null, "mover_item"), "sem turno aberto, ninguém faz nada");
checa(!pode("inventado", "mover_item"), "papel que não existe não autoriza nada");

console.log("\n--- 18. validação de entrada ---");
function recusaEntrada(msg, fn) {
  testes++;
  try {
    fn();
    console.log("FALHA " + msg + " -> não recusou");
    falhas++;
  } catch (e) {
    const ok = e instanceof ErroEntrada;
    console.log((ok ? "OK    " : "FALHA ") + msg);
    if (!ok) falhas++;
  }
}
recusaEntrada("texto vazio é recusado", () => texto("   ", "nome"));
recusaEntrada("NaN não entra como dinheiro", () => dinheiro("abacaxi", "valor"));
recusaEntrada("dinheiro negativo é recusado", () => dinheiro(-5, "valor"));
recusaEntrada("uuid torto é recusado", () => uuid("1; DROP TABLE food_pedidos", "mesa"));
checa(dinheiro("12,50", "valor") === 12.5, "aceita vírgula como separador, que é como o dono digita");
checa(dinheiro(undefined, "valor", { padrao: 0 }) === 0, "campo vazio usa o padrão quando existe");
checa(texto("  Picanha na chapa  ", "nome") === "Picanha na chapa", "texto vem aparado");

console.log("");
console.log("--- 19. relatorios: as contas que o dono abre de manha ---");
const hojeDaCasa = (await db.query("SELECT food_dia_loja($1)::text AS d", [loja])).rows[0].d;
const rel = await relatorioCompleto(db, neg, loja, { de: hojeDaCasa, ate: hojeDaCasa });

checa(Number(rel.totais.pedidos) >= 1, "fecha o periodo com " + rel.totais.pedidos + " pedido(s)");
const barra = rel.pracas.find((p) => p.area_nome === "Bar");
checa(!!barra && Number(barra.itens) > 0, "a praca do bar aparece com itens prontos");
checa(!!barra && barra.preparo_medio !== null, "preparo medio do bar calculado (" + barra?.preparo_medio + " min)");
checa(!!barra && Number(barra.meta) === 3, "a meta da praca entra no relatorio");
checa(rel.horas.length > 0, "curva por hora responde");
checa(rel.cancelados.some((c) => c.motivo === "cliente desistiu"), "o cancelamento aparece com o MOTIVO que o garcom deu");
checa(rel.cancelados.some((c) => c.quem === "Marcos"), "e com o nome de quem cancelou");
checa(rel.pessoas.some((p) => p.quem === "Cozinha 1" || p.quem === "Marcos"), "quem trabalhou aparece pelo nome");
checa(rel.retrabalho.total > 0 && rel.retrabalho.desfeitos >= 1, "retrabalho contado: " + rel.retrabalho.desfeitos + " de " + rel.retrabalho.total);
checa(rel.produtos.length > 0, "mais vendidos responde");

console.log("");
console.log("--- 20. cupom, avaliacao e fidelidade ---");
await db.query(
  "INSERT INTO food_cupons (negocio_id, loja_id, codigo, tipo, valor, minimo, teto) VALUES ($1,$2,'VOLTA10','percentual',10,50,15)",
  [neg, loja]);
await db.query(
  "INSERT INTO food_cupons (negocio_id, loja_id, codigo, tipo, valor, hora_inicio, hora_fim, dias_semana) VALUES ($1,$2,'HAPPY','valor',8,'17:00','19:00',ARRAY[1,2,3]::smallint[])",
  [neg, loja]);

const cup = await conferirCupom(db, {
  negocioId: neg, lojaId: loja, codigo: "volta10", subtotal: 200, canal: "mesa",
});
checa(cup.desconto === 15, "cupom percentual respeita o teto (10% de 200 = 20, teto 15)");

const cup2 = await conferirCupom(db, {
  negocioId: neg, lojaId: loja, codigo: "VOLTA10", subtotal: 100, canal: "mesa",
});
checa(cup2.desconto === 10, "cupom percentual normal abate 10%");

await recusa("CUPOM_MINIMO", "cupom com pedido abaixo do minimo e recusado",
  () => conferirCupom(db, { negocioId: neg, lojaId: loja, codigo: "VOLTA10", subtotal: 20, canal: "mesa" }));
await recusa("CUPOM_INVALIDO", "cupom que nao existe e recusado",
  () => conferirCupom(db, { negocioId: neg, lojaId: loja, codigo: "NAOEXISTE", subtotal: 100, canal: "mesa" }));
await recusa("CUPOM_INVALIDO", "cupom de outra casa nao vale aqui",
  () => conferirCupom(db, { negocioId: neg, lojaId: mesa, codigo: "VOLTA10", subtotal: 100, canal: "mesa" }));

await registrarUsoDeCupom(db, { negocioId: neg, cupomId: cup.id, desconto: 15, telefone: "5549999990000" });
await recusa("CUPOM_JA_USADO", "a mesma pessoa nao usa o cupom duas vezes",
  () => conferirCupom(db, {
    negocioId: neg, lojaId: loja, codigo: "VOLTA10", subtotal: 100,
    canal: "mesa", telefone: "5549999990000",
  }));

console.log("");
console.log("--- avaliacao ---");
await db.query("UPDATE food_lojas SET google_url = 'https://g.page/boteco', nota_para_google = 4 WHERE id = $1", [loja]);
const av5 = await registrarAvaliacao(db, {
  negocioId: neg, lojaId: loja, sessaoId: sessao, nota: 5, marcadores: ["comida", "inventado"],
});
checa(av5.googleUrl === "https://g.page/boteco", "nota 5 manda o cliente para o Google");

const sessaoAv = (await db.query(
  "INSERT INTO food_sessoes (negocio_id, loja_id, mesa_id, codigo, status) VALUES ($1,$2,$3,'AV02','fechada') RETURNING id",
  [neg, loja, mesa])).rows[0].id;
const av2 = await registrarAvaliacao(db, {
  negocioId: neg, lojaId: loja, sessaoId: sessaoAv, nota: 2,
  marcadores: ["tempo de espera"], comentario: "demorou demais",
});
checa(av2.googleUrl === null, "nota 2 NAO vai para o Google: fica dentro de casa");
const alerta = (await db.query(
  "SELECT COUNT(*)::int AS n FROM food_eventos WHERE tipo = 'avaliacao_ruim'")).rows[0].n;
checa(alerta === 1, "nota baixa virou alerta para o dono");

const marc = (await db.query("SELECT marcadores FROM food_avaliacoes WHERE sessao_id = $1", [sessao])).rows[0];
checa(marc.marcadores.length === 1 && marc.marcadores[0] === "comida",
  "marcador inventado pelo navegador e descartado");

const resumoAv = await resumoDeAvaliacoes(db, neg, loja);
checa(Number(resumoAv.totais.total) === 2 && Number(resumoAv.totais.media) === 3.5,
  "media das avaliacoes fecha (3.5)");
checa(resumoAv.queixas.some((q) => q.marcador === "tempo de espera"),
  "a queixa mais comum aparece para o dono");

console.log("");
console.log("--- fidelidade ---");
await db.query("UPDATE food_lojas SET fidelidade_ativa = true, pontos_por_real = 1, valor_do_ponto = 0.01, resgate_minimo = 100 WHERE id = $1", [loja]);
const eu = await identificarNaMesa(db, {
  negocioId: neg, sessaoId: sessao, telefone: "(49) 99999-1234", nome: "Sandro",
});
checa(!!eu.clienteId, "cliente da mesa se identifica pelo telefone");
const ganhou = await creditarPontos(db, {
  negocioId: neg, lojaId: loja, clienteId: eu.clienteId, valorGasto: 151, sessaoId: sessao,
});
checa(ganhou === 151, "ganhou 1 ponto por real gasto");
await recusa("POUCOS_PONTOS", "resgate abaixo do minimo e recusado",
  () => resgatarPontos(db, { negocioId: neg, lojaId: loja, clienteId: eu.clienteId, pontos: 50 }));
const res = await resgatarPontos(db, {
  negocioId: neg, lojaId: loja, clienteId: eu.clienteId, pontos: 100, sessaoId: sessao,
});
checa(res.desconto === 1 && res.saldo === 51, "resgate de 100 pontos vira R$ 1,00 e sobra 51");
const mov = (await db.query(
  "SELECT COUNT(*)::int AS n FROM food_pontos_mov WHERE cliente_id = $1", [eu.clienteId])).rows[0].n;
checa(mov === 2, "o extrato de pontos guarda o que entrou e o que saiu");

console.log("");
console.log("--- 21. NFC-e: o conteudo da nota ---");

const emitente = {
  cnpj: "12345678000195", razao: "Boteco Demonstracao LTDA", ie: "251234567",
  uf: "SC", municipio: "Xanxere", cep: "89820000",
  regime: "simples", csosnPadrao: "102", cfopPadrao: "5102",
  ncmPadrao: "21069090", serie: 1,
};
const nota = (extra = {}) => montarNfce({
  emitente,
  itens: [
    { nome: "Picanha na chapa", qtd: 1, precoUnit: 129, precoTotal: 129 },
    { nome: "Caipirinha", qtd: 2, precoUnit: 22, precoTotal: 44 },
  ],
  pagamentos: [{ metodo: "credito", valor: 173 }],
  dataEmissao: "2026-09-02T21:30:00-03:00",
  ...extra,
});

const n1 = nota();
checa(Number(n1.valor_produtos) === 173, "soma dos itens fecha (173)");
checa(Number(n1.valor_total) === 173, "total da nota fecha");
checa(n1.itens.length === 2 && n1.itens[0].numero_item === 1, "itens numerados a partir de 1");
checa(n1.itens[0].codigo_ncm === "21069090", "produto sem NCM usa o padrao da casa");
checa(n1.itens[0].cfop === "5102", "produto sem CFOP usa o padrao da casa");
checa(n1.itens[0].icms_situacao_tributaria === "102", "Simples usa CSOSN");
checa(n1.formas_pagamento[0].forma_pagamento === "03", "credito vira codigo 03 da SEFAZ");
checa(formaDePagamento("pix") === "17" && formaDePagamento("pix_app") === "17",
  "pix e pix no app viram 17");
checa(formaDePagamento("vale") === "10", "vale alimentacao vira 10");
checa(formaDePagamento("inventado") === "99", "forma desconhecida vira 99, e nao quebra a nota");

const normal = montarNfce({
  emitente: { ...emitente, regime: "normal", cstPadrao: "00" },
  itens: [{ nome: "Agua", qtd: 1, precoUnit: 5, precoTotal: 5 }],
  pagamentos: [{ metodo: "dinheiro", valor: 5 }],
  dataEmissao: "2026-09-02T21:30:00-03:00",
});
checa(normal.itens[0].icms_situacao_tributaria === "00",
  "regime normal usa CST, nao CSOSN: trocar os dois e o erro classico");

console.log("");
console.log("--- desconto rateado, que e onde a nota costuma nao fechar ---");
const comDesconto = nota({ desconto: 10, pagamentos: [{ metodo: "dinheiro", valor: 163 }] });
const somaDesc = comDesconto.itens.reduce((s, i) => s + (i.valor_desconto ?? 0), 0);
checa(Math.round(somaDesc * 100) / 100 === 10, "o desconto da comanda e rateado inteiro entre os itens");
checa(Number(comDesconto.valor_total) === 163, "total com desconto fecha (163)");

console.log("");
console.log("--- o que a SEFAZ recusaria, recusado aqui antes ---");
function recusaNota(codigo, msg, fn) {
  testes++;
  try {
    fn();
    console.log("FALHA " + msg + " -> nao recusou");
    falhas++;
  } catch (e) {
    const ok = e instanceof ErroFiscal && e.codigo === codigo;
    console.log((ok ? "OK    " : "FALHA ") + msg + (ok ? "" : " -> veio " + (e.codigo ?? e.message)));
    if (!ok) falhas++;
  }
}
recusaNota("CNPJ_INVALIDO", "CNPJ incompleto e recusado",
  () => nota({ emitente: { ...emitente, cnpj: "123" } }));
recusaNota("SEM_ITENS", "nota sem item e recusada",
  () => montarNfce({ emitente, itens: [], pagamentos: [], dataEmissao: "2026-09-02T21:30:00-03:00" }));
recusaNota("CPF_INVALIDO", "CPF torto na nota e recusado",
  () => nota({ cpf: "111.111.111-11" }));
recusaNota("PAGAMENTO_MENOR", "pagamento menor que a nota e recusado",
  () => nota({ pagamentos: [{ metodo: "dinheiro", valor: 50 }] }));

checa(cpfValido("529.982.247-25"), "CPF valido passa");
checa(!cpfValido("529.982.247-24"), "CPF com digito errado nao passa");
const comCpf = nota({ cpf: "529.982.247-25" });
checa(comCpf.cpf_destinatario === "52998224725", "CPF na nota vai so com numeros");

console.log("");
console.log("--- contingencia: quando insistir e quando desistir ---");
checa(proximaTentativa(0) === 1 && proximaTentativa(3) === 15 && proximaTentativa(99) === 120,
  "a espera entre tentativas cresce e para em 2 horas");
checa(ehErroPermanente("Rejeicao: CNPJ do emitente invalido"),
  "erro de conteudo e permanente: insistir nao conserta");
checa(!ehErroPermanente("timeout ao conectar no servidor"),
  "erro de conexao NAO e permanente: isso e SEFAZ fora do ar, e insiste");
checa(referenciaDaNota("abcdefgh-1111-2222-3333-444444444444", "99998888-7777-6666-5555-444444444444")
  === referenciaDaNota("abcdefgh-1111-2222-3333-444444444444", "99998888-7777-6666-5555-444444444444"),
  "a referencia da nota e estavel: reenviar nao gera nota duplicada");

console.log(`\n${testes - falhas}/${testes} checagens passaram.`);
process.exit(falhas === 0 ? 0 : 1);
