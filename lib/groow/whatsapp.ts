// Cliente da Meta WhatsApp Cloud API (número oficial da Endereço Digital).
// Envs necessárias (definir no .env.local e no servidor):
//   WHATSAPP_TOKEN            token permanente (System User do Business Manager)
//   WHATSAPP_PHONE_NUMBER_ID  id do número (não é o telefone)
//   WHATSAPP_VERIFY_TOKEN     string qualquer, a mesma colada no painel da Meta (webhook)
//   WHATSAPP_GRAPH_VERSION    opcional (default v22.0)

const GRAPH = () =>
  `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION || "v22.0"}`;

export function isWhatsAppConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

/**
 * Normaliza um número pro formato que a Meta espera (só dígitos, com código do
 * país, sem +). Cuida do caso Brasil: aceita "(49) 99553-0072", "049 99553...",
 * "5549..." etc. e devolve algo tipo "5549995530072". Retorna null se não der
 * pra formar um número plausível.
 */
export function normalizarNumeroBR(raw: string): string | null {
  let d = (raw || "").replace(/\D/g, "");
  if (!d) return null;
  d = d.replace(/^0+/, ""); // tira zeros à esquerda (DDD digitado como 0XX)
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) return d; // já tem DDI 55
  if (d.length === 10 || d.length === 11) return "55" + d; // DDD + número (fixo/celular) sem DDI
  if (d.length >= 11 && d.length <= 15) return d; // número internacional completo de outro país
  return null;
}

interface GraphSendResponse {
  messages?: { id: string }[];
  error?: { message: string; code: number; error_subcode?: number };
}

async function graphSend(payload: Record<string, unknown>): Promise<{ wamid: string }> {
  if (!isWhatsAppConfigured()) {
    throw new Error("WhatsApp não configurado (WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID).");
  }
  const res = await fetch(`${GRAPH()}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
  });
  const data = (await res.json()) as GraphSendResponse;
  if (!res.ok || data.error) {
    const err = data.error;
    // 131047 = fora da janela de 24h (precisa template)
    const fora24h = err?.code === 131047 || /24|re-engagement/i.test(err?.message ?? "");
    throw new Error(
      fora24h
        ? "FORA_DA_JANELA_24H: o contato não fala com você há mais de 24h. Use um template aprovado."
        : `Meta API: ${err?.message ?? res.statusText}`
    );
  }
  const wamid = data.messages?.[0]?.id;
  if (!wamid) throw new Error("Meta API: resposta sem wamid.");
  return { wamid };
}

/**
 * Baixa uma mídia recebida (áudio, imagem) pelo id que vem no webhook.
 * Dois passos da Cloud API: 1) GET /{media_id} devolve a URL temporária;
 * 2) baixa o binário com o token. Volta em base64 pra mandar pro Gemini.
 */
export async function baixarMidiaWhatsApp(mediaId: string): Promise<{ base64: string; mimeType: string } | null> {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token || !mediaId) return null;
  try {
    const metaRes = await fetch(`${GRAPH()}/${mediaId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!metaRes.ok) { console.error("[wa midia] meta", metaRes.status); return null; }
    const meta = (await metaRes.json()) as { url?: string; mime_type?: string };
    if (!meta.url) return null;
    const binRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` } });
    if (!binRes.ok) { console.error("[wa midia] bin", binRes.status); return null; }
    const buf = Buffer.from(await binRes.arrayBuffer());
    return { base64: buf.toString("base64"), mimeType: meta.mime_type || "audio/ogg" };
  } catch (e) {
    console.error("[wa midia]", e);
    return null;
  }
}

/** Texto livre - só funciona dentro da janela de 24h da conversa. */
export function sendWhatsAppText(to: string, body: string) {
  return graphSend({
    to,
    type: "text",
    text: { body, preview_url: false },
  });
}

export interface WaTemplate {
  name: string;
  status: string;
  language: string;
  category: string;
  /** corpo do template (texto com {{1}} etc.), quando disponível */
  bodyText: string | null;
  /** quantas variáveis {{n}} o corpo espera */
  varCount: number;
}

/**
 * Lista os templates da conta (WABA). Requer WHATSAPP_WABA_ID no .env -
 * é o id do WhatsApp Business Account, não o do número.
 */
export async function getWhatsAppTemplates(): Promise<WaTemplate[]> {
  const wabaId = process.env.WHATSAPP_WABA_ID;
  if (!wabaId || !process.env.WHATSAPP_TOKEN) {
    throw new Error("WHATSAPP_WABA_ID / WHATSAPP_TOKEN não configurados.");
  }
  const res = await fetch(
    `${GRAPH()}/${wabaId}/message_templates?fields=name,status,language,category,components&limit=100`,
    { headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` } }
  );
  const data = (await res.json()) as {
    data?: { name: string; status: string; language: string; category: string; components?: { type: string; text?: string }[] }[];
    error?: { message: string };
  };
  if (!res.ok || data.error) {
    throw new Error(`Meta API (templates): ${data.error?.message ?? res.statusText}`);
  }
  return (data.data ?? []).map((t) => {
    const body = t.components?.find((c) => c.type === "BODY")?.text ?? null;
    const vars = body ? new Set(Array.from(body.matchAll(/\{\{(\d+)\}\}/g)).map((m) => m[1])).size : 0;
    return { name: t.name, status: t.status, language: t.language, category: t.category, bodyText: body, varCount: vars };
  });
}

/**
 * Cria um template novo na conta (WABA) e manda pra aprovação da Meta. Volta com
 * status PENDING; quando a Meta aprova (minutos a horas), ele passa a APPROVED e
 * aparece na lista. Requer WHATSAPP_WABA_ID.
 */
export async function criarTemplateWhatsApp(input: {
  name: string;
  category: "UTILITY" | "MARKETING";
  language?: string;
  bodyText: string;
  exampleParams?: string[];
}): Promise<{ id: string; status: string }> {
  const wabaId = process.env.WHATSAPP_WABA_ID;
  if (!wabaId || !process.env.WHATSAPP_TOKEN) {
    throw new Error("WHATSAPP_WABA_ID / WHATSAPP_TOKEN não configurados.");
  }
  const varCount = new Set(Array.from(input.bodyText.matchAll(/\{\{(\d+)\}\}/g)).map((m) => m[1])).size;
  const components: Record<string, unknown>[] = [
    {
      type: "BODY",
      text: input.bodyText,
      // a Meta exige valores de exemplo pras variáveis {{n}}
      ...(varCount > 0
        ? { example: { body_text: [Array.from({ length: varCount }, (_, i) => input.exampleParams?.[i] || `exemplo ${i + 1}`)] } }
        : {}),
    },
  ];
  const res = await fetch(`${GRAPH()}/${wabaId}/message_templates`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: input.name, language: input.language || "pt_BR", category: input.category, components }),
  });
  const data = (await res.json()) as { id?: string; status?: string; error?: { message: string } };
  if (!res.ok || data.error) {
    throw new Error(`Meta API (criar template): ${data.error?.message ?? res.statusText}`);
  }
  return { id: data.id ?? "", status: data.status ?? "PENDING" };
}

/** Template aprovado - funciona a qualquer momento (notificações proativas). */
export function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  langCode = "pt_BR",
  bodyParams: string[] = []
) {
  return graphSend({
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: langCode },
      ...(bodyParams.length
        ? { components: [{ type: "body", parameters: bodyParams.map((t) => ({ type: "text", text: t })) }] }
        : {}),
    },
  });
}
