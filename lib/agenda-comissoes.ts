import "server-only";
import { pool, query } from "./db";

const FUSO_NEGOCIO = "America/Sao_Paulo";

export type TipoLancamentoProfissional = "vale" | "adiantamento" | "consumo";
export type StatusFechamentoComissao = "aberto" | "fechado" | "pago";

export type PeriodoComissao = {
  mes: string;
  inicio: string;
  fim: string;
  rotulo: string;
};

export type ResumoComissao = {
  servicos_cent: number;
  produtos_cent: number;
  comissao_cent: number;
  lancamentos_cent: number;
  liquido_cent: number;
};

export type FechamentoComissao = ResumoComissao & {
  id: string;
  status: StatusFechamentoComissao;
  fechado_em: string | null;
  pago_em: string | null;
  observacao: string | null;
};

export type MovimentoComissao = {
  id: string;
  data: string;
  categoria: "servico" | "produto" | "pacote" | TipoLancamentoProfissional | "bonus" | "desconto";
  descricao: string;
  referencia: string | null;
  base_cent: number | null;
  valor_cent: number;
};

export type ExtratoComissao = {
  resumo: ResumoComissao;
  fechamento: FechamentoComissao | null;
  movimentos: MovimentoComissao[];
};

type LinhaResumo = Omit<ResumoComissao, "lancamentos_cent" | "liquido_cent">;

function numero(valor: unknown): number {
  const convertido = Number(valor ?? 0);
  return Number.isFinite(convertido) ? convertido : 0;
}

export function mesAtualComissao(agora = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_NEGOCIO,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(agora);
  const ano = partes.find((p) => p.type === "year")?.value;
  const mes = partes.find((p) => p.type === "month")?.value;
  return ano && mes ? `${ano}-${mes}` : agora.toISOString().slice(0, 7);
}

export function hojeComissao(agora = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_NEGOCIO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(agora);
  const valor = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((p) => p.type === tipo)?.value;
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

export function periodoMensal(valor?: string | null, agora = new Date()): PeriodoComissao {
  const candidato = /^\d{4}-(0[1-9]|1[0-2])$/.test(valor ?? "")
    ? String(valor)
    : mesAtualComissao(agora);
  const [ano, mes] = candidato.split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const rotulo = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(ano, mes - 1, 1)));
  return {
    mes: candidato,
    inicio: `${candidato}-01`,
    fim: `${candidato}-${String(ultimoDia).padStart(2, "0")}`,
    rotulo: rotulo.charAt(0).toUpperCase() + rotulo.slice(1),
  };
}

