// ============================================================================
// Instala o AppFood no banco apontado pelo DATABASE_URL do .env.local.
//
//   node db/instalar-food.mjs          -> só as tabelas (não mexe em dado nenhum)
//   node db/instalar-food.mjs --demo   -> cria também um cliente "AppFood Demonstração"
//                                         com loja, cardápio, 10 mesas e tablets
//
// As migrations são idempotentes (CREATE TABLE IF NOT EXISTS), então rodar duas
// vezes não quebra nada. Tudo roda em transação: se falhar no meio, volta atrás.
// ============================================================================
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import pg from "pg";
import bcrypt from "bcryptjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, "..");
const DEMO = process.argv.includes("--demo");

function lerEnv() {
  for (const arquivo of [".env.local", ".env"]) {
    const p = path.join(RAIZ, arquivo);
    if (!fs.existsSync(p)) continue;
    const m = /DATABASE_URL=(.*)/.exec(fs.readFileSync(p, "utf8"));
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return process.env.DATABASE_URL;
}

const token = (n = 12) => crypto.randomBytes(n).toString("base64url");

const c = new pg.Client({ connectionString: lerEnv(), connectionTimeoutMillis: 10000 });
await c.connect();

try {
  await c.query("BEGIN");

  for (const arq of ["migration_0003_food.sql", "migration_0004_food_edicao.sql", "migration_0005_kds.sql", "migration_0006_fuso.sql", "migration_0007_operacao.sql", "migration_0008_dispositivos.sql", "migration_0009_vendas.sql", "migration_0010_fiscal.sql"]) {
    await c.query(fs.readFileSync(path.join(AQUI, arq), "utf8"));
    console.log("aplicado: " + arq);
  }

  const tabelas = await c.query(
    `SELECT COUNT(*)::int AS n FROM information_schema.tables
      WHERE table_schema='public' AND table_name LIKE 'food_%'`
  );
  console.log(`tabelas do restaurante no banco: ${tabelas.rows[0].n}`);

  if (DEMO) {
    const hub = (await c.query("SELECT id FROM hubs WHERE ativo = true ORDER BY criado_em LIMIT 1")).rows[0];
    if (!hub) throw new Error("nenhum hub ativo");

    // cliente próprio, para não misturar com os clientes reais
    const neg = (await c.query(
      `INSERT INTO negocios (hub_id, slug, nome, nome_fantasia, segmento, marca_cor, mod_food)
       VALUES ($1,'appfood-demo','AppFood Demonstração','AppFood Demonstração','restaurante','#b45309',true)
       ON CONFLICT (slug) DO UPDATE SET mod_food = true
       RETURNING id`,
      [hub.id]
    )).rows[0];

    const loja = (await c.query(
      `INSERT INTO food_lojas (negocio_id, slug, nome, tipo, cidade, uf, cor_destaque,
                               taxa_servico_pct, taxa_servico_automatica, aceita_delivery, tempo_preparo_min)
       VALUES ($1,'boteco-demo','Boteco Demonstração','bar','Xanxerê','SC','#b45309',10,true,true,25)
       ON CONFLICT (slug) DO UPDATE SET nome = EXCLUDED.nome
       RETURNING id`,
      [neg.id]
    )).rows[0];

    const jaTem = (await c.query("SELECT COUNT(*)::int AS n FROM food_mesas WHERE loja_id = $1", [loja.id])).rows[0].n;
    if (!jaTem) {
      const cozinha = (await c.query(
        "INSERT INTO food_areas (negocio_id, loja_id, nome, ordem) VALUES ($1,$2,'Cozinha',0) RETURNING id",
        [neg.id, loja.id])).rows[0];
      const bar = (await c.query(
        "INSERT INTO food_areas (negocio_id, loja_id, nome, ordem) VALUES ($1,$2,'Bar',1) RETURNING id",
        [neg.id, loja.id])).rows[0];

      const cat = async (nome, ordem) => (await c.query(
        "INSERT INTO food_categorias (negocio_id, loja_id, nome, ordem) VALUES ($1,$2,$3,$4) RETURNING id",
        [neg.id, loja.id, nome, ordem])).rows[0].id;
      const catEntrada = await cat("Para começar", 0);
      const catPrato = await cat("Pratos", 1);
      const catBebida = await cat("Bebidas", 2);

      const prod = async (categoria, area, nome, desc, preco, ordem, temVar = false) => (await c.query(
        `INSERT INTO food_produtos (negocio_id, loja_id, categoria_id, area_id, nome, descricao, preco, ordem, tem_variacao)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [neg.id, loja.id, categoria, area, nome, desc, preco, ordem, temVar])).rows[0].id;

      await prod(catEntrada, cozinha.id, "Porção de polenta", "Polenta frita com queijo ralado", 38, 0);
      await prod(catEntrada, cozinha.id, "Bolinho de costela", "8 unidades", 46, 1);
      const costela = await prod(catPrato, cozinha.id, "Costela no bafo", "Acompanha mandioca e vinagrete", 89, 0);
      const chope = await prod(catBebida, bar.id, "Chope pilsen", null, 0, 0, true);
      await prod(catBebida, bar.id, "Refrigerante lata", null, 8, 1);

      const grupo = (await c.query(
        `INSERT INTO food_grupos_opcao (negocio_id, produto_id, nome, minimo, maximo, obrigatorio, ordem)
         VALUES ($1,$2,'Acompanhamento',1,1,true,0) RETURNING id`, [neg.id, costela])).rows[0].id;
      await c.query(
        `INSERT INTO food_opcoes (negocio_id, grupo_id, nome, preco_extra, ordem)
         VALUES ($1,$2,'Mandioca frita',0,0), ($1,$2,'Arroz carreteiro',6,1)`, [neg.id, grupo]);
      await c.query(
        `INSERT INTO food_variacoes (negocio_id, produto_id, nome, preco, ordem)
         VALUES ($1,$2,'300ml',12,0), ($1,$2,'500ml',18,1)`, [neg.id, chope]);

      for (let i = 1; i <= 10; i++) {
        await c.query(
          `INSERT INTO food_mesas (negocio_id, loja_id, numero, token, ordem) VALUES ($1,$2,$3,$4,$5)`,
          [neg.id, loja.id, String(i), token(9), i]);
      }

      await c.query(
        `INSERT INTO food_dispositivos (negocio_id, loja_id, nome, tipo, area_id, token)
         VALUES ($1,$2,'Tablet da cozinha','kds',$3,$4), ($1,$2,'Tablet do bar','kds',$5,$6),
                ($1,$2,'Tablet do garçom','garcom',NULL,$7)`,
        [neg.id, loja.id, cozinha.id, token(9), bar.id, token(9), token(9)]);

      await c.query(
        `INSERT INTO food_impressoras (negocio_id, loja_id, area_id, nome, tipo, chave, colunas)
         VALUES ($1,$2,$3,'Impressora da cozinha','cloudprnt',$4,48)`,
        [neg.id, loja.id, cozinha.id, token(16)]);

      const pin = await bcrypt.hash("1234", 10);
      await c.query(
        `INSERT INTO food_equipe (negocio_id, loja_id, nome, papel, pin_hash)
         VALUES ($1,$2,'João (garçom)','garcom',$3), ($1,$2,'Entregador','entregador',$3)`,
        [neg.id, loja.id, pin]);

      await c.query(
        `INSERT INTO food_bairros (negocio_id, loja_id, nome, cidade, taxa, tempo_min)
         VALUES ($1,$2,'Centro','Xanxerê',8,35), ($1,$2,'Bela Vista','Xanxerê',12,45)`,
        [neg.id, loja.id]);

      const dias = [0, 1, 2, 3, 4, 5, 6];
      for (const d of dias) {
        await c.query(
          `INSERT INTO food_horarios (negocio_id, loja_id, dia_semana, abre, fecha)
           VALUES ($1,$2,$3,'11:00','23:59')`, [neg.id, loja.id, d]);
      }
    }

    console.log("\ncliente de demonstração: appfood-demo (negocio_id " + neg.id + ")");
  }

  await c.query("COMMIT");
  console.log("\nOK, gravado.");
} catch (e) {
  await c.query("ROLLBACK");
  console.log("FALHOU, nada foi gravado: " + e.message);
  await c.end();
  process.exit(1);
}

// ---- o que abrir depois
const urls = await c.query(
  `SELECT 'PAINEL DO DONO' AS o_que, '/food/' || l.negocio_id AS caminho FROM food_lojas l WHERE l.slug='boteco-demo'
   UNION ALL SELECT 'CARDAPIO', '/c/' || slug FROM food_lojas WHERE slug='boteco-demo'
   UNION ALL SELECT 'PEDIDO ONLINE', '/c/' || slug || '/pedir' FROM food_lojas WHERE slug='boteco-demo'
   UNION ALL SELECT 'MESA ' || m.numero, '/c/' || l.slug || '/m/' || m.token
     FROM food_mesas m JOIN food_lojas l ON l.id=m.loja_id WHERE l.slug='boteco-demo' AND m.numero IN ('1','2')
   UNION ALL SELECT d.tipo || ': ' || d.nome, CASE WHEN d.tipo='garcom' THEN '/g/' ELSE '/k/' END || d.token
     FROM food_dispositivos d JOIN food_lojas l ON l.id=d.loja_id WHERE l.slug='boteco-demo'
   UNION ALL SELECT 'IMPRESSORA', '/api/food/print/' || i.chave
     FROM food_impressoras i JOIN food_lojas l ON l.id=i.loja_id WHERE l.slug='boteco-demo'`
);
if (urls.rows.length) {
  console.log("\n--- para abrir (cole depois do endereço do hub) ---");
  for (const r of urls.rows) console.log(r.o_que.padEnd(26) + r.caminho);
  console.log("\nPIN do garçom na demonstração: 1234");
}

await c.end();
