import { NextResponse } from "next/server";
import { exec } from "@/lib/groow/db";
import { construtorSql, clausulaSet } from "@/lib/groow/sql";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: { status?: "pendente" | "concluida"; titulo?: string; prioridade?: string; lead_id?: number | null; cliente_id?: number | null; data_vencimento?: string | null };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  // Monta UPDATE parcial só com os campos enviados
  const sets: string[] = [];
  const { p, params: sqlParams } = construtorSql();
  if (typeof body.titulo === "string") { sets.push(`titulo = ${p(body.titulo.trim())}`); }
  if (body.prioridade && ["alta", "media", "baixa"].includes(body.prioridade)) { sets.push(`prioridade = ${p(body.prioridade)}`); }
  if (body.status === "pendente" || body.status === "concluida") {
    sets.push(`status = ${p(body.status)}`);
    sets.push(`concluida_em = ${p(body.status === "concluida" ? new Date().toISOString().slice(0, 19).replace("T", " ") : null)}`);
  }
  if ("lead_id" in body) { sets.push(`lead_id = ${p(body.lead_id || null)}`); }
  if ("data_vencimento" in body) { sets.push(`data_vencimento = ${p(body.data_vencimento || null)}`); }
  const hasClienteId = "cliente_id" in body;

  if (sets.length === 0 && !hasClienteId) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
  }

  try {
    // tenta com cliente_id; se a coluna não existir, refaz sem ela
    if (hasClienteId) {
      try {
        await exec(`UPDATE tarefas ${clausulaSet([...sets, `cliente_id = ${p(body.cliente_id || null)}`])} WHERE id = ${p(id)}`, sqlParams);
        return NextResponse.json({ ok: true });
      } catch { /* coluna cliente_id ausente - cai pro update sem ela */ }
    }
    if (sets.length > 0) {
      await exec(`UPDATE tarefas ${clausulaSet(sets)} WHERE id = ${p(id)}`, sqlParams);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/tarefas/[id]]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await exec(`DELETE FROM tarefas WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/tarefas/[id]]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}
