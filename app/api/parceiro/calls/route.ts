import { NextResponse } from "next/server";
import { exigirParceiro } from "@/lib/groow/parceiro-sessao";
import {
  registrarCall,
  listarCallsDoLead,
  RESULTADOS_CALL,
  type ResultadoCall,
} from "@/lib/groow/parceiros";
import { exec } from "@/lib/groow/db";

export const dynamic = "force-dynamic";

/** Histórico de ligações de um lead, para a aba de dentro do card. */
export async function GET(req: Request) {
  const auth = await exigirParceiro();
  if (!auth.ok) return auth.resposta;

  const leadId = Number(new URL(req.url).searchParams.get("lead"));
  if (!Number.isInteger(leadId) || leadId <= 0) {
    return NextResponse.json({ error: "Informe o lead." }, { status: 400 });
  }

  const calls = await listarCallsDoLead(leadId, auth.parceiro.id);
  return NextResponse.json({ calls });
}

/**
 * Encerra uma tentativa de ligação. Cria a linha em parceiro_calls, empurra o
 * lead para a etapa do desfecho e conta a tentativa. O áudio sobe depois, em
 * /api/parceiro/calls/[id]/audio, porque o arquivo só fecha quando a gravação
 * para e não dá para mandar tudo num POST de JSON.
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

  const leadId = Number(body.parceiro_lead_id);
  if (!Number.isInteger(leadId) || leadId <= 0) {
    return NextResponse.json(
      { error: "A ligação precisa estar amarrada a um lead." },
      { status: 400 }
    );
  }

  const resultado = String(body.resultado || "atendeu") as ResultadoCall;
  if (!RESULTADOS_CALL.some((r) => r.valor === resultado)) {
    return NextResponse.json({ error: "Resultado desconhecido." }, { status: 400 });
  }

  try {
    const id = await registrarCall(auth.parceiro.id, {
      parceiro_lead_id: leadId,
      resultado,
      duracao_seg: Number(body.duracao_seg) || 0,
      anotacao: String(body.anotacao || "") || null,
    });

    // A anotação também vira histórico no cadastro do lead, que é onde eu leio
    // depois sem precisar abrir ligação por ligação.
    const anotacao = String(body.anotacao || "").trim();
    if (anotacao) {
      await exec(
        `UPDATE parceiro_leads
            SET observacao = TRIM(COALESCE(observacao, '') || E'\n' || $1)
          WHERE id = $2 AND parceiro_id = $3`,
        [anotacao.slice(0, 2000), leadId, auth.parceiro.id]
      );
    }

    return NextResponse.json({ ok: true, id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Não consegui registrar.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
