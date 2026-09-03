import type { ClienteSQL } from "./food-kds-sql";

// ============================================================================
// RELATÓRIOS.
//
// Até aqui o dono só tinha o resumo do dia: faturamento, ticket e top 10. Isso
// todo mundo tem. O que ninguém no mercado mostra bem é o que a cozinha faz com
// o tempo, e a matéria-prima disso é a tabela de eventos de transição que o KDS
// passou a gravar: `producao_em`, `pronto_em` e quem mexeu.
//
// Regra do arquivo: todo período é calculado no FUSO DA CASA. Relatório que
// vira o dia às 21h de Xanxerê é relatório que mente.
//
// Como o food-kds-sql: sem import de runtime e com o cliente de banco vindo por
// parametro, para as consultas serem testadas contra um Postgres em memoria.
// ============================================================================

const n = (v: unknown): number => Number(v ?? 0);

export interface Periodo {
  /** AAAA-MM-DD no fuso da casa. Sem isso, "ontem" vira duas noites. */
  de: string;
  ate: string;
}

/** O período padrão: hoje, no fuso da loja. */
export async function periodoPadrao(c: ClienteSQL, lojaId: string): Promise<Periodo> {
  const r = await c.query<{ dia: string }>("SELECT food_dia_loja($1)::text AS dia", [lojaId]);
  const dia = r.rows[0]?.dia ?? new Date().toISOString().slice(0, 10);
  return { de: dia, ate: dia };
}

// ---------------------------------------------------------------------------
// 1. TEMPO POR PRAÇA. O número que decide se contrata mais gente na chapa.
// ---------------------------------------------------------------------------
export async function tempoPorPraca(c: ClienteSQL, negocioId: string, lojaId: string, p: Periodo) {
  return (await c.query<{
    area_nome: string; itens: string;
    espera_media: string; preparo_medio: string; total_medio: string;
    p90: string; estourados: string; meta: string;
  }>(
    `SELECT COALESCE(a.nome, 'Sem praça') AS area_nome,
            COUNT(*)::text AS itens,
            -- da hora do pedido até alguém encostar a mão: é aqui que a fila mora
            ROUND(AVG(EXTRACT(EPOCH FROM (i.producao_em - i.criado_em)) / 60)::numeric, 1)::text AS espera_media,
            -- da mão na massa até sair: o tempo de cozinha de verdade
            ROUND(AVG(EXTRACT(EPOCH FROM (i.pronto_em - i.producao_em)) / 60)::numeric, 1)::text AS preparo_medio,
            -- o que o cliente sente: do pedido ao prato pronto
            ROUND(AVG(EXTRACT(EPOCH FROM (i.pronto_em - i.criado_em)) / 60)::numeric, 1)::text AS total_medio,
            -- o pior décimo, que é o que gera reclamação
            ROUND(PERCENTILE_CONT(0.9) WITHIN GROUP (
              ORDER BY EXTRACT(EPOCH FROM (i.pronto_em - i.criado_em)) / 60)::numeric, 1)::text AS p90,
            COUNT(*) FILTER (
              WHERE EXTRACT(EPOCH FROM (i.pronto_em - i.criado_em)) / 60
                  > COALESCE(i.meta_min, pr.tempo_preparo, a.meta_min, l.tempo_preparo_min, 20)
            )::text AS estourados,
            ROUND(AVG(COALESCE(i.meta_min, pr.tempo_preparo, a.meta_min, l.tempo_preparo_min, 20))::numeric, 0)::text AS meta
       FROM food_itens i
       JOIN food_pedidos p ON p.id = i.pedido_id
       JOIN food_lojas   l ON l.id = p.loja_id
       LEFT JOIN food_areas    a  ON a.id  = i.area_id
       LEFT JOIN food_produtos pr ON pr.id = i.produto_id
      WHERE i.negocio_id = $1 AND p.loja_id = $2
        AND p.dia BETWEEN $3::date AND $4::date
        AND i.pronto_em IS NOT NULL AND i.producao_em IS NOT NULL
      GROUP BY a.nome
      ORDER BY 4 DESC NULLS LAST`,
    [negocioId, lojaId, p.de, p.ate]
  )).rows;
}

// ---------------------------------------------------------------------------
// 2. CURVA POR HORA. Onde a casa ganha dinheiro e onde tem gente parada.
// ---------------------------------------------------------------------------
export async function curvaPorHora(c: ClienteSQL, negocioId: string, lojaId: string, p: Periodo) {
  return (await c.query<{ hora: string; pedidos: string; itens: string; total: string }>(
    `SELECT LPAD(EXTRACT(HOUR FROM (ped.criado_em AT TIME ZONE food_fuso_loja($2)))::text, 2, '0') AS hora,
            COUNT(DISTINCT ped.id)::text AS pedidos,
            COALESCE(SUM(i.qtd), 0)::text AS itens,
            COALESCE(SUM(i.preco_total), 0)::text AS total
       FROM food_pedidos ped
       LEFT JOIN food_itens i ON i.pedido_id = ped.id AND i.status <> 'cancelado'
      WHERE ped.negocio_id = $1 AND ped.loja_id = $2
        AND ped.dia BETWEEN $3::date AND $4::date
        AND ped.status <> 'cancelado'
      GROUP BY 1 ORDER BY 1`,
    [negocioId, lojaId, p.de, p.ate]
  )).rows;
}

