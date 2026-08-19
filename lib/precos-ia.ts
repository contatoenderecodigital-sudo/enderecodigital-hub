// Catálogo de provedores/modelos de IA + tabela de preços de LISTA.
//
// COMO LER ESTE ARQUIVO
// --------------------
// `inUsd` / `outUsd` = preço de LISTA do provedor, em US$ por 1.000.000 (1M) de
// tokens. São os valores publicados pelo provedor, não o que caiu na fatura.
//
// O custo que a tela mostra como "calculado" sai daqui:
//     custo = (tokens / 1M) x preço do modelo x câmbio
// e é gravado em uso_ia.custo_cent_calc NO MOMENTO DA CHAMADA, junto com os
// preços e o câmbio usados (uso_ia.preco_in_usd / preco_out_usd / usd_brl).
// Isso é de propósito: se a tabela abaixo mudar amanhã, o histórico não muda —
// cada linha guarda o preço vigente quando a chamada aconteceu.
//
// O custo FATURADO (uso_ia.custo_cent) é outra coisa: vem do faturamento do
// provedor (Anthropic Admin API / cost_report). Enquanto esse pipeline não
// estiver ligado ele fica em 0 e a tela diz isso explicitamente, em vez de
// fingir que o calculado é o real.
//
// CACHE
// -----
// A Anthropic cobra os tokens de cache em faixas diferentes do input normal:
//   - escrita de cache (cache_creation_input_tokens): 1,25x o preço de entrada
//   - leitura de cache (cache_read_input_tokens):     0,10x o preço de entrada
// `usage.input_tokens` já vem SEM os tokens de cache, então os três somados é
// que dão o tamanho real do prompt.

export type ProvedorIA = "openai" | "gemini" | "claude";

export interface ModeloIA {
  id: string; // id técnico usado na chamada e gravado em uso_ia.modelo
  nome: string; // rótulo curto na UI
  provedor: ProvedorIA;
  inUsd: number; // US$ por 1M tokens de entrada (preço de lista)
  outUsd: number; // US$ por 1M tokens de saída  (preço de lista)
  contexto?: number; // janela de contexto em tokens
  maxOut?: number; // teto de saída por resposta
  nota?: string;
}

// Multiplicadores de cache sobre o preço de ENTRADA do modelo, por provedor.
// Anthropic: escrita 1,25x (TTL 5min) e leitura 0,10x — documentados na API.
// OpenAI e Gemini entram com os multiplicadores públicos deles; ajustar quando
// esses provedores forem realmente ligados (hoje só a Anthropic roda no hub).
export const CACHE_MULT: Record<ProvedorIA, { escrita: number; leitura: number }> = {
  claude: { escrita: 1.25, leitura: 0.1 },
  openai: { escrita: 1.0, leitura: 0.5 },
  gemini: { escrita: 1.0, leitura: 0.25 },
};

// Preços de lista conferidos em 16/08/2026.
export const MODELOS_IA: ModeloIA[] = [
  // ---- Anthropic (Claude) — é o provedor que o hub usa hoje ----
  { id: "claude-haiku-4-5", nome: "Claude Haiku 4.5", provedor: "claude", inUsd: 1, outUsd: 5, contexto: 200_000, maxOut: 64_000, nota: "rápido e barato · default do atendimento" },
  { id: "claude-sonnet-5", nome: "Claude Sonnet 5", provedor: "claude", inUsd: 3, outUsd: 15, contexto: 1_000_000, maxOut: 128_000, nota: "equilíbrio · alto volume" },
  { id: "claude-opus-5", nome: "Claude Opus 5", provedor: "claude", inUsd: 5, outUsd: 25, contexto: 1_000_000, maxOut: 128_000, nota: "topo · tarefas difíceis" },
  { id: "claude-opus-4-8", nome: "Claude Opus 4.8", provedor: "claude", inUsd: 5, outUsd: 25, contexto: 1_000_000, maxOut: 128_000 },
  { id: "claude-sonnet-4-6", nome: "Claude Sonnet 4.6", provedor: "claude", inUsd: 3, outUsd: 15, contexto: 1_000_000, maxOut: 128_000 },
  // ---- OpenAI (não ligado — tabela pronta pra quando for) ----
  { id: "gpt-4o-mini", nome: "GPT-4o mini", provedor: "openai", inUsd: 0.15, outUsd: 0.6, contexto: 128_000 },
  { id: "gpt-4.1-mini", nome: "GPT-4.1 mini", provedor: "openai", inUsd: 0.4, outUsd: 1.6, contexto: 1_000_000 },
  { id: "gpt-4o", nome: "GPT-4o", provedor: "openai", inUsd: 2.5, outUsd: 10, contexto: 128_000 },
  // ---- Gemini (não ligado) ----
  { id: "gemini-2.5-flash", nome: "Gemini 2.5 Flash", provedor: "gemini", inUsd: 0.3, outUsd: 2.5, contexto: 1_000_000 },
  { id: "gemini-2.5-pro", nome: "Gemini 2.5 Pro", provedor: "gemini", inUsd: 1.25, outUsd: 10, contexto: 1_000_000 },
];

// Câmbio usado para converter o preço de lista (US$) em R$.
// É uma TAXA, não um extrato: quem define o custo em reais de verdade é a
// fatura do cartão. Sobrescreva com a env USD_BRL quando o câmbio andar.
export const USD_BRL = Number(process.env.USD_BRL) > 0 ? Number(process.env.USD_BRL) : 5.4;

