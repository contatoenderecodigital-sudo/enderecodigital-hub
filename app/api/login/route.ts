import { NextResponse } from "next/server";
import { findUsuariosByEmail } from "@/lib/data";
import { verifyPassword } from "@/lib/auth";
import { signSession, SESSION_COOKIE, cookieOptions } from "@/lib/session";

// Redirect com Location RELATIVO: o navegador resolve contra a URL publica.
// (req.url aqui reflete o host interno 0.0.0.0:3000 atras do proxy.)
function redir(path: string): NextResponse {
  return new NextResponse(null, { status: 303, headers: { Location: path } });
}

export async function POST(req: Request) {
  const form = await req.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const senha = String(form.get("senha") || "");

  if (!email || !senha) return redir("/login?erro=1");

  const usuarios = await findUsuariosByEmail(email);
  for (const u of usuarios) {
    if (await verifyPassword(senha, u.senha_hash)) {
      const token = await signSession({
        uid: u.id,
        email: u.email,
        papel: u.papel,
        negocio_id: u.negocio_id,
        hub_id: u.hub_id,
        imp: null,
      });
      const res = redir(u.papel === "owner_plataforma" ? "/owner" : "/login");
      res.cookies.set(SESSION_COOKIE, token, cookieOptions());
      return res;
    }
  }

  return redir("/login?erro=1");
}
