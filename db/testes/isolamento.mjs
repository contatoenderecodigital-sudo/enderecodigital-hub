// ============================================================================
// Teste de vazamento entre clientes.
//
// O isolamento do hub é 100% disciplina de código: `negocio_id` em toda tabela
// e em toda consulta, sem Row Level Security no Postgres. Isso funciona hoje e
// depende de quem escrever a próxima query. Este teste é a rede embaixo.
//
//   node db/testes/isolamento.mjs
//
// Duas partes:
//   1. DINÂMICA: dois restaurantes no mesmo banco, e cada operação do módulo é
//      tentada com o id do vizinho, esperando falha.
//   2. ESTÁTICA: varre lib/food*.ts atrás de UPDATE e DELETE em tabela `food_`
//      sem filtro de dono. Toda exceção precisa estar na lista abaixo, com
//      motivo escrito. É o que pega o `AND negocio_id` esquecido daqui a três
//      meses, que nenhum teste de fluxo pegaria.
// ============================================================================
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import {
  ErroKds, desfazerItem, estadoKds, historicoItem, marcar86,
  moverItem, moverPedido, moverSessao, resumoPorArea,
} from "../../lib/food-kds-sql.ts";

const DB = new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const LIB = path.join(DB, "..", "lib");
const semExt = (t) => t.replace(/CREATE EXTENSION[^;]+;/gi, "");
let falhas = 0;
let testes = 0;

function checa(cond, msg) {
  testes++;
  console.log((cond ? "OK    " : "FALHA ") + msg);
  if (!cond) falhas++;
}

/** A operação tem que FALHAR ou não mexer em nada. */
async function naoVaza(msg, fn) {
  testes++;
  try {
    const r = await fn();
    const vazio = r === null || r === undefined
      || (Array.isArray(r) && r.length === 0)
      || (typeof r === "object" && r !== null && r.movidos === 0 && r.repetidos === 0);
    console.log((vazio ? "OK    " : "FALHA ") + msg + (vazio ? " (nao devolveu nada)" : " -> DEVOLVEU DADO DO VIZINHO"));
    if (!vazio) falhas++;
  } catch (e) {
    const ok = e instanceof ErroKds;
    console.log((ok ? "OK    " : "FALHA ") + msg + (ok ? ` (${e.codigo})` : ` -> erro inesperado: ${e.message}`));
    if (!ok) falhas++;
  }
}

const db = new PGlite();
for (const arq of [
  "schema.sql", "migration_0003_food.sql", "migration_0004_food_edicao.sql",
  "migration_0005_kds.sql", "migration_0006_fuso.sql", "migration_0007_operacao.sql", "migration_0008_dispositivos.sql", "migration_0009_vendas.sql", "migration_0010_fiscal.sql",
]) {
  await db.exec(semExt(fs.readFileSync(DB + arq, "utf8")));
}

// ---------------------------------------------------------------------------
// Dois restaurantes no mesmo hub: o Boteco e a Pizzaria da esquina.
// ---------------------------------------------------------------------------
await db.exec(`
  INSERT INTO hubs (nome, slug) VALUES ('Teste','teste');
  INSERT INTO negocios (hub_id, slug, nome) SELECT id, 'boteco', 'Boteco' FROM hubs LIMIT 1;
  INSERT INTO negocios (hub_id, slug, nome) SELECT id, 'pizzaria', 'Pizzaria' FROM hubs LIMIT 1;
`);
const negs = (await db.query("SELECT id, slug FROM negocios ORDER BY slug")).rows;
const A = negs.find((n) => n.slug === "boteco").id;      // o meu
const B = negs.find((n) => n.slug === "pizzaria").id;    // o do vizinho

