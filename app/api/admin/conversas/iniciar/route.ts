// Inicia uma conversa de WhatsApp a partir do admin: digita/escolhe um contato
// e dispara a primeira mensagem. Regra da Meta respeitada:
//   - Fora da janela de 24h (contato nunca falou ou faz +24h): SÓ template aprovado.
//   - Dentro da janela de 24h (respondeu nas últimas 24h): texto livre liberado.
// Cria/reusa o registro em wa_conversas e já deixa a thread pronta no inbox.
import { NextRequest, NextResponse } from "next/server";
import { query, exec } from "@/lib/groow/db";
import { sendWhatsAppText, sendWhatsAppTemplate, normalizarNumeroBR, isWhatsAppConfigured } from "@/lib/groow/whatsapp";

export const dynamic = "force-dynamic";

interface Body {
  whatsapp?: string;
  nome?: string;
  modo?: "template" | "texto";
  templateName?: string;
  templateLang?: string;
  templateBody?: string; // corpo do template (com {{n}}), pra prévia na thread
  params?: string[];
  texto?: string;
  iaConduz?: boolean; // true = IA responde quando o contato responder; false = você assume
}

async function janelaAbertaHa24h(whatsapp: string): Promise<boolean> {
  const rows = await query<{ recente: number }>(
    `SELECT COUNT(*) AS recente
       FROM wa_mensagens m JOIN wa_conversas c ON c.id = m.conversa_id
      WHERE c.whatsapp = ? AND m.origem = 'user'
        AND m.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
    [whatsapp]
  );
  return (rows[0]?.recente ?? 0) > 0;
}

export async function POST(req: NextRequest) {
  if (!isWhatsAppConfigured()) {
    return NextResponse.json({ error: "WhatsApp não configurado no servidor (WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID)." }, { status: 400 });
  }
  const body = (await req.json().catch(() => ({}))) as Body;
  const whatsapp = normalizarNumeroBR(body.whatsapp ?? "");
  if (!whatsapp) {
    return NextResponse.json({ error: "Número inválido. Confira o DDD e o número." }, { status: 400 });
  }
  const nome = (body.nome ?? "").trim().slice(0, 120) || null;
  const iaConduz = body.iaConduz !== false; // padrão: IA conduz a resposta
  const statusInicial = iaConduz ? "ai_active" : "handed_off";

  try {
    // 1) cria ou reusa a conversa
    await exec(
      `INSERT INTO wa_conversas (canal, whatsapp, nome, status, ultima_mensagem_em, nao_lidas)
       VALUES ('meta', ?, ?, ?, NOW(), 0)
       ON DUPLICATE KEY UPDATE nome = COALESCE(nome, VALUES(nome)), status = VALUES(status)`,
      [whatsapp, nome, statusInicial]
    );
    const conv = await query<{ id: number }>(
      `SELECT id FROM wa_conversas WHERE canal = 'meta' AND whatsapp = ? LIMIT 1`,
      [whatsapp]
    );
    const conversaId = conv[0]?.id;
    if (!conversaId) throw new Error("Falha ao criar a conversa.");

    // 2) decide o modo de envio conforme a janela de 24h
    const dentro24h = await janelaAbertaHa24h(whatsapp);
    const querTexto = body.modo === "texto";

    if (querTexto && !dentro24h) {
      return NextResponse.json(
        { error: "Esse contato está fora da janela de 24h. Pra falar com ele agora, use um template aprovado.", precisaTemplate: true, conversaId },
        { status: 422 }
      );
    }

    let wamid: string;
    let textoRegistrado: string;

    if (querTexto) {
      const t = (body.texto ?? "").trim();
      if (!t) return NextResponse.json({ error: "Escreva a mensagem." }, { status: 400 });
      ({ wamid } = await sendWhatsAppText(whatsapp, t));
      textoRegistrado = t;
    } else {
      const templateName = (body.templateName ?? "").trim();
      if (!templateName) return NextResponse.json({ error: "Escolha um template aprovado." }, { status: 400 });
      const lang = (body.templateLang ?? "pt_BR").trim();
      const params = Array.isArray(body.params) ? body.params.map((p) => String(p ?? "")) : [];
      ({ wamid } = await sendWhatsAppTemplate(whatsapp, templateName, lang, params));
      // registra o texto do template já com as variáveis trocadas, pra thread ficar legível
      textoRegistrado = montarPreviaTemplate(body.templateBody ?? "", params, templateName);
    }

    // 3) grava a mensagem e atualiza a conversa
    await exec(
      `INSERT INTO wa_mensagens (conversa_id, origem, tipo, texto, wamid, status_entrega)
       VALUES (?, 'humano', ?, ?, ?, 'sent')`,
      [conversaId, querTexto ? "text" : "template", textoRegistrado, wamid]
    );
    await exec(
      `UPDATE wa_conversas SET ultima_mensagem = ?, ultima_mensagem_em = NOW() WHERE id = ?`,
      [textoRegistrado.slice(0, 500), conversaId]
    );

    return NextResponse.json({ ok: true, conversaId, wamid });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Falha ao enviar.";
    const fora24h = msg.startsWith("FORA_DA_JANELA_24H");
    return NextResponse.json(
      { error: fora24h ? "Fora da janela de 24h: use um template aprovado pra iniciar." : msg, precisaTemplate: fora24h },
      { status: 422 }
    );
  }
}

// troca {{1}}, {{2}}... pelos parâmetros pra guardar uma prévia legível na thread
function montarPreviaTemplate(bodyText: string, params: string[], fallbackName: string): string {
  if (!bodyText) return `[template: ${fallbackName}]`;
  return bodyText.replace(/\{\{(\d+)\}\}/g, (_, n) => params[Number(n) - 1] ?? `{{${n}}}`);
}
