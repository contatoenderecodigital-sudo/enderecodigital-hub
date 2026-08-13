"use server";

import { redirect } from "next/navigation";
import { findUsuariosByEmail } from "@/lib/data";
import { verifyPassword, setSession } from "@/lib/auth";

export async function login(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const senha = String(formData.get("senha") || "");

  if (!email || !senha) redirect("/login?erro=1");

  const usuarios = await findUsuariosByEmail(email);
  for (const u of usuarios) {
    if (await verifyPassword(senha, u.senha_hash)) {
      await setSession({
        uid: u.id,
        email: u.email,
        papel: u.papel,
        negocio_id: u.negocio_id,
        hub_id: u.hub_id,
        imp: null,
      });
      redirect(u.papel === "owner_plataforma" ? "/owner" : "/app");
    }
  }
  redirect("/login?erro=1");
}
