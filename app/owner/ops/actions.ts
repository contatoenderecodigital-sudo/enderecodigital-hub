"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  criarOpsLead, moverOpsLeadStatus, excluirOpsLead,
  criarOpsCliente, setOpsClienteStatus, marcarPago,
} from "@/lib/ops";

// ---- LEADS ----
export async function novoLeadAction(fd: FormData) {
  const nome = String(fd.get("nome") || "").trim();
  if (!nome) redirect("/owner/ops/leads?erro=nome");
  await criarOpsLead({
    nome,
    empresa: String(fd.get("empresa") || ""),
    whatsapp: String(fd.get("whatsapp") || ""),
    email: String(fd.get("email") || ""),
    setor: String(fd.get("setor") || ""),
    origem: String(fd.get("origem") || "manual"),
    status: String(fd.get("status") || "novo"),
  });
  revalidatePath("/owner/ops/leads");
  redirect("/owner/ops/leads?ok=1");
}

export async function moverLeadAction(fd: FormData) {
  const id = Number(fd.get("id"));
  const status = String(fd.get("status") || "");
  if (id && status) await moverOpsLeadStatus(id, status);
  revalidatePath("/owner/ops/leads");
}

export async function excluirLeadAction(fd: FormData) {
  const id = Number(fd.get("id"));
  if (id) await excluirOpsLead(id);
  revalidatePath("/owner/ops/leads");
}

// ---- CLIENTES ----
export async function novoClienteAction(fd: FormData) {
  const empresa = String(fd.get("empresa") || "").trim();
  if (!empresa) redirect("/owner/ops/carteira?erro=empresa");
  await criarOpsCliente({
    empresa,
    responsavel: String(fd.get("responsavel") || ""),
    email: String(fd.get("email") || ""),
    whatsapp: String(fd.get("whatsapp") || ""),
    plano: String(fd.get("plano") || ""),
    valor_mensal: Number(String(fd.get("valor_mensal") || "0").replace(",", ".")) || 0,
    valor_setup: Number(String(fd.get("valor_setup") || "0").replace(",", ".")) || 0,
    inicio_contrato: String(fd.get("inicio_contrato") || "") || undefined,
  });
  revalidatePath("/owner/ops/carteira");
  redirect("/owner/ops/carteira?ok=1");
}

export async function statusClienteAction(fd: FormData) {
  const id = Number(fd.get("id"));
  const status = String(fd.get("status") || "");
  if (id && status) await setOpsClienteStatus(id, status);
  revalidatePath("/owner/ops/carteira");
}

// ---- COBRANÇAS ----
export async function marcarPagoAction(fd: FormData) {
  const clienteId = Number(fd.get("cliente_id"));
  const ym = String(fd.get("ym") || "");
  const valor = Number(fd.get("valor") || 0);
  if (clienteId && ym) await marcarPago(clienteId, ym, valor);
  revalidatePath("/owner/ops/cobrancas");
}
