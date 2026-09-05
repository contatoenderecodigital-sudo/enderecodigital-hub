"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getNegocio, getHub } from "@/lib/data";
import { modulosEfetivos } from "@/lib/types";
import { activeNegocioId } from "@/lib/tenant";
import { paraCentavos } from "@/lib/agenda";
import {
  arquivarProduto, atualizarProduto, cancelarComandaAvulsa, criarProduto,
  movimentarEstoque, paraQuantidade, venderProdutosAvulso,
  type CategoriaProduto, type EntradaProduto, type FormaPagamento,
  type OperacaoEstoque,
} from "@/lib/agenda-produtos";

async function exigirAcesso() {
  const sessao = await getSession();
  if (!sessao) redirect("/login");
  const negocioId = activeNegocioId(sessao);
  if (!negocioId) redirect("/login");
  const negocio = await getNegocio(negocioId);
  if (!negocio) redirect("/login");
  const hub = await getHub(negocio.hub_id);
  if (!hub || !modulosEfetivos(negocio, hub).agenda) redirect("/painel");
  return { negocioId, usuarioId: sessao.uid };
}
const texto = (dados: FormData, chave: string) => String(dados.get(chave) ?? "").trim();
const opcional = (dados: FormData, chave: string) => texto(dados, chave) || null;
const marcado = (dados: FormData, chave: string) => {
  const valor = dados.get(chave);
  return valor === "on" || valor === "true";
};

function inteiro(dados: FormData, chave: string, padrao = 0) {
  const numero = Number(texto(dados, chave).replace(/[^0-9-]/g, ""));
  return Number.isFinite(numero) ? Math.trunc(numero) : padrao;
}

function irPara(caminho: string, aviso: string): never {
  const params = new URLSearchParams({ aviso });
  redirect(`${caminho}?${params.toString()}`);
}

function lerProduto(dados: FormData): EntradaProduto {
  return {
    nome: texto(dados, "nome"),
    sku: opcional(dados, "sku"),
    categoria: opcional(dados, "categoria") as CategoriaProduto | null,
    marca: opcional(dados, "marca"),
    preco_cent: paraCentavos(texto(dados, "preco")),
    custo_cent: paraCentavos(texto(dados, "custo")),
    estoque_minimo: paraQuantidade(texto(dados, "estoque_minimo")),
    validade: opcional(dados, "validade"),
    revenda: marcado(dados, "revenda"),
  };
}

export async function acaoCriarProduto(dados: FormData) {
  const { negocioId, usuarioId } = await exigirAcesso();
  try {
    await criarProduto(negocioId, usuarioId, lerProduto(dados), paraQuantidade(texto(dados, "estoque_inicial")));
  } catch (erro) {
    irPara("/painel/produtos", erro instanceof Error ? erro.message : "Nao foi possivel cadastrar o produto.");
  }
  revalidatePath("/painel/produtos");
  revalidatePath("/painel/vendas");
  irPara("/painel/produtos", "Produto cadastrado.");
}

export async function acaoAtualizarProduto(produtoId: string, dados: FormData) {
  const { negocioId } = await exigirAcesso();
  try {
    await atualizarProduto(negocioId, produtoId, lerProduto(dados));
  } catch (erro) {
    irPara("/painel/produtos", erro instanceof Error ? erro.message : "Nao foi possivel salvar o produto.");
  }
  revalidatePath("/painel/produtos");
  revalidatePath("/painel/vendas");
  irPara("/painel/produtos", "Produto atualizado.");
}

export async function acaoArquivarProduto(produtoId: string) {
  const { negocioId } = await exigirAcesso();
  try {
    await arquivarProduto(negocioId, produtoId);
  } catch (erro) {
    irPara("/painel/produtos", erro instanceof Error ? erro.message : "Nao foi possivel arquivar o produto.");
  }
  revalidatePath("/painel/produtos");
  revalidatePath("/painel/vendas");
  irPara("/painel/produtos", "Produto arquivado. O historico foi preservado.");
}

export async function acaoMovimentarEstoque(produtoId: string, dados: FormData) {
  const { negocioId, usuarioId } = await exigirAcesso();
  try {
    await movimentarEstoque(
      negocioId, usuarioId, produtoId,
      texto(dados, "operacao") as OperacaoEstoque,
      paraQuantidade(texto(dados, "quantidade")), opcional(dados, "motivo"),
    );
  } catch (erro) {
    irPara("/painel/produtos", erro instanceof Error ? erro.message : "Nao foi possivel lancar o movimento.");
  }
  revalidatePath("/painel/produtos");
  revalidatePath("/painel/vendas");
  irPara("/painel/produtos", "Movimento registrado no historico.");
}

export async function acaoVenderProdutos(dados: FormData) {
  const { negocioId, usuarioId } = await exigirAcesso();
  const ids = dados.getAll("produto_id").map(String);
  const quantidades = dados.getAll("quantidade").map((valor) => paraQuantidade(String(valor)));
  const itens = ids
    .map((produto_id, indice) => ({ produto_id, quantidade: quantidades[indice] ?? 0 }))
    .filter((item) => item.quantidade > 0);
  try {
    await venderProdutosAvulso(negocioId, usuarioId, {
      itens,
      forma_pagamento: texto(dados, "forma_pagamento") as FormaPagamento,
      desconto_cent: paraCentavos(texto(dados, "desconto")),
      taxa_cent: paraCentavos(texto(dados, "taxa")),
      parcelas: inteiro(dados, "parcelas", 1),
      cliente_id: opcional(dados, "cliente_id"),
      profissional_id: opcional(dados, "profissional_id"),
      filial_id: opcional(dados, "filial_id"),
      observacao: opcional(dados, "observacao"),
    });
  } catch (erro) {
    irPara("/painel/vendas", erro instanceof Error ? erro.message : "Nao foi possivel fechar a venda.");
  }
  revalidatePath("/painel/vendas");
  revalidatePath("/painel/produtos");
  revalidatePath("/painel");
  revalidatePath("/painel/agenda/raio-x");
  irPara("/painel/vendas", "Venda fechada e estoque baixado.");
}

export async function acaoCancelarVenda(comandaId: string, dados: FormData) {
  const { negocioId, usuarioId } = await exigirAcesso();
  if (!marcado(dados, "confirmar_cancelamento")) {
    irPara("/painel/vendas", "Confirme o cancelamento antes de continuar.");
  }
  try {
    await cancelarComandaAvulsa(negocioId, usuarioId, comandaId, opcional(dados, "motivo"));
  } catch (erro) {
    irPara("/painel/vendas", erro instanceof Error ? erro.message : "Nao foi possivel cancelar a venda.");
  }
  revalidatePath("/painel/vendas");
  revalidatePath("/painel/produtos");
  revalidatePath("/painel");
  revalidatePath("/painel/agenda/raio-x");
  irPara("/painel/vendas", "Venda cancelada. O estoque foi estornado sem apagar o historico.");
}
