import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Negocio } from "./types";

export function iaDisponivel(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export interface RespostaIA {
  texto: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
}

export function montarSystem(negocio: Negocio, cerebroConteudo: string | null | undefined): string {
  return [
    `Voce e o atendente virtual da empresa "${negocio.nome_fantasia || negocio.nome}".`,
    "Responda em portugues do Brasil, de forma cordial, direta e natural.",
    "Nunca use emojis. Nunca invente precos, horarios ou informacoes fora da base abaixo.",
    "Seja breve. Se nao souber, ofereca encaminhar para um atendente humano.",
    cerebroConteudo
      ? `\n--- BASE DE CONHECIMENTO ---\n${cerebroConteudo}`
      : "\n(Ainda nao ha base de conhecimento cadastrada.)",
  ].join("\n");
}

// Gera a resposta da IA para um tenant. Assume ANTHROPIC_API_KEY presente.
export async function gerarResposta(
  negocio: Negocio,
  cerebroConteudo: string | null | undefined,
  mensagens: { role: "user" | "assistant"; content: string }[]
): Promise<RespostaIA> {
  const model = negocio.ia_modelo_chat || "claude-haiku-4-5";
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model,
    max_tokens: 1024,
    system: montarSystem(negocio, cerebroConteudo),
    messages: mensagens,
  });
  const texto = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
  return {
    texto,
    model,
    tokensIn: msg.usage?.input_tokens || 0,
    tokensOut: msg.usage?.output_tokens || 0,
  };
}
