import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { signSession, SESSION_COOKIE, cookieOptions } from "@/lib/session";

function redir(path: string): NextResponse {
  return new NextResponse(null, { status: 303, headers: { Location: path } });
}

// Owner "abre" o workspace de um cliente (impersonacao). Seta o cookie no Response.
export async function POST(req: Request) {
  const s = await getSession();
  if (!s || s.papel !== "owner_plataforma") return redir("/login");

  const form = await req.formData();
  const negocioId = String(form.get("negocio_id") || "");
  if (!negocioId) return redir("/owner/clientes");

  const token = await signSession({ ...s, imp: negocioId });
  const res = redir("/app");
  res.cookies.set(SESSION_COOKIE, token, cookieOptions());
  return res;
}
