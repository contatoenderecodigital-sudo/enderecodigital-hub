import { NextResponse } from "next/server";
import { exec } from "@/lib/groow/db";

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
  const vals: (string | number | null)[] = [];
  if (typeof body.titulo === "string") { sets.push("titulo = ?"); vals.push(body.titulo.trim()); }
  if (body.prioridade && ["alta", "media", "baixa"].includes(body.prioridade)) { sets.push("prioridade = ?"); vals.push(body.prioridade); }
  if (body.status === "pendente" || body.status === "concluida") {
    sets.push("status = ?"); vals.push(body.status);
    sets.push("concluida_em = ?"); vals.push(body.status === "concluida" ? new Date().toISOString().slice(0, 19).replace("T", " ") : null);
  }
  if ("lead_id" in body) { sets.push("lead_id = ?"); vals.push(body.lead_id || null); }
  if ("data_vencimento" in body) { sets.push("data_vencimento = ?"); vals.push(body.data_vencimento || null); }
  const hasClienteId = "cliente_id" in body;

  if (sets.length === 0 && !hasClienteId) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
  }

  try {
    // tenta com cliente_id; se a coluna não existir, refaz sem ela
    if (hasClienteId) {
      try {
        await exec(`UPDATE tarefas SET ${[...sets, "cliente_id = ?"].join(", ")} WHERE id = ?`, [...vals, body.cliente_id || null, id]);
        return NextResponse.json({ ok: true });
      } catch { /* coluna cliente_id ausente - cai pro update sem ela */ }
    }
    if (sets.length > 0) {
      await exec(`UPDATE tarefas SET ${sets.join(", ")} WHERE id = ?`, [...vals, id]);
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
    await exec(`DELETE FROM tarefas WHERE id = ?`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/tarefas/[id]]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}
