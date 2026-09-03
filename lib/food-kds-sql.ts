// ============================================================================
// KDS: a máquina de estados do item e da comanda, e o SQL que ela usa.
//
// Este arquivo NÃO importa nada em tempo de execução, e toda função recebe o
// cliente de banco por parâmetro. Os dois motivos:
//   1. o teste roda contra um Postgres em memória (PGlite) sem subir o app e
//      sem nenhum risco de encostar no banco de produção;
//   2. quem chama decide se a transição entra em uma transação já aberta.
//
// O embrulho com o pool do app está em `lib/food-kds.ts`.
// ============================================================================

// Cliente mínimo: `pg` e PGlite atendem os dois.
export interface ClienteSQL {
  query<T = Record<string, unknown>>(
    texto: string,
    params?: unknown[]
  ): Promise<{ rows: T[] }>;
}

export interface Ator {
  tipo: "kds" | "garcom" | "painel" | "cliente" | "sistema";
  id?: string | null;
  nome?: string | null;
  origem?: string | null;
}

export class ErroKds extends Error {
  codigo = "ERRO";
  detalhe = "";
  constructor(codigo: string, mensagem?: string, detalhe?: string) {
    super(mensagem ?? codigo);
    this.name = "ErroKds";
    this.codigo = codigo;
    this.detalhe = detalhe ?? "";
  }
}

// ---------------------------------------------------------------------------
// AS TRANSIÇÕES. Esta tabela é a única fonte de verdade: nenhuma tela, rota ou
// consulta pode mudar status por fora dela.
//
//   pendente ──> em_producao ──> pronto ──> entregue
//      │              │            │
//      └──────────────┴────────────┴──> cancelado (exige motivo)
//
// `pendente -> pronto` é permitido de propósito: no bar a cerveja fica pronta
// antes de alguém apertar "fazendo". Quando isso acontece, o serviço grava
// também o evento intermediário, para o relatório de tempo não mentir.
// ---------------------------------------------------------------------------
export const ESTADOS_ITEM = ["pendente", "em_producao", "pronto", "entregue", "cancelado"] as const;
export type EstadoItem = (typeof ESTADOS_ITEM)[number];

export const TRANSICOES_ITEM: Record<EstadoItem, EstadoItem[]> = {
  pendente: ["em_producao", "pronto", "cancelado"],
  em_producao: ["pronto", "cancelado"],
  pronto: ["entregue", "cancelado"],
  entregue: [],
  cancelado: [],
};

export const ESTADOS_SESSAO = [
  "aberta", "conta_pedida", "em_pagamento", "paga", "fechada", "cancelada",
] as const;
export type EstadoSessao = (typeof ESTADOS_SESSAO)[number];

// aberta ──> conta_pedida ──> em_pagamento ──> paga ──> fechada
// Voltar um passo é permitido enquanto ninguém pagou (a mesa pediu mais uma).
// `fechada` sai de qualquer estado vivo de propósito: a mesa que foi embora sem
// consumir, e a que pagou na maquininha do garçom, precisam poder fechar. O
// freio não é a transição, é a régua do dinheiro: fechar com saldo em aberto
// exige motivo e grava quanto faltou.
export const TRANSICOES_SESSAO: Record<EstadoSessao, EstadoSessao[]> = {
  aberta: ["conta_pedida", "em_pagamento", "fechada", "cancelada"],
  conta_pedida: ["em_pagamento", "aberta", "fechada", "cancelada"],
  em_pagamento: ["paga", "conta_pedida", "fechada"],
  paga: ["fechada"],
  fechada: [],
  cancelada: [],
};

export const ESTADOS_VIVOS_SESSAO: EstadoSessao[] = ["aberta", "conta_pedida", "em_pagamento", "paga"];

// O PEDIDO (a rodada) quase sempre é derivado dos itens: quem manda é a cozinha,
// item a item. Esta tabela existe para o que NÃO vem do item: aprovar o pedido
// de delivery, despachar o motoboy, cancelar a rodada inteira.
export const ESTADOS_PEDIDO = [
  "pendente", "aprovado", "em_producao", "pronto", "em_entrega", "entregue", "cancelado",
] as const;
export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number];

export const TRANSICOES_PEDIDO: Record<EstadoPedido, EstadoPedido[]> = {
  pendente: ["aprovado", "cancelado"],
  aprovado: ["em_producao", "pronto", "cancelado"],
  em_producao: ["pronto", "cancelado"],
  pronto: ["em_entrega", "entregue", "cancelado"],
  em_entrega: ["entregue", "cancelado"],
  entregue: [],
  cancelado: [],
};

