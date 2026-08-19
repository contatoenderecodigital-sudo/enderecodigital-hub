import { NextResponse } from "next/server";
import { query } from "@/lib/groow/db";
import { createPost } from "@/lib/groow/blog";
import { gerarArtigoBlog } from "@/lib/groow/blog-ia";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

// Gera um artigo SEO completo via Claude API e salva como rascunho.
// SEM tema = modo automático: a IA pesquisa na web o que está em alta,
// escolhe tema + palavra-chave sozinha e escreve (mesmo caminho do cron).
export async function POST(req: Request) {
  let body: { tema?: string; keyword?: string; observacoes?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  try {
    // títulos existentes evitam tema repetido (no manual e no automático)
    let titulos: string[] = [];
    try {
      const rows = await query<{ titulo: string; slug: string; status: string }>(
        `SELECT titulo, slug, status FROM blog_posts ORDER BY id DESC LIMIT 60`
      );
      // publicados levam o caminho junto: viram alvo de link interno no artigo novo
      titulos = rows.map((r) => (r.status === "publicado" ? `${r.titulo} [/blog/${r.slug}]` : r.titulo));
    } catch { /* tabela pode não existir ainda */ }

    const artigo = await gerarArtigoBlog({
      tema: body.tema?.trim() || undefined,
      keyword: body.keyword,
      observacoes: body.observacoes,
      titulosExistentes: titulos,
    });
    const id = await createPost({ ...artigo, origem: "ia" });
    return NextResponse.json({ ok: true, id, titulo: artigo.titulo });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao gerar";
    const conhecido = /ANTHROPIC|401|429|formato inesperado|incompleto/.test(msg);
    if (!conhecido) console.error("[blog/gerar]", err);
    return NextResponse.json({ error: conhecido ? msg : "Erro ao processar a requisição." }, { status: 502 });
  }
}
