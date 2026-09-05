"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getNegocio, getHub } from "@/lib/data";
import { modulosEfetivos } from "@/lib/types";
import { activeNegocioId } from "@/lib/tenant";
import {
  criarAgendamento, mudarStatus, concluirAtendimento, reabrirAtendimento,
  acharOuCriarCliente,
  criarProfissional, atualizarProfissional, arquivarProfissional, salvarJornada,
  criarServico, atualizarServico, arquivarServico,
  criarExcecao, salvarConfig, paraCentavos,
  HorarioOcupado, AtendimentoJaFechado,
  type StatusAgendamento,
} from "@/lib/agenda";

// ============================================================================
//  ACOES DO PAINEL · AGENDA
//
//  Server actions em vez de rotas de API. O formulario chama a funcao direto,
//  entao nao existe endpoint solto pra alguem achar, nem contrato JSON pra
//  manter em dois lugares.
//
//  TODA ACAO COMECA PELO MESMO PORTAO: exigirAcesso(). Ela resolve o inquilino
//  pela SESSAO e confere se o modulo esta ligado. Nenhuma acao aqui aceita
//  negocioId vindo do formulario, porque campo escondido de formulario e
//  editavel por qualquer um com o inspetor aberto.
//
//  ERRO VIRA MENSAGEM NA URL, nao tela branca. Quem opera isso esta com um
//  cliente na cadeira esperando, e "Application error" nao ajuda ninguem.
// ============================================================================

async function exigirAcesso() {
  const s = await getSession();
  if (!s) redirect("/login");
  const negocioId = activeNegocioId(s);
  if (!negocioId) redirect("/login");

  const negocio = await getNegocio(negocioId);
  if (!negocio) redirect("/login");
  const hub = await getHub(negocio.hub_id);
  if (!hub || !modulosEfetivos(negocio, hub).agenda) redirect("/painel");

  return { negocioId, usuarioId: s.uid };
}

const texto = (f: FormData, k: string): string => String(f.get(k) ?? "").trim();
const opcional = (f: FormData, k: string): string | null => texto(f, k) || null;
const marcado = (f: FormData, k: string): boolean => f.get(k) === "on" || f.get(k) === "true";
const inteiro = (f: FormData, k: string, padrao = 0): number => {
  const n = Number(texto(f, k).replace(/[^0-9-]/g, ""));
  return Number.isFinite(n) ? n : padrao;
};
// Telefone so digitos, com pais e DDD. Guardar formatado faria o mesmo numero
// virar duas fichas e partir o historico do cliente ao meio.
const soDigitos = (v: string): string => {
  const d = v.replace(/\D/g, "");
  if (!d) return "";
  return d.length <= 11 ? "55" + d : d;
};

function voltarPara(dia: string, aviso?: string) {
  const q = new URLSearchParams({ dia });
  if (aviso) q.set("aviso", aviso);
  redirect(`/painel/agenda?${q.toString()}`);
}

// ---------------------------------------------------------------------------
//  AGENDA
// ---------------------------------------------------------------------------
export async function acaoMarcar(f: FormData) {
  const { negocioId } = await exigirAcesso();

  const dia = texto(f, "dia");
  const hora = texto(f, "hora");
  const profissionalId = texto(f, "profissional_id");
  const servicoIds = f.getAll("servico_id").map(String).filter(Boolean);
  const nome = texto(f, "cliente_nome");
  const telefone = soDigitos(texto(f, "cliente_telefone"));

  if (!dia || !hora || !profissionalId || servicoIds.length === 0 || !nome) {
    voltarPara(dia, "Faltou preencher cliente, profissional, serviço ou horário.");
  }

  const clienteId = await acharOuCriarCliente(negocioId, nome, telefone || null, "painel");

  try {
    await criarAgendamento(negocioId, {
      profissional_id: profissionalId,
      cliente_id: clienteId,
      // Fuso fixo do produto. Sem ele o horario andaria conforme o relogio do
      // container onde o painel estiver rodando.
      inicio: `${dia}T${hora}:00-03:00`,
      servico_ids: servicoIds,
      origem: texto(f, "origem") === "encaixe" ? "encaixe" : "painel",
      observacao: opcional(f, "observacao"),
    });
  } catch (e) {
    if (e instanceof HorarioOcupado) {
      voltarPara(dia, "Esse horário acabou de ser tomado. Escolha outro.");
    }
    voltarPara(dia, e instanceof Error ? e.message : "Não deu pra marcar.");
  }

  revalidatePath("/painel/agenda");
  revalidatePath("/painel");
  voltarPara(dia);
}

