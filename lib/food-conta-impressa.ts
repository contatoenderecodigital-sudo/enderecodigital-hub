// ============================================================================
// A CONTA IMPRESSA, a que o garçom leva na mesa.
//
// Faltava, e é usada toda noite. Sem ela o garçom lê o total do tablet e o
// cliente confere no grito. Com ela o cliente vê o que consumiu, item a item,
// e a discussão sobre a conta acaba antes de começar.
//
// Duas coisas que a lei manda estar aqui:
//   - a taxa de serviço tem que aparecer como OPCIONAL (Lei 13.419/2017), e o
//     papel diz isso com todas as letras;
//   - o couvert, quando existe, é cobrança separada e vai destacado.
//
// Arquivo puro: sem banco, sem rede. É texto, e texto se testa.
// ============================================================================

export interface ItemDaConta {
  nome: string;
  qtd: number;
  total: number;
  quem?: string | null;
}

export interface DadosDaConta {
  loja: string;
  mesa?: string | null;
  codigo?: string | null;
  pessoas: number;
  abertaEm?: string | null;
  agora: string;
  itens: ItemDaConta[];
  subtotal: number;
  couvert: number;
  taxaServico: number;
  taxaPct: number;
  servicoRecusado: boolean;
  desconto: number;
  descontoMotivo?: string | null;
  total: number;
  pago: number;
  cols?: number;
}

const dinheiro = (v: number): string =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function linha(char: string, cols: number): string {
  return char.repeat(cols);
}

function duas(esq: string, dir: string, cols: number): string {
  const espaco = Math.max(1, cols - esq.length - dir.length);
  return esq + " ".repeat(espaco) + dir;
}

/** Quebra o nome do item quando ele é maior que a largura que sobrou. */
function nomeQuebrado(nome: string, largura: number): string[] {
  const palavras = nome.split(" ");
  const linhas: string[] = [];
  let atual = "";
  for (const p of palavras) {
    if ((atual + " " + p).trim().length > largura) {
      if (atual) linhas.push(atual.trim());
      atual = p;
    } else {
      atual = (atual + " " + p).trim();
    }
  }
  if (atual) linhas.push(atual);
  return linhas.length ? linhas : [nome];
}

export function montarConta(d: DadosDaConta): string {
  const cols = d.cols ?? 48;
  const out: string[] = [];

  out.push(d.loja.toUpperCase());
  out.push(linha("=", cols));
  out.push(d.mesa ? `MESA ${d.mesa}` : "BALCAO");
  if (d.codigo) out.push(`COMANDA ${d.codigo}`);
  out.push(duas(`${d.pessoas} ${d.pessoas === 1 ? "pessoa" : "pessoas"}`, d.agora, cols));
  out.push(linha("-", cols));

  // ---- os itens
  for (const i of d.itens) {
    const valor = dinheiro(i.total);
    const prefixo = `${String(i.qtd).padStart(2, " ")}x `;
    const largura = cols - prefixo.length - valor.length - 1;
    const partes = nomeQuebrado(i.nome, largura);
    out.push(duas(prefixo + partes[0], valor, cols));
    for (const resto of partes.slice(1)) {
      out.push(" ".repeat(prefixo.length) + resto);
    }
    if (i.quem) out.push(" ".repeat(prefixo.length) + `(${i.quem})`);
  }

  out.push(linha("-", cols));
  out.push(duas("Consumo", dinheiro(d.subtotal), cols));
  if (d.couvert > 0) out.push(duas("Couvert artistico", dinheiro(d.couvert), cols));

  // ---- a taxa de serviço, e o que a lei manda dizer sobre ela
  if (d.servicoRecusado) {
    out.push(duas(`Servico ${d.taxaPct}%`, "nao incluido", cols));
  } else if (d.taxaServico > 0) {
    out.push(duas(`Servico ${d.taxaPct}% (opcional)`, dinheiro(d.taxaServico), cols));
  }
  if (d.desconto > 0) {
    out.push(duas(`Desconto${d.descontoMotivo ? " " + d.descontoMotivo : ""}`,
      "-" + dinheiro(d.desconto), cols));
  }

  out.push(linha("=", cols));
  out.push(duas("TOTAL", dinheiro(d.total), cols));
  if (d.pago > 0) {
    out.push(duas("Ja pago", "-" + dinheiro(d.pago), cols));
    out.push(duas("FALTA", dinheiro(Math.max(0, Math.round((d.total - d.pago) * 100) / 100)), cols));
  }

  // ---- divisão, que é a primeira pergunta da mesa
  if (d.pessoas > 1) {
    const cada = Math.round((d.total / d.pessoas) * 100) / 100;
    out.push(linha("-", cols));
    out.push(duas(`Dividido por ${d.pessoas}`, dinheiro(cada), cols));
  }

  if (!d.servicoRecusado && d.taxaServico > 0) {
    out.push(linha("-", cols));
    out.push("A taxa de servico e opcional (Lei 13.419/2017).");
    out.push("Se preferir nao pagar, e so avisar.");
  }

  out.push(linha("=", cols));
  out.push("NAO E DOCUMENTO FISCAL");
  out.push("");
  return out.join("\n");
}
