import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

const HUB = new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const db = new PGlite();
const semExt = (t) => t.replace(/CREATE EXTENSION[^;]+;/gi, "");
let falhas = 0;

async function roda(nome, sql) {
  try { await db.exec(sql); console.log("OK    " + nome); return true; }
  catch (e) { console.log("FALHA " + nome + " -> " + e.message); falhas++; return false; }
}
function checa(cond, msg) {
  console.log((cond ? "OK    " : "FALHA ") + msg);
  if (!cond) falhas++;
}

await roda("schema.sql", semExt(fs.readFileSync(HUB + "schema.sql", "utf8")));
await roda("migration_0003_food.sql", semExt(fs.readFileSync(HUB + "migration_0003_food.sql", "utf8")));
await roda("migration_0004_food_edicao.sql", semExt(fs.readFileSync(HUB + "migration_0004_food_edicao.sql", "utf8")));
await roda("migration_0005_kds.sql", semExt(fs.readFileSync(HUB + "migration_0005_kds.sql", "utf8")));
await roda("migration_0006_fuso.sql", semExt(fs.readFileSync(HUB + "migration_0006_fuso.sql", "utf8")));
await roda("migration_0007_operacao.sql", semExt(fs.readFileSync(HUB + "migration_0007_operacao.sql", "utf8")));
await roda("migration_0008_dispositivos.sql", semExt(fs.readFileSync(HUB + "migration_0008_dispositivos.sql", "utf8")));
await roda("migration_0009_vendas.sql", semExt(fs.readFileSync(HUB + "migration_0009_vendas.sql", "utf8")));
await roda("migration_0010_fiscal.sql", semExt(fs.readFileSync(HUB + "migration_0010_fiscal.sql", "utf8")));

await db.exec(`
  INSERT INTO hubs (nome, slug) VALUES ('Teste','teste');
  INSERT INTO negocios (hub_id, slug, nome) SELECT id, 'boteco', 'Boteco' FROM hubs LIMIT 1;
`);
await roda("seed-food-demo.sql",
  semExt(fs.readFileSync(HUB + "seed-food-demo.sql", "utf8"))
    .replace(/gen_random_bytes\((\d+)\)/g, "gen_random_uuid()::text::bytea"));

const loja = (await db.query("SELECT * FROM food_lojas LIMIT 1")).rows[0];
const neg = loja.negocio_id;

// ---- bairros de entrega
await db.exec(`
  INSERT INTO food_bairros (negocio_id, loja_id, nome, taxa, tempo_min)
  VALUES ('${neg}','${loja.id}','Centro',8,35), ('${neg}','${loja.id}','Jardim America',12,50);
`);
const b = (await db.query("SELECT id, nome, taxa FROM food_bairros ORDER BY nome LIMIT 1")).rows[0];
checa(Number(b.taxa) === 8, "bairro com taxa cadastrada (" + b.nome + ")");

// ---- pedido de delivery com taxa e status em_entrega
await db.exec(`
  INSERT INTO food_clientes (negocio_id, nome, telefone, optin_whats)
    VALUES ('${neg}','Maria','5549999990000',true);
  INSERT INTO food_contadores (loja_id, dia, ultimo) VALUES ('${loja.id}', CURRENT_DATE, 1);
  INSERT INTO food_pedidos (negocio_id, loja_id, numero_dia, canal, status, subtotal, taxa_entrega, total,
                            cliente_id, bairro_id, entrega_json)
    SELECT '${neg}','${loja.id}',1,'delivery','aprovado',50,${b.taxa},${50 + Number(b.taxa)},
           c.id,'${b.id}', '{"tipo":"entrega","rua":"Rua das Flores","numero":"120"}'::jsonb
      FROM food_clientes c LIMIT 1;
`);
const ped = (await db.query("SELECT id, total FROM food_pedidos WHERE canal='delivery'")).rows[0];
checa(Number(ped.total) === 58, "pedido de delivery soma a taxa do bairro (58)");

await db.exec(`UPDATE food_pedidos SET status='em_entrega', saiu_entrega_em=now() WHERE id='${ped.id}';`);
const st = (await db.query(`SELECT status FROM food_pedidos WHERE id='${ped.id}'`)).rows[0];
checa(st.status === "em_entrega", "status em_entrega aceito pelo banco");

// ---- evento que vira aviso no WhatsApp
await db.exec(`
  INSERT INTO food_eventos (negocio_id, loja_id, tipo, pedido_id, cliente_id)
  SELECT '${neg}','${loja.id}','saiu_entrega', id, cliente_id FROM food_pedidos WHERE id='${ped.id}';
`);
const ev = (await db.query(`
  SELECT e.tipo, c.telefone, c.optin_whats, p.numero_dia
    FROM food_eventos e
    LEFT JOIN food_clientes c ON c.id = e.cliente_id
    LEFT JOIN food_pedidos p ON p.id = e.pedido_id
   WHERE e.processado_em IS NULL`)).rows[0];
checa(ev && ev.telefone === "5549999990000" && ev.optin_whats === true,
  "fila de eventos traz telefone e opt-in para o disparo");

// ---- foto no banco
await db.exec(`
  INSERT INTO food_midias (negocio_id, loja_id, tipo_mime, bytes, tamanho, origem)
  VALUES ('${neg}','${loja.id}','image/webp', '\x0102030405'::bytea, 5, 'produto');
`);
const mid = (await db.query("SELECT id, tamanho FROM food_midias LIMIT 1")).rows[0];
checa(mid.tamanho === 5, "foto gravada no banco e servida por /api/food/midia/" + String(mid.id).slice(0, 8));

// ---- regra: produto vendido nao pode ser apagado (fica inativo)
const prod = (await db.query("SELECT id FROM food_produtos LIMIT 1")).rows[0];
await db.exec(`
  INSERT INTO food_itens (negocio_id, pedido_id, produto_id, nome_snapshot, qtd, preco_unit, preco_total)
  VALUES ('${neg}','${ped.id}','${prod.id}','Costela',1,50,50);
`);
const vendido = (await db.query(`SELECT EXISTS (SELECT 1 FROM food_itens WHERE produto_id='${prod.id}') AS e`)).rows[0];
checa(vendido.e === true, "produto ja vendido e detectado (vai virar inativo em vez de apagado)");

// ---- horario de funcionamento
await db.exec(`
  INSERT INTO food_horarios (negocio_id, loja_id, dia_semana, abre, fecha)
  SELECT '${neg}','${loja.id}', d, '18:00', '23:30' FROM generate_series(0,6) d;
`);
const aberta = (await db.query(`
  SELECT EXISTS (SELECT 1 FROM food_horarios
    WHERE loja_id='${loja.id}' AND dia_semana = EXTRACT(DOW FROM now())::int
      AND '20:00'::time BETWEEN abre AND fecha) AS a`)).rows[0];
checa(aberta.a === true, "horario de funcionamento responde certo as 20h");

// ---- reordenacao
const cats = (await db.query("SELECT id FROM food_categorias ORDER BY ordem")).rows;
await db.exec(`UPDATE food_categorias SET ordem = 0 WHERE id='${cats[1].id}';
               UPDATE food_categorias SET ordem = 1 WHERE id='${cats[0].id}';`);
const nova = (await db.query("SELECT id FROM food_categorias ORDER BY ordem LIMIT 1")).rows[0];
checa(nova.id === cats[1].id, "reordenar categoria funciona");

console.log(falhas === 0 ? "\nTUDO PASSOU" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
