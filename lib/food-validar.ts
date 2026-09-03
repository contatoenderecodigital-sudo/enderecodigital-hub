// ============================================================================
// Validação de entrada, sem biblioteca.
//
// O que salvava o módulo até aqui era o SQL parametrizado (não existe uma única
// concatenação de valor em consulta) e os CHECK do banco. Mas o painel jogava o
// corpo inteiro do navegador dentro das funções (`body as never`), e
// `Number(body.valor)` de um texto virava NaN indo para o banco.
//
// Não é Zod para não puxar dependência nova em cima de um deploy que ainda vai
// acontecer. É o suficiente para o que este módulo aceita: texto com teto,
// número com faixa, booleano, uuid e lista curta.
//
// Arquivo puro, sem import de runtime.
// ============================================================================

export class ErroEntrada extends Error {
  codigo = "ENTRADA_INVALIDA";
  campo = "";
  constructor(campo: string, mensagem: string) {
    super(mensagem);
    this.name = "ErroEntrada";
    this.campo = campo;
  }
}

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Texto obrigatório, aparado e com teto. */
export function texto(v: unknown, campo: string, max = 200): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) throw new ErroEntrada(campo, `Falta ${campo}.`);
  return s.slice(0, max);
}

/** Texto que pode faltar. Devolve null quando vazio. */
export function textoOpcional(v: unknown, max = 200): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, max) : null;
}

/** Número com faixa. Recusa NaN, Infinity e texto que não é número. */
export function numero(
  v: unknown, campo: string, opts: { min?: number; max?: number; padrao?: number } = {}
): number {
  if ((v === undefined || v === null || v === "") && opts.padrao !== undefined) return opts.padrao;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  if (!Number.isFinite(n)) throw new ErroEntrada(campo, `${campo} precisa ser um número.`);
  if (opts.min !== undefined && n < opts.min) throw new ErroEntrada(campo, `${campo} não pode ser menor que ${opts.min}.`);
  if (opts.max !== undefined && n > opts.max) throw new ErroEntrada(campo, `${campo} não pode passar de ${opts.max}.`);
  return n;
}

/** Dinheiro: número com duas casas, nunca negativo. */
export function dinheiro(v: unknown, campo: string, opts: { padrao?: number; max?: number } = {}): number {
  const n = numero(v, campo, { min: 0, max: opts.max ?? 999999, padrao: opts.padrao });
  return Math.round(n * 100) / 100;
}

export function booleano(v: unknown, padrao = false): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === 1 || v === "1") return true;
  if (v === "false" || v === 0 || v === "0") return false;
  return padrao;
}

export function uuid(v: unknown, campo: string): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (!RE_UUID.test(s)) throw new ErroEntrada(campo, `${campo} inválido.`);
  return s;
}

export function uuidOpcional(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return RE_UUID.test(s) ? s : null;
}

/** Uma escolha dentro de uma lista fechada. */
export function opcao<T extends string>(v: unknown, campo: string, validas: readonly T[], padrao?: T): T {
  const s = typeof v === "string" ? v.trim() : "";
  if (validas.includes(s as T)) return s as T;
  if (padrao !== undefined) return padrao;
  throw new ErroEntrada(campo, `${campo} precisa ser um de: ${validas.join(", ")}.`);
}

/** Lista de textos curtos, com teto de tamanho. */
export function lista(v: unknown, campo: string, max = 20, maxItem = 60): string[] {
  if (!Array.isArray(v)) return [];
  if (v.length > max) throw new ErroEntrada(campo, `${campo}: no máximo ${max} itens.`);
  return v.map((x) => String(x).trim().slice(0, maxItem)).filter(Boolean);
}

/** Lista de uuid. Serve para reordenar e para dividir a conta por item. */
export function listaUuid(v: unknown, campo: string, max = 200): string[] {
  if (!Array.isArray(v)) return [];
  if (v.length > max) throw new ErroEntrada(campo, `${campo}: no máximo ${max} itens.`);
  const out: string[] = [];
  for (const x of v) {
    const s = String(x).trim();
    if (!RE_UUID.test(s)) throw new ErroEntrada(campo, `${campo} tem id inválido.`);
    out.push(s);
  }
  return out;
}
