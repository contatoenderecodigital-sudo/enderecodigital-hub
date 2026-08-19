/**
 * Copia os dados do MySQL do GROOW para o schema `groow` do Postgres.
 *
 * Re-executavel: TRUNCATE + INSERT por tabela, dentro de uma transacao. Rode
 * quantas vezes quiser antes da virada, e mais uma vez na virada para pegar o
 * que entrou no meio tempo.
 *
 * NAO toca no MySQL. So le.
 *
 * Uso:
 *   node db/copiar-groow-para-pg.cjs            # copia e confere
 *   node db/copiar-groow-para-pg.cjs --conferir # so compara as contagens
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const { Pool } = require("pg");

const RAIZ = path.join(__dirname, "..");
const env = {};
for (const l of fs.readFileSync(path.join(RAIZ, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}

const SO_CONFERIR = process.argv.includes("--conferir");
const LOTE = 500;

async function main() {
  const my = await mysql.createConnection({
    host: env.MYSQL_HOST,
    port: Number(env.MYSQL_PORT),
    user: env.MYSQL_USER,
    password: env.MYSQL_PASSWORD,
    database: env.MYSQL_DATABASE,
    dateStrings: false,
  });
  const pg = new Pool({ connectionString: env.DATABASE_URL });

  const [tabelas] = await my.query(
    `SELECT table_name AS n FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' ORDER BY 1`
  );
  const nomes = tabelas.map((t) => t.n);

  if (!SO_CONFERIR) {
    const ddl = fs.readFileSync(path.join(__dirname, "migrations", "groow-postgres.sql"), "utf8");
    await pg.query(ddl);
    console.log("schema groow aplicado no Postgres\n");
  }

  const problemas = [];
  console.log("TABELA".padEnd(28), "MYSQL".padStart(8), "PG".padStart(8), " ");
  console.log("-".repeat(60));

  for (const t of nomes) {
    const [linhas] = await my.query(`SELECT * FROM \`${t}\``);

    if (!SO_CONFERIR) {
      const cliente = await pg.connect();
      try {
        await cliente.query("BEGIN");
        await cliente.query(`TRUNCATE groow."${t}" RESTART IDENTITY CASCADE`);

        if (linhas.length) {
          const cols = Object.keys(linhas[0]);
          const listaCols = cols.map((c) => `"${c}"`).join(", ");
          for (let i = 0; i < linhas.length; i += LOTE) {
            const fatia = linhas.slice(i, i + LOTE);
            const valores = [];
            const marcadores = fatia.map((linha, j) => {
              const base = j * cols.length;
              cols.forEach((c) => valores.push(normaliza(linha[c])));
              return `(${cols.map((_, k) => `$${base + k + 1}`).join(", ")})`;
            });
            await cliente.query(
              `INSERT INTO groow."${t}" (${listaCols}) VALUES ${marcadores.join(", ")}`,
              valores
            );
          }

          // Acerta a sequence da identity para o proximo insert nao colidir.
          const temId = Object.keys(linhas[0]).includes("id");
          if (temId) {
            await cliente.query(
              `SELECT setval(pg_get_serial_sequence('groow."${t}"', 'id'),
                             COALESCE((SELECT MAX(id) FROM groow."${t}"), 1))`
            );
          }
        }
        await cliente.query("COMMIT");
      } catch (e) {
        await cliente.query("ROLLBACK");
        problemas.push(`${t}: ${e.message}`);
      } finally {
        cliente.release();
      }
    }

    const r = await pg.query(`SELECT COUNT(*)::int AS c FROM groow."${t}"`).catch(() => ({ rows: [{ c: -1 }] }));
    const pgN = r.rows[0].c;
    const ok = pgN === linhas.length;
    if (!ok) problemas.push(`${t}: mysql=${linhas.length} pg=${pgN}`);
    console.log(
      t.padEnd(28),
      String(linhas.length).padStart(8),
      String(pgN).padStart(8),
      ok ? " ok" : " *** DIFERENTE ***"
    );
  }

  console.log("\n" + (problemas.length ? "PROBLEMAS:\n  " + problemas.join("\n  ") : "tudo conferido, sem divergencia"));

  await my.end();
  await pg.end();
  process.exit(problemas.length ? 1 : 0);
}

/** mysql2 devolve Buffer para blob e Date para datas; pg aceita ambos. */
function normaliza(v) {
  if (v === undefined) return null;
  return v;
}

main().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
