/**
 * Promove um lead da fila do parceiro para a operação e abre a conversa no
 * WhatsApp com template aprovado.
 *
 * Duas travas de propósito:
 *  - só dispara com optin = 1 e prova registrada (regra da Meta);
 *  - reusa o ciclo de app/api/admin/conversas/iniciar, para a mensagem
 *    aparecer no inbox em vez de sumir no vazio.
 */
import { NextResponse } from "next/server";
import { query, exec } from "@/lib/groow/db";
import {
  sendWhatsAppTemplate,
  normalizarNumeroBR,
  isWhatsAppConfigured,
} from "@/lib/groow/whatsapp";
import { garantirTabelasParceiros, promoverParaLead } from "@/lib/groow/parceiros";

export const dynamic = "force-dynamic";

interface Body {
  parceiro_lead_id?: number;
  templateName?: string;
  templateLang?: string;
  templateBody?: string;
  params?: string[];
  /** true = só promove para lead, sem mandar mensagem */
  apenasPromover?: boolean;
}

export async function POST(req: Request) {
  await garantirTabelasParceiros();
  const body = (await req.json().catch(() => ({}))) as Body;

  const plId = Number(body.parceiro_lead_id);
  if (!Number.isInteger(plId) || plId <= 0) {
    return NextResponse.json({ error: "Lead inválido." }, { status: 400 });
  }

  const rows = await query<{
    id: number;
    nome: string;
    telefone: string;
    optin: number;
    optin_prova: string | null;
  }>(`SELECT id, nome, telefone, optin, optin_prova FROM parceiro_leads WHERE id = $1 LIMIT 1`, [
    plId,
  ]);
  const pl = rows[0];
  if (!pl) return NextResponse.json({ error: "Lead não encontrado." }, { status: 404 });

  if (!pl.optin || !pl.optin_prova) {
    return NextResponse.json(
      {
        error:
          "Esse lead não tem autorização registrada. Sem opt-in com prova a gente não abre conversa.",
      },
      { status: 422 }
    );
  }

  // 1) sempre promove primeiro: mesmo que o envio falhe, o lead fica na operação.
  let leadId: number;
  try {
    ({ leadId } = await promoverParaLead(plId));
  } catch (err) {
    console.error("[parceiros] promover:", err);
    return NextResponse.json({ error: "Não consegui criar o lead." }, { status: 500 });
  }

  if (body.apenasPromover) {
    return NextResponse.json({ ok: true, leadId, enviado: false });
  }

  if (!isWhatsAppConfigured()) {
    return NextResponse.json(
      {
        error:
          "Lead promovido, mas o WhatsApp não está configurado neste servidor (WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID).",
        leadId,
        enviado: false,
      },
      { status: 422 }
    );
  }

  const whatsapp = normalizarNumeroBR(pl.telefone);
  if (!whatsapp) {
    return NextResponse.json({ error: "Número inválido.", leadId }, { status: 400 });
  }

  const templateName = (body.templateName ?? "").trim();
  if (!templateName) {
    return NextResponse.json({ error: "Escolha um template aprovado.", leadId }, { status: 400 });
  }

  const lang = (body.templateLang ?? "pt_BR").trim();
  const params = Array.isArray(body.params)
    ? body.params.map((p) => String(p ?? ""))
    : [pl.nome.split(" ")[0]];

  try {
    await exec(
      `INSERT INTO wa_conversas (canal, whatsapp, nome, status, lead_id, ultima_mensagem_em, nao_lidas)
       VALUES ('meta', $1, $2, 'ai_active', $3, NOW(), 0)
       ON CONFLICT (canal, whatsapp) DO UPDATE
         SET nome = COALESCE(wa_conversas.nome, EXCLUDED.nome),
             lead_id = COALESCE(wa_conversas.lead_id, EXCLUDED.lead_id),
             status = 'ai_active'`,
      [whatsapp, pl.nome.slice(0, 120), leadId]
    );
    const conv = await query<{ id: number }>(
      `SELECT id FROM wa_conversas WHERE canal = 'meta' AND whatsapp = $1 LIMIT 1`,
      [whatsapp]
    );
    const conversaId = conv[0]?.id;

    const { wamid } = await sendWhatsAppTemplate(whatsapp, templateName, lang, params);

    const previa = (body.templateBody ?? "").replace(
      /\{\{(\d+)\}\}/g,
      (_, n) => params[Number(n) - 1] ?? `{{${n}}}`
    ) || `[template: ${templateName}]`;

    if (conversaId) {
      await exec(
        `INSERT INTO wa_mensagens (conversa_id, origem, tipo, texto, wamid, status_entrega)
         VALUES ($1, 'humano', 'template', $2, $3, 'sent')`,
        [conversaId, previa, wamid]
      );
      await exec(
        `UPDATE wa_conversas SET ultima_mensagem = $1, ultima_mensagem_em = NOW() WHERE id = $2`,
        [previa.slice(0, 500), conversaId]
      );
    }

    await exec(
      `UPDATE parceiro_leads SET disparo_status = 'enviado', disparo_em = NOW(), disparo_erro = NULL
        WHERE id = $1`,
      [plId]
    );

    return NextResponse.json({ ok: true, leadId, conversaId, wamid, enviado: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Falha ao enviar.";
    await exec(
      `UPDATE parceiro_leads SET disparo_status = 'falhou', disparo_erro = $1 WHERE id = $2`,
      [msg.slice(0, 250), plId]
    );
    return NextResponse.json({ error: msg, leadId, enviado: false }, { status: 422 });
  }
}
