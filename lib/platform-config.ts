// Camada de dados das telas de PLATAFORMA do console (owner).
// Flags, suporte, assentos, modelos, alertas e segurança.
// O que é da operação de um hub escopa por hubOpId(); o resto é agregado da plataforma.
import "server-only";
import { query } from "@/lib/db";
import { hubOpId } from "@/lib/hub-ctx";

async function hubOrNull(): Promise<string | null> {
  return hubOpId();
}

// ---------------- FEATURE FLAGS ----------------
export interface FlagDef { chave: string; nome: string; desc: string; padrao: boolean; }
// Catálogo de flags conhecidas (a UI mostra estas; o banco guarda só o override).
export const FLAGS_CATALOGO: FlagDef[] = [
  { chave: "whatsapp", nome: "WhatsApp oficial", desc: "Atendimento pela Cloud API da Meta.", padrao: true },
  { chave: "crm", nome: "CRM / Funil", desc: "Funil de leads e captura no site.", padrao: true },
  { chave: "assistente_ia", nome: "Assistente de IA", desc: "Chat com o cérebro do cliente.", padrao: true },
  { chave: "instagram", nome: "Instagram", desc: "Perfil, métricas e gerador de posts.", padrao: false },
  { chave: "financeiro", nome: "Financeiro", desc: "Caixa, contas e metas.", padrao: false },
  { chave: "blog_seo", nome: "Blog SEO", desc: "Artigos gerados e indexados.", padrao: true },
  { chave: "disparos", nome: "Disparos WhatsApp", desc: "Campanhas com template aprovado.", padrao: false },
  { chave: "multi_dominio", nome: "Multi-hub por domínio", desc: "Várias marcas no mesmo deploy.", padrao: true },
];

export async function listFlags(): Promise<{ def: FlagDef; ligado: boolean }[]> {
  const h = await hubOrNull();
  if (!h) return FLAGS_CATALOGO.map((def) => ({ def, ligado: def.padrao }));
  const { rows } = await query<{ chave: string; ligado: boolean }>(
    `SELECT chave, ligado FROM hub_flags WHERE hub_id = $1`, [h]);
  const map = new Map(rows.map((r) => [r.chave, r.ligado]));
  return FLAGS_CATALOGO.map((def) => ({ def, ligado: map.has(def.chave) ? !!map.get(def.chave) : def.padrao }));
}

export async function setFlag(chave: string, ligado: boolean) {
  const h = await hubOrNull(); if (!h) return;
  if (!FLAGS_CATALOGO.some((f) => f.chave === chave)) return;
  await query(
    `INSERT INTO hub_flags (hub_id, chave, ligado) VALUES ($1,$2,$3)
     ON CONFLICT (hub_id, chave) DO UPDATE SET ligado = EXCLUDED.ligado, updated_at = now()`,
    [h, chave, ligado]);
}

// ---------------- SUPORTE (chamados por hub) ----------------
export interface Ticket { id: number; assunto: string; mensagem: string; prioridade: string; status: string; created_at: string; }
export async function listTickets(): Promise<Ticket[]> {
  const h = await hubOrNull(); if (!h) return [];
  return (await query<Ticket>(
    `SELECT id, assunto, mensagem, prioridade, status, created_at FROM hub_tickets
     WHERE hub_id = $1 ORDER BY (status='aberto') DESC, created_at DESC LIMIT 100`, [h])).rows;
}
export async function abrirTicket(d: { assunto: string; mensagem: string; prioridade: string }) {
  const h = await hubOrNull(); if (!h) return;
  await query(`INSERT INTO hub_tickets (hub_id, assunto, mensagem, prioridade) VALUES ($1,$2,$3,$4)`,
    [h, d.assunto, d.mensagem, ["baixa", "normal", "alta"].includes(d.prioridade) ? d.prioridade : "normal"]);
}
export async function resolverTicket(id: number) {
  const h = await hubOrNull(); if (!h) return;
  await query(`UPDATE hub_tickets SET status='resolvido', resolved_at=now() WHERE id=$1 AND hub_id=$2`, [id, h]);
}
export async function reabrirTicket(id: number) {
  const h = await hubOrNull(); if (!h) return;
  await query(`UPDATE hub_tickets SET status='aberto', resolved_at=NULL WHERE id=$1 AND hub_id=$2`, [id, h]);
}

