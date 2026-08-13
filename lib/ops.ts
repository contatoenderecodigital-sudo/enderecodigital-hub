// GROOW OS — camada de dados da operação da agência (owner-only).
// Tabelas ops_* no Postgres do hub. Migrado do admin antigo (MySQL).
import { query } from "@/lib/db";

// ---------- tipos ----------
export interface OpsLead {
  id: number;
  nome: string;
  email: string | null;
  whatsapp: string | null;
  empresa: string | null;
  faturamento: string | null;
  setor: string | null;
  cidade: string | null;
  origem: string | null;
  fonte_trafego: string | null;
  status: string;
  notas: string | null;
  ultimo_contato_em: string | null;
  created_at: string;
}

export interface OpsCliente {
  id: number;
  empresa: string;
  responsavel: string | null;
  email: string | null;
  whatsapp: string | null;
  plano: string | null;
  valor_mensal: string | number;
  valor_setup: string | number;
  inicio_contrato: string | null;
  fim_contrato: string | null;
  status: string;
  progresso: number;
  modulos: string | null;
  notas: string | null;
  created_at: string;
}

export const LEAD_STATUS = ["novo", "contatado", "diagnostico", "proposta", "fechado", "perdido", "frio", "quente"] as const;

// ---------- LEADS ----------
export async function listOpsLeads(opts: { status?: string; q?: string } = {}): Promise<OpsLead[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.status && (LEAD_STATUS as readonly string[]).includes(opts.status)) {
    params.push(opts.status);
    where.push(`status = $${params.length}`);
  }
  if (opts.q) {
    params.push(`%${opts.q}%`);
    const i = params.length;
    where.push(`(nome ILIKE $${i} OR empresa ILIKE $${i} OR email ILIKE $${i})`);
  }
  const sql = `SELECT * FROM ops_leads ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC LIMIT 200`;
  return (await query<OpsLead>(sql, params)).rows;
}

export async function opsLeadsResumo() {
  const { rows } = await query<{ total: string; novos_mes: string; fechados: string }>(
    `SELECT
       count(*)                                              AS total,
       count(*) FILTER (WHERE created_at >= date_trunc('month', now())) AS novos_mes,
       count(*) FILTER (WHERE status = 'fechado')            AS fechados
     FROM ops_leads`
  );
  const r = rows[0] || { total: "0", novos_mes: "0", fechados: "0" };
  const total = Number(r.total);
  const fechados = Number(r.fechados);
  return {
    total,
    novos_mes: Number(r.novos_mes),
    fechados,
    conversao: total > 0 ? Math.round((fechados / total) * 100) : 0,
  };
}

