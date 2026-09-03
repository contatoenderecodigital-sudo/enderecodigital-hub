import "server-only";
import { pool, query } from "./db";
import {
  acertarSessaoAposPagamento as _acertar,
  desfazerItem as _desfazer,
  estadoKds as _estado,
  historicoItem as _historico,
  liberarEsgotadosVencidos as _liberar,
  marcar86 as _marcar86,
  moverItem as _moverItem,
  moverPedido as _moverPedido,
  moverSessao as _moverSessao,
  resumoPorArea as _resumoArea,
  revisaoKds as _revisao,
  type Ator,
  type ClienteSQL,
  type DesfazerEntrada,
  type EstadoSessao,
  type EstadoItem,
  type MoverItemEntrada,
  type MoverSessaoEntrada,
} from "./food-kds-sql";

// ============================================================================
// Embrulho do KDS para o app: pega a conexão do pool e chama a máquina de
// estados de `lib/food-kds-sql.ts`. Toda a regra está lá, para poder ser
// testada contra um Postgres em memória sem subir o app.
// ============================================================================

export {
  ErroKds, ESTADOS_ITEM, ESTADOS_PEDIDO, ESTADOS_SESSAO, ESTADOS_VIVOS_SESSAO,
  TRANSICOES_ITEM, TRANSICOES_PEDIDO, TRANSICOES_SESSAO,
  podeItem, podePedido, podeSessao,
} from "./food-kds-sql";
export type { Ator, EstadoItem, EstadoPedido, EstadoSessao, ItemKds } from "./food-kds-sql";

/** Leitura: uma consulta por vez, direto do pool. */
const leitor: ClienteSQL = { query };

/** Escrita: uma conexão presa, porque a transição roda dentro de transação. */
async function comConexao<T>(fn: (c: ClienteSQL) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    return await fn(c as unknown as ClienteSQL);
  } finally {
    c.release();
  }
}

export function moverItem(e: MoverItemEntrada) {
  return comConexao((c) => _moverItem(c, e));
}

export function desfazerItem(e: DesfazerEntrada) {
  return comConexao((c) => _desfazer(c, e));
}

export function moverPedido(e: {
  negocioId: string; pedidoId: string; para: EstadoItem; ator: Ator; motivo?: string | null;
}) {
  return comConexao((c) => _moverPedido(c, e));
}

export function moverSessao(e: MoverSessaoEntrada) {
  return comConexao((c) => _moverSessao(c, e));
}

/** Depois de receber: empurra a comanda pela régua do dinheiro. */
export function acertarSessaoAposPagamento(negocioId: string, sessaoId: string, ator: Ator) {
  return comConexao(async (c) => {
    await c.query("BEGIN");
    try {
      await _acertar(c, negocioId, sessaoId, ator);
      await c.query("COMMIT");
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    }
  });
}

export function estadoKds(negocioId: string, lojaId: string, areaId?: string | null) {
  return _estado(leitor, negocioId, lojaId, areaId);
}

export function revisaoKds(lojaId: string) {
  return _revisao(leitor, lojaId);
}

export function resumoPorArea(negocioId: string, lojaId: string) {
  return _resumoArea(leitor, negocioId, lojaId);
}

export function historicoItem(negocioId: string, itemId: string) {
  return _historico(leitor, negocioId, itemId);
}

export function marcar86(e: {
  negocioId: string; lojaId: string; produtoId: string; esgotado: boolean; ator: Ator;
}) {
  return _marcar86(leitor, e);
}

export function liberarEsgotadosVencidos(lojaId: string) {
  return _liberar(leitor, lojaId);
}

/** Estados vivos da comanda, no formato que o SQL antigo espera. */
export const SQL_SESSAO_VIVA = "('aberta','conta_pedida','em_pagamento','paga')";

/** O ator que a trilha de auditoria grava quando a acao vem de um tablet. */
export function atorDoDispositivo(d: { id: string; nome: string; tipo: string }): Ator {
  return { tipo: d.tipo === "garcom" ? "garcom" : "kds", id: d.id, nome: d.nome, origem: `tablet ${d.nome}` };
}

export function ehEstadoSessao(v: string): v is EstadoSessao {
  return ["aberta", "conta_pedida", "em_pagamento", "paga", "fechada", "cancelada"].includes(v);
}
