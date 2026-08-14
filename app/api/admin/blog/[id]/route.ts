import { NextResponse } from "next/server";
import { exec } from "@/lib/groow/db";
import { getPostById, sanitizeHtml, slugify } from "@/lib/groow/blog";
import { pingIndexNow } from "@/lib/groow/indexnow";

export const dynamic = "force-dynamic";

const STATUS_VALIDOS = ["rascunho", "aprovado", "publicado", "arquivado"];

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const post = await getPostById(Number(id));
    if (!post) return NextResponse.json({ error: "Post não encontrado" }, { status: 404 });
    return NextResponse.json({ post });
  } catch (err) {
    console.error("[admin/blog/id]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: { status?: string; titulo?: string; resumo?: string; corpo?: string; keyword_foco?: string; categoria?: string; slug?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  try {
    const post = await getPostById(Number(id));
    if (!post) return NextResponse.json({ error: "Post não encontrado" }, { status: 404 });

    const sets: string[] = [];
    const params: (string | number | null)[] = [];

    if (body.status) {
      if (!STATUS_VALIDOS.includes(body.status)) {
        return NextResponse.json({ error: "Status inválido" }, { status: 400 });
      }
      sets.push("status = ?");
      params.push(body.status);
      // publicou agora → carimba published_at (uma vez só)
      if (body.status === "publicado" && !post.published_at) {
        sets.push("published_at = NOW()");
      }
    }
    if (body.titulo?.trim()) { sets.push("titulo = ?"); params.push(body.titulo.trim()); }
    if (body.resumo != null) { sets.push("resumo = ?"); params.push(body.resumo.trim()); }
    if (body.corpo?.trim()) { sets.push("corpo = ?"); params.push(sanitizeHtml(body.corpo)); }
    if (body.keyword_foco != null) { sets.push("keyword_foco = ?"); params.push(body.keyword_foco.trim()); }
    if (body.categoria?.trim()) { sets.push("categoria = ?"); params.push(body.categoria.trim()); }
    if (body.slug?.trim()) { sets.push("slug = ?"); params.push(slugify(body.slug)); }

    if (!sets.length) return NextResponse.json({ error: "Nada pra atualizar" }, { status: 400 });

    await exec(`UPDATE blog_posts SET ${sets.join(", ")} WHERE id = ?`, [...params, Number(id)]);
    // publicou: avisa os buscadores via IndexNow (fire-and-forget)
    if (body.status === "publicado") {
      const slug = body.slug?.trim() ? slugify(body.slug) : post.slug;
      void pingIndexNow([`https://enderecodigital.com/blog/${slug}`, "https://enderecodigital.com/blog"]);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/blog/id]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    await exec(`DELETE FROM blog_posts WHERE id = ?`, [Number(id)]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/blog/id]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}
