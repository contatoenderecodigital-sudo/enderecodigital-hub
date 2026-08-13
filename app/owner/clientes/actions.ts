"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession, setSession, hashPassword } from "@/lib/auth";
import { createNegocio, criarUsuarioCliente } from "@/lib/data";
import { slugify, sufixoCurto } from "@/lib/util";

function ou(v: FormDataEntryValue | null): string | null {
  const s = String(v || "").trim();
  return s ? s : null;
}

export async function criarClienteAction(formData: FormData) {
  const s = await getSession();
  if (!s || s.papel !== "owner_plataforma") redirect("/login");

  const nome = String(formData.get("nome") || "").trim();
  const hub_id = String(formData.get("hub_id") || "");
  if (!nome || !hub_id) redirect("/owner/clientes");

  const negocio = await createNegocio({
    hub_id,
    slug: `${slugify(nome)}-${sufixoCurto()}`,
    nome,
    nome_fantasia: ou(formData.get("nome_fantasia")),
    segmento: ou(formData.get("segmento")),
    marca_cor: ou(formData.get("marca_cor")),
    resp_nome: ou(formData.get("resp_nome")),
    resp_email: ou(formData.get("resp_email")),
    resp_whatsapp: ou(formData.get("resp_whatsapp")),
    site_url: ou(formData.get("site_url")),
    instagram_url: ou(formData.get("instagram_url")),
  });

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const senha = String(formData.get("senha") || "");
  if (email && senha) {
    const h = await hashPassword(senha);
    await criarUsuarioCliente({ negocio_id: negocio.id, email, senha_hash: h, papel: "dono" });
  }

  revalidatePath("/owner/clientes");
  redirect("/owner/clientes");
}

// Owner "abre" o workspace de um cliente (impersonacao auditavel).
export async function impersonarAction(formData: FormData) {
  const s = await getSession();
  if (!s || s.papel !== "owner_plataforma") redirect("/login");
  const negocioId = String(formData.get("negocio_id") || "");
  if (!negocioId) redirect("/owner/clientes");
  await setSession({ ...s, imp: negocioId });
  redirect("/app");
}
