// ============================================================================
// Quem pode o quê dentro da casa.
//
// Antes isto não existia: `food_equipe.papel` estava no banco com cinco valores
// e não era consultado em nenhuma decisão. Qualquer um com o link do tablet do
// garçom registrava pagamento em dinheiro, dava cortesia e fechava mesa em nome
// de quem quisesse, porque o `garcomId` vinha no corpo da requisição.
//
// Arquivo puro, sem import de runtime: é testado direto, sem banco.
// ============================================================================

export const PAPEIS = ["gerente", "garcom", "cozinha", "caixa", "entregador"] as const;
export type Papel = (typeof PAPEIS)[number];

export const ACOES = [
  "lancar_pedido",      // botar item na comanda
  "mover_item",         // fazendo, pronto, entregue
  "cancelar_pendente",  // cancelar item que a cozinha ainda não começou
  "cancelar_producao",  // cancelar item que já está na chapa: é prejuízo
  "receber_pagamento",  // dinheiro, cartão, Pix
  "cortesia",           // não cobrar
  "desconto",           // abater da conta
  "fechar_conta",       // fechar com a conta coberta
  "fechar_em_aberto",   // fechar devendo: alguém assume
  "abrir_caixa",
  "fechar_caixa",
  "sangria",
  "marcar_86",          // dizer que acabou
  "despachar",          // motoboy saiu
] as const;
export type AcaoEquipe = (typeof ACOES)[number];

/**
 * A matriz. Regra de leitura: o que mexe em dinheiro que não entrou (cortesia,
 * desconto, fechar devendo) e o prejuízo de cancelar prato pronto são do
 * gerente. O resto é da operação.
 */
const MATRIZ: Record<Papel, AcaoEquipe[]> = {
  gerente: [...ACOES],
  garcom: [
    "lancar_pedido", "mover_item", "cancelar_pendente",
    "receber_pagamento", "fechar_conta", "marcar_86",
  ],
  caixa: [
    "lancar_pedido", "receber_pagamento", "fechar_conta",
    "abrir_caixa", "fechar_caixa", "sangria",
  ],
  cozinha: ["mover_item", "cancelar_pendente", "marcar_86"],
  entregador: ["despachar"],
};

export function papelValido(v: string): v is Papel {
  return (PAPEIS as readonly string[]).includes(v);
}

export function pode(papel: string | null | undefined, acao: AcaoEquipe): boolean {
  if (!papel || !papelValido(papel)) return false;
  return MATRIZ[papel].includes(acao);
}

/** Frase para a tela, no lugar de "403". */
export function porQueNao(papel: string | null | undefined, acao: AcaoEquipe): string {
  const rotulo: Record<AcaoEquipe, string> = {
    lancar_pedido: "lançar pedido",
    mover_item: "mexer no preparo",
    cancelar_pendente: "cancelar item",
    cancelar_producao: "cancelar item que já está sendo feito",
    receber_pagamento: "receber pagamento",
    cortesia: "dar cortesia",
    desconto: "dar desconto",
    fechar_conta: "fechar a conta",
    fechar_em_aberto: "fechar conta com saldo em aberto",
    abrir_caixa: "abrir o caixa",
    fechar_caixa: "fechar o caixa",
    sangria: "fazer sangria",
    marcar_86: "marcar item como esgotado",
    despachar: "despachar entrega",
  };
  if (!papel) return `Entre com o seu PIN para ${rotulo[acao]}.`;
  return `Quem é ${papel} não pode ${rotulo[acao]}. Chame o gerente.`;
}

/** O dono e o operador do painel são donos da casa: passam em tudo. */
export const PAPEL_DONO: Papel = "gerente";
