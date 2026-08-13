import "server-only";
import { query } from "./db";
import type { Hub, Negocio, Usuario, Etapa, Lead } from "./types";

// ---------------- HUBS ----------------
export async function listHubs(): Promise<Hub[]> {
  return (await query<Hub>("SELECT * FROM hubs ORDER BY criado_em ASC")).rows;
}
export async function getHub(id: string): Promise<Hub | null> {
  return (await query<Hub>("SELECT * FROM hubs WHERE id = $1", [id])).rows[0] ?? null;
}
export async function createHub(input: {
  nome: string;
  slug: string;
  tema_modo: "escuro" | "claro";
  cor_destaque: string;
  cor_fundo: string;
  cor_texto: string;
  mod_site: boolean;
  mod_instagram: boolean;
  mod_financeiro: boolean;
  mod_crm: boolean;
}): Promise<Hub> {
  return (
    await query<Hub>(
      `INSERT INTO hubs
         (nome, slug, tema_modo, cor_destaque, cor_fundo, cor_texto,
          mod_site, mod_instagram, mod_financeiro, mod_crm, login_titulo, login_botao)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$1,'Entrar')
       RETURNING *`,
      [
        input.nome,
        input.slug,
        input.tema_modo,
        input.cor_destaque,
        input.cor_fundo,
        input.cor_texto,
        input.mod_site,
        input.mod_instagram,
        input.mod_financeiro,
        input.mod_crm,
      ]
    )
  ).rows[0];
}

// ---------------- NEGOCIOS (clientes) ----------------
export async function listNegocios(hubId?: string): Promise<Negocio[]> {
  if (hubId) {
    return (
      await query<Negocio>(
        "SELECT * FROM negocios WHERE hub_id = $1 ORDER BY criado_em DESC",
        [hubId]
      )
    ).rows;
  }
  return (await query<Negocio>("SELECT * FROM negocios ORDER BY criado_em DESC")).rows;
}
export async function getNegocio(id: string): Promise<Negocio | null> {
  return (await query<Negocio>("SELECT * FROM negocios WHERE id = $1", [id])).rows[0] ?? null;
}
export async function createNegocio(input: {
  hub_id: string;
  slug: string;
  nome: string;
  nome_fantasia: string | null;
  segmento: string | null;
  marca_cor: string | null;
  marca_logo: string | null;
  resp_nome: string | null;
  resp_cargo: string | null;
  resp_email: string | null;
  resp_whatsapp: string | null;
  dominio: string | null;
  site_url: string | null;
  instagram_url: string | null;
  wpp_comercial: string | null;
  mod_site: boolean;
  mod_instagram: boolean;
  mod_financeiro: boolean;
  mod_crm: boolean;
  tipo_cliente: "recorrente" | "nao_recorrente" | "nao_definido";
  experimental: boolean;
  health_score: number;
  observacoes: string | null;
  ia_modo: "api_plataforma" | "claude_cliente" | "sem_ia";
  status: "ativo" | "em_configuracao" | "arquivado";
}): Promise<Negocio> {
  return (
    await query<Negocio>(
      `INSERT INTO negocios
         (hub_id, slug, nome, nome_fantasia, segmento, marca_cor, marca_logo,
          resp_nome, resp_cargo, resp_email, resp_whatsapp,
          dominio, site_url, instagram_url, wpp_comercial,
          mod_site, mod_instagram, mod_financeiro, mod_crm,
          tipo_cliente, experimental, health_score, observacoes, ia_modo, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
       RETURNING *`,
      [
        input.hub_id,
        input.slug,
        input.nome,
        input.nome_fantasia,
        input.segmento,
        input.marca_cor,
        input.marca_logo,
        input.resp_nome,
        input.resp_cargo,
        input.resp_email,
        input.resp_whatsapp,
        input.dominio,
        input.site_url,
        input.instagram_url,
        input.wpp_comercial,
        input.mod_site,
        input.mod_instagram,
        input.mod_financeiro,
        input.mod_crm,
        input.tipo_cliente,
        input.experimental,
        input.health_score,
        input.observacoes,
        input.ia_modo,
        input.status,
      ]
    )
  ).rows[0];
}

// ---------------- USUARIOS ----------------
// Login: busca todos com este email (owner + clientes de tenants diferentes).
// A action de login compara a senha contra cada um.
export async function findUsuariosByEmail(email: string): Promise<Usuario[]> {
  return (
    await query<Usuario>(
      "SELECT * FROM usuarios WHERE lower(email) = lower($1) AND ativo = true",
      [email]
    )
  ).rows;
}

