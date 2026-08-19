/**
 * Camada de dados do GROOW OS. Postgres, schema `groow`.
 *
 * Era mysql2. Não existe nenhuma tradução de SQL aqui: o que está escrito nos
 * arquivos é o que vai para o banco. Placeholder é `$1`, `$2`, e quem precisa
 * do id gerado escreve `RETURNING id` na própria query. Sem mágica no meio.
 *
 * Por que schema `groow`: o `public` deste banco já tem outra tabela `leads`,
 * a dos tenants do hub, sem relação com a do CRM da agência.
 */
import { Pool, type PoolClient } from "pg";

const globalForGroow = globalThis as unknown as { _groowPool?: Pool };

export function getPool(): Pool {
  if (globalForGroow._groowPool) return globalForGroow._groowPool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL ausente. Configure no .env.local / Coolify.");
  }

  const pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30_000,
    ssl: process.env.PGSSL === "1" ? { rejectUnauthorized: false } : undefined,
    // Resolve nomes sem qualificação: `leads` cai em groow.leads, e o que não
    // existir lá ainda encontra o public (extensões, funções).
    options: "-c search_path=groow,public",
  });

  globalForGroow._groowPool = pool;
  return pool;
}

export type QueryParam = string | number | boolean | Date | null;

export async function query<T = unknown>(
  sql: string,
  params: QueryParam[] = []
): Promise<T[]> {
  const res = await getPool().query(sql, params);
  return res.rows as T[];
}

export interface ExecResult {
  /** Preenchido só quando a query traz `RETURNING id`. Senão, 0. */
  insertId: number;
  affectedRows: number;
}

export async function exec(
  sql: string,
  params: QueryParam[] = []
): Promise<ExecResult> {
  const res = await getPool().query(sql, params);
  return {
    insertId: Number((res.rows[0] as { id?: unknown } | undefined)?.id ?? 0),
    affectedRows: res.rowCount ?? 0,
  };
}

/**
 * Roda várias instruções na mesma transação. Não existia no MySQL desta base;
 * agora existe, e é o jeito certo de fazer escrita em duas tabelas.
 */
export async function transacao<T>(
  fn: (c: {
    query: <R = unknown>(sql: string, params?: QueryParam[]) => Promise<R[]>;
    exec: (sql: string, params?: QueryParam[]) => Promise<ExecResult>;
  }) => Promise<T>
): Promise<T> {
  const cliente: PoolClient = await getPool().connect();
  try {
    await cliente.query("BEGIN");
    const saida = await fn({
      query: async <R = unknown>(sql: string, params: QueryParam[] = []) =>
        (await cliente.query(sql, params)).rows as R[],
      exec: async (sql: string, params: QueryParam[] = []) => {
        const r = await cliente.query(sql, params);
        return {
          insertId: Number((r.rows[0] as { id?: unknown } | undefined)?.id ?? 0),
          affectedRows: r.rowCount ?? 0,
        };
      },
    });
    await cliente.query("COMMIT");
    return saida;
  } catch (e) {
    await cliente.query("ROLLBACK");
    throw e;
  } finally {
    cliente.release();
  }
}

/**
 * Migração leve de coluna, mantida do tempo do MySQL porque continua útil para
 * não ter que rodar ALTER na mão no servidor. O tipo é Postgres puro.
 */
const colunasGarantidas = new Set<string>();

export async function garantirColuna(
  tabela: string,
  coluna: string,
  tipo: string
): Promise<void> {
  const chave = `${tabela}.${coluna}`;
  if (colunasGarantidas.has(chave)) return;
  await getPool().query(
    `ALTER TABLE groow."${tabela}" ADD COLUMN IF NOT EXISTS "${coluna}" ${tipo}`
  );
  colunasGarantidas.add(chave);
}
