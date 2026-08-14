// Lista as respostas do cardápio pro painel. Marca como lida no GET.
import { NextResponse } from "next/server";
import { query, exec } from "@/lib/groow/db";

export const dynamic = "force-dynamic";

async function tabelaExiste(): Promise<boolean> {
  try {
    const r = await query<{ n: number }>(
      `SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'cardapio_respostas'`
    );
    return Number(r[0]?.n ?? 0) > 0;
  } catch { return false; }
}

export async function GET() {
  try {
    if (!(await tabelaExiste())) return NextResponse.json({ respostas: [] });
    const respostas = await query(
      `SELECT id, cliente, slug, total_itens, selecionados, observacoes, lida,
              DATE_FORMAT(created_at, '%d/%m/%Y %H:%i') AS quando
       FROM cardapio_respostas ORDER BY id DESC LIMIT 200`
    );
    // marca as não lidas como lidas (o operador está vendo agora)
    await exec(`UPDATE cardapio_respostas SET lida = 1 WHERE lida = 0`).catch(() => {});
    return NextResponse.json({ respostas });
  } catch (err) {
    console.error("[admin/cardapios]", err);
    return NextResponse.json({ respostas: [], error: "Erro ao carregar." });
  }
}
