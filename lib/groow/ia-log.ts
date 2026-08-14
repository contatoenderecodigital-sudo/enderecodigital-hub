// Diário de bordo da IA: toda chamada à Claude API registra módulo, tokens,
// custo, duração e status. Alimenta a aba IA & Custos do admin.
// Melhor esforço SEMPRE: logar nunca pode derrubar uma geração.
import { getPool, exec } from "@/lib/groow/db";
import { calcularCustoUsd, type UsageAPI } from "@/lib/groow/custo-ia";

let tabelaOk = false;

async function garantirTabela(): Promise<void> {
  if (tabelaOk) return;
  await getPool().query(`CREATE TABLE IF NOT EXISTS ia_logs (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    modulo VARCHAR(40) NOT NULL,
    acao VARCHAR(160) NOT NULL DEFAULT '',
    modelo VARCHAR(60) NOT NULL DEFAULT '',
    input_tokens INT UNSIGNED NOT NULL DEFAULT 0,
    output_tokens INT UNSIGNED NOT NULL DEFAULT 0,
    buscas_web INT UNSIGNED NOT NULL DEFAULT 0,
    custo_usd DECIMAL(8,4) NOT NULL DEFAULT 0,
    duracao_ms INT UNSIGNED NOT NULL DEFAULT 0,
    status ENUM('ok','erro') NOT NULL DEFAULT 'ok',
    detalhe VARCHAR(300) NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_ia_data (created_at),
    KEY idx_ia_modulo (modulo, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
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
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
