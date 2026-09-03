import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { processarEventos } from "@/lib/food-eventos";

// ============================================================================
// Processa a fila de eventos do AppFood (avisos de WhatsApp).
// Rode a cada minuto no cron do servidor:
//   curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/food/eventos
// Também aceita o owner logado, para disparar na mão em teste.
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
  return NextResponse.json(await processarEventos());
}

export async function POST(req: NextRequest) {
  if (!(await autorizado(req))) return NextResponse.json({ erro: "sem_acesso" }, { status: 401 });
  return NextResponse.json(await processarEventos());
}