async function montarCasa(neg, slug) {
  await db.query("INSERT INTO food_lojas (negocio_id, slug, nome) VALUES ($1,$2,$2)", [neg, slug]);
  const loja = (await db.query("SELECT id FROM food_lojas WHERE slug = $1", [slug])).rows[0].id;
  await db.query("INSERT INTO food_areas (negocio_id, loja_id, nome) VALUES ($1,$2,'Cozinha')", [neg, loja]);
  const area = (await db.query("SELECT id FROM food_areas WHERE loja_id = $1", [loja])).rows[0].id;
  await db.query("INSERT INTO food_categorias (negocio_id, loja_id, nome) VALUES ($1,$2,'Geral')", [neg, loja]);
  const cat = (await db.query("SELECT id FROM food_categorias WHERE loja_id = $1", [loja])).rows[0].id;
  await db.query(
    "INSERT INTO food_produtos (negocio_id, loja_id, categoria_id, area_id, nome, preco) VALUES ($1,$2,$3,$4,$5,50)",
    [neg, loja, cat, area, `Prato do ${slug}`]);
  const prod = (await db.query("SELECT id FROM food_produtos WHERE loja_id = $1", [loja])).rows[0].id;
  await db.query("INSERT INTO food_mesas (negocio_id, loja_id, numero, token) VALUES ($1,$2,'1',$3)",
    [neg, loja, `tok-${slug}`]);
  const mesa = (await db.query("SELECT id FROM food_mesas WHERE loja_id = $1", [loja])).rows[0].id;
  await db.query(
    "INSERT INTO food_sessoes (negocio_id, loja_id, mesa_id, codigo, subtotal, total) VALUES ($1,$2,$3,'AAAA',50,50)",
    [neg, loja, mesa]);
  const sessao = (await db.query("SELECT id FROM food_sessoes WHERE loja_id = $1", [loja])).rows[0].id;
  await db.query(
    `INSERT INTO food_pedidos (negocio_id, loja_id, numero_dia, canal, sessao_id, mesa_id, status, subtotal, total)
     VALUES ($1,$2,1,'mesa',$3,$4,'aprovado',50,50)`, [neg, loja, sessao, mesa]);
  const pedido = (await db.query("SELECT id FROM food_pedidos WHERE loja_id = $1", [loja])).rows[0].id;
  await db.query(
    `INSERT INTO food_itens (negocio_id, pedido_id, produto_id, area_id, nome_snapshot, qtd, preco_unit, preco_total)
     VALUES ($1,$2,$3,$4,$5,1,50,50)`, [neg, pedido, prod, area, `Prato do ${slug}`]);
  const item = (await db.query("SELECT id FROM food_itens WHERE pedido_id = $1", [pedido])).rows[0].id;
  return { neg, loja, area, cat, prod, mesa, sessao, pedido, item };
}

const casaA = await montarCasa(A, "boteco");
const casaB = await montarCasa(B, "pizzaria");
const euA = { tipo: "painel", id: "u1", nome: "Dono do Boteco", origem: "teste" };

console.log("\n=== 1. o Boteco tentando mexer na Pizzaria ===");

await naoVaza("mover item do vizinho",
  () => moverItem(db, { negocioId: A, itemId: casaB.item, para: "em_producao", ator: euA }));

await naoVaza("cancelar item do vizinho",
  () => moverItem(db, { negocioId: A, itemId: casaB.item, para: "cancelado", ator: euA, motivo: "porque sim" }));

await naoVaza("desfazer transicao do vizinho",
  () => desfazerItem(db, { negocioId: A, itemId: casaB.item, ator: euA }));

await naoVaza("mover o pedido inteiro do vizinho",
  () => moverPedido(db, { negocioId: A, pedidoId: casaB.pedido, para: "pronto", ator: euA }));

await naoVaza("mover a comanda do vizinho",
  () => moverSessao(db, { negocioId: A, sessaoId: casaB.sessao, para: "conta_pedida", ator: euA }));

await naoVaza("esgotar produto do vizinho",
  () => marcar86(db, { negocioId: A, lojaId: casaA.loja, produtoId: casaB.prod, esgotado: true, ator: euA }));

await naoVaza("ler a linha do tempo de um item do vizinho",
  () => historicoItem(db, A, casaB.item));

await naoVaza("ler a fila da cozinha do vizinho pela loja dele",
  () => estadoKds(db, A, casaB.loja));

await naoVaza("ler o resumo por praca do vizinho",
  () => resumoPorArea(db, A, casaB.loja));

console.log("\n=== 2. nada do vizinho foi tocado ===");
const itemB = (await db.query("SELECT status FROM food_itens WHERE id = $1", [casaB.item])).rows[0];
checa(itemB.status === "pendente", "o item da Pizzaria continua pendente");
const sessB = (await db.query("SELECT status FROM food_sessoes WHERE id = $1", [casaB.sessao])).rows[0];
checa(sessB.status === "aberta", "a comanda da Pizzaria continua aberta");
const prodB = (await db.query("SELECT esgotado FROM food_produtos WHERE id = $1", [casaB.prod])).rows[0];
checa(prodB.esgotado === false, "o produto da Pizzaria nao foi esgotado");
const evB = (await db.query("SELECT COUNT(*)::int AS n FROM food_item_eventos WHERE item_id = $1", [casaB.item])).rows[0];
checa(evB.n === 0, "nenhum evento foi gravado no item da Pizzaria");

