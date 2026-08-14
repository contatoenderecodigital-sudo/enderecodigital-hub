// "Chamar IA" no inbox: gera uma sugestão de resposta pra conversa atual e
// devolve o TEXTO, sem enviar nada e sem gravar mensagem. O operador confere,
// edita se quiser e manda pelo composer normal. O cliente nunca percebe a IA.
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/groow/db";
import { gerarRespostaIA } from "@/lib/groow/atendente-ia";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const convId = Number(id);
  if (!Number.isFinite(convId)) return NextResponse.json({ error: "id inválido" }, { status: 400 });

  const rows = await query<{ whatsapp: string }>(
    `SELECT whatsapp FROM wa_conversas WHERE id = ? LIMIT 1`,
    [convId]
  );
  const conversa = rows[0];
  if (!conversa) return NextResponse.json({ error: "conversa não encontrada" }, { status: 404 });

  try {
    const r = await gerarRespostaIA(convId, conversa.whatsapp, "sugestão no inbox");
    if (!r) {
      return NextResponse.json({ error: "A IA não conseguiu sugerir agora. O cliente já mandou alguma mensagem?" }, { status: 422 });
    }
    if (r.handoff) {
      // a IA acha que é melhor você responder pessoalmente: devolve o motivo, sem texto
      return NextResponse.json({ sugestao: "", handoff: r.handoff });
    }
    return NextResponse.json({ sugestao: r.texto });
  } catch (err) {
    console.error("[conversas/sugerir]", err);
    return NextResponse.json({ error: "Erro ao gerar a sugestão." }, { status: 500 });
  }
}
