// Config do follow-up automático da IA (liga/desliga + cadência).
import { NextRequest, NextResponse } from "next/server";
import { getFollowupConfig, setFollowupConfig } from "@/lib/groow/ia-followup";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getFollowupConfig());
  } catch {
    return NextResponse.json({ ativo: false, intervalos: [4, 12], error: "Erro ao carregar." });
  }
}

export async function PUT(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { ativo?: boolean; intervalos?: number[] };
  try {
    await setFollowupConfig({
      ativo: Boolean(body.ativo),
      intervalos: Array.isArray(body.intervalos) ? body.intervalos.map(Number).filter((n) => n > 0) : [4, 12],
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[ia/followup PUT]", err);
    return NextResponse.json({ error: "Erro ao salvar." }, { status: 500 });
  }
}
