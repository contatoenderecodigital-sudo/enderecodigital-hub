import { NextResponse } from "next/server";
import { exigirParceiro } from "@/lib/groow/parceiro-sessao";
import {
  moverEtapa,
  agendarRetorno,
  ETAPA_POR_VALOR,
  type SituacaoLead,
} from "@/lib/groow/parceiros";

export const dynamic = "force-dynamic";

/**
 * Arrastar o card de coluna no kanban, e agendar o retorno.
 *
 * Rota separada do PATCH de /leads de propósito: aquele exige prova de opt-in e
 * reescreve o cadastro inteiro, o que travaria um arraste simples.
 */
export async function POST(req: Request) {
  const auth = await exigirParceiro();
  if (!auth.ok) return auth.resposta;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Id inválido." }, { status: 400 });
  }

  // Agendamento de retorno vem pela mesma rota porque é sempre a mesma ação do
  // ponto de vista de quem usa: "esse aqui eu vejo depois".
  if ("proximo_retorno" in body) {
    const bruto = body.proximo_retorno;
    let quando: string | null = null;
    if (bruto) {
      const d = new Date(String(bruto));
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "Data de retorno inválida." }, { status: 400 });
      }
      quando = d.toISOString();
    }
    const ok = await agendarRetorno(id, auth.parceiro.id, quando);
    if (!ok) return NextResponse.json({ error: "Lead não encontrado." }, { status: 404 });
    if (!body.situacao) return NextResponse.json({ ok: true });
  }

  const situacao = String(body.situacao || "") as SituacaoLead;
  if (!ETAPA_POR_VALOR.has(situacao)) {
    return NextResponse.json({ error: "Etapa desconhecida." }, { status: 400 });
  }

  const ordem = Number.isInteger(Number(body.ordem)) ? Number(body.ordem) : 0;
  const ok = await moverEtapa(id, auth.parceiro.id, situacao, ordem);
  if (!ok) return NextResponse.json({ error: "Lead não encontrado." }, { status: 404 });

  return NextResponse.json({ ok: true });
}
