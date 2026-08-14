import { query } from "./db";
import type { Cliente, ClienteStatus } from "./types";
import { normalizeOrigem, LEAD_ORIGEM_LABEL } from "./types";

// ---------- Schema inspection (defensive vs missing columns) ----------

const _columnCache = new Map<string, Set<string>>();

export async function getColumns(table: string): Promise<Set<string>> {
  const cached = _columnCache.get(table);
  if (cached) return cached;
  try {
    const rows = await query<{ column_name: string; COLUMN_NAME?: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = ?`,
      [table]
    );
    const set = new Set(
      rows.map((r) => (r.column_name || r.COLUMN_NAME || "").toLowerCase())
    );
    _columnCache.set(table, set);
    return set;
  } catch {
    return new Set();
  }
}

async function hasColumn(table: string, column: string): Promise<boolean> {
  const cols = await getColumns(table);
  return cols.has(column.toLowerCase());
}

/** Returns expression to use in SELECT for a phone field, adapting to schema */
async function phoneExpr(): Promise<string> {
  const cols = await getColumns("leads");
  if (cols.has("whatsapp")) return "whatsapp";
  if (cols.has("telefone")) return "telefone AS whatsapp";
  if (cols.has("phone")) return "phone AS whatsapp";
  if (cols.has("celular")) return "celular AS whatsapp";
  return "'' AS whatsapp";
}

async function selectExpr(
  table: string,
  desired: string[]
): Promise<string> {
  const cols = await getColumns(table);
  return desired
    .map((c) => (cols.has(c.toLowerCase()) ? c : `NULL AS ${c}`))
    .join(", ");
}

/** Build SELECT for leads table, mapping `whatsapp` to whatever phone column exists */
export async function buildLeadSelect(desired: string[]): Promise<string> {
  const cols = await getColumns("leads");
  return desired
    .map((c) => {
      const lc = c.toLowerCase();
      if (lc === "whatsapp") {
        if (cols.has("whatsapp")) return "whatsapp";
        if (cols.has("telefone")) return "telefone AS whatsapp";
        if (cols.has("phone")) return "phone AS whatsapp";
        if (cols.has("celular")) return "celular AS whatsapp";
        return "'' AS whatsapp";
      }
      return cols.has(lc) ? c : `NULL AS ${c}`;
    })
    .join(", ");
}

export interface PipelineMonth {
  mes: string;
  novo: number;
  contatado: number;
  diagnostico: number;
  proposta: number;
  fechado: number;
}

export async function getPipelineByMonth(months = 6): Promise<PipelineMonth[]> {
  if (!(await tableExists("leads"))) return [];
  const rows = await query<{
    mes: string;
    status: string;
    c: number;
  }>(
    `SELECT DATE_FORMAT(created_at, '%Y-%m') AS mes, status, COUNT(*) AS c
     FROM leads
     WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
     GROUP BY mes, status
     ORDER BY mes ASC`,
    [months]
  );
  const map = new Map<string, PipelineMonth>();
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    map.set(key, {
      mes: d.toLocaleDateString("pt-BR", { month: "short" }),
      novo: 0, contatado: 0, diagnostico: 0, proposta: 0, fechado: 0,
    });
  }
  for (const r of rows) {
    const m = map.get(r.mes);
    if (!m) continue;
    const s = r.status as keyof Omit<PipelineMonth, "mes">;
    if (s in m) (m[s] as number) = Number(r.c);
  }
  return Array.from(map.values());
}

export interface RevenuePoint {
  mes: string;
  retainer: number;
  setup: number;
  avulso: number;
  total: number;
}

export async function getRevenueByMonth(months = 12): Promise<RevenuePoint[]> {
  const out: RevenuePoint[] = [];
  if (!(await tableExists("clientes"))) {
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      out.push({
        mes: d.toLocaleDateString("pt-BR", { month: "short" }),
        retainer: 0, setup: 0, avulso: 0, total: 0,
      });
    }
    return out;
  }
  const now = new Date();
  const hasSetupCol = await hasColumn("clientes", "valor_setup");
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const dateStr = d.toISOString().slice(0, 10);
    const ym = dateStr.slice(0, 7);
    // Recorrência: valor_mensal dos contratos ativos naquele mês.
    const recRows = await query<{ total: string | null }>(
      `SELECT COALESCE(SUM(valor_mensal),0) AS total
       FROM clientes
       WHERE inicio_contrato <= ?
         AND (fim_contrato IS NULL OR fim_contrato >= ?)
         AND status IN ('ativo','concluido')`,
      [dateStr, dateStr]
    );
    const retainer = Number(recRows[0]?.total ?? 0);
    // Setup: valor_setup dos contratos iniciados naquele mês (cobrança única).
    let setup = 0;
    if (hasSetupCol) {
      const setRows = await query<{ total: string | null }>(
        `SELECT COALESCE(SUM(valor_setup),0) AS total
         FROM clientes
         WHERE valor_setup > 0
           AND DATE_FORMAT(inicio_contrato,'%Y-%m') = ?
           AND status IN ('ativo','concluido')`,
        [ym]
      );
      setup = Number(setRows[0]?.total ?? 0);
    }
    const total = retainer + setup;
    out.push({
      mes: d.toLocaleDateString("pt-BR", { month: "short" }),
      retainer, setup, avulso: 0, total,
    });
  }
  return out;
}

export interface ResumoFaturamento {
  total: number;
  retainer: number;
  setup: number;
  /** vs período anterior de mesma duração; null quando não há base de comparação */
  deltaPct: number | null;
}

/**
 * Faturamento do PERÍODO selecionado no Painel (respeita o PeriodNav).
 * Sem from/to => mês corrente. Mesmas regras do getRevenueByMonth:
 * recorrente = valor_mensal dos contratos ativos em cada mês do período;
 * setup = valor_setup dos contratos iniciados dentro do período.
 */
export async function getResumoFaturamento(range?: { from?: string | null; to?: string | null }): Promise<ResumoFaturamento> {
  if (!(await tableExists("clientes"))) return { total: 0, retainer: 0, setup: 0, deltaPct: null };
  const hasSetupCol = await hasColumn("clientes", "valor_setup");

  const calc = async (fromD: Date, toD: Date): Promise<{ retainer: number; setup: number }> => {
    let retainer = 0;
    const cursor = new Date(fromD.getFullYear(), fromD.getMonth(), 1);
    const endMonth = new Date(toD.getFullYear(), toD.getMonth(), 1);
    while (cursor <= endMonth) {
      const dateStr = cursor.toISOString().slice(0, 10); // dia 1 do mês (mesma âncora do gráfico 12m)
      const rows = await query<{ total: string | null }>(
        `SELECT COALESCE(SUM(valor_mensal),0) AS total
         FROM clientes
         WHERE inicio_contrato <= ?
           AND (fim_contrato IS NULL OR fim_contrato >= ?)
           AND status IN ('ativo','concluido')`,
        [dateStr, dateStr]
      );
      retainer += Number(rows[0]?.total ?? 0);
      cursor.setMonth(cursor.getMonth() + 1);
    }
    let setup = 0;
    if (hasSetupCol) {
      const rows = await query<{ total: string | null }>(
        `SELECT COALESCE(SUM(valor_setup),0) AS total
         FROM clientes
         WHERE valor_setup > 0
           AND inicio_contrato BETWEEN ? AND ?
           AND status IN ('ativo','concluido')`,
        [fromD.toISOString().slice(0, 10), toD.toISOString().slice(0, 10)]
      );
      setup = Number(rows[0]?.total ?? 0);
    }
    return { retainer, setup };
  };

  // intervalo atual (sem range => mês corrente)
  let fromD: Date;
  let toD: Date;
  if (range?.from && range?.to) {
    fromD = new Date(`${range.from}T00:00:00`);
    toD = new Date(`${range.to}T00:00:00`);
  } else {
    const now = new Date();
    fromD = new Date(now.getFullYear(), now.getMonth(), 1);
    toD = now;
  }

  const atual = await calc(fromD, toD);
  const total = atual.retainer + atual.setup;

  // período anterior de mesma duração pra calcular o delta
  const durMs = Math.max(0, toD.getTime() - fromD.getTime());
  const prevTo = new Date(fromD.getTime() - 86_400_000);
  const prevFrom = new Date(prevTo.getTime() - durMs);
  const anterior = await calc(prevFrom, prevTo);
  const totalPrev = anterior.retainer + anterior.setup;
  const deltaPct = totalPrev > 0 ? ((total - totalPrev) / totalPrev) * 100 : null;

  return { total, retainer: atual.retainer, setup: atual.setup, deltaPct };
}

export interface OrigemNormalizada {
  canal: "Prospecção" | "Quiz" | "Diagnóstico" | "Anúncio" | "Indicação" | "Orgânico" | "Outros";
  count: number;
  pct: number;
}

export async function getOrigensNormalizadas(range?: { from?: string | null; to?: string | null }): Promise<OrigemNormalizada[]> {
  if (!(await tableExists("leads"))) return [];
  if (!(await hasColumn("leads", "origem"))) return [];

  const where: string[] = [];
  const params: string[] = [];
  if (range?.from) { where.push("created_at >= ?"); params.push(`${range.from} 00:00:00`); }
  if (range?.to) { where.push("created_at <= ?"); params.push(`${range.to} 23:59:59`); }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const rows = await query<{ origem: string | null; c: number }>(
    `SELECT origem, COUNT(*) AS c FROM leads ${whereSql} GROUP BY origem`,
    params
  );
  const buckets: Record<OrigemNormalizada["canal"], number> = {
    "Prospecção": 0, Quiz: 0, "Diagnóstico": 0, "Anúncio": 0, "Indicação": 0, "Orgânico": 0, Outros: 0,
  };
  for (const r of rows) {
    const origem = (r.origem || "").toLowerCase();
    const c = Number(r.c);
    if (origem.includes("prospec")) buckets["Prospecção"] += c;
    else if (origem.includes("quiz")) buckets.Quiz += c;
    else if (origem.includes("diagn")) buckets["Diagnóstico"] += c;
    else if (origem.includes("anunc") || origem.includes("ads") || origem.includes("trafego") || origem.includes("tráfego") || origem.includes("meta") || origem.includes("google") || origem.includes("tiktok")) buckets["Anúncio"] += c;
    else if (origem.includes("indica")) buckets["Indicação"] += c;
    else if (origem.includes("organic") || origem.includes("orgânic") || origem.includes("site") || origem.includes("agendar") || origem.includes("whats") || origem.includes("instagram") || origem.includes("social")) buckets["Orgânico"] += c;
    else buckets.Outros += c;
  }
  const total = Object.values(buckets).reduce((a, b) => a + b, 0) || 1;
  return (Object.entries(buckets) as [OrigemNormalizada["canal"], number][])
    .map(([canal, count]) => ({ canal, count, pct: (count / total) * 100 }))
    .filter((b) => b.count > 0);
}

export interface FinanceiroResumo {
  mensal: number;
  trimestral: number;
  ticketMedio: number;
  ativos: number;
}

export interface FinanceiroData {
  resumo: FinanceiroResumo;
  mensalSeries: { mes: string; faturamento: number }[];
  clientes: Cliente[];
  vencendo: { id: number; empresa: string; fim_contrato: string }[];
}

export type PlanoTipo = "retainer" | "setup" | "avulso";
export type PagamentoStatus = "pago" | "proximo" | "atrasado";

export interface FinanceiroSerie {
  granularidade: "dia" | "mes";
  /** Recorrente = MRR ativo (snapshot) em cada dia/mês. */
  recorrente: { label: string; valor: number }[];
  /** Setup = entradas únicas em cada dia/mês. */
  setup: { label: string; valor: number }[];
}

export interface PagamentoMes {
  mes: string;       // "2026-06"
  label: string;     // "jun/26"
  vencimento: string; // ISO date
  status: "pago" | "atrasado" | "a_vencer" | "futuro";
  valor: number;
  pagoEm: string | null;
}

/** Histórico mês a mês de um cliente (pago/faltou) baseado nas transações. */
export async function getClientePagamentos(clienteId: number): Promise<PagamentoMes[]> {
  if (!(await tableExists("clientes"))) return [];
  const rows = await query<{ valor_mensal: string | null; inicio_contrato: string | Date; fim_contrato: string | Date | null; status: string }>(
    `SELECT valor_mensal, inicio_contrato, fim_contrato, status FROM clientes WHERE id = ? LIMIT 1`,
    [clienteId]
  );
  if (!rows[0]) return [];
  const c = rows[0];
  const valor = Number(c.valor_mensal ?? 0);
  // Sem mensalidade recorrente = nada pra cobrar mês a mês
  if (valor <= 0) return [];
  const inicio = new Date(typeof c.inicio_contrato === "string" ? c.inicio_contrato : c.inicio_contrato.toISOString());
  const diaCobranca = inicio.getDate();

  // transações recorrentes do cliente
  // IMPORTANTE: mês formatado NO SQL - o driver devolve DATE como objeto Date,
  // e String(Date).slice(0,7) vira "Fri Jun" (nunca casava => tudo "Faltou").
  let trans: { ym: string; dia: string; valor: string }[] = [];
  if (await tableExists("transacoes")) {
    trans = await query<{ ym: string; dia: string; valor: string }>(
      `SELECT DATE_FORMAT(data,'%Y-%m') AS ym, DATE_FORMAT(data,'%Y-%m-%d') AS dia, valor
       FROM transacoes WHERE cliente_id = ? AND tipo = 'recorrente'`,
      [clienteId]
    );
  }
  const pagoNoMes = new Map<string, { data: string; valor: number }>();
  for (const t of trans) {
    pagoNoMes.set(t.ym, { data: t.dia, valor: Number(t.valor) });
  }

  const hoje = new Date();
  const out: PagamentoMes[] = [];
  const cursor = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
  const fim = c.fim_contrato ? new Date(typeof c.fim_contrato === "string" ? c.fim_contrato : c.fim_contrato.toISOString()) : hoje;
  const last = new Date(Math.max(fim.getFullYear(), hoje.getFullYear()), fim > hoje ? fim.getMonth() : hoje.getMonth(), 1);

  while (cursor <= last) {
    const ym = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    const diasNoMes = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const venc = new Date(cursor.getFullYear(), cursor.getMonth(), Math.min(diaCobranca, diasNoMes));
    const pago = pagoNoMes.get(ym);
    let status: PagamentoMes["status"];
    if (pago) status = "pago";
    else if (venc > hoje) status = cursor.getMonth() === hoje.getMonth() && cursor.getFullYear() === hoje.getFullYear() ? "a_vencer" : "futuro";
    else status = "atrasado";

    out.push({
      mes: ym,
      label: cursor.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
      vencimento: venc.toISOString().slice(0, 10),
      status,
      valor: pago ? pago.valor : valor,
      pagoEm: pago ? pago.data : null,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out.reverse(); // mais recente primeiro
}

export interface CobrancaCliente {
  id: number;
  empresa: string;
  valor: number;
  diaCobranca: number;
  vencimento: string;
  status: "pago" | "atrasado" | "a_vencer";
  diasAteVencer: number;
}

/** Cobranças de um mês (default: mês atual) de todos os clientes ativos. ym = "YYYY-MM". */
export async function getCobrancasMes(ym?: string): Promise<{ cobrancas: CobrancaCliente[]; totalPrevisto: number; totalRecebido: number; ym: string; label: string }> {
  const hoje = new Date();
  const ymAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  const alvo = ym && /^\d{4}-\d{2}$/.test(ym) ? ym : ymAtual;
  const [ano, mesNum] = alvo.split("-").map(Number);
  const mesIdx = mesNum - 1;
  const labelMes = new Date(ano, mesIdx, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }).replace(/^./, (s) => s.toUpperCase());

  if (!(await tableExists("clientes"))) return { cobrancas: [], totalPrevisto: 0, totalRecebido: 0, ym: alvo, label: labelMes };

  const clientes = await query<{ id: number; empresa: string; valor_mensal: string | null; inicio_contrato: string | Date }>(
    `SELECT id, empresa, valor_mensal, inicio_contrato FROM clientes WHERE status = 'ativo' AND valor_mensal > 0`
  );

  // pagos recorrentes no mês-alvo
  const pagos = new Set<number>();
  if (await tableExists("transacoes")) {
    const t = await query<{ cliente_id: number | null }>(
      `SELECT DISTINCT cliente_id FROM transacoes WHERE tipo = 'recorrente' AND DATE_FORMAT(data,'%Y-%m') = ? AND cliente_id IS NOT NULL`,
      [alvo]
    );
    for (const r of t) if (r.cliente_id) pagos.add(Number(r.cliente_id));
  }

  const diasNoMes = new Date(ano, mesIdx + 1, 0).getDate();
  const fimMes = new Date(ano, mesIdx, diasNoMes);
  const hojeMid = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const mesEhFuturo = ano > hoje.getFullYear() || (ano === hoje.getFullYear() && mesIdx > hoje.getMonth());

  let totalPrevisto = 0, totalRecebido = 0;
  const cobrancas: CobrancaCliente[] = clientes
    .map((c) => {
      const valor = Number(c.valor_mensal ?? 0);
      const inicio = new Date(typeof c.inicio_contrato === "string" ? c.inicio_contrato : c.inicio_contrato.toISOString());
      // cliente só tem cobrança a partir do mês em que o contrato começou
      if (inicio > fimMes) return null;
      const diaCobranca = inicio.getDate();
      const venc = new Date(ano, mesIdx, Math.min(diaCobranca, diasNoMes));
      const diasAteVencer = Math.floor((venc.getTime() - hojeMid.getTime()) / 86400000);
      const pago = pagos.has(c.id);
      totalPrevisto += valor;
      if (pago) totalRecebido += valor;
      const status: CobrancaCliente["status"] = pago ? "pago" : (mesEhFuturo ? "a_vencer" : (diasAteVencer < 0 ? "atrasado" : "a_vencer"));
      return { id: c.id, empresa: c.empresa, valor, diaCobranca, vencimento: venc.toISOString().slice(0, 10), status, diasAteVencer };
    })
    .filter((c): c is CobrancaCliente => c !== null);
  cobrancas.sort((a, b) => {
    const order = { atrasado: 0, a_vencer: 1, pago: 2 } as const;
    return order[a.status] - order[b.status] || a.diasAteVencer - b.diasAteVencer;
  });
  return { cobrancas, totalPrevisto: Math.round(totalPrevisto), totalRecebido: Math.round(totalRecebido), ym: alvo, label: labelMes };
}

export interface AtrasoGlobal {
  clienteId: number;
  empresa: string;
  valor: number;
  mes: string;        // "2026-05"
  mesLabel: string;   // "mai/26"
  vencimento: string; // ISO date
  diasAtraso: number;
}

/**
 * Atrasados de TODOS os meses (não só o mês filtrado): varre cada cliente
 * ativo desde o início do contrato e lista todo mês vencido sem transação
 * recorrente correspondente.
 */
// ── Central "Meu dia": o que precisa da sua atenção agora ────────────────────
export interface MeuDia {
  conversasEsperando: number; // WhatsApp em handoff com mensagem não lida do cliente
  leadsNovos: number;         // lead que levantou a mão e ninguém falou ainda
  cobrancasVencidas: number;  // meses vencidos e não pagos
  totalAtrasado: number;      // R$ atrasado
  aprovacoesPendentes: number; // rascunhos de blog/social/campanha esperando OK
  tarefasVencidas: number;    // tarefa com prazo pra hoje ou atrasada
}

export async function getMeuDia(): Promise<MeuDia> {
  const out: MeuDia = { conversasEsperando: 0, leadsNovos: 0, cobrancasVencidas: 0, totalAtrasado: 0, aprovacoesPendentes: 0, tarefasVencidas: 0 };
  const contar = async (sql: string): Promise<number> => {
    try { const r = await query<{ n: number }>(sql); return Number(r[0]?.n ?? 0); } catch { return 0; }
  };

  if (await tableExists("wa_conversas")) {
    out.conversasEsperando = await contar(`SELECT COUNT(*) AS n FROM wa_conversas WHERE status='handed_off' AND nao_lidas > 0`);
  }
  if (await tableExists("leads")) {
    out.leadsNovos = await contar(`SELECT COUNT(*) AS n FROM leads WHERE status='novo'`);
  }
  try {
    const { atrasados, totalAtrasado } = await getAtrasadosGlobais();
    out.cobrancasVencidas = atrasados.length;
    out.totalAtrasado = totalAtrasado;
  } catch { /* clientes/transacoes podem não existir */ }
  if (await tableExists("blog_posts")) out.aprovacoesPendentes += await contar(`SELECT COUNT(*) AS n FROM blog_posts WHERE status='rascunho'`);
  if (await tableExists("social_conteudos")) out.aprovacoesPendentes += await contar(`SELECT COUNT(*) AS n FROM social_conteudos WHERE status='rascunho'`);
  if (await tableExists("wa_campanhas")) out.aprovacoesPendentes += await contar(`SELECT COUNT(*) AS n FROM wa_campanhas WHERE status='rascunho'`);
  if (await tableExists("tarefas")) {
    out.tarefasVencidas = await contar(`SELECT COUNT(*) AS n FROM tarefas WHERE status <> 'concluida' AND data_vencimento IS NOT NULL AND data_vencimento <= CURDATE()`);
  }
  return out;
}

export async function getAtrasadosGlobais(): Promise<{ atrasados: AtrasoGlobal[]; totalAtrasado: number }> {
  if (!(await tableExists("clientes"))) return { atrasados: [], totalAtrasado: 0 };

  const clientes = await query<{ id: number; empresa: string; valor_mensal: string | null; inicio_contrato: string | Date; fim_contrato: string | Date | null }>(
    `SELECT id, empresa, valor_mensal, inicio_contrato, fim_contrato FROM clientes WHERE status = 'ativo' AND valor_mensal > 0`
  );
  if (!clientes.length) return { atrasados: [], totalAtrasado: 0 };

  // todos os meses pagos de todos os clientes de uma vez (evita N queries)
  const pagosPorCliente = new Map<number, Set<string>>();
  if (await tableExists("transacoes")) {
    const t = await query<{ cliente_id: number; ym: string }>(
      `SELECT cliente_id, DATE_FORMAT(data,'%Y-%m') AS ym FROM transacoes
       WHERE tipo = 'recorrente' AND cliente_id IS NOT NULL`
    );
    for (const r of t) {
      const cid = Number(r.cliente_id);
      if (!pagosPorCliente.has(cid)) pagosPorCliente.set(cid, new Set());
      pagosPorCliente.get(cid)!.add(r.ym);
    }
  }

  const hoje = new Date();
  const hojeMid = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const atrasados: AtrasoGlobal[] = [];
  let totalAtrasado = 0;

  for (const c of clientes) {
    const valor = Number(c.valor_mensal ?? 0);
    const inicio = new Date(typeof c.inicio_contrato === "string" ? c.inicio_contrato : c.inicio_contrato.toISOString());
    const fim = c.fim_contrato ? new Date(typeof c.fim_contrato === "string" ? c.fim_contrato : c.fim_contrato.toISOString()) : null;
    const diaCobranca = inicio.getDate();
    const pagos = pagosPorCliente.get(c.id) ?? new Set<string>();

    const cursor = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
    const last = fim && fim < hoje ? new Date(fim.getFullYear(), fim.getMonth(), 1) : new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    while (cursor <= last) {
      const ym = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
      const diasNoMes = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
      const venc = new Date(cursor.getFullYear(), cursor.getMonth(), Math.min(diaCobranca, diasNoMes));
      if (venc < hojeMid && !pagos.has(ym)) {
        atrasados.push({
          clienteId: c.id,
          empresa: c.empresa,
          valor,
          mes: ym,
          mesLabel: cursor.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
          vencimento: venc.toISOString().slice(0, 10),
          diasAtraso: Math.floor((hojeMid.getTime() - venc.getTime()) / 86400000),
        });
        totalAtrasado += valor;
      }
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  atrasados.sort((a, b) => b.diasAtraso - a.diasAtraso);
  return { atrasados, totalAtrasado: Math.round(totalAtrasado) };
}

export interface CaixaSerie {
  granularidade: "dia" | "mes";
  /** Dinheiro que entrou de fato em cada dia/mês (tabela transacoes). */
  pontos: { label: string; valor: number }[];
  totalPeriodo: number;
}

/**
 * Fluxo de caixa real: soma das transações (dinheiro recebido) por dia/mês.
 * <= 90 dias = por dia, senão por mês.
 */
export async function getCaixaSerie(from: string | null, to: string | null, tipo?: string): Promise<CaixaSerie> {
  const hoje = new Date();
  const end = to ? new Date(`${to}T12:00`) : hoje;
  const start = from ? new Date(`${from}T12:00`) : new Date(end.getFullYear(), end.getMonth() - 11, 1);
  const dias = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const porDia = dias <= 90;
  const isSetup = tipo === "setup";

  // chave canônica do bucket (igual no SQL e no preenchimento JS) - evita mismatch de label
  const keyExpr = porDia ? "%Y-%m-%d" : "%Y-%m";

  // Setup = entradas únicas, contadas no mês de início do contrato (fonte: clientes.valor_setup).
  // Recorrente/demais = dinheiro real recebido (fonte: transacoes).
  const mapa = new Map<string, number>();
  if (isSetup) {
    if (!(await hasColumn("clientes", "valor_setup"))) {
      return { granularidade: porDia ? "dia" : "mes", pontos: [], totalPeriodo: 0 };
    }
    const where: string[] = ["valor_setup > 0"];
    const params: string[] = [];
    if (from) { where.push("inicio_contrato >= ?"); params.push(from); }
    if (to) { where.push("inicio_contrato <= ?"); params.push(`${to} 23:59:59`); }
    const rows = await query<{ k: string; total: string | null }>(
      `SELECT DATE_FORMAT(inicio_contrato, '${keyExpr}') AS k, COALESCE(SUM(valor_setup),0) AS total
       FROM clientes WHERE ${where.join(" AND ")} GROUP BY k`,
      params
    );
    for (const r of rows) if (r.k) mapa.set(r.k, Number(r.total ?? 0));
  } else {
    if (!(await tableExists("transacoes"))) {
      return { granularidade: porDia ? "dia" : "mes", pontos: [], totalPeriodo: 0 };
    }
    const where: string[] = [];
    const params: string[] = [];
    if (from) { where.push("data >= ?"); params.push(from); }
    if (to) { where.push("data <= ?"); params.push(to); }
    if (tipo && ["recorrente", "avulso", "manual"].includes(tipo)) { where.push("tipo = ?"); params.push(tipo); }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const rows = await query<{ k: string; total: string | null }>(
      `SELECT DATE_FORMAT(data, '${keyExpr}') AS k, COALESCE(SUM(valor),0) AS total
       FROM transacoes ${whereSql} GROUP BY k`,
      params
    );
    for (const r of rows) if (r.k) mapa.set(r.k, Number(r.total ?? 0));
  }

  const pontos: { label: string; valor: number }[] = [];
  let total = 0;
  if (porDia) {
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const label = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
      const v = mapa.get(key) ?? 0;
      pontos.push({ label, valor: Math.round(v) });
      total += v;
    }
  } else {
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const last = new Date(end.getFullYear(), end.getMonth(), 1);
    const multiAno = start.getFullYear() !== end.getFullYear();
    while (cursor <= last) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
      const label = cursor.toLocaleDateString("pt-BR", multiAno ? { month: "short", year: "2-digit" } : { month: "short" });
      const v = mapa.get(key) ?? 0;
      pontos.push({ label, valor: Math.round(v) });
      total += v;
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }
  return { granularidade: porDia ? "dia" : "mes", pontos, totalPeriodo: Math.round(total) };
}

/**
 * Série de faturamento. <= 90 dias = por dia, senão por mês.
 * - Recorrente diário = MRR ativo naquele dia (soma valor_mensal dos contratos ativos).
 * - Setup = soma de valor_setup dos contratos iniciados naquele dia/mês.
 */
export async function getFinanceiroSerie(from: string | null, to: string | null): Promise<FinanceiroSerie> {
  const hoje = new Date();
  const end = to ? new Date(`${to}T12:00`) : hoje;
  const start = from ? new Date(`${from}T12:00`) : new Date(end.getFullYear(), end.getMonth() - 11, 1);
  const dias = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const porDia = dias <= 90;

  if (!(await tableExists("clientes"))) {
    return { granularidade: porDia ? "dia" : "mes", recorrente: [], setup: [] };
  }
  const hasSetup = await hasColumn("clientes", "valor_setup");

  const contratos = await query<{
    valor_mensal: string | null;
    valor_setup: string | null;
    inicio_contrato: string | Date;
    fim_contrato: string | Date | null;
    status: string;
  }>(
    `SELECT valor_mensal, ${hasSetup ? "valor_setup" : "0 AS valor_setup"} AS valor_setup,
            inicio_contrato, fim_contrato, status FROM clientes`
  );

  const recorrente: { label: string; valor: number }[] = [];
  const setup: { label: string; valor: number }[] = [];

  // Normaliza qualquer data para "YYYY-MM-DD" (sem hora/fuso)
  const toDateStr = (v: string | Date): string => {
    if (typeof v === "string") return v.slice(0, 10);
    return v.toISOString().slice(0, 10);
  };

  if (porDia) {
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const diaStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      let rec = 0, set = 0;
      for (const c of contratos) {
        const iniStr = toDateStr(c.inicio_contrato);
        const fimStr = c.fim_contrato ? toDateStr(c.fim_contrato) : null;
        // MRR ativo no dia = valor_mensal cheio (snapshot da base recorrente)
        if (iniStr <= diaStr && (!fimStr || fimStr >= diaStr) && c.status !== "cancelado") rec += Number(c.valor_mensal ?? 0);
        if (iniStr === diaStr) set += Number(c.valor_setup ?? 0);
      }
      const label = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
      recorrente.push({ label, valor: Math.round(rec) });
      setup.push({ label, valor: Math.round(set) });
    }
    return { granularidade: "dia", recorrente, setup };
  }

  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= last) {
    const ref = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    let rec = 0, set = 0;
    for (const c of contratos) {
      const ini = new Date(c.inicio_contrato as string);
      const fim = c.fim_contrato ? new Date(c.fim_contrato as string) : null;
      if (ini <= ref && (!fim || fim >= ref) && c.status !== "cancelado") rec += Number(c.valor_mensal ?? 0);
      if (ini.getFullYear() === cursor.getFullYear() && ini.getMonth() === cursor.getMonth()) set += Number(c.valor_setup ?? 0);
    }
    const label = cursor.toLocaleDateString("pt-BR", { month: "short" });
    recorrente.push({ label, valor: Math.round(rec) });
    setup.push({ label, valor: Math.round(set) });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return { granularidade: "mes", recorrente, setup };
}

export interface FinanceiroV2Data {
  /** Faturamento mensal (soma valor_mensal de contratos ativos cobrindo o mês atual). */
  mensal: number;
  /** Faturamento trimestral (últimos 3 meses corridos). */
  trimestral: number;
  ticketMedio: number;
  ativos: number;
  /** Faturamento acumulado desde o primeiro contrato registrado. */
  acumulado: number;
  /** Contagem total de contratos (todos os status). */
  totalContratos: number;
  /** Data ISO do primeiro contrato (ou null). */
  primeiroContrato: string | null;
  /** Maior contrato ativo. */
  maiorContrato: { empresa: string; valor: number } | null;
  /** Variação % vs. mês anterior. */
  deltaMensalPct: number;
  /** Variação % do trimestre vs. trimestre anterior. */
  deltaTrimPct: number;
  /** Variação % do ticket médio. */
  deltaTicketPct: number;
  /** Faturamento total dos últimos 12 meses (soma da série). */
  total12m: number;
  /** Δ YoY (este 12m vs. 12m anterior). */
  deltaYoYPct: number;
  /** Mês com maior valor da série, em nome curto (ex. "Maio"). */
  picoMes: string;
  /** Série últimos 12 meses. */
  mensalSeries: { mes: string; mesLong: string; faturamento: number }[];
  /** Composição por tipo de plano (retainer/setup/avulso) usando os contratos ativos. */
  composicao: { tipo: PlanoTipo; valor: number; contratos: number }[];
  /** Próximos vencimentos (próximos 7 dias + recém atrasados). */
  vencimentos: VencimentoItem[];
  /** Lista completa de contratos pra tabela inferior. */
  contratos: ContratoRow[];
  /** Total de setup recebido (valor_setup de todos os clientes). */
  totalSetup: number;
  /** Série de 12 meses de setup (quando contratos iniciaram). */
  setupSeries: { mes: string; faturamento: number }[];
}

export interface VencimentoItem {
  id: number;
  empresa: string;
  valor: number;
  /** Data do próximo vencimento (ISO). */
  data: string;
  /** Dias até vencer (negativo se atrasado, 0 = hoje, 1 = amanhã). */
  diasAteVencer: number;
  status: PagamentoStatus;
  metodo: string;
  plano: PlanoTipo;
}

export interface ContratoRow {
  id: number;
  empresa: string;
  responsavel: string | null;
  plano: PlanoTipo;
  /** texto do plano original */
  planoNome: string;
  valor: number;
  valorSetup: number;
  status: PagamentoStatus;
  proximoVencimento: string;
  diasAteVencer: number;
  /** Meses desde o início do contrato. */
  mesesContrato: number;
  setor: string | null;
}

function classifyPlano(plano: string | null): PlanoTipo {
  const p = (plano || "").toLowerCase();
  if (p.includes("setup") && p.includes("retainer")) return "setup";
  if (p.includes("setup")) return "setup";
  if (p.includes("avulso") || p.includes("one-time") || p.includes("pontual")) return "avulso";
  if (p.includes("retainer") || p.includes("mensal") || p.includes("recorrente")) return "retainer";
  // default - operação completa = retainer
  return "retainer";
}

/**
 * Calcula próximo vencimento + status assumindo cobrança mensal no
 * mesmo dia do mês do início do contrato.
 */
function computePaymentStatus(
  inicio: Date,
  hoje: Date
): { proxima: Date; dias: number; status: PagamentoStatus } {
  const diaCobranca = inicio.getDate();
  const anchor = new Date(hoje.getFullYear(), hoje.getMonth(), diaCobranca);
  let proxima: Date;
  const diffHoje = Math.floor((anchor.getTime() - hoje.getTime()) / 86400000);

  if (diffHoje >= 0) {
    proxima = anchor;
  } else {
    proxima = new Date(hoje.getFullYear(), hoje.getMonth() + 1, diaCobranca);
  }
  const dias = Math.floor((proxima.getTime() - hoje.getTime()) / 86400000);

  // ultima cobrança = data deste mês (se já passou) ou mês anterior
  const ultima = diffHoje >= 0
    ? new Date(hoje.getFullYear(), hoje.getMonth() - 1, diaCobranca)
    : anchor;
  const diasDesdeUltima = Math.floor((hoje.getTime() - ultima.getTime()) / 86400000);

  let status: PagamentoStatus;
  if (diasDesdeUltima > 0 && diasDesdeUltima <= 5) {
    // último vencimento foi recente - sem dado de pagamento, marcamos como ATRASADO
    // só se ultrapassou a janela típica de 3 dias após a data
    status = diasDesdeUltima > 3 ? "atrasado" : "pago";
  } else if (dias <= 7) {
    status = "proximo";
  } else {
    status = "pago";
  }

  return { proxima, dias, status };
}

export async function getFinanceiroV2(): Promise<FinanceiroV2Data> {
  const empty: FinanceiroV2Data = {
    mensal: 0,
    trimestral: 0,
    ticketMedio: 0,
    ativos: 0,
    acumulado: 0,
    totalContratos: 0,
    primeiroContrato: null,
    maiorContrato: null,
    deltaMensalPct: 0,
    deltaTrimPct: 0,
    deltaTicketPct: 0,
    total12m: 0,
    deltaYoYPct: 0,
    picoMes: "-",
    mensalSeries: [],
    composicao: [
      { tipo: "retainer", valor: 0, contratos: 0 },
      { tipo: "setup", valor: 0, contratos: 0 },
      { tipo: "avulso", valor: 0, contratos: 0 },
    ],
    vencimentos: [],
    contratos: [],
    totalSetup: 0,
    setupSeries: [],
  };

  if (!(await tableExists("clientes"))) {
    return empty;
  }

  // KPIs do mês corrente
  const sumRows = await query<{ total: string | null; qtd: number }>(
    `SELECT COALESCE(SUM(valor_mensal),0) AS total, COUNT(*) AS qtd
     FROM clientes WHERE status = 'ativo'`
  );
  const mensal = Number(sumRows[0]?.total ?? 0);
  const ativos = Number(sumRows[0]?.qtd ?? 0);
  const ticketMedio = ativos > 0 ? mensal / ativos : 0;

  // Série de 24 meses (queremos 12m + 12m anteriores p/ YoY)
  const now = new Date();
  const SERIES_LEN = 24;
  const series: { mes: string; mesLong: string; faturamento: number; date: Date }[] = [];
  for (let i = SERIES_LEN - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const dateStr = d.toISOString().slice(0, 10);
    const rows = await query<{ total: string | null }>(
      `SELECT COALESCE(SUM(valor_mensal),0) AS total
       FROM clientes
       WHERE inicio_contrato <= ?
         AND (fim_contrato IS NULL OR fim_contrato >= ?)
         AND status IN ('ativo','concluido','pausado')`,
      [dateStr, dateStr]
    );
    series.push({
      mes: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
      mesLong: d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
      faturamento: Number(rows[0]?.total ?? 0),
      date: d,
    });
  }

  const last12 = series.slice(-12);
  const prev12 = series.slice(0, 12);
  const total12m = last12.reduce((s, x) => s + x.faturamento, 0);
  const totalPrev12 = prev12.reduce((s, x) => s + x.faturamento, 0);
  const deltaYoYPct = totalPrev12 > 0 ? ((total12m - totalPrev12) / totalPrev12) * 100 : 0;

  const cur = last12[last12.length - 1]?.faturamento ?? 0;
  const prev = last12[last12.length - 2]?.faturamento ?? 0;
  const deltaMensalPct = prev > 0 ? ((cur - prev) / prev) * 100 : 0;

  const trimestral = last12.slice(-3).reduce((s, x) => s + x.faturamento, 0);
  const trimAnterior = last12.slice(-6, -3).reduce((s, x) => s + x.faturamento, 0);
  const deltaTrimPct = trimAnterior > 0 ? ((trimestral - trimAnterior) / trimAnterior) * 100 : 0;

  // ticket médio do mês anterior pra delta
  const ativosAnteriorRows = await query<{ c: number; soma: string | null }>(
    `SELECT COUNT(*) AS c, COALESCE(SUM(valor_mensal),0) AS soma
     FROM clientes
     WHERE inicio_contrato <= LAST_DAY(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
       AND (fim_contrato IS NULL OR fim_contrato >= LAST_DAY(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)))
       AND status IN ('ativo','concluido')`
  );
  const ticketAnterior = Number(ativosAnteriorRows[0]?.c ?? 0) > 0
    ? Number(ativosAnteriorRows[0]?.soma ?? 0) / Number(ativosAnteriorRows[0]?.c)
    : 0;
  const deltaTicketPct = ticketAnterior > 0 ? ((ticketMedio - ticketAnterior) / ticketAnterior) * 100 : 0;

  // Acumulado: soma dos meses ativos de cada contrato * valor mensal
  const allContratos = await query<{
    id: number;
    empresa: string;
    plano: string | null;
    valor_mensal: string | null;
    valor_setup: string | null;
    inicio_contrato: Date | string;
    fim_contrato: Date | string | null;
    status: ClienteStatus;
    notas: string | null;
  }>(
    `SELECT id, empresa, plano, valor_mensal,
            COALESCE(valor_setup, 0) AS valor_setup,
            inicio_contrato, fim_contrato, status, notas
     FROM clientes
     ORDER BY status = 'ativo' DESC, valor_mensal DESC`
  );

  let acumulado = 0;
  let maiorContrato: { empresa: string; valor: number } | null = null;
  let primeiroContrato: Date | null = null;

  for (const c of allContratos) {
    const valor = Number(c.valor_mensal ?? 0);
    const inicio = new Date(c.inicio_contrato as string);
    const fim = c.fim_contrato ? new Date(c.fim_contrato as string) : now;
    const meses = Math.max(
      0,
      (fim.getFullYear() - inicio.getFullYear()) * 12 + (fim.getMonth() - inicio.getMonth()) + 1
    );
    acumulado += valor * meses;

    if (!primeiroContrato || inicio < primeiroContrato) primeiroContrato = inicio;
    if (c.status === "ativo" && (!maiorContrato || valor > maiorContrato.valor)) {
      maiorContrato = { empresa: c.empresa, valor };
    }
  }

  // Composição
  const ativosList = allContratos.filter((c) => c.status === "ativo");
  const compMap: Record<PlanoTipo, { valor: number; contratos: number }> = {
    retainer: { valor: 0, contratos: 0 },
    setup: { valor: 0, contratos: 0 },
    avulso: { valor: 0, contratos: 0 },
  };
  for (const c of ativosList) {
    const tipo = classifyPlano(c.plano);
    compMap[tipo].valor += Number(c.valor_mensal ?? 0);
    compMap[tipo].contratos += 1;
  }

  // Vencimentos e tabela
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const vencimentos: VencimentoItem[] = [];
  const contratos: ContratoRow[] = [];

  for (const c of allContratos) {
    if (c.status !== "ativo") continue;
    const inicio = new Date(c.inicio_contrato as string);
    const { proxima, dias, status } = computePaymentStatus(inicio, today);
    const valor = Number(c.valor_mensal ?? 0);
    const tipo = classifyPlano(c.plano);
    const mesesContrato = Math.max(
      1,
      (today.getFullYear() - inicio.getFullYear()) * 12 + (today.getMonth() - inicio.getMonth())
    );

    contratos.push({
      id: c.id,
      empresa: c.empresa,
      responsavel: null,
      plano: tipo,
      planoNome: c.plano || "-",
      valor,
      valorSetup: Number(c.valor_setup ?? 0),
      status,
      proximoVencimento: proxima.toISOString().slice(0, 10),
      diasAteVencer: dias,
      mesesContrato,
      setor: null,
    });

    if (status === "atrasado" || (status === "proximo" && dias <= 14) || (status === "pago" && dias > 14 && dias <= 21)) {
      vencimentos.push({
        id: c.id,
        empresa: c.empresa,
        valor,
        data: proxima.toISOString().slice(0, 10),
        diasAteVencer: dias,
        status,
        metodo: "Recorrente",
        plano: tipo,
      });
    }
  }
  vencimentos.sort((a, b) => a.diasAteVencer - b.diasAteVencer);
  contratos.sort((a, b) => {
    const order = { atrasado: 0, proximo: 1, pago: 2 } as const;
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    return a.diasAteVencer - b.diasAteVencer;
  });

  // pico mês
  const picoIdx = last12.reduce((best, x, i, arr) => (x.faturamento > arr[best].faturamento ? i : best), 0);
  const picoMes = last12[picoIdx]?.date.toLocaleDateString("pt-BR", { month: "long" }) ?? "-";

  // Setup totals
  const hasSetupCol = await hasColumn("clientes", "valor_setup");
  let totalSetup = 0;
  const setupSeries: { mes: string; faturamento: number }[] = [];
  if (hasSetupCol) {
    const [setupRow] = await query<{ total: string | null }>(
      `SELECT COALESCE(SUM(valor_setup),0) AS total FROM clientes WHERE valor_setup > 0`
    );
    totalSetup = Number(setupRow?.total ?? 0);
    for (const { date, mes } of last12) {
      const fimMes = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      const [sRow] = await query<{ total: string | null }>(
        `SELECT COALESCE(SUM(valor_setup),0) AS total FROM clientes
         WHERE inicio_contrato BETWEEN ? AND ? AND valor_setup > 0`,
        [date.toISOString().slice(0, 10), fimMes.toISOString().slice(0, 10)]
      );
      setupSeries.push({ mes, faturamento: Number(sRow?.total ?? 0) });
    }
  } else {
    last12.forEach(({ mes }) => setupSeries.push({ mes, faturamento: 0 }));
  }

  return {
    mensal,
    trimestral,
    ticketMedio,
    ativos,
    acumulado,
    totalContratos: allContratos.length,
    primeiroContrato: primeiroContrato ? primeiroContrato.toISOString().slice(0, 10) : null,
    maiorContrato,
    deltaMensalPct,
    deltaTrimPct,
    deltaTicketPct,
    total12m,
    deltaYoYPct,
    picoMes: picoMes.charAt(0).toUpperCase() + picoMes.slice(1),
    mensalSeries: last12.map(({ mes, mesLong, faturamento }) => ({ mes, mesLong, faturamento })),
    composicao: [
      { tipo: "retainer", ...compMap.retainer },
      { tipo: "setup", ...compMap.setup },
      { tipo: "avulso", ...compMap.avulso },
    ],
    vencimentos: vencimentos.slice(0, 5),
    contratos,
    totalSetup,
    setupSeries,
  };
}

export async function getFinanceiro(): Promise<FinanceiroData> {
  const sumRows = await query<{ total: string | null; qtd: number }>(
    `SELECT COALESCE(SUM(valor_mensal),0) AS total, COUNT(*) AS qtd
     FROM clientes WHERE status = 'ativo'`
  );
  const mensal = Number(sumRows[0]?.total ?? 0);
  const ativos = Number(sumRows[0]?.qtd ?? 0);
  const trimestral = mensal * 3;
  const ticketMedio = ativos > 0 ? mensal / ativos : 0;

  const mensalSeries: { mes: string; faturamento: number }[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const dateStr = d.toISOString().slice(0, 10);
    const rows = await query<{ total: string | null }>(
      `SELECT COALESCE(SUM(valor_mensal),0) AS total
       FROM clientes
       WHERE inicio_contrato <= ?
         AND (fim_contrato IS NULL OR fim_contrato >= ?)
         AND status IN ('ativo','concluido')`,
      [dateStr, dateStr]
    );
    mensalSeries.push({
      mes: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
      faturamento: Number(rows[0]?.total ?? 0),
    });
  }

  const clientes = await query<Cliente>(
    `SELECT id, empresa, plano, valor_mensal, status, inicio_contrato, fim_contrato
     FROM clientes
     ORDER BY status = 'ativo' DESC, valor_mensal DESC`
  );

  const vencendo = await query<{ id: number; empresa: string; fim_contrato: string }>(
    `SELECT id, empresa, fim_contrato
     FROM clientes
     WHERE status = 'ativo'
       AND fim_contrato IS NOT NULL
       AND fim_contrato BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
     ORDER BY fim_contrato ASC`
  );

  return { resumo: { mensal, trimestral, ticketMedio, ativos }, mensalSeries, clientes, vencendo };
}

export interface DashboardSummary {
  leadsMes: number;
  leadsDelta: number;
  diagnosticosAgendados: number;
  diagnosticosDelta: number;
  clientesAtivos: number;
  clientesDelta: number;
  faturamentoMensal: number;
  faturamentoDelta: number;
}

export interface FunilStage {
  status: string;
  label: string;
  count: number;
}

export interface ActivityItem {
  id: string;
  tipo: "lead" | "agendamento" | "follow_up" | "cliente";
  titulo: string;
  descricao: string;
  timestamp: string;
}

export interface StatusBreakdown {
  status: string;
  label: string;
  count: number;
  pct: number;
}

export interface WeeklyPoint {
  semana: string;
  leads: number;
}

export interface TaskItem {
  id: string;
  titulo: string;
  detalhe?: string;
  prioridade: "alta" | "media" | "baixa";
  href?: string;
  whatsapp?: string;
}

async function tableExists(name: string): Promise<boolean> {
  const rows = await query<{ c: number }>(
    "SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?",
    [name]
  );
  return Number(rows[0]?.c ?? 0) > 0;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const out: DashboardSummary = {
    leadsMes: 0, leadsDelta: 0,
    diagnosticosAgendados: 0, diagnosticosDelta: 0,
    clientesAtivos: 0, clientesDelta: 0,
    faturamentoMensal: 0, faturamentoDelta: 0,
  };

  if (await tableExists("leads")) {
    const cur = await query<{ c: number }>(
      `SELECT COUNT(*) AS c FROM leads
       WHERE YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())`
    );
    const prev = await query<{ c: number }>(
      `SELECT COUNT(*) AS c FROM leads
       WHERE created_at >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m-01')
         AND created_at <  DATE_FORMAT(CURDATE(), '%Y-%m-01')`
    );
    out.leadsMes = Number(cur[0]?.c ?? 0);
    out.leadsDelta = out.leadsMes - Number(prev[0]?.c ?? 0);
  }

  if (await tableExists("agendamentos")) {
    const r = await query<{ c: number }>(
      `SELECT COUNT(*) AS c FROM agendamentos WHERE status = 'agendado' AND data_hora >= NOW()`
    );
    const last = await query<{ c: number }>(
      `SELECT COUNT(*) AS c FROM agendamentos
       WHERE status = 'agendado' AND data_hora >= DATE_SUB(NOW(), INTERVAL 7 DAY)
         AND data_hora < NOW()`
    );
    out.diagnosticosAgendados = Number(r[0]?.c ?? 0);
    out.diagnosticosDelta = Number(last[0]?.c ?? 0);
  }

  if (await tableExists("clientes")) {
    const r = await query<{ c: number; soma: string | null }>(
      `SELECT COUNT(*) AS c, COALESCE(SUM(valor_mensal),0) AS soma
       FROM clientes WHERE status = 'ativo'`
    );
    const novos = await query<{ c: number; soma: string | null }>(
      `SELECT COUNT(*) AS c, COALESCE(SUM(valor_mensal),0) AS soma
       FROM clientes
       WHERE status = 'ativo'
         AND inicio_contrato >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`
    );
    out.clientesAtivos = Number(r[0]?.c ?? 0);
    out.faturamentoMensal = Number(r[0]?.soma ?? 0);
    out.clientesDelta = Number(novos[0]?.c ?? 0);
    out.faturamentoDelta = Number(novos[0]?.soma ?? 0);
  }

  return out;
}

export async function getFunnelBreakdown(range?: { from?: string | null; to?: string | null }): Promise<FunilStage[]> {
  if (!(await tableExists("leads"))) {
    return [];
  }
  const order: { status: string; label: string }[] = [
    { status: "novo", label: "Novo" },
    { status: "contatado", label: "Contatado" },
    { status: "diagnostico", label: "Diagnóstico" },
    { status: "proposta", label: "Proposta" },
    { status: "fechado", label: "Fechado" },
  ];
  const where: string[] = [];
  const params: string[] = [];
  if (range?.from) { where.push("created_at >= ?"); params.push(`${range.from} 00:00:00`); }
  if (range?.to) { where.push("created_at <= ?"); params.push(`${range.to} 23:59:59`); }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const rows = await query<{ status: string; c: number }>(
    `SELECT status, COUNT(*) AS c FROM leads ${whereSql} GROUP BY status`,
    params
  );
  return order.map((o) => ({
    status: o.status,
    label: o.label,
    count: Number(rows.find((r) => r.status === o.status)?.c ?? 0),
  }));
}

export async function getStatusBreakdown(): Promise<StatusBreakdown[]> {
  if (!(await tableExists("leads"))) return [];
  const order: { status: string; label: string }[] = [
    { status: "novo", label: "Novo" },
    { status: "contatado", label: "Contatado" },
    { status: "diagnostico", label: "Diagnóstico" },
    { status: "proposta", label: "Proposta" },
    { status: "fechado", label: "Fechado" },
    { status: "quente", label: "Quente" },
    { status: "frio", label: "Frio" },
    { status: "perdido", label: "Perdido" },
  ];
  const rows = await query<{ status: string; c: number }>(
    `SELECT status, COUNT(*) AS c FROM leads GROUP BY status`
  );
  const total = rows.reduce((acc, r) => acc + Number(r.c), 0) || 1;
  return order
    .map((o) => {
      const count = Number(rows.find((r) => r.status === o.status)?.c ?? 0);
      return { status: o.status, label: o.label, count, pct: (count / total) * 100 };
    })
    .filter((s) => s.count > 0);
}

export async function getRecentActivity(limit = 8): Promise<ActivityItem[]> {
  if (!(await tableExists("leads"))) return [];
  const rows = await query<{
    id: number; nome: string; empresa: string; status: string; created_at: Date;
  }>(
    `SELECT id, nome, empresa, status, created_at
     FROM leads ORDER BY created_at DESC LIMIT ?`,
    [limit]
  );
  return rows.map((l) => ({
    id: `lead-${l.id}`,
    tipo: "lead",
    titulo: `${l.nome}`,
    descricao: `${l.empresa} · ${l.status}`,
    timestamp: new Date(l.created_at).toISOString(),
  }));
}

export interface MetricasFunil {
  status: string;
  count: number;
  pct: number;
}

export interface MetricasOrigem {
  origem: string;
  count: number;
}

export interface HeatmapCell { dow: number; hour: number; count: number }

export interface MetricasData {
  leadsPorSemana: WeeklyPoint[];
  funil: MetricasFunil[];
  origens: MetricasOrigem[];
  tempoMedioFechar: number | null;
  faturamentoMensal: { mes: string; faturamento: number }[];
  heatmap: HeatmapCell[];
  ltvMedio: number;
}

export async function getMetricasByWeeks(weeks = 12): Promise<MetricasData> {
  const from = new Date();
  from.setDate(from.getDate() - weeks * 7);
  return getMetricas({ from: from.toISOString().slice(0, 10), to: null });
}

export async function getMetricas(opts?: { from?: string | null; to?: string | null }): Promise<MetricasData> {
  const from = opts?.from ?? null;
  const to = opts?.to ?? null;

  // WHERE de data reutilizável para created_at
  const dateWhere: string[] = [];
  const dateParams: string[] = [];
  if (from) { dateWhere.push("created_at >= ?"); dateParams.push(`${from} 00:00:00`); }
  if (to) { dateWhere.push("created_at <= ?"); dateParams.push(`${to} 23:59:59`); }
  const whereSql = dateWhere.length ? `WHERE ${dateWhere.join(" AND ")}` : "";

  // Série de leads por semana dentro do range (ou últimas 12 se sem range)
  const leadsPorSemana = await getLeadsByRange(from, to);

  const funilRows = await query<{ status: string; c: number }>(
    `SELECT status, COUNT(*) AS c FROM leads ${whereSql} GROUP BY status`,
    dateParams
  );
  const total = funilRows.reduce((acc, r) => acc + Number(r.c), 0);
  const order = ["novo", "contatado", "diagnostico", "proposta", "fechado"];
  const funil: MetricasFunil[] = order.map((s) => {
    const r = funilRows.find((x) => x.status === s);
    const count = r ? Number(r.c) : 0;
    return { status: s, count, pct: total > 0 ? (count / total) * 100 : 0 };
  });

  const origemRows = await query<{ origem: string | null; c: number }>(
    `SELECT origem, COUNT(*) AS c FROM leads ${whereSql} GROUP BY origem`,
    dateParams
  );
  // Reagrupa por categoria normalizada (quiz, anúncio, prospecção, etc)
  const origemMap = new Map<string, number>();
  for (const r of origemRows) {
    const cat = normalizeOrigem(r.origem);
    const label = LEAD_ORIGEM_LABEL[cat];
    origemMap.set(label, (origemMap.get(label) || 0) + Number(r.c));
  }
  const origens: MetricasOrigem[] = [...origemMap.entries()]
    .map(([origem, count]) => ({ origem, count }))
    .sort((a, b) => b.count - a.count);

  const tempoRows = await query<{ media: string | null }>(
    `SELECT AVG(DATEDIFF(updated_at, created_at)) AS media
     FROM leads WHERE status = 'fechado'`
  );
  const tempoMedioFechar = tempoRows[0]?.media != null ? Number(tempoRows[0].media) : null;

  const fin = await getFinanceiro();

  // Heatmap: mensagens_whatsapp agrupadas por dia da semana (1=Dom..7=Sáb) e hora
  let heatmap: HeatmapCell[] = [];
  const hasMsgs = await tableExists("mensagens_whatsapp");
  if (hasMsgs) {
    const hRows = await query<{ dow: number; hour: number; c: number }>(
      `SELECT DAYOFWEEK(timestamp) AS dow, HOUR(timestamp) AS hour, COUNT(*) AS c
       FROM mensagens_whatsapp
       WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 90 DAY)
       GROUP BY dow, hour`
    );
    heatmap = hRows.map((r) => ({ dow: Number(r.dow), hour: Number(r.hour), count: Number(r.c) }));
  }

  // LTV médio: soma de (valor_mensal * meses_ativo) por cliente / total clientes
  let ltvMedio = 0;
  const hasClientes = await tableExists("clientes");
  if (hasClientes) {
    const ltvRows = await query<{ ltv: string | null }>(
      `SELECT AVG(valor_mensal * GREATEST(1,
         TIMESTAMPDIFF(MONTH, inicio_contrato, COALESCE(fim_contrato, CURDATE()))
       )) AS ltv FROM clientes WHERE status IN ('ativo','concluido')`
    );
    ltvMedio = Number(ltvRows[0]?.ltv ?? 0);
  }

  return {
    leadsPorSemana,
    funil,
    origens,
    tempoMedioFechar,
    faturamentoMensal: fin.mensalSeries,
    heatmap,
    ltvMedio,
  };
}

export async function getLeadsByWeek(weeks = 8): Promise<WeeklyPoint[]> {
  if (!(await tableExists("leads"))) {
    return Array.from({ length: weeks }, (_, i) => ({
      semana: `S-${weeks - i}`,
      leads: 0,
    }));
  }
  const rows = await query<{ semana: string; leads: number }>(
    `SELECT DATE_FORMAT(DATE_SUB(created_at, INTERVAL WEEKDAY(created_at) DAY), '%d/%m') AS semana,
            COUNT(*) AS leads
     FROM leads
     WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? WEEK)
     GROUP BY semana
     ORDER BY MIN(created_at) ASC`,
    [weeks]
  );
  return rows.map((r) => ({ semana: r.semana, leads: Number(r.leads) }));
}

/** Leads agrupados por dia (range curto) ou semana (range longo) dentro do período. */
export async function getLeadsByRange(from: string | null, to: string | null): Promise<WeeklyPoint[]> {
  if (!(await tableExists("leads"))) return [];

  const where: string[] = [];
  const params: string[] = [];
  if (from) { where.push("created_at >= ?"); params.push(`${from} 00:00:00`); }
  if (to) { where.push("created_at <= ?"); params.push(`${to} 23:59:59`); }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  // Decide granularidade: <= 45 dias = por dia, senão por semana
  let dias = 90;
  if (from && to) {
    dias = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1;
  } else if (from) {
    dias = Math.round((Date.now() - new Date(from).getTime()) / 86400000) + 1;
  }

  if (dias <= 45) {
    const rows = await query<{ dia: string; leads: number }>(
      `SELECT DATE_FORMAT(created_at, '%d/%m') AS dia, COUNT(*) AS leads
       FROM leads ${whereSql}
       GROUP BY DATE(created_at) ORDER BY DATE(created_at) ASC`,
      params
    );
    return rows.map((r) => ({ semana: r.dia, leads: Number(r.leads) }));
  }

  const rows = await query<{ semana: string; leads: number }>(
    `SELECT DATE_FORMAT(DATE_SUB(created_at, INTERVAL WEEKDAY(created_at) DAY), '%d/%m') AS semana,
            COUNT(*) AS leads
     FROM leads ${whereSql}
     GROUP BY semana ORDER BY MIN(created_at) ASC`,
    params
  );
  return rows.map((r) => ({ semana: r.semana, leads: Number(r.leads) }));
}

export async function getDailyTasks(): Promise<TaskItem[]> {
  const tasks: TaskItem[] = [];

  if (await tableExists("leads")) {
    const phone = await phoneExpr(); // adapta whatsapp/telefone/phone/celular
    const hasUltimoContato = await hasColumn("leads", "ultimo_contato_em");
    const contatoExpr = hasUltimoContato
      ? "COALESCE(ultimo_contato_em, created_at)"
      : "created_at";
    // Não gera follow-up automático pra leads de prospecção (frios/Maps) - só pra inbound.
    const hasOrigem = await hasColumn("leads", "origem");
    const origemFilter = hasOrigem ? "AND (origem IS NULL OR origem <> 'prospeccao')" : "";
    // Dedup: se o lead já tem tarefa manual pendente (ex: follow-up materializado), não regenera o automático.
    const hasTarefas = await tableExists("tarefas");
    const dedupFilter = hasTarefas
      ? "AND id NOT IN (SELECT lead_id FROM tarefas WHERE lead_id IS NOT NULL AND status = 'pendente')"
      : "";
    const stale = await query<{
      id: number;
      nome: string;
      empresa: string;
      whatsapp: string;
      dias: number;
    }>(
      `SELECT id, nome, empresa, ${phone},
              DATEDIFF(NOW(), ${contatoExpr}) AS dias
       FROM leads
       WHERE status IN ('novo','contatado','quente')
         ${origemFilter}
         ${dedupFilter}
         AND DATEDIFF(NOW(), ${contatoExpr}) >= 3
       ORDER BY dias DESC
       LIMIT 10`
    );
    for (const l of stale) {
      tasks.push({
        id: `lead-${l.id}`,
        titulo: `Follow-up: ${l.nome} (${l.empresa})`,
        detalhe: `${l.dias} dias sem contato`,
        prioridade: l.dias >= 7 ? "alta" : "media",
        href: `/admin/leads?id=${l.id}`,
        whatsapp: l.whatsapp,
      });
    }
  }

  if (await tableExists("agendamentos")) {
    const today = await query<{
      id: number;
      data_hora: Date;
      nome: string;
      empresa: string;
    }>(
      `SELECT a.id, a.data_hora, l.nome, l.empresa
       FROM agendamentos a
       JOIN leads l ON l.id = a.lead_id
       WHERE a.status = 'agendado'
         AND DATE(a.data_hora) BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 1 DAY)
       ORDER BY a.data_hora ASC`
    );
    for (const a of today) {
      const dt = new Date(a.data_hora);
      tasks.push({
        id: `agend-${a.id}`,
        titulo: `Diagnóstico: ${a.nome} (${a.empresa})`,
        detalhe: dt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }),
        prioridade: "alta",
        href: `/admin/leads?id=${a.id}`,
      });
    }
  }

  if (await tableExists("clientes")) {
    const expiring = await query<{
      id: number;
      empresa: string;
      fim_contrato: Date;
    }>(
      `SELECT id, empresa, fim_contrato
       FROM clientes
       WHERE status = 'ativo'
         AND fim_contrato IS NOT NULL
         AND fim_contrato BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
       ORDER BY fim_contrato ASC`
    );
    for (const c of expiring) {
      tasks.push({
        id: `cli-${c.id}`,
        titulo: `Renovar contrato: ${c.empresa}`,
        detalhe: `Vence em ${new Date(c.fim_contrato).toLocaleDateString("pt-BR")}`,
        prioridade: "alta",
        href: `/admin/clientes`,
      });
    }
  }

  const order = { alta: 0, media: 1, baixa: 2 };
  tasks.sort((a, b) => order[a.prioridade] - order[b.prioridade]);
  return tasks;
}

// ─── Tráfego & Atribuição (ROAS por canal) ──────────────────────────────────

export interface AtribuicaoCanal {
  canal: string;          // google_ads | meta_ads | tiktok_ads | outras | organico
  leads: number;
  clientes: number;
  receita: number;        // tudo que os clientes atribuídos já pagaram (transacoes)
  investimento: number;   // trafego_investimentos no período
  cpl: number | null;     // investimento / leads
  roas: number | null;    // receita / investimento
}

/**
 * Atribuição ponta a ponta: lead (fonte_trafego) → cliente (lead_id) →
 * receita (transacoes). Investimento vem de trafego_investimentos.
 * range de meses "YYYY-MM" opcional (aplica em leads criados e investimento).
 */
export async function getAtribuicao(mesDe?: string, mesAte?: string): Promise<AtribuicaoCanal[]> {
  if (!(await tableExists("leads"))) return [];
  const temInvest = await tableExists("trafego_investimentos");
  const temClientes = await tableExists("clientes");
  const temTrans = await tableExists("transacoes");

  const filtroLead: string[] = [];
  const params: string[] = [];
  if (mesDe) { filtroLead.push("DATE_FORMAT(l.created_at,'%Y-%m') >= ?"); params.push(mesDe); }
  if (mesAte) { filtroLead.push("DATE_FORMAT(l.created_at,'%Y-%m') <= ?"); params.push(mesAte); }
  const whereLead = filtroLead.length ? `WHERE ${filtroLead.join(" AND ")}` : "";

  // leads e clientes por fonte (fonte_trafego vazia = orgânico/não pago)
  const porFonte = await query<{ canal: string; leads: number; clientes: number }>(
    `SELECT COALESCE(NULLIF(l.fonte_trafego,''),'organico') AS canal,
            COUNT(*) AS leads,
            ${temClientes ? "COUNT(DISTINCT c.id)" : "0"} AS clientes
     FROM leads l
     ${temClientes ? "LEFT JOIN clientes c ON c.lead_id = l.id" : ""}
     ${whereLead}
     GROUP BY canal`,
    params
  );

  // receita dos clientes atribuídos a cada fonte (histórico completo do cliente)
  const receitaPorFonte = new Map<string, number>();
  if (temClientes && temTrans) {
    const rec = await query<{ canal: string; receita: string }>(
      `SELECT COALESCE(NULLIF(l.fonte_trafego,''),'organico') AS canal,
              COALESCE(SUM(t.valor),0) AS receita
       FROM leads l
       JOIN clientes c ON c.lead_id = l.id
       JOIN transacoes t ON t.cliente_id = c.id
       ${whereLead}
       GROUP BY canal`,
      params
    );
    for (const r of rec) receitaPorFonte.set(r.canal, Number(r.receita));
  }

  // investimento por canal no período
  const investPorCanal = new Map<string, number>();
  if (temInvest) {
    const fi: string[] = [];
    const pi: string[] = [];
    if (mesDe) { fi.push("mes >= ?"); pi.push(mesDe); }
    if (mesAte) { fi.push("mes <= ?"); pi.push(mesAte); }
    const inv = await query<{ canal: string; total: string }>(
      `SELECT canal, COALESCE(SUM(valor),0) AS total FROM trafego_investimentos
       ${fi.length ? `WHERE ${fi.join(" AND ")}` : ""} GROUP BY canal`,
      pi
    );
    for (const r of inv) investPorCanal.set(r.canal, Number(r.total));
  }

  // junta tudo (canais com investimento mas sem lead também aparecem)
  const canais = new Set<string>([...porFonte.map((f) => f.canal), ...investPorCanal.keys()]);
  const out: AtribuicaoCanal[] = [];
  for (const canal of canais) {
    const f = porFonte.find((x) => x.canal === canal);
    const leads = Number(f?.leads ?? 0);
    const clientes = Number(f?.clientes ?? 0);
    const receita = Math.round(receitaPorFonte.get(canal) ?? 0);
    const investimento = Math.round(investPorCanal.get(canal) ?? 0);
    out.push({
      canal,
      leads,
      clientes,
      receita,
      investimento,
      cpl: investimento > 0 && leads > 0 ? Math.round(investimento / leads) : null,
      roas: investimento > 0 ? Math.round((receita / investimento) * 10) / 10 : null,
    });
  }
  out.sort((a, b) => b.receita - a.receita || b.leads - a.leads);
  return out;
}
