// Painel "Dados do contato" da conversa: cruza o número com Leads e Clientes e
// devolve o que a Endereço Digital já sabe daquela pessoa. A foto/cartão do
// WhatsApp a API oficial da Meta não entrega; aqui a riqueza vem do NOSSO CRM.
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/groow/db";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const convId = Number(id);
  if (!Number.isFinite(convId)) return NextResponse.json({ error: "id inválido" }, { status: 400 });

  try {
    const conv = await query<{ whatsapp: string; nome: string | null; status: string; ultima_mensagem_em: string | null; created_at: string }>(
      `SELECT whatsapp, nome, status, ultima_mensagem_em, created_at FROM wa_conversas WHERE id = ? LIMIT 1`,
      [convId]
    );
    const c = conv[0];
    if (!c) return NextResponse.json({ error: "conversa não encontrada" }, { status: 404 });

    const nucleo = c.whatsapp.replace(/\D/g, "").slice(-8);
    const limpa = (col: string) =>
      `REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(${col},''),'+',''),'-',''),' ',''),'(','')`;

    const lead = await query<{ id: number; nome: string | null; empresa: string | null; setor: string | null; cidade: string | null; email: string | null; status: string | null; origem: string | null; notas: string | null }>(
      `SELECT id, nome, empresa, setor, cidade, email, status, origem, notas FROM leads
       WHERE ${limpa("whatsapp")} LIKE ? OR ${limpa("telefone")} LIKE ?
       ORDER BY id DESC LIMIT 1`,
      [`%${nucleo}%`, `%${nucleo}%`]
    );

    const cliente = await query<{ id: number; empresa: string | null; responsavel: string | null; email: string | null; plano: string | null; status: string | null }>(
      `SELECT id, empresa, responsavel, email, plano, status FROM clientes
       WHERE ${limpa("whatsapp")} LIKE ? ORDER BY id DESC LIMIT 1`,
      [`%${nucleo}%`]
    );

    return NextResponse.json({
      whatsapp: c.whatsapp,
      nomePerfil: c.nome,          // profile.name que veio da Meta
      statusConversa: c.status,
      primeiroContato: c.created_at,
      lead: lead[0] ?? null,
      cliente: cliente[0] ?? null,
    });
  } catch (err) {
    console.error("[conversas/contato]", err);
    return NextResponse.json({ error: "Erro ao buscar o contato." }, { status: 500 });
  }
}
