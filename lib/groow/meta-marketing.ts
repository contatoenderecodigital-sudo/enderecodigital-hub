// Meta Marketing API + Instagram Graph API - custos de anúncio e orgânico do IG.
// Reusa o mesmo Graph/token do WhatsApp quando o System User tiver os escopos:
//   ads_read                     → insights da conta de anúncio
//   instagram_basic + instagram_manage_insights + pages_read_engagement → IG orgânico
// Envs:
//   META_ADS_TOKEN       opcional - se vazio, usa WHATSAPP_TOKEN
//   META_AD_ACCOUNT_ID   id da conta de anúncio (formato act_123... ou só o número)
//   META_IG_USER_ID      id do usuário IG business (não é o @, é o id numérico)

const GRAPH = () =>
  `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION || "v22.0"}`;

function token(): string | null {
  return process.env.META_ADS_TOKEN || process.env.WHATSAPP_TOKEN || null;
}

function adAccount(): string | null {
  const raw = process.env.META_AD_ACCOUNT_ID;
  if (!raw) return null;
  return raw.startsWith("act_") ? raw : `act_${raw}`;
}

export function statusIntegracoes() {
  return {
    metaAds: Boolean(token() && adAccount()),
    instagram: Boolean(token() && process.env.META_IG_USER_ID),
  };
}

async function graphGet<T>(path: string): Promise<T> {
  const t = token();
  if (!t) throw new Error("Token da Meta não configurado.");
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${GRAPH()}/${path}${sep}access_token=${encodeURIComponent(t)}`);
  const data = await res.json();
  if (!res.ok || data.error) {
    const msg: string = data?.error?.message ?? res.statusText;
    // erros comuns traduzidos pra ação clara
    if (/permission|#200|#10\b/i.test(msg)) throw new Error("PERMISSAO: o token não tem o escopo necessário (ads_read / instagram_manage_insights). Adiciona no System User do Business Manager.");
    throw new Error(`Meta API: ${msg}`);
  }
  return data as T;
}

// ── Ads: gasto mensal (alimenta trafego_investimentos) ─────────────────────
export interface SpendMes { mes: string; valor: number }

export async function getSpendMensal(mesesAtras = 3): Promise<SpendMes[]> {
  const acc = adAccount();
  if (!acc) throw new Error("META_AD_ACCOUNT_ID não configurado.");
  const ate = new Date();
  const de = new Date(ate.getFullYear(), ate.getMonth() - mesesAtras, 1);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const data = await graphGet<{ data?: { spend?: string; date_start: string }[] }>(
    `${acc}/insights?level=account&fields=spend&time_increment=monthly&time_range={"since":"${fmt(de)}","until":"${fmt(ate)}"}`
  );
  return (data.data ?? [])
    .map((r) => ({ mes: r.date_start.slice(0, 7), valor: Number(r.spend ?? 0) }))
    .filter((r) => r.valor > 0);
}

// ── Ads: campanhas dos últimos 30 dias ──────────────────────────────────────
export interface CampanhaAds {
  nome: string;
  spend: number;
  impressoes: number;
  cliques: number;
  cpc: number | null;
}

export async function getCampanhas30d(): Promise<CampanhaAds[]> {
  const acc = adAccount();
  if (!acc) throw new Error("META_AD_ACCOUNT_ID não configurado.");
  const data = await graphGet<{ data?: { campaign_name?: string; spend?: string; impressions?: string; clicks?: string; cpc?: string }[] }>(
    `${acc}/insights?level=campaign&fields=campaign_name,spend,impressions,clicks,cpc&date_preset=last_30d&limit=50`
  );
  return (data.data ?? [])
    .map((r) => ({
      nome: r.campaign_name ?? "(sem nome)",
      spend: Number(r.spend ?? 0),
      impressoes: Number(r.impressions ?? 0),
      cliques: Number(r.clicks ?? 0),
      cpc: r.cpc != null ? Number(r.cpc) : null,
    }))
    .sort((a, b) => b.spend - a.spend);
}

// ── Instagram: resumo orgânico ──────────────────────────────────────────────
export interface IgResumo {
  username: string;
  seguidores: number;
  publicacoes: number;
  alcance28d: number | null;
  posts: { legenda: string; tipo: string; likes: number; comentarios: number; quando: string; link: string }[];
}

export async function getIgResumo(): Promise<IgResumo> {
  const ig = process.env.META_IG_USER_ID;
  if (!ig) throw new Error("META_IG_USER_ID não configurado.");

  const perfil = await graphGet<{ username?: string; followers_count?: number; media_count?: number }>(
    `${ig}?fields=username,followers_count,media_count`
  );

  let alcance: number | null = null;
  try {
    const ins = await graphGet<{ data?: { values?: { value?: number }[] }[] }>(
      `${ig}/insights?metric=reach&period=days_28`
    );
    alcance = ins.data?.[0]?.values?.at(-1)?.value ?? null;
  } catch { /* conta pode não ter insights liberados ainda */ }

  const media = await graphGet<{ data?: { caption?: string; media_type?: string; like_count?: number; comments_count?: number; timestamp?: string; permalink?: string }[] }>(
    `${ig}/media?fields=caption,media_type,like_count,comments_count,timestamp,permalink&limit=6`
  );

  return {
    username: perfil.username ?? "",
    seguidores: Number(perfil.followers_count ?? 0),
    publicacoes: Number(perfil.media_count ?? 0),
    alcance28d: alcance,
    posts: (media.data ?? []).map((m) => ({
      legenda: (m.caption ?? "").slice(0, 90),
      tipo: m.media_type ?? "",
      likes: Number(m.like_count ?? 0),
      comentarios: Number(m.comments_count ?? 0),
      quando: m.timestamp ? new Date(m.timestamp).toLocaleDateString("pt-BR") : "",
      link: m.permalink ?? "",
    })),
  };
}
