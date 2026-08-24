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

  // Entrar no hub abre o HUB: os clientes daquele hub, os workspaces, as contas
  // e a configuração dele. Antes isto caía em /operacao, que é o GROOW OS (o
  // CRM da agência) e é outra coisa: dava a impressão de que "Entrar no hub" e
  // "Operação (GROOW OS)" faziam o mesmo, porque terminavam na mesma tela.
  const res = irPara("/operacao/hub/clientes");
  res.cookies.set(HUB_COOKIE, hub.id, {
    httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