// ---------------- ASSENTOS CLAUDE ----------------
export interface Assento { id: number; cliente: string; plano: string; token_ref: string; status: string; notas: string; created_at: string; }
export async function listAssentos(): Promise<Assento[]> {
  const h = await hubOrNull(); if (!h) return [];
  return (await query<Assento>(
    `SELECT id, cliente, plano, token_ref, status, notas, created_at FROM ia_assentos
     WHERE hub_id=$1 ORDER BY created_at DESC LIMIT 100`, [h])).rows;
}
export async function criarAssento(d: { cliente: string; plano: string; token_ref: string; notas: string }) {
  const h = await hubOrNull(); if (!h) return;
  await query(`INSERT INTO ia_assentos (hub_id, cliente, plano, token_ref, notas) VALUES ($1,$2,$3,$4,$5)`,
    [h, d.cliente, d.plano || "Pro", d.token_ref, d.notas]);
}
export async function setAssentoStatus(id: number, status: string) {
  const h = await hubOrNull(); if (!h) return;
  if (!["ativo", "reautenticar", "inativo"].includes(status)) return;
  await query(`UPDATE ia_assentos SET status=$1 WHERE id=$2 AND hub_id=$3`, [status, id, h]);
}
export async function excluirAssento(id: number) {
  const h = await hubOrNull(); if (!h) return;
  await query(`DELETE FROM ia_assentos WHERE id=$1 AND hub_id=$2`, [id, h]);
}

// ---------------- MODELOS DO HUB ----------------
export interface Modelo { id: number; tipo: string; nome: string; nicho: string; thumb_url: string; link_url: string; created_at: string; }
export async function listModelos(tipo?: string): Promise<Modelo[]> {
  const h = await hubOrNull(); if (!h) return [];
  const params: unknown[] = [h]; let extra = "";
  if (tipo && ["post", "carrossel", "story"].includes(tipo)) { params.push(tipo); extra = " AND tipo=$2"; }
  return (await query<Modelo>(
    `SELECT id, tipo, nome, nicho, thumb_url, link_url, created_at FROM hub_modelos
     WHERE hub_id=$1${extra} ORDER BY created_at DESC LIMIT 200`, params)).rows;
}
export async function modelosResumo() {
  const h = await hubOrNull(); if (!h) return { post: 0, carrossel: 0, story: 0, total: 0 };
  const { rows } = await query<{ tipo: string; n: string }>(
    `SELECT tipo, count(*) n FROM hub_modelos WHERE hub_id=$1 GROUP BY tipo`, [h]);
  const m = new Map(rows.map((r) => [r.tipo, +r.n]));
  const post = m.get("post") || 0, carrossel = m.get("carrossel") || 0, story = m.get("story") || 0;
  return { post, carrossel, story, total: post + carrossel + story };
}
export async function criarModelo(d: { tipo: string; nome: string; nicho: string; thumb_url: string; link_url: string }) {
  const h = await hubOrNull(); if (!h) return;
  await query(`INSERT INTO hub_modelos (hub_id, tipo, nome, nicho, thumb_url, link_url) VALUES ($1,$2,$3,$4,$5,$6)`,
    [h, ["post", "carrossel", "story"].includes(d.tipo) ? d.tipo : "post", d.nome, d.nicho, d.thumb_url, d.link_url]);
}
export async function excluirModelo(id: number) {
  const h = await hubOrNull(); if (!h) return;
  await query(`DELETE FROM hub_modelos WHERE id=$1 AND hub_id=$2`, [id, h]);
}

