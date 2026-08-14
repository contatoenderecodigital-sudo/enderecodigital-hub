import { getPool } from "@/lib/groow/db";

// Relatórios white-label (tabela criada automaticamente no primeiro uso).
let tabelaOk = false;

export async function garantirTabelaRelatorios(): Promise<void> {
  if (tabelaOk) return;
  await getPool().query(`CREATE TABLE IF NOT EXISTS relatorios_cliente (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    cliente VARCHAR(200) NOT NULL,
    periodo VARCHAR(20) NOT NULL,
    dados MEDIUMTEXT NOT NULL,
    token VARCHAR(48) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_rel_token (token)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  tabelaOk = true;
}

export interface MetricaRelatorio { label: string; valor: string; variacao?: string }
export interface DadosRelatorio {
  resumo: string;
  metricas: MetricaRelatorio[];
  trabalhos: string[];
  proximos: string[];
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "2026-07" vira "julho de 2026" */
export function periodoLegivel(periodo: string): string {
  const m = periodo.match(/^(\d{4})-(\d{2})$/);
  if (!m) return periodo;
  const mes = MESES[Number(m[2]) - 1];
  return mes ? `${mes} de ${m[1]}` : periodo;
}
