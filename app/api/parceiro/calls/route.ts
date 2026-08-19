import { NextResponse } from "next/server";
import { exigirParceiro } from "@/lib/groow/parceiro-sessao";
import { garantirTabelasParceiros } from "@/lib/groow/parceiros";
import { exec, query } from "@/lib/groow/db";

export const dynamic = "force-dynamic";

/** Anotações da ligação. A transcrição só chega aqui quando o copiloto estiver ligado. */
export async function POST(req: Request) {
  const auth = await exigirParceiro();
  if (!auth.ok) return auth.resposta;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  await garantirTabelasParceiros();

  const leadIdBruto = Number(body.parceiro_lead_id);
  let leadId: number | null = null;
  if (Number.isInteger(leadIdBruto) && leadIdBruto > 0) {
    // Confere a posse: sem isto, o parceiro amarraria a call ao lead de outro.
    const dono = await query<{ id: number }>(
      `SELECT id FROM parceiro_leads WHERE id = $1 AND parceiro_id = $2 LIMIT 1`,
      [leadIdBruto, auth.parceiro.id]
    );
    if (!dono[0]) return NextResponse.json({ error: "Lead não encontrado." }, { status: 404 });
    leadId = leadIdBruto;
  }

  const r = await exec(
    `INSERT INTO parceiro_calls (parceiro_id, parceiro_lead_id, transcricao, anotacao, duracao_seg)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [
      auth.parceiro.id,
      leadId,
      String(body.transcricao || "").slice(0, 60000) || null,
      String(body.anotacao || "").slice(0, 20000) || null,
      Math.max(0, Math.min(86400, Number(body.duracao_seg) || 0)),
    ]
  );

  // A anotação também vira histórico no lead, que é onde eu vou ler depois.
  const anotacao = String(body.anotacao || "").trim();
  if (leadId && anotacao) {
    await exec(
      // CONCAT() do MySQL vira o operador || no Postgres. E a quebra de linha
      // precisa de string com escape (E'...'), senão o Postgres grava \n literal.
      `UPDATE parceiro_leads
          SET observacao = TRIM(COALESCE(observacao, '') || E'\n' || $1)
        WHERE id = $2 AND parceiro_id = $3`,
      [anotacao.slice(0, 2000), leadId, auth.parceiro.id]
    );
  }

  return NextResponse.json({ ok: true, id: r.insertId });
}
