"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { createHub } from "@/lib/data";
import { slugify, sufixoCurto } from "@/lib/util";

function ou(v: FormDataEntryValue | null): string | null {
  const s = String(v || "").trim();
  return s ? s : null;
}

export async function criarHubAction(formData: FormData) {
  const s = await getSession();
  if (!s || s.papel !== "owner_plataforma") redirect("/login");

  const nome = String(formData.get("nome") || "").trim();
  if (!nome) redirect("/owner/hubs");

  const tema = String(formData.get("tema_modo") || "escuro") === "claro" ? "claro" : "escuro";
  const tipoRaw = String(formData.get("tipografia") || "moderna");
  const tipografia = (["moderna", "classica", "mono"].includes(tipoRaw) ? tipoRaw : "moderna") as
    | "moderna"
    | "classica"
    | "mono";

  const slugInput = ou(formData.get("slug"));
  const input = {
    nome,
    slug: slugInput ? slugify(slugInput) : slugify(nome),
    tema_modo: tema as "escuro" | "claro",
    cor_destaque: String(formData.get("cor_destaque") || "#C9A961"),
    cor_apoio: String(formData.get("cor_apoio") || "#1B2A4A"),
    cor_fundo: String(formData.get("cor_fundo") || (tema === "claro" ? "#F5F3EE" : "#0B1838")),
    cor_texto: String(formData.get("cor_texto") || (tema === "claro" ? "#0B1838" : "#F5F3EE")),
    tipografia,
    versao: String(formData.get("versao") || "1.0.0").trim() || "1.0.0",
    logo_url: ou(formData.get("logo_url")),
    favicon_url: ou(formData.get("favicon_url")),
    descricao: ou(formData.get("descricao")),
    dominio: ou(formData.get("dominio")),
    login_titulo: String(formData.get("login_titulo") || nome).trim() || nome,
    login_botao: String(formData.get("login_botao") || "Entrar").trim() || "Entrar",
    mod_site: formData.get("mod_site") === "on",
    mod_instagram: formData.get("mod_instagram") === "on",
    mod_financeiro: formData.get("mod_financeiro") === "on",
    mod_crm: formData.get("mod_crm") === "on",
  };

  try {
    await createHub(input);
  } catch (e: unknown) {
    if (typeof e === "object" && e && "code" in e && (e as { code?: string }).code === "23505") {
      await createHub({ ...input, slug: `${input.slug}-${sufixoCurto()}` });
    } else {
      throw e;
    }
  }

  revalidatePath("/owner/hubs");
  redirect("/owner/hubs?ok=1");
}
