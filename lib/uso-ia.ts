import "server-only";

// Camada de leitura da tela PLATAFORMA > Consumo de Tokens.
//
// Fonte única: a tabela uso_ia (uma linha por chamada de IA). Tudo o que a tela
// mostra sai daqui — não existe número inventado na página.
//
// Estratégia de consulta: em vez de uma query por card, a página pede UMA
// matriz agregada por (cliente x empresa de IA x modelo). Os totais gerais, o
// ranking por cliente, o ranking por empresa e o ranking por modelo são todos
// dobras dessa mesma matriz, feitas em JS. Assim os números não podem divergir
// entre si — um card nunca mostra um total que a tabela abaixo não fecha.
//
// Custo: cada linha guarda o custo CALCULADO no momento da chamada (custo_brl)
// junto com o preço e o câmbio vigentes. Linhas gravadas antes desta migração
// têm custo_brl = 0; para elas o custo é reconstruído aqui com a tabela de preço
// atual e o grupo é marcado com `custo_reconstruido` — a tela avisa que aquele
// número foi refeito, não medido na hora.

import { query } from "@/lib/db";
import { custoBRL, economiaCacheBRL, provedorDoModelo, type ProvedorIA } from "@/lib/precos-ia";

// ---------------------------------------------------------------------------
// Migração em runtime (idempotente). Espelha db/migrations/uso-ia-detalhe.sql.
// Existe para a tela não quebrar num ambiente onde o SQL ainda não foi rodado.
// ---------------------------------------------------------------------------
let _colunasOk = false;
export async function ensureColunasUso(): Promise<void> {
  if (_colunasOk) return;
  try {
    await query(`
      ALTER TABLE uso_ia
        ADD COLUMN IF NOT EXISTS provedor           TEXT,
        ADD COLUMN IF NOT EXISTS cache_write        BIGINT NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS cache_read         BIGINT NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS custo_brl          NUMERIC(14,6) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS custo_faturado_brl NUMERIC(14,6),
        ADD COLUMN IF NOT EXISTS preco_in_usd       NUMERIC(12,6),
        ADD COLUMN IF NOT EXISTS preco_out_usd      NUMERIC(12,6),
        ADD COLUMN IF NOT EXISTS usd_brl            NUMERIC(10,4),
        ADD COLUMN IF NOT EXISTS custo_fonte        TEXT NOT NULL DEFAULT 'tabela',
        ADD COLUMN IF NOT EXISTS latencia_ms        INTEGER,
        ADD COLUMN IF NOT EXISTS req_id             TEXT,
        ADD COLUMN IF NOT EXISTS contato            TEXT,
        ADD COLUMN IF NOT EXISTS erro               TEXT`);
    _colunasOk = true;
  } catch {
    // sem privilégio de ALTER: as queries abaixo usam COALESCE em tudo que é
    // coluna nova, então a tela degrada em vez de estourar.
  }
}

// ---------------------------------------------------------------------------
// Filtros
// ---------------------------------------------------------------------------
export interface FiltroUso {
  dias: number; // 0 = período inteiro
  negocioId: string | null;
  provedor: string | null;
  modelo: string | null;
  origem: string | null;
  hubId: string | null; // null = plataforma inteira (todos os hubs)
}

export const PERIODOS = [
  { v: 1, label: "24h" },
  { v: 7, label: "7 dias" },
  { v: 30, label: "30 dias" },
  { v: 90, label: "90 dias" },
  { v: 0, label: "Tudo" },
];

function montarWhere(f: FiltroUso): { sql: string; params: unknown[] } {
  const cond: string[] = [];
  const params: unknown[] = [];
  if (f.hubId) {
    params.push(f.hubId);
    cond.push(`n.hub_id = $${params.length}`);
  }
  if (f.dias > 0) {
    params.push(String(f.dias));
    cond.push(`u.criado_em >= now() - ($${params.length} || ' days')::interval`);
  }
  if (f.negocioId) {
    params.push(f.negocioId);
    cond.push(`u.negocio_id = $${params.length}`);
  }
  if (f.provedor) {
    params.push(f.provedor);
    cond.push(`COALESCE(u.provedor, 'claude') = $${params.length}`);
  }
  if (f.modelo) {
    params.push(f.modelo);
    cond.push(`u.modelo = $${params.length}`);
  }
  if (f.origem) {
    params.push(f.origem);
    cond.push(`u.origem = $${params.length}`);
  }
  return { sql: cond.length ? `WHERE ${cond.join(" AND ")}` : "", params };
}