// ---------------------------------------------------------------------------
// 3. O QUE MAIS CANCELA, com motivo e autor. Antes ninguém sabia responder.
// ---------------------------------------------------------------------------
export async function maisCancelados(c: ClienteSQL, negocioId: string, lojaId: string, p: Periodo) {
  return (await c.query<{
    nome: string; vezes: string; valor: string; motivo: string | null; quem: string | null;
  }>(
    `SELECT i.nome_snapshot AS nome,
            COUNT(*)::text AS vezes,
            COALESCE(SUM(i.preco_total), 0)::text AS valor,
            MODE() WITHIN GROUP (ORDER BY i.cancelado_motivo) AS motivo,
            MODE() WITHIN GROUP (ORDER BY i.cancelado_por) AS quem
       FROM food_itens i
       JOIN food_pedidos p ON p.id = i.pedido_id
      WHERE i.negocio_id = $1 AND p.loja_id = $2
        AND p.dia BETWEEN $3::date AND $4::date
        AND i.status = 'cancelado'
      GROUP BY 1 ORDER BY COUNT(*) DESC, 3 DESC LIMIT 15`,
    [negocioId, lojaId, p.de, p.ate]
  )).rows;
}

// ---------------------------------------------------------------------------
// 4. QUEM FEZ O QUÊ. Sai da trilha de auditoria do KDS, não de estimativa.
// ---------------------------------------------------------------------------
export async function porPessoa(c: ClienteSQL, negocioId: string, lojaId: string, p: Periodo) {
  return (await c.query<{
    quem: string; papel: string | null; toques: string;
    cancelamentos: string; recebido: string; comandas: string;
  }>(
    `WITH toques AS (
       SELECT COALESCE(e.ator_nome, e.ator_tipo) AS quem,
              COUNT(*) AS toques,
              COUNT(*) FILTER (WHERE e.para = 'cancelado') AS cancelamentos
         FROM food_item_eventos e
         JOIN food_pedidos p ON p.id = e.pedido_id
        WHERE e.negocio_id = $1 AND e.loja_id = $2
          AND p.dia BETWEEN $3::date AND $4::date
          AND e.ator_tipo <> 'sistema'
        GROUP BY 1
     ), dinheiro AS (
       SELECT COALESCE(eq.nome, pg.pago_por, 'não identificado') AS quem,
              COALESCE(SUM(pg.valor + pg.gorjeta), 0) AS recebido,
              COUNT(DISTINCT pg.sessao_id) AS comandas
         FROM food_pagamentos pg
         LEFT JOIN food_equipe eq ON eq.id = pg.recebido_por
        WHERE pg.negocio_id = $1 AND pg.loja_id = $2
          AND (pg.criado_em AT TIME ZONE food_fuso_loja($2))::date BETWEEN $3::date AND $4::date
          AND pg.status = 'confirmado'
        GROUP BY 1
     )
     SELECT COALESCE(t.quem, d.quem) AS quem,
            eq.papel,
            COALESCE(t.toques, 0)::text AS toques,
            COALESCE(t.cancelamentos, 0)::text AS cancelamentos,
            COALESCE(d.recebido, 0)::text AS recebido,
            COALESCE(d.comandas, 0)::text AS comandas
       FROM toques t
       FULL OUTER JOIN dinheiro d ON d.quem = t.quem
       LEFT JOIN food_equipe eq ON eq.nome = COALESCE(t.quem, d.quem) AND eq.loja_id = $2
      ORDER BY 5 DESC, 3 DESC`,
    [negocioId, lojaId, p.de, p.ate]
  )).rows;
}

// ---------------------------------------------------------------------------
// 5. O RETRABALHO. Quantas vezes a cozinha teve que desfazer o que já tinha
// feito. É o número que mostra tela mal usada ou treinamento faltando.
// ---------------------------------------------------------------------------
export async function retrabalho(c: ClienteSQL, negocioId: string, lojaId: string, p: Periodo) {
  const r = (await c.query<{ desfeitos: string; total: string }>(
    `SELECT COUNT(*) FILTER (WHERE e.motivo = 'desfazer')::text AS desfeitos,
            COUNT(*)::text AS total
       FROM food_item_eventos e
       JOIN food_pedidos p ON p.id = e.pedido_id
      WHERE e.negocio_id = $1 AND e.loja_id = $2
        AND p.dia BETWEEN $3::date AND $4::date
        AND e.ator_tipo <> 'sistema'`,
    [negocioId, lojaId, p.de, p.ate]
  )).rows[0];
  const total = n(r?.total);
  return {
    desfeitos: n(r?.desfeitos),
    total,
    pct: total ? Math.round((n(r?.desfeitos) / total) * 1000) / 10 : 0,
  };
}

