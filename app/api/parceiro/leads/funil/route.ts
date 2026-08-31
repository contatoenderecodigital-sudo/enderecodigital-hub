import { NextResponse } from "next/server";
import { exigirParceiro } from "@/lib/groow/parceiro-sessao";
import { moverFunil, excluirLead } from "@/lib/groow/parceiros";

/**
 * Base <-> funil, e exclusao.
 *
 * Separada de /etapa porque sao coisas diferentes: etapa e onde o card esta
 * dentro do quadro; isto e se ele esta no quadro.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await exigirParceiro();
  if (!auth.ok) return auth.resposta;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const ids = (
    Array.isArray(body.ids) ? body.ids : [body.id]
  ).map(Number).filter((n) => Number.isInteger(n) && n > 0);
  if (!ids.length) return NextResponse.json({ error: "Id inválido." }, { status: 400 });

  const acao = String(body.acao || "");
  if (!["excluir", "funil", "base"].includes(acao)) {
    return NextResponse.json({ error: "Ação desconhecida." }, { status: 400 });
  }

  let feitos = 0;
  for (const id of ids) {
    const ok =
      acao === "excluir"
        ? await excluirLead(id, auth.parceiro.id)
        : await moverFunil(id, auth.parceiro.id, acao === "funil");
    if (ok) feitos++;
  }
  return NextResponse.json({ ok: true, feitos });
}