export function podePedido(de: EstadoPedido, para: EstadoPedido): boolean {
  return (TRANSICOES_PEDIDO[de] ?? []).includes(para);
}

export function podeItem(de: EstadoItem, para: EstadoItem): boolean {
  return (TRANSICOES_ITEM[de] ?? []).includes(para);
}
export function podeSessao(de: EstadoSessao, para: EstadoSessao): boolean {
  return (TRANSICOES_SESSAO[de] ?? []).includes(para);
}

/** Frase de erro que serve para a tela mostrar sem tradução. */
function explicaItem(de: EstadoItem, para: EstadoItem): string {
  const saidas = TRANSICOES_ITEM[de] ?? [];
  if (!saidas.length) return `Item ${de} não muda mais de estado.`;
  return `De ${de} não dá para ir para ${para}. Só para: ${saidas.join(", ")}.`;
}

const n = (v: unknown): number => Number(v ?? 0);

// ---------------------------------------------------------------------------
// ITEM
// ---------------------------------------------------------------------------
export interface MoverItemEntrada {
  negocioId: string;
  itemId: string;
  para: EstadoItem;
  ator: Ator;
  motivo?: string | null;
  /** Chave de idempotência: a mesma chave nunca age duas vezes. */
  chave?: string | null;
  /** Quando já existe uma transação aberta por quem chamou. */
  semTransacao?: boolean;
}

export interface MoverItemSaida {
  ok: true;
  repetido: boolean;
  de: EstadoItem | null;
  para: EstadoItem;
  itemId: string;
  pedidoId: string | null;
  lojaId: string | null;
}

interface LinhaItem {
  id: string;
  status: EstadoItem;
  pedido_id: string;
  producao_em: string | null;
  pronto_em: string | null;
  negocio_id: string;
}

async function abre(c: ClienteSQL, pular?: boolean) { if (!pular) await c.query("BEGIN"); }
async function fecha(c: ClienteSQL, pular?: boolean) { if (!pular) await c.query("COMMIT"); }
async function volta(c: ClienteSQL, pular?: boolean) {
  if (!pular) { try { await c.query("ROLLBACK"); } catch { /* conexão já caiu */ } }
}

/**
 * Move um item de estado. Idempotente, validada e auditada.
 *
 * - repetir a mesma transição não gera evento novo nem mexe nos carimbos;
 * - transição inválida levanta ErroKds("TRANSICAO_INVALIDA"), nunca falha calada;
 * - cancelamento sem motivo é recusado.
 */
