import "server-only";
import { query, exec } from "@/lib/groow/db";

/**
 * Historico das buscas de prospeccao.
 *
 * Existe porque o resultado vivia so no estado da tela: um F5 e a busca sumia
 * com o dinheiro da API do Google ja gasto. Reabrir daqui nao custa nada.
 *
 * `parceiro_id` nulo e busca do dono; preenchido e daquele parceiro. Toda
 * leitura filtra por ele, senao um parceiro enxerga a prospeccao do outro.
 */

export interface BuscaSalva {
  id: number;
  nicho: string;
  cidade: string | null;
  bairro: string | null;
  raio_km: number | null;
  total: number;
  criado_em: string;
}

export async function salvarBusca(entrada: {
  parceiroId: number | null;
  nicho: string;
  cidade?: string | null;
  bairro?: string | null;
  lat?: number | null;
  lng?: number | null;
  raioKm?: number | null;
  resultados: unknown[];
}): Promise<number | null> {
  try {
    const r = await exec(
      `INSERT INTO prospeccao_buscas
         (parceiro_id, nicho, cidade, bairro, lat, lng, raio_km, total, resultados)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) RETURNING id`,
      [
        entrada.parceiroId,
        entrada.nicho.slice(0, 120),
        entrada.cidade?.slice(0, 120) || null,
        entrada.bairro?.slice(0, 120) || null,
        entrada.lat ?? null,
        entrada.lng ?? null,
        entrada.raioKm ?? null,
        entrada.resultados.length,
        JSON.stringify(entrada.resultados),
      ]
    );
    return r.insertId ?? null;
  } catch (err) {
    // Gravar o historico nao pode derrubar a busca: a pessoa ja pagou por ela
    // e o resultado tem que aparecer na tela de qualquer jeito.
    console.error("[prospeccao] salvar historico:", err);
    return null;
  }
}

/** Ultimas buscas, sem os resultados: a lista so precisa do cabecalho. */
export async function listarBuscas(parceiroId: number | null): Promise<BuscaSalva[]> {
  return query<BuscaSalva>(
    `SELECT id, nicho, cidade, bairro, raio_km, total, criado_em
       FROM prospeccao_buscas
      WHERE parceiro_id IS NOT DISTINCT FROM $1
      ORDER BY criado_em DESC
      LIMIT 20`,
    [parceiroId]
  );
}

/** Uma busca inteira, com os resultados, para reabrir na tela. */
export async function abrirBusca(
  id: number,
  parceiroId: number | null
): Promise<{ resultados: unknown[]; nicho: string; cidade: string | null } | null> {
  const r = await query<{ resultados: unknown[]; nicho: string; cidade: string | null }>(
    `SELECT resultados, nicho, cidade
       FROM prospeccao_buscas
      WHERE id = $1 AND parceiro_id IS NOT DISTINCT FROM $2
      LIMIT 1`,
    [id, parceiroId]
  );
  return r[0] ?? null;
}
