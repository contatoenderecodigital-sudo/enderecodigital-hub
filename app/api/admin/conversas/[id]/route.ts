// Thread de uma conversa: GET mensagens · POST responder (humano) · PATCH status (IA/humano/fechada).
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/groow/db";
import { sendWhatsAppText } from "@/lib/groow/whatsapp";

export const dynamic = "force-dynamic";

async function getConversa(id: number) {
  const rows = await query<{ id: number; whatsapp: string; status: string }>(
    `SELECT id, whatsapp, status FROM wa_conversas WHERE id = $1 LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const convId = Number(id);
  if (!Number.isFinite(convId)) return NextResponse.json({ error: "id inválido" }, { status: 400 });
  try {
    const mensagens = await query(
      `SELECT id, origem, tipo, texto, status_entrega, created_at
       FROM wa_mensagens WHERE conversa_id = $1
       ORDER BY created_at ASC, id ASC
       LIMIT 500`,
      [convId]
    );
    await query(`UPDATE wa_conversas SET nao_lidas = 0 WHERE id = $1`, [convId]);
    return NextResponse.json({ mensagens });
  } catch (err) {
    console.error("[admin/conversas/[id]]", err);
    return NextResponse.json({ mensagens: [], error: "Erro ao processar a requisição." });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const convId = Number(id);
  const body = (await req.json().catch(() => ({}))) as { texto?: string };
  const texto = (body.texto ?? "").trim();
  if (!Number.isFinite(convId) || !texto) {
    return NextResponse.json({ error: "texto obrigatório" }, { status: 400 });
  }
  const conversa = await getConversa(convId);
  if (!conversa) return NextResponse.json({ error: "conversa não encontrada" }, { status: 404 });

  try {
    const { wamid } = await sendWhatsAppText(conversa.whatsapp, texto);
    await query(
      `INSERT INTO wa_mensagens (conversa_id, origem, tipo, texto, wamid, status_entrega)
       VALUES ($1, 'humano', 'text', $2, $3, 'sent')`,
      [convId, texto, wamid]
    );
    await query(
      `UPDATE wa_conversas SET ultima_mensagem = $1, ultima_mensagem_em = NOW() WHERE id = $2`,
      [texto, convId]
    );
    return NextResponse.json({ ok: true, wamid });
  } catch (err) {
    console.error("[admin/conversas/[id]]", err);
    const msg = "Não foi possível enviar a mensagem.";
    const fora24h = msg.startsWith("FORA_DA_JANELA_24H");
    return NextResponse.json(
      { error: fora24h ? "Fora da janela de 24h: o contato precisa te chamar primeiro, ou use um template aprovado." : msg },
      { status: 422 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const convId = Number(id);
  const body = (await req.json().catch(() => ({}))) as { status?: string };
  const status = body.status;
  if (!Number.isFinite(convId) || !status || !["ai_active", "handed_off", "closed"].includes(status)) {
    return NextResponse.json({ error: "status inválido" }, { status: 400 });
  }
  await query(
    `UPDATE wa_conversas SET status = $1, handoff_em = ${status === "handed_off" ? "NOW()" : "handoff_em"} WHERE id = $2`,
    [status, convId]
  );
  return NextResponse.json({ ok: true });
}
