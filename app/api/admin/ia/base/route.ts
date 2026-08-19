// Cérebro da IA (base de conhecimento) do atendimento no WhatsApp.
// GET  → texto atual   ·   PUT → salva o texto
import { NextRequest, NextResponse } from "next/server";
import { getBaseConhecimento, setBaseConhecimento } from "@/lib/groow/ia-base";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const conteudo = await getBaseConhecimento();
    return NextResponse.json({ conteudo });
  } catch {
    return NextResponse.json({ conteudo: "", error: "Erro ao carregar a base." });
  }
}

export async function PUT(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { conteudo?: string };
  const conteudo = (body.conteudo ?? "").trim();
  try {
    await setBaseConhecimento(conteudo);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[ia/base PUT]", err);
    return NextResponse.json({ error: "Erro ao salvar a base." }, { status: 500 });
  }
}
