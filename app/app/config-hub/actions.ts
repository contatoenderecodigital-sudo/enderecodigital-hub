"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession, hashPassword } from "@/lib/auth";
import { activeNegocioId, ehOwner } from "@/lib/tenant";
import {
  updateIdentidade,
  updateModulos,
  updateIA,
  setCerebro,
  resetSenhaDono,
  setStatusNegocio,
} from "@/lib/data";

function str(v: FormDataEntryValue | null): string | null {
  const s = String(v || "").trim();
  return s ? s : null;
}

// Guard: config do cliente é SÓ do owner impersonando. Retorna o negocio_id ativo.
async function guard(): Promise<string> {
  const s = await getSession();
  if (!s || !ehOwner(s)) redirect("/app");
  const neg = activeNegocioId(s);
  if (!neg) redirect("/owner");
  return neg;
}

export async function salvarIdentidade(formData: FormData) {
  const neg = await guard();
  await updateIdentidade(neg, {
    nome_fantasia: str(formData.get("nome_fantasia")),
    segmento: str(formData.get("segmento")),
    marca_cor: str(formData.get("marca_cor")),
  });
  revalidatePath("/app/config-hub");
  redirect("/app/config-hub?ok=identidade");
}

export async function salvarModulos(formData: FormData) {
  const neg = await guard();
  await updateModulos(neg, {
    site: formData.get("site") === "on",
    instagram: formData.get("instagram") === "on",
    crm: formData.get("crm") === "on",
    financeiro: formData.get("financeiro") === "on",
  });
  revalidatePath("/app/config-hub");
  redirect("/app/config-hub?ok=modulos");
}

export async function salvarIA(formData: FormData) {
  const neg = await guard();
  const limite = parseInt(String(formData.get("ia_limite_tokens") || "0"), 10);
  await updateIA(neg, {
    ia_habilitada: formData.get("ia_habilitada") === "on",
    ia_modelo_chat: str(formData.get("ia_modelo_chat")),
    ia_limite_tokens: Number.isFinite(limite) && limite > 0 ? limite : 0,
  });
  revalidatePath("/app/config-hub");
  redirect("/app/config-hub?ok=ia");
}

export async function salvarCerebro(formData: FormData) {
  const neg = await guard();
  const conteudo = String(formData.get("conteudo") || "").trim();
  await setCerebro(neg, str(formData.get("titulo")), conteudo);
  revalidatePath("/app/config-hub");
  redirect("/app/config-hub?ok=cerebro");
}

export async function resetarSenhaCliente(formData: FormData) {
  const neg = await guard();
  const nova = String(formData.get("nova_senha") || "");
  if (nova.length < 6) redirect("/app/config-hub?erro=senha");
  const hash = await hashPassword(nova);
  const ok = await resetSenhaDono(neg, hash);
  redirect(ok ? "/app/config-hub?ok=senha" : "/app/config-hub?erro=sem_dono");
}

export async function definirStatus(formData: FormData) {
  const neg = await guard();
  const status = String(formData.get("status") || "ativo");
  const valido = ["ativo", "em_configuracao", "arquivado"].includes(status)
    ? (status as "ativo" | "em_configuracao" | "arquivado")
    : "ativo";
  await setStatusNegocio(neg, valido);
  revalidatePath("/app/config-hub");
  redirect("/app/config-hub?ok=status");
}
