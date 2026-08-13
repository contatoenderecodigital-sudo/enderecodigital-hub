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

// ---------- TAREFAS ----------
export interface OpsTarefa {
  id: number;
  titulo: string;
  descricao: string | null;
  lead_id: number | null;
  cliente_id: number | null;
  prioridade: string;
  status: string;
  due_date: string | null;
  feita_em: string | null;
  created_at: string;
}

export async function listOpsTarefas(status?: string): Promise<OpsTarefa[]> {
  const where = status === "pendente" || status === "feita" ? `WHERE status = $1` : "";
  const params = where ? [status] : [];
  return (
    await query<OpsTarefa>(
      `SELECT * FROM ops_tarefas ${where}
       ORDER BY (status='pendente') DESC,
                CASE prioridade WHEN 'alta' THEN 0 WHEN 'media' THEN 1 ELSE 2 END,
                due_date NULLS LAST, created_at DESC
       LIMIT 300`,
      params
    )
  ).rows;
}

export async function tarefasResumo() {
  const { rows } = await query<{ pendentes: string; feitas: string; atrasadas: string; alta: string }>(
    `SELECT
       count(*) FILTER (WHERE status='pendente')                                        AS pendentes,
       count(*) FILTER (WHERE status='feita')                                           AS feitas,
       count(*) FILTER (WHERE status='pendente' AND due_date IS NOT NULL AND due_date < CURRENT_DATE) AS atrasadas,
       count(*) FILTER (WHERE status='pendente' AND prioridade='alta')                  AS alta
     FROM ops_tarefas`
  );
  const r = rows[0] || { pendentes: "0", feitas: "0", atrasadas: "0", alta: "0" };
  return { pendentes: +r.pendentes, feitas: +r.feitas, atrasadas: +r.atrasadas, alta: +r.alta };
}

export async function criarOpsTarefa(d: { titulo: string; prioridade?: string; due_date?: string }) {
  await query(
    `INSERT INTO ops_tarefas (titulo, prioridade, status, due_date) VALUES ($1,$2,'pendente',$3)`,
    [d.titulo, d.prioridade || "media", d.due_date || null]
  );
}
export async function toggleOpsTarefa(id: number) {
  await query(
    `UPDATE ops_tarefas SET status = CASE WHEN status='feita' THEN 'pendente' ELSE 'feita' END,
       feita_em = CASE WHEN status='feita' THEN NULL ELSE now() END
     WHERE id = $1`,
    [id]
  );
}
export async function excluirOpsTarefa(id: number) {
  await query(`DELETE FROM ops_tarefas WHERE id = $1`, [id]);
}

// ---------- FUNIL (leads por etapa/origem) ----------
export async function funilResumo() {
  const ordem = ["novo", "contatado", "diagnostico", "proposta", "fechado"];
  const { rows: porStatus } = await query<{ status: string; n: string }>(
    `SELECT status, count(*) n FROM ops_leads GROUP BY status`
  );
  const mapS = new Map(porStatus.map((r) => [r.status, +r.n]));
  const total = porStatus.reduce((a, r) => a + +r.n, 0);
  const etapas = ordem.map((s) => ({ status: s, n: mapS.get(s) || 0 }));
  const fechados = mapS.get("fechado") || 0;
  const perdidos = mapS.get("perdido") || 0;

  const { rows: porOrigem } = await query<{ origem: string | null; n: string; fechados: string }>(
    `SELECT origem, count(*) n, count(*) FILTER (WHERE status='fechado') fechados
     FROM ops_leads GROUP BY origem ORDER BY count(*) DESC`
  );
  return {
    total,
    fechados,
    perdidos,
    conversao: total > 0 ? Math.round((fechados / total) * 100) : 0,
    etapas,
    porOrigem: porOrigem.map((o) => ({ origem: o.origem || "—", n: +o.n, fechados: +o.fechados })),
  };
}

