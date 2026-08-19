import { NextResponse } from "next/server";
import { query, exec } from "@/lib/groow/db";
import { garantirTabelaMapa } from "@/lib/groow/mapa";

export const dynamic = "force-dynamic";

interface MapaRow { id: number; nome: string; dados: string; token: string }

// GET → mapa completo pro editor
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    await garantirTabelaMapa();
    const rows = await query<MapaRow>(`SELECT id, nome, dados, token FROM mapas_ecossistema WHERE id = $1 LIMIT 1`, [Number(id)]);
    if (!rows[0]) return NextResponse.json({ error: "Mapa não encontrado" }, { status: 404 });
    let dados: unknown = { nodes: [], edges: [] };
    try { dados = JSON.parse(rows[0].dados); } catch { /* mantém vazio */ }
    return NextResponse.json({ mapa: { ...rows[0], dados } });
  } catch (err) {
    console.error("[mapa/id GET]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}

// PATCH { nome?, dados? } → salva edições
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: { nome?: string; dados?: { nodes?: unknown[]; edges?: unknown[] } };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  try {
    if (body.nome !== undefined) {
      const nome = body.nome.trim();
      if (!nome) return NextResponse.json({ error: "Nome vazio" }, { status: 400 });
      await exec(`UPDATE mapas_ecossistema SET nome = $1 WHERE id = $2`, [nome.slice(0, 190), Number(id)]);
    }
    if (body.dados !== undefined) {
      const dados = { nodes: Array.isArray(body.dados.nodes) ? body.dados.nodes : [], edges: Array.isArray(body.dados.edges) ? body.dados.edges : [] };
      await exec(`UPDATE mapas_ecossistema SET dados = $1 WHERE id = $2`, [JSON.stringify(dados), Number(id)]);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[mapa/id PATCH]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    await exec(`DELETE FROM mapas_ecossistema WHERE id = $1`, [Number(id)]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[mapa/id DELETE]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}
