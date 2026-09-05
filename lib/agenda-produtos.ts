import "server-only";
import { pool, query } from "./db";
import { FUSO } from "./agenda";

// Estoque e caixa compartilham a mesma regra de isolamento do restante da
// Agenda: negocioId e sempre o primeiro argumento e vem da sessao na borda.

export type CategoriaProduto = "cosmetico" | "bar" | "uso_interno" | "outro";
export type OperacaoEstoque = "entrada" | "uso" | "perda" | "ajuste_mais" | "ajuste_menos";
export type FormaPagamento = "dinheiro" | "pix" | "debito" | "credito" | "fiado" | "cortesia";

export type ProdutoAgenda = {
  id: string;
  nome: string;
  sku: string | null;
  categoria: CategoriaProduto | null;
  marca: string | null;
  preco_cent: number;
  custo_cent: number;
  estoque: number;
  estoque_minimo: number;
  validade: string | null;
  revenda: boolean;
  ativo: boolean;
};

export type EntradaProduto = Omit<ProdutoAgenda, "id" | "estoque" | "ativo">;

export type MovimentoProduto = {
  id: string;
  produto_id: string;
  produto_nome: string;
  tipo: "entrada" | "venda" | "uso" | "perda" | "ajuste";
  quantidade: number;
  custo_unit_cent: number | null;
  comanda_id: string | null;
  motivo: string | null;
  usuario_email: string | null;
  criado_em: string;
};

export type ItemVenda = { produto_id: string; quantidade: number };

export type EntradaVendaAvulsa = {
  itens: ItemVenda[];
  forma_pagamento: FormaPagamento;
  desconto_cent?: number;
  taxa_cent?: number;
  parcelas?: number;
  cliente_id?: string | null;
  profissional_id?: string | null;
  filial_id?: string | null;
  observacao?: string | null;
};

export type ComandaAvulsa = {
  id: string;
  numero: number | null;
  status: "fechada" | "cancelada";
  subtotal_cent: number;
  desconto_cent: number;
  total_cent: number;
  taxa_cent: number;
  forma_pagamento: FormaPagamento | null;
  parcelas: number;
  cliente_nome: string | null;
  observacao: string | null;
  aberta_em: string;
  itens: Array<{
    descricao: string;
    quantidade: number;
    preco_unit_cent: number;
    desconto_cent: number;
    total_cent: number;
  }>;
};

export type FilialAgenda = { id: string; nome: string };

const CATEGORIAS = new Set<CategoriaProduto>(["cosmetico", "bar", "uso_interno", "outro"]);
const FORMAS = new Set<FormaPagamento>(["dinheiro", "pix", "debito", "credito", "fiado", "cortesia"]);
const OPERACOES = new Set<OperacaoEstoque>(["entrada", "uso", "perda", "ajuste_mais", "ajuste_menos"]);

function quantidadeValida(valor: number): number {
  if (!Number.isFinite(valor) || valor <= 0) throw new Error("Informe uma quantidade maior que zero.");
  const normalizada = Math.round(valor * 1_000) / 1_000;
  if (normalizada <= 0 || normalizada > 999_999_999) throw new Error("Quantidade fora do limite permitido.");
  return normalizada;
}

function validarProduto(p: EntradaProduto) {
  if (!p.nome.trim()) throw new Error("Nome do produto e obrigatorio.");
  if (p.categoria && !CATEGORIAS.has(p.categoria)) throw new Error("Categoria de produto invalida.");
  for (const [rotulo, valor] of [
    ["Preco", p.preco_cent], ["Custo", p.custo_cent],
  ] as const) {
    if (!Number.isSafeInteger(valor) || valor < 0) throw new Error(`${rotulo} invalido.`);
  }
  if (!Number.isFinite(p.estoque_minimo) || p.estoque_minimo < 0) {
    throw new Error("Estoque minimo invalido.");
  }
}

