import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSession } from "@/lib/auth";
import { activeNegocioId } from "@/lib/tenant";
import { getNegocio, getCerebro, registrarUso } from "@/lib/data";

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
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      resposta:
        "A IA ainda não foi ativada: falta cadastrar a chave da Anthropic (ANTHROPIC_API_KEY) na plataforma.",
    });
  }

  const body = (await req.json().catch(() => ({}))) as { messages?: unknown };
  const brutos = Array.isArray(body.messages) ? (body.messages as MsgIn[]) : [];
  const msgs = brutos
    .filter(
      (m) => (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string"
    )
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))
    .slice(-12);
  if (!msgs.length) return NextResponse.json({ erro: "sem_mensagem" }, { status: 400 });

  const cerebro = await getCerebro(neg);
  const system = [
    `Voce e o atendente virtual da empresa "${negocio.nome_fantasia || negocio.nome}".`,
    "Responda em portugues do Brasil, de forma cordial, direta e natural.",
    "Nunca use emojis. Nunca invente precos, horarios ou informacoes fora da base abaixo.",
    "Se nao souber, ofereca encaminhar para um atendente humano.",
    cerebro?.conteudo
      ? `\n--- BASE DE CONHECIMENTO ---\n${cerebro.conteudo}`
      : "\n(Ainda nao ha base de conhecimento cadastrada.)",
  ].join("\n");

  const model = negocio.ia_modelo_chat || "claude-haiku-4-5";
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const msg = await client.messages.create({
      model,
      max_tokens: 1024,
      system,
      messages: msgs,
    });
    const texto = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    registrarUso(
      neg,
      "chat",
      model,
      msg.usage?.input_tokens || 0,
      msg.usage?.output_tokens || 0
    ).catch(() => {});
    return NextResponse.json({ resposta: texto || "(sem resposta)" });
  } catch (e) {
    return NextResponse.json({
      resposta: "Nao consegui responder agora. Verifique a chave e o modelo da IA nas configuracoes.",
      detalhe: String(e).slice(0, 200),
    });
  }
}