export const PROVEDORES: { id: ProvedorIA; nome: string }[] = [
  { id: "openai", nome: "OpenAI" },
  { id: "gemini", nome: "Gemini" },
  { id: "claude", nome: "Claude" },
];

// Nome da EMPRESA por trás do modelo (o que aparece na coluna "empresa de IA").
export const EMPRESA_PROVEDOR: Record<ProvedorIA, string> = {
  claude: "Anthropic",
  openai: "OpenAI",
  gemini: "Google",
};

export const DEFAULT_PROVEDOR: ProvedorIA = "claude";
export const DEFAULT_MODELO = "claude-haiku-4-5";

// Cor de cada provedor (usa a paleta ed2 — sem cor nova).
export const COR_PROVEDOR: Record<ProvedorIA, string> = {
  openai: "#34C759", // ed2-green
  gemini: "#0A84FF", // ed2-blue
  claude: "#C9A961", // ed2-gold
};

export function modelosDoProvedor(p: ProvedorIA): ModeloIA[] {
  return MODELOS_IA.filter((m) => m.provedor === p);
}

export function acharModelo(id: string | null | undefined): ModeloIA | null {
  if (!id) return null;
  return MODELOS_IA.find((m) => m.id === id) ?? null;
}

// Infere o provedor a partir do id do modelo (útil p/ dados antigos de uso_ia).
export function provedorDoModelo(id: string): ProvedorIA {
  const m = acharModelo(id);
  if (m) return m.provedor;
  const s = (id || "").toLowerCase();
  if (s.startsWith("claude")) return "claude";
  if (s.startsWith("gemini")) return "gemini";
  if (s.startsWith("gpt") || s.startsWith("o1") || s.startsWith("o3")) return "openai";
  return DEFAULT_PROVEDOR;
}

export function nomeProvedor(p: ProvedorIA): string {
  return PROVEDORES.find((x) => x.id === p)?.nome ?? p;
}

export function nomeEmpresa(p: ProvedorIA): string {
  return EMPRESA_PROVEDOR[p] ?? p;
}

// Preço de lista do modelo, com fallback conservador p/ modelo desconhecido.
export function precoDoModelo(modeloId: string): { inUsd: number; outUsd: number; conhecido: boolean } {
  const m = acharModelo(modeloId);
  if (m) return { inUsd: m.inUsd, outUsd: m.outUsd, conhecido: true };
  // modelo fora do catálogo: usa o teto da linha Claude pra não subestimar
  return { inUsd: 5, outUsd: 25, conhecido: false };
}

export interface TokensChamada {
  tokens_in: number; // entrada NÃO cacheada (usage.input_tokens)
  tokens_out: number; // saída (usage.output_tokens)
  cache_write?: number; // usage.cache_creation_input_tokens
  cache_read?: number; // usage.cache_read_input_tokens
}

// Custo em REAIS (float), com as quatro faixas de token cobradas separadamente.
//
// Trabalhamos em reais e não em centavos inteiros de propósito: uma conversa de
// atendimento no Haiku custa fração de centavo, e arredondar cada chamada pra
// centavo transformaria o extrato inteiro em R$ 0,00. O banco guarda
// NUMERIC(14,6) — seis casas — e o arredondamento só acontece na hora de exibir.
//
// `precos` permite recalcular com o preço HISTÓRICO gravado na linha do uso_ia
// em vez do preço de hoje (é assim que a tela não reescreve o passado).
export function custoBRL(
  modeloId: string,
  t: TokensChamada,
  precos?: { inUsd: number; outUsd: number; usdBrl: number }
): number {
  const p = precos ?? { ...precoDoModelo(modeloId), usdBrl: USD_BRL };
  const mult = CACHE_MULT[provedorDoModelo(modeloId)];
  const usd =
    (t.tokens_in / 1e6) * p.inUsd +
    ((t.cache_write || 0) / 1e6) * p.inUsd * mult.escrita +
    ((t.cache_read || 0) / 1e6) * p.inUsd * mult.leitura +
    (t.tokens_out / 1e6) * p.outUsd;
  return usd * p.usdBrl;
}

// Quanto a leitura de cache economizou: a diferença entre pagar aqueles tokens
// como entrada normal e pagá-los na faixa de cache.
export function economiaCacheBRL(
  modeloId: string,
  cacheRead: number,
  precos?: { inUsd: number; usdBrl: number }
): number {
  if (!cacheRead) return 0;
  const p = precos ?? { inUsd: precoDoModelo(modeloId).inUsd, usdBrl: USD_BRL };
  const mult = CACHE_MULT[provedorDoModelo(modeloId)];
  return ((cacheRead / 1e6) * p.inUsd * (1 - mult.leitura)) * p.usdBrl;
}

// Compat: assinaturas antigas usadas pelo console /operacao/hub/tokens e pelo
// card de workspace, que trabalham em centavos inteiros.
export function custoCentBRL(
  modeloId: string,
  t: TokensChamada,
  precos?: { inUsd: number; outUsd: number; usdBrl: number }
): number {
  return Math.round(custoBRL(modeloId, t, precos) * 100);
}
export function estimarCustoCentBRL(modeloId: string, tokensIn: number, tokensOut: number): number {
  return custoCentBRL(modeloId, { tokens_in: tokensIn, tokens_out: tokensOut });
}