export function paraQuantidade(entrada: string): number {
  const limpa = entrada.replace(/\s/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  const numero = Number(limpa);
  return Number.isFinite(numero) ? Math.round(numero * 1_000) / 1_000 : 0;
}

export async function listarProdutos(
  negocioId: string,
  incluirInativos = false,
): Promise<ProdutoAgenda[]> {
  const { rows } = await query<ProdutoAgenda>(
    `SELECT id, nome, sku, categoria, marca, preco_cent, custo_cent,
            estoque::float8 AS estoque, estoque_minimo::float8 AS estoque_minimo,
            validade::text, revenda, ativo
       FROM agenda_produtos
      WHERE negocio_id = $1 AND ($2 OR ativo)
      ORDER BY ativo DESC, nome`,
    [negocioId, incluirInativos],
  );
  return rows;
}

export async function listarMovimentos(
  negocioId: string,
  limite = 80,
): Promise<MovimentoProduto[]> {
  const { rows } = await query<MovimentoProduto>(
    `SELECT m.id, m.produto_id, p.nome AS produto_nome, m.tipo,
            m.quantidade::float8 AS quantidade, m.custo_unit_cent,
            m.comanda_id, m.motivo, u.email AS usuario_email,
            m.criado_em::text AS criado_em
       FROM agenda_produto_movimentos m
       JOIN agenda_produtos p ON p.id = m.produto_id AND p.negocio_id = m.negocio_id
       LEFT JOIN usuarios u ON u.id = m.usuario_id
      WHERE m.negocio_id = $1
      ORDER BY m.criado_em DESC, m.id DESC
      LIMIT $2`,
    [negocioId, Math.max(1, Math.min(limite, 200))],
  );
  return rows;
}

export async function listarFiliaisAgenda(negocioId: string): Promise<FilialAgenda[]> {
  const { rows } = await query<FilialAgenda>(
    `SELECT id, nome FROM filiais
      WHERE negocio_id = $1 AND ativa
      ORDER BY nome`,
    [negocioId],
  );
  return rows;
}

export async function criarProduto(
  negocioId: string,
  usuarioId: string,
  produto: EntradaProduto,
  estoqueInicial = 0,
): Promise<string> {
  validarProduto(produto);
  const inicial = estoqueInicial === 0 ? 0 : quantidadeValida(estoqueInicial);
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const { rows } = await c.query<{ id: string }>(
      `INSERT INTO agenda_produtos
         (negocio_id, nome, sku, categoria, marca, preco_cent, custo_cent,
          estoque_minimo, validade, revenda)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id`,
      [negocioId, produto.nome.trim(), produto.sku, produto.categoria, produto.marca,
       produto.preco_cent, produto.custo_cent, produto.estoque_minimo,
       produto.validade, produto.revenda],
    );
    const produtoId = rows[0].id;
    if (inicial > 0) {
      await c.query(
        `INSERT INTO agenda_produto_movimentos
           (negocio_id, produto_id, tipo, quantidade, custo_unit_cent, motivo, usuario_id)
         VALUES ($1,$2,'entrada',$3,$4,'Estoque inicial',$5)`,
        [negocioId, produtoId, inicial, produto.custo_cent, usuarioId],
      );
    }
    await c.query("COMMIT");
    return produtoId;
  } catch (erro) {
    await c.query("ROLLBACK").catch(() => {});
    throw erro;
  } finally {
    c.release();
  }
}

export async function atualizarProduto(
  negocioId: string,
  produtoId: string,
  produto: EntradaProduto,
): Promise<void> {
  validarProduto(produto);
  const { rows } = await query<{ id: string }>(
    `UPDATE agenda_produtos SET
       nome = $3, sku = $4, categoria = $5, marca = $6,
       preco_cent = $7, custo_cent = $8, estoque_minimo = $9,
       validade = $10, revenda = $11
     WHERE negocio_id = $1 AND id = $2
     RETURNING id`,
    [negocioId, produtoId, produto.nome.trim(), produto.sku, produto.categoria,
     produto.marca, produto.preco_cent, produto.custo_cent,
     produto.estoque_minimo, produto.validade, produto.revenda],
  );
  if (!rows[0]) throw new Error("Produto nao encontrado.");
}

export async function arquivarProduto(negocioId: string, produtoId: string): Promise<void> {
  const { rows } = await query<{ id: string }>(
    `UPDATE agenda_produtos SET ativo = false
      WHERE negocio_id = $1 AND id = $2
      RETURNING id`,
    [negocioId, produtoId],
  );
  if (!rows[0]) throw new Error("Produto nao encontrado.");
}

