import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { signSession, SESSION_COOKIE, cookieOptions } from "@/lib/session";

// Owner sai do workspace do cliente (limpa a impersonacao) e volta ao console.
export async function GET(req: Request) {
  const base = new URL(req.url);
  const s = await getSession();
  if (!s || s.papel !== "owner_plataforma") {
    return NextResponse.redirect(new URL("/login", base));
  }
  const token = await signSession({ ...s, imp: null });
  const res = NextResponse.redirect(new URL("/owner/clientes", base));
  res.cookies.set(SESSION_COOKIE, token, cookieOptions());
  return res;
}
