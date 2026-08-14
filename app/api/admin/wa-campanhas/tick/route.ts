import { NextResponse } from "next/server";
import { processarTick } from "@/lib/groow/wa-campanhas";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Versão autenticada pelo cookie do admin (botão "Processar fila agora").
export async function POST() {
  try {
    const resumo = await processarTick();
    return NextResponse.json({ ok: true, ...resumo });
  } catch (err) {
    console.error("[wa tick admin]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}
