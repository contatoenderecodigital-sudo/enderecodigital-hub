
// Relatórios white-label (tabela criada automaticamente no primeiro uso).
let tabelaOk = false;

export async function garantirTabelaRelatorios(): Promise<void> {
  if (tabelaOk) return;
  // O schema agora vive em db/migrations/groow-postgres.sql, aplicado no
  // deploy. Esta função virou marcador: o DDL em runtime era do tempo do MySQL.
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