export async function extratoComissao(
  negocioId: string,
  profissionalId: string,
  periodo: PeriodoComissao,
): Promise<ExtratoComissao> {
  const [resumoResultado, lancamentosResultado, fechamentoResultado, movimentosResultado] = await Promise.all([
    query<LinhaResumo>(
      `SELECT
         coalesce(sum(i.total_cent) FILTER (WHERE i.tipo = 'servico'), 0)::float8 AS servicos_cent,
         coalesce(sum(i.total_cent) FILTER (WHERE i.tipo = 'produto'), 0)::float8 AS produtos_cent,
         coalesce(sum(i.comissao_cent), 0)::float8 AS comissao_cent
       FROM agenda_comanda_itens i
       JOIN agenda_comandas c
         ON c.id = i.comanda_id AND c.negocio_id = i.negocio_id
      WHERE i.negocio_id = $1
        AND i.profissional_id = $2
        AND c.status = 'fechada'
        AND (c.fechada_em AT TIME ZONE $5)::date BETWEEN $3::date AND $4::date`,
      [negocioId, profissionalId, periodo.inicio, periodo.fim, FUSO_NEGOCIO],
    ),
    query<{ lancamentos_cent: number }>(
      `SELECT coalesce(sum(
         CASE WHEN tipo = 'bonus' THEN valor_cent ELSE -valor_cent END
       ), 0)::float8 AS lancamentos_cent
       FROM agenda_profissional_lancamentos
      WHERE negocio_id = $1
        AND profissional_id = $2
        AND data BETWEEN $3::date AND $4::date`,
      [negocioId, profissionalId, periodo.inicio, periodo.fim],
    ),
    query<FechamentoComissao>(
      `SELECT id, status, fechado_em::text, pago_em::text, observacao,
              servicos_cent::float8 AS servicos_cent,
              produtos_cent::float8 AS produtos_cent,
              comissao_cent::float8 AS comissao_cent,
              lancamentos_cent::float8 AS lancamentos_cent,
              liquido_cent::float8 AS liquido_cent
         FROM agenda_comissao_fechamentos
        WHERE negocio_id = $1
          AND profissional_id = $2
          AND periodo_inicio = $3::date
          AND periodo_fim = $4::date
        LIMIT 1`,
      [negocioId, profissionalId, periodo.inicio, periodo.fim],
    ),
    query<MovimentoComissao>(
      `SELECT id, data::text, categoria, descricao, referencia,
              base_cent::float8 AS base_cent, valor_cent::float8 AS valor_cent
         FROM (
           SELECT i.id,
                  (c.fechada_em AT TIME ZONE $5)::date AS data,
                  i.tipo AS categoria,
                  i.descricao,
                  CASE WHEN c.numero IS NULL THEN NULL ELSE 'Comanda ' || c.numero::text END AS referencia,
                  i.total_cent AS base_cent,
                  i.comissao_cent AS valor_cent,
                  i.criado_em
             FROM agenda_comanda_itens i
             JOIN agenda_comandas c
               ON c.id = i.comanda_id AND c.negocio_id = i.negocio_id
            WHERE i.negocio_id = $1
              AND i.profissional_id = $2
              AND c.status = 'fechada'
              AND (c.fechada_em AT TIME ZONE $5)::date BETWEEN $3::date AND $4::date
           UNION ALL
           SELECT l.id, l.data, l.tipo AS categoria,
                  coalesce(nullif(l.descricao, ''), initcap(l.tipo)) AS descricao,
                  NULL AS referencia, NULL AS base_cent,
                  CASE WHEN l.tipo = 'bonus' THEN l.valor_cent ELSE -l.valor_cent END AS valor_cent,
                  l.criado_em
             FROM agenda_profissional_lancamentos l
            WHERE l.negocio_id = $1
              AND l.profissional_id = $2
              AND l.data BETWEEN $3::date AND $4::date
         ) movimentos
        ORDER BY data DESC, criado_em DESC`,
      [negocioId, profissionalId, periodo.inicio, periodo.fim, FUSO_NEGOCIO],
    ),
  ]);

  const linha = resumoResultado.rows[0];
  const lancamentos = numero(lancamentosResultado.rows[0]?.lancamentos_cent);
  const resumoAoVivo: ResumoComissao = {
    servicos_cent: numero(linha?.servicos_cent),
    produtos_cent: numero(linha?.produtos_cent),
    comissao_cent: numero(linha?.comissao_cent),
    lancamentos_cent: lancamentos,
    liquido_cent: numero(linha?.comissao_cent) + lancamentos,
  };
  const fechamento = fechamentoResultado.rows[0] ?? null;
  const resumo = fechamento && fechamento.status !== "aberto"
    ? {
        servicos_cent: numero(fechamento.servicos_cent),
        produtos_cent: numero(fechamento.produtos_cent),
        comissao_cent: numero(fechamento.comissao_cent),
        lancamentos_cent: numero(fechamento.lancamentos_cent),
        liquido_cent: numero(fechamento.liquido_cent),
      }
    : resumoAoVivo;

  return {
    resumo,
    fechamento,
    movimentos: movimentosResultado.rows.map((movimento) => ({
      ...movimento,
      base_cent: movimento.base_cent === null ? null : numero(movimento.base_cent),
      valor_cent: numero(movimento.valor_cent),
    })),
  };
}

