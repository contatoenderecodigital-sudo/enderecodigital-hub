import { NextResponse } from "next/server";
import { getCaixaSerie } from "@/lib/groow/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const tipo = searchParams.get("tipo") || undefined;
  try {
    const serie = await getCaixaSerie(from, to, tipo);
    return NextResponse.json(serie);
  } catch (err) {
    console.error("[admin/financeiro/caixa]", err);
    return NextResponse.json(
      { error: "Erro ao processar a requisição." },
      { status: 500 }
    );
  }
}