export async function criarUsuarioCliente(input: {
  negocio_id: string;
  email: string;
  senha_hash: string;
  papel: "dono" | "operador";
}): Promise<void> {
  await query(
    "INSERT INTO usuarios (negocio_id, email, senha_hash, papel) VALUES ($1,$2,$3,$4)",
    [input.negocio_id, input.email.toLowerCase(), input.senha_hash, input.papel]
  );
}

// ---------------- CONTAGENS (dashboard owner) ----------------
export async function contagens(): Promise<{
  hubs: number;
  clientes: number;
  ativos: number;
  em_config: number;
}> {
  const r = await query<{ hubs: string; clientes: string; ativos: string; em_config: string }>(
    `SELECT
       (SELECT count(*) FROM hubs)                                   AS hubs,
       (SELECT count(*) FROM negocios)                               AS clientes,
       (SELECT count(*) FROM negocios WHERE status='ativo')          AS ativos,
       (SELECT count(*) FROM negocios WHERE status='em_configuracao') AS em_config`
  );
  const row = r.rows[0];
  return {
    hubs: Number(row?.hubs ?? 0),
    clientes: Number(row?.clientes ?? 0),
    ativos: Number(row?.ativos ?? 0),
    em_config: Number(row?.em_config ?? 0),
  };
}

// ---------------- BASE DE CONHECIMENTO (o "cerebro" do tenant) ----------------
// Tratamos como UM documento por tenant (a IA le isto como contexto).
export async function getCerebro(
  negocioId: string
): Promise<{ id: string; titulo: string | null; conteudo: string } | null> {
  const r = await query<{ id: string; titulo: string | null; conteudo: string }>(
    "SELECT id, titulo, conteudo FROM base_conhecimento WHERE negocio_id = $1 ORDER BY criado_em ASC LIMIT 1",
    [negocioId]
  );
  return r.rows[0] ?? null;
}

export async function setCerebro(
  negocioId: string,
  titulo: string | null,
  conteudo: string
): Promise<void> {
  const atual = await getCerebro(negocioId);
  if (atual) {
    await query("UPDATE base_conhecimento SET titulo = $1, conteudo = $2 WHERE id = $3", [
      titulo,
      conteudo,
      atual.id,
    ]);
  } else {
    await query(
      "INSERT INTO base_conhecimento (negocio_id, titulo, conteudo) VALUES ($1,$2,$3)",
      [negocioId, titulo, conteudo]
    );
  }
}

// ---------------- CONFIG DO CLIENTE (owner) ----------------
export async function updateIdentidade(
  negocioId: string,
  input: { nome_fantasia: string | null; segmento: string | null; marca_cor: string | null }
): Promise<void> {
  await query(
    "UPDATE negocios SET nome_fantasia = $1, segmento = $2, marca_cor = $3 WHERE id = $4",
    [input.nome_fantasia, input.segmento, input.marca_cor, negocioId]
  );
}

export async function updateModulos(
  negocioId: string,
  m: { site: boolean; instagram: boolean; crm: boolean; financeiro: boolean }
): Promise<void> {
  await query(
    "UPDATE negocios SET mod_site = $1, mod_instagram = $2, mod_crm = $3, mod_financeiro = $4 WHERE id = $5",
    [m.site, m.instagram, m.crm, m.financeiro, negocioId]
  );
}

export async function updateIA(
  negocioId: string,
  input: { ia_habilitada: boolean; ia_modelo_chat: string | null; ia_limite_tokens: number }
): Promise<void> {
  await query(
    "UPDATE negocios SET ia_habilitada = $1, ia_modelo_chat = $2, ia_limite_tokens = $3 WHERE id = $4",
    [input.ia_habilitada, input.ia_modelo_chat, input.ia_limite_tokens, negocioId]
  );
}

export async function setStatusNegocio(
  negocioId: string,
  status: "ativo" | "em_configuracao" | "arquivado"
): Promise<void> {
  await query("UPDATE negocios SET status = $1 WHERE id = $2", [status, negocioId]);
}

// Reseta a senha do usuario 'dono' de um cliente (owner faz isso).
export async function resetSenhaDono(negocioId: string, senhaHash: string): Promise<boolean> {
  const dono = (
    await query<{ id: string }>(
      "SELECT id FROM usuarios WHERE negocio_id = $1 AND papel = 'dono' ORDER BY criado_em ASC LIMIT 1",
      [negocioId]
    )
  ).rows[0];
  if (!dono) return false;
  await query("UPDATE usuarios SET senha_hash = $1 WHERE id = $2", [senhaHash, dono.id]);
  return true;
}

