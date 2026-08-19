// Lista de conversas do WhatsApp pro inbox do admin.
import { NextResponse } from "next/server";
import { query } from "@/lib/groow/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const conversas = await query(
      `SELECT id, canal, whatsapp, nome, status, nao_lidas, ultima_mensagem, ultima_mensagem_em
       FROM wa_conversas
       ORDER BY ultima_mensagem_em DESC
       LIMIT 200`
    );
    return NextResponse.json({ conversas });
  } catch (err) {
    console.error("[admin/conversas]", err);
    return NextResponse.json(
      { conversas: [], error: "Erro ao processar a requisição." },
      { status: 200 } // painel mostra estado vazio com aviso, sem quebrar
    );
  }
}
