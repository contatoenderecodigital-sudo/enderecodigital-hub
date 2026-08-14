import { NextResponse } from "next/server";
import { registrarIA } from "@/lib/groow/ia-log";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Gera a foto de um slide do carrossel via Gemini Flash Image (a mesma
// família de modelo do Google Labs que a equipe já usa manualmente).
// Precisa de GEMINI_API_KEY no .env.local (aistudio.google.com/apikey) e
// de BILLING ativo no projeto Google (geração de imagem não tem cota
// grátis na API; custa centavos por imagem, registrado em IA & Custos).

const MODELO = "gemini-3.1-flash-image";
const CUSTO_USD = 0.03; // aproximado, por imagem

// GET → o painel pergunta se o recurso está disponível
export async function GET() {
  return NextResponse.json({ disponivel: !!process.env.GEMINI_API_KEY });
}

export async function POST(req: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY não configurada no .env.local (pega em aistudio.google.com/apikey)." },
      { status: 500 }
    );
  }

  let body: { prompt?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const prompt = (body.prompt || "").trim().slice(0, 1500);
  if (!prompt) return NextResponse.json({ error: "prompt obrigatório" }, { status: 400 });

  const t0 = Date.now();
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${prompt}. Wide 16:9 composition.` }] }],
          generationConfig: { responseModalities: ["IMAGE"] },
        }),
      }
    );
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.error("[social/imagem]", res.status, t.slice(0, 300));
      void registrarIA({ modulo: "social", acao: `imagem: ${prompt.slice(0, 120)}`, modelo: MODELO, duracaoMs: Date.now() - t0, status: "erro", detalhe: `HTTP ${res.status}` });
      return NextResponse.json(
        {
          error:
            res.status === 429
              ? "Sem cota de imagem: geração de imagem via API exige billing ativo no projeto Google (console.cloud.google.com). Enquanto isso, usa o botão Prompt e gera no Labs."
              : res.status === 400
                ? "O modelo recusou esse prompt (conteúdo ou formato). Ajusta o texto e tenta de novo."
                : `Erro na API de imagem (${res.status}).`,
        },
        { status: 502 }
      );
    }
    const data = (await res.json()) as { candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[] };
    const parte = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    const b64 = parte?.inlineData?.data;
    if (!b64) {
      void registrarIA({ modulo: "social", acao: `imagem: ${prompt.slice(0, 120)}`, modelo: MODELO, duracaoMs: Date.now() - t0, status: "erro", detalhe: "sem imagem na resposta" });
      return NextResponse.json({ error: "A API não devolveu imagem. Tenta um prompt diferente." }, { status: 502 });
    }
    void registrarIA({ modulo: "social", acao: `imagem: ${prompt.slice(0, 120)}`, modelo: MODELO, custoUsd: CUSTO_USD, duracaoMs: Date.now() - t0 });
    return NextResponse.json({ ok: true, imagem: `data:${parte?.inlineData?.mimeType || "image/png"};base64,${b64}` });
  } catch (err) {
    console.error("[social/imagem]", err);
    return NextResponse.json({ error: "Falha ao gerar a imagem." }, { status: 500 });
  }
}
