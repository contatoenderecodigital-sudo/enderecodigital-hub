import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Escaneia os sites dos prospects com dois objetivos:
// 1. fora do ar / quebrado = oportunidade de venda ainda maior (o cara PAGOU
//    por site um dia e foi abandonado);
// 2. garimpar o EMAIL de contato na página (o Google Places não devolve email)
//    pra alimentar a prospecção por email.

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z]{2,})+/g;
// lixo comum em HTML: assets, trackers, placeholders e no-reply
const EMAIL_LIXO = /\.(png|jpe?g|gif|svg|webp|css|js|woff2?)$|wixpress|sentry|example\.|schema\.org|w3\.org|@2x|no-?reply|dominio|seudominio|email\.com|yourdomain/i;

function extrairEmail(html: string): string {
  const brutos = html.match(EMAIL_RE) ?? [];
  const emails = [...new Set(brutos.map((e) => e.toLowerCase()))].filter(
    (e) => !EMAIL_LIXO.test(e) && e.length <= 80
  );
  if (!emails.length) return "";
  // prefere caixa de contato comercial em vez de email pessoal aleatório
  return (
    emails.find((e) => /^(contato|comercial|vendas|atendimento|adm|administrativo|financeiro|falecom|ola|oi|sac)@/.test(e)) ??
    emails[0]
  );
}

export async function POST(req: Request) {
  let body: { urls?: string[] };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const urls = (body.urls ?? []).filter((u) => typeof u === "string" && u.trim()).slice(0, 40);
  if (!urls.length) return NextResponse.json({ error: "Nenhuma URL pra escanear" }, { status: 400 });

  const resultados = await Promise.all(
    urls.map(async (url) => {
      const alvo = url.startsWith("http") ? url : `https://${url}`;
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 8000);
        const res = await fetch(alvo, {
          method: "GET",
          redirect: "follow",
          signal: ctrl.signal,
          headers: { "user-agent": "Mozilla/5.0 (compatible; EnderecoDigitalBot/1.0)" },
        });
        clearTimeout(timer);
        let email = "";
        if (res.ok) {
          const html = (await res.text().catch(() => "")).slice(0, 400_000);
          email = extrairEmail(html);
        }
        return { url, ok: res.ok, status: res.status, email };
      } catch {
        return { url, ok: false, status: 0, email: "" }; // DNS morto, timeout, SSL quebrado
      }
    })
  );

  return NextResponse.json({ resultados });
}
