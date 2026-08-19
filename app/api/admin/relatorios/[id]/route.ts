import { NextResponse } from "next/server";
import { query, exec } from "@/lib/groow/db";
import { garantirTabelaRelatorios } from "@/lib/groow/relatorios";

export const dynamic = "force-dynamic";

interface RelRow { id: number; cliente: string; periodo: string; dados: string; token: string }

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    await garantirTabelaRelatorios();
    const rows = await query<RelRow>(`SELECT id, cliente, periodo, dados, token FROM relatorios_cliente WHERE id = $1 LIMIT 1`, [Number(id)]);
    if (!rows[0]) return NextResponse.json({ error: "Relatório não encontrado" }, { status: 404 });
    let dados: unknown = {};
    try { dados = JSON.parse(rows[0].dados); } catch { /* */ }
    return NextResponse.json({ relatorio: { ...rows[0], dados } });
  } catch (err) {
    console.error("[relatorios/id GET]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: { cliente?: string; periodo?: string; dados?: Record<string, unknown> };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  try {
    if (body.cliente !== undefined) await exec(`UPDATE relatorios_cliente SET cliente = $1 WHERE id = $2`, [body.cliente.trim().slice(0, 190) || "Cliente", Number(id)]);
    if (body.periodo !== undefined) await exec(`UPDATE relatorios_cliente SET periodo = $1 WHERE id = $2`, [body.periodo.trim().slice(0, 20), Number(id)]);
    if (body.dados !== undefined) await exec(`UPDATE relatorios_cliente SET dados = $1 WHERE id = $2`, [JSON.stringify(body.dados), Number(id)]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[relatorios/id PATCH]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    await exec(`DELETE FROM relatorios_cliente WHERE id = $1`, [Number(id)]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[relatorios/id DELETE]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}
