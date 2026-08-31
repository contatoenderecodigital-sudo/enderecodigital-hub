import "server-only";
import { query } from "./db";

// ============================================================================
//  MODULO VEICULOS · a camada de dados
//
//  A REGRA QUE NAO SE QUEBRA: toda funcao daqui recebe negocioId como PRIMEIRO
//  argumento, obrigatorio, sem valor padrao. Nao existe funcao neste arquivo
//  que leia estoque sem saber de quem e.
//
//  Motivo pratico: as chaves compostas no banco impedem GRAVAR cruzado, mas
//  nao impedem LER. Um select sem WHERE negocio_id lista o estoque de todo
//  mundo. O banco cobre a escrita; este arquivo cobre a leitura.
//
//  Quem chama pega o negocioId do activeNegocioId(sessao), nunca da URL.
//  Id vindo da URL e do usuario, e usuario mente.
//
//  DINHEIRO EM CENTAVOS, igual ao resto do hub. Converter so na borda, na hora
//  de mostrar. Guardar real quebrado em float e como se perde centavo.
// ============================================================================

export type StatusVeiculo = "preparacao" | "disponivel" | "reservado" | "vendido" | "arquivado";

export type Veiculo = {
  id: string;
  filial_id: string | null;
  filial_nome: string | null;
  marca: string;
  modelo: string;
  versao: string | null;
  ano_fabricacao: number;
  ano_modelo: number;
  km: number;
  cor: string | null;
  cambio: string | null;
  combustivel: string | null;
  carroceria: string | null;
  placa: string | null;
  preco_cent: number;
  preco_minimo_cent: number | null;
  aceita_troca: boolean;
  aceita_financiamento: boolean;
  unico_dono: boolean;
  revisoes_concessionaria: boolean;
  ipva_pago: boolean;
  licenciado: boolean;
  itens: string[];
  observacoes: string | null;
  status: StatusVeiculo;
  origem: string;
  entrada_em: string;
  vendido_em: string | null;
  publicado: boolean;
  destaque: boolean;
  /** Dias no patio. Calculado no banco, nunca no cliente. */
  dias_parado: number;
  foto_capa: string | null;
  qtd_fotos: number;
};

export type Filial = {
  id: string;
  nome: string;
  nome_curto: string | null;
  cidade: string;
  uf: string;
  whatsapp: string | null;
  horario: string | null;
  ativa: boolean;
  veiculos: number;
};

// As colunas que TODA consulta de veiculo devolve. Fica num lugar so pra as
// telas nao divergirem no que sabem sobre o carro.
const CAMPOS = `
  v.id, v.filial_id, f.nome AS filial_nome,
  v.marca, v.modelo, v.versao, v.ano_fabricacao, v.ano_modelo, v.km, v.cor,
  v.cambio, v.combustivel, v.carroceria, v.placa,
  v.preco_cent, v.preco_minimo_cent,
  v.aceita_troca, v.aceita_financiamento,
  v.unico_dono, v.revisoes_concessionaria, v.ipva_pago, v.licenciado,
  v.itens, v.observacoes, v.status, v.origem,
  v.entrada_em, v.vendido_em, v.publicado, v.destaque,
  (CURRENT_DATE - v.entrada_em)::int AS dias_parado,
  (SELECT url FROM veiculo_fotos ft
    WHERE ft.veiculo_id = v.id ORDER BY ft.ordem, ft.criado_em LIMIT 1) AS foto_capa,
  (SELECT count(*)::int FROM veiculo_fotos ft WHERE ft.veiculo_id = v.id) AS qtd_fotos
`;

// ----------------------------------------------------------------------------
//  ESTOQUE
// ----------------------------------------------------------------------------
export type FiltroEstoque = {
  status?: StatusVeiculo;
  filialId?: string;
  busca?: string;
  /** Só o que está no ar. */
  publicado?: boolean;
};

