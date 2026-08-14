// GET  → lista os templates APROVADOS da conta (pra iniciar fora da janela de 24h).
// POST → cria um template novo e manda pra aprovação da Meta.
import { NextRequest, NextResponse } from "next/server";
import { getWhatsAppTemplates, criarTemplateWhatsApp } from "@/lib/groow/whatsapp";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const todos = await getWhatsAppTemplates();
    const aprovados = todos.filter((t) => t.status === "APPROVED");
    return NextResponse.json({ templates: aprovados });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao listar templates.";
    // sem WABA_ID configurado ou conta sem template ainda: devolve vazio com aviso
    return NextResponse.json({ templates: [], error: msg });
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    nomeAmigavel?: string; categoria?: string; corpo?: string; exemplos?: string[];
  };
  const corpo = (body.corpo ?? "").trim();
  if (!corpo) return NextResponse.json({ error: "Escreva o corpo do template." }, { status: 400 });
  if (corpo.length > 1024) return NextResponse.json({ error: "Corpo muito longo (máx 1024 caracteres)." }, { status: 400 });

  const categoria = body.categoria === "MARKETING" ? "MARKETING" : "UTILITY";
  // nome no formato da Meta: minúsculo, só letras/números/underscore
  const base = (body.nomeAmigavel ?? "template")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // tira acento
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50) || "template";
  // sufixo curto pra não colidir com nome já usado (a Meta rejeita nome repetido)
  const name = `${base}`.slice(0, 60);

  try {
    const r = await criarTemplateWhatsApp({
      name,
      category: categoria,
      bodyText: corpo,
      exampleParams: Array.isArray(body.exemplos) ? body.exemplos.map((e) => String(e ?? "")) : [],
    });
    return NextResponse.json({ ok: true, name, status: r.status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao criar o template.";
    return NextResponse.json({ error: msg }, { status: 422 });
  }
}
