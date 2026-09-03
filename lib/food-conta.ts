import "server-only";
import { pool, query } from "./db";
import { ErroKds, type Ator } from "./food-kds-sql";
import { recalcularSessaoPublico } from "./food";

// ============================================================================
// A CONTA: desconto, taxa de serviço e divisão.
//
// Três buracos que a auditoria apontou e que moram aqui:
//   1. `food_sessoes.desconto` entrava no total e NENHUM endpoint escrevia. Não
//      existia desconto no sistema, e a cortesia não tinha autor.
//   2. a taxa de serviço automática entrava no total sem nenhum caminho para o
//      cliente recusar. A Lei 13.419/2017 trata a gorjeta como voluntária, e o
//      artigo 39 do CDC proíbe pressionar. Cobrança compulsória é Procon.
//   3. divisão de conta não existia, nem por item, nem por pessoa, nem igual,
//      apesar de o `membro_id` do item estar gravado desde sempre.
// ============================================================================

const n = (v: unknown): number => Number(v ?? 0);
const brl = (v: number): string => v.toFixed(2);

async function registrarNaComanda(
  sessaoId: string, negocioId: string, ator: Ator, motivo: string, valorAberto?: number
): Promise<void> {
  await query(
    `INSERT INTO food_sessao_eventos
       (negocio_id, loja_id, sessao_id, de, para, ator_tipo, ator_id, ator_nome, origem, motivo, valor_aberto)
     SELECT $1, s.loja_id, s.id, s.status, s.status, $3, $4, $5, $6, $7, $8
       FROM food_sessoes s WHERE s.id = $2 AND s.negocio_id = $1`,
    [negocioId, sessaoId, ator.tipo, ator.id ?? null, ator.nome ?? null,
     ator.origem ?? null, motivo, valorAberto != null ? brl(valorAberto) : null]
  );
}

// ---------------------------------------------------------------------------
// DESCONTO
// ---------------------------------------------------------------------------
export async function aplicarDesconto(e: {
  negocioId: string; sessaoId: string; valor: number; motivo: string; ator: Ator;
}): Promise<{ ok: true; desconto: number; total: number }> {
  const motivo = e.motivo.trim();
  if (!motivo) throw new ErroKds("MOTIVO_OBRIGATORIO", "Desconto exige motivo.");
  if (!(e.valor >= 0)) throw new ErroKds("VALOR_INVALIDO", "Desconto não pode ser negativo.");

  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const s = (await c.query<{ subtotal: string; status: string }>(
      "SELECT subtotal, status FROM food_sessoes WHERE id = $1 AND negocio_id = $2 FOR UPDATE",
      [e.sessaoId, e.negocioId]
    )).rows[0];
    if (!s) { await c.query("ROLLBACK"); throw new ErroKds("SESSAO_NAO_ENCONTRADA", "Comanda não encontrada."); }
    if (["fechada", "cancelada"].includes(s.status)) {
      await c.query("ROLLBACK");
      throw new ErroKds("CONTA_FECHADA", "Esta conta já foi fechada.");
    }
    // desconto não pode virar troco: no máximo o que a mesa consumiu
    if (e.valor > n(s.subtotal) + 0.01) {
      await c.query("ROLLBACK");
      throw new ErroKds("VALOR_INVALIDO", `O desconto não pode passar de R$ ${n(s.subtotal).toFixed(2)}.`);
    }

    await c.query(
      `UPDATE food_sessoes
          SET desconto = $3, desconto_motivo = $4, desconto_por = $5, desconto_em = now()
        WHERE id = $1 AND negocio_id = $2`,
      [e.sessaoId, e.negocioId, brl(e.valor), motivo, e.ator.nome ?? e.ator.tipo]
    );
    await recalcularSessaoPublico(c, e.sessaoId);
    await c.query("COMMIT");
  } catch (erro) {
    try { await c.query("ROLLBACK"); } catch { /* já caiu */ }
    throw erro;
  } finally {
    c.release();
  }

  await registrarNaComanda(e.sessaoId, e.negocioId, e.ator,
    `desconto de R$ ${brl(e.valor)}: ${motivo}`);

  const s2 = (await query<{ desconto: string; total: string }>(
    "SELECT desconto, total FROM food_sessoes WHERE id = $1", [e.sessaoId]
  )).rows[0];
  return { ok: true, desconto: n(s2?.desconto), total: n(s2?.total) };
}

// ---------------------------------------------------------------------------
// TAXA DE SERVIÇO
// ---------------------------------------------------------------------------
export async function definirTaxaServico(e: {
  negocioId: string; sessaoId: string; recusar: boolean; ator: Ator;
}): Promise<{ ok: true; recusada: boolean; taxa: number; total: number }> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const s = (await c.query<{ status: string }>(
      "SELECT status FROM food_sessoes WHERE id = $1 AND negocio_id = $2 FOR UPDATE",
      [e.sessaoId, e.negocioId]
    )).rows[0];
    if (!s) { await c.query("ROLLBACK"); throw new ErroKds("SESSAO_NAO_ENCONTRADA", "Comanda não encontrada."); }
    if (["fechada", "cancelada"].includes(s.status)) {
      await c.query("ROLLBACK");
      throw new ErroKds("CONTA_FECHADA", "Esta conta já foi fechada.");
    }
    await c.query(
      `UPDATE food_sessoes
          SET servico_recusado = $3,
              servico_recusado_em = CASE WHEN $3 THEN now() ELSE NULL END
        WHERE id = $1 AND negocio_id = $2`,
      [e.sessaoId, e.negocioId, e.recusar]
    );
    await recalcularSessaoPublico(c, e.sessaoId);
    await c.query("COMMIT");
  } catch (erro) {
    try { await c.query("ROLLBACK"); } catch { /* já caiu */ }
    throw erro;
  } finally {
    c.release();
  }

  await registrarNaComanda(e.sessaoId, e.negocioId, e.ator,
    e.recusar ? "cliente recusou a taxa de serviço" : "taxa de serviço aceita de volta");

  const s2 = (await query<{ taxa_servico: string; total: string; servico_recusado: boolean }>(
    "SELECT taxa_servico, total, servico_recusado FROM food_sessoes WHERE id = $1", [e.sessaoId]
  )).rows[0];
  return {
    ok: true,
    recusada: !!s2?.servico_recusado,
    taxa: n(s2?.taxa_servico),
    total: n(s2?.total),
  };
}

