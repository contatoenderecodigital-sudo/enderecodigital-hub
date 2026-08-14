import { NextResponse } from "next/server";
import { query } from "@/lib/groow/db";
import { LEAD_STATUSES, type Lead, type FollowUp, type LeadStatus } from "@/lib/groow/types";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  try {
    const leads = await query<Lead>(
      `SELECT * FROM leads WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!leads[0]) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

    const follow_ups = await query<FollowUp>(
      `SELECT * FROM follow_ups WHERE lead_id = ? ORDER BY created_at DESC`,
      [id]
    );

    return NextResponse.json({ lead: leads[0], follow_ups });
  } catch (err) {
    console.error("[admin/leads/[id]]", err);
    return NextResponse.json(
      { error: "Erro ao processar a requisição." },
      { status: 500 }
    );
  }
}

interface PatchBody {
  status?: LeadStatus;
  notas?: string;
  origem?: string;
  fonte_trafego?: string | null;
  setor?: string;
  faturamento?: string;
  ultimo_contato_em?: string;
  followUp?: { tipo: FollowUp["tipo"]; descricao: string; resultado?: string };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  let body: PatchBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  try {
    if (body.status && (LEAD_STATUSES as readonly string[]).includes(body.status)) {
      await query(
        `UPDATE leads SET status = ?, ultimo_contato_em = NOW() WHERE id = ?`,
        [body.status, id]
      );
    }
    if (typeof body.notas === "string") {
      await query(`UPDATE leads SET notas = ? WHERE id = ?`, [body.notas, id]);
    }
    if (typeof body.origem === "string") {
      await query(`UPDATE leads SET origem = ? WHERE id = ?`, [body.origem, id]);
    }
    if (body.fonte_trafego !== undefined) {
      await query(`UPDATE leads SET fonte_trafego = ? WHERE id = ?`, [body.fonte_trafego || null, id]);
    }
    if (typeof body.setor === "string") {
      await query(`UPDATE leads SET setor = ? WHERE id = ?`, [body.setor, id]);
    }
    if (typeof body.faturamento === "string") {
      await query(`UPDATE leads SET faturamento = ? WHERE id = ?`, [body.faturamento, id]);
    }
    if (typeof body.ultimo_contato_em === "string") {
      await query(`UPDATE leads SET ultimo_contato_em = NOW() WHERE id = ?`, [id]);
    }
    if (body.followUp && body.followUp.descricao) {
      await query(
        `INSERT INTO follow_ups (lead_id, tipo, descricao, resultado)
         VALUES (?, ?, ?, ?)`,
        [
          id,
          body.followUp.tipo,
          body.followUp.descricao,
          body.followUp.resultado || null,
        ]
      );
      await query(`UPDATE leads SET ultimo_contato_em = NOW() WHERE id = ?`, [id]);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/leads/[id]]", err);
    return NextResponse.json(
      { error: "Erro ao processar a requisição." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  try {
    await query(`DELETE FROM follow_ups WHERE lead_id = ?`, [id]);
    await query(`DELETE FROM leads WHERE id = ?`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/leads/[id]]", err);
    return NextResponse.json(
      { error: "Erro ao processar a requisição." },
      { status: 500 }
    );
  }
}
