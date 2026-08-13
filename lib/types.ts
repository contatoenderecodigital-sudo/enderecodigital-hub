import type { Papel } from "./session";

export interface Hub {
  id: string;
  nome: string;
  slug: string;
  dominio: string | null;
  versao: string;
  logo_url: string | null;
  favicon_url: string | null;
  descricao: string | null;
  login_titulo: string | null;
  login_botao: string | null;
  tema_modo: "escuro" | "claro";
  cor_destaque: string | null;
  cor_apoio: string | null;
  cor_fundo: string | null;
  cor_texto: string | null;
  tipografia: string;
  mod_site: boolean;
  mod_instagram: boolean;
  mod_financeiro: boolean;
  mod_crm: boolean;
  ativo: boolean;
  criado_em: string;
}

export interface Negocio {
  id: string;
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
  mod_site: boolean | null;
  mod_instagram: boolean | null;
  mod_financeiro: boolean | null;
  mod_crm: boolean | null;
  tipo_cliente: "recorrente" | "nao_recorrente" | "nao_definido";
  experimental: boolean;
  health_score: number;
  observacoes: string | null;
  ia_habilitada: boolean;
  ia_modo: "api_plataforma" | "claude_cliente" | "sem_ia";
  status: "ativo" | "em_configuracao" | "arquivado";
  ativo: boolean;
  criado_em: string;
}

export interface Usuario {
  id: string;
  negocio_id: string | null;
  hub_id: string | null;
  email: string;
  senha_hash: string;
  papel: Papel;
  ativo: boolean;
  criado_em: string;
}

// Modulo efetivo do cliente = override do cliente (se != null) senao o default do hub.
export interface ModulosEfetivos {
  site: boolean;
  instagram: boolean;
  financeiro: boolean;
  crm: boolean;
}

export function modulosEfetivos(n: Negocio, h: Hub): ModulosEfetivos {
  return {
    site: n.mod_site ?? h.mod_site,
    instagram: n.mod_instagram ?? h.mod_instagram,
    financeiro: n.mod_financeiro ?? h.mod_financeiro,
    crm: n.mod_crm ?? h.mod_crm,
  };
}
