// Transcrição de áudio do WhatsApp usando o Gemini (entende áudio nativo).
// Usa a mesma GEMINI_API_KEY do resto do projeto. É o tier de TEXTO (barato,
// tem cota grátis), diferente da geração de imagem que precisa de crédito pago.
import { registrarIA } from "@/lib/groow/ia-log";

const MODELO = process.env.GEMINI_AUDIO_MODEL || "gemini-2.5-flash";

/** Recebe o áudio em base64 + mime e devolve o texto falado (ou null). */
export async function transcreverAudio(base64: string, mimeType: string): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key || !base64) return null;
  const t0 = Date.now();
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: "Transcreva EXATAMENTE o que a pessoa fala neste áudio, em português do Brasil. Responda só com a transcrição, sem comentar, sem aspas. Se não houver fala, responda vazio." },
            { inlineData: { mimeType, data: base64 } },
          ],
        }],
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("[transcrever] Gemini", res.status, txt.slice(0, 200));
      void registrarIA({ modulo: "atendimento", acao: "transcrição de áudio", modelo: MODELO, duracaoMs: Date.now() - t0, status: "erro", detalhe: `HTTP ${res.status}` });
      return null;
    }
    const data = await res.json();
    void registrarIA({ modulo: "atendimento", acao: "transcrição de áudio", modelo: MODELO, usage: geminiUsage(data), duracaoMs: Date.now() - t0 });
    const texto = (data?.candidates?.[0]?.content?.parts ?? [])
      .map((p: { text?: string }) => p.text || "")
      .join(" ")
      .trim();
    return texto || null;
  } catch (e) {
    console.error("[transcrever]", e);
    return null;
  }
}

// converte o usageMetadata do Gemini pro formato que o registrarIA espera
function geminiUsage(data: unknown): { input_tokens: number; output_tokens: number } | undefined {
  const u = (data as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } })?.usageMetadata;
  if (!u) return undefined;
  return { input_tokens: u.promptTokenCount ?? 0, output_tokens: u.candidatesTokenCount ?? 0 };
}
