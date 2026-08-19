export const LEAD_STATUSES = [
  "novo",
  "contatado",
  "diagnostico",
  "proposta",
  "fechado",
  "assinado",
  "perdido",
  "recusado",
  "frio",
  "quente",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  novo: "Novo",
  contatado: "Contatado",
  diagnostico: "Diagnóstico feito",
  proposta: "Proposta enviada",
  fechado: "Fechado",
  assinado: "Assinado",
  perdido: "Perdido",
  recusado: "Recusado",
  frio: "Frio",
  quente: "Quente",
};

export const PIPELINE_COLUMNS: LeadStatus[] = [
  "novo",
  "contatado",
  "diagnostico",
  "proposta",
  "fechado",
  "assinado",
];

// ─── Origem do lead (como entrou) ───────────────────────────────────────────
export const LEAD_ORIGENS = [
  "quiz",
  "prospeccao",
  "indicacao",
  "organico",
  "anuncio",
  "outro",
] as const;
export type LeadOrigem = (typeof LEAD_ORIGENS)[number];

export const LEAD_ORIGEM_LABEL: Record<LeadOrigem, string> = {
  quiz: "Quiz (site)",
  prospeccao: "Prospecção",
  indicacao: "Indicação",
  organico: "Orgânico",
  anuncio: "Anúncio",
  outro: "Outro",
};

// ─── Setores / nichos (mesmos do quiz) ──────────────────────────────────────
export const SETORES = [
  "Saúde",
  "Direito",
  "E-commerce",
  "Beleza",
  "Alimentação",
  "Hospedagem",
  "Educação",
  "Serviços técnicos",
  "Academia / Personal",
  "Imobiliária",
  "Pet",
  "Outro",
] as const;

// ─── Fonte de tráfego pago (quando origem = anúncio) ────────────────────────
export const FONTES_TRAFEGO = [
  "google_ads",
  "meta_ads",
  "tiktok_ads",
  "outras",
] as const;
export type FonteTrafego = (typeof FONTES_TRAFEGO)[number];

export const FONTE_TRAFEGO_LABEL: Record<FonteTrafego, string> = {
  google_ads: "Google Ads",
  meta_ads: "Meta Ads",
  tiktok_ads: "TikTok Ads",
  outras: "Outras",
};

/** Normaliza origem free-text legada para uma origem padrão. */
export function normalizeOrigem(raw: string | null | undefined): LeadOrigem {
  const o = (raw || "").toLowerCase().trim();
  // quiz e diagnóstico são a mesma coisa no site (rota /diagnostico = quiz)
  if (o.includes("quiz") || o.includes("diagn")) return "quiz";
  if (o.includes("prospec")) return "prospeccao";
  if (o.includes("indica")) return "indicacao";
  if (o.includes("organic") || o.includes("orgânic") || o.includes("instagram") || o.includes("site")) return "organico";
  if (o.includes("ads") || o.includes("anunc") || o.includes("anúnc") || o.includes("trafego") || o.includes("tráfego")) return "anuncio";
  if (!o) return "outro";
  return "outro";
}

export interface Lead {
  id: number;
  nome: string;
  email: string;
  whatsapp: string;
  empresa: string;
  setor: string | null;
  faturamento: string | null;
  mensagem: string | null;
  origem: string | null;
  fonte_trafego: string | null;
  site: string | null;
  endereco: string | null;
  tem_site_proprio: number | null;
  status: LeadStatus;
  notas: string | null;
  cidade: string | null;
  telefone: string | null;
  sonho: string | null;
  respostas: string | null; // JSON com as respostas do quiz do diagnóstico
  ultimo_contato_em: string | null;
  created_at: string;
  updated_at: string;
}

/** Uma resposta do quiz do diagnóstico. */
export interface RespostaQuiz {
  pergunta: string;
  resposta: string | string[];
}

export interface FollowUp {
  id: number;
  lead_id: number;
  tipo: "whatsapp" | "email" | "telefone" | "reuniao" | "outro";
  descricao: string;
  resultado: string | null;
  created_at: string;
}

export const CLIENTE_STATUSES = ["ativo", "pausado", "cancelado", "concluido"] as const;
export type ClienteStatus = (typeof CLIENTE_STATUSES)[number];

export const CLIENTE_STATUS_LABEL: Record<ClienteStatus, string> = {
  ativo: "Ativo",
  pausado: "Pausado",
  cancelado: "Cancelado",
  concluido: "Concluído",
};

export interface Cliente {
  id: number;
  lead_id: number | null;
  empresa: string;
  responsavel: string | null;
  email: string | null;
  whatsapp: string | null;
  plano: string | null;
  valor_mensal: number;
  valor_setup: number;
  inicio_contrato: string;
  fim_contrato: string | null;
  status: ClienteStatus;
  progresso: number;
  modulos: string | null;
  notas: string | null;
  created_at: string;
}
