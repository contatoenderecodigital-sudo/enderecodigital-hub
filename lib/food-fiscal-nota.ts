// ============================================================================
// A NOTA em si: como a comanda vira um payload de NFC-e.
//
// Este arquivo é PURO de propósito. Sem banco, sem rede, sem import de runtime.
// A parte que erra em nota fiscal não é o HTTP, é o conteúdo: CFOP trocado,
// CSOSN que não bate com o regime, total do item que não fecha com o total da
// nota, forma de pagamento fora da tabela da SEFAZ. Tudo isso se testa aqui,
// sem chamar ninguém.
//
// O formato é o do Focus NFe, que é o integrador escolhido: cobra por CNPJ e
// não por nota, e a API é assíncrona, que é o que permite a venda não esperar
// a SEFAZ responder.
// ============================================================================

export class ErroFiscal extends Error {
  codigo = "FISCAL";
  constructor(codigo: string, mensagem: string) {
    super(mensagem);
    this.name = "ErroFiscal";
    this.codigo = codigo;
  }
}

export interface EmitenteNota {
  cnpj: string;
  razao?: string | null;
  ie?: string | null;
  uf?: string | null;
  municipio?: string | null;
  cep?: string | null;
  regime: string;              // simples | simples_excesso | normal
  csosnPadrao: string;
  cstPadrao?: string | null;
  cfopPadrao: string;
  ncmPadrao: string;
  serie: number;
}

export interface ItemNota {
  nome: string;
  qtd: number;
  precoUnit: number;
  precoTotal: number;
  codigo?: string | null;
  ncm?: string | null;
  cfop?: string | null;
  csosn?: string | null;
  unidade?: string | null;
}

export interface PagamentoNota {
  metodo: string;
  valor: number;
}

export interface DadosNota {
  emitente: EmitenteNota;
  itens: ItemNota[];
  pagamentos: PagamentoNota[];
  /** desconto da comanda inteira, rateado entre os itens */
  desconto?: number;
  /** CPF do cliente, quando ele pede na nota */
  cpf?: string | null;
  /** quando a venda aconteceu, no fuso da casa, em ISO com offset */
  dataEmissao: string;
}

/**
 * A tabela da SEFAZ para forma de pagamento. O que o sistema chama de "pix_app"
 * e "vale" a nota não conhece: tem que virar o código certo, senão a nota é
 * rejeitada com uma mensagem que ninguém entende.
 */
const FORMA: Record<string, string> = {
  dinheiro: "01",
  credito: "03",
  debito: "04",
  vale: "10",          // vale alimentação
  pix: "17",
  pix_app: "17",
  online: "17",
  cortesia: "90",      // sem pagamento
};

export function formaDePagamento(metodo: string): string {
  return FORMA[metodo] ?? "99";   // 99 = outros
}

const cent = (v: number): number => Math.round(v * 100) / 100;
const so = (v: string | null | undefined): string => (v ?? "").replace(/\D/g, "");

