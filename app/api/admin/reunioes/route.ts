import { NextResponse } from "next/server";
import { listarReunioes, marcarDesfecho, type Desfecho } from "@/lib/groow/reunioes";

// Protegida pelo middleware: /api/admin/* exige papel owner_plataforma.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { futuras, passadas } = await listarReunioes();
    return NextResponse.json({ futuras, passadas });
  } catch (err) {
    console.error("[reunioes] listar:", err);
    return NextResponse.json({ error: "Nao consegui carregar." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const calUid = String(body.cal_uid || "").trim();
  const desfecho = String(body.desfecho || "") as Desfecho;
  if (!calUid) return NextResponse.json({ error: "Reuniao nao informada." }, { status: 400 });

  try {
    await marcarDesfecho(calUid, desfecho, String(body.nota || "") || null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Nao consegui salvar.";
    console.error("[reunioes] desfecho:", err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
