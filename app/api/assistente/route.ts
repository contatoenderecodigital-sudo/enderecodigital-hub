import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { activeNegocioId } from "@/lib/tenant";
import { getNegocio, getCerebro, registrarUso } from "@/lib/data";
import { iaDisponivel, gerarResposta } from "@/lib/ia";

interface MsgIn {
  role: "user" | "assistant";
  content: string;
}

// Assistente de IA por tenant. Motor: API Anthropic (custo medido por negocio_id).
// Contexto: a base de conhecimento (cerebro) DAQUELE tenant — isolamento total.
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ erro: "nao_autenticado" }, { status: 401 });

  const neg = activeNegocioId(s);
  if (!neg) return NextResponse.json({ erro: "sem_tenant" }, { status: 400 });

  const negocio = await getNegocio(neg);
  if (!negocio) return NextResponse.json({ erro: "sem_tenant" }, { status: 400 });

  if (!negocio.ia_habilitada) {
    return NextResponse.json({ resposta: "A IA deste cliente está desligada nas configurações." });
  }
  if (!iaDisponivel()) {
    return NextResponse.json({
      resposta:
        "A IA ainda não foi ativada: falta cadastrar a chave da Anthropic (ANTHROPIC_API_KEY) na plataforma.",
    });
  }

  const body = (await req.json().catch(() => ({}))) as { messages?: unknown };
  const brutos = Array.isArray(body.messages) ? (body.messages as MsgIn[]) : [];
  const msgs = brutos
    .filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))
    .slice(-12);
  if (!msgs.length) return NextResponse.json({ erro: "sem_mensagem" }, { status: 400 });

  const cerebro = await getCerebro(neg);
  try {
    const r = await gerarResposta(negocio, cerebro?.conteudo, msgs);
    registrarUso(neg, "chat", r.model, r.tokensIn, r.tokensOut).catch(() => {});
    return NextResponse.json({ resposta: r.texto || "(sem resposta)" });
  } catch (e) {
    return NextResponse.json({
      resposta: "Nao consegui responder agora. Verifique a chave e o modelo da IA nas configuracoes.",
      detalhe: String(e).slice(0, 200),
    });
  }
}