// ---------------- CONFIG DO HUB ATIVO ----------------
export interface HubConfig {
  id: string; nome: string; slug: string; dominio: string | null; descricao: string | null;
  cor_destaque: string | null; login_titulo: string | null; login_botao: string | null;
  tem_anthropic: boolean; ia_limite_mensal_usd: number;
}
export async function getHubConfig(): Promise<HubConfig | null> {
  const h = await hubOrNull(); if (!h) return null;
  const { rows } = await query<{
    id: string; nome: string; slug: string; dominio: string | null; descricao: string | null;
    cor_destaque: string | null; login_titulo: string | null; login_botao: string | null;
    anthropic_api_key: string | null; ia_limite_mensal_usd: string | null;
  }>(
    `SELECT id, nome, slug, dominio, descricao, cor_destaque, login_titulo, login_botao,
       anthropic_api_key, ia_limite_mensal_usd FROM hubs WHERE id=$1`, [h]);
  const r = rows[0]; if (!r) return null;
  return {
    id: r.id, nome: r.nome, slug: r.slug, dominio: r.dominio, descricao: r.descricao,
    cor_destaque: r.cor_destaque, login_titulo: r.login_titulo, login_botao: r.login_botao,
    tem_anthropic: !!r.anthropic_api_key, ia_limite_mensal_usd: Number(r.ia_limite_mensal_usd || 0),
  };
}
export async function salvarHubConfig(d: {
  nome: string; dominio: string | null; descricao: string | null; cor_destaque: string | null;
  login_titulo: string | null; login_botao: string | null; ia_limite_mensal_usd: number;
}) {
  const h = await hubOrNull(); if (!h) return;
  await query(
    `UPDATE hubs SET nome=$1, dominio=$2, descricao=$3, cor_destaque=$4, login_titulo=$5, login_botao=$6,
       ia_limite_mensal_usd=$7 WHERE id=$8`,
    [d.nome, d.dominio, d.descricao, d.cor_destaque, d.login_titulo, d.login_botao, d.ia_limite_mensal_usd, h]);
}

// ---------------- ALERTAS (computados de dados reais) ----------------
export interface Alerta { nivel: "erro" | "aviso" | "info"; titulo: string; detalhe: string; href?: string; }
export async function listAlertas(): Promise<Alerta[]> {
  const h = await hubOrNull(); if (!h) return [];
  const out: Alerta[] = [];

  // chave da Anthropic
  const cfg = await getHubConfig();
  if (cfg && !cfg.tem_anthropic) {
    out.push({ nivel: "aviso", titulo: "IA sem chave", detalhe: "O hub não tem chave da Anthropic — geração de conteúdo e agente ficam parados.", href: "/owner/config" });
  }

  // WhatsApp conectado?
  const { rows: wa } = await query<{ n: string }>(
    `SELECT count(*) n FROM wa_conexoes w JOIN negocios n ON n.id=w.negocio_id
     WHERE n.hub_id=$1 AND w.status='conectado'`, [h]);
  const { rows: neg } = await query<{ n: string }>(`SELECT count(*) n FROM negocios WHERE hub_id=$1 AND ativo`, [h]);
  if (+(neg[0]?.n || 0) > 0 && +(wa[0]?.n || 0) === 0) {
    out.push({ nivel: "aviso", titulo: "WhatsApp sem conexão", detalhe: "Nenhum cliente com número conectado à Cloud API neste hub.", href: "/owner/workspaces" });
  }

  // contratos vencendo (30d)
  const { rows: venc } = await query<{ n: string }>(
    `SELECT count(*) n FROM ops_clientes WHERE hub_id=$1 AND status='ativo'
       AND fim_contrato IS NOT NULL AND fim_contrato <= (now()+interval '30 days')`, [h]);
  if (+(venc[0]?.n || 0) > 0) {
    out.push({ nivel: "aviso", titulo: `${venc[0].n} contrato(s) vencendo`, detalhe: "Contratos da carteira vencem nos próximos 30 dias.", href: "/owner/ops/carteira" });
  }

  // tarefas atrasadas
  const { rows: atr } = await query<{ n: string }>(
    `SELECT count(*) n FROM ops_tarefas WHERE hub_id=$1 AND status='pendente' AND due_date IS NOT NULL AND due_date < CURRENT_DATE`, [h]);
  if (+(atr[0]?.n || 0) > 0) {
    out.push({ nivel: "erro", titulo: `${atr[0].n} tarefa(s) atrasada(s)`, detalhe: "Tarefas com prazo vencido esperando ação.", href: "/owner/ops/tarefas?status=pendente" });
  }

  // conversas não lidas
  const { rows: nl } = await query<{ n: string }>(
    `SELECT COALESCE(sum(nao_lidas),0) n FROM ops_wa_conversas WHERE hub_id=$1`, [h]);
  if (+(nl[0]?.n || 0) > 0) {
    out.push({ nivel: "info", titulo: `${nl[0].n} mensagem(ns) não lida(s)`, detalhe: "Conversas do WhatsApp aguardando leitura.", href: "/owner/ops/conversas" });
  }

  return out;
}

