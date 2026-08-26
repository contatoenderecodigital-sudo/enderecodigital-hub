import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { exec, query } from "@/lib/groow/db";
import {
  garantirTabelasParceiros,
  getParceiroPorCodigo,
  normalizarTelefone,
  salvarLeadDoParceiro,
} from "@/lib/groow/parceiros";

/**
 * Ponte Cal.com -> hub.
 *
 * O prospect marca no link do parceiro (`?codigo=joao`), o Cal chama aqui, e o
 * lead do parceiro vai para a etapa "agendou" com dia e hora. Sem isto o dono
 * so descobre a reuniao pelo Google Agenda e a atribuicao morre no caminho.
 *
 * Rota publica de proposito (ver PUBLIC no middleware): quem autentica e a
 * assinatura HMAC, nao a sessao.
 */

export const dynamic = "force-dynamic";

/** Resposta do formulario: as vezes string crua, as vezes {label, value}. */
function resposta(responses: unknown, chave: string): string {
  if (!responses || typeof responses !== "object") return "";
  const v = (responses as Record<string, unknown>)[chave];
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  if (typeof v === "object" && "value" in (v as Record<string, unknown>)) {
    const inner = (v as Record<string, unknown>).value;
    return inner == null ? "" : String(inner).trim();
  }
  return "";
}

/**
 * Confere a assinatura do Cal contra o corpo CRU. Reserializar o JSON muda
 * espaco e ordem de chave, e o HMAC nunca mais bate.
 */