// ---------------- USUARIO (troca de senha propria) ----------------
export async function getUsuario(id: string): Promise<Usuario | null> {
  return (await query<Usuario>("SELECT * FROM usuarios WHERE id = $1", [id])).rows[0] ?? null;
}

export async function updateSenhaUsuario(id: string, senhaHash: string): Promise<void> {
  await query("UPDATE usuarios SET senha_hash = $1 WHERE id = $2", [senhaHash, id]);
}

// ---------------- CRM: ETAPAS DO FUNIL ----------------
const ETAPAS_PADRAO = ["Novo", "Em contato", "Negociando", "Ganho", "Perdido"];

export async function ensureFunil(negocioId: string): Promise<Etapa[]> {
  const atuais = await listEtapas(negocioId);
  if (atuais.length > 0) return atuais;
  for (let i = 0; i < ETAPAS_PADRAO.length; i++) {
    await query(
      "INSERT INTO funil_etapas (negocio_id, nome, ordem) VALUES ($1,$2,$3)",
      [negocioId, ETAPAS_PADRAO[i], i]
    );
  }
  return listEtapas(negocioId);
}

export async function listEtapas(negocioId: string): Promise<Etapa[]> {
  return (
    await query<Etapa>(
      "SELECT id, negocio_id, nome, ordem FROM funil_etapas WHERE negocio_id = $1 ORDER BY ordem ASC",
      [negocioId]
    )
  ).rows;
}

// ---------------- CRM: LEADS ----------------
export async function listLeads(negocioId: string): Promise<Lead[]> {
  return (
    await query<Lead>(
      "SELECT * FROM leads WHERE negocio_id = $1 ORDER BY criado_em DESC",
      [negocioId]
    )
  ).rows;
}

