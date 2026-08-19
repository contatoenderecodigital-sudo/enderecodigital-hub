import { NextResponse } from "next/server";
import { listPosts, createPost } from "@/lib/groow/blog";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const status = new URL(req.url).searchParams.get("status") ?? undefined;
    const posts = await listPosts(status || undefined);
    return NextResponse.json({ posts });
  } catch (err) {
    console.error("[admin/blog]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: { titulo?: string; resumo?: string; corpo?: string; keyword_foco?: string; categoria?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!body.titulo?.trim() || !body.corpo?.trim()) {
    return NextResponse.json({ error: "Título e corpo são obrigatórios" }, { status: 400 });
  }
  try {
    const id = await createPost({
      titulo: body.titulo,
      resumo: body.resumo || "",
      corpo: body.corpo,
      keyword_foco: body.keyword_foco,
      categoria: body.categoria,
      origem: "manual",
    });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error("[admin/blog]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}