export async function moverItem(c: ClienteSQL, e: MoverItemEntrada): Promise<MoverItemSaida> {
  if (!ESTADOS_ITEM.includes(e.para)) {
    throw new ErroKds("ESTADO_DESCONHECIDO", `Estado "${e.para}" não existe.`);
  }
  if (e.para === "cancelado" && !String(e.motivo ?? "").trim()) {
    throw new ErroKds("MOTIVO_OBRIGATORIO", "Cancelar exige motivo.");
  }

  await abre(c, e.semTransacao);
  try {
    // Chave de idempotência: se já agimos com esta chave, devolve o que deu.
    if (e.chave) {
      const ja = (await c.query<{ de: string | null; para: string; item_id: string; pedido_id: string | null; loja_id: string }>(
        "SELECT de, para, item_id, pedido_id, loja_id FROM food_item_eventos WHERE chave = $1",
        [e.chave]
      )).rows[0];
      if (ja) {
        await fecha(c, e.semTransacao);
        return {
          ok: true, repetido: true, de: (ja.de as EstadoItem) ?? null,
          para: ja.para as EstadoItem, itemId: ja.item_id,
          pedidoId: ja.pedido_id, lojaId: ja.loja_id,
        };
      }
    }

    // Trava o item: dois garçons batendo "pronto" no mesmo segundo entram em fila.
    const item = (await c.query<LinhaItem>(
      `SELECT id, status, pedido_id, producao_em, pronto_em, negocio_id
         FROM food_itens WHERE id = $1 AND negocio_id = $2 FOR UPDATE`,
      [e.itemId, e.negocioId]
    )).rows[0];
    if (!item) {
      await volta(c, e.semTransacao);
      throw new ErroKds("ITEM_NAO_ENCONTRADO", "Item não encontrado nesta casa.");
    }

    const ped = (await c.query<{ loja_id: string }>(
      "SELECT loja_id FROM food_pedidos WHERE id = $1", [item.pedido_id]
    )).rows[0];
    const lojaId = ped?.loja_id ?? null;

    // Já está lá: não escreve nada. É isto que torna a ação idempotente.
    if (item.status === e.para) {
      await fecha(c, e.semTransacao);
      return {
        ok: true, repetido: true, de: item.status, para: e.para,
        itemId: item.id, pedidoId: item.pedido_id, lojaId,
      };
    }

    if (!podeItem(item.status, e.para)) {
      await volta(c, e.semTransacao);
      throw new ErroKds("TRANSICAO_INVALIDA", explicaItem(item.status, e.para),
        `${item.status} -> ${e.para}`);
    }

    // Atalho pendente -> pronto: registra a passagem por em_producao, senão o
    // tempo de preparo daquele item some do relatório para sempre.
    const atalho = item.status === "pendente" && e.para === "pronto";
    if (atalho && lojaId) {
      await gravarEvento(c, {
        negocioId: e.negocioId, lojaId, itemId: item.id, pedidoId: item.pedido_id,
        de: "pendente", para: "em_producao",
        ator: { tipo: "sistema", nome: "atalho da tela", origem: e.ator.origem ?? null },
        motivo: "pronto direto do recebido",
      });
    }

    await c.query(
      `UPDATE food_itens
          SET status = $3,
              producao_em = CASE WHEN $3 IN ('em_producao','pronto') THEN COALESCE(producao_em, now()) ELSE producao_em END,
              pronto_em   = CASE WHEN $3 = 'pronto'   THEN COALESCE(pronto_em, now())   ELSE pronto_em END,
              entregue_em = CASE WHEN $3 = 'entregue' THEN COALESCE(entregue_em, now()) ELSE entregue_em END,
              cancelado_em = CASE WHEN $3 = 'cancelado' THEN now() ELSE cancelado_em END,
              cancelado_motivo = CASE WHEN $3 = 'cancelado' THEN $4 ELSE cancelado_motivo END,
              cancelado_por = CASE WHEN $3 = 'cancelado' THEN $5 ELSE cancelado_por END,
              atualizado_em = now()
        WHERE id = $1 AND negocio_id = $2`,
      [item.id, e.negocioId, e.para, e.motivo ?? null, e.ator.nome ?? e.ator.tipo]
    );

    if (lojaId) {
      await gravarEvento(c, {
        negocioId: e.negocioId, lojaId, itemId: item.id, pedidoId: item.pedido_id,
        de: atalho ? "em_producao" : item.status, para: e.para,
        ator: e.ator, motivo: e.motivo ?? null, chave: e.chave ?? null,
      });
    }

    await sincronizarPedido(c, item.pedido_id);
    await fecha(c, e.semTransacao);
    return {
      ok: true, repetido: false, de: item.status, para: e.para,
      itemId: item.id, pedidoId: item.pedido_id, lojaId,
    };
  } catch (erro) {
    if (!(erro instanceof ErroKds)) await volta(c, e.semTransacao);
    throw erro;
  }
}

interface EventoEntrada {
  negocioId: string; lojaId: string; itemId: string; pedidoId: string | null;
  de: string | null; para: string; ator: Ator; motivo?: string | null; chave?: string | null;
}

