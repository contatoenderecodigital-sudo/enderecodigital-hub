import "server-only";

// Camada de dados da tela "Tokens & IA" do hub (owner).
// - Config multi-provedor por workspace: mora em workspace_ia_config (tabela do HUB),
//   porque negocios não tem colunas de provedor/apelido-de-chave/trava. Ao salvar,
//   também ESPELHA modelo+limite nas colunas negocios.ia_modelo_chat / ia_limite_tokens,
//   que o painel do próprio hub lê — assim a troca TEM efeito nos tenants do hub.
// - Consumo: vem de uso_ia (tokens reais medidos por chamada), escopado por hub.
//
// Propagar para o schema de um cliente EXTERNO (ex: docepao.negocios.config jsonb) exige
// grant de escrita + tabela de mapeamento hub->tenant — fica documentado como fase 2.

import { query } from "@/lib/db";
import { hubOpId } from "@/lib/hub-ctx";
import { DEFAULT_MODELO, DEFAULT_PROVEDOR, provedorDoModelo, type ProvedorIA } from "./precos-ia";

const PROVEDORES_OK: ProvedorIA[] = ["openai", "gemini", "claude"];
function normProvedor(v: string | null | undefined): ProvedorIA {
  const s = (v || "").toLowerCase();
  return (PROVEDORES_OK as string[]).includes(s) ? (s as ProvedorIA) : DEFAULT_PROVEDOR;
}
function toInt(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

// Cria as tabelas do hub se não existirem (idempotente). Assim a tela e o "salvar"
// funcionam mesmo antes do owner rodar a migração no VPS. Se o role não puder criar,
// cai no catch e a tela renderiza com os defaults.
let _ensured = false;
async function ensureTabelas() {
  if (_ensured) return;
  await query(`
    CREATE TABLE IF NOT EXISTS workspace_ia_config (
      hub_id        UUID        NOT NULL,
      negocio_id    UUID        NOT NULL PRIMARY KEY,
      provedor      TEXT        NOT NULL DEFAULT 'openai',
      modelo        TEXT        NOT NULL DEFAULT 'gpt-4o-mini',
      limite_tokens BIGINT      NOT NULL DEFAULT 0,
      travado       BOOLEAN     NOT NULL DEFAULT FALSE,
      chave_ref     TEXT        NULL,
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  await query(`CREATE INDEX IF NOT EXISTS idx_wia_hub ON workspace_ia_config (hub_id)`);
  await query(`
    CREATE TABLE IF NOT EXISTS hub_ia_config (
      hub_id        UUID        NOT NULL PRIMARY KEY,
      limite_tokens BIGINT      NOT NULL DEFAULT 0,
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  _ensured = true;
}

export interface WorkspaceIA {
  id: string;
  nome: string;
  slug: string;
  provedor: ProvedorIA;
  modelo: string;
  limite_tokens: number; // 0 = ilimitado
  travado: boolean;
  chave_ref: string | null;
  tokens_in: number;
  tokens_out: number;
  interacoes: number;
  custo_cent_real: number; // de uso_ia (faturamento real)
}

interface WsRow {
  id: string;
  nome: string;
  slug: string;
  ia_modelo_chat: string | null;
  ia_limite_tokens: string | null;
  provedor: string | null;
  modelo: string | null;
  limite_tokens: string | null;
  travado: boolean | null;
  chave_ref: string | null;
  tokens_in: string | null;
  tokens_out: string | null;
  interacoes: string | null;
  custo_cent_real: string | null;
}

export async function listWorkspacesIA(): Promise<WorkspaceIA[]> {
  const hub = await hubOpId();
  if (!hub) return [];
  try {
    await ensureTabelas();
  } catch {
    /* sem privilégio de CREATE — segue com defaults */
  }
  let rows: WsRow[] = [];
  try {
    rows = (
      await query<WsRow>(
        `SELECT n.id, COALESCE(n.nome_fantasia, n.nome) AS nome, n.slug,
                n.ia_modelo_chat, n.ia_limite_tokens,
                c.provedor, c.modelo, c.limite_tokens, c.travado, c.chave_ref,
                u.tin AS tokens_in, u.tout AS tokens_out, u.inter AS interacoes, u.cc AS custo_cent_real
         FROM negocios n
         LEFT JOIN workspace_ia_config c ON c.negocio_id = n.id
         LEFT JOIN (
           SELECT negocio_id,
                  sum(tokens_in)  AS tin,
                  sum(tokens_out) AS tout,
                  count(*)        AS inter,
                  sum(custo_cent) AS cc
           FROM uso_ia GROUP BY negocio_id
         ) u ON u.negocio_id = n.id
         WHERE n.hub_id = $1
         ORDER BY (COALESCE(u.tin,0) + COALESCE(u.tout,0)) DESC, n.criado_em DESC`,
        [hub]
      )
    ).rows;
  } catch {
    // fallback sem a tabela de config (migração ainda não aplicada e sem CREATE)
    rows = (
      await query<WsRow>(
        `SELECT n.id, COALESCE(n.nome_fantasia, n.nome) AS nome, n.slug,
                n.ia_modelo_chat, n.ia_limite_tokens,
                NULL::text AS provedor, NULL::text AS modelo, NULL::bigint AS limite_tokens,
                FALSE AS travado, NULL::text AS chave_ref,
                u.tin AS tokens_in, u.tout AS tokens_out, u.inter AS interacoes, u.cc AS custo_cent_real
         FROM negocios n
         LEFT JOIN (
           SELECT negocio_id, sum(tokens_in) AS tin, sum(tokens_out) AS tout,
                  count(*) AS inter, sum(custo_cent) AS cc
           FROM uso_ia GROUP BY negocio_id
         ) u ON u.negocio_id = n.id
         WHERE n.hub_id = $1
         ORDER BY (COALESCE(u.tin,0) + COALESCE(u.tout,0)) DESC, n.criado_em DESC`,
        [hub]
      )
    ).rows;
  }
  return rows.map((r) => {
    const modelo = r.modelo || r.ia_modelo_chat || DEFAULT_MODELO;
    return {
      id: r.id,
      nome: r.nome,
      slug: r.slug,
      provedor: r.provedor ? normProvedor(r.provedor) : provedorDoModelo(modelo),
      modelo,
      limite_tokens: toInt(r.limite_tokens ?? r.ia_limite_tokens),
      travado: !!r.travado,
      chave_ref: r.chave_ref,
      tokens_in: toInt(r.tokens_in),
      tokens_out: toInt(r.tokens_out),
      interacoes: toInt(r.interacoes),
      custo_cent_real: toInt(r.custo_cent_real),
    };
  });
}

export interface UsoModelo {
  modelo: string;
  provedor: ProvedorIA;
  tokens_in: number;
  tokens_out: number;
  interacoes: number;
  custo_cent_real: number;
}

// Breakdown do hub por MODELO (fonte: uso_ia, escopo hub).
export async function usoPorModeloHub(): Promise<UsoModelo[]> {
  const hub = await hubOpId();
  if (!hub) return [];
  const { rows } = await query<{ modelo: string; tin: string; tout: string; inter: string; cc: string }>(
    `SELECT u.modelo,
            sum(u.tokens_in)  AS tin,
            sum(u.tokens_out) AS tout,
            count(*)          AS inter,
            sum(u.custo_cent) AS cc
     FROM uso_ia u JOIN negocios n ON n.id = u.negocio_id
     WHERE n.hub_id = $1
     GROUP BY u.modelo
     ORDER BY (sum(u.tokens_in) + sum(u.tokens_out)) DESC`,
    [hub]
  );
  return rows.map((r) => ({
    modelo: r.modelo,
    provedor: provedorDoModelo(r.modelo),
    tokens_in: toInt(r.tin),
    tokens_out: toInt(r.tout),
    interacoes: toInt(r.inter),
    custo_cent_real: toInt(r.cc),
  }));
}

// Limite GLOBAL de tokens do hub (0 = ilimitado).
export async function getHubLimiteTokens(): Promise<number> {
  const hub = await hubOpId();
  if (!hub) return 0;
  try {
    await ensureTabelas();
    const { rows } = await query<{ l: string }>(`SELECT limite_tokens l FROM hub_ia_config WHERE hub_id = $1`, [hub]);
    return toInt(rows[0]?.l);
  } catch {
    return 0;
  }
}

// ---------------- ESCRITAS ----------------

async function espelharNoNegocio(negocioId: string, hub: string, modelo: string, limite: number | null) {
  // Escreve nas colunas que o painel do próprio hub lê. Escopo hub_id = só tenants deste hub.
  if (limite === null) {
    await query(`UPDATE negocios SET ia_modelo_chat = $1 WHERE id = $2 AND hub_id = $3`, [modelo, negocioId, hub]);
  } else {
    await query(`UPDATE negocios SET ia_modelo_chat = $1, ia_limite_tokens = $2 WHERE id = $3 AND hub_id = $4`, [
      modelo,
      limite,
      negocioId,
      hub,
    ]);
  }
}

export async function salvarWorkspaceIA(
  negocioId: string,
  d: { provedor: ProvedorIA; modelo: string; limite_tokens: number; travado: boolean; chave_ref: string | null }
) {
  const hub = await hubOpId();
  if (!hub || !negocioId) return;
  await ensureTabelas();
  const provedor = normProvedor(d.provedor);
  const limite = toInt(d.limite_tokens);
  await query(
    `INSERT INTO workspace_ia_config (hub_id, negocio_id, provedor, modelo, limite_tokens, travado, chave_ref, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7, now())
     ON CONFLICT (negocio_id) DO UPDATE SET
       provedor = EXCLUDED.provedor, modelo = EXCLUDED.modelo, limite_tokens = EXCLUDED.limite_tokens,
       travado = EXCLUDED.travado, chave_ref = EXCLUDED.chave_ref, updated_at = now()`,
    [hub, negocioId, provedor, d.modelo, limite, d.travado, d.chave_ref]
  );
  await espelharNoNegocio(negocioId, hub, d.modelo, limite);
}

// Troca rápida de provedor+modelo (preserva limite/trava/apelido).
export async function trocarModeloWorkspace(negocioId: string, provedor: ProvedorIA, modelo: string) {
  const hub = await hubOpId();
  if (!hub || !negocioId) return;
  await ensureTabelas();
  await query(
    `INSERT INTO workspace_ia_config (hub_id, negocio_id, provedor, modelo, updated_at)
     VALUES ($1,$2,$3,$4, now())
     ON CONFLICT (negocio_id) DO UPDATE SET
       provedor = EXCLUDED.provedor, modelo = EXCLUDED.modelo, updated_at = now()`,
    [hub, negocioId, normProvedor(provedor), modelo]
  );
  await espelharNoNegocio(negocioId, hub, modelo, null);
}

// Trava/destrava o teto do cliente.
export async function toggleTravaWorkspace(negocioId: string) {
  const hub = await hubOpId();
  if (!hub || !negocioId) return;
  await ensureTabelas();
  await query(
    `INSERT INTO workspace_ia_config (hub_id, negocio_id, travado, updated_at)
     VALUES ($1,$2, TRUE, now())
     ON CONFLICT (negocio_id) DO UPDATE SET travado = NOT workspace_ia_config.travado, updated_at = now()`,
    [hub, negocioId]
  );
}

export async function salvarLimiteHub(limite_tokens: number) {
  const hub = await hubOpId();
  if (!hub) return;
  await ensureTabelas();
  await query(
    `INSERT INTO hub_ia_config (hub_id, limite_tokens, updated_at) VALUES ($1,$2, now())
     ON CONFLICT (hub_id) DO UPDATE SET limite_tokens = EXCLUDED.limite_tokens, updated_at = now()`,
    [hub, toInt(limite_tokens)]
  );
}
