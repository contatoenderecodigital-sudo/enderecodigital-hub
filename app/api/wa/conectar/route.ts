import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { salvarConexao, destinoDoNegocio } from "@/lib/wa-conexoes";

// Fecha o Embedded Signup: recebe do navegador o `code` (que a Meta devolve no
// FB.login) mais o phone_number_id e o waba_id, e faz o resto no servidor —
// onde o App Secret pode viver.
//
// Três passos, nesta ordem, e cada um é obrigatório:
//   1. troca o code por um token de negócio (é ele que manda mensagem depois)
//   2. assina a WABA no app  -> sem isto a Meta NUNCA entrega mensagem, mesmo
//      com o webhook configurado. É a pegadinha clássica do Embedded Signup.
//   3. grava em wa_conexoes  -> é o que faz o webhook único achar o dono
//
// Se o cliente tem painel próprio, as credenciais são repassadas pra ele no
// fim (ele precisa do token pra ENVIAR; o hub só roteia o que CHEGA).

const GRAPH = "https://graph.facebook.com/v21.0";

export async function POST(req: Request) {
  const s = await getSession();
  if (!s || s.papel !== "owner_plataforma") {
    return NextResponse.json({ erro: "nao_autorizado" }, { status: 401 });
  }

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    return NextResponse.json(
      { erro: "Faltam META_APP_ID e META_APP_SECRET nas variáveis de ambiente do hub." },
      { status: 500 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    negocioId?: string;
    code?: string;
    phoneNumberId?: string;
    wabaId?: string;
  };
  const { negocioId, code, phoneNumberId, wabaId } = body;
  if (!negocioId || !code || !phoneNumberId || !wabaId) {
    return NextResponse.json({ erro: "dados_incompletos" }, { status: 400 });
  }

  // 1) code -> token do negócio
  let token: string;
  try {
    const u = new URL(`${GRAPH}/oauth/access_token`);
    u.searchParams.set("client_id", appId);
    u.searchParams.set("client_secret", appSecret);
    u.searchParams.set("code", code);
    const r = await fetch(u, { cache: "no-store" });
    const j = (await r.json()) as { access_token?: string; error?: { message?: string } };
    if (!r.ok || !j.access_token) {
      return NextResponse.json(
        { erro: `Meta recusou a troca do código: ${j.error?.message || r.status}` },
        { status: 400 }
      );
    }
    token = j.access_token;
  } catch (e) {
    return NextResponse.json({ erro: `Falha ao falar com a Meta: ${String(e).slice(0, 160)}` }, { status: 502 });
  }

  // 2) assina a WABA no app (sem isto não chega mensagem nenhuma)
  let avisoAssinatura: string | null = null;
  try {
    const r = await fetch(`${GRAPH}/${wabaId}/subscribed_apps`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) avisoAssinatura = `Não consegui assinar a WABA no app (${r.status}). Assine à mão no painel da Meta.`;
  } catch {
    avisoAssinatura = "Não consegui assinar a WABA no app. Verifique no painel da Meta.";
  }

  // 3) grava no roteador do hub
  const destino = await destinoDoNegocio(negocioId);
  await salvarConexao({
    negocioId,
    wabaId,
    phoneNumberId,
    accessToken: token,
    webhookDestino: destino,
  });

  // 4) repassa as credenciais pro painel do cliente, quando ele tem um.
  // O hub roteia o que CHEGA; quem ENVIA é o painel dele, e pra isso precisa
  // do token. Best-effort: se o painel estiver fora do ar, a conexão no hub já
  // está válida e isso pode ser refeito.
  let avisoRepasse: string | null = null;
  if (destino) {
    const segredo = process.env.PROVISION_SECRET;
    if (!segredo) {
      avisoRepasse = "Conexão salva, mas PROVISION_SECRET não está configurado: o painel do cliente não recebeu as credenciais.";
    } else {
      try {
        const url = destino.replace(/\/api\/whatsapp$/, "/api/whatsapp/provisionar");
        const r = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json", "x-provision-secret": segredo },
          body: JSON.stringify({ phoneNumberId, wabaId, token }),
        });
        if (!r.ok) avisoRepasse = `O painel do cliente recusou as credenciais (${r.status}).`;
      } catch (e) {
        avisoRepasse = `Não consegui entregar as credenciais ao painel do cliente: ${String(e).slice(0, 120)}`;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    phoneNumberId,
    wabaId,
    destino,
    avisos: [avisoAssinatura, avisoRepasse].filter(Boolean),
  });
}