// ---------------- SEGURANÇA (dados reais do hub) ----------------
export async function segurancaResumo() {
  const h = await hubOrNull();
  if (!h) return { usuarios: 0, waConectados: 0, negocios: 0 };
  const { rows } = await query<{ usuarios: string; wa: string; negocios: string }>(
    `SELECT
       (SELECT count(*) FROM usuarios u JOIN negocios n ON n.id=u.negocio_id WHERE n.hub_id=$1 AND u.ativo) usuarios,
       (SELECT count(*) FROM wa_conexoes w JOIN negocios n ON n.id=w.negocio_id WHERE n.hub_id=$1 AND w.status='conectado') wa,
       (SELECT count(*) FROM negocios WHERE hub_id=$1 AND ativo) negocios`, [h]);
  const r = rows[0] || { usuarios: "0", wa: "0", negocios: "0" };
  return { usuarios: +r.usuarios, waConectados: +r.wa, negocios: +r.negocios };
}

// ---------------- AUDITORIA (busca + filtro) ----------------
export interface AuditoriaLinha { id: string; ator_usuario_id: string; acao: string; detalhe: string | null; criado_em: string; }
export async function listAuditoriaFiltrada(opts: { q?: string; desde?: string; ate?: string; limite?: number } = {}): Promise<AuditoriaLinha[]> {
  const params: unknown[] = [];
  const where: string[] = [];
  if (opts.q) { params.push(`%${opts.q}%`); const i = params.length; where.push(`(acao ILIKE $${i} OR detalhe ILIKE $${i} OR ator_usuario_id ILIKE $${i})`); }
  if (opts.desde && /^\d{4}-\d{2}-\d{2}$/.test(opts.desde)) { params.push(opts.desde); where.push(`criado_em >= $${params.length}`); }
  if (opts.ate && /^\d{4}-\d{2}-\d{2}$/.test(opts.ate)) { params.push(opts.ate); where.push(`criado_em < ($${params.length}::date + interval '1 day')`); }
  params.push(opts.limite || 200);
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return (await query<AuditoriaLinha>(
    `SELECT id, ator_usuario_id, acao, detalhe, criado_em FROM auditoria ${clause} ORDER BY criado_em DESC LIMIT $${params.length}`, params)).rows;
}

// ---------------- CONTAS CLAUDE (ações) ----------------
export async function conectarContaClaude(d: { nome: string; plano: string; tipo: string }) {
  const h = await hubOrNull();
  await query(
    `INSERT INTO contas_claude (hub_id, nome, tipo, plano, status) VALUES ($1,$2,$3,$4,'ativa')`,
    [h, d.nome, ["compartilhada", "dedicada"].includes(d.tipo) ? d.tipo : "dedicada", d.plano || null]);
}
export async function toggleContaCompartilhada(id: string) {
  await query(
    `UPDATE contas_claude SET tipo = CASE WHEN tipo='compartilhada' THEN 'dedicada' ELSE 'compartilhada' END WHERE id=$1`, [id]);
}
export async function setContaStatus(id: string, status: string) {
  if (!["ativa", "reautenticar", "inativa"].includes(status)) return;
  await query(`UPDATE contas_claude SET status=$1 WHERE id=$2`, [status, id]);
}
export async function excluirContaClaude(id: string) {
  await query(`DELETE FROM contas_claude WHERE id=$1`, [id]);
}