// ---------------------------------------------------------------------------
// 6. O PERÍODO INTEIRO, para o cabeçalho da tela.
// ---------------------------------------------------------------------------
export async function totaisDoPeriodo(c: ClienteSQL, negocioId: string, lojaId: string, p: Periodo) {
  const t = (await c.query<{
    pedidos: string; faturamento: string; ticket: string; itens: string;
    mesas: string; cancelados: string; descontos: string; servico: string;
  }>(
    `SELECT COUNT(*)::text AS pedidos,
            COALESCE(SUM(total), 0)::text AS faturamento,
            COALESCE(AVG(total), 0)::text AS ticket,
            COALESCE((SELECT SUM(i.qtd) FROM food_itens i
                        JOIN food_pedidos p2 ON p2.id = i.pedido_id
                       WHERE p2.loja_id = $2 AND p2.dia BETWEEN $3::date AND $4::date
                         AND i.status <> 'cancelado'), 0)::text AS itens,
            COALESCE((SELECT COUNT(DISTINCT sessao_id) FROM food_pedidos
                       WHERE loja_id = $2 AND dia BETWEEN $3::date AND $4::date
                         AND sessao_id IS NOT NULL), 0)::text AS mesas,
            COALESCE((SELECT COUNT(*) FROM food_itens i
                        JOIN food_pedidos p3 ON p3.id = i.pedido_id
                       WHERE p3.loja_id = $2 AND p3.dia BETWEEN $3::date AND $4::date
                         AND i.status = 'cancelado'), 0)::text AS cancelados,
            COALESCE((SELECT SUM(s.desconto) FROM food_sessoes s
                       WHERE s.loja_id = $2
                         AND (s.aberta_em AT TIME ZONE food_fuso_loja($2))::date
                             BETWEEN $3::date AND $4::date), 0)::text AS descontos,
            COALESCE((SELECT SUM(s.taxa_servico) FROM food_sessoes s
                       WHERE s.loja_id = $2
                         AND (s.aberta_em AT TIME ZONE food_fuso_loja($2))::date
                             BETWEEN $3::date AND $4::date), 0)::text AS servico
       FROM food_pedidos
      WHERE negocio_id = $1 AND loja_id = $2
        AND dia BETWEEN $3::date AND $4::date AND status <> 'cancelado'`,
    [negocioId, lojaId, p.de, p.ate]
  )).rows[0];

  const canais = (await c.query<{ canal: string; qtd: string; total: string }>(
    `SELECT canal, COUNT(*)::text AS qtd, COALESCE(SUM(total), 0)::text AS total
       FROM food_pedidos
      WHERE negocio_id = $1 AND loja_id = $2
        AND dia BETWEEN $3::date AND $4::date AND status <> 'cancelado'
      GROUP BY 1 ORDER BY 3 DESC`,
    [negocioId, lojaId, p.de, p.ate]
  )).rows;

  const produtos = (await c.query<{ nome: string; qtd: string; total: string }>(
    `SELECT i.nome_snapshot AS nome, SUM(i.qtd)::text AS qtd, SUM(i.preco_total)::text AS total
       FROM food_itens i JOIN food_pedidos p ON p.id = i.pedido_id
      WHERE p.negocio_id = $1 AND p.loja_id = $2
        AND p.dia BETWEEN $3::date AND $4::date
        AND p.status <> 'cancelado' AND i.status <> 'cancelado'
      GROUP BY 1 ORDER BY SUM(i.preco_total) DESC LIMIT 15`,
    [negocioId, lojaId, p.de, p.ate]
  )).rows;

  return { totais: t, canais, produtos };
}

/** Tudo de uma vez, que é como a tela consome. */
export async function relatorioCompleto(c: ClienteSQL, negocioId: string, lojaId: string, p: Periodo) {
  const [periodo, pracas, horas, cancelados, pessoas, refazer] = await Promise.all([
    totaisDoPeriodo(c, negocioId, lojaId, p),
    tempoPorPraca(c, negocioId, lojaId, p),
    curvaPorHora(c, negocioId, lojaId, p),
    maisCancelados(c, negocioId, lojaId, p),
    porPessoa(c, negocioId, lojaId, p),
    retrabalho(c, negocioId, lojaId, p),
  ]);
  return { periodo: p, ...periodo, pracas, horas, cancelados, pessoas, retrabalho: refazer };
}