export async function acaoMudarStatus(id: string, status: StatusAgendamento, dia: string) {
  const { negocioId } = await exigirAcesso();
  await mudarStatus(negocioId, id, status);
  revalidatePath("/painel/agenda");
  revalidatePath("/painel");
  voltarPara(dia);
}

export async function acaoCancelar(id: string, dia: string, f: FormData) {
  const { negocioId } = await exigirAcesso();
  await mudarStatus(negocioId, id, "cancelado", "barbearia", opcional(f, "motivo") ?? undefined);
  revalidatePath("/painel/agenda");
  revalidatePath("/painel");
  voltarPara(dia);
}

// Concluir e o momento em que o servico vira dinheiro: sai comanda e sai
// comissao, numa transacao so. Ver concluirAtendimento em lib/agenda.ts.
export async function acaoConcluir(id: string, dia: string, f: FormData) {
  const { negocioId } = await exigirAcesso();
  try {
    await concluirAtendimento(negocioId, id, {
      forma_pagamento: opcional(f, "forma_pagamento"),
      desconto_cent: paraCentavos(texto(f, "desconto")),
    });
  } catch (e) {
    if (e instanceof AtendimentoJaFechado) voltarPara(dia, e.message);
    voltarPara(dia, e instanceof Error ? e.message : "Não deu pra fechar.");
  }
  revalidatePath("/painel/agenda");
  revalidatePath("/painel");
  revalidatePath("/painel/agenda/raio-x");
  voltarPara(dia);
}

export async function acaoReabrir(id: string, dia: string) {
  const { negocioId } = await exigirAcesso();
  await reabrirAtendimento(negocioId, id);
  revalidatePath("/painel/agenda");
  revalidatePath("/painel");
  voltarPara(dia);
}

// ---------------------------------------------------------------------------
//  EQUIPE
// ---------------------------------------------------------------------------
export async function acaoCriarProfissional(f: FormData) {
  const { negocioId } = await exigirAcesso();
  const nome = texto(f, "nome");
  if (!nome) redirect("/painel/equipe?aviso=Nome é obrigatório.");

  await criarProfissional(negocioId, {
    nome,
    apelido: opcional(f, "apelido"),
    telefone: soDigitos(texto(f, "telefone")) || null,
    cor: opcional(f, "cor"),
    comissao_servico_pct: texto(f, "comissao") ? inteiro(f, "comissao") : null,
    aceita_online: marcado(f, "aceita_online"),
    ordem: inteiro(f, "ordem"),
  });
  revalidatePath("/painel/equipe");
  revalidatePath("/painel/agenda");
  redirect("/painel/equipe");
}

export async function acaoAtualizarProfissional(id: string, f: FormData) {
  const { negocioId } = await exigirAcesso();
  await atualizarProfissional(negocioId, id, {
    nome: texto(f, "nome"),
    apelido: opcional(f, "apelido"),
    telefone: soDigitos(texto(f, "telefone")) || null,
    cor: opcional(f, "cor"),
    comissao_servico_pct: texto(f, "comissao") ? inteiro(f, "comissao") : null,
    aceita_online: marcado(f, "aceita_online"),
    ordem: inteiro(f, "ordem"),
  });
  revalidatePath("/painel/equipe");
  revalidatePath("/painel/agenda");
  redirect("/painel/equipe");
}

// Nao existe apagar profissional: a comissao dele, as comandas e o historico
// iriam junto, e o fechamento do mes passado mudaria sozinho.
export async function acaoArquivarProfissional(id: string) {
  const { negocioId } = await exigirAcesso();
  await arquivarProfissional(negocioId, id);
  revalidatePath("/painel/equipe");
  revalidatePath("/painel/agenda");
  redirect("/painel/equipe");
}

// A semana inteira de uma vez. Editar faixa a faixa deixaria a jornada pela
// metade se a tela quebrasse no meio do caminho.
export async function acaoSalvarJornada(profissionalId: string, f: FormData) {
  const { negocioId } = await exigirAcesso();

  const faixas: { dia_semana: number; inicio: string; fim: string }[] = [];
  for (let dow = 0; dow <= 6; dow++) {
    if (!marcado(f, `abre_${dow}`)) continue;
    const manhaIni = texto(f, `manha_ini_${dow}`);
    const manhaFim = texto(f, `manha_fim_${dow}`);
    const tardeIni = texto(f, `tarde_ini_${dow}`);
    const tardeFim = texto(f, `tarde_fim_${dow}`);
    // Turno partido e o normal de quem fecha pro almoco: duas faixas no mesmo
    // dia. Quem nao fecha deixa a segunda em branco e vira uma faixa so.
    if (manhaIni && manhaFim && manhaFim > manhaIni) {
      faixas.push({ dia_semana: dow, inicio: manhaIni, fim: manhaFim });
    }
    if (tardeIni && tardeFim && tardeFim > tardeIni) {
      faixas.push({ dia_semana: dow, inicio: tardeIni, fim: tardeFim });
    }
  }

  await salvarJornada(negocioId, profissionalId, faixas);
  revalidatePath("/painel/equipe");
  revalidatePath("/painel/agenda");
  redirect(`/painel/equipe/${profissionalId}?aviso=Jornada salva.`);
}