async function gravarEvento(c: ClienteSQL, ev: EventoEntrada): Promise<void> {
  await c.query(
    `INSERT INTO food_item_eventos
       (negocio_id, loja_id, item_id, pedido_id, de, para, ator_tipo, ator_id, ator_nome, origem, motivo, chave)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [ev.negocioId, ev.lojaId, ev.itemId, ev.pedidoId, ev.de, ev.para,
     ev.ator.tipo, ev.ator.id ?? null, ev.ator.nome ?? null, ev.ator.origem ?? null,
     ev.motivo ?? null, ev.chave ?? null]
  );
}

/**
 * O pedido acompanha os itens: só está pronto quando o último item saiu.
 * Roda depois de toda transição de item, dentro da mesma transação.
 */
export async function sincronizarPedido(c: ClienteSQL, pedidoId: string): Promise<void> {
  await c.query(
    `UPDATE food_pedidos p
        SET status = CASE
              WHEN NOT EXISTS (SELECT 1 FROM food_itens i WHERE i.pedido_id = p.id AND i.status <> 'cancelado')
                THEN 'cancelado'
              WHEN NOT EXISTS (SELECT 1 FROM food_itens i WHERE i.pedido_id = p.id
                                AND i.status IN ('pendente','em_producao'))
                   AND EXISTS (SELECT 1 FROM food_itens i WHERE i.pedido_id = p.id AND i.status = 'entregue')
                   AND NOT EXISTS (SELECT 1 FROM food_itens i WHERE i.pedido_id = p.id AND i.status = 'pronto')
                THEN 'entregue'
              WHEN NOT EXISTS (SELECT 1 FROM food_itens i WHERE i.pedido_id = p.id
                                AND i.status IN ('pendente','em_producao'))
                THEN 'pronto'
              WHEN EXISTS (SELECT 1 FROM food_itens i WHERE i.pedido_id = p.id AND i.status = 'em_producao')
                THEN 'em_producao'
              ELSE p.status END,
            producao_em = CASE WHEN p.producao_em IS NULL
                   AND EXISTS (SELECT 1 FROM food_itens i WHERE i.pedido_id = p.id
                                AND i.status IN ('em_producao','pronto','entregue'))
                THEN now() ELSE p.producao_em END,
            pronto_em = CASE WHEN p.pronto_em IS NULL
                   AND NOT EXISTS (SELECT 1 FROM food_itens i WHERE i.pedido_id = p.id
                                    AND i.status IN ('pendente','em_producao'))
                THEN now() ELSE p.pronto_em END,
            entregue_em = CASE WHEN p.entregue_em IS NULL
                   AND NOT EXISTS (SELECT 1 FROM food_itens i WHERE i.pedido_id = p.id
                                    AND i.status <> 'entregue' AND i.status <> 'cancelado')
                THEN now() ELSE p.entregue_em END
      WHERE p.id = $1 AND p.status IN ('aprovado','em_producao','pronto','entregue')`,
    [pedidoId]
  );
}

// ---------------------------------------------------------------------------
// PEDIDO INTEIRO: "sai tudo". Move cada item que pode ir, e ignora os que já
// passaram. Continua sendo o item que manda: o pedido é a soma deles.
// ---------------------------------------------------------------------------
export interface MoverPedidoSaida {
  ok: true; movidos: number; repetidos: number; pulados: number; para: EstadoItem;
}

export async function moverPedido(
  c: ClienteSQL,
  e: { negocioId: string; pedidoId: string; para: EstadoItem; ator: Ator; motivo?: string | null }
): Promise<MoverPedidoSaida> {
  await c.query("BEGIN");
  try {
    const itens = (await c.query<{ id: string }>(
      `SELECT id FROM food_itens
        WHERE pedido_id = $1 AND negocio_id = $2 AND status NOT IN ('entregue','cancelado')
        ORDER BY criado_em`,
      [e.pedidoId, e.negocioId]
    )).rows;
    let movidos = 0, repetidos = 0, pulados = 0;
    for (const it of itens) {
      try {
        const r = await moverItem(c, {
          negocioId: e.negocioId, itemId: it.id, para: e.para,
          ator: e.ator, motivo: e.motivo ?? null, semTransacao: true,
        });
        if (r.repetido) repetidos++; else movidos++;
      } catch (erro) {
        if (erro instanceof ErroKds && erro.codigo === "TRANSICAO_INVALIDA") pulados++;
        else throw erro;
      }
    }
    await c.query("COMMIT");
    return { ok: true, movidos, repetidos, pulados, para: e.para };
  } catch (erro) {
    await volta(c);
    throw erro;
  }
}

// ---------------------------------------------------------------------------
// DESFAZER: a faixa de 10 segundos da tela, sem senha e sem menu.
// A janela do servidor é maior de propósito, para absorver a rede da cozinha.
// ---------------------------------------------------------------------------
export interface DesfazerEntrada {
  negocioId: string; itemId: string; ator: Ator; janelaSeg?: number; semTransacao?: boolean;
}

export async function desfazerItem(c: ClienteSQL, e: DesfazerEntrada): Promise<MoverItemSaida> {
  const janela = e.janelaSeg ?? 30;
  await abre(c, e.semTransacao);
  try {
    const item = (await c.query<LinhaItem>(
      `SELECT id, status, pedido_id, producao_em, pronto_em, negocio_id
         FROM food_itens WHERE id = $1 AND negocio_id = $2 FOR UPDATE`,
      [e.itemId, e.negocioId]
    )).rows[0];
    if (!item) {
      await volta(c, e.semTransacao);
      throw new ErroKds("ITEM_NAO_ENCONTRADO", "Item não encontrado nesta casa.");
    }

    const ev = (await c.query<{ id: string; de: string | null; para: string; loja_id: string; idade: string }>(
      `SELECT id, de, para, loja_id, EXTRACT(EPOCH FROM (now() - criado_em)) AS idade
         FROM food_item_eventos
        WHERE item_id = $1 AND ator_tipo <> 'sistema'
        ORDER BY criado_em DESC LIMIT 1`,
      [e.itemId]
    )).rows[0];

    if (!ev || !ev.de || ev.para !== item.status) {
      await volta(c, e.semTransacao);
      throw new ErroKds("NADA_PARA_DESFAZER", "Não há transição recente para desfazer.");
    }
    if (n(ev.idade) > janela) {
      await volta(c, e.semTransacao);
      throw new ErroKds("JANELA_EXPIRADA", "Passou do tempo de desfazer. Mova pelo caminho normal.");
    }

    const volta_para = ev.de as EstadoItem;
    await c.query(
      `UPDATE food_itens
          SET status = $3,
              producao_em = CASE WHEN $3 = 'pendente' THEN NULL ELSE producao_em END,
              pronto_em   = CASE WHEN $3 IN ('pendente','em_producao') THEN NULL ELSE pronto_em END,
              entregue_em = CASE WHEN $3 <> 'entregue' THEN NULL ELSE entregue_em END,
              cancelado_em = NULL, cancelado_motivo = NULL, cancelado_por = NULL,
              atualizado_em = now()
        WHERE id = $1 AND negocio_id = $2`,
      [item.id, e.negocioId, volta_para]
    );
    await gravarEvento(c, {
      negocioId: e.negocioId, lojaId: ev.loja_id, itemId: item.id, pedidoId: item.pedido_id,
      de: item.status, para: volta_para, ator: e.ator, motivo: "desfazer",
    });
    await sincronizarPedido(c, item.pedido_id);
    await fecha(c, e.semTransacao);
    return {
      ok: true, repetido: false, de: item.status, para: volta_para,
      itemId: item.id, pedidoId: item.pedido_id, lojaId: ev.loja_id,
    };
  } catch (erro) {
    if (!(erro instanceof ErroKds)) await volta(c, e.semTransacao);
    throw erro;
  }
}

// ---------------------------------------------------------------------------
// COMANDA
// ---------------------------------------------------------------------------
export interface MoverSessaoEntrada {
  negocioId: string;
  sessaoId: string;
  para: EstadoSessao;
  ator: Ator;
  motivo?: string | null;
  /** Fechar com saldo em aberto (o garçom recebeu na maquininha). Exige motivo. */
  permitirSaldoAberto?: boolean;
  semTransacao?: boolean;
}

export interface MoverSessaoSaida {
  ok: true; repetido: boolean; de: EstadoSessao | null; para: EstadoSessao;
  sessaoId: string; saldoAberto: number; fiscalEnfileirado: boolean;
}

export async function moverSessao(c: ClienteSQL, e: MoverSessaoEntrada): Promise<MoverSessaoSaida> {
  if (!ESTADOS_SESSAO.includes(e.para)) {
    throw new ErroKds("ESTADO_DESCONHECIDO", `Estado "${e.para}" não existe para a comanda.`);
  }
  await abre(c, e.semTransacao);
  try {
    const s = (await c.query<{
      id: string; status: EstadoSessao; loja_id: string; total: string; pago: string;
      fiscal_ativo: boolean;
    }>(
      `SELECT s.id, s.status, s.loja_id, s.total, s.pago, l.fiscal_ativo
         FROM food_sessoes s JOIN food_lojas l ON l.id = s.loja_id
        WHERE s.id = $1 AND s.negocio_id = $2 FOR UPDATE OF s`,
      [e.sessaoId, e.negocioId]
    )).rows[0];
    if (!s) {
      await volta(c, e.semTransacao);
      throw new ErroKds("SESSAO_NAO_ENCONTRADA", "Comanda não encontrada nesta casa.");
    }

    const saldo = Math.round((n(s.total) - n(s.pago)) * 100) / 100;

    if (s.status === e.para) {
      await fecha(c, e.semTransacao);
      return { ok: true, repetido: true, de: s.status, para: e.para, sessaoId: s.id, saldoAberto: saldo, fiscalEnfileirado: false };
    }
    if (!podeSessao(s.status, e.para)) {
      await volta(c, e.semTransacao);
      const saidas = TRANSICOES_SESSAO[s.status] ?? [];
      throw new ErroKds("TRANSICAO_INVALIDA",
        saidas.length
          ? `Comanda ${s.status} só pode ir para: ${saidas.join(", ")}.`
          : `Comanda ${s.status} não muda mais de estado.`,
        `${s.status} -> ${e.para}`);
    }

    // Régua do dinheiro: paga só com a conta coberta.
    if (e.para === "paga" && saldo > 0.01 && !e.permitirSaldoAberto) {
      await volta(c, e.semTransacao);
      throw new ErroKds("CONTA_EM_ABERTO", `Ainda faltam R$ ${saldo.toFixed(2)} para a conta fechar.`);
    }
    // Fechar fora da régua continua possível (recebeu na maquininha), mas é
    // sempre registrado com motivo e com o valor que faltou.
    if (e.para === "fechada" && saldo > 0.01 && !String(e.motivo ?? "").trim()) {
      await volta(c, e.semTransacao);
      throw new ErroKds("MOTIVO_OBRIGATORIO",
        `Fechar com R$ ${saldo.toFixed(2)} em aberto exige motivo.`);
    }

    await c.query(
      `UPDATE food_sessoes
          SET status = $3,
              conta_pedida_em = CASE WHEN $3 = 'conta_pedida' THEN COALESCE(conta_pedida_em, now()) ELSE conta_pedida_em END,
              em_pagamento_em = CASE WHEN $3 = 'em_pagamento' THEN COALESCE(em_pagamento_em, now()) ELSE em_pagamento_em END,
              paga_em     = CASE WHEN $3 = 'paga'    THEN COALESCE(paga_em, now())     ELSE paga_em END,
              fechada_em  = CASE WHEN $3 IN ('fechada','cancelada') THEN now() ELSE fechada_em END,
              fechada_por = CASE WHEN $3 IN ('fechada','cancelada') THEN $4 ELSE fechada_por END
        WHERE id = $1 AND negocio_id = $2`,
      [s.id, e.negocioId, e.para, e.ator.nome ?? e.ator.tipo]
    );

    await c.query(
      `INSERT INTO food_sessao_eventos
         (negocio_id, loja_id, sessao_id, de, para, ator_tipo, ator_id, ator_nome, origem, motivo, valor_aberto)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [e.negocioId, s.loja_id, s.id, s.status, e.para, e.ator.tipo, e.ator.id ?? null,
       e.ator.nome ?? null, e.ator.origem ?? null, e.motivo ?? null,
       saldo > 0.01 ? saldo.toFixed(2) : null]
    );

    // Fiscal: a comanda paga entra na fila. Se a SEFAZ estiver fora, a linha
    // fica em erro e é reprocessada. A comanda NUNCA volta para aberta.
    let fiscalEnfileirado = false;
    if (e.para === "paga" && s.fiscal_ativo) {
      const r = await c.query<{ id: string }>(
        `INSERT INTO food_fiscal_fila (negocio_id, loja_id, sessao_id)
         VALUES ($1,$2,$3)
         ON CONFLICT (sessao_id) WHERE sessao_id IS NOT NULL DO NOTHING
         RETURNING id`,
        [e.negocioId, s.loja_id, s.id]
      );
      fiscalEnfileirado = r.rows.length > 0;
    }

    await fecha(c, e.semTransacao);
    return { ok: true, repetido: false, de: s.status, para: e.para, sessaoId: s.id, saldoAberto: saldo, fiscalEnfileirado };
  } catch (erro) {
    if (!(erro instanceof ErroKds)) await volta(c, e.semTransacao);
    throw erro;
  }
}

