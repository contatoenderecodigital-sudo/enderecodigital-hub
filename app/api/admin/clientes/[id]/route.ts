import { NextResponse } from "next/server";
import { query, exec } from "@/lib/groow/db";
import { construtorSql, clausulaWhere, clausulaSet } from "@/lib/groow/sql";
import { CLIENTE_STATUSES, type Cliente, type ClienteStatus } from "@/lib/groow/types";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const rows = await query<Cliente>(`SELECT * FROM clientes WHERE id = $1 LIMIT 1`, [id]);
    if (!rows[0]) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    return NextResponse.json({ cliente: rows[0] });
  } catch (err) {
    console.error("[admin/clientes/[id]]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}

interface PatchBody {
  empresa?: string;
  responsavel?: string;
  email?: string;
  whatsapp?: string;
  plano?: string;
  valor_mensal?: number;
  valor_setup?: number;
  inicio_contrato?: string;
  fim_contrato?: string | null;
  status?: ClienteStatus;
  progresso?: number;
  modulos?: string;
  notas?: string;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: PatchBody;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { p, params: sqlParams } = construtorSql();
  const sets: string[] = [];

  if (body.empresa)          { sets.push(`empresa = ${p(body.empresa)}`); }
  if (body.responsavel !== undefined) { sets.push(`responsavel = ${p(body.responsavel ?? null)}`); }
  if (body.email !== undefined)       { sets.push(`email = ${p(body.email ?? null)}`); }
  if (body.whatsapp !== undefined)    { sets.push(`whatsapp = ${p(body.whatsapp ?? null)}`); }
  if (body.plano !== undefined)       { sets.push(`plano = ${p(body.plano ?? null)}`); }
  if (body.valor_mensal !== undefined){ sets.push(`valor_mensal = ${p(Number(body.valor_mensal))}`); }
  if (body.valor_setup !== undefined) { sets.push(`valor_setup = ${p(Number(body.valor_setup))}`); }
  if (body.inicio_contrato)  { sets.push(`inicio_contrato = ${p(body.inicio_contrato)}`); }
  if (body.fim_contrato !== undefined){ sets.push(`fim_contrato = ${p(body.fim_contrato ?? null)}`); }
  if (body.status && (CLIENTE_STATUSES as readonly string[]).includes(body.status)) {
    sets.push(`status = ${p(body.status)}`);
  }
  if (body.progresso !== undefined)   { sets.push(`progresso = ${p(Math.min(100, Math.max(0, Number(body.progresso))))}`); }
  if (body.notas !== undefined)       { sets.push(`notas = ${p(body.notas ?? null)}`); }

  if (sets.length === 0) return NextResponse.json({ ok: true });

  try {
    await exec(`UPDATE clientes ${clausulaSet(sets)} WHERE id = ${p(id)}`, sqlParams);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/clientes/[id]]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await exec(`DELETE FROM clientes WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/clientes/[id]]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}
