import { query, exec, garantirColuna } from "@/lib/groow/db";

export interface BlogPost {
  id: number;
  slug: string;
  titulo: string;
  resumo: string;
  corpo: string;
  keyword_foco: string;
  categoria: string;
  status: "rascunho" | "aprovado" | "publicado" | "arquivado";
  origem: "ia" | "manual";
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface BlogPostResumo {
  id: number;
  slug: string;
  titulo: string;
  resumo: string;
  keyword_foco: string;
  categoria: string;
  status: BlogPost["status"];
  origem: BlogPost["origem"];
  created_at: string;
  published_at: string | null;
  custo_usd?: string | number | null; // DECIMAL vem como string do mysql2
}

async function tableExists(name: string): Promise<boolean> {
  const rows = await query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = 'groow' AND table_name = $1`,
    [name]
  );
  return Number(rows[0]?.n ?? 0) > 0;
}

export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 170);
}

/** Sanitização leve: só as tags que o artigo usa; remove scripts/handlers. */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}

export async function listPosts(status?: string): Promise<BlogPostResumo[]> {
  if (!(await tableExists("blog_posts"))) return [];
  await garantirColuna("blog_posts", "custo_usd", "NUMERIC(8,4)");
  const where = status ? `WHERE status = $1` : "";
  return query<BlogPostResumo>(
    `SELECT id, slug, titulo, resumo, keyword_foco, categoria, status, origem, custo_usd,
            to_char(created_at,'YYYY-MM-DD"T"HH24:MI:SS') AS created_at,
            to_char(published_at,'YYYY-MM-DD"T"HH24:MI:SS') AS published_at
     FROM blog_posts ${where} ORDER BY COALESCE(published_at, created_at) DESC LIMIT 200`,
    status ? [status] : []
  );
}

export async function listPublicados(limit = 50): Promise<BlogPostResumo[]> {
  if (!(await tableExists("blog_posts"))) return [];
  return query<BlogPostResumo>(
    `SELECT id, slug, titulo, resumo, keyword_foco, categoria, status, origem,
            to_char(created_at,'YYYY-MM-DD"T"HH24:MI:SS') AS created_at,
            to_char(published_at,'YYYY-MM-DD"T"HH24:MI:SS') AS published_at
     FROM blog_posts WHERE status = 'publicado'
     ORDER BY published_at DESC LIMIT $1`,
    [limit]
  );
}

export async function getPostBySlug(slug: string, apenasPublicado = true): Promise<BlogPost | null> {
  if (!(await tableExists("blog_posts"))) return null;
  const rows = await query<BlogPost>(
    `SELECT id, slug, titulo, resumo, corpo, keyword_foco, categoria, status, origem,
            to_char(created_at,'YYYY-MM-DD"T"HH24:MI:SS') AS created_at,
            to_char(updated_at,'YYYY-MM-DD"T"HH24:MI:SS') AS updated_at,
            to_char(published_at,'YYYY-MM-DD"T"HH24:MI:SS') AS published_at
     FROM blog_posts WHERE slug = $1 ${apenasPublicado ? "AND status = 'publicado'" : ""} LIMIT 1`,
    [slug]
  );
  return rows[0] ?? null;
}

export async function getPostById(id: number): Promise<BlogPost | null> {
  if (!(await tableExists("blog_posts"))) return null;
  const rows = await query<BlogPost>(
    `SELECT id, slug, titulo, resumo, corpo, keyword_foco, categoria, status, origem,
            to_char(created_at,'YYYY-MM-DD"T"HH24:MI:SS') AS created_at,
            to_char(updated_at,'YYYY-MM-DD"T"HH24:MI:SS') AS updated_at,
            to_char(published_at,'YYYY-MM-DD"T"HH24:MI:SS') AS published_at
     FROM blog_posts WHERE id = $1 LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function createPost(p: {
  titulo: string;
  resumo: string;
  corpo: string;
  keyword_foco?: string;
  categoria?: string;
  origem?: "ia" | "manual";
  custo_usd?: number;
}): Promise<number> {
  await garantirColuna("blog_posts", "custo_usd", "NUMERIC(8,4)");
  let slug = slugify(p.titulo);
  // slug único: se colidir, sufixa -2, -3...
  const existing = await query<{ slug: string }>(
    `SELECT slug FROM blog_posts WHERE slug = $1 OR slug ~ ('^' || $2 || '-[0-9]+$')`,
    [slug, slug]
  );
  if (existing.length) slug = `${slug}-${existing.length + 1}`;
  const r = await exec(
    `INSERT INTO blog_posts (slug, titulo, resumo, corpo, keyword_foco, categoria, origem, custo_usd)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [slug, p.titulo.trim(), p.resumo.trim(), sanitizeHtml(p.corpo), p.keyword_foco?.trim() || "", p.categoria?.trim() || "marketing-local", p.origem || "ia", p.custo_usd ?? null]
  );
  return r.insertId;
}