/**
 * Empurra a comanda pela régua do dinheiro depois de um pagamento confirmado:
 * aberta ou conta_pedida viram em_pagamento, e em_pagamento vira paga quando a
 * conta está coberta. Silencioso: nunca levanta erro no meio de um pagamento.
 */
export async function acertarSessaoAposPagamento(
  c: ClienteSQL, negocioId: string, sessaoId: string, ator: Ator
): Promise<void> {
  const s = (await c.query<{ status: EstadoSessao; total: string; pago: string }>(
    "SELECT status, total, pago FROM food_sessoes WHERE id = $1 AND negocio_id = $2",
    [sessaoId, negocioId]
  )).rows[0];
  if (!s) return;
  const saldo = n(s.total) - n(s.pago);
  const passos: EstadoSessao[] = [];
  // Pagamento parcial em mesa aberta NÃO muda o estado: no bar, quem pagou a
  // primeira rodada continua pedindo. Só anda quando a conta foi pedida ou
  // quando a conta inteira ficou coberta.
  const anda = saldo <= 0.01 || s.status === "conta_pedida";
  if (anda && (s.status === "aberta" || s.status === "conta_pedida")) passos.push("em_pagamento");
  if (saldo <= 0.01) passos.push("paga");
  for (const passo of passos) {
    try {
      await moverSessao(c, { negocioId, sessaoId, para: passo, ator, semTransacao: true });
    } catch { /* a régua não atrapalha o recebimento */ }
  }
}

