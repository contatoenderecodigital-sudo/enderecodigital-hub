// ============================================================================
// A vitrine de demonstracao, semeada contra um Postgres DE VERDADE em memoria.
//
//   node db/testes/vitrine.mjs
//
// Por que isto existe: o seed da vitrine roda no banco de PRODUCAO. Se ele tem
// um erro de SQL na noite 30, ele para no meio e deixa meia casa de pe. Aqui
// ele roda inteiro antes, de graca, e ainda confere se o que ele planta e o
// que as telas da demo precisam encontrar.
// ============================================================================
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import { semear } from "../seed-demo-vitrine.mjs";
import { estadoKds, resumoPorArea } from "../../lib/food-kds-sql.ts";
import { relatorioCompleto } from "../../lib/food-relatorios.ts";
import { resumoDeAvaliacoes } from "../../lib/food-vendas.ts";

const DB = new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const semExt = (t) => t.replace(/CREATE EXTENSION[^;]+;/gi, "");
let falhas = 0;
let testes = 0;

function checa(cond, msg) {
  testes++;
  console.log((cond ? "OK    " : "FALHA ") + msg);
  if (!cond) falhas++;
}

const db = new PGlite();
for (const arq of [
  "schema.sql", "migration_0003_food.sql", "migration_0004_food_edicao.sql",
  "migration_0005_kds.sql", "migration_0006_fuso.sql", "migration_0007_operacao.sql",
  "migration_0008_dispositivos.sql", "migration_0009_vendas.sql", "migration_0010_fiscal.sql",
]) {
  try {
    await db.exec(semExt(fs.readFileSync(DB + arq, "utf8")));
  } catch (e) {
    console.log("FALHA aplicou " + arq + " -> " + e.message);
    process.exit(1);
  }
}
console.log("OK    schema aplicado");

// um negocio para a casa morar dentro
await db.exec(`
  INSERT INTO hubs (nome, slug) VALUES ('Teste','teste');
  INSERT INTO negocios (hub_id, slug, nome, ativo)
    SELECT id, 'casa-teste', 'Casa de teste', true FROM hubs LIMIT 1;
`);

// ---------------------------------------------------------------------------
// semeia a vitrine inteira. 8 noites em vez de 45: o que se testa e o SQL,
// nao o volume.
// ---------------------------------------------------------------------------
let r;
try {
  r = await semear(db, { dias: 8, silencioso: true });
  console.log("OK    a vitrine subiu inteira sem erro de SQL");
  testes++;
} catch (e) {
  console.log("FALHA a vitrine quebrou -> " + e.message);
  process.exit(1);
}

const { negocioId: neg, lojaId: loja } = r;
const uma = async (sql, p) => (await db.query(sql, p)).rows[0];

// ---------------------------------------------------------------------------
// 1. a casa existe e esta configurada para vender
// ---------------------------------------------------------------------------
const l = await uma("SELECT * FROM food_lojas WHERE id = $1", [loja]);
checa(l.nome === "Esquina 49", "a casa se chama Esquina 49");
checa(l.fuso === "America/Sao_Paulo", "o fuso da casa esta preenchido");
checa(l.fidelidade_ativa === true, "a fidelidade esta ligada");
checa(!!l.google_url, "o link do Google esta preenchido, senao a avaliacao 5 nao tem para onde ir");
checa(Number(l.taxa_servico_pct) === 10, "a taxa de servico e 10 por cento");

// ---------------------------------------------------------------------------
// 2. o cardapio: a primeira tela que o dono ve no celular dele
// ---------------------------------------------------------------------------
checa(r.produtos >= 24, `o cardapio tem ${r.produtos} produtos, nao parece vazio`);

const semArea = await uma(
  `SELECT COUNT(*)::int n FROM food_produtos WHERE loja_id = $1 AND area_id IS NULL`, [loja]);
checa(semArea.n === 0, "todo produto tem praca, senao o item nasce sem KDS para ir");

const comAlerg = await uma(
  `SELECT COUNT(*)::int n FROM food_produtos WHERE loja_id = $1 AND alergenicos IS NOT NULL`, [loja]);
checa(comAlerg.n >= 15, `${comAlerg.n} produtos declaram alergenico (RDC 727)`);

const pizzas = await uma(
  `SELECT hora_inicio, hora_fim FROM food_categorias WHERE loja_id = $1 AND nome = 'Pizzas'`, [loja]);
checa(pizzas.hora_inicio !== null && pizzas.hora_fim !== null,
  "a categoria Pizzas tem horario, para demonstrar que some fora da faixa");