// ---------- TRÁFEGO / ROAS ----------
export async function trafegoResumo() {
  // leads por fonte de tráfego + investimento por canal + receita atribuída (clientes vindos de leads)
  const { rows: leadsPorFonte } = await query<{ fonte: string | null; leads: string; fechados: string }>(
    `SELECT fonte_trafego fonte, count(*) leads, count(*) FILTER (WHERE status='fechado') fechados
     FROM ops_leads GROUP BY fonte_trafego`
  );
  const { rows: invest } = await query<{ canal: string; total: string }>(
    `SELECT canal, COALESCE(sum(valor),0) total FROM ops_trafego_investimentos GROUP BY canal`
  );
  const investMap = new Map(invest.map((i) => [i.canal, +i.total]));
  const canais = new Set<string>([...leadsPorFonte.map((l) => l.fonte || "direto"), ...invest.map((i) => i.canal)]);
  const linhas = [...canais].map((canal) => {
    const lf = leadsPorFonte.find((l) => (l.fonte || "direto") === canal);
    const investido = investMap.get(canal) || 0;
    const leads = lf ? +lf.leads : 0;
    const fechados = lf ? +lf.fechados : 0;
    return { canal, investido, leads, fechados, cpl: leads > 0 ? investido / leads : 0 };
  }).sort((a, b) => b.leads - a.leads);
  const totalInvest = linhas.reduce((a, l) => a + l.investido, 0);
  const totalLeads = linhas.reduce((a, l) => a + l.leads, 0);
  return { linhas, totalInvest, totalLeads };
}

export async function registrarInvestimento(canal: string, mes: string, valor: number) {
  await query(
    `INSERT INTO ops_trafego_investimentos (canal, mes, valor) VALUES ($1,$2,$3)
     ON CONFLICT (canal, mes) DO UPDATE SET valor = EXCLUDED.valor, updated_at = now()`,
    [canal, mes, valor]
  );
}

// ---------- BLOG ----------
export interface BlogPost {
  id: number; slug: string; titulo: string; resumo: string; keyword_foco: string;
  categoria: string; status: string; origem: string; created_at: string; published_at: string | null;
}
export async function listBlogPosts(status?: string): Promise<BlogPost[]> {
  const ok = ["rascunho", "aprovado", "publicado", "arquivado"];
  const where = status && ok.includes(status) ? `WHERE status = $1` : "";
  const params = where ? [status] : [];
  return (await query<BlogPost>(
    `SELECT id, slug, titulo, resumo, keyword_foco, categoria, status, origem, created_at, published_at
     FROM ops_blog_posts ${where} ORDER BY created_at DESC LIMIT 200`, params)).rows;
}
export async function blogResumo() {
  const { rows } = await query<{ total: string; publicados: string; rascunhos: string }>(
    `SELECT count(*) total,
       count(*) FILTER (WHERE status='publicado') publicados,
       count(*) FILTER (WHERE status='rascunho') rascunhos FROM ops_blog_posts`);
  const r = rows[0] || { total: "0", publicados: "0", rascunhos: "0" };
  return { total: +r.total, publicados: +r.publicados, rascunhos: +r.rascunhos };
}
export async function setBlogStatus(id: number, status: string) {
  const ok = ["rascunho", "aprovado", "publicado", "arquivado"];
  if (!ok.includes(status)) return;
  const pub = status === "publicado" ? ", published_at = COALESCE(published_at, now())" : "";
  await query(`UPDATE ops_blog_posts SET status = $1 ${pub} WHERE id = $2`, [status, id]);
}

// ---------- SOCIAL ----------
export interface SocialIdeia {
  id: number; pilar: string; tipo: string; hook: string; descricao: string | null;
  formato: string; status: string; created_at: string;
}
export interface SocialConteudo {
  id: number; ideia_id: number | null; tipo: string; titulo: string; legenda: string | null;
  hashtags: string | null; status: string; created_at: string;
}
export async function listSocialIdeias(): Promise<SocialIdeia[]> {
  return (await query<SocialIdeia>(
    `SELECT * FROM ops_social_ideias WHERE status <> 'descartada' ORDER BY (status='nova') DESC, created_at DESC LIMIT 120`)).rows;
}
export async function listSocialConteudos(): Promise<SocialConteudo[]> {
  return (await query<SocialConteudo>(
    `SELECT id, ideia_id, tipo, titulo, legenda, hashtags, status, created_at FROM ops_social_conteudos ORDER BY created_at DESC LIMIT 60`)).rows;
}
export async function socialResumo() {
  const { rows } = await query<{ ideias: string; conteudos: string; publicados: string }>(
    `SELECT (SELECT count(*) FROM ops_social_ideias WHERE status<>'descartada') ideias,
            (SELECT count(*) FROM ops_social_conteudos) conteudos,
            (SELECT count(*) FROM ops_social_conteudos WHERE status='publicado') publicados`);
  const r = rows[0] || { ideias: "0", conteudos: "0", publicados: "0" };
  return { ideias: +r.ideias, conteudos: +r.conteudos, publicados: +r.publicados };
}
export async function descartarIdeia(id: number) {
  await query(`UPDATE ops_social_ideias SET status='descartada' WHERE id = $1`, [id]);
}
