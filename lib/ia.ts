import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Negocio } from "./types";
import { DEFAULT_MODELO, provedorDoModelo, type ProvedorIA } from "./precos-ia";

export function iaDisponivel(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

// Tudo o que a tela de Consumo de Tokens precisa saber sobre UMA chamada.
// tokensIn NÃO inclui os tokens de cache — a Anthropic devolve as três faixas
// separadas (input_tokens, cache_creation_input_tokens, cache_read_input_tokens)
// e cada uma tem preço diferente, então elas viajam separadas até o banco.
export interface RespostaIA {
  texto: string;
  provedor: ProvedorIA;
  model: string;
  tokensIn: number;
  tokensOut: number;
  cacheWrite: number;
  cacheRead: number;
  latenciaMs: number;
  reqId: string | null;
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
  const model = negocio.ia_modelo_chat || DEFAULT_MODELO;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const t0 = Date.now();
  const msg = await client.messages.create({
    model,
    max_tokens: 1024,
    // O system é a parte estável do prompt (identidade + base de conhecimento):
    // é o pedaço que vale cachear. Cache de leitura custa 0,10x a entrada normal,
    // então a mesma base respondendo o dia inteiro fica ~10x mais barata.
    system: [
      {
        type: "text" as const,
        text: montarSystem(negocio, cerebroConteudo),
        cache_control: { type: "ephemeral" as const },
      },
    ],
    messages: mensagens,
  });
  const latenciaMs = Date.now() - t0;
  const texto = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
  return {
    texto,
    provedor: provedorDoModelo(model),
    model,
    tokensIn: msg.usage?.input_tokens || 0,
    tokensOut: msg.usage?.output_tokens || 0,
    cacheWrite: msg.usage?.cache_creation_input_tokens || 0,
    cacheRead: msg.usage?.cache_read_input_tokens || 0,
    latenciaMs,
    reqId: msg._request_id ?? null,
  };
}
