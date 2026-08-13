// GROOW OS — camada de dados da operação, ESCOPADA POR HUB.
// Cada hub tem clientes/leads/carteira/etc. isolados (hub_id).
// Toda função resolve o hub ativo (cookie) e filtra por ele.
import { query } from "@/lib/db";
import { hubOpId } from "@/lib/hub-ctx";
import { cifrar, decifrar } from "@/lib/cofre";

async function hub(): Promise<string> {
  const h = await hubOpId();
  if (!h) throw new Error("Nenhum hub selecionado.");
  return h;
}
async function hubOrNull(): Promise<string | null> {
  return hubOpId();
}

// ---------- tipos ----------
export interface OpsLead {
  id: number; nome: string; email: string | null; whatsapp: string | null; empresa: string | null;
  faturamento: string | null; setor: string | null; cidade: string | null; origem: string | null;
  fonte_trafego: string | null; status: string; notas: string | null; ultimo_contato_em: string | null; created_at: string;
}
export interface OpsCliente {
  id: number; empresa: string; responsavel: string | null; email: string | null; whatsapp: string | null;
  plano: string | null; valor_mensal: string | number; valor_setup: string | number;
  inicio_contrato: string | null; fim_contrato: string | null; status: string; progresso: number;
  modulos: string | null; notas: string | null; created_at: string;
}
export const LEAD_STATUS = ["novo", "contatado", "diagnostico", "proposta", "fechado", "perdido", "frio", "quente"] as const;

// ---------- LEADS ----------
export async function listOpsLeads(opts: { status?: string; q?: string } = {}): Promise<OpsLead[]> {
  const h = await hubOrNull(); if (!h) return [];
  const params: unknown[] = [h];
  const where: string[] = [`hub_id = $1`];
  if (opts.status && (LEAD_STATUS as readonly string[]).includes(opts.status)) {
    params.push(opts.status); where.push(`status = $${params.length}`);
  }
  if (opts.q) {
    params.push(`%${opts.q}%`); const i = params.length;
    where.push(`(nome ILIKE $${i} OR empresa ILIKE $${i} OR email ILIKE $${i})`);
  }
  return (await query<OpsLead>(`SELECT * FROM ops_leads WHERE ${where.join(" AND ")} ORDER BY created_at DESC LIMIT 200`, params)).rows;
}

export async function opsLeadsResumo() {
  const h = await hubOrNull(); if (!h) return { total: 0, novos_mes: 0, fechados: 0, conversao: 0 };
  const { rows } = await query<{ total: string; novos_mes: string; fechados: string }>(
    `SELECT count(*) total,
       count(*) FILTER (WHERE created_at >= date_trunc('month', now())) novos_mes,
       count(*) FILTER (WHERE status='fechado') fechados
     FROM ops_leads WHERE hub_id = $1`, [h]);
  const r = rows[0] || { total: "0", novos_mes: "0", fechados: "0" };
  const total = +r.total, fechados = +r.fechados;
  return { total, novos_mes: +r.novos_mes, fechados, conversao: total ? Math.round((fechados / total) * 100) : 0 };
}

