"use server";

// Server actions da gestão do HUB dentro do GROOW OS.
// Reaproveitam a MESMA camada de dados das telas /owner (lib/data + lib/platform-config),
// só mudando o redirect/revalidate pra manter o dono dentro da interface /operacao.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession, hashPassword } from "@/lib/auth";
import {
  createNegocio,
  criarUsuarioCliente,
  setStatusNegocio,
  excluirCliente,
} from "@/lib/data";
import {
  salvarHubConfig,
  conectarContaClaude,
  toggleContaCompartilhada,
  setContaStatus,
  excluirContaClaude,
} from "@/lib/platform-config";
import { slugify, sufixoCurto } from "@/lib/util";

const HUB = "/operacao/hub";

async function guard() {
  const s = await getSession();
  if (!s || s.papel !== "owner_plataforma") redirect("/login");
  return s;
}
function txt(fd: FormData, k: string) {
  return String(fd.get(k) || "").trim();
}
function nul(fd: FormData, k: string) {
  const v = txt(fd, k);
  return v || null;
}
function on(fd: FormData, k: string) {
  return String(fd.get(k) || "") === "on";
}

// ---------------- CLIENTES ----------------
export async function criarClienteAction(fd: FormData) {
  await guard();

  const nome = txt(fd, "nome");
  const hub_id = txt(fd, "hub_id");
  if (!nome || !hub_id) redirect(`${HUB}/clientes?erro=dados`);

  const experimental = on(fd, "experimental");

  const tipoRaw = txt(fd, "tipo_cliente") || "nao_definido";
  const tipo_cliente = (["recorrente", "nao_recorrente", "nao_definido"].includes(tipoRaw)
    ? tipoRaw
    : "nao_definido") as "recorrente" | "nao_recorrente" | "nao_definido";

  const iaRaw = txt(fd, "ia_modo") || "api_plataforma";
  const ia_modo = (["api_plataforma", "claude_cliente", "sem_ia"].includes(iaRaw)
    ? iaRaw
    : "api_plataforma") as "api_plataforma" | "claude_cliente" | "sem_ia";

  const statusRaw = txt(fd, "status") || "ativo";
  const status = (["ativo", "em_configuracao", "arquivado"].includes(statusRaw)
    ? statusRaw
    : "ativo") as "ativo" | "em_configuracao" | "arquivado";

  const hs = parseInt(txt(fd, "health_score") || "100", 10);
  const health_score = Number.isFinite(hs) ? Math.min(100, Math.max(0, hs)) : 100;

  const negocio = await createNegocio({
    hub_id,
    slug: `${slugify(nome)}-${sufixoCurto()}`,
    nome,
    nome_fantasia: nul(fd, "nome_fantasia"),
    segmento: nul(fd, "segmento"),
    marca_cor: nul(fd, "marca_cor"),
    marca_logo: nul(fd, "marca_logo"),
    resp_nome: nul(fd, "resp_nome"),
    resp_cargo: nul(fd, "resp_cargo"),
    resp_email: nul(fd, "resp_email"),
    resp_whatsapp: nul(fd, "resp_whatsapp"),
    dominio: nul(fd, "dominio"),
    site_url: nul(fd, "site_url"),
    instagram_url: nul(fd, "instagram_url"),
    wpp_comercial: nul(fd, "wpp_comercial"),
    mod_site: on(fd, "mod_site"),
    mod_instagram: on(fd, "mod_instagram"),
    mod_financeiro: on(fd, "mod_financeiro"),
    mod_crm: on(fd, "mod_crm"),
    tipo_cliente,
    experimental,
    health_score,
    observacoes: nul(fd, "observacoes"),
    ia_modo,
    status,
  });

  // Cliente experimental não tem login (só o owner acessa pelo painel).
  if (!experimental) {
    const email = txt(fd, "email").toLowerCase();
    const senha = String(fd.get("senha") || "");
    if (email && senha) {
      const h = await hashPassword(senha);
      await criarUsuarioCliente({ negocio_id: negocio.id, email, senha_hash: h, papel: "dono" });
    }
  }

  revalidatePath(`${HUB}/clientes`);
  revalidatePath(`${HUB}/workspaces`);
  redirect(`${HUB}/clientes?ok=1`);
}

export async function mudarStatusClienteAction(fd: FormData) {
  await guard();
  const negocioId = txt(fd, "negocio_id");
  const statusRaw = txt(fd, "status");
  const status = (["ativo", "em_configuracao", "arquivado"].includes(statusRaw)
    ? statusRaw
    : "ativo") as "ativo" | "em_configuracao" | "arquivado";
  if (negocioId) await setStatusNegocio(negocioId, status);
  revalidatePath(`${HUB}/clientes`);
  revalidatePath(`${HUB}/workspaces`);
  redirect(`${HUB}/clientes`);
}

export async function excluirClienteAction(fd: FormData) {
  await guard();
  const negocioId = txt(fd, "negocio_id");
  const voltar = txt(fd, "voltar") || `${HUB}/workspaces`;
  if (negocioId) await excluirCliente(negocioId);
  revalidatePath(`${HUB}/clientes`);
  revalidatePath(`${HUB}/workspaces`);
  redirect(voltar);
}

// ---------------- CONTAS CLAUDE ----------------
export async function conectarContaAction(fd: FormData) {
  await guard();
  const nome = txt(fd, "nome");
  if (!nome) redirect(`${HUB}/contas-claude?erro=nome`);
  await conectarContaClaude({ nome, plano: txt(fd, "plano"), tipo: txt(fd, "tipo") || "dedicada" });
  revalidatePath(`${HUB}/contas-claude`);
  redirect(`${HUB}/contas-claude?ok=1`);
}
export async function toggleCompartilhadaAction(fd: FormData) {
  await guard();
  const id = txt(fd, "id");
  if (id) await toggleContaCompartilhada(id);
  revalidatePath(`${HUB}/contas-claude`);
  redirect(`${HUB}/contas-claude`);
}
export async function statusContaAction(fd: FormData) {
  await guard();
  const id = txt(fd, "id");
  const status = txt(fd, "status");
  if (id && status) await setContaStatus(id, status);
  revalidatePath(`${HUB}/contas-claude`);
  redirect(`${HUB}/contas-claude`);
}
export async function excluirContaAction(fd: FormData) {
  await guard();
  const id = txt(fd, "id");
  if (id) await excluirContaClaude(id);
  revalidatePath(`${HUB}/contas-claude`);
  redirect(`${HUB}/contas-claude`);
}

// ---------------- CONFIG DO HUB ----------------
export async function salvarConfigAction(fd: FormData) {
  await guard();
  const nome = txt(fd, "nome");
  if (!nome) redirect(`${HUB}/config?erro=nome`);
  await salvarHubConfig({
    nome,
    dominio: nul(fd, "dominio"),
    descricao: nul(fd, "descricao"),
    cor_destaque: nul(fd, "cor_destaque"),
    login_titulo: nul(fd, "login_titulo"),
    login_botao: nul(fd, "login_botao"),
    ia_limite_mensal_usd: Number(String(fd.get("ia_limite_mensal_usd") || "0").replace(",", ".")) || 0,
  });
  revalidatePath(`${HUB}/config`);
  redirect(`${HUB}/config?ok=1`);
}
