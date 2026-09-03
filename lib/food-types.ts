// Tipos do módulo AppFood. Espelham db/migration_0003_food.sql.

export type CanalPedido = "mesa" | "balcao" | "delivery" | "whatsapp" | "marketplace";
export type StatusPedido =
  | "pendente" | "aprovado" | "em_producao" | "pronto" | "em_entrega" | "entregue" | "cancelado";
export type StatusItem = "pendente" | "em_producao" | "pronto" | "entregue" | "cancelado";
export type StatusSessao =
  | "aberta" | "conta_pedida" | "aguardando_pagamento" | "fechada" | "cancelada";
export type MetodoPagamento =
  | "dinheiro" | "debito" | "credito" | "pix" | "pix_app" | "vale" | "online" | "cortesia";

export interface FoodLoja {
  id: string;
  negocio_id: string;
  slug: string;
  nome: string;
  tipo: string;
  logo_url: string | null;
  capa_url: string | null;
  cor_destaque: string | null;
  cor_fundo: string | null;
  tema_modo: "claro" | "escuro";
  telefone: string | null;
  whatsapp: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  fuso: string;
  aceita_mesa: boolean;
  aceita_balcao: boolean;
  aceita_delivery: boolean;
  exige_aprovacao_garcom: boolean;
  limite_sessao_sem_aprov: string;
  taxa_servico_pct: string;
  taxa_servico_automatica: boolean;
  couvert: string;
  tempo_preparo_min: number;
  entrega_raio_km: string | null;
  entrega_pedido_minimo: string;
  aceita_retirada: boolean;
  pagar_no_app: boolean;
  pix_provedor: string | null;
  pix_chave: string | null;
  gorjeta_sugerida_pct: string;
  fiscal_ativo: boolean;
  fiscal_provedor: string | null;
  fiscal_cnpj: string | null;
  fiscal_ambiente: "homologacao" | "producao";
  fiscal_token_ref: string | null;
  aberto_manual: boolean | null;
  ativo: boolean;
  criado_em: string;
}

export interface FoodArea {
  id: string;
  negocio_id: string;
  loja_id: string;
  nome: string;
  cor: string | null;
  ordem: number;
  ativa: boolean;
}

export interface FoodMesa {
  id: string;
  negocio_id: string;
  loja_id: string;
  numero: string;
  apelido: string | null;
  token: string;
  capacidade: number;
  setor: string | null;
  ordem: number;
  cartao_gravado_em: string | null;
  ativa: boolean;
  criado_em: string;
}

export interface FoodCategoria {
  id: string;
  negocio_id: string;
  loja_id: string;
  nome: string;
  descricao: string | null;
  imagem_url: string | null;
  ordem: number;
  turnos: string[] | null;
  hora_inicio: string | null;
  hora_fim: string | null;
  canais: string[];
  ativa: boolean;
}

export interface FoodProduto {
  /** RDC 727/2022: o que o prato contem, ao lado do item no cardapio */
  alergenicos?: string[] | null;
  tracos?: string[] | null;
  sem_gluten?: boolean;
  sem_lactose?: boolean;
  vegetariano?: boolean;
  vegano?: boolean;
  id: string;
  negocio_id: string;
  loja_id: string;
  categoria_id: string;
  area_id: string | null;
  nome: string;
  descricao: string | null;
  imagem_url: string | null;
  preco: string;
  preco_promo: string | null;
  codigo: string | null;
  serve_pessoas: number | null;
  tempo_preparo: number | null;
  tem_variacao: boolean;
  permite_meia: boolean;
  destaque: boolean;
  ordem: number;
  canais: string[];
  unidade: string;
  esgotado: boolean;
  esgotado_ate: string | null;
  ativo: boolean;
}

export interface FoodVariacao {
  id: string;
  produto_id: string;
  nome: string;
  preco: string;
  fatias: number | null;
  ordem: number;
  ativa: boolean;
}

export interface FoodGrupoOpcao {
  id: string;
  produto_id: string;
  nome: string;
  minimo: number;
  maximo: number;
  obrigatorio: boolean;
  tipo_preco: "soma" | "maior" | "media";
  ordem: number;
}

export interface FoodOpcao {
  id: string;
  grupo_id: string;
  nome: string;
  preco_extra: string;
  esgotado: boolean;
  ordem: number;
  ativa: boolean;
}

// Cardápio já montado para a tela pública.
export interface CardapioProduto extends FoodProduto {
  variacoes: FoodVariacao[];
  grupos: (FoodGrupoOpcao & { opcoes: FoodOpcao[] })[];
}
export interface CardapioCategoria extends FoodCategoria {
  produtos: CardapioProduto[];
}

export interface FoodSessao {
  id: string;
  negocio_id: string;
  loja_id: string;
  mesa_id: string;
  codigo: string;
  status: StatusSessao;
  pessoas: number;
  garcom_id: string | null;
  subtotal: string;
  taxa_servico: string;
  couvert_total: string;
  desconto: string;
  total: string;
  pago: string;
  aberta_em: string;
  conta_pedida_em: string | null;
  fechada_em: string | null;
  /** a taxa de servico e voluntaria (Lei 13.419/2017) */
  servico_recusado?: boolean;
  desconto_motivo?: string | null;
  desconto_por?: string | null;
}

export interface FoodItem {
  id: string;
  pedido_id: string;
  produto_id: string | null;
  variacao_id: string | null;
  area_id: string | null;
  nome_snapshot: string;
  qtd: string;
  preco_unit: string;
  preco_total: string;
  opcoes_json: { grupo: string; nome: string; preco: number }[] | null;
  meia_json: { nome: string }[] | null;
  obs: string | null;
  /** alergia ou restricao do cliente, destacada na cozinha */
  restricao?: string | null;
  membro_id: string | null;
  status: StatusItem;
  criado_em: string;
}

export interface FoodPedido {
  id: string;
  negocio_id: string;
  loja_id: string;
  numero_dia: number;
  dia: string;
  canal: CanalPedido;
  sessao_id: string | null;
  mesa_id: string | null;
  cliente_id: string | null;
  garcom_id: string | null;
  status: StatusPedido;
  obs: string | null;
  subtotal: string;
  taxa_entrega: string;
  desconto: string;
  total: string;
  criado_em: string;
  aprovado_em: string | null;
  pronto_em: string | null;
  entregue_em: string | null;
  pago_em: string | null;
}

export interface PedidoComItens extends FoodPedido {
  itens: FoodItem[];
  mesa_numero?: string | null;
}

// Entrada de pedido vinda do cliente. Preço NUNCA vem daqui: o servidor busca no banco.
export interface ItemEntrada {
  produto_id: string;
  variacao_id?: string | null;
  qtd: number;
  opcoes?: string[];        // ids de food_opcoes
  meia?: string[];          // ids de produtos (pizza meia a meia)
  obs?: string | null;
  /** alergia ou restricao. Vai destacada no cartao da cozinha. */
  restricao?: string | null;
}

export interface FoodImpressora {
  id: string;
  negocio_id: string;
  loja_id: string;
  area_id: string | null;
  nome: string;
  tipo: "cloudprnt" | "agente" | "navegador";
  chave: string;
  colunas: number;
  vias: number;
  imprime: string[];
  ultimo_ping: string | null;
  ativa: boolean;
}

export interface MesaNoMapa extends FoodMesa {
  sessao_id: string | null;
  sessao_status: StatusSessao | null;
  aberta_em: string | null;
  total: string | null;
  itens_pendentes: number;
  chamado_aberto: boolean;
}
