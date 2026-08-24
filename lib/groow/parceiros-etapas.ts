/**
 * Tipos e constantes do programa de parceiros, sem nenhuma dependência de banco.
 *
 * Mora fora de parceiros.ts de propósito: aquele arquivo importa `pg`, e um
 * componente cliente que importasse ETAPAS de lá arrastaria o driver do
 * Postgres para dentro do bundle do navegador. O build quebra com
 * "Can't resolve 'util/types'" quando isso acontece.
 */

export type ParceiroStatus = "ativo" | "pausado";
export type SituacaoLead =
  | "a_ligar"
  | "nao_atendeu"
  | "ligou"
  | "vai_chamar"
  | "autorizou"
  | "recusou";
export type ResultadoCall =
  | "atendeu"
  | "nao_atendeu"
  | "caixa_postal"
  | "numero_errado"
  | "ocupado";
export type DisparoStatus = "pendente" | "enviado" | "falhou" | "respondeu";
export type TipoComissao = "setup" | "recorrente" | "ajuste" | "fixa";
export type StatusComissao = "previsto" | "aprovado" | "pago" | "cancelado";

export interface Parceiro {
  id: number;
  nome: string;
  email: string;
  telefone: string | null;
  codigo: string;
  comissao_setup_pct: number;
  comissao_mensal_pct: number;
  comissao_meses: number;
  /** Valor fixo por venda fechada. Quando > 0, manda e os percentuais são ignorados. */
  comissao_fixa: number;
  status: ParceiroStatus;
  criado_em: string;
}

export interface ParceiroLead {
  id: number;
  parceiro_id: number;
  lead_id: number | null;
  nome: string;
  empresa: string | null;
  telefone: string;
  email: string | null;
  cidade: string | null;
  setor: string | null;
  situacao: SituacaoLead;
  optin: number;
  optin_em: string | null;
  optin_origem: string | null;
  optin_prova: string | null;
  disparo_status: DisparoStatus;
  disparo_em: string | null;
  observacao: string | null;
  tentativas: number;
  ultima_tentativa: string | null;
  proximo_retorno: string | null;
  criado_em: string;
  atualizado_em: string;
  /** vem do JOIN com `leads` quando já foi promovido */
  lead_status?: string | null;
  /** contagem de gravações, vem do JOIN com `parceiro_calls` */
  gravacoes?: number;
}

export interface ParceiroCall {
  id: number;
  parceiro_id: number;
  parceiro_lead_id: number | null;
  resultado: ResultadoCall;
  duracao_seg: number;
  anotacao: string | null;
  transcricao: string | null;
  resumo: string | null;
  audio_path: string | null;
  audio_mime: string | null;
  audio_bytes: number;
  criado_em: string;
}

export interface Comissao {
  id: number;
  parceiro_id: number;
  cliente_id: number | null;
  lead_id: number | null;
  tipo: TipoComissao;
  competencia: string;
  base_valor: number;
  percentual: number;
  valor: number;
  status: StatusComissao;
  pago_em: string | null;
  observacao: string | null;
  criado_em: string;
  /** vem do JOIN com `clientes` */
  empresa?: string | null;
}

/**
 * As colunas do kanban, na ordem em que a call fria anda de verdade. É a mesma
 * lista usada pelo painel do parceiro e pelo meu, para os dois nunca divergirem.
 *
 * `terminal` marca a coluna de onde o lead não sai sozinho: recusou é fim de
 * linha, autorizou espera o disparo do template.
 */
export const ETAPAS: {
  valor: SituacaoLead;
  label: string;
  ajuda: string;
  cor: string;
  terminal?: boolean;
}[] = [
  {
    valor: "a_ligar",
    label: "A ligar",
    ajuda: "Cadastrado, ainda não recebeu ligação.",
    cor: "#7c8698",
  },
  {
    valor: "nao_atendeu",
    label: "Não atendeu",
    ajuda: "Tentou e não falou com ninguém. Volta para a fila.",
    cor: "#c2833a",
  },
  {
    valor: "ligou",
    label: "Em conversa",
    ajuda: "Falou com a pessoa e a conversa está de pé.",
    cor: "#2f6fb0",
  },
  {
    valor: "vai_chamar",
    label: "Vai chamar",
    ajuda: "Pediu para pensar ou disse que chama depois.",
    cor: "#7a5bb5",
  },
  {
    valor: "autorizou",
    label: "Autorizou contato",
    ajuda: "Deu o opt-in. Pronto para o disparo do template.",
    cor: "#C9A961",
    terminal: true,
  },
  {
    valor: "recusou",
    label: "Recusou",
    ajuda: "Disse não. Fim de linha.",
    cor: "#b0505a",
    terminal: true,
  },
];

export const ETAPA_POR_VALOR = new Map(ETAPAS.map((e) => [e.valor, e]));

/** Compatibilidade: o modal antigo importa SITUACOES. */
export const SITUACOES = ETAPAS;

export const RESULTADOS_CALL: { valor: ResultadoCall; label: string; etapa: SituacaoLead }[] = [
  { valor: "atendeu", label: "Atendeu e conversamos", etapa: "ligou" },
  { valor: "nao_atendeu", label: "Não atendeu", etapa: "nao_atendeu" },
  { valor: "caixa_postal", label: "Caiu na caixa postal", etapa: "nao_atendeu" },
  { valor: "ocupado", label: "Ocupado", etapa: "nao_atendeu" },
  { valor: "numero_errado", label: "Número errado", etapa: "recusou" },
];

export interface PainelParceiro {
  cliques: number;
  leads: number;
  autorizados: number;
  promovidos: number;
  clientes: number;
  comissao: ResumoComissao;
}

export interface ResumoComissao {
  previsto: number;
  aprovado: number;
  pago: number;
}

export interface ResultadoApuracao {
  competencia: string;
  criadas: number;
  atualizadas: number;
  clientesAvaliados: number;
}

export interface EntradaLead {
  nome: string;
  empresa?: string | null;
  telefone: string;
  email?: string | null;
  cidade?: string | null;
  setor?: string | null;
  situacao?: SituacaoLead;
  optin?: boolean;
  optin_origem?: string | null;
  optin_prova?: string | null;
  observacao?: string | null;
}
