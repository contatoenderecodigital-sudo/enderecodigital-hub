/**
 * Construtor de SQL parametrizado para Postgres.
 *
 * Existe para o SQL montado condicionalmente (filtro que só entra se o usuário
 * escolheu, UPDATE que só toca no que mudou). No MySQL isso era fácil porque o
 * placeholder `?` é posicional e você só ia empilhando. No Postgres o
 * placeholder é numerado, e numerar à mão é onde nasce bug de parâmetro trocado.
 *
 * Uso:
 *
 *   const { p, params } = construtorSql();
 *   const where: string[] = [];
 *   if (status) where.push(`status = ${p(status)}`);
 *   if (busca)  where.push(`nome ILIKE ${p("%" + busca + "%")}`);
 *
 *   const sql = `SELECT * FROM leads
 *                ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
 *                ORDER BY created_at DESC`;
 *   const linhas = await query<Lead>(sql, params);
 *
 * `p(valor)` registra o valor e devolve o marcador correspondente. Como
 * Array.push devolve o novo tamanho, o número sai sempre alinhado com a
 * posição real: é impossível o marcador e o parâmetro se desencontrarem.
 */
import type { QueryParam } from "@/lib/groow/db";

export interface ConstrutorSql {
  /** Registra um parâmetro e devolve o marcador ($1, $2, ...). */
  p: (valor: QueryParam) => string;
  /** A lista de parâmetros, na ordem, para passar ao query/exec. */
  params: QueryParam[];
}

export function construtorSql(): ConstrutorSql {
  const params: QueryParam[] = [];
  return {
    params,
    p: (valor: QueryParam) => `$${params.push(valor)}`,
  };
}

/**
 * Açúcar para o caso mais comum: lista de condições que vira WHERE, ou string
 * vazia quando não sobrou nenhuma. Evita o `${where.length ? ... : ""}` repetido.
 */
export function clausulaWhere(condicoes: string[]): string {
  return condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";
}

/** Idem para SET de UPDATE. Lança se não houver nada a atualizar. */
export function clausulaSet(atribuicoes: string[]): string {
  if (!atribuicoes.length) throw new Error("UPDATE sem nenhuma coluna para alterar.");
  return `SET ${atribuicoes.join(", ")}`;
}
