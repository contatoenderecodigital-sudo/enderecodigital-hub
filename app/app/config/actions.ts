"use server";

import { redirect } from "next/navigation";
import { getSession, verifyPassword, hashPassword } from "@/lib/auth";
import { getUsuario, updateSenhaUsuario } from "@/lib/data";

export async function trocarSenha(formData: FormData) {
  const s = await getSession();
  if (!s) redirect("/login");

  const atual = String(formData.get("atual") || "");
  const nova = String(formData.get("nova") || "");
  if (nova.length < 6) redirect("/app/config?erro=curta");

  const u = await getUsuario(s.uid);
  if (!u) redirect("/login");
  if (!(await verifyPassword(atual, u.senha_hash))) redirect("/app/config?erro=atual");

  await updateSenhaUsuario(u.id, await hashPassword(nova));
  redirect("/app/config?ok=1");
}