// ---------------------------------------------------------------------------
// LEITURA: o estado que a tela da cozinha consome
// ---------------------------------------------------------------------------
export interface ItemKds {
  id: string;
  nome_snapshot: string;
  qtd: string;
  obs: string | null;
  restricao: string | null;
  alergenicos: string[] | null;
  opcoes_json: { nome: string }[] | null;
  status: EstadoItem;
  area_id: string | null;
  area_nome: string | null;
  produto_id: string | null;
  produto_esgotado: boolean | null;
  meta_min: number;
  criado_em: string;
  producao_em: string | null;
  pronto_em: string | null;
  pedido_numero: number;
  pedido_id: string;
  canal: string;
  mesa_numero: string | null;
  pedido_criado_em: string;
}

export async function estadoKds(
  c: ClienteSQL, negocioId: string, lojaId: string, areaId?: string | null
): Promise<ItemKds[]> {
  const params: unknown[] = [negocioId, lojaId];
  let filtro = "";
  if (areaId) { params.push(areaId); filtro = `AND i.area_id = $${params.length}`; }
  return (await c.query<ItemKds>(
    `SELECT i.id, i.nome_snapshot, i.qtd, i.obs, i.restricao, i.opcoes_json, i.status, i.area_id,
            i.produto_id, i.criado_em, i.producao_em, i.pronto_em,
            pr.alergenicos,
            COALESCE(i.meta_min, pr.tempo_preparo, a.meta_min, l.tempo_preparo_min, 20) AS meta_min,
            a.nome AS area_nome, pr.esgotado AS produto_esgotado,
            p.id AS pedido_id, p.numero_dia AS pedido_numero, p.canal,
            p.criado_em AS pedido_criado_em, m.numero AS mesa_numero
       FROM food_itens i
       JOIN food_pedidos p ON p.id = i.pedido_id
       JOIN food_lojas   l ON l.id = p.loja_id
       LEFT JOIN food_areas    a  ON a.id  = i.area_id
       LEFT JOIN food_produtos pr ON pr.id = i.produto_id
       LEFT JOIN food_mesas    m  ON m.id  = p.mesa_id
      WHERE i.negocio_id = $1 AND p.loja_id = $2 ${filtro}
        AND p.status NOT IN ('pendente','cancelado')
        AND i.status IN ('pendente','em_producao','pronto')
      ORDER BY p.criado_em ASC, i.criado_em ASC`,
    params
  )).rows;
}

