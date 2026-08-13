import { NextResponse } from "next/server";
import { findUsuariosByEmail } from "@/lib/data";
import { verifyPassword } from "@/lib/auth";
import { signSession, SESSION_COOKIE, cookieOptions } from "@/lib/session";

// Login como Route Handler: seta o cookie NO PROPRIO Response do redirect.
// (Server Action com cookies().set()+redirect() nao persiste o cookie no Next.)
export async function POST(req: Request) {
  const base = new URL(req.url);
  const form = await req.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const senha = String(form.get("senha") || "");

  if (!email || !senha) {
    return NextResponse.redirect(new URL("/login?erro=1", base), 303);
  }

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
      const destino = u.papel === "owner_plataforma" ? "/owner" : "/app";
      const res = NextResponse.redirect(new URL(destino, base), 303);
      res.cookies.set(SESSION_COOKIE, token, cookieOptions());
      return res;
    }
  }

  return NextResponse.redirect(new URL("/login?erro=1", base), 303);
}
