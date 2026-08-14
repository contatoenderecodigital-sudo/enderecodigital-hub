import { NextResponse } from "next/server";
import { query, exec } from "@/lib/groow/db";
import { CLIENTE_STATUSES, type Cliente, type ClienteStatus } from "@/lib/groow/types";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const rows = await query<Cliente>(`SELECT * FROM clientes WHERE id = ? LIMIT 1`, [id]);
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

  const sets: string[] = [];
  const vals: (string | number | null)[] = [];

  if (body.empresa)          { sets.push("empresa = ?");          vals.push(body.empresa); }
  if (body.responsavel !== undefined) { sets.push("responsavel = ?"); vals.push(body.responsavel ?? null); }
  if (body.email !== undefined)       { sets.push("email = ?");       vals.push(body.email ?? null); }
  if (body.whatsapp !== undefined)    { sets.push("whatsapp = ?");    vals.push(body.whatsapp ?? null); }
  if (body.plano !== undefined)       { sets.push("plano = ?");       vals.push(body.plano ?? null); }
  if (body.valor_mensal !== undefined){ sets.push("valor_mensal = ?");vals.push(Number(body.valor_mensal)); }
  if (body.valor_setup !== undefined) { sets.push("valor_setup = ?"); vals.push(Number(body.valor_setup)); }
  if (body.inicio_contrato)  { sets.push("inicio_contrato = ?");  vals.push(body.inicio_contrato); }
  if (body.fim_contrato !== undefined){ sets.push("fim_contrato = ?");vals.push(body.fim_contrato ?? null); }
  if (body.status && (CLIENTE_STATUSES as readonly string[]).includes(body.status)) {
    sets.push("status = ?"); vals.push(body.status);
  }
  if (body.progresso !== undefined)   { sets.push("progresso = ?");   vals.push(Math.min(100, Math.max(0, Number(body.progresso)))); }
  if (body.notas !== undefined)       { sets.push("notas = ?");       vals.push(body.notas ?? null); }

  if (sets.length === 0) return NextResponse.json({ ok: true });

  try {
    await exec(`UPDATE clientes SET ${sets.join(", ")} WHERE id = ?`, [...vals, id]);
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
    await exec(`DELETE FROM clientes WHERE id = ?`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/clientes/[id]]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}