export async function listarVeiculos(
  negocioId: string,
  filtro: FiltroEstoque = {},
): Promise<Veiculo[]> {
  const cond: string[] = ["v.negocio_id = $1"];
  const args: unknown[] = [negocioId];

  if (filtro.status) {
    cond.push(`v.status = $${args.length + 1}`);
    args.push(filtro.status);
  }
  if (filtro.filialId) {
    cond.push(`v.filial_id = $${args.length + 1}`);
    args.push(filtro.filialId);
  }
  if (filtro.publicado !== undefined) {
    cond.push(`v.publicado = $${args.length + 1}`);
    args.push(filtro.publicado);
  }
  if (filtro.busca?.trim()) {
    // unaccent dos dois lados: quem digita "corola" ou "Corolla" acha o carro.
    cond.push(
      `unaccent(lower(v.marca || ' ' || v.modelo || ' ' || coalesce(v.versao,'')))
         LIKE unaccent(lower($${args.length + 1}))`,
    );
    args.push(`%${filtro.busca.trim()}%`);
  }

  const { rows } = await query<Veiculo>(
    `SELECT ${CAMPOS}
       FROM veiculos v
       LEFT JOIN filiais f ON f.id = v.filial_id
      WHERE ${cond.join(" AND ")}
      ORDER BY v.destaque DESC, v.entrada_em DESC`,
    args,
  );
  return rows;
}

export async function buscarVeiculo(negocioId: string, id: string): Promise<Veiculo | null> {
  const { rows } = await query<Veiculo>(
    `SELECT ${CAMPOS}
       FROM veiculos v
       LEFT JOIN filiais f ON f.id = v.filial_id
      WHERE v.negocio_id = $1 AND v.id = $2`,
    [negocioId, id],
  );
  return rows[0] ?? null;
}

export async function fotosDoVeiculo(negocioId: string, veiculoId: string) {
  const { rows } = await query<{ id: string; url: string; ordem: number }>(
    `SELECT id, url, ordem FROM veiculo_fotos
      WHERE negocio_id = $1 AND veiculo_id = $2
      ORDER BY ordem, criado_em`,
    [negocioId, veiculoId],
  );
  return rows;
}

