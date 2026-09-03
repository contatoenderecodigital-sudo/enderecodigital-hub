import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { processarFilaFiscal } from "@/lib/food-fiscal";

// ============================================================================
// A fila fiscal. Roda no cron, de minuto em minuto:
//   curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/food/fiscal
//
// É esta rota que faz a contingência existir: a venda fecha sem esperar a
// SEFAZ, e quem insiste pela nota é a fila, com espera crescente.
// ============================================================================

export const dynamic = "force-dynamic";

async function autorizado(req: NextRequest): Promise<boolean> {
  const segredo = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (segredo && auth === `Bearer ${segredo}`) return true;
  const s = await getSession();
  return s?.papel === "owner_plataforma";
}

export async function GET(req: NextRequest) {
  if (!(await autorizado(req))) return NextResponse.json({ erro: "sem_acesso" }, { status: 401 });
  return NextResponse.json(await processarFilaFiscal());
}

export async function POST(req: NextRequest) {
  if (!(await autorizado(req))) return NextResponse.json({ erro: "sem_acesso" }, { status: 401 });
  return NextResponse.json(await processarFilaFiscal());
}
