import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getHub } from "@/lib/data";
import { HUB_COOKIE } from "@/lib/hub-ctx";

export const dynamic = "force-dynamic";

// Location RELATIVO (atrás do proxy Coolify, req.url é o host interno 0.0.0.0:3000).
function irPara(path: string) {
  return new NextResponse(null, { status: 303, headers: { Location: path } });
}

export async function GET(req: Request) {
  const s = await getSession();
  if (!s || s.papel !== "owner_plataforma") return irPara("/login");

  const id = new URL(req.url).searchParams.get("id") || "";

  // id fora do formato UUID quebra a query no Postgres. Trata como "hub não existe":
  // sem gravar cookie, volta pra God-view em vez de estourar 500.
  let hub = null;
  if (id) {
    try {
      hub = await getHub(id);
    } catch {
      hub = null;
    }
  }
  if (!hub) return irPara("/owner");

  // Entrar no hub abre o HUB dentro do CONSOLE (/owner), que e onde mora o
  // menu completo: clientes, workspaces, sites, modelos, WhatsApp, contas e
  // assentos Claude, tokens, suporte, auditoria, seguranca, alertas, flags.
  //
  // Nao vai pra /operacao (que e o GROOW OS, o CRM da agencia, outra coisa)
  // nem pra /operacao/hub/*, que e uma copia parcial dessas telas com so 5
  // das 17 e mora no shell claro do GROOW.
  const res = irPara("/owner/clientes");
  res.cookies.set(HUB_COOKIE, hub.id, {
    httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
