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
  | "agendou"
  | "autorizou"
  | "compareceu"
  | "nao_compareceu"
  | "fechou"
  | "nao_fechou"
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
  /** quando a reuniao esta marcada; vem do webhook do Cal */
  reuniao_em: string | null;
  cal_uid: string | null;
  reuniao_link: string | null;
  desfecho_em: string | null;
  desfecho_nota: string | null;
  /** respostas do diagnostico que o parceiro preenche durante a ligacao */
  diagnostico: Record<string, string> | null;
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
    ajuda: "Você ainda não ligou para essa pessoa.",
    cor: "#7c8698",
  },
  {
    valor: "nao_atendeu",
    label: "Não atendeu",
    ajuda: "Ninguém atendeu. Ela volta para a fila de hoje.",
    cor: "#c2833a",
  },
  {
    valor: "ligou",
    label: "Em conversa",
    ajuda: "Você falou com ela e a conversa está de pé.",
    cor: "#2f6fb0",
  },
  {
    valor: "vai_chamar",
    label: "Vai chamar",
    ajuda: "Pediu para pensar ou disse que chama depois.",
    cor: "#7a5bb5",
  },
  {
    valor: "agendou",
    label: "Reunião marcada",
    ajuda:
      "Ela escolheu dia e hora no seu link. Daqui em diante quem conduz é a nossa equipe.",
    cor: "#C9A961",
  },
  {
    valor: "autorizou",
    label: "Deixou a gente chamar",
    ajuda: "Ela deixou a gente chamar no WhatsApp. Daqui em diante é com a nossa equipe.",
    cor: "#C9A961",
    terminal: true,
  },
  {
    valor: "compareceu",
    label: "Compareceu",
    ajuda: "A reunião aconteceu. Falta dizer se fechou ou não.",
    cor: "#2f6fb0",
  },
  {
    valor: "nao_compareceu",
    label: "Não compareceu",
    ajuda: "Marcou e não apareceu. Dá pra remarcar pelo próprio convite.",
    cor: "#c2833a",
  },
  {
    valor: "fechou",
    label: "Fechou",
    ajuda: "Virou cliente. A comissão nasce quando o cliente for cadastrado e pagar.",
    cor: "#1d8a3a",
    terminal: true,
  },
  {
    valor: "nao_fechou",
    label: "Não fechou",
    ajuda: "A reunião aconteceu e não deu em contrato.",
    cor: "#7c8698",
    terminal: true,
  },
  {
    valor: "recusou",
    label: "Recusou",
    ajuda: "Não quer. Pode deixar de lado.",
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

/* --------------------------------------------------- diagnostico na ligacao */

/**
 * As 7 perguntas que o parceiro faz enquanto conversa. Nao sao para o prospect
 * preencher sozinho: o formulario publico e curto de proposito, porque cada
 * campo a mais derruba agendamento. Aqui quem digita e o parceiro, entao cabe.
 *
 * As respostas vao para a coluna `diagnostico` (JSONB) em parceiro_leads. Uma
 * coluna so, e nao onze: mudar as perguntas nao pode exigir migracao nova.
 */
export const PERGUNTAS_DIAGNOSTICO: { campo: string; texto: string; ajuda?: string }[] = [
  {
    campo: "origem_clientes",
    texto: "Como chega cliente pra voces hoje?",
    ajuda: "Indicacao, Instagram, Google, passa na frente.",
  },
  {
    campo: "quem_responde_whatsapp",
    texto: "Quem responde o WhatsApp, e em quanto tempo?",
  },
  {
    campo: "mensagens_perdidas_dia",
    texto: "Num dia corrido, quantas mensagens ficam sem resposta?",
  },
  {
    campo: "tem_site",
    texto: "Tem site hoje? Ele traz cliente ou esta so pra existir?",
  },
  {
    campo: "maior_ladrao_de_tempo",
    texto: "O que mais toma o seu tempo hoje e nao devia?",
  },
  {
    campo: "prioridade_30_dias",
    texto: "Se desse pra resolver uma coisa so nos proximos 30 dias, qual seria?",
  },
  {
    campo: "outro_decisor",
    texto: "Quem decide isso junto com voce?",
    ajuda: "Se tem socio ou conjuge, a reuniao precisa dos dois.",
  },
];

/** Campo livre, e o mais importante da lista. */
export const CAMPO_PALAVRAS_DELA = {
  campo: "nas_palavras_dela",
  label: "Nas palavras dela",
  ajuda:
    "Escreva com as palavras que a pessoa usou, nao com as suas. E daqui que sai a conversa da reuniao.",
};