export async function registrarLancamentoProfissional(
  negocioId: string,
  profissionalId: string,
  entrada: {
    tipo: TipoLancamentoProfissional;
    valor_cent: number;
    descricao?: string | null;
    data: string;
  },
): Promise<string> {
  if (!["vale", "adiantamento", "consumo"].includes(entrada.tipo)) {
    throw new Error("Tipo de lançamento inválido.");
  }
  if (!Number.isInteger(entrada.valor_cent) || entrada.valor_cent <= 0) {
    throw new Error("Informe um valor maior que zero.");
  }
  if (!dataComissaoValida(entrada.data)) {
    throw new Error("Informe uma data válida.");
  }

  const { rows } = await query<{ id: string }>(
    `INSERT INTO agenda_profissional_lancamentos
       (negocio_id, profissional_id, tipo, valor_cent, descricao, data)
     SELECT $1, p.id, $3, $4, $5, $6::date
       FROM agenda_profissionais p
      WHERE p.negocio_id = $1
        AND p.id = $2
        AND NOT EXISTS (
          SELECT 1
            FROM agenda_comissao_fechamentos f
           WHERE f.negocio_id = $1
             AND f.profissional_id = p.id
             AND $6::date BETWEEN f.periodo_inicio AND f.periodo_fim
             AND f.status IN ('fechado','pago')
        )
     RETURNING id`,
    [
      negocioId,
      profissionalId,
      entrada.tipo,
      entrada.valor_cent,
      entrada.descricao?.trim().slice(0, 240) || null,
      entrada.data,
    ],
  );
  if (!rows[0]) {
    throw new Error("Profissional não encontrado ou período já fechado.");
  }
  return rows[0].id;
}

function dataComissaoValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const data = new Date(`${valor}T12:00:00Z`);
  return Number.isFinite(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}

function fechamentoDaLinha(linha: FechamentoComissao): FechamentoComissao {
  return {
    ...linha,
    servicos_cent: numero(linha.servicos_cent),
    produtos_cent: numero(linha.produtos_cent),
    comissao_cent: numero(linha.comissao_cent),
    lancamentos_cent: numero(linha.lancamentos_cent),
    liquido_cent: numero(linha.liquido_cent),
  };
}

