"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import {
  setFlag, abrirTicket, resolverTicket, reabrirTicket,
  criarAssento, setAssentoStatus, excluirAssento,
  criarModelo, excluirModelo, salvarHubConfig,
  conectarContaClaude, toggleContaCompartilhada, setContaStatus, excluirContaClaude,
} from "@/lib/platform-config";

async function guard() {
  const s = await getSession();
  if (!s || s.papel !== "owner_plataforma") redirect("/login");
}
function txt(fd: FormData, k: string) { return String(fd.get(k) || "").trim(); }
function nul(fd: FormData, k: string) { const v = txt(fd, k); return v || null; }

// ---- FLAGS ----
export async function toggleFlagAction(fd: FormData) {
  await guard();
  const chave = txt(fd, "chave");
  const ligado = txt(fd, "ligado") === "1";
  if (chave) await setFlag(chave, ligado);
  revalidatePath("/owner/flags");
}

// ---- SUPORTE ----
export async function abrirTicketAction(fd: FormData) {
  await guard();
  const assunto = txt(fd, "assunto");
  if (!assunto) redirect("/owner/suporte?erro=assunto");
  await abrirTicket({ assunto, mensagem: txt(fd, "mensagem"), prioridade: txt(fd, "prioridade") || "normal" });
  revalidatePath("/owner/suporte");
  redirect("/owner/suporte?ok=1");
}
export async function resolverTicketAction(fd: FormData) {
  await guard();
  const id = Number(fd.get("id"));
  const reabrir = txt(fd, "reabrir") === "1";
  if (id) reabrir ? await reabrirTicket(id) : await resolverTicket(id);
  revalidatePath("/owner/suporte");
}

// ---- ASSENTOS ----
export async function novoAssentoAction(fd: FormData) {
  await guard();
  const cliente = txt(fd, "cliente");
  if (!cliente) redirect("/owner/assentos?erro=cliente");
  await criarAssento({ cliente, plano: txt(fd, "plano") || "Pro", token_ref: txt(fd, "token_ref"), notas: txt(fd, "notas") });
  revalidatePath("/owner/assentos");
  redirect("/owner/assentos?ok=1");
}
export async function statusAssentoAction(fd: FormData) {
  await guard();
  const id = Number(fd.get("id"));
  const status = txt(fd, "status");
  if (id && status) await setAssentoStatus(id, status);
  revalidatePath("/owner/assentos");
}
export async function excluirAssentoAction(fd: FormData) {
  await guard();
  const id = Number(fd.get("id"));
  if (id) await excluirAssento(id);
  revalidatePath("/owner/assentos");
}

// ---- MODELOS ----
export async function novoModeloAction(fd: FormData) {
  await guard();
  const nome = txt(fd, "nome");
  const tipo = txt(fd, "tipo") || "post";
  if (!nome) redirect(`/owner/modelos?t=${tipo}&erro=nome`);
  await criarModelo({ tipo, nome, nicho: txt(fd, "nicho"), thumb_url: txt(fd, "thumb_url"), link_url: txt(fd, "link_url") });
  revalidatePath("/owner/modelos");
  redirect(`/owner/modelos?t=${tipo}&ok=1`);
}
export async function excluirModeloAction(fd: FormData) {
  await guard();
  const id = Number(fd.get("id"));
  if (id) await excluirModelo(id);
  revalidatePath("/owner/modelos");
}

// ---- CONFIG DO HUB ----
export async function salvarConfigAction(fd: FormData) {
  await guard();
  const nome = txt(fd, "nome");
  if (!nome) redirect("/owner/config?erro=nome");
  await salvarHubConfig({
    nome,
    dominio: nul(fd, "dominio"),
    descricao: nul(fd, "descricao"),
    cor_destaque: nul(fd, "cor_destaque"),
    login_titulo: nul(fd, "login_titulo"),
    login_botao: nul(fd, "login_botao"),
    ia_limite_mensal_usd: Number(String(fd.get("ia_limite_mensal_usd") || "0").replace(",", ".")) || 0,
  });
  revalidatePath("/owner/config");
  redirect("/owner/config?ok=1");
}

// ---- CONTAS CLAUDE ----
export async function conectarContaAction(fd: FormData) {
  await guard();
  const nome = txt(fd, "nome");
  if (!nome) redirect("/owner/contas-claude?erro=nome");
  await conectarContaClaude({ nome, plano: txt(fd, "plano"), tipo: txt(fd, "tipo") || "dedicada" });
  revalidatePath("/owner/contas-claude");
  redirect("/owner/contas-claude?ok=1");
}
export async function toggleCompartilhadaAction(fd: FormData) {
  await guard();
  const id = txt(fd, "id");
  if (id) await toggleContaCompartilhada(id);
  revalidatePath("/owner/contas-claude");
}
export async function statusContaAction(fd: FormData) {
  await guard();
  const id = txt(fd, "id");
  const status = txt(fd, "status");
  if (id && status) await setContaStatus(id, status);
  revalidatePath("/owner/contas-claude");
}
export async function excluirContaAction(fd: FormData) {
  await guard();
  const id = txt(fd, "id");
  if (id) await excluirContaClaude(id);
  revalidatePath("/owner/contas-claude");
}
