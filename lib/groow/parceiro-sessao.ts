import "server-only";
import { getSession } from "@/lib/auth";
import { getParceiro, type Parceiro } from "@/lib/groow/parceiros";

/**
 * Resolve o parceiro dono da sessão.
 *
 * O middleware valida o PAPEL, não o ESCOPO. Toda rota e página do parceiro
 * precisa passar por aqui e filtrar por este id, senão um parceiro enxerga a
 * carteira do outro. O id vem sempre da sessão assinada, nunca do request.
 */
export async function parceiroDaSessao(): Promise<Parceiro | null> {
  const s = await getSession();
  if (!s || s.papel !== "parceiro") return null;
  const id = Number(s.parceiro_id);
  if (!Number.isInteger(id) || id <= 0) return null;
  const p = await getParceiro(id);
  if (!p || p.status !== "ativo") return null;
  return p;
}

/** Versão para route handlers: devolve o parceiro ou a resposta 401 pronta. */
export async function exigirParceiro(): Promise<
  { ok: true; parceiro: Parceiro } | { ok: false; resposta: Response }
> {
  const parceiro = await parceiroDaSessao();
  if (!parceiro) {
    return {
      ok: false,
      resposta: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }
  return { ok: true, parceiro };
}