function assinaturaConfere(cru: string, cabecalho: string | null): boolean {
  const segredo = process.env.CAL_WEBHOOK_SECRET || "";
  // Sem segredo configurado a rota fica fechada. Aberta ela aceitaria qualquer
  // POST da internet criando lead e reuniao no painel.
  if (!segredo || !cabecalho) return false;
  const esperado = createHmac("sha256", segredo).update(cru).digest("hex");
  const a = Buffer.from(esperado, "utf8");
  const b = Buffer.from(cabecalho.trim().toLowerCase(), "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Link da videochamada, que muda de lugar conforme o app de conferencia. */
function linkDaReuniao(p: Record<string, unknown>): string | null {
  const direto = typeof p.meetingUrl === "string" ? p.meetingUrl : null;
  const loc = typeof p.location === "string" && /^https?:\/\//.test(p.location) ? p.location : null;
  const vc = p.videoCallData as Record<string, unknown> | undefined;
  const doVc = vc && typeof vc.url === "string" ? vc.url : null;
  return direto || doVc || loc || null;
}

export async function POST(req: Request) {
  const cru = await req.text();

  if (!assinaturaConfere(cru, req.headers.get("x-cal-signature-256"))) {
    return NextResponse.json({ error: "assinatura invalida" }, { status: 401 });
  }

  let corpo: Record<string, unknown>;
  try {
    corpo = JSON.parse(cru) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "json invalido" }, { status: 400 });
  }

  const evento = String(corpo.triggerEvent || "");

  // Lista fechada de proposito. O Cal oferece uns quinze gatilhos, e varios
  // chegam DEPOIS da reuniao (encerrada, transcricao pronta, no-show). Se a
  // gente processasse tudo, um "reuniao encerrada" reescreveria o agendamento
  // como 'marcada' e apagaria o desfecho que o dono acabou de anotar.
  const TRATADOS = new Set(["BOOKING_CREATED", "BOOKING_RESCHEDULED", "BOOKING_CANCELLED"]);
  if (!TRATADOS.has(evento)) {
    return NextResponse.json({ ok: true, ignorado: evento });
  }

  const p = (corpo.payload || {}) as Record<string, unknown>;
  const uid = String(p.uid || "");
  if (!uid) return NextResponse.json({ error: "sem uid" }, { status: 400 });

  await garantirTabelasParceiros();

  // O payload inteiro fica gravado. Formato de webhook de terceiro muda sem
  // aviso, e sem o cru na mao a gente depura no escuro.
  const responses = p.responses;
  const codigo = resposta(responses, "codigo").toLowerCase();
  const nome =
    resposta(responses, "name") ||
    String((Array.isArray(p.attendees) && (p.attendees[0] as Record<string, unknown>)?.name) || "");
  const email = resposta(responses, "email").toLowerCase();
  const empresa = resposta(responses, "empresa");
  const cidade = resposta(responses, "cidade");
  const nota = resposta(responses, "notes");
  const telefoneCru =
    resposta(responses, "attendeePhoneNumber") ||
    String(
      (Array.isArray(p.attendees) && (p.attendees[0] as Record<string, unknown>)?.phoneNumber) || ""
    );
  const telefone = normalizarTelefone(telefoneCru);
  const inicio = String(p.startTime || "");
  const link = linkDaReuniao(p);

  const cancelou = evento === "BOOKING_CANCELLED";
  const statusAgendamento = cancelou
    ? "cancelada"
    : evento === "BOOKING_RESCHEDULED"
      ? "remarcada"
      : "marcada";

  const parceiro = codigo ? await getParceiroPorCodigo(codigo) : null;

  // Sempre grava em `cal_agendamentos`, com parceiro ou sem. E a fila que o dono ve,
  // e e o unico registro de quem marcou pelo site .com sem indicacao.
  await exec(
    `INSERT INTO cal_agendamentos
       (cal_uid, nome, empresa, telefone, email, cidade, codigo, parceiro_id,
        reuniao_em, reuniao_link, status, observacao, payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (cal_uid) DO UPDATE SET
       nome = EXCLUDED.nome,
       empresa = COALESCE(EXCLUDED.empresa, cal_agendamentos.empresa),
       telefone = COALESCE(EXCLUDED.telefone, cal_agendamentos.telefone),
       email = COALESCE(EXCLUDED.email, cal_agendamentos.email),
       cidade = COALESCE(EXCLUDED.cidade, cal_agendamentos.cidade),
       reuniao_em = EXCLUDED.reuniao_em,
       reuniao_link = COALESCE(EXCLUDED.reuniao_link, cal_agendamentos.reuniao_link),
       status = EXCLUDED.status,
       payload = EXCLUDED.payload,
       atualizado_em = NOW()`,
    [
      uid.slice(0, 64),
      (nome || "sem nome").slice(0, 160),
      empresa.slice(0, 160) || null,
      telefone,
      email.slice(0, 190) || null,
      cidade.slice(0, 120) || null,
      codigo.slice(0, 32) || null,
      parceiro?.id ?? null,
      inicio,
      link?.slice(0, 400) ?? null,
      statusAgendamento,
      nota.slice(0, 2000) || null,
      cru.slice(0, 100000),
    ]
  );

  // Sem codigo valido nao existe lead de parceiro para mover. O agendamento
  // acima ja guardou tudo, entao o dono nao perde a reuniao.
  if (!parceiro) {
    return NextResponse.json({ ok: true, agendamento: true, parceiro: null, codigo: codigo || null });
  }

  if (!telefone) {
    // A pergunta de telefone e obrigatoria no Cal, mas se um dia deixar de ser,
    // isto evita estourar o unique de (parceiro_id, telefone).
    console.error("[cal] agendamento sem telefone:", uid);
    return NextResponse.json({ ok: true, agendamento: true, lead: null, motivo: "sem telefone" });
  }

  // Cancelamento nao apaga o lead: devolve ele para a conversa, que e onde o
  // parceiro consegue agir de novo.
  if (cancelou) {
    await exec(
      `UPDATE parceiro_leads
          SET situacao = 'ligou', reuniao_em = NULL, cal_uid = NULL,
              atualizado_em = NOW()
        WHERE cal_uid = $1`,
      [uid]
    );
    return NextResponse.json({ ok: true, cancelado: true });
  }

  // Reaproveita o upsert por (parceiro_id, telefone): se o parceiro ja tinha
  // cadastrado essa pessoa antes de ligar, atualiza o card em vez de duplicar.
  const leadId = await salvarLeadDoParceiro(parceiro.id, {
    nome: nome || "sem nome",
    empresa: empresa || null,
    telefone,
    email: email || null,
    cidade: cidade || null,
    situacao: "agendou",
    observacao: nota || null,
  });

  await exec(
    `UPDATE parceiro_leads
        SET reuniao_em = $1, cal_uid = $2, reuniao_link = $3, atualizado_em = NOW()
      WHERE id = $4`,
    [inicio, uid.slice(0, 64), link?.slice(0, 400) ?? null, leadId]
  );

  return NextResponse.json({ ok: true, lead: leadId, parceiro: parceiro.codigo });
}

/** Ping do Cal ao salvar o webhook. */
export async function GET() {
  const rows = await query<{ n: number }>(`SELECT 1 AS n`);
  return NextResponse.json({ ok: rows.length > 0 });
}
