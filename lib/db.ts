import { Pool } from "pg";

// Pool unico reaproveitado entre hot-reloads (dev) e requests (prod).
const globalForPg = globalThis as unknown as { _pgPool?: Pool };

export const pool: Pool =
  globalForPg._pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30_000,
    // Postgres interno na rede do Coolify: sem SSL. Ligue PGSSL=1 se precisar.
    ssl: process.env.PGSSL === "1" ? { rejectUnauthorized: false } : undefined,
  });

if (process.env.NODE_ENV !== "production") globalForPg._pgPool = pool;

export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<{ rows: T[] }> {
  const res = await pool.query(text, params);
  return { rows: res.rows as T[] };
}
