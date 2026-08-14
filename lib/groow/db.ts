import mysql from "mysql2/promise";

let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (pool) return pool;

  const host = process.env.MYSQL_HOST || "127.0.0.1";
  const port = Number(process.env.MYSQL_PORT || 3306);
  const user = process.env.MYSQL_USER || "";
  const password = process.env.MYSQL_PASSWORD || "";
  const database = process.env.MYSQL_DATABASE || "";

  if (!user || !password || !database) {
    throw new Error(
      "MySQL env vars ausentes (MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE). Configura no .env.local."
    );
  }

  pool = mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    charset: "utf8mb4",
    timezone: "Z",
    dateStrings: false,
  });

  return pool;
}

type QueryParam = string | number | boolean | Date | null;

export async function query<T = unknown>(
  sql: string,
  params: QueryParam[] = []
): Promise<T[]> {
  const [rows] = await getPool().execute(sql, params);
  return rows as T[];
}

export interface ExecResult {
  insertId: number;
  affectedRows: number;
}

export async function exec(
  sql: string,
  params: QueryParam[] = []
): Promise<ExecResult> {
  const [result] = await getPool().execute(sql, params);
  const r = result as { insertId?: number; affectedRows?: number };
  return { insertId: r.insertId ?? 0, affectedRows: r.affectedRows ?? 0 };
}

// Migração leve: garante que uma coluna existe antes de usar (checa 1x por
// processo). Evita ter que rodar ALTER TABLE na mão no servidor.
const colunasGarantidas = new Set<string>();

export async function garantirColuna(tabela: string, coluna: string, ddl: string): Promise<void> {
  const chave = `${tabela}.${coluna}`;
  if (colunasGarantidas.has(chave)) return;
  const rows = await query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [tabela, coluna]
  );
  if (!Number(rows[0]?.n ?? 0)) {
    await getPool().query(`ALTER TABLE \`${tabela}\` ADD COLUMN \`${coluna}\` ${ddl}`);
  }
  colunasGarantidas.add(chave);
}
