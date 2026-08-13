"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { activeNegocioId } from "@/lib/tenant";
import { ensureFunil, criarLead, moverLead, excluirLead } from "@/lib/data";

function ou(v: FormDataEntryValue | null): string | null {
  const s = String(v || "").trim();
  return s ? s : null;
}

async function tenant(): Promise<string> {
  const s = await getSession();
  if (!s) redirect("/login");
  const neg = activeNegocioId(s);
  if (!neg) redirect("/owner");
  return neg;
}

export async function criarLeadAction(formData: FormData) {
  const neg = await tenant();
  const nome = String(formData.get("nome") || "").trim();
  if (!nome) redirect("/app/crm");
  const etapas = await ensureFunil(neg);
  const etapaId = String(formData.get("etapa_id") || "") || etapas[0]?.id || null;
  await criarLead({
    negocio_id: neg,
    nome,
    telefone: ou(formData.get("telefone")),
    email: ou(formData.get("email")),
    origem: "manual",
    etapa_id: etapaId,
  });
  revalidatePath("/app/crm");
  redirect("/app/crm");
}

export async function moverLeadAction(formData: FormData) {
  const neg = await tenant();
  const leadId = String(formData.get("lead_id") || "");
  const etapaId = String(formData.get("etapa_id") || "");
  if (leadId && etapaId) await moverLead(leadId, neg, etapaId);
  revalidatePath("/app/crm");
  redirect("/app/crm");
}

export async function excluirLeadAction(formData: FormData) {
  const neg = await tenant();
  const leadId = String(formData.get("lead_id") || "");
  if (leadId) await excluirLead(leadId, neg);
  revalidatePath("/app/crm");
  redirect("/app/crm");
}