export async function fecharComissaoMensal(
  negocioId: string,
  profissionalId: string,
  periodo: PeriodoComissao,
  observacao?: string | null,
): Promise<FechamentoComissao> {
  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");
    await cliente.query(
      "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
      [negocioId, `${profissionalId}:${periodo.inicio}:${periodo.fim}`],
    );

    const profissional = await cliente.query<{ id: string }>(
      `SELECT id FROM agenda_profissionais
        WHERE negocio_id = $1 AND id = $2
        FOR UPDATE`,
      [negocioId, profissionalId],
    );
    if (!profissional.rows[0]) throw new Error("Profissional não encontrado.");

    const anterior = await cliente.query<FechamentoComissao>(
      `SELECT id, status, fechado_em::text, pago_em::text, observacao,
              servicos_cent::float8 AS servicos_cent,
              produtos_cent::float8 AS produtos_cent,
              comissao_cent::float8 AS comissao_cent,
              lancamentos_cent::float8 AS lancamentos_cent,
              liquido_cent::float8 AS liquido_cent
         FROM agenda_comissao_fechamentos
        WHERE negocio_id = $1 AND profissional_id = $2
          AND periodo_inicio = $3::date AND periodo_fim = $4::date
        FOR UPDATE`,
      [negocioId, profissionalId, periodo.inicio, periodo.fim],
    );
    if (anterior.rows[0] && anterior.rows[0].status !== "aberto") {
      await cliente.query("COMMIT");
      return fechamentoDaLinha(anterior.rows[0]);
    }

    const totais = await cliente.query<LinhaResumo>(
      `SELECT
         coalesce(sum(i.total_cent) FILTER (WHERE i.tipo = 'servico'), 0)::float8 AS servicos_cent,
         coalesce(sum(i.total_cent) FILTER (WHERE i.tipo = 'produto'), 0)::float8 AS produtos_cent,
         coalesce(sum(i.comissao_cent), 0)::float8 AS comissao_cent
       FROM agenda_comanda_itens i
       JOIN agenda_comandas c
         ON c.id = i.comanda_id AND c.negocio_id = i.negocio_id
      WHERE i.negocio_id = $1 AND i.profissional_id = $2
        AND c.status = 'fechada'
        AND (c.fechada_em AT TIME ZONE $5)::date BETWEEN $3::date AND $4::date`,
      [negocioId, profissionalId, periodo.inicio, periodo.fim, FUSO_NEGOCIO],
    );
    const ajustes = await cliente.query<{ lancamentos_cent: number }>(
      `SELECT coalesce(sum(
         CASE WHEN tipo = 'bonus' THEN valor_cent ELSE -valor_cent END
       ), 0)::float8 AS lancamentos_cent
         FROM agenda_profissional_lancamentos
        WHERE negocio_id = $1 AND profissional_id = $2
          AND data BETWEEN $3::date AND $4::date`,
      [negocioId, profissionalId, periodo.inicio, periodo.fim],
    );

    const total = totais.rows[0];
    const servicosCent = numero(total?.servicos_cent);
    const produtosCent = numero(total?.produtos_cent);
    const comissaoCent = numero(total?.comissao_cent);
    const lancamentosCent = numero(ajustes.rows[0]?.lancamentos_cent);
    const liquidoCent = comissaoCent + lancamentosCent;
    const salvo = await cliente.query<FechamentoComissao>(
      `INSERT INTO agenda_comissao_fechamentos
         (negocio_id, profissional_id, periodo_inicio, periodo_fim,
          servicos_cent, produtos_cent, comissao_cent, lancamentos_cent,
          liquido_cent, status, fechado_em, observacao)
       VALUES ($1,$2,$3::date,$4::date,$5,$6,$7,$8,$9,'fechado',now(),$10)
       ON CONFLICT (profissional_id, periodo_inicio, periodo_fim)
       DO UPDATE SET servicos_cent = EXCLUDED.servicos_cent,
                     produtos_cent = EXCLUDED.produtos_cent,
                     comissao_cent = EXCLUDED.comissao_cent,
                     lancamentos_cent = EXCLUDED.lancamentos_cent,
                     liquido_cent = EXCLUDED.liquido_cent,
                     status = 'fechado', fechado_em = now(),
                     observacao = EXCLUDED.observacao
       WHERE agenda_comissao_fechamentos.negocio_id = EXCLUDED.negocio_id
         AND agenda_comissao_fechamentos.status = 'aberto'
       RETURNING id, status, fechado_em::text, pago_em::text, observacao,
                 servicos_cent::float8 AS servicos_cent,
                 produtos_cent::float8 AS produtos_cent,
                 comissao_cent::float8 AS comissao_cent,
                 lancamentos_cent::float8 AS lancamentos_cent,
                 liquido_cent::float8 AS liquido_cent`,
      [
        negocioId, profissionalId, periodo.inicio, periodo.fim,
        servicosCent, produtosCent, comissaoCent, lancamentosCent, liquidoCent,
        observacao?.trim().slice(0, 500) || null,
      ],
    );
    if (!salvo.rows[0]) throw new Error("Este mês já foi fechado.");
    await cliente.query("COMMIT");
    return fechamentoDaLinha(salvo.rows[0]);
  } catch (erro) {
    await cliente.query("ROLLBACK");
    throw erro;
  } finally {
    cliente.release();
  }
}
