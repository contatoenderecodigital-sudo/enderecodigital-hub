// ============================================================================
// As regras do cardápio que o SERVIDOR precisa cobrar.
//
// Elas viviam só no navegador: "escolha 1 opção" era um `disabled` no botão.
// Quem chamasse a API por fora mandava churrasco sem o ponto da carne, trinta
// adicionais num grupo de máximo 1, ou o adicional de outro produto (inclusive
// de outro restaurante, porque a opção era buscada por id solto).
//
// Este arquivo não importa nada em tempo de execução, de propósito: é chamado
// dentro da transação de `criarPedido()` e é testado direto, sem banco.
// ============================================================================

export interface GrupoRegra {
  id: string;
  produto_id: string;
  nome: string;
  minimo: number;
  maximo: number;
  obrigatorio: boolean;
  /** soma (padrão), maior (pizza meia a meia) ou media */
  tipo_preco: string;
}

export interface OpcaoEscolhida {
  id: string;
  nome: string;
  preco_extra: string | number;
  grupo_id: string;
  /** produto dono do GRUPO da opção. É o que impede grudar opção de outro item. */
  grupo_produto: string;
  esgotada?: boolean | null;
}

export class ErroRegra extends Error {
  codigo = "REGRA_CARDAPIO";
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroRegra";
  }
}

const num = (v: unknown): number => Number(v ?? 0);

/**
 * Confere as escolhas de um item e devolve quanto elas somam ao preço unitário.
 * Levanta ErroRegra com uma frase que pode ir direto para a tela do cliente.
 */
export function extraDoItem(
  produto: { id: string; nome: string },
  grupos: GrupoRegra[],
  escolhidas: OpcaoEscolhida[]
): number {
  for (const o of escolhidas) {
    if (o.grupo_produto !== produto.id) {
      throw new ErroRegra(`"${o.nome}" não é uma opção de ${produto.nome}`);
    }
    if (o.esgotada) throw new ErroRegra(`${o.nome} acabou`);
  }

  const meus = grupos.filter((g) => g.produto_id === produto.id);
  let extra = 0;

  for (const g of meus) {
    const doGrupo = escolhidas.filter((o) => o.grupo_id === g.id);
    const qtd = doGrupo.length;
    const minimo = g.obrigatorio ? Math.max(1, g.minimo) : g.minimo;

    if (qtd < minimo) {
      throw new ErroRegra(
        minimo === 1
          ? `${produto.nome}: escolha ${g.nome}`
          : `${produto.nome}: escolha ao menos ${minimo} em ${g.nome}`
      );
    }
    if (g.maximo > 0 && qtd > g.maximo) {
      throw new ErroRegra(`${produto.nome}: no máximo ${g.maximo} em ${g.nome}`);
    }
    if (!qtd) continue;

    const precos = doGrupo.map((o) => num(o.preco_extra));
    if (g.tipo_preco === "maior") extra += Math.max(...precos);
    else if (g.tipo_preco === "media") extra += precos.reduce((a, b) => a + b, 0) / precos.length;
    else extra += precos.reduce((a, b) => a + b, 0);
  }

  // Opção cujo grupo não pertence ao produto já foi barrada lá em cima, então
  // não existe escolha fora de `meus` sobrando para somar.
  return Math.round(extra * 100) / 100;
}