const variados = await uma(
  `SELECT COUNT(*)::int n FROM food_variacoes v
     JOIN food_produtos p ON p.id = v.produto_id WHERE p.loja_id = $1`, [loja]);
checa(variados.n >= 5, "existem variacoes (chope 300 e 500, caipirinha)");

const obrig = await uma(
  `SELECT COUNT(*)::int n FROM food_grupos_opcao g
     JOIN food_produtos p ON p.id = g.produto_id
    WHERE p.loja_id = $1 AND g.obrigatorio = true`, [loja]);
checa(obrig.n >= 1, "existe grupo obrigatorio, para demonstrar a regra no servidor");

// ---------------------------------------------------------------------------
// 3. mesas, tablets, impressoras e PIN
// ---------------------------------------------------------------------------
checa(r.mesas.length === 18, "18 mesas geradas");
checa(r.mesas.every((m) => m.token && m.token.length >= 10),
  "toda mesa tem token proprio, que e o que vai gravado no cartao");
checa(new Set(r.mesas.map((m) => m.token)).size === r.mesas.length,
  "nenhum token de mesa se repete");

checa(r.disp.filter((d) => d.tipo === "kds").length === 4,
  "quatro telas de cozinha, uma por praca");
checa(r.disp.some((d) => d.tipo === "garcom"), "existe o tablet do garcom");

const contaImp = await uma(
  `SELECT COUNT(*)::int n FROM food_impressoras
    WHERE loja_id = $1 AND 'conta' = ANY(imprime)`, [loja]);
checa(contaImp.n === 1, "existe impressora marcada para a conta do cliente");

const pins = await uma(
  `SELECT COUNT(*)::int n FROM food_equipe WHERE loja_id = $1 AND pin_hash IS NOT NULL`, [loja]);
checa(pins.n === 5, "os cinco da equipe tem PIN gravado com hash");
const gerente = await uma(
  `SELECT COUNT(*)::int n FROM food_equipe WHERE loja_id = $1 AND papel = 'gerente'`, [loja]);
checa(gerente.n === 1, "existe um gerente, que e quem pode dar cortesia");

// ---------------------------------------------------------------------------
// 4. o historico: e o que faz o relatorio ter grafico
// ---------------------------------------------------------------------------
checa(r.sessoes > 50, `${r.sessoes} comandas fechadas no historico`);
checa(r.faturamento > 10000, `R$ ${r.faturamento.toFixed(2)} de faturamento no periodo`);

const orfas = await uma(
  `SELECT COUNT(*)::int n FROM food_sessoes
    WHERE loja_id = $1 AND status = 'fechada' AND (fechada_em IS NULL OR total = 0)`, [loja]);
checa(orfas.n === 0, "nenhuma comanda fechada sem data ou sem total");

const paga = await uma(
  `SELECT COUNT(*)::int n FROM food_sessoes s
    WHERE s.loja_id = $1 AND s.status = 'fechada'
      AND NOT EXISTS (SELECT 1 FROM food_pagamentos p WHERE p.sessao_id = s.id)`, [loja]);
checa(paga.n === 0, "toda comanda fechada tem pagamento lancado");

const semEvento = await uma(
  `SELECT COUNT(*)::int n FROM food_itens i
     JOIN food_pedidos p ON p.id = i.pedido_id
    WHERE p.loja_id = $1
      AND NOT EXISTS (SELECT 1 FROM food_item_eventos e WHERE e.item_id = i.id)`, [loja]);
checa(semEvento.n === 0, "todo item tem trilha de eventos, que e o que auditoria pede");

const tempoNegativo = await uma(
  `SELECT COUNT(*)::int n FROM food_itens i
     JOIN food_pedidos p ON p.id = i.pedido_id
    WHERE p.loja_id = $1 AND i.pronto_em IS NOT NULL AND i.pronto_em < i.criado_em`, [loja]);
checa(tempoNegativo.n === 0, "nenhum item ficou pronto antes de existir");

const cancel = await uma(
  `SELECT COUNT(*)::int n FROM food_itens i
     JOIN food_pedidos p ON p.id = i.pedido_id
    WHERE p.loja_id = $1 AND i.status = 'cancelado' AND i.cancelado_motivo IS NULL`, [loja]);
checa(cancel.n === 0, "todo cancelamento do historico tem motivo");

const recusas = await uma(
  `SELECT COUNT(*)::int n FROM food_sessoes
    WHERE loja_id = $1 AND servico_recusado = true`, [loja]);
