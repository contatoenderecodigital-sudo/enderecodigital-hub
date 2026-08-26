import { NextResponse } from "next/server";
import { exigirParceiro } from "@/lib/groow/parceiro-sessao";
import { salvarDiagnostico } from "@/lib/groow/parceiros";

export const dynamic = "force-dynamic";

/**
 * Respostas do diagnostico que o parceiro anota durante a ligacao.
 *
 * Rota propria e nao o PATCH de /leads porque aquele exige prova de opt-in e
 * reescreve o cadastro inteiro. Aqui e so anotacao, e precisa salvar a cada
 * pergunta sem travar nada.
 */
export async function POST(req: Request) {
  const auth = await exigirParceiro();
  if (!auth.ok) return auth.resposta;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Id inválido." }, { status: 400 });
  }

  const respostas = body.respostas;
  if (!respostas || typeof respostas !== "object" || Array.isArray(respostas)) {
    return NextResponse.json({ error: "Respostas inválidas." }, { status: 400 });
  }

  try {
    const ok = await salvarDiagnostico(
      id,
      auth.parceiro.id,
      respostas as Record<string, string>
    );
    if (!ok) return NextResponse.json({ error: "Lead não encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[diagnostico] salvar:", err);
    return NextResponse.json({ error: "Não consegui salvar." }, { status: 500 });
  }
}
