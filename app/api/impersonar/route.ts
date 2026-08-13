import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { signSession, SESSION_COOKIE, cookieOptions } from "@/lib/session";

// Owner "abre" o workspace de um cliente (impersonacao). Seta o cookie no Response.
export async function POST(req: Request) {
  const base = new URL(req.url);
  const s = await getSession();
  if (!s || s.papel !== "owner_plataforma") {
    return NextResponse.redirect(new URL("/login", base), 303);
  }
  const form = await req.formData();
  const negocioId = String(form.get("negocio_id") || "");
  if (!negocioId) return NextResponse.redirect(new URL("/owner/clientes", base), 303);

  const token = await signSession({ ...s, imp: negocioId });
  const res = NextResponse.redirect(new URL("/app", base), 303);
  res.cookies.set(SESSION_COOKIE, token, cookieOptions());
  return res;
}
