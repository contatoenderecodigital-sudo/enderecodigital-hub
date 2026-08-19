import { NextResponse } from "next/server";
import { query, exec, garantirColuna } from "@/lib/groow/db";
import { gerarConteudo } from "@/lib/groow/social-ia";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface IdeiaRow { id: number; pilar: string; tipo: "reel" | "carrossel" | "story"; hook: string; descricao: string | null; formato: string; status: string }

// GET → ideia + conteúdo mais recente (com corpo completo)
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const ideias = await query<IdeiaRow>(`SELECT * FROM social_ideias WHERE id = $1 LIMIT 1`, [Number(id)]);
    if (!ideias[0]) return NextResponse.json({ error: "Ideia não encontrada" }, { status: 404 });
    await garantirColuna("social_conteudos", "custo_usd", "NUMERIC(8,4)");
    const conteudos = await query(
      `SELECT id, tipo, titulo, corpo, legenda, hashtags, status, custo_usd FROM social_conteudos WHERE ideia_id = $1 ORDER BY id DESC LIMIT 1`,
      [Number(id)]
    );
    return NextResponse.json({ ideia: ideias[0], conteudo: conteudos[0] ?? null });
  } catch (err) {
    console.error("[social/id]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}

// POST { acao: "gerar" } → gera o conteúdo completo da ideia via IA
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: { acao?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (body.acao !== "gerar") return NextResponse.json({ error: "Ação inválida" }, { status: 400 });

  try {
    const ideias = await query<IdeiaRow>(`SELECT * FROM social_ideias WHERE id = $1 LIMIT 1`, [Number(id)]);
    const ideia = ideias[0];
    if (!ideia) return NextResponse.json({ error: "Ideia não encontrada" }, { status: 404 });

    const g = await gerarConteudo(ideia);
    await garantirColuna("social_conteudos", "custo_usd", "NUMERIC(8,4)");
    const r = await exec(
      `INSERT INTO social_conteudos (ideia_id, tipo, titulo, corpo, legenda, hashtags, custo_usd) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [ideia.id, ideia.tipo, g.titulo.slice(0, 250), g.corpo, g.legenda, g.hashtags.slice(0, 490), g.custo_usd]
    );
    await exec(`UPDATE social_ideias SET status = 'gerada' WHERE id = $1`, [ideia.id]);
    return NextResponse.json({ ok: true, conteudo_id: r.insertId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao gerar conteúdo";
    const conhecido = /ANTHROPIC|401|429|formato inesperado/.test(msg);
    if (!conhecido) console.error("[social gerar]", err);
    return NextResponse.json({ error: conhecido ? msg : "Erro ao processar a requisição." }, { status: 502 });
  }
}

// PATCH { acao: "descartar" } | { status_conteudo, conteudo_id }
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: { acao?: string; conteudo_id?: number; status_conteudo?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  try {
    if (body.acao === "descartar") {
      await exec(`UPDATE social_ideias SET status = 'descartada' WHERE id = $1`, [Number(id)]);
      return NextResponse.json({ ok: true });
    }
    if (body.conteudo_id && body.status_conteudo && ["rascunho", "aprovado", "publicado"].includes(body.status_conteudo)) {
      await exec(`UPDATE social_conteudos SET status = $1 WHERE id = $2 AND ideia_id = $3`, [body.status_conteudo, Number(body.conteudo_id), Number(id)]);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (err) {
    console.error("[social/id]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}