/** CPF de verdade, com os dois dígitos batendo. Nota com CPF torto é rejeitada. */
export function cpfValido(cpf: string): boolean {
  const d = so(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  for (const [ate, pos] of [[9, 10], [10, 11]] as const) {
    let soma = 0;
    for (let i = 0; i < ate; i++) soma += Number(d[i]) * (pos - i);
    const resto = (soma * 10) % 11 % 10;
    if (resto !== Number(d[ate])) return false;
  }
  return true;
}

/**
 * Monta a NFC-e. Levanta ErroFiscal quando falta algo que a SEFAZ vai recusar,
 * porque é melhor descobrir aqui do que no retorno com o cliente esperando.
 */
export function montarNfce(d: DadosNota): Record<string, unknown> {
  const e = d.emitente;
  if (so(e.cnpj).length !== 14) {
    throw new ErroFiscal("CNPJ_INVALIDO", "O CNPJ da loja está incompleto na configuração fiscal.");
  }
  const itens = d.itens.filter((i) => i.qtd > 0);
  if (!itens.length) throw new ErroFiscal("SEM_ITENS", "Não dá para emitir nota de uma conta sem item.");
  if (d.cpf && !cpfValido(d.cpf)) {
    throw new ErroFiscal("CPF_INVALIDO", "O CPF informado para a nota não é válido.");
  }

  const bruto = cent(itens.reduce((s, i) => s + i.precoTotal, 0));
  const desconto = Math.min(cent(d.desconto ?? 0), bruto);

  // O desconto da comanda é rateado item a item, e a sobra de centavo cai no
  // último. Se a soma dos itens não fechar com o total, a nota é rejeitada.
  let descontoDistribuido = 0;
  const linhas = itens.map((i, idx) => {
    const ultimo = idx === itens.length - 1;
    const parte = ultimo
      ? cent(desconto - descontoDistribuido)
      : cent((i.precoTotal / bruto) * desconto);
    descontoDistribuido = cent(descontoDistribuido + parte);

    const csosn = i.csosn ?? e.csosnPadrao;
    const item: Record<string, unknown> = {
      numero_item: idx + 1,
      codigo_produto: (i.codigo || `ITEM${idx + 1}`).slice(0, 60),
      descricao: i.nome.slice(0, 120),
      codigo_ncm: so(i.ncm ?? e.ncmPadrao) || e.ncmPadrao,
      cfop: i.cfop ?? e.cfopPadrao,
      unidade_comercial: (i.unidade ?? "UN").slice(0, 6),
      quantidade_comercial: i.qtd,
      valor_unitario_comercial: cent(i.precoUnit),
      unidade_tributavel: (i.unidade ?? "UN").slice(0, 6),
      quantidade_tributavel: i.qtd,
      valor_unitario_tributavel: cent(i.precoUnit),
      valor_bruto: cent(i.precoTotal),
      valor_desconto: parte > 0 ? parte : undefined,
      icms_origem: 0,
      inclui_no_total: 1,
    };
    // Simples Nacional usa CSOSN; regime normal usa CST. Trocar os dois é o
    // erro clássico de quem liga fiscal na pressa.
    if (e.regime === "normal") {
      item.icms_situacao_tributaria = e.cstPadrao ?? "102";
    } else {
      item.icms_situacao_tributaria = csosn;
    }
    return item;
  });

  const totalNota = cent(bruto - desconto);
  const somaPagamentos = cent(d.pagamentos.reduce((s, p) => s + p.valor, 0));
  // A nota não aceita pagar menos que o total. Pagar a mais é troco, e troco
  // em dinheiro é normal; o que não pode é faltar.
  if (somaPagamentos + 0.01 < totalNota) {
    throw new ErroFiscal("PAGAMENTO_MENOR",
      `Os pagamentos somam R$ ${somaPagamentos.toFixed(2)} e a nota é de R$ ${totalNota.toFixed(2)}.`);
  }

  const pagamentos = (d.pagamentos.length ? d.pagamentos : [{ metodo: "dinheiro", valor: totalNota }])
    .map((p) => ({
      forma_pagamento: formaDePagamento(p.metodo),
      valor_pagamento: cent(p.valor),
    }));

  return {
    natureza_operacao: "Venda ao consumidor",
    data_emissao: d.dataEmissao,
    presenca_comprador: 1,              // presencial
    modalidade_frete: 9,                // sem frete
    cnpj_emitente: so(e.cnpj),
    nome_emitente: e.razao ?? undefined,
    inscricao_estadual_emitente: so(e.ie) || undefined,
    uf_emitente: e.uf ?? undefined,
    municipio_emitente: e.municipio ?? undefined,
    cep_emitente: so(e.cep) || undefined,
    serie: e.serie,
    cpf_destinatario: d.cpf ? so(d.cpf) : undefined,
    valor_produtos: bruto,
    valor_desconto: desconto > 0 ? desconto : undefined,
    valor_total: totalNota,
    itens: linhas,
    formas_pagamento: pagamentos,
  };
}

/**
 * A referência que vai para o integrador. É o que impede nota duplicada: mesma
 * comanda, mesma referência, e o integrador devolve a nota que já existe em vez
 * de emitir outra.
 */
export function referenciaDaNota(lojaId: string, sessaoOuPedido: string): string {
  return `ED-${lojaId.slice(0, 8)}-${sessaoOuPedido.replace(/-/g, "").slice(0, 24)}`;
}

/**
 * Quando insistir de novo. Erro de rede e SEFAZ fora do ar merecem paciência;
 * erro de conteúdo (CNPJ errado, CPF inválido) não adianta insistir, e a fila
 * marca para o dono resolver.
 */
export function proximaTentativa(tentativas: number): number {
  const minutos = [1, 2, 5, 15, 30, 60, 120];
  return minutos[Math.min(tentativas, minutos.length - 1)];
}

/** Erro de conteúdo não se resolve tentando de novo. */
export function ehErroPermanente(mensagem: string): boolean {
  return /rejei[cç][aã]o|cnpj|cpf|inscri[cç][aã]o|certificad|ncm|cfop|csosn|cst|duplicidade|inv[aá]lid/i
    .test(mensagem);
}
