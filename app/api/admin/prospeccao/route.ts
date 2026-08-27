import { NextResponse } from "next/server";
import { buscarEmpresas, type ParamsBusca } from "@/lib/groow/prospeccao";

// Protegida pelo middleware: /api/admin/* exige owner_plataforma.
// O motor vive em lib/groow/prospeccao.ts, compartilhado com o painel do parceiro.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: ParamsBusca;
  try {
    body = (await request.json()) as ParamsBusca;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const r = await buscarEmpresas(body);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  const { ok: _ok, ...dados } = r;
  return NextResponse.json(dados);
}