checa(recusas.n > 0, `${recusas.n} clientes recusaram a taxa de servico, como a lei permite`);

// ---------------------------------------------------------------------------
// 5. as telas da demo encontram o que precisam
// ---------------------------------------------------------------------------
const rel = await relatorioCompleto(db, neg, loja, {
  de: new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10),
  ate: new Date().toISOString().slice(0, 10),
});
checa(rel.pracas.length > 0, "Relatorios: tempo por praca tem linha");
checa(rel.pracas.some((t) => Number(t.estourados) > 0),
  "Relatorios: existem itens que estouraram a meta, senao o grafico mente");
checa(rel.horas.length > 3, "Relatorios: a curva do dia tem varias horas");
checa(rel.cancelados.length > 0, "Relatorios: mais cancelados tem motivo e autor");
checa(rel.pessoas.length > 0, "Relatorios: quem trabalhou tem gente na lista");
checa(Number(rel.retrabalho.desfeitos) > 0,
  "Relatorios: retrabalho tem desfazer, porque dedo gordo existe na cozinha");

const av = await resumoDeAvaliacoes(db, neg, loja);
const notas = av.totais;
checa(Number(notas.total) > 0, `Marketing: ${notas.total} avaliacoes`);
checa(Number(notas.media) > 3.5, `Marketing: media ${notas.media}, casa boa mas nao perfeita`);
checa(av.queixas.length > 0, "Marketing: as queixas vem agrupadas por marcador");
const ruins = await uma(
  `SELECT COUNT(*)::int n FROM food_avaliacoes
    WHERE loja_id = $1 AND nota <= 3 AND foi_pro_google = false`, [loja]);
checa(ruins.n > 0, "Marketing: existe nota baixa, e ela NAO foi para o Google");

// ---------------------------------------------------------------------------
// 6. o KDS abre com trabalho na tela, e nao vazio
// ---------------------------------------------------------------------------
const kds = await estadoKds(db, neg, loja, null);
checa(kds.length >= 8, `KDS: ${kds.length} itens esperando na cozinha agora`);
checa(kds.some((i) => i.status === "pendente"), "KDS: tem item pendente");
checa(kds.some((i) => i.status === "em_producao"), "KDS: tem item em producao");
checa(kds.some((i) => i.restricao), "KDS: tem uma alergia escrita, que sai em faixa vermelha");
checa(kds.some((i) => i.obs), "KDS: tem observacao do cliente");

// a cor do cartao no KDS vem do relogio. Se todos os itens nascerem juntos, a
// tela abre inteira verde e nao demonstra nada.
const idades = kds.map((i) => (Date.now() - new Date(i.criado_em).getTime()) / 60000);
checa(Math.max(...idades) - Math.min(...idades) > 15,
  "KDS: os itens tem idades bem diferentes, entao a tela abre com verde, ambar e vermelho");

const areas = await resumoPorArea(db, neg, loja);
checa(areas.length >= 3, `KDS: ${areas.length} pracas com fila, o filtro por praca faz sentido`);

// ---------------------------------------------------------------------------
// 7. cupom e caixa
// ---------------------------------------------------------------------------
const cup = await uma(`SELECT COUNT(*)::int n FROM food_cupons WHERE loja_id = $1`, [loja]);
checa(cup.n === 2, "dois cupons: um sempre valido e um de happy hour");

const caixaAberto = await uma(
  `SELECT COUNT(*)::int n FROM food_caixas WHERE loja_id = $1 AND status = 'aberto'`, [loja]);
checa(caixaAberto.n === 1, "existe exatamente um caixa aberto agora");

const sangrias = await uma(
  `SELECT COUNT(*)::int n FROM food_caixa_mov m
     JOIN food_caixas c ON c.id = m.caixa_id WHERE c.loja_id = $1`, [loja]);
checa(sangrias.n > 0, `${sangrias.n} sangrias no historico, a gaveta tem o que mostrar`);

// ---------------------------------------------------------------------------
// 8. rodar de novo nao duplica a casa
// ---------------------------------------------------------------------------
await semear(db, { dias: 2, silencioso: true });
const quantas = await uma(`SELECT COUNT(*)::int n FROM food_lojas WHERE slug = 'esquina-49'`);
checa(quantas.n === 1, "rodar o seed de novo refaz a casa, nao cria uma segunda");

console.log("");
console.log(falhas === 0 ? `TUDO VERDE (${testes} checagens)` : `${falhas} FALHAS de ${testes}`);
process.exit(falhas === 0 ? 0 : 1);
