// Diário de bordo da IA: toda chamada à Claude API registra módulo, tokens,
// custo, duração e status. Alimenta a aba IA & Custos do admin.
// Melhor esforço SEMPRE: logar nunca pode derrubar uma geração.
import { getPool, exec } from "@/lib/groow/db";
import { calcularCustoUsd, type UsageAPI } from "@/lib/groow/custo-ia";

let tabelaOk = false;

async function garantirTabela(): Promise<void> {
  if (tabelaOk) return;
  // Schema em db/migrations/groow-postgres.sql, aplicado no deploy. O DDL em
  // runtime era do tempo do MySQL e não vale mais.
  tabelaOk = true;
}

export async function registrarIA(r: {
  modulo: "blog" | "social" | "email-prospeccao" | string;
  acao?: string;
  modelo?: string;
  usage?: UsageAPI | null;
  custoUsd?: number;
  duracaoMs?: number;
  status?: "ok" | "erro";
  detalhe?: string;
}): Promise<void> {
  try {
    await garantirTabela();
    const u = r.usage;
    await exec(
      `INSERT INTO ia_logs (modulo, acao, modelo, input_tokens, output_tokens, buscas_web, custo_usd, duracao_ms, status, detalhe)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        r.modulo.slice(0, 38),
        (r.acao ?? "").slice(0, 155),
        (r.modelo ?? "").slice(0, 58),
        u?.input_tokens ?? 0,
        u?.output_tokens ?? 0,
        u?.server_tool_use?.web_search_requests ?? 0,
        r.custoUsd ?? calcularCustoUsd(u, r.modelo),
        Math.round(r.duracaoMs ?? 0),
        r.status ?? "ok",
        (r.detalhe ?? "").slice(0, 295),
      ]
    );
  } catch (err) {
    console.error("[ia-log]", err instanceof Error ? err.message : err);
  }
}
