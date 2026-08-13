"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession, setSession, hashPassword } from "@/lib/auth";
import { createNegocio, criarUsuarioCliente, setStatusNegocio } from "@/lib/data";
import { slugify, sufixoCurto } from "@/lib/util";

function ou(v: FormDataEntryValue | null): string | null {
  const s = String(v || "").trim();
  return s ? s : null;
}
function on(v: FormDataEntryValue | null): boolean {
  return String(v || "") === "on";
}

export async function criarClienteAction(formData: FormData) {
  const s = await getSession();
  if (!s || s.papel !== "owner_plataforma") redirect("/login");

  const nome = String(formData.get("nome") || "").trim();
  const hub_id = String(formData.get("hub_id") || "");
  if (!nome || !hub_id) redirect("/owner/clientes?erro=dados");

  const experimental = on(formData.get("experimental"));

  const tipoRaw = String(formData.get("tipo_cliente") || "nao_definido");
  const tipo_cliente = (["recorrente", "nao_recorrente", "nao_definido"].includes(tipoRaw)
    ? tipoRaw
    : "nao_definido") as "recorrente" | "nao_recorrente" | "nao_definido";

  const iaRaw = String(formData.get("ia_modo") || "api_plataforma");
  const ia_modo = (["api_plataforma", "claude_cliente", "sem_ia"].includes(iaRaw)
    ? iaRaw
    : "api_plataforma") as "api_plataforma" | "claude_cliente" | "sem_ia";

  const statusRaw = String(formData.get("status") || "ativo");
  const status = (["ativo", "em_configuracao", "arquivado"].includes(statusRaw)
    ? statusRaw
    : "ativo") as "ativo" | "em_configuracao" | "arquivado";

  const hs = parseInt(String(formData.get("health_score") || "100"), 10);
  const health_score = Number.isFinite(hs) ? Math.min(100, Math.max(0, hs)) : 100;

  const negocio = await createNegocio({
    hub_id,
    slug: `${slugify(nome)}-${sufixoCurto()}`,
    nome,
    nome_fantasia: ou(formData.get("nome_fantasia")),
    segmento: ou(formData.get("segmento")),
    marca_cor: ou(formData.get("marca_cor")),
    marca_logo: ou(formData.get("marca_logo")),
    resp_nome: ou(formData.get("resp_nome")),
    resp_cargo: ou(formData.get("resp_cargo")),
    resp_email: ou(formData.get("resp_email")),
    resp_whatsapp: ou(formData.get("resp_whatsapp")),
    dominio: ou(formData.get("dominio")),
    site_url: ou(formData.get("site_url")),
    instagram_url: ou(formData.get("instagram_url")),
    wpp_comercial: ou(formData.get("wpp_comercial")),
    mod_site: on(formData.get("mod_site")),
    mod_instagram: on(formData.get("mod_instagram")),
    mod_financeiro: on(formData.get("mod_financeiro")),
    mod_crm: on(formData.get("mod_crm")),
    tipo_cliente,
    experimental,
    health_score,
    observacoes: ou(formData.get("observacoes")),
    ia_modo,
    status,
  });

  // Cliente experimental não tem login (só o owner acessa pelo painel).
  if (!experimental) {
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const senha = String(formData.get("senha") || "");
    if (email && senha) {
      const h = await hashPassword(senha);
      await criarUsuarioCliente({ negocio_id: negocio.id, email, senha_hash: h, papel: "dono" });
    }
  }

  revalidatePath("/owner/clientes");
  redirect("/owner/clientes?ok=1");
}

export async function mudarStatusClienteAction(formData: FormData) {
  const s = await getSession();
  if (!s || s.papel !== "owner_plataforma") redirect("/login");
  const negocioId = String(formData.get("negocio_id") || "");
  const statusRaw = String(formData.get("status") || "");
  const status = (["ativo", "em_configuracao", "arquivado"].includes(statusRaw)
    ? statusRaw
    : "ativo") as "ativo" | "em_configuracao" | "arquivado";
  if (negocioId) await setStatusNegocio(negocioId, status);
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