export async function criarOpsLead(d: {
  nome: string; empresa?: string; whatsapp?: string; email?: string; setor?: string; origem?: string; status?: string;
}) {
  await query(
    `INSERT INTO ops_leads (nome, empresa, whatsapp, email, setor, origem, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [d.nome, d.empresa || "", d.whatsapp || "", d.email || "", d.setor || null, d.origem || "manual", d.status || "novo"]
  );
}

export async function moverOpsLeadStatus(id: number, status: string) {
  if (!(LEAD_STATUS as readonly string[]).includes(status)) return;
  await query(`UPDATE ops_leads SET status = $1, ultimo_contato_em = now() WHERE id = $2`, [status, id]);
}

export async function excluirOpsLead(id: number) {
  await query(`DELETE FROM ops_leads WHERE id = $1`, [id]);
}

// ---------- CLIENTES (carteira) ----------
export async function listOpsClientes(): Promise<OpsCliente[]> {
  return (
    await query<OpsCliente>(
      `SELECT * FROM ops_clientes ORDER BY (status = 'ativo') DESC, empresa ASC`
    )
  ).rows;
}

export async function opsCarteiraResumo() {
  const { rows } = await query<{ ativos: string; mrr: string; vencendo: string }>(
    `SELECT
       count(*) FILTER (WHERE status = 'ativo')                          AS ativos,
       COALESCE(sum(valor_mensal) FILTER (WHERE status = 'ativo'), 0)     AS mrr,
       count(*) FILTER (WHERE status = 'ativo' AND fim_contrato IS NOT NULL
                        AND fim_contrato <= (now() + interval '30 days')) AS vencendo
     FROM ops_clientes`
  );
  const r = rows[0] || { ativos: "0", mrr: "0", vencendo: "0" };
  const ativos = Number(r.ativos);
  const mrr = Number(r.mrr);
  return { ativos, mrr, vencendo: Number(r.vencendo), ticket: ativos > 0 ? mrr / ativos : 0 };
}

export async function criarOpsCliente(d: {
  empresa: string; responsavel?: string; email?: string; whatsapp?: string;
  plano?: string; valor_mensal?: number; valor_setup?: number; inicio_contrato?: string;
}) {
  await query(
    `INSERT INTO ops_clientes (empresa, responsavel, email, whatsapp, plano, valor_mensal, valor_setup, inicio_contrato, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'ativo')`,
    [d.empresa, d.responsavel || null, d.email || null, d.whatsapp || null, d.plano || null,
     d.valor_mensal || 0, d.valor_setup || 0, d.inicio_contrato || new Date().toISOString().slice(0, 10)]
  );
}

export async function setOpsClienteStatus(id: number, status: string) {
  if (!["ativo", "pausado", "cancelado", "concluido"].includes(status)) return;
  await query(`UPDATE ops_clientes SET status = $1 WHERE id = $2`, [status, id]);
}

// ---------- COBRANÇAS ----------
export interface CobrancaLinha {
  cliente_id: number;
  empresa: string;
  valor: number;
  dia_cobranca: number;
  pago: boolean;
}

export async function cobrancasMes(ym: string): Promise<{ linhas: CobrancaLinha[]; previsto: number; recebido: number }> {
  const { rows: clientes } = await query<{ id: number; empresa: string; valor_mensal: string; inicio_contrato: string | null }>(
    `SELECT id, empresa, valor_mensal, inicio_contrato FROM ops_clientes
     WHERE status = 'ativo' AND valor_mensal > 0 ORDER BY empresa`
  );
  const { rows: pagos } = await query<{ cliente_id: number }>(
    `SELECT DISTINCT cliente_id FROM ops_transacoes
     WHERE tipo = 'recorrente' AND to_char(data, 'YYYY-MM') = $1 AND cliente_id IS NOT NULL`,
    [ym]
  );
  const pagosSet = new Set(pagos.map((p) => p.cliente_id));
  let previsto = 0;
  let recebido = 0;
  const linhas: CobrancaLinha[] = clientes.map((c) => {
    const valor = Number(c.valor_mensal);
    const pago = pagosSet.has(c.id);
    previsto += valor;
    if (pago) recebido += valor;
    const dia = c.inicio_contrato ? new Date(c.inicio_contrato).getUTCDate() : 5;
    return { cliente_id: c.id, empresa: c.empresa, valor, dia_cobranca: dia, pago };
  });
  return { linhas, previsto, recebido };
}

export async function marcarPago(clienteId: number, ym: string, valor: number, descricao?: string) {
  const { rows } = await query<{ id: number }>(
    `SELECT id FROM ops_transacoes WHERE cliente_id = $1 AND tipo = 'recorrente' AND to_char(data,'YYYY-MM') = $2 LIMIT 1`,
    [clienteId, ym]
  );
  if (rows.length) return; // já pago
  await query(
    `INSERT INTO ops_transacoes (cliente_id, tipo, descricao, valor, data)
     VALUES ($1, 'recorrente', $2, $3, $4)`,
    [clienteId, descricao || `Mensalidade ${ym}`, valor, `${ym}-01`]
  );
}
