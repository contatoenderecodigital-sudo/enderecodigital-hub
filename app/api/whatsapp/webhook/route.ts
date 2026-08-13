import { NextResponse } from "next/server";
import {
  resolverTenantPorPhoneNumberId,
  getNegocio,
  getCerebro,
  registrarMensagem,
  registrarUso,
} from "@/lib/data";
import { iaDisponivel, gerarResposta } from "@/lib/ia";

// GET — verificacao do webhook (Meta hub.challenge).
export async function GET(req: Request) {
  const u = new URL(req.url);
  const mode = u.searchParams.get("hub.mode");
  const token = u.searchParams.get("hub.verify_token");
  const challenge = u.searchParams.get("hub.challenge");
  if (
    mode === "subscribe" &&
    token &&
    process.env.META_WEBHOOK_VERIFY_TOKEN &&
    token === process.env.META_WEBHOOK_VERIFY_TOKEN &&
    challenge
  ) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

interface WaMsg {
  from: string;
  id: string;
  type: string;
  text?: { body: string };
}

// POST — recebe mensagens, roteia por phone_number_id, responde com a IA do tenant.
// Retorna 200 sempre (pra Meta nao reenviar). Numero desconhecido = descarta.
export async function POST(req: Request) {
  const payload = (await req.json().catch(() => null)) as {
    object?: string;
    entry?: { changes?: { value?: { metadata?: { phone_number_id?: string }; messages?: WaMsg[] } }[] }[];
  } | null;

  try {
    if (payload?.object === "whatsapp_business_account") {
      for (const entry of payload.entry ?? []) {
        for (const change of entry.changes ?? []) {
          const value = change.value ?? {};
          const pnid = value.metadata?.phone_number_id;
          const msgs = value.messages ?? [];
          if (!pnid || msgs.length === 0) continue;

          const tenant = await resolverTenantPorPhoneNumberId(pnid);
          if (!tenant) continue; // numero desconhecido -> nunca roteia

          const negocio = await getNegocio(tenant.negocio_id);
          if (!negocio || !negocio.ia_habilitada) continue;

          for (const m of msgs) {
            if (m.type !== "text" || !m.text?.body) continue;
            const texto = m.text.body;
            const de = m.from;
            await registrarMensagem(tenant.negocio_id, de, "entrada", texto, m.id);
            if (!iaDisponivel()) continue;

            const cerebro = await getCerebro(tenant.negocio_id);
            const r = await gerarResposta(negocio, cerebro?.conteudo, [
              { role: "user", content: texto },
            ]);
            if (r.texto) {
              await enviarWhatsApp(tenant.access_token, tenant.phone_number_id, de, r.texto);
              await registrarMensagem(tenant.negocio_id, de, "saida", r.texto, null);
              registrarUso(tenant.negocio_id, "whatsapp", r.model, r.tokensIn, r.tokensOut).catch(
                () => {}
              );
            }
          }
        }
      }
    }
  } catch {
    // erros viram log interno, nunca status de erro pra Meta
  }
  return NextResponse.json({ ok: true });
}

async function enviarWhatsApp(
  accessToken: string,
  phoneNumberId: string,
  para: string,
  texto: string
): Promise<void> {
  await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: para,
      type: "text",
      text: { body: texto },
    }),
  }).catch(() => {});
}
