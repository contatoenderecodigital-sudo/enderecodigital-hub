import { NextResponse } from "next/server";
import { getMetricas } from "@/lib/groow/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  try {
    const data = await getMetricas({ from, to });
    return NextResponse.json(data);
  } catch (err) {
    console.error("[admin/metricas]", err);
    return NextResponse.json(
      { error: "Erro ao processar a requisição." },
      { status: 500 }
    );
  }
}