// Colunas novas sempre lidas com COALESCE: se o ALTER não passou, valem 0/NULL
// e a tela continua de pé mostrando só o que a estrutura antiga guardava.
const COLS_AGG = `
  count(*)                                    AS chamadas,
  count(*) FILTER (WHERE u.erro IS NOT NULL)  AS falhas,
  COALESCE(sum(u.tokens_in), 0)               AS tokens_in,
  COALESCE(sum(u.tokens_out), 0)              AS tokens_out,
  COALESCE(sum(u.cache_write), 0)             AS cache_write,
  COALESCE(sum(u.cache_read), 0)              AS cache_read,
  COALESCE(sum(u.custo_brl), 0)               AS custo_brl,
  COALESCE(sum(u.custo_faturado_brl), 0)      AS custo_faturado_brl,
  count(u.custo_faturado_brl)                 AS linhas_faturadas`;

// ---------------------------------------------------------------------------
// Tipos de saída
// ---------------------------------------------------------------------------
export interface Tokens {
  tokens_in: number; // entrada NÃO cacheada
  tokens_out: number; // saída gerada
  cache_write: number; // gravação de cache (1,25x entrada na Anthropic)
  cache_read: number; // leitura de cache (0,10x entrada na Anthropic)
}

export interface Agregado extends Tokens {
  chamadas: number;
  falhas: number;
  custo_brl: number; // calculado (tabela de preço x tokens)
  custo_faturado_brl: number; // vindo da fatura do provedor
  linhas_faturadas: number; // quantas chamadas já têm custo de fatura
  economia_cache_brl: number; // quanto a leitura de cache poupou
  custo_reconstruido: boolean; // true = custo refeito agora, não medido na hora
}

export interface Celula extends Agregado {
  negocio_id: string;
  cliente: string;
  provedor: ProvedorIA;
  modelo: string;
  latencia_ms: number | null;
  ultimo: string | null;
}

export interface Fatia extends Agregado {
  chave: string;
  rotulo: string;
  modelos: Set<string>;
}

export interface Chamada extends Tokens {
  id: string;
  criado_em: string;
  cliente: string;
  origem: string;
  provedor: ProvedorIA;
  modelo: string;
  custo_brl: number;
  custo_reconstruido: boolean;
  latencia_ms: number | null;
  req_id: string | null;
  erro: string | null;
}

export interface Dia {
  dia: string;
  chamadas: number;
  tokens: number;
  custo_brl: number;
}