/**
 * Revisão barata do estado da loja. O canal de tempo real só compara esta
 * string; quando ela muda, a tela busca o estado completo de novo.
 */
export async function revisaoKds(c: ClienteSQL, lojaId: string): Promise<string> {
  const r = (await c.query<{ itens: string; qtd: string; chamados: string; cardapio: string }>(
    `SELECT COALESCE((EXTRACT(EPOCH FROM MAX(i.atualizado_em)) * 1000)::bigint, 0)::text AS itens,
            COUNT(i.id)::text AS qtd,
            (SELECT COUNT(*) FROM food_chamados WHERE loja_id = $1 AND status = 'aberto')::text AS chamados,
            (SELECT cardapio_rev FROM food_lojas WHERE id = $1)::text AS cardapio
       FROM food_itens i
       JOIN food_pedidos p ON p.id = i.pedido_id
      WHERE p.loja_id = $1 AND p.criado_em > now() - interval '2 days'`,
    [lojaId]
  )).rows[0];
  return `${r?.itens ?? 0}.${r?.qtd ?? 0}.${r?.chamados ?? 0}.${r?.cardapio ?? 0}`;
}

/** O que o painel do salão mostra da cozinha: fila e atraso por praça. */
export async function resumoPorArea(c: ClienteSQL, negocioId: string, lojaId: string) {
  return (await c.query<{
    area_id: string | null; area_nome: string | null;
    pendentes: string; producao: string; prontos: string; estourados: string; espera_max: string;
  }>(
    `SELECT i.area_id, COALESCE(a.nome, 'Sem praça') AS area_nome,
            COUNT(*) FILTER (WHERE i.status = 'pendente')::text     AS pendentes,
            COUNT(*) FILTER (WHERE i.status = 'em_producao')::text  AS producao,
            COUNT(*) FILTER (WHERE i.status = 'pronto')::text       AS prontos,
            COUNT(*) FILTER (
              WHERE i.status IN ('pendente','em_producao')
                AND EXTRACT(EPOCH FROM (now() - i.criado_em)) / 60
                    > COALESCE(i.meta_min, pr.tempo_preparo, a.meta_min, l.tempo_preparo_min, 20)
            )::text AS estourados,
            COALESCE(MAX(EXTRACT(EPOCH FROM (now() - i.criado_em)) / 60)
                     FILTER (WHERE i.status IN ('pendente','em_producao')), 0)::int::text AS espera_max
       FROM food_itens i
       JOIN food_pedidos p ON p.id = i.pedido_id
       JOIN food_lojas   l ON l.id = p.loja_id
       LEFT JOIN food_areas    a  ON a.id  = i.area_id
       LEFT JOIN food_produtos pr ON pr.id = i.produto_id
      WHERE i.negocio_id = $1 AND p.loja_id = $2
        AND p.status NOT IN ('pendente','cancelado')
        AND i.status IN ('pendente','em_producao','pronto')
      GROUP BY i.area_id, a.nome
      ORDER BY 2`,
    [negocioId, lojaId]
  )).rows;
}

