import { NextResponse } from "next/server";
import { getCobrancasMes, getAtrasadosGlobais } from "@/lib/groow/queries";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams;
    // ?atrasados=1 → todos os meses vencidos e não pagos, de todos os clientes
    if (params.get("atrasados") === "1") {
      const data = await getAtrasadosGlobais();
      return NextResponse.json(data);
    }
    const ym = params.get("ym") ?? undefined;
    const data = await getCobrancasMes(ym);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[admin/cobrancas]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}
