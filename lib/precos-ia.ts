// Catálogo de provedores/modelos de IA + tabela de preços APROXIMADA.
//
// Os preços abaixo são por 1.000.000 (1M) de tokens, em US$. São APROXIMADOS e
// servem só para ESTIMATIVA de planejamento na tela de Tokens & IA.
// AJUSTAR conforme o faturamento real de cada provedor — o custo REAL de cada
// chamada continua vindo de uso_ia.custo_cent (fonte: faturamento), nunca desta tabela.
//
// Multi-provedor de verdade: OpenAI (default barato / alto volume), Gemini (fallback)
// e Claude (premium). Cada cliente pode rodar num provedor+modelo diferente.

export type ProvedorIA = "openai" | "gemini" | "claude";

export interface ModeloIA {
  id: string; // id técnico usado na chamada e gravado em uso_ia.modelo
  nome: string; // rótulo curto na UI
  provedor: ProvedorIA;
  inUsd: number; // US$ por 1M tokens de entrada  (AJUSTAR)
  outUsd: number; // US$ por 1M tokens de saída    (AJUSTAR)
  nota?: string;
}

// valores aproximados (jan/2026) — AJUSTAR
export const MODELOS_IA: ModeloIA[] = [
  // OpenAI
  { id: "gpt-4o-mini", nome: "GPT-4o mini", provedor: "openai", inUsd: 0.15, outUsd: 0.6, nota: "default · barato · alto volume" },
  { id: "gpt-4.1-mini", nome: "GPT-4.1 mini", provedor: "openai", inUsd: 0.4, outUsd: 1.6 },
  { id: "gpt-4o", nome: "GPT-4o", provedor: "openai", inUsd: 2.5, outUsd: 10 },
  // Gemini
  { id: "gemini-2.5-flash", nome: "Gemini 2.5 Flash", provedor: "gemini", inUsd: 0.3, outUsd: 2.5, nota: "fallback" },
  { id: "gemini-2.5-pro", nome: "Gemini 2.5 Pro", provedor: "gemini", inUsd: 1.25, outUsd: 10 },
  // Claude
  { id: "claude-haiku-4-5", nome: "Claude Haiku 4.5", provedor: "claude", inUsd: 1, outUsd: 5, nota: "premium enxuto" },
  { id: "claude-sonnet-4-5", nome: "Claude Sonnet 4.5", provedor: "claude", inUsd: 3, outUsd: 15 },
  { id: "claude-opus-4-5", nome: "Claude Opus 4.5", provedor: "claude", inUsd: 5, outUsd: 25, nota: "topo · caro" },
];

// Câmbio p/ converter a estimativa US$ -> R$. AJUSTAR.
export const USD_BRL = 5.4;

export const PROVEDORES: { id: ProvedorIA; nome: string }[] = [
  { id: "openai", nome: "OpenAI" },
  { id: "gemini", nome: "Gemini" },
  { id: "claude", nome: "Claude" },
];

export const DEFAULT_PROVEDOR: ProvedorIA = "openai";
export const DEFAULT_MODELO = "gpt-4o-mini";

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
  return "openai";
}

export function nomeProvedor(p: ProvedorIA): string {
  return PROVEDORES.find((x) => x.id === p)?.nome ?? p;
}

// Estimativa de custo em CENTAVOS de R$ p/ dados tokens de um modelo.
export function estimarCustoCentBRL(modeloId: string, tokensIn: number, tokensOut: number): number {
  const m = acharModelo(modeloId);
  const inUsd = m?.inUsd ?? 0.5; // fallback genérico p/ modelo desconhecido
  const outUsd = m?.outUsd ?? 1.5;
  const usd = (tokensIn / 1e6) * inUsd + (tokensOut / 1e6) * outUsd;
  return Math.round(usd * USD_BRL * 100);
}