// ---------------------------------------------------------------------------
// 86: acabou. Some do cardápio de todo mundo, inclusive de quem já está com o
// celular aberto (o `cardapio_rev` é o que avisa).
// ---------------------------------------------------------------------------
export async function marcar86(
  c: ClienteSQL,
  e: { negocioId: string; lojaId: string; produtoId: string; esgotado: boolean; ator: Ator }
): Promise<{ ok: true; nome: string | null; esgotado: boolean }> {
  const r = (await c.query<{ nome: string }>(
    `UPDATE food_produtos
        SET esgotado = $3,
            esgotado_ate = CASE WHEN $3 THEN (now() + interval '12 hours') ELSE NULL END
      WHERE id = $1 AND negocio_id = $2
      RETURNING nome`,
    [e.produtoId, e.negocioId, e.esgotado]
  )).rows[0];
  if (!r) throw new ErroKds("PRODUTO_NAO_ENCONTRADO", "Produto não encontrado nesta casa.");
  await bumpCardapio(c, e.lojaId);
  return { ok: true, nome: r.nome ?? null, esgotado: e.esgotado };
}

/** Sobe o contador do cardápio: é o sinal que o celular do cliente compara. */
export async function bumpCardapio(c: ClienteSQL, lojaId: string): Promise<void> {
  await c.query("UPDATE food_lojas SET cardapio_rev = cardapio_rev + 1 WHERE id = $1", [lojaId]);
}

/**
 * Devolve produtos que voltaram sozinhos do 86 (o `esgotado_ate` venceu).
 * Chamado na leitura do cardápio: sem cron, sem tarefa esquecida.
 */
export async function liberarEsgotadosVencidos(c: ClienteSQL, lojaId: string): Promise<number> {
  const r = await c.query<{ id: string }>(
    `UPDATE food_produtos
        SET esgotado = false, esgotado_ate = NULL
      WHERE loja_id = $1 AND esgotado = true
        AND esgotado_ate IS NOT NULL AND esgotado_ate < now()
      RETURNING id`,
    [lojaId]
  );
  if (r.rows.length) await bumpCardapio(c, lojaId);
  return r.rows.length;
}

/** A linha do tempo de um item, para o dono responder "quem cancelou isso?". */
export async function historicoItem(c: ClienteSQL, negocioId: string, itemId: string) {
  return (await c.query<{
    de: string | null; para: string; ator_tipo: string; ator_nome: string | null;
    origem: string | null; motivo: string | null; criado_em: string;
  }>(
    `SELECT de, para, ator_tipo, ator_nome, origem, motivo, criado_em
       FROM food_item_eventos
      WHERE item_id = $1 AND negocio_id = $2
      ORDER BY criado_em ASC`,
    [itemId, negocioId]
  )).rows;
}
