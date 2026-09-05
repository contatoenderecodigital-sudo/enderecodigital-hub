"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getHub, getNegocio } from "@/lib/data";
import { paraCentavos } from "@/lib/agenda";
import {
  fecharComissaoMensal,
  periodoMensal,
  registrarLancamentoProfissional,
  type TipoLancamentoProfissional,
} from "@/lib/agenda-comissoes";
import { activeNegocioId } from "@/lib/tenant";
import { modulosEfetivos } from "@/lib/types";

async function exigirDonoAgenda() {
  const sessao = await getSession();
  if (!sessao) redirect("/login");
  if (sessao.papel !== "dono" && sessao.papel !== "owner_plataforma") {
    redirect("/painel");
  }
  const negocioId = activeNegocioId(sessao);
  if (!negocioId) redirect(sessao.papel === "owner_plataforma" ? "/owner" : "/login");
  const negocio = await getNegocio(negocioId);
  if (!negocio) redirect("/login");
  const hub = await getHub(negocio.hub_id);
  if (!hub || !modulosEfetivos(negocio, hub).agenda) redirect("/painel");
  return negocioId;
}

const texto = (dados: FormData, chave: string): string => String(dados.get(chave) ?? "").trim();

function voltar(profissionalId: string, mes: string, aviso: string, erro = false): never {
  const busca = new URLSearchParams({ profissional: profissionalId, mes, aviso });
  if (erro) busca.set("erro", "1");
  redirect(`/painel/comissoes?${busca.toString()}`);
}

export async function acaoLancarAjuste(dados: FormData) {
  const negocioId = await exigirDonoAgenda();
  const profissionalId = texto(dados, "profissional_id");
  const periodo = periodoMensal(texto(dados, "mes"));
  const tipo = texto(dados, "tipo") as TipoLancamentoProfissional;
  const valorCent = paraCentavos(texto(dados, "valor"));
  const data = texto(dados, "data");

  try {
    await registrarLancamentoProfissional(negocioId, profissionalId, {
      tipo,
      valor_cent: valorCent,
      descricao: texto(dados, "descricao") || null,
      data,
    });
  } catch (erro) {
    voltar(
      profissionalId,
      periodo.mes,
      erro instanceof Error ? erro.message : "Não foi possível registrar o lançamento.",
      true,
    );
  }

  revalidatePath("/painel/comissoes");
  voltar(profissionalId, periodo.mes, "Lançamento incluído no extrato.");
}

export async function acaoFecharMes(dados: FormData) {
  const negocioId = await exigirDonoAgenda();
  const profissionalId = texto(dados, "profissional_id");
  const periodo = periodoMensal(texto(dados, "mes"));
  if (dados.get("confirmar") !== "on") {
    voltar(profissionalId, periodo.mes, "Confirme a conferência antes de fechar o mês.", true);
  }

  try {
    await fecharComissaoMensal(
      negocioId,
      profissionalId,
      periodo,
      texto(dados, "observacao") || null,
    );
  } catch (erro) {
    voltar(
      profissionalId,
      periodo.mes,
      erro instanceof Error ? erro.message : "Não foi possível fechar o mês.",
      true,
    );
  }

  revalidatePath("/painel/comissoes");
  voltar(profissionalId, periodo.mes, `${periodo.rotulo} foi fechado e os totais foram congelados.`);
}
