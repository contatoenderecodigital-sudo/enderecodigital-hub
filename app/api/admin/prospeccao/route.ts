import { NextResponse } from "next/server";
import { buscarEmpresas, type ParamsBusca } from "@/lib/groow/prospeccao";
import { salvarBusca, listarBuscas, abrirBusca } from "@/lib/groow/prospeccao-historico";

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
  await salvarBusca({
    parceiroId: null,
    nicho: String(body.nicho || ""),
    cidade: body.cidade ?? null,
    bairro: body.bairro ?? null,
    lat: body.lat ?? null,
    lng: body.lng ?? null,
    raioKm: body.raioKm ?? null,
    resultados: dados.empresas,
  });
  return NextResponse.json(dados);
}

/** Historico do dono, e reabertura de uma busca sem gastar de novo. */
export async function GET(request: Request) {
  const abrir = Number(new URL(request.url).searchParams.get("abrir") || 0);
  if (abrir > 0) {
    const b = await abrirBusca(abrir, null);
    if (!b) return NextResponse.json({ error: "Busca não encontrada." }, { status: 404 });
    return NextResponse.json({ empresas: b.resultados, nicho: b.nicho, cidade: b.cidade });
  }
  return NextResponse.json({ historico: await listarBuscas(null) });
}
