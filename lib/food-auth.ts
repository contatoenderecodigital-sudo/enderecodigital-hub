import "server-only";
import { getSession } from "./auth";
import { query } from "./db";

/**
 * Quem pode operar o AppFood de um negócio:
 *   - owner_plataforma  -> qualquer negócio (é o dono da plataforma)
 *   - dono / operador   -> apenas o próprio negocio_id
 * Devolve null quando não pode. Toda rota do painel começa por aqui.
 */
export async function negocioPermitido(negId: string): Promise<string | null> {
  const s = await getSession();
  if (!s) return null;
  if (s.papel === "owner_plataforma") return negId;
  if ((s.papel === "dono" || s.papel === "operador") && s.negocio_id === negId) return negId;
  return null;
}

/** O módulo está ligado para este cliente? (NULL no negócio = herda do hub) */
export async function foodHabilitado(negId: string): Promise<boolean> {
  const r = await query<{ ligado: boolean }>(
    `SELECT COALESCE(n.mod_food, h.mod_food, false) AS ligado
       FROM negocios n JOIN hubs h ON h.id = n.hub_id
      WHERE n.id = $1`,
    [negId]
  );
  return !!r.rows[0]?.ligado;
}
