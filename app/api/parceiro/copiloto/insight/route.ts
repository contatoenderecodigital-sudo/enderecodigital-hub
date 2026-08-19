import { NextResponse } from "next/server";
import { exigirParceiro } from "@/lib/groow/parceiro-sessao";
import { SYSTEM_PROMPT } from "@/lib/groow/playbook-vendas";
import { transcreverAudio } from "@/lib/groow/transcrever";

export const dynamic = "force-dynamic";

/**
 * Copiloto de call.
 *
 * Pipeline: bloco de áudio -> transcrição (Gemini, mesmo helper do WhatsApp)
 * -> sugestão de próxima fala (Claude, com o playbook como system prompt).
 *
 * Enquanto COPILOTO_IA_ATIVO !== "1" devolve 503 com `desligado: true`, e a
 * tela cai nos cards estáticos do playbook. Ligar é só variável de ambiente,
 * não tem código novo para escrever aqui.
 */
export function copilotoAtivo(): boolean {
  return (
    process.env.COPILOTO_IA_ATIVO === "1" &&
    !!process.env.ANTHROPIC_API_KEY &&
    !!process.env.GEMINI_API_KEY
  );
}

// Só o rabo da transcrição vai para o modelo: o que importa é o momento atual
// da ligação, e isso segura o custo por bloco.
const JANELA_CHARS = 6000;

export async function POST(req: Request) {
  const auth = await exigirParceiro();
  if (!auth.ok) return auth.resposta;

  if (!copilotoAtivo()) {
    return NextResponse.json(
      {
        desligado: true,
        motivo:
          "O copiloto de IA ainda não está ligado. Use os cards do playbook ao lado durante a ligação.",
      },
      { status: 503 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Envio inválido." }, { status: 400 });
  }

  const acumulada = String(form.get("transcricao") || "");
  const audio = form.get("audio");

  let trecho: string | null = null;
  if (audio instanceof Blob && audio.size > 0) {
    const base64 = Buffer.from(await audio.arrayBuffer()).toString("base64");
    trecho = await transcreverAudio(base64, audio.type || "audio/webm");
  }

  const transcricao = (trecho ? `${acumulada} ${trecho}` : acumulada).trim();

  // Pouca fala ainda: devolve a transcrição e espera o próximo bloco em vez de
  // queimar uma chamada de modelo em cima de nada.
  if (transcricao.length < 120) {
    return NextResponse.json({ transcricao, trecho, sugestoes: [], fase: null, alerta: null });
  }

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY as string,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        // Haiku por padrão: isto roda a cada poucos segundos durante a ligação,
        // então latência e custo pesam mais que profundidade. Mesmo default do
        // atendente-ia. Para nicho difícil, COPILOTO_MODELO=claude-sonnet-5.
        model: process.env.COPILOTO_MODELO || "claude-haiku-4-5",
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Transcrição parcial da ligação até agora:\n\n${transcricao.slice(-JANELA_CHARS)}\n\nResponda só o JSON.`,
          },
        ],
      }),
    });

    if (!resp.ok) {
      const texto = await resp.text().catch(() => "");
      console.error("[copiloto] Anthropic", resp.status, texto.slice(0, 400));
      return NextResponse.json({ transcricao, trecho, sugestoes: [], fase: null, alerta: null });
    }

    const dados = (await resp.json()) as { content?: { type: string; text?: string }[] };
    const texto = dados.content?.find((c) => c.type === "text")?.text ?? "";
    const bruto = texto.match(/\{[\s\S]*\}/)?.[0];
    if (!bruto) {
      return NextResponse.json({ transcricao, trecho, sugestoes: [], fase: null, alerta: null });
    }

    const parsed = JSON.parse(bruto) as {
      fase?: string;
      sugestoes?: string[];
      alerta?: string | null;
    };
    return NextResponse.json({
      transcricao,
      trecho,
      fase: parsed.fase ?? null,
      sugestoes: Array.isArray(parsed.sugestoes) ? parsed.sugestoes.slice(0, 3) : [],
      alerta: parsed.alerta ?? null,
    });
  } catch (err) {
    console.error("[copiloto] falha:", err);
    // Falha do copiloto no meio da ligação não pode virar erro na tela: devolve
    // a transcrição e segue.
    return NextResponse.json({ transcricao, trecho, sugestoes: [], fase: null, alerta: null });
  }
}