export async function criarLead(input: {
  negocio_id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  origem: string | null;
  etapa_id: string | null;
}): Promise<Lead> {
  return (
    await query<Lead>(
      `INSERT INTO leads (negocio_id, nome, telefone, email, origem, etapa_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [input.negocio_id, input.nome, input.telefone, input.email, input.origem, input.etapa_id]
    )
  ).rows[0];
}

// Move um lead de etapa — SEMPRE escopado por negocio_id (nunca move de outro tenant).
export async function moverLead(
  leadId: string,
  negocioId: string,
  etapaId: string
): Promise<void> {
  await query(
    "UPDATE leads SET etapa_id = $1, atualizado_em = now() WHERE id = $2 AND negocio_id = $3",
    [etapaId, leadId, negocioId]
  );
}

export async function excluirLead(leadId: string, negocioId: string): Promise<void> {
  await query("DELETE FROM leads WHERE id = $1 AND negocio_id = $2", [leadId, negocioId]);
}

// ---------------- CRM: TOKEN DE CAPTURA (form no site) ----------------
export async function ensureCapturaToken(negocioId: string): Promise<string> {
  const r = await query<{ captura_token: string | null }>(
    "SELECT captura_token FROM negocios WHERE id = $1",
    [negocioId]
  );
  const atual = r.rows[0]?.captura_token;
  if (atual) return atual;
  const token = crypto.randomUUID().replace(/-/g, "");
  await query("UPDATE negocios SET captura_token = $1 WHERE id = $2", [token, negocioId]);
  return token;
}

// Cria lead a partir do token publico (form no site). Cai na 1a etapa.
export async function criarLeadPorToken(
  token: string,
  input: { nome: string; telefone: string | null; email: string | null; origem: string | null }
): Promise<boolean> {
  const neg = (
    await query<{ id: string }>("SELECT id FROM negocios WHERE captura_token = $1 AND ativo = true", [
      token,
    ])
  ).rows[0];
  if (!neg) return false;
  const etapas = await ensureFunil(neg.id);
  const primeira = etapas[0]?.id ?? null;
  await criarLead({
    negocio_id: neg.id,
    nome: input.nome,
    telefone: input.telefone,
    email: input.email,
    origem: input.origem || "site",
    etapa_id: primeira,
  });
  return true;
}

// ---------------- RESUMOS (owner: detalhe do cliente) ----------------
export async function leadsResumo(
  negocioId: string
): Promise<{ total: number; ganhos: number }> {
  const r = await query<{ total: string; ganhos: string }>(
    `SELECT
       count(*) AS total,
       count(*) FILTER (WHERE e.nome = 'Ganho') AS ganhos
     FROM leads l LEFT JOIN funil_etapas e ON e.id = l.etapa_id
     WHERE l.negocio_id = $1`,
    [negocioId]
  );
  return { total: Number(r.rows[0]?.total ?? 0), ganhos: Number(r.rows[0]?.ganhos ?? 0) };
}

export async function usoResumo(
  negocioId: string
): Promise<{ interacoes: number; tokens_in: number; tokens_out: number; custo_cent: number }> {
  const r = await query<{ interacoes: string; ti: string; to: string; cc: string }>(
    `SELECT count(*) AS interacoes,
            COALESCE(sum(tokens_in),0) AS ti,
            COALESCE(sum(tokens_out),0) AS to,
            COALESCE(sum(custo_cent),0) AS cc
     FROM uso_ia WHERE negocio_id = $1`,
    [negocioId]
  );
  const row = r.rows[0];
  return {
    interacoes: Number(row?.interacoes ?? 0),
    tokens_in: Number(row?.ti ?? 0),
    tokens_out: Number(row?.to ?? 0),
    custo_cent: Number(row?.cc ?? 0),
  };
}

export async function listUsuariosDoNegocio(negocioId: string): Promise<Usuario[]> {
  return (
    await query<Usuario>(
      "SELECT * FROM usuarios WHERE negocio_id = $1 ORDER BY criado_em ASC",
      [negocioId]
    )
  ).rows;
}

// ---------------- WHATSAPP (Cloud API, multi-tenant) ----------------
export interface WaConexao {
  id: string;
  negocio_id: string;
  waba_id: string;
  phone_number_id: string;
  access_token: string;
  status: string;
}

export async function getWaConexao(negocioId: string): Promise<WaConexao | null> {
  return (
    await query<WaConexao>("SELECT * FROM wa_conexoes WHERE negocio_id = $1 LIMIT 1", [negocioId])
  ).rows[0] ?? null;
}

export async function upsertWaConexao(input: {
  negocio_id: string;
  waba_id: string;
  phone_number_id: string;
  access_token: string;
}): Promise<void> {
  // phone_number_id e UNIQUE global (chave de roteamento do webhook).
  await query(
    `INSERT INTO wa_conexoes (negocio_id, waba_id, phone_number_id, access_token, status)
     VALUES ($1,$2,$3,$4,'conectado')
     ON CONFLICT (phone_number_id)
     DO UPDATE SET negocio_id = EXCLUDED.negocio_id, waba_id = EXCLUDED.waba_id,
                   access_token = EXCLUDED.access_token, status = 'conectado'`,
    [input.negocio_id, input.waba_id, input.phone_number_id, input.access_token]
  );
}

export async function removerWaConexao(negocioId: string): Promise<void> {
  await query("DELETE FROM wa_conexoes WHERE negocio_id = $1", [negocioId]);
}

// Resolve o tenant pelo phone_number_id (o webhook usa isto). Nunca "adivinha".
export async function resolverTenantPorPhoneNumberId(
  phoneNumberId: string
): Promise<{ negocio_id: string; phone_number_id: string; access_token: string } | null> {
  const c = (
    await query<WaConexao>(
      "SELECT * FROM wa_conexoes WHERE phone_number_id = $1 AND status = 'conectado' LIMIT 1",
      [phoneNumberId]
    )
  ).rows[0];
  if (!c) return null;
  return { negocio_id: c.negocio_id, phone_number_id: c.phone_number_id, access_token: c.access_token };
}

// ---------------- MENSAGENS (historico do WhatsApp / chat) ----------------
export async function registrarMensagem(
  negocioId: string,
  contato: string,
  direcao: "entrada" | "saida",
  texto: string,
  wamid: string | null
): Promise<void> {
  await query(
    "INSERT INTO mensagens (negocio_id, direcao, de_numero, texto, wamid) VALUES ($1,$2,$3,$4,$5)",
    [negocioId, direcao, contato, texto, wamid]
  );
}

// Ultimas mensagens de um contato, ja no formato de chat (entrada=user, saida=assistant).
export async function historicoRecente(
  negocioId: string,
  contato: string,
  limite = 10
): Promise<{ role: "user" | "assistant"; content: string }[]> {
  const r = await query<{ direcao: string; texto: string }>(
    `SELECT direcao, texto FROM mensagens
     WHERE negocio_id = $1 AND de_numero = $2
     ORDER BY criado_em DESC LIMIT $3`,
    [negocioId, contato, limite]
  );
  return r.rows
    .reverse()
    .map((m) => ({ role: m.direcao === "entrada" ? "user" : "assistant", content: m.texto }));
}

// ---------------- ATENDIMENTOS (inbox de conversas) ----------------
export interface ResumoConversa {
  contato: string;
  ultima: string;
  qtd: number;
  ultimo_texto: string;
}

export async function listConversas(negocioId: string): Promise<ResumoConversa[]> {
  return (
    await query<ResumoConversa>(
      `SELECT de_numero AS contato,
              max(criado_em) AS ultima,
              count(*)::int AS qtd,
              (array_agg(texto ORDER BY criado_em DESC))[1] AS ultimo_texto
       FROM mensagens WHERE negocio_id = $1
       GROUP BY de_numero ORDER BY ultima DESC`,
      [negocioId]
    )
  ).rows;
}

export async function mensagensDoContato(
  negocioId: string,
  contato: string
): Promise<{ id: string; direcao: string; texto: string; criado_em: string }[]> {
  return (
    await query<{ id: string; direcao: string; texto: string; criado_em: string }>(
      "SELECT id, direcao, texto, criado_em FROM mensagens WHERE negocio_id = $1 AND de_numero = $2 ORDER BY criado_em ASC",
      [negocioId, contato]
    )
  ).rows;
}

// ---------------- OWNER: WORKSPACES / TOKENS / CONTAS / AUDITORIA ----------------
export async function listWorkspaces(): Promise<
  (Negocio & { hub_nome: string; leads: number; interacoes: number; integracoes: number })[]
> {
  return (
    await query<Negocio & { hub_nome: string; leads: number; interacoes: number; integracoes: number }>(
      `SELECT n.*, h.nome AS hub_nome,
              (SELECT count(*)::int FROM leads l WHERE l.negocio_id = n.id) AS leads,
              (SELECT count(*)::int FROM uso_ia u WHERE u.negocio_id = n.id) AS interacoes,
              (SELECT count(*)::int FROM wa_conexoes w WHERE w.negocio_id = n.id AND w.status = 'conectado') AS integracoes
       FROM negocios n JOIN hubs h ON h.id = n.hub_id
       ORDER BY n.criado_em DESC`
    )
  ).rows;
}

export async function usoPorCliente(): Promise<
  { negocio_id: string; nome: string; interacoes: number; tokens_in: number; tokens_out: number; custo_cent: number }[]
> {
  return (
    await query<{ negocio_id: string; nome: string; interacoes: number; tokens_in: number; tokens_out: number; custo_cent: number }>(
      `SELECT n.id AS negocio_id, COALESCE(n.nome_fantasia, n.nome) AS nome,
              count(u.id)::int AS interacoes,
              COALESCE(sum(u.tokens_in),0)::bigint AS tokens_in,
              COALESCE(sum(u.tokens_out),0)::bigint AS tokens_out,
              COALESCE(sum(u.custo_cent),0)::int AS custo_cent
       FROM negocios n LEFT JOIN uso_ia u ON u.negocio_id = n.id
       GROUP BY n.id, nome ORDER BY interacoes DESC`
    )
  ).rows;
}

export async function listContasClaude(): Promise<
  { id: string; nome: string; tipo: string; plano: string | null; status: string }[]
> {
  return (
    await query<{ id: string; nome: string; tipo: string; plano: string | null; status: string }>(
      "SELECT id, nome, tipo, plano, status FROM contas_claude ORDER BY criado_em DESC"
    )
  ).rows;
}

export async function listAuditoria(
  limite = 50
): Promise<{ id: string; ator_usuario_id: string; acao: string; detalhe: string | null; criado_em: string }[]> {
  return (
    await query<{ id: string; ator_usuario_id: string; acao: string; detalhe: string | null; criado_em: string }>(
      "SELECT id, ator_usuario_id, acao, detalhe, criado_em FROM auditoria ORDER BY criado_em DESC LIMIT $1",
      [limite]
    )
  ).rows;
}

// ---------------- USO DE IA (medicao por tenant) ----------------
export async function registrarUso(
  negocioId: string,
  origem: string,
  modelo: string,
  tokensIn: number,
  tokensOut: number
): Promise<void> {
  await query(
    "INSERT INTO uso_ia (negocio_id, origem, modelo, tokens_in, tokens_out) VALUES ($1,$2,$3,$4,$5)",
    [negocioId, origem, modelo, tokensIn, tokensOut]
  );
}
