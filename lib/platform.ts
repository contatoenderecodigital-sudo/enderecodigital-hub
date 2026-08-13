import { query } from "@/lib/db";

// Nível 1 — PLATAFORMA: visão de TODOS os hubs ao mesmo tempo (God-view).
// NÃO escopa por hub (é o agregado). Só o owner_plataforma usa.

export interface HubResumo {
  id: string; nome: string; slug: string; cor: string | null; ativo: boolean;
  workspaces: number; leads: number; carteira: number; mrr: number; custo_ia: number; tem_ia: boolean;
}

export async function hubsComResumo(): Promise<HubResumo[]> {
  const { rows } = await query<{
    id: string; nome: string; slug: string; cor_destaque: string | null; ativo: boolean;
    anthropic_api_key: string | null; workspaces: string; leads: string; carteira: string; mrr: string; custo_ia: string;
  }>(
    `SELECT h.id, h.nome, h.slug, h.cor_destaque, h.ativo, h.anthropic_api_key,
       (SELECT count(*) FROM negocios n WHERE n.hub_id = h.id AND n.ativo) workspaces,
       (SELECT count(*) FROM ops_leads l WHERE l.hub_id = h.id) leads,
       (SELECT count(*) FROM ops_clientes c WHERE c.hub_id = h.id AND c.status='ativo') carteira,
       (SELECT COALESCE(sum(valor_mensal),0) FROM ops_clientes c WHERE c.hub_id = h.id AND c.status='ativo') mrr,
       (SELECT COALESCE(sum(custo_usd),0) FROM ops_ia_logs g WHERE g.hub_id = h.id AND g.created_at >= date_trunc('month', now())) custo_ia
     FROM hubs h ORDER BY h.criado_em ASC`
  );
  return rows.map((r) => ({
    id: r.id, nome: r.nome, slug: r.slug, cor: r.cor_destaque, ativo: r.ativo,
    workspaces: +r.workspaces, leads: +r.leads, carteira: +r.carteira, mrr: +r.mrr, custo_ia: +r.custo_ia,
    tem_ia: !!r.anthropic_api_key,
  }));
}

export async function platformTotais() {
  const hubs = await hubsComResumo();
  return {
    hubs: hubs.length,
    workspaces: hubs.reduce((a, h) => a + h.workspaces, 0),
    leads: hubs.reduce((a, h) => a + h.leads, 0),
    mrr: hubs.reduce((a, h) => a + h.mrr, 0),
    custo_ia: hubs.reduce((a, h) => a + h.custo_ia, 0),
    lista: hubs,
  };
}

// nome do hub ativo (pro cabeçalho do contexto)
export async function nomeDoHub(id: string): Promise<{ id: string; nome: string; cor: string | null } | null> {
  const { rows } = await query<{ id: string; nome: string; cor_destaque: string | null }>(
    `SELECT id, nome, cor_destaque FROM hubs WHERE id = $1`, [id]);
  const r = rows[0];
  return r ? { id: r.id, nome: r.nome, cor: r.cor_destaque } : null;
}
