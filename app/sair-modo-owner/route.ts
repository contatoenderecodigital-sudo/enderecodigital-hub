import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { signSession, SESSION_COOKIE, cookieOptions } from "@/lib/session";

function redir(path: string): NextResponse {
  return new NextResponse(null, { status: 303, headers: { Location: path } });
}

// Owner sai do workspace do cliente (limpa a impersonacao) e volta ao console.
export async function GET() {
  const s = await getSession();
  if (!s || s.papel !== "owner_plataforma") return redir("/login");
  const token = await signSession({ ...s, imp: null });
  const res = redir("/owner/clientes");
  res.cookies.set(SESSION_COOKIE, token, cookieOptions());
  return res;
}