export async function criarOpsLead(d: { nome: string; empresa?: string; whatsapp?: string; email?: string; setor?: string; origem?: string; status?: string }) {
  const h = await hub();
  await query(
    `INSERT INTO ops_leads (hub_id, nome, empresa, whatsapp, email, setor, origem, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [h, d.nome, d.empresa || "", d.whatsapp || "", d.email || "", d.setor || null, d.origem || "manual", d.status || "novo"]);
}
export async function moverOpsLeadStatus(id: number, status: string) {
  if (!(LEAD_STATUS as readonly string[]).includes(status)) return;
  const h = await hub();
  await query(`UPDATE ops_leads SET status=$1, ultimo_contato_em=now() WHERE id=$2 AND hub_id=$3`, [status, id, h]);
}
export async function excluirOpsLead(id: number) {
  const h = await hub();
  await query(`DELETE FROM ops_leads WHERE id=$1 AND hub_id=$2`, [id, h]);
}

// ---------- CLIENTES (carteira) ----------
export async function listOpsClientes(): Promise<OpsCliente[]> {
  const h = await hubOrNull(); if (!h) return [];
  return (await query<OpsCliente>(`SELECT * FROM ops_clientes WHERE hub_id=$1 ORDER BY (status='ativo') DESC, empresa ASC`, [h])).rows;
}
export async function opsCarteiraResumo() {
  const h = await hubOrNull(); if (!h) return { ativos: 0, mrr: 0, vencendo: 0, ticket: 0 };
  const { rows } = await query<{ ativos: string; mrr: string; vencendo: string }>(
    `SELECT count(*) FILTER (WHERE status='ativo') ativos,
       COALESCE(sum(valor_mensal) FILTER (WHERE status='ativo'),0) mrr,
       count(*) FILTER (WHERE status='ativo' AND fim_contrato IS NOT NULL AND fim_contrato <= (now()+interval '30 days')) vencendo
     FROM ops_clientes WHERE hub_id=$1`, [h]);
  const r = rows[0] || { ativos: "0", mrr: "0", vencendo: "0" };
  const ativos = +r.ativos, mrr = +r.mrr;
  return { ativos, mrr, vencendo: +r.vencendo, ticket: ativos ? mrr / ativos : 0 };
}
export async function criarOpsCliente(d: { empresa: string; responsavel?: string; email?: string; whatsapp?: string; plano?: string; valor_mensal?: number; valor_setup?: number; inicio_contrato?: string }) {
  const h = await hub();
  await query(
    `INSERT INTO ops_clientes (hub_id, empresa, responsavel, email, whatsapp, plano, valor_mensal, valor_setup, inicio_contrato, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'ativo')`,
    [h, d.empresa, d.responsavel || null, d.email || null, d.whatsapp || null, d.plano || null, d.valor_mensal || 0, d.valor_setup || 0, d.inicio_contrato || new Date().toISOString().slice(0, 10)]);
}
export async function setOpsClienteStatus(id: number, status: string) {
  if (!["ativo", "pausado", "cancelado", "concluido"].includes(status)) return;
  const h = await hub();
  await query(`UPDATE ops_clientes SET status=$1 WHERE id=$2 AND hub_id=$3`, [status, id, h]);
}

// ---------- COBRANÇAS ----------
export interface CobrancaLinha { cliente_id: number; empresa: string; valor: number; dia_cobranca: number; pago: boolean; }
export async function cobrancasMes(ym: string): Promise<{ linhas: CobrancaLinha[]; previsto: number; recebido: number }> {
  const h = await hubOrNull(); if (!h) return { linhas: [], previsto: 0, recebido: 0 };
  const { rows: clientes } = await query<{ id: number; empresa: string; valor_mensal: string; inicio_contrato: string | null }>(
    `SELECT id, empresa, valor_mensal, inicio_contrato FROM ops_clientes WHERE hub_id=$1 AND status='ativo' AND valor_mensal>0 ORDER BY empresa`, [h]);
  const { rows: pagos } = await query<{ cliente_id: number }>(
    `SELECT DISTINCT cliente_id FROM ops_transacoes WHERE hub_id=$1 AND tipo='recorrente' AND to_char(data,'YYYY-MM')=$2 AND cliente_id IS NOT NULL`, [h, ym]);
  const pagosSet = new Set(pagos.map((p) => p.cliente_id));
  let previsto = 0, recebido = 0;
  const linhas: CobrancaLinha[] = clientes.map((c) => {
    const valor = +c.valor_mensal, pago = pagosSet.has(c.id);
    previsto += valor; if (pago) recebido += valor;
    const dia = c.inicio_contrato ? new Date(c.inicio_contrato).getUTCDate() : 5;
    return { cliente_id: c.id, empresa: c.empresa, valor, dia_cobranca: dia, pago };
  });
  return { linhas, previsto, recebido };
}
export async function marcarPago(clienteId: number, ym: string, valor: number, descricao?: string) {
  const h = await hub();
  const { rows } = await query<{ id: number }>(
    `SELECT id FROM ops_transacoes WHERE hub_id=$1 AND cliente_id=$2 AND tipo='recorrente' AND to_char(data,'YYYY-MM')=$3 LIMIT 1`, [h, clienteId, ym]);
  if (rows.length) return;
  await query(`INSERT INTO ops_transacoes (hub_id, cliente_id, tipo, descricao, valor, data) VALUES ($1,$2,'recorrente',$3,$4,$5)`,
    [h, clienteId, descricao || `Mensalidade ${ym}`, valor, `${ym}-01`]);
}

// ---------- TAREFAS ----------
export interface OpsTarefa { id: number; titulo: string; descricao: string | null; lead_id: number | null; cliente_id: number | null; prioridade: string; status: string; due_date: string | null; feita_em: string | null; created_at: string; }
export async function listOpsTarefas(status?: string): Promise<OpsTarefa[]> {
  const h = await hubOrNull(); if (!h) return [];
  const params: unknown[] = [h]; let extra = "";
  if (status === "pendente" || status === "feita") { params.push(status); extra = ` AND status=$2`; }
  return (await query<OpsTarefa>(
    `SELECT * FROM ops_tarefas WHERE hub_id=$1${extra}
     ORDER BY (status='pendente') DESC, CASE prioridade WHEN 'alta' THEN 0 WHEN 'media' THEN 1 ELSE 2 END, due_date NULLS LAST, created_at DESC LIMIT 300`, params)).rows;
}
export async function tarefasResumo() {
  const h = await hubOrNull(); if (!h) return { pendentes: 0, feitas: 0, atrasadas: 0, alta: 0 };
  const { rows } = await query<{ pendentes: string; feitas: string; atrasadas: string; alta: string }>(
    `SELECT count(*) FILTER (WHERE status='pendente') pendentes,
       count(*) FILTER (WHERE status='feita') feitas,
       count(*) FILTER (WHERE status='pendente' AND due_date IS NOT NULL AND due_date < CURRENT_DATE) atrasadas,
       count(*) FILTER (WHERE status='pendente' AND prioridade='alta') alta
     FROM ops_tarefas WHERE hub_id=$1`, [h]);
  const r = rows[0] || { pendentes: "0", feitas: "0", atrasadas: "0", alta: "0" };
  return { pendentes: +r.pendentes, feitas: +r.feitas, atrasadas: +r.atrasadas, alta: +r.alta };
}
export async function criarOpsTarefa(d: { titulo: string; prioridade?: string; due_date?: string }) {
  const h = await hub();
  await query(`INSERT INTO ops_tarefas (hub_id, titulo, prioridade, status, due_date) VALUES ($1,$2,$3,'pendente',$4)`, [h, d.titulo, d.prioridade || "media", d.due_date || null]);
}
export async function toggleOpsTarefa(id: number) {
  const h = await hub();
  await query(`UPDATE ops_tarefas SET status=CASE WHEN status='feita' THEN 'pendente' ELSE 'feita' END, feita_em=CASE WHEN status='feita' THEN NULL ELSE now() END WHERE id=$1 AND hub_id=$2`, [id, h]);
}
export async function excluirOpsTarefa(id: number) {
  const h = await hub();
  await query(`DELETE FROM ops_tarefas WHERE id=$1 AND hub_id=$2`, [id, h]);
}

// ---------- FUNIL / PIPELINE ----------
export async function funilResumo() {
  const h = await hubOrNull();
  const vazio = { total: 0, fechados: 0, perdidos: 0, conversao: 0, etapas: [] as { status: string; n: number }[], porOrigem: [] as { origem: string; n: number; fechados: number }[] };
  if (!h) return vazio;
  const ordem = ["novo", "contatado", "diagnostico", "proposta", "fechado"];
  const { rows: porStatus } = await query<{ status: string; n: string }>(`SELECT status, count(*) n FROM ops_leads WHERE hub_id=$1 GROUP BY status`, [h]);
  const mapS = new Map(porStatus.map((r) => [r.status, +r.n]));
  const total = porStatus.reduce((a, r) => a + +r.n, 0);
  const { rows: porOrigem } = await query<{ origem: string | null; n: string; fechados: string }>(
    `SELECT origem, count(*) n, count(*) FILTER (WHERE status='fechado') fechados FROM ops_leads WHERE hub_id=$1 GROUP BY origem ORDER BY count(*) DESC`, [h]);
  return {
    total, fechados: mapS.get("fechado") || 0, perdidos: mapS.get("perdido") || 0,
    conversao: total ? Math.round(((mapS.get("fechado") || 0) / total) * 100) : 0,
    etapas: ordem.map((s) => ({ status: s, n: mapS.get(s) || 0 })),
    porOrigem: porOrigem.map((o) => ({ origem: o.origem || "—", n: +o.n, fechados: +o.fechados })),
  };
}
export async function pipelinePorEtapa() {
  const h = await hubOrNull(); if (!h) return [];
  return (await query<{ id: number; nome: string; empresa: string | null; whatsapp: string | null; status: string; origem: string | null }>(
    `SELECT id, nome, empresa, whatsapp, status, origem FROM ops_leads WHERE hub_id=$1 AND status NOT IN ('perdido') ORDER BY created_at DESC LIMIT 300`, [h])).rows;
}

// ---------- TRÁFEGO / ROAS ----------
export async function trafegoResumo() {
  const h = await hubOrNull(); if (!h) return { linhas: [] as { canal: string; investido: number; leads: number; fechados: number; cpl: number }[], totalInvest: 0, totalLeads: 0 };
  const { rows: leadsPorFonte } = await query<{ fonte: string | null; leads: string; fechados: string }>(
    `SELECT fonte_trafego fonte, count(*) leads, count(*) FILTER (WHERE status='fechado') fechados FROM ops_leads WHERE hub_id=$1 GROUP BY fonte_trafego`, [h]);
  const { rows: invest } = await query<{ canal: string; total: string }>(
    `SELECT canal, COALESCE(sum(valor),0) total FROM ops_trafego_investimentos WHERE hub_id=$1 GROUP BY canal`, [h]);
  const investMap = new Map(invest.map((i) => [i.canal, +i.total]));
  const canais = new Set<string>([...leadsPorFonte.map((l) => l.fonte || "direto"), ...invest.map((i) => i.canal)]);
  const linhas = [...canais].map((canal) => {
    const lf = leadsPorFonte.find((l) => (l.fonte || "direto") === canal);
    const investido = investMap.get(canal) || 0, leads = lf ? +lf.leads : 0, fechados = lf ? +lf.fechados : 0;
    return { canal, investido, leads, fechados, cpl: leads ? investido / leads : 0 };
  }).sort((a, b) => b.leads - a.leads);
  return { linhas, totalInvest: linhas.reduce((a, l) => a + l.investido, 0), totalLeads: linhas.reduce((a, l) => a + l.leads, 0) };
}
export async function registrarInvestimento(canal: string, mes: string, valor: number) {
  const h = await hub();
  await query(
    `INSERT INTO ops_trafego_investimentos (hub_id, canal, mes, valor) VALUES ($1,$2,$3,$4)
     ON CONFLICT (canal, mes) DO UPDATE SET valor=EXCLUDED.valor, updated_at=now()`, [h, canal, mes, valor]);
}

// ---------- BLOG ----------
export interface BlogPost { id: number; slug: string; titulo: string; resumo: string; keyword_foco: string; categoria: string; status: string; origem: string; created_at: string; published_at: string | null; }
export async function listBlogPosts(status?: string): Promise<BlogPost[]> {
  const h = await hubOrNull(); if (!h) return [];
  const ok = ["rascunho", "aprovado", "publicado", "arquivado"];
  const params: unknown[] = [h]; let extra = "";
  if (status && ok.includes(status)) { params.push(status); extra = ` AND status=$2`; }
  return (await query<BlogPost>(`SELECT id, slug, titulo, resumo, keyword_foco, categoria, status, origem, created_at, published_at FROM ops_blog_posts WHERE hub_id=$1${extra} ORDER BY created_at DESC LIMIT 200`, params)).rows;
}
export async function blogResumo() {
  const h = await hubOrNull(); if (!h) return { total: 0, publicados: 0, rascunhos: 0 };
  const { rows } = await query<{ total: string; publicados: string; rascunhos: string }>(
    `SELECT count(*) total, count(*) FILTER (WHERE status='publicado') publicados, count(*) FILTER (WHERE status='rascunho') rascunhos FROM ops_blog_posts WHERE hub_id=$1`, [h]);
  const r = rows[0] || { total: "0", publicados: "0", rascunhos: "0" };
  return { total: +r.total, publicados: +r.publicados, rascunhos: +r.rascunhos };
}
export async function setBlogStatus(id: number, status: string) {
  const ok = ["rascunho", "aprovado", "publicado", "arquivado"]; if (!ok.includes(status)) return;
  const h = await hub();
  const pub = status === "publicado" ? ", published_at=COALESCE(published_at, now())" : "";
  await query(`UPDATE ops_blog_posts SET status=$1 ${pub} WHERE id=$2 AND hub_id=$3`, [status, id, h]);
}

// ---------- SOCIAL ----------
export interface SocialIdeia { id: number; pilar: string; tipo: string; hook: string; descricao: string | null; formato: string; status: string; created_at: string; }
export interface SocialConteudo { id: number; ideia_id: number | null; tipo: string; titulo: string; legenda: string | null; hashtags: string | null; status: string; created_at: string; }
export async function listSocialIdeias(): Promise<SocialIdeia[]> {
  const h = await hubOrNull(); if (!h) return [];
  return (await query<SocialIdeia>(`SELECT * FROM ops_social_ideias WHERE hub_id=$1 AND status<>'descartada' ORDER BY (status='nova') DESC, created_at DESC LIMIT 120`, [h])).rows;
}
export async function listSocialConteudos(): Promise<SocialConteudo[]> {
  const h = await hubOrNull(); if (!h) return [];
  return (await query<SocialConteudo>(`SELECT id, ideia_id, tipo, titulo, legenda, hashtags, status, created_at FROM ops_social_conteudos WHERE hub_id=$1 ORDER BY created_at DESC LIMIT 60`, [h])).rows;
}
export async function socialResumo() {
  const h = await hubOrNull(); if (!h) return { ideias: 0, conteudos: 0, publicados: 0 };
  const { rows } = await query<{ ideias: string; conteudos: string; publicados: string }>(
    `SELECT (SELECT count(*) FROM ops_social_ideias WHERE hub_id=$1 AND status<>'descartada') ideias,
            (SELECT count(*) FROM ops_social_conteudos WHERE hub_id=$1) conteudos,
            (SELECT count(*) FROM ops_social_conteudos WHERE hub_id=$1 AND status='publicado') publicados`, [h]);
  const r = rows[0] || { ideias: "0", conteudos: "0", publicados: "0" };
  return { ideias: +r.ideias, conteudos: +r.conteudos, publicados: +r.publicados };
}
export async function descartarIdeia(id: number) {
  const h = await hub();
  await query(`UPDATE ops_social_ideias SET status='descartada' WHERE id=$1 AND hub_id=$2`, [id, h]);
}
export async function setConteudoStatus(id: number, status: string) {
  if (!["rascunho", "aprovado", "publicado"].includes(status)) return;
  const h = await hub();
  await query(`UPDATE ops_social_conteudos SET status=$1 WHERE id=$2 AND hub_id=$3`, [status, id, h]);
}

// ---------- IA & CUSTOS ----------
export async function iaResumo() {
  const h = await hubOrNull();
  const vazio = { chamadas: 0, custoMes: 0, custoHoje: 0, tokens: 0, porModulo: [] as { modulo: string; custo: number; chamadas: number }[], ultimas: [] as { modulo: string | null; acao: string | null; modelo: string | null; custo_usd: string; input_tokens: number; output_tokens: number; status: string | null; created_at: string }[] };
  if (!h) return vazio;
  const { rows: k } = await query<{ chamadas: string; custo_mes: string; custo_hoje: string; tokens: string }>(
    `SELECT count(*) chamadas,
       COALESCE(sum(custo_usd) FILTER (WHERE created_at >= date_trunc('month', now())),0) custo_mes,
       COALESCE(sum(custo_usd) FILTER (WHERE created_at >= CURRENT_DATE),0) custo_hoje,
       COALESCE(sum(input_tokens+output_tokens),0) tokens
     FROM ops_ia_logs WHERE hub_id=$1`, [h]);
  const { rows: porModulo } = await query<{ modulo: string | null; custo: string; chamadas: string }>(
    `SELECT modulo, COALESCE(sum(custo_usd),0) custo, count(*) chamadas FROM ops_ia_logs WHERE hub_id=$1 AND created_at >= now()-interval '30 days' GROUP BY modulo ORDER BY sum(custo_usd) DESC NULLS LAST`, [h]);
  const { rows: ultimas } = await query<{ modulo: string | null; acao: string | null; modelo: string | null; custo_usd: string; input_tokens: number; output_tokens: number; status: string | null; created_at: string }>(
    `SELECT modulo, acao, modelo, custo_usd, input_tokens, output_tokens, status, created_at FROM ops_ia_logs WHERE hub_id=$1 ORDER BY created_at DESC LIMIT 40`, [h]);
  const r = k[0] || { chamadas: "0", custo_mes: "0", custo_hoje: "0", tokens: "0" };
  return { chamadas: +r.chamadas, custoMes: +r.custo_mes, custoHoje: +r.custo_hoje, tokens: +r.tokens, porModulo: porModulo.map((m) => ({ modulo: m.modulo || "—", custo: +m.custo, chamadas: +m.chamadas })), ultimas };
}

// ---------- CARDÁPIOS / RELATÓRIOS ----------
export async function listCardapios() {
  const h = await hubOrNull(); if (!h) return [];
  return (await query<{ id: number; cliente: string; slug: string | null; total_itens: number; selecionados: string | null; observacoes: string | null; lida: boolean; created_at: string }>(
    `SELECT * FROM ops_cardapio_respostas WHERE hub_id=$1 ORDER BY created_at DESC LIMIT 100`, [h])).rows;
}
export async function listRelatorios() {
  const h = await hubOrNull(); if (!h) return [];
  return (await query<{ id: number; cliente: string; periodo: string; token: string; created_at: string; updated_at: string }>(
    `SELECT id, cliente, periodo, token, created_at, updated_at FROM ops_relatorios WHERE hub_id=$1 ORDER BY created_at DESC LIMIT 100`, [h])).rows;
}

// ---------- APROVAÇÕES ----------
export async function aprovacoesPendentes() {
  const h = await hubOrNull();
  if (!h) return { blog: [] as { id: number; titulo: string; keyword_foco: string }[], social: [] as { id: number; titulo: string; tipo: string }[], campanhas: [] as { id: number; nome: string; total: string }[] };
  const { rows: blog } = await query<{ id: number; titulo: string; keyword_foco: string }>(`SELECT id, titulo, keyword_foco FROM ops_blog_posts WHERE hub_id=$1 AND status='rascunho' ORDER BY created_at DESC LIMIT 50`, [h]);
  const { rows: social } = await query<{ id: number; titulo: string; tipo: string }>(`SELECT id, titulo, tipo FROM ops_social_conteudos WHERE hub_id=$1 AND status='rascunho' ORDER BY created_at DESC LIMIT 50`, [h]);
  const { rows: campanhas } = await query<{ id: number; nome: string; total: string }>(
    `SELECT c.id, c.nome, (SELECT count(*) FROM ops_wa_campanha_destinatarios d WHERE d.campanha_id=c.id) total FROM ops_wa_campanhas c WHERE c.hub_id=$1 AND c.status IN ('rascunho','agendada') ORDER BY c.created_at DESC LIMIT 50`, [h]);
  return { blog, social, campanhas };
}

// ---------- CONVERSAS ----------
export interface OpsConversa { id: number; whatsapp: string; nome: string | null; status: string; nao_lidas: number; ultima_mensagem: string | null; ultima_mensagem_em: string | null; }
export async function listOpsConversas(): Promise<OpsConversa[]> {
  const h = await hubOrNull(); if (!h) return [];
  return (await query<OpsConversa>(`SELECT id, whatsapp, nome, status, nao_lidas, ultima_mensagem, ultima_mensagem_em FROM ops_wa_conversas WHERE hub_id=$1 ORDER BY ultima_mensagem_em DESC NULLS LAST LIMIT 100`, [h])).rows;
}
export async function mensagensDaConversa(id: number) {
  const h = await hubOrNull(); if (!h) return [];
  const { rows: ok } = await query<{ id: number }>(`SELECT id FROM ops_wa_conversas WHERE id=$1 AND hub_id=$2`, [id, h]);
  if (!ok.length) return [];
  return (await query<{ origem: string; tipo: string; texto: string | null; created_at: string }>(
    `SELECT origem, tipo, texto, created_at FROM ops_wa_mensagens WHERE conversa_id=$1 ORDER BY created_at ASC LIMIT 500`, [id])).rows;
}
export async function conversasResumo() {
  const h = await hubOrNull(); if (!h) return { total: 0, naoLidas: 0, ia: 0 };
  const { rows } = await query<{ total: string; nao_lidas: string; ia: string }>(
    `SELECT count(*) total, COALESCE(sum(nao_lidas),0) nao_lidas, count(*) FILTER (WHERE status='ai_active') ia FROM ops_wa_conversas WHERE hub_id=$1`, [h]);
  const r = rows[0] || { total: "0", nao_lidas: "0", ia: "0" };
  return { total: +r.total, naoLidas: +r.nao_lidas, ia: +r.ia };
}

// ---------- DISPAROS ----------
export async function listCampanhas() {
  const h = await hubOrNull(); if (!h) return [];
  return (await query<{ id: number; nome: string; template_nome: string; status: string; cap_dia: number; total: string; enviados: string }>(
    `SELECT c.id, c.nome, c.template_nome, c.status, c.cap_dia,
       (SELECT count(*) FROM ops_wa_campanha_destinatarios d WHERE d.campanha_id=c.id) total,
       (SELECT count(*) FROM ops_wa_campanha_destinatarios d WHERE d.campanha_id=c.id AND d.status IN ('enviado','entregue','lido','respondeu')) enviados
     FROM ops_wa_campanhas c WHERE c.hub_id=$1 ORDER BY c.created_at DESC LIMIT 100`, [h])).rows;
}
export async function optoutTotal() {
  const h = await hubOrNull(); if (!h) return 0;
  const { rows } = await query<{ n: string }>(`SELECT count(*) n FROM ops_wa_optout WHERE hub_id=$1`, [h]);
  return +(rows[0]?.n || 0);
}

// ---------- COFRE DE SENHAS ----------
export interface SenhaMeta { id: number; cliente: string; servico: string; url: string; usuario: string; notas: string; }
export async function listSenhas(): Promise<SenhaMeta[]> {
  const h = await hubOrNull(); if (!h) return [];
  return (await query<SenhaMeta>(`SELECT id, cliente, servico, url, usuario, notas FROM ops_senhas_cofre WHERE hub_id=$1 ORDER BY cliente, servico LIMIT 500`, [h])).rows;
}
export async function addSenha(d: { cliente?: string; servico: string; url?: string; usuario?: string; senha: string; notas?: string }) {
  const h = await hub();
  await query(`INSERT INTO ops_senhas_cofre (hub_id, cliente, servico, url, usuario, segredo, notas) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [h, d.cliente || "", d.servico, d.url || "", d.usuario || "", cifrar(d.senha), d.notas || ""]);
}
export async function revelarSenha(id: number): Promise<string | null> {
  const h = await hub();
  const { rows } = await query<{ segredo: string }>(`SELECT segredo FROM ops_senhas_cofre WHERE id=$1 AND hub_id=$2`, [id, h]);
  if (!rows[0]) return null;
  try { return decifrar(rows[0].segredo); } catch { return null; }
}
export async function excluirSenha(id: number) {
  const h = await hub();
  await query(`DELETE FROM ops_senhas_cofre WHERE id=$1 AND hub_id=$2`, [id, h]);
}