console.log("\n=== 3. e o dono da casa continua conseguindo trabalhar ===");
const okA = await moverItem(db, { negocioId: A, itemId: casaA.item, para: "em_producao", ator: euA });
checa(okA.para === "em_producao", "o Boteco move o proprio item");
checa((await estadoKds(db, A, casaA.loja)).length === 1, "o Boteco ve a propria fila");
checa((await estadoKds(db, B, casaB.loja)).length === 1, "a Pizzaria ve a propria fila");

// ---------------------------------------------------------------------------
// PARTE 2: a varredura estática.
// ---------------------------------------------------------------------------
console.log("\n=== 4. varredura: escrita em tabela food_ sem filtro de dono ===");

// Exceções conscientes. Cada uma precisa de um motivo, e o motivo tem que ser
// "a chave desta consulta JÁ é do inquilino" ou "é um segredo que só o dono da
// casa tem". Se a sua consulta nova não se encaixa em nenhum destes, ela está
// errada: ponha o `negocio_id`.
const PERMITIDAS = [
  ["food_contadores", "chaveada por loja_id, que ja foi resolvida pelo dono"],
  ["food_impressoras SET ultimo_ping", "chaveada pela chave secreta da impressora"],
  ["food_print_jobs SET status = 'entregue'", "chaveada pela impressora, que veio da chave secreta"],
  ["food_print_jobs j", "confirmarJob confere a chave da impressora na propria consulta"],
  ["food_dispositivos SET ultimo_uso", "chaveada pelo id do dispositivo, resolvido pelo token"],
  ["SET segredo = $2, pareado_em = now()", "pareamento: o aparelho foi resolvido pelo token unico uma linha acima"],
  ["food_turnos SET ultimo_uso", "o turno ja foi conferido contra a loja do tablet em turnoVivo()"],
  ["food_turnos SET fechado_em", "chaveada pelo turno ou pela pessoa, ambos da loja do tablet"],
  ["food_eventos SET processado_em", "fila global do cron de WhatsApp, roda fora de qualquer tenant"],
  ["food_insumos SET saldo", "insumo vem da ficha tecnica do pedido, que ja e do inquilino"],
  ["food_sessoes s", "recalcularSessao roda depois da conferencia de dono, dentro da transacao"],
  ["SET esgotado = false, esgotado_ate = NULL", "volta do 86 vencido, chaveada por loja_id"],
  ["food_lojas SET cardapio_rev", "contador do cardapio, chaveado por loja_id"],
  ["food_pedidos SET bairro_id", "o pedido acabou de nascer nesta requisicao"],
  ["food_pedidos SET pago_em", "o pagamento ja foi conferido pelo dono"],
  ["food_pedidos p", "sincronizarPedido roda dentro da transacao de moverItem, que ja conferiu o dono"],
  ["food_pagamentos SET status = 'confirmado'", "chaveada pelo par (psp, psp_id), que e unico"],
  ["food_fiscal_fila", "chaveada pela comanda, ja conferida"],
];

const ARQUIVOS = fs.readdirSync(LIB).filter((f) => /^food.*\.ts$/.test(f));
let suspeitas = 0;

/** O trecho da chamada inteira: do UPDATE até o `);` que fecha o query(). */
function trechoDaChamada(texto, i) {
  const fim = texto.indexOf(");", i);
  return texto.slice(i, fim === -1 ? i + 1200 : Math.min(fim + 2, i + 1500));
}

for (const arq of ARQUIVOS) {
  const texto = fs.readFileSync(path.join(LIB, arq), "utf8");
  const re = /(UPDATE|DELETE FROM)\s+(food_[a-z_]+)/g;
  let m;
  while ((m = re.exec(texto)) !== null) {
    const [, verbo, tabela] = m;
    const trecho = trechoDaChamada(texto, m.index);
    // vale tanto o filtro no SQL quanto o parâmetro passado logo abaixo
    if (/negocio_id|negocioId/.test(trecho)) continue;
    if (PERMITIDAS.some(([chave]) => trecho.includes(chave))) continue;
    suspeitas++;
    const linha = texto.slice(0, m.index).split("\n").length;
    console.log(`FALHA ${arq}:${linha} "${verbo} ${tabela}" sem filtro de dono e sem excecao declarada`);
    console.log("      " + trecho.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 3).join(" ").slice(0, 150));
  }
}
testes++;
if (suspeitas === 0) console.log(`OK    ${ARQUIVOS.length} arquivos varridos, nenhuma escrita sem dono`);
else falhas++;

console.log(`\n${testes - falhas}/${testes} checagens passaram.`);
process.exit(falhas === 0 ? 0 : 1);