export async function acaoCriarFolga(f: FormData) {
  const { negocioId } = await exigirAcesso();
  const data = texto(f, "data");
  if (!data) redirect("/painel/equipe?aviso=Escolha a data.");
  await criarExcecao(negocioId, {
    // Vazio = a barbearia inteira fecha. E como se marca feriado sem editar a
    // jornada de cada um.
    profissional_id: opcional(f, "profissional_id"),
    data,
    tipo: "fechado",
    motivo: opcional(f, "motivo"),
  });
  revalidatePath("/painel/equipe");
  revalidatePath("/painel/agenda");
  redirect("/painel/equipe?aviso=Folga marcada.");
}

// ---------------------------------------------------------------------------
//  SERVICOS
// ---------------------------------------------------------------------------
function lerServico(f: FormData) {
  return {
    nome: texto(f, "nome"),
    descricao: opcional(f, "descricao"),
    categoria: opcional(f, "categoria"),
    duracao_min: inteiro(f, "duracao_min", 30),
    // Tempo de limpeza da cadeira depois do servico. Sem ele a agenda promete
    // um encaixe que na pratica atrasa o dia inteiro.
    intervalo_pos_min: inteiro(f, "intervalo_pos_min", 0),
    preco_cent: paraCentavos(texto(f, "preco")),
    custo_cent: paraCentavos(texto(f, "custo")),
    retorno_dias: texto(f, "retorno_dias") ? inteiro(f, "retorno_dias") : null,
    online: marcado(f, "online"),
    ordem: inteiro(f, "ordem"),
  };
}

export async function acaoCriarServico(f: FormData) {
  const { negocioId } = await exigirAcesso();
  const s = lerServico(f);
  if (!s.nome || s.duracao_min <= 0) redirect("/painel/servicos?aviso=Nome e duração são obrigatórios.");
  await criarServico(negocioId, s);
  revalidatePath("/painel/servicos");
  revalidatePath("/painel/agenda");
  redirect("/painel/servicos");
}

export async function acaoAtualizarServico(id: string, f: FormData) {
  const { negocioId } = await exigirAcesso();
  const s = lerServico(f);
  if (!s.nome || s.duracao_min <= 0) redirect("/painel/servicos?aviso=Nome e duração são obrigatórios.");
  await atualizarServico(negocioId, id, s);
  revalidatePath("/painel/servicos");
  revalidatePath("/painel/agenda");
  redirect("/painel/servicos");
}

export async function acaoArquivarServico(id: string) {
  const { negocioId } = await exigirAcesso();
  await arquivarServico(negocioId, id);
  revalidatePath("/painel/servicos");
  revalidatePath("/painel/agenda");
  redirect("/painel/servicos");
}

// ---------------------------------------------------------------------------
//  CONFIGURACAO DA CASA
// ---------------------------------------------------------------------------
export async function acaoSalvarConfig(f: FormData) {
  const { negocioId } = await exigirAcesso();
  await salvarConfig(negocioId, {
    grade_min: inteiro(f, "grade_min", 15),
    antecedencia_min_horas: inteiro(f, "antecedencia_min_horas", 1),
    antecedencia_max_dias: inteiro(f, "antecedencia_max_dias", 60),
    cancelamento_horas: inteiro(f, "cancelamento_horas", 3),
    lembrete_horas_antes: inteiro(f, "lembrete_horas_antes", 24),
    pede_confirmacao: marcado(f, "pede_confirmacao"),
    fidelidade_ativa: marcado(f, "fidelidade_ativa"),
    comissao_servico_pct: inteiro(f, "comissao_servico_pct", 50),
    comissao_produto_pct: inteiro(f, "comissao_produto_pct", 10),
  });
  revalidatePath("/painel/servicos");
  redirect("/painel/servicos?aviso=Configuração salva.");
}
