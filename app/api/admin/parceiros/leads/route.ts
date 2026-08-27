import { NextResponse } from "next/server";
import { moverEtapa, ETAPA_POR_VALOR, type SituacaoLead } from "@/lib/groow/parceiros";

/**
 * Mover o card de um lead de parceiro, do lado do dono.
 *
 * Existe separada de /api/parceiro/leads/etapa porque aquela e escopada pela
 * sessao do parceiro: o dono nao tem parceiro_id nenhum e cairia no 401. Aqui a
 * protecao e o middleware, que so deixa owner_plataforma em /api/admin.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = Number(body.id);
  const parceiroId = Number(body.parceiro_id);
  const situacao = String(body.situacao || "") as SituacaoLead;

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Id inválido." }, { status: 400 });
  }
  if (!Number.isInteger(parceiroId) || parceiroId <= 0) {
    return NextResponse.json({ error: "Parceiro inválido." }, { status: 400 });
  }
  if (!ETAPA_POR_VALOR.has(situacao)) {
    return NextResponse.json({ error: "Etapa desconhecida." }, { status: 400 });
  }

  try {
    const ok = await moverEtapa(id, parceiroId, situacao, 0);
    if (!ok) return NextResponse.json({ error: "Lead não encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/parceiros/leads] mover:", err);
    return NextResponse.json({ error: "Não consegui mover." }, { status: 500 });
  }
}