function inteiro(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? Math.round(x) : 0;
}
function decimal(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

// A coluna provedor é a fonte preferida (foi gravada na hora da chamada).
// Quando vier vazia ou com lixo, cai na inferência pelo id do modelo.
const PROV_OK: ProvedorIA[] = ["claude", "openai", "gemini"];
function normProv(v: unknown, modelo: string): ProvedorIA {
  const s = String(v ?? "").toLowerCase();
  return (PROV_OK as string[]).includes(s) ? (s as ProvedorIA) : provedorDoModelo(modelo);
}

// Monta o bloco de números de um grupo cujo MODELO é conhecido — só assim dá
// pra reconstruir custo e economia de cache com o preço certo.
function agregar(r: Record<string, unknown>, modelo: string): Agregado {
  const t: Tokens = {
    tokens_in: inteiro(r.tokens_in),
    tokens_out: inteiro(r.tokens_out),
    cache_write: inteiro(r.cache_write),
    cache_read: inteiro(r.cache_read),
  };
  const gravado = decimal(r.custo_brl);
  const temToken = t.tokens_in + t.tokens_out + t.cache_write + t.cache_read > 0;
  const reconstruir = gravado <= 0 && temToken;
  return {
    ...t,
    chamadas: inteiro(r.chamadas),
    falhas: inteiro(r.falhas),
    custo_brl: reconstruir ? custoBRL(modelo, t) : gravado,
    custo_faturado_brl: decimal(r.custo_faturado_brl),
    linhas_faturadas: inteiro(r.linhas_faturadas),
    economia_cache_brl: economiaCacheBRL(modelo, t.cache_read),
    custo_reconstruido: reconstruir,
  };
}

// ---------------------------------------------------------------------------
// A matriz: cliente x empresa de IA x modelo — o grão que a tela usa pra tudo
// ---------------------------------------------------------------------------
export async function matrizUso(f: FiltroUso): Promise<Celula[]> {
  await ensureColunasUso();
  const w = montarWhere(f);
  const { rows } = await query<Record<string, unknown>>(
    `SELECT u.negocio_id,
            COALESCE(n.nome_fantasia, n.nome) AS cliente,
            COALESCE(u.provedor, 'claude')    AS provedor,
            u.modelo,
            ${COLS_AGG},
            avg(u.latencia_ms) AS latencia_ms,
            max(u.criado_em)   AS ultimo
       FROM uso_ia u
       JOIN negocios n ON n.id = u.negocio_id
       ${w.sql}
      GROUP BY u.negocio_id, cliente, provedor, u.modelo
      ORDER BY (COALESCE(sum(u.tokens_in),0) + COALESCE(sum(u.tokens_out),0)) DESC`,
    w.params
  );
  return rows.map((r) => {
    const modelo = String(r.modelo);
    return {
      negocio_id: String(r.negocio_id),
      cliente: String(r.cliente),
      provedor: normProv(r.provedor, modelo),
      modelo,
      ...agregar(r, modelo),
      latencia_ms: r.latencia_ms == null ? null : inteiro(r.latencia_ms),
      ultimo: r.ultimo ? String(r.ultimo) : null,
    };
  });
}

// Dobra a matriz por uma chave (cliente / empresa / modelo). Somar as células já
// resolvidas garante que os cards de cima fechem com a tabela de baixo.
export function dobrar<T extends Agregado & { modelo: string }>(
  itens: T[],
  chaveDe: (c: T) => string,
  rotuloDe: (c: T) => string
): Fatia[] {
  const mapa = new Map<string, Fatia>();
  for (const c of itens) {
    const k = chaveDe(c);
    const a =
      mapa.get(k) ??
      ({
        chave: k,
        rotulo: rotuloDe(c),
        modelos: new Set<string>(),
        chamadas: 0,
        falhas: 0,
        tokens_in: 0,
        tokens_out: 0,
        cache_write: 0,
        cache_read: 0,
        custo_brl: 0,
        custo_faturado_brl: 0,
        linhas_faturadas: 0,
        economia_cache_brl: 0,
        custo_reconstruido: false,
      } as Fatia);
    a.modelos.add(c.modelo);
    a.chamadas += c.chamadas;
    a.falhas += c.falhas;
    a.tokens_in += c.tokens_in;
    a.tokens_out += c.tokens_out;
    a.cache_write += c.cache_write;
    a.cache_read += c.cache_read;
    a.custo_brl += c.custo_brl;
    a.custo_faturado_brl += c.custo_faturado_brl;
    a.linhas_faturadas += c.linhas_faturadas;
    a.economia_cache_brl += c.economia_cache_brl;
    a.custo_reconstruido = a.custo_reconstruido || c.custo_reconstruido;
    mapa.set(k, a);
  }
  return [...mapa.values()].sort((a, b) => b.custo_brl - a.custo_brl || totalTokens(b) - totalTokens(a));
}

export function totalTokens(t: Tokens): number {
  return t.tokens_in + t.tokens_out + t.cache_write + t.cache_read;
}

// Soma geral: a mesma dobra, com uma chave só.
export function totalizar(cels: Celula[]): Fatia {
  const [t] = dobrar(cels, () => "tudo", () => "Tudo");
  return (
    t ?? {
      chave: "tudo",
      rotulo: "Tudo",
      modelos: new Set<string>(),
      chamadas: 0,
      falhas: 0,
      tokens_in: 0,
      tokens_out: 0,
      cache_write: 0,
      cache_read: 0,
      custo_brl: 0,
      custo_faturado_brl: 0,
      linhas_faturadas: 0,
      economia_cache_brl: 0,
      custo_reconstruido: false,
    }
  );
}

// ---------------------------------------------------------------------------
// Por ORIGEM (de que parte do produto veio a chamada)
// ---------------------------------------------------------------------------
export async function usoPorOrigem(f: FiltroUso): Promise<Fatia[]> {
  await ensureColunasUso();
  const w = montarWhere(f);
  // agrupa por (origem, modelo) só pra conseguir reconstruir custo com o preço
  // certo; a dobra abaixo devolve uma fatia por origem.
  const { rows } = await query<Record<string, unknown>>(
    `SELECT u.origem, u.modelo, ${COLS_AGG}
       FROM uso_ia u
       JOIN negocios n ON n.id = u.negocio_id
       ${w.sql}
      GROUP BY u.origem, u.modelo`,
    w.params
  );
  const itens = rows.map((r) => {
    const modelo = String(r.modelo);
    return { origem: String(r.origem), modelo, ...agregar(r, modelo) };
  });
  return dobrar(itens, (c) => c.origem, (c) => c.origem);
}

// ---------------------------------------------------------------------------
// Série por dia (barra de evolução)
// ---------------------------------------------------------------------------
export async function usoPorDia(f: FiltroUso): Promise<Dia[]> {
  await ensureColunasUso();
  const w = montarWhere(f);
  const { rows } = await query<Record<string, unknown>>(
    `SELECT to_char(date_trunc('day', u.criado_em), 'YYYY-MM-DD') AS dia, u.modelo, ${COLS_AGG}
       FROM uso_ia u
       JOIN negocios n ON n.id = u.negocio_id
       ${w.sql}
      GROUP BY dia, u.modelo
      ORDER BY dia ASC`,
    w.params
  );
  const mapa = new Map<string, Dia>();
  for (const r of rows) {
    const dia = String(r.dia);
    const a = agregar(r, String(r.modelo));
    const atual = mapa.get(dia) ?? { dia, chamadas: 0, tokens: 0, custo_brl: 0 };
    atual.chamadas += a.chamadas;
    atual.tokens += totalTokens(a);
    atual.custo_brl += a.custo_brl;
    mapa.set(dia, atual);
  }
  return [...mapa.values()];
}

// ---------------------------------------------------------------------------
// Últimas chamadas — o extrato linha a linha
// ---------------------------------------------------------------------------
export async function ultimasChamadas(f: FiltroUso, limite = 40): Promise<Chamada[]> {
  await ensureColunasUso();
  const w = montarWhere(f);
  const params = [...w.params, limite];
  const { rows } = await query<Record<string, unknown>>(
    `SELECT u.id, u.criado_em, u.origem, u.modelo, u.tokens_in, u.tokens_out,
            COALESCE(n.nome_fantasia, n.nome) AS cliente,
            COALESCE(u.provedor, 'claude')    AS provedor,
            COALESCE(u.cache_write, 0)        AS cache_write,
            COALESCE(u.cache_read, 0)         AS cache_read,
            COALESCE(u.custo_brl, 0)          AS custo_brl,
            u.latencia_ms, u.req_id, u.erro
       FROM uso_ia u
       JOIN negocios n ON n.id = u.negocio_id
       ${w.sql}
      ORDER BY u.criado_em DESC
      LIMIT $${params.length}`,
    params
  );
  return rows.map((r) => {
    const modelo = String(r.modelo);
    const t: Tokens = {
      tokens_in: inteiro(r.tokens_in),
      tokens_out: inteiro(r.tokens_out),
      cache_write: inteiro(r.cache_write),
      cache_read: inteiro(r.cache_read),
    };
    const gravado = decimal(r.custo_brl);
    const reconstruir = gravado <= 0 && totalTokens(t) > 0;
    return {
      id: String(r.id),
      criado_em: String(r.criado_em),
      cliente: String(r.cliente),
      origem: String(r.origem),
      provedor: normProv(r.provedor, modelo),
      modelo,
      ...t,
      custo_brl: reconstruir ? custoBRL(modelo, t) : gravado,
      custo_reconstruido: reconstruir,
      latencia_ms: r.latencia_ms == null ? null : inteiro(r.latencia_ms),
      req_id: r.req_id ? String(r.req_id) : null,
      erro: r.erro ? String(r.erro) : null,
    };
  });
}

// ---------------------------------------------------------------------------
// Clientes do escopo (opções do filtro)
// ---------------------------------------------------------------------------
export async function clientesDoEscopo(hubId: string | null): Promise<{ id: string; nome: string }[]> {
  const params: unknown[] = [];
  let w = "";
  if (hubId) {
    params.push(hubId);
    w = `WHERE n.hub_id = $1`;
  }
  const { rows } = await query<{ id: string; nome: string }>(
    `SELECT n.id, COALESCE(n.nome_fantasia, n.nome) AS nome
       FROM negocios n ${w}
      ORDER BY nome ASC`,
    params
  );
  return rows;
}