// ---------------------------------------------------------------------------
// DIVISÃO DE CONTA
// ---------------------------------------------------------------------------
export interface Divisao {
  total: number;
  subtotal: number;
  taxa: number;
  couvert: number;
  desconto: number;
  pago: number;
  falta: number;
  pessoas: number;
  /** total/N, o jeito que a mesa divide na maioria das noites */
  porCabeca: number;
  /** o que cada celular da mesa pediu */
  porPessoa: {
    membroId: string | null;
    apelido: string | null;
    itens: { id: string; nome: string; qtd: string; total: number; pago: boolean }[];
    subtotal: number;
  }[];
}

export async function divisaoDaConta(negocioId: string, sessaoId: string): Promise<Divisao | null> {
  const s = (await query<{
    subtotal: string; taxa_servico: string; couvert_total: string; desconto: string;
    total: string; pago: string;
  }>(
    `SELECT subtotal, taxa_servico, couvert_total, desconto, total, pago
       FROM food_sessoes WHERE id = $1 AND negocio_id = $2`,
    [sessaoId, negocioId]
  )).rows[0];
  if (!s) return null;

  const itens = (await query<{
    id: string; nome_snapshot: string; qtd: string; preco_total: string;
    membro_id: string | null; apelido: string | null; pago: boolean;
  }>(
    `SELECT i.id, i.nome_snapshot, i.qtd, i.preco_total, i.membro_id, m.apelido,
            EXISTS (SELECT 1 FROM food_pagamento_itens pi
                     JOIN food_pagamentos p ON p.id = pi.pagamento_id
                    WHERE pi.item_id = i.id AND p.status = 'confirmado') AS pago
       FROM food_itens i
       JOIN food_pedidos ped ON ped.id = i.pedido_id
       LEFT JOIN food_sessao_membros m ON m.id = i.membro_id
      WHERE ped.sessao_id = $1 AND i.status <> 'cancelado' AND ped.status <> 'cancelado'
      ORDER BY i.criado_em`,
    [sessaoId]
  )).rows;

  const membros = (await query<{ id: string; apelido: string | null }>(
    "SELECT id, apelido FROM food_sessao_membros WHERE sessao_id = $1 ORDER BY entrou_em",
    [sessaoId]
  )).rows;

  const grupos = new Map<string, Divisao["porPessoa"][number]>();
  for (const m of membros) {
    grupos.set(m.id, { membroId: m.id, apelido: m.apelido, itens: [], subtotal: 0 });
  }
  for (const i of itens) {
    const chave = i.membro_id ?? "mesa";
    if (!grupos.has(chave)) {
      grupos.set(chave, {
        membroId: i.membro_id, apelido: i.apelido ?? (i.membro_id ? null : "Mesa"),
        itens: [], subtotal: 0,
      });
    }
    const g = grupos.get(chave)!;
    g.itens.push({
      id: i.id, nome: i.nome_snapshot, qtd: i.qtd, total: n(i.preco_total), pago: !!i.pago,
    });
    g.subtotal = Math.round((g.subtotal + n(i.preco_total)) * 100) / 100;
  }

  const total = n(s.total);
  const pago = n(s.pago);
  const pessoas = Math.max(1, membros.length);
  return {
    total,
    subtotal: n(s.subtotal),
    taxa: n(s.taxa_servico),
    couvert: n(s.couvert_total),
    desconto: n(s.desconto),
    pago,
    falta: Math.round((total - pago) * 100) / 100,
    pessoas,
    porCabeca: Math.round((total / pessoas) * 100) / 100,
    porPessoa: [...grupos.values()].filter((g) => g.itens.length > 0 || g.membroId),
  };
}

/**
 * Quanto valem estes itens. O cliente diz QUAIS itens está pagando; o valor sai
 * do banco, nunca do navegador. Recusa item que não é desta comanda.
 */
export async function valorDosItens(
  sessaoId: string, itemIds: string[]
): Promise<{ valor: number; itens: string[] }> {
  if (!itemIds.length) return { valor: 0, itens: [] };
  const r = (await query<{ id: string; preco_total: string }>(
    `SELECT i.id, i.preco_total
       FROM food_itens i JOIN food_pedidos p ON p.id = i.pedido_id
      WHERE p.sessao_id = $1 AND i.id = ANY($2) AND i.status <> 'cancelado'`,
    [sessaoId, itemIds]
  )).rows;
  if (r.length !== itemIds.length) {
    throw new ErroKds("ITEM_NAO_ENCONTRADO", "Algum item não é desta comanda.");
  }
  const valor = Math.round(r.reduce((s, i) => s + n(i.preco_total), 0) * 100) / 100;
  return { valor, itens: r.map((i) => i.id) };
}

/** Amarra o pagamento aos itens que ele quitou, para a divisão não pagar duas vezes. */
export async function marcarItensPagos(pagamentoId: string, itens: { id: string; valor: number }[]): Promise<void> {
  for (const i of itens) {
    await query(
      `INSERT INTO food_pagamento_itens (pagamento_id, item_id, valor)
       VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
      [pagamentoId, i.id, brl(i.valor)]
    );
  }
}