// ----------------------------------------------------------------------------
//  PRECO
//
//  Passa por aqui SEMPRE, nunca por update direto na tabela. É esta funcao que
//  grava o historico, e o historico e o que alimenta o aviso de "baixou de
//  preco" e o retrato de quanto tempo o carro ficou no preco errado.
// ----------------------------------------------------------------------------
export async function mudarPreco(
  negocioId: string,
  veiculoId: string,
  precoCent: number,
  usuarioId: string | null,
): Promise<void> {
  const { rows } = await query<{ preco_cent: number }>(
    `SELECT preco_cent FROM veiculos WHERE negocio_id = $1 AND id = $2`,
    [negocioId, veiculoId],
  );
  if (!rows[0]) throw new Error("Veículo não encontrado neste negócio");
  const antigo = rows[0].preco_cent;
  if (antigo === precoCent) return;

  await query(
    `UPDATE veiculos SET preco_cent = $3, atualizado_em = now()
      WHERE negocio_id = $1 AND id = $2`,
    [negocioId, veiculoId, precoCent],
  );
  await query(
    `INSERT INTO veiculo_precos (negocio_id, veiculo_id, preco_antigo_cent, preco_novo_cent, usuario_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [negocioId, veiculoId, antigo, precoCent, usuarioId],
  );
}

// ----------------------------------------------------------------------------
//  RAIO-X DO PATIO
//
//  O diferencial do produto, e a tela que ganha a reunião. Nao e relatorio, que
//  todo sistema tem e ninguem abre: e uma lista do que fazer esta semana.
//
//  Os cortes vem do mercado, nao de chute. O tempo medio de seminovo no Brasil
//  caiu pra 37 dias, e acima de 60 a rentabilidade despenca mesmo com a margem
//  individual parecendo boa.
// ----------------------------------------------------------------------------
export const CORTE_ATENCAO = 45;
export const CORTE_CRITICO = 60;

export type LinhaRaioX = {
  id: string;
  marca: string;
  modelo: string;
  versao: string | null;
  placa: string | null;
  foto_capa: string | null;
  dias_parado: number;
  preco_cent: number;
  custo_total_cent: number;
  /** Margem prevista se vender pelo preço de hoje. */
  margem_cent: number;
  fipe_cent: number | null;
  /** Quanto o preço está acima ou abaixo da FIPE, em pontos percentuais. */
  desvio_fipe: number | null;
  gravidade: "critico" | "atencao" | "ok";
};

export async function raioX(negocioId: string): Promise<LinhaRaioX[]> {
  const { rows } = await query<LinhaRaioX>(
    `WITH custo AS (
       SELECT veiculo_id, sum(valor_cent)::int AS total
         FROM veiculo_custos WHERE negocio_id = $1 GROUP BY veiculo_id
     ),
     -- Só a referência mais recente de cada veículo. Sem o DISTINCT ON, cada
     -- coleta antiga viraria uma linha repetida no raio-X.
     ref AS (
       SELECT DISTINCT ON (veiculo_id) veiculo_id, fipe_cent
         FROM veiculo_referencias WHERE negocio_id = $1
        ORDER BY veiculo_id, criado_em DESC
     )
     SELECT v.id, v.marca, v.modelo, v.versao, v.placa,
            (SELECT url FROM veiculo_fotos ft
              WHERE ft.veiculo_id = v.id ORDER BY ft.ordem LIMIT 1) AS foto_capa,
            (CURRENT_DATE - v.entrada_em)::int AS dias_parado,
            v.preco_cent,
            coalesce(c.total, 0) AS custo_total_cent,
            v.preco_cent - coalesce(c.total, 0) AS margem_cent,
            r.fipe_cent,
            CASE WHEN r.fipe_cent IS NULL OR r.fipe_cent = 0 THEN NULL
                 ELSE round(((v.preco_cent::numeric / r.fipe_cent) - 1) * 100, 1)
            END AS desvio_fipe,
            CASE WHEN (CURRENT_DATE - v.entrada_em) >= $3 THEN 'critico'
                 WHEN (CURRENT_DATE - v.entrada_em) >= $2 THEN 'atencao'
                 ELSE 'ok' END AS gravidade
       FROM veiculos v
       LEFT JOIN custo c ON c.veiculo_id = v.id
       LEFT JOIN ref   r ON r.veiculo_id = v.id
      WHERE v.negocio_id = $1
        AND v.status IN ('disponivel', 'reservado')
      ORDER BY (CURRENT_DATE - v.entrada_em) DESC`,
    [negocioId, CORTE_ATENCAO, CORTE_CRITICO],
  );
  return rows;
}

// ----------------------------------------------------------------------------
//  RESUMO DO PATIO · os quatro numeros do topo do painel
// ----------------------------------------------------------------------------
export type ResumoPatio = {
  disponiveis: number;
  parados: number;
  capital_cent: number;
  media_dias: number;
  vendidos_mes: number;
};

export async function resumoPatio(negocioId: string): Promise<ResumoPatio> {
  const { rows } = await query<ResumoPatio>(
    `SELECT
       count(*) FILTER (WHERE status = 'disponivel')::int AS disponiveis,
       count(*) FILTER (WHERE status = 'disponivel'
                          AND CURRENT_DATE - entrada_em >= $2)::int AS parados,
       -- Capital parado: o que a loja tem imobilizado no pátio agora.
       coalesce(sum(preco_cent) FILTER (WHERE status = 'disponivel'), 0)::bigint AS capital_cent,
       coalesce(round(avg(CURRENT_DATE - entrada_em)
                      FILTER (WHERE status = 'disponivel')), 0)::int AS media_dias,
       count(*) FILTER (WHERE status = 'vendido'
                          AND vendido_em >= date_trunc('month', CURRENT_DATE))::int AS vendidos_mes
     FROM veiculos WHERE negocio_id = $1`,
    [negocioId, CORTE_CRITICO],
  );
  return rows[0];
}

// ----------------------------------------------------------------------------
//  FILIAIS
// ----------------------------------------------------------------------------
export async function listarFiliais(negocioId: string): Promise<Filial[]> {
  const { rows } = await query<Filial>(
    `SELECT f.id, f.nome, f.nome_curto, f.cidade, f.uf, f.whatsapp, f.horario, f.ativa,
            (SELECT count(*)::int FROM veiculos v
              WHERE v.filial_id = f.id AND v.status = 'disponivel') AS veiculos
       FROM filiais f
      WHERE f.negocio_id = $1
      ORDER BY f.ativa DESC, f.nome`,
    [negocioId],
  );
  return rows;
}

// ----------------------------------------------------------------------------
//  FORMATACAO · centavos viram texto so aqui
// ----------------------------------------------------------------------------
export function emReais(cent: number): string {
  return (cent / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

export function kmEscrito(km: number): string {
  return km === 0 ? "0 km" : `${km.toLocaleString("pt-BR")} km`;
}

/** "2024/2025", ou só o ano quando fabricação e modelo são iguais. */
export function anoEscrito(v: Pick<Veiculo, "ano_fabricacao" | "ano_modelo">): string {
  return v.ano_fabricacao === v.ano_modelo
    ? String(v.ano_modelo)
    : `${v.ano_fabricacao}/${v.ano_modelo}`;
}
