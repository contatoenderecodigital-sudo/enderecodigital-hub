import "server-only";
import { query } from "./db";
import type { Hub, Negocio, Usuario } from "./types";

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
  resp_nome: string | null;
  resp_email: string | null;
  resp_whatsapp: string | null;
  site_url: string | null;
  instagram_url: string | null;
}): Promise<Negocio> {
  return (
    await query<Negocio>(
      `INSERT INTO negocios
         (hub_id, slug, nome, nome_fantasia, segmento, marca_cor,
          resp_nome, resp_email, resp_whatsapp, site_url, instagram_url, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'em_configuracao')
       RETURNING *`,
      [
        input.hub_id,
        input.slug,
        input.nome,
        input.nome_fantasia,
        input.segmento,
        input.marca_cor,
        input.resp_nome,
        input.resp_email,
        input.resp_whatsapp,
        input.site_url,
        input.instagram_url,
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