export async function movimentarEstoque(
  negocioId: string,
  usuarioId: string,
  produtoId: string,
  operacao: OperacaoEstoque,
  quantidade: number,
  motivo?: string | null,
): Promise<void> {
  if (!OPERACOES.has(operacao)) throw new Error("Operacao de estoque invalida.");
  const qtd = quantidadeValida(quantidade);
  const tipo = operacao.startsWith("ajuste") ? "ajuste" : operacao;
  const sinal = operacao === "entrada" || operacao === "ajuste_mais" ? 1 : -1;
  const delta = qtd * sinal;
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const { rows } = await c.query<{ estoque: number }>(
      `SELECT estoque::float8 AS estoque
         FROM agenda_produtos
        WHERE negocio_id = $1 AND id = $2
        FOR UPDATE`,
      [negocioId, produtoId],
    );
    if (!rows[0]) throw new Error("Produto nao encontrado.");
    if (rows[0].estoque + delta < -0.000_001) {
      throw new Error(`Estoque insuficiente. Saldo atual: ${rows[0].estoque}.`);
    }
    await c.query(
      `INSERT INTO agenda_produto_movimentos
         (negocio_id, produto_id, tipo, quantidade, motivo, usuario_id)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [negocioId, produtoId, tipo, delta, motivo?.trim() || null, usuarioId],
    );
    await c.query("COMMIT");
  } catch (erro) {
    await c.query("ROLLBACK").catch(() => {});
    throw erro;
  } finally {
    c.release();
  }
}

export async function listarComandasAvulsas(
  negocioId: string,
  limite = 40,
): Promise<ComandaAvulsa[]> {
  const { rows: comandas } = await query<Omit<ComandaAvulsa, "itens">>(
    `SELECT cm.id, cm.numero, cm.status, cm.subtotal_cent, cm.desconto_cent,
            cm.total_cent, cm.taxa_cent, cm.forma_pagamento, cm.parcelas,
            cl.nome AS cliente_nome, cm.observacao, cm.aberta_em::text AS aberta_em
       FROM agenda_comandas cm
       LEFT JOIN agenda_clientes cl
         ON cl.id = cm.cliente_id AND cl.negocio_id = cm.negocio_id
      WHERE cm.negocio_id = $1 AND cm.agendamento_id IS NULL
      ORDER BY cm.aberta_em DESC, cm.id DESC
      LIMIT $2`,
    [negocioId, Math.max(1, Math.min(limite, 100))],
  );
  if (comandas.length === 0) return [];
  const { rows: itens } = await query<{
    comanda_id: string;
    descricao: string;
    quantidade: number;
    preco_unit_cent: number;
    desconto_cent: number;
    total_cent: number;
  }>(
    `SELECT comanda_id, descricao, quantidade::float8 AS quantidade,
            preco_unit_cent, desconto_cent, total_cent
       FROM agenda_comanda_itens
      WHERE negocio_id = $1 AND comanda_id = ANY($2::uuid[])
      ORDER BY criado_em, id`,
    [negocioId, comandas.map((c) => c.id)],
  );
  return comandas.map((comanda) => ({
    ...comanda,
    itens: itens.filter((item) => item.comanda_id === comanda.id),
  }));
}

export async function venderProdutosAvulso(
  negocioId: string,
  usuarioId: string,
  venda: EntradaVendaAvulsa,
): Promise<string> {
  if (!FORMAS.has(venda.forma_pagamento)) throw new Error("Escolha uma forma de pagamento valida.");
  if (venda.forma_pagamento === "fiado" && !venda.cliente_id) {
    throw new Error("Venda fiada precisa estar vinculada a um cliente.");
  }
  if (!Number.isSafeInteger(venda.desconto_cent ?? 0) || (venda.desconto_cent ?? 0) < 0) {
    throw new Error("Desconto invalido.");
  }
  if (!Number.isSafeInteger(venda.taxa_cent ?? 0) || (venda.taxa_cent ?? 0) < 0) {
    throw new Error("Taxa invalida.");
  }

  const agrupados = new Map<string, number>();
  for (const item of venda.itens) {
    const qtd = quantidadeValida(item.quantidade);
    agrupados.set(item.produto_id, Math.round(((agrupados.get(item.produto_id) ?? 0) + qtd) * 1_000) / 1_000);
  }
  if (agrupados.size === 0) throw new Error("Escolha ao menos um produto.");
  const ids = [...agrupados.keys()].sort();

  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const { rows: produtos } = await c.query<ProdutoAgenda>(
      `SELECT id, nome, sku, categoria, marca, preco_cent, custo_cent,
              estoque::float8 AS estoque, estoque_minimo::float8 AS estoque_minimo,
              validade::text, revenda, ativo
         FROM agenda_produtos
        WHERE negocio_id = $1 AND id = ANY($2::uuid[])
        ORDER BY id
        FOR UPDATE`,
      [negocioId, ids],
    );
    if (produtos.length !== ids.length) throw new Error("Um dos produtos nao pertence a este catalogo.");

    for (const produto of produtos) {
      const qtd = agrupados.get(produto.id)!;
      if (!produto.ativo || !produto.revenda) throw new Error(`${produto.nome} nao esta disponivel para revenda.`);
      if (produto.estoque + 0.000_001 < qtd) {
        throw new Error(`Estoque insuficiente para ${produto.nome}. Disponivel: ${produto.estoque}.`);
      }
    }

    if (venda.cliente_id) {
      const cliente = await c.query(
        `SELECT id FROM agenda_clientes WHERE negocio_id = $1 AND id = $2`,
        [negocioId, venda.cliente_id],
      );
      if (!cliente.rows[0]) throw new Error("Cliente nao encontrado neste workspace.");
    }
    if (venda.filial_id) {
      const filial = await c.query(
        `SELECT id FROM filiais WHERE negocio_id = $1 AND id = $2 AND ativa`,
        [negocioId, venda.filial_id],
      );
      if (!filial.rows[0]) throw new Error("Loja nao encontrada neste workspace.");
    }

    let comissaoPct = 0;
    if (venda.profissional_id) {
      const { rows } = await c.query<{ pct: number }>(
        `SELECT coalesce(p.comissao_produto_pct, cfg.comissao_produto_pct, 0)::float8 AS pct
           FROM agenda_profissionais p
           LEFT JOIN agenda_config cfg ON cfg.negocio_id = p.negocio_id
          WHERE p.negocio_id = $1 AND p.id = $2 AND p.ativo`,
        [negocioId, venda.profissional_id],
      );
      if (!rows[0]) throw new Error("Profissional nao encontrado neste workspace.");
      comissaoPct = rows[0].pct;
    }

    const brutos = produtos.map((produto) => ({
      produto,
      quantidade: agrupados.get(produto.id)!,
      bruto: Math.round(produto.preco_cent * agrupados.get(produto.id)!),
    }));
    const subtotal = brutos.reduce((soma, item) => soma + item.bruto, 0);
    const desconto = Math.min(venda.desconto_cent ?? 0, subtotal);
    const total = subtotal - desconto;
    const parcelas = Math.max(1, Math.min(99, Math.trunc(venda.parcelas ?? 1)));

    await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`agenda:comanda:${negocioId}`]);
    const { rows: proximos } = await c.query<{ numero: number }>(
      `SELECT coalesce(max(numero), 0) + 1 AS numero
         FROM agenda_comandas
        WHERE negocio_id = $1
          AND (aberta_em AT TIME ZONE $2)::date = (now() AT TIME ZONE $2)::date`,
      [negocioId, FUSO],
    );
    const numero = Number(proximos[0].numero);
    const { rows: comandas } = await c.query<{ id: string }>(
      `INSERT INTO agenda_comandas
         (negocio_id, filial_id, cliente_id, numero, status, subtotal_cent,
          desconto_cent, total_cent, taxa_cent, forma_pagamento, parcelas,
          observacao, fechada_em)
       VALUES ($1,$2,$3,$4,'fechada',$5,$6,$7,$8,$9,$10,$11,now())
       RETURNING id`,
      [negocioId, venda.filial_id ?? null, venda.cliente_id ?? null, numero,
       subtotal, desconto, total, venda.taxa_cent ?? 0, venda.forma_pagamento,
       parcelas, venda.observacao?.trim() || null],
    );
    const comandaId = comandas[0].id;

    let brutoAcumulado = 0;
    let descontoDistribuido = 0;
    for (const item of brutos) {
      brutoAcumulado += item.bruto;
      const descontoAcumulado = subtotal === 0 ? 0 : Number(
        BigInt(desconto) * BigInt(brutoAcumulado) / BigInt(subtotal),
      );
      const descontoItem = descontoAcumulado - descontoDistribuido;
      descontoDistribuido = descontoAcumulado;
      const liquido = item.bruto - descontoItem;
      await c.query(
        `INSERT INTO agenda_comanda_itens
           (negocio_id, comanda_id, tipo, produto_id, profissional_id,
            descricao, quantidade, preco_unit_cent, desconto_cent, total_cent,
            comissao_pct, comissao_cent)
         VALUES ($1,$2,'produto',$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [negocioId, comandaId, item.produto.id, venda.profissional_id ?? null,
         item.produto.nome, item.quantidade, item.produto.preco_cent,
         descontoItem, liquido, venda.profissional_id ? comissaoPct : null,
         Math.round(liquido * comissaoPct / 100)],
      );
      await c.query(
        `INSERT INTO agenda_produto_movimentos
           (negocio_id, produto_id, tipo, quantidade, custo_unit_cent,
            comanda_id, motivo, usuario_id)
         VALUES ($1,$2,'venda',$3,$4,$5,$6,$7)`,
        [negocioId, item.produto.id, -item.quantidade, item.produto.custo_cent,
         comandaId, `Venda avulsa, comanda ${numero}`, usuarioId],
      );
    }

    await c.query("COMMIT");
    return comandaId;
  } catch (erro) {
    await c.query("ROLLBACK").catch(() => {});
    throw erro;
  } finally {
    c.release();
  }
}

