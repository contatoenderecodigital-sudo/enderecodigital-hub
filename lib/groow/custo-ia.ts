// Custo real de cada geração de IA - a resposta da Claude API devolve os
// tokens consumidos (usage), então dá pra calcular o custo exato na hora.
// Arquivo sem import de banco: também é usado nos componentes do admin.

// Preços por modelo (US$ por milhão de tokens). Fonte: tabela oficial Anthropic.
// A busca web é por unidade (US$ 10 a cada 1000 buscas = US$ 0,01 cada).
const PRECOS: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  "imagen-3.0-generate-002": { input: 0, output: 0 }, // imagem: custo fixo por chamada
  "gemini-3.1-flash-image": { input: 0, output: 0 },
};
const PRECO_PADRAO = { input: 3, output: 15 }; // sonnet-5, o mais usado
const USD_BUSCA_WEB = 0.01;

// Câmbio aproximado só pra exibição em reais (o valor gravado é sempre em US$).
export const USD_BRL = 5.5;

function precoDoModelo(modelo?: string | null) {
  return (modelo && PRECOS[modelo]) || PRECO_PADRAO;
}

export interface UsageAPI {
  input_tokens?: number;
  output_tokens?: number;
  // prompt caching: leitura do cache custa 10% do preço de entrada; a gravação
  // (primeira vez a cada 5 min) custa 1,25x. O input_tokens da API já vem SEM
  // a parte cacheada, então os três se somam.
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
  server_tool_use?: { web_search_requests?: number };
}

export function calcularCustoUsd(usage?: UsageAPI | null, modelo?: string | null): number {
  if (!usage) return 0;
  const p = precoDoModelo(modelo);
  return (
    ((usage.input_tokens ?? 0) * p.input) / 1_000_000 +
    ((usage.cache_read_input_tokens ?? 0) * p.input * 0.1) / 1_000_000 +
    ((usage.cache_creation_input_tokens ?? 0) * p.input * 1.25) / 1_000_000 +
    ((usage.output_tokens ?? 0) * p.output) / 1_000_000 +
    (usage.server_tool_use?.web_search_requests ?? 0) * USD_BUSCA_WEB
  );
}

/** Quebra o custo de uma chamada em entrada / saída / busca, pra tela de detalhe. */
export function detalharCusto(
  input_tokens: number,
  output_tokens: number,
  buscas_web: number,
  modelo?: string | null
) {
  const p = precoDoModelo(modelo);
  const inputUsd = (input_tokens * p.input) / 1_000_000;
  const outputUsd = (output_tokens * p.output) / 1_000_000;
  const buscaUsd = buscas_web * USD_BUSCA_WEB;
  return {
    inputUsd,
    outputUsd,
    buscaUsd,
    inputBrl: inputUsd * USD_BRL,
    outputBrl: outputUsd * USD_BRL,
    buscaBrl: buscaUsd * USD_BRL,
    precoInputMtok: p.input,
    precoOutputMtok: p.output,
  };
}

/** "R$ 0,25" a partir do custo em dólar gravado no banco (DECIMAL chega como string). */
export function custoEmReais(usd?: number | string | null): string {
  const n = typeof usd === "string" ? parseFloat(usd) : usd ?? 0;
  if (!n || Number.isNaN(n) || n <= 0) return "";
  const brl = n * USD_BRL;
  return `R$ ${(brl < 0.01 ? 0.01 : brl).toFixed(2).replace(".", ",")}`;
}

/** Versão numérica pra breakdown (sempre 2 casas, mostra centavos mesmo se < 1). */
export function brl(n: number): string {
  return `R$ ${n.toFixed(2).replace(".", ",")}`;
}