export async function cancelarComandaAvulsa(
  negocioId: string,
  usuarioId: string,
  comandaId: string,
  motivo?: string | null,
): Promise<void> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const { rows: comandas } = await c.query<{ status: string; numero: number | null; agendamento_id: string | null }>(
      `SELECT status, numero, agendamento_id
         FROM agenda_comandas
        WHERE negocio_id = $1 AND id = $2
        FOR UPDATE`,
      [negocioId, comandaId],
    );
    const comanda = comandas[0];
    if (!comanda || comanda.agendamento_id) throw new Error("Venda avulsa nao encontrada.");
    if (comanda.status === "cancelada") throw new Error("Esta venda ja foi cancelada.");
    if (comanda.status !== "fechada") throw new Error("Somente uma venda fechada pode ser cancelada.");

    const { rows: saidas } = await c.query<{ produto_id: string; quantidade: number }>(
      `SELECT produto_id, (-sum(quantidade))::float8 AS quantidade
         FROM agenda_produto_movimentos
        WHERE negocio_id = $1 AND comanda_id = $2 AND tipo = 'venda'
        GROUP BY produto_id
       HAVING sum(quantidade) < 0
        ORDER BY produto_id`,
      [negocioId, comandaId],
    );
    if (saidas.length === 0) throw new Error("A venda nao possui movimento de estoque para estornar.");

    for (const saida of saidas) {
      await c.query(
        `INSERT INTO agenda_produto_movimentos
           (negocio_id, produto_id, tipo, quantidade, comanda_id, motivo, usuario_id)
         VALUES ($1,$2,'ajuste',$3,$4,$5,$6)`,
        [negocioId, saida.produto_id, saida.quantidade, comandaId,
         `Estorno da comanda ${comanda.numero ?? "sem numero"}${motivo?.trim() ? `: ${motivo.trim()}` : ""}`,
         usuarioId],
      );
    }
    await c.query(
      `UPDATE agenda_comandas SET status = 'cancelada'
        WHERE negocio_id = $1 AND id = $2`,
      [negocioId, comandaId],
    );
    await c.query("COMMIT");
  } catch (erro) {
    await c.query("ROLLBACK").catch(() => {});
    throw erro;
  } finally {
    c.release();
  }
}
