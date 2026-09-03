import { NextResponse, type NextRequest } from "next/server";
import { getSession, hashPassword } from "@/lib/auth";
import { cifrar } from "@/lib/cofre";
import { query } from "@/lib/db";
import { negocioPermitido } from "@/lib/food-auth";
import {
  abrirCaixa, aprovarPedido, atenderChamado, caixaAberto, cmvDoDia, criarArea,
  criarDispositivo, criarImpressora, criarInsumo, definirFichaTecnica, fichaDoProduto,
  pagamentosDoDia,
  criarLoja, criarMesa, criarMesas, criarMembroEquipe, entradaEstoque, fecharCaixa,
  fecharSessao, getLoja, listAreas, listChamados, listDispositivos, listImpressoras,
  listEquipe, listInsumos, listMesas, listPedidos, lojaPrincipal, mapaMesas, marcarCartaoGravado,
  imprimirConta, montarCardapio, movimentarCaixa, movimentosDoCaixa,
  mudarStatusPedido, regravarMesa, reimprimir,
  registrarPagamento, resumoDoDia, resumoSessao, setEsgotado, atualizarLoja,
  upsertCategoria, upsertGrupoOpcao, upsertOpcao, upsertProduto, upsertVariacao, criarPedido,
} from "@/lib/food";
import {
  atualizarArea, atualizarDispositivo, atualizarEquipe, atualizarImpressora, atualizarMesa,
  duplicarProduto, esgotarCategoria, moverProduto, reajustarPrecos,
  despacharPedido, excluirArea, excluirBairro, excluirCategoria, excluirDispositivo,
  excluirEquipe, excluirGrupoOpcao, excluirImpressora, excluirMesa, excluirOpcao,
  excluirProduto, excluirVariacao, listBairros, listHorarios, lojaEstaAberta,
  pedidosDelivery, regravarDispositivo, reordenar, salvarHorarios, salvarMidia, upsertBairro,
} from "@/lib/food-edicao";
import {
  ErroKds, desfazerItem, historicoItem, marcar86, moverItem, moverPedido,
  resumoPorArea, revisaoKds, type Ator, type EstadoItem,
} from "@/lib/food-kds";
import { aplicarDesconto, definirTaxaServico, divisaoDaConta } from "@/lib/food-conta";
import { abrirPareamento, acessosDeAparelho, desparear } from "@/lib/food-dispositivo";
import { periodoPadrao, relatorioCompleto } from "@/lib/food-relatorios";
import { cancelarNota, emitirDaFila, painelFiscal } from "@/lib/food-fiscal";
import { resumoDeAvaliacoes } from "@/lib/food-vendas";
import { query as sql } from "@/lib/db";
import { limparAlergenicos } from "@/lib/food-alergenicos";
import { PAPEIS } from "@/lib/food-permissoes";
import { registrarFalha } from "@/lib/log";
import {
  ErroEntrada, booleano, dinheiro, listaUuid, numero, opcao, texto, textoOpcional, uuid,
} from "@/lib/food-validar";
import type { CanalPedido, MetodoPagamento, StatusPedido } from "@/lib/food-types";

// ============================================================================
// API do painel do restaurante. Toda chamada carrega `neg` (o negocio_id) e
// passa por negocioPermitido(): owner da plataforma ou o dono daquele negócio.
// ============================================================================

export const dynamic = "force-dynamic";

/** Quem esta mexendo: vai para a trilha de auditoria de cada transicao. */
async function atorDoPainel(): Promise<Ator> {
  const s = await getSession();
  return {
    tipo: "painel",
    id: s?.uid ?? null,
    nome: s?.email ?? "painel",
    origem: "painel do restaurante",
  };
}

function respostaErro(e: unknown, ctx: { neg?: string | null; acao?: string } = {}) {
  if (e instanceof ErroKds) {
    return NextResponse.json(
      { erro: e.codigo, mensagem: e.message, detalhe: e.detalhe },
      { status: e.codigo === "TRANSICAO_INVALIDA" ? 409 : 400 }
    );
  }
  if (e instanceof ErroEntrada) {
    return NextResponse.json(
      { erro: e.codigo, campo: e.campo, mensagem: e.message }, { status: 400 }
    );
  }
  // O erro cru do banco (nome de tabela, nome de constraint) fica no log e NAO
  // vai para a tela. Antes ia inteiro para o navegador.
  registrarFalha(e, { onde: "food.painel", acao: ctx.acao ?? null, negocio: ctx.neg ?? null });
  return NextResponse.json(
    { erro: "erro", mensagem: "Nao deu para completar. Tente de novo." }, { status: 400 }
  );
}

async function ctx(req: NextRequest, negParam?: string) {
  const neg = negParam ?? new URL(req.url).searchParams.get("neg") ?? "";
  const ok = neg ? await negocioPermitido(neg) : null;
  return ok;
}

// ---- leitura: tudo que a tela precisa em uma chamada só
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const neg = await ctx(req);
  if (!neg) return NextResponse.json({ erro: "sem_acesso" }, { status: 403 });

  const lojaId = url.searchParams.get("loja") || (await lojaPrincipal(neg))?.id;
  if (!lojaId) return NextResponse.json({ loja: null });
  const loja = await getLoja(neg, lojaId);
  if (!loja) return NextResponse.json({ erro: "loja" }, { status: 404 });

  const vista = url.searchParams.get("vista") ?? "salao";

  if (vista === "salao") {
    const [mesas, chamados, pedidos, dia, cozinha, rev, setup] = await Promise.all([
      mapaMesas(neg, lojaId),
      listChamados(neg, lojaId),
      listPedidos(neg, lojaId, { hoje: true, status: ["pendente", "aprovado", "em_producao", "pronto"] }),
      resumoDoDia(neg, lojaId),
      // o salao consome o MESMO estado do KDS: fila e atraso por praca
      resumoPorArea(neg, lojaId),
      revisaoKds(lojaId),
      // o que ainda falta para a casa abrir: alimenta o card de primeiros passos
      query<{
        produtos: number; mesas: number; cartoes: number;
        tablets: number; impressoras: number; equipe: number;
      }>(
        `SELECT (SELECT COUNT(*)::int FROM food_produtos WHERE loja_id = $1 AND ativo) AS produtos,
                (SELECT COUNT(*)::int FROM food_mesas WHERE loja_id = $1 AND ativa) AS mesas,
                (SELECT COUNT(*)::int FROM food_mesas WHERE loja_id = $1 AND cartao_gravado_em IS NOT NULL) AS cartoes,
                (SELECT COUNT(*)::int FROM food_dispositivos WHERE loja_id = $1 AND ativo) AS tablets,
                (SELECT COUNT(*)::int FROM food_impressoras WHERE loja_id = $1 AND ativa) AS impressoras,
                (SELECT COUNT(*)::int FROM food_equipe WHERE loja_id = $1 AND ativo) AS equipe`,
        [lojaId]
      ).then((r) => r.rows[0]),
    ]);
    return NextResponse.json({ loja, mesas, chamados, pedidos, dia, cozinha, rev, setup });
  }
  if (vista === "cardapio") {
    const [cardapio, areas] = await Promise.all([
      montarCardapio(lojaId, { admin: true }),
      listAreas(neg, lojaId),
    ]);
    return NextResponse.json({ loja, cardapio, areas });
  }
  if (vista === "mesas") {
    return NextResponse.json({ loja, mesas: await listMesas(neg, lojaId) });
  }
  if (vista === "pedidos") {
    const canal = (url.searchParams.get("canal") as CanalPedido) || undefined;
    return NextResponse.json({ loja, pedidos: await listPedidos(neg, lojaId, { hoje: true, canal }) });
  }
  if (vista === "sessao") {
    const sid = url.searchParams.get("sessao") ?? "";
    // a comanda tem que ser DESTA casa: sem esta conferencia, quem souber um
    // uuid de sessao le a conta de outro restaurante do hub
    const dona = (await query<{ id: string }>(
      "SELECT id FROM food_sessoes WHERE id = $1 AND negocio_id = $2 AND loja_id = $3",
      [sid, neg, lojaId]
    )).rows[0];
    if (!dona) return NextResponse.json({ erro: "sessao" }, { status: 404 });
    return NextResponse.json(await resumoSessao(sid));
  }
  if (vista === "divisao") {
    const sid = url.searchParams.get("sessao") ?? "";
    return NextResponse.json(await divisaoDaConta(neg, sid) ?? { erro: "sessao" });
  }
  if (vista === "avaliacoes") {
    return NextResponse.json({
      loja, ...(await resumoDeAvaliacoes({ query }, neg, lojaId)),
    });
  }
  if (vista === "fiscal") {
    return NextResponse.json({ loja, ...(await painelFiscal(neg, lojaId)) });
  }
  if (vista === "cupons") {
    const cupons = (await query(
      `SELECT * FROM food_cupons WHERE negocio_id = $1 AND loja_id = $2 ORDER BY criado_em DESC`,
      [neg, lojaId]
    )).rows;
    return NextResponse.json({ loja, cupons });
  }
  if (vista === "item") {
    // a linha do tempo de um item: quem mexeu, quando e de onde
    return NextResponse.json({
      historico: await historicoItem(neg, url.searchParams.get("item") ?? ""),
    });
  }
  if (vista === "delivery") {
    const [pedidos, bairros, equipe] = await Promise.all([
      pedidosDelivery(neg, lojaId), listBairros(neg, lojaId), listEquipe(neg, lojaId),
    ]);
    return NextResponse.json({ loja, pedidos, bairros, entregadores: equipe.filter((e) => e.papel === "entregador") });
  }
  if (vista === "config") {
    const [areas, impressoras, dispositivos, equipe] = await Promise.all([
      listAreas(neg, lojaId), listImpressoras(neg, lojaId),
      listDispositivos(neg, lojaId), listEquipe(neg, lojaId),
    ]);
    const [horarios, bairros, aberta, acessos] = await Promise.all([
      listHorarios(neg, lojaId), listBairros(neg, lojaId), lojaEstaAberta(neg, lojaId),
      acessosDeAparelho(neg, lojaId),
    ]);
    return NextResponse.json({
      loja, areas, impressoras, dispositivos, equipe, horarios, bairros, aberta, acessos,
    });
  }
  if (vista === "estoque") {
    const produtoId = url.searchParams.get("produto");
    const [insumos, cmv, ficha] = await Promise.all([
      listInsumos(neg, lojaId),
      cmvDoDia(neg, lojaId),
      produtoId ? fichaDoProduto(neg, produtoId) : Promise.resolve([]),
    ]);
    return NextResponse.json({ loja, insumos, cmv, ficha });
  }
  if (vista === "caixa") {
    const [caixa, pagamentos, dia, cardapio] = await Promise.all([
      caixaAberto(neg, lojaId),
      pagamentosDoDia(neg, lojaId),
      resumoDoDia(neg, lojaId),
      Promise.resolve(null),
    ]);
    void cardapio;
    const movimentos = caixa ? await movimentosDoCaixa(neg, caixa.id) : [];
    return NextResponse.json({ loja, caixa, pagamentos, dia, movimentos });
  }
  if (vista === "relatorio") {
    // O periodo vem no fuso da CASA. Sem isso, "hoje" as 21h de Xanxere ja e
    // amanha para o servidor e o relatorio da noite nasce partido em dois.
    const padrao = await periodoPadrao({ query: sql }, lojaId);
    const de = (url.searchParams.get("de") || padrao.de).slice(0, 10);
    const ate = (url.searchParams.get("ate") || url.searchParams.get("de") || padrao.ate).slice(0, 10);
    return NextResponse.json({
      loja,
      dia: await resumoDoDia(neg, lojaId, url.searchParams.get("dia") ?? undefined),
      relatorio: await relatorioCompleto({ query: sql }, neg, lojaId, { de, ate }),
    });
  }
  return NextResponse.json({ erro: "vista" }, { status: 400 });
}

// ---- escrita
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const neg = await ctx(req, typeof body.neg === "string" ? body.neg : undefined);
  if (!neg) return NextResponse.json({ erro: "sem_acesso" }, { status: 403 });
  const acao = String(body.acao ?? "");
  const lojaId = typeof body.loja === "string" ? body.loja : (await lojaPrincipal(neg))?.id ?? "";

  try {
    switch (acao) {
      // ---------- loja
      case "criar_loja":
        return NextResponse.json(await criarLoja(neg, {
          nome: String(body.nome), slug: String(body.slug),
          tipo: body.tipo as string, cidade: body.cidade as string, uf: body.uf as string,
        }));
      case "atualizar_loja": {
        const campos = { ...((body.campos ?? {}) as Record<string, unknown>) };
        // o endereço do cardápio é entregável da Endereço Digital: o dono não mexe
        if ("slug" in campos) {
          const s = await getSession();
          if (s?.papel !== "owner_plataforma") delete campos.slug;
          else if (typeof campos.slug === "string") {
            await query("UPDATE food_lojas SET slug = $3 WHERE id = $1 AND negocio_id = $2",
              [lojaId, neg, campos.slug.toLowerCase().replace(/[^a-z0-9-]/g, "")]);
            delete campos.slug;
          }
        }
        await atualizarLoja(neg, lojaId, campos);
        return NextResponse.json({ ok: true });
      }

      // ---------- mesas e cartões NFC
      case "criar_mesas": {
        const dede = numero(body.de, "primeira mesa", { min: 1, max: 999, padrao: 1 });
        const ate = numero(body.ate, "ultima mesa", { min: dede, max: dede + 200, padrao: 10 });
        return NextResponse.json({
          criadas: await criarMesas(neg, lojaId, dede, ate, textoOpcional(body.setor, 40) ?? undefined),
        });
      }
      case "criar_mesa":
        return NextResponse.json(await criarMesa(neg, lojaId, texto(body.numero, "numero da mesa", 20),
          numero(body.capacidade, "capacidade", { min: 1, max: 40, padrao: 4 }),
          textoOpcional(body.setor, 40) ?? undefined));
      case "regravar_mesa":
        return NextResponse.json({ token: await regravarMesa(neg, String(body.mesaId)) });
      case "cartao_gravado":
        await marcarCartaoGravado(neg, String(body.mesaId));
        return NextResponse.json({ ok: true });

      // ---------- cardápio
      case "categoria":
        return NextResponse.json(await upsertCategoria(neg, lojaId, body as never));
      case "produto":
        return NextResponse.json(await upsertProduto(neg, lojaId, body as never));
      case "variacao":
        return NextResponse.json(await upsertVariacao(neg, body as never));
      case "grupo":
        return NextResponse.json(await upsertGrupoOpcao(neg, body as never));
      case "opcao":
        return NextResponse.json(await upsertOpcao(neg, body as never));
      case "esgotado":
        // passa pelo marcar86: alem de esgotar, sobe o cardapio_rev, que e o
        // que apaga o item nos celulares que ja estao com o cardapio aberto
        return NextResponse.json(await marcar86({
          negocioId: neg, lojaId, produtoId: String(body.produtoId),
          esgotado: !!body.esgotado, ator: await atorDoPainel(),
        }));
      case "area":
        return NextResponse.json(await criarArea(neg, lojaId, String(body.nome), body.cor as string));

      // ---------- operação
      case "pedido_garcom":
        return NextResponse.json(await criarPedido({
          negocioId: neg, lojaId, canal: (body.canal as CanalPedido) ?? "mesa",
          sessaoId: (body.sessaoId as string) ?? null, mesaId: (body.mesaId as string) ?? null,
          garcomId: (body.garcomId as string) ?? null, itens: body.itens as never,
          obs: (body.obs as string) ?? null,
        }));
      case "aprovar":
        await aprovarPedido(neg, String(body.pedidoId), body.garcomId as string);
        return NextResponse.json({ ok: true });
      case "status_pedido":
        await mudarStatusPedido(neg, String(body.pedidoId), body.status as StatusPedido, body.motivo as string);
        return NextResponse.json({ ok: true });
      case "status_item":
        return NextResponse.json(await moverItem({
          negocioId: neg, itemId: String(body.itemId),
          para: String(body.para ?? body.status) as EstadoItem,
          ator: await atorDoPainel(),
          motivo: typeof body.motivo === "string" ? body.motivo.slice(0, 200) : null,
          chave: typeof body.chave === "string" ? body.chave.slice(0, 120) : null,
        }));
      case "desfazer_item":
        return NextResponse.json(await desfazerItem({
          negocioId: neg, itemId: String(body.itemId), ator: await atorDoPainel(),
        }));
      case "sai_tudo":
        return NextResponse.json(await moverPedido({
          negocioId: neg, pedidoId: String(body.pedidoId),
          para: String(body.para ?? "pronto") as EstadoItem,
          ator: await atorDoPainel(),
          motivo: typeof body.motivo === "string" ? body.motivo.slice(0, 200) : null,
        }));
      case "atender_chamado":
        await atenderChamado(neg, String(body.chamadoId));
        return NextResponse.json({ ok: true });
      // ---------- a conta que o garcom leva na mesa
      case "imprimir_conta": {
        const r = await imprimirConta(neg, uuid(body.sessaoId, "comanda"));
        return NextResponse.json({ ok: r.ok, impressoras: r.impressoras, texto: r.texto });
      }

      // ---------- gaveta: sangria e suprimento
      case "caixa_mov":
        return NextResponse.json(await movimentarCaixa(neg, {
          caixaId: uuid(body.caixaId, "caixa"),
          tipo: opcao(body.tipo, "tipo", ["sangria", "suprimento", "ajuste"] as const),
          valor: dinheiro(body.valor, "valor"),
          motivo: texto(body.motivo, "motivo", 200),
          por: textoOpcional(body.por, 80),
        }));

      case "reimprimir":
        await reimprimir(neg, String(body.pedidoId));
        return NextResponse.json({ ok: true });

      // ---------- conta e caixa
      case "pagamento": {
        const metodo = opcao(body.metodo, "forma de pagamento",
          ["dinheiro", "debito", "credito", "pix", "pix_app", "vale", "online", "cortesia"] as const);
        return NextResponse.json(await registrarPagamento(neg, {
          lojaId,
          sessaoId: (body.sessaoId as string) ?? null,
          pedidoId: (body.pedidoId as string) ?? null,
          metodo: metodo as MetodoPagamento,
          valor: dinheiro(body.valor, "valor"),
          gorjeta: dinheiro(body.gorjeta, "gorjeta", { padrao: 0 }),
          recebidoPor: (body.recebidoPor as string) ?? null,
          itens: Array.isArray(body.itens)
            ? listaUuid(body.itens, "itens", 100).map((id) => ({ id, valor: 0 }))
            : undefined,
        }));
      }
      // ---------- desconto: exige motivo e fica com autor
      case "desconto":
        return NextResponse.json(await aplicarDesconto({
          negocioId: neg, sessaoId: uuid(body.sessaoId, "comanda"),
          valor: dinheiro(body.valor, "desconto"),
          motivo: texto(body.motivo, "motivo", 200),
          ator: await atorDoPainel(),
        }));

      // ---------- taxa de servico: o cliente pode recusar (Lei 13.419/2017)
      case "servico":
        return NextResponse.json(await definirTaxaServico({
          negocioId: neg, sessaoId: uuid(body.sessaoId, "comanda"),
          recusar: booleano(body.recusar),
          ator: await atorDoPainel(),
        }));

      // ---------- alergenicos e marcas do produto (RDC 727/2022)
      case "alergenicos": {
        const produtoId = uuid(body.produtoId, "produto");
        await query(
          `UPDATE food_produtos
              SET alergenicos = $3, tracos = $4,
                  sem_gluten = $5, sem_lactose = $6, vegetariano = $7, vegano = $8
            WHERE id = $1 AND negocio_id = $2`,
          [produtoId, neg,
           limparAlergenicos(body.alergenicos), limparAlergenicos(body.tracos),
           booleano(body.sem_gluten), booleano(body.sem_lactose),
           booleano(body.vegetariano), booleano(body.vegano)]
        );
        await query("UPDATE food_lojas SET cardapio_rev = cardapio_rev + 1 WHERE id = $1", [lojaId]);
        return NextResponse.json({ ok: true });
      }

      // ---------- fiscal
      case "emitir_nota":
        return NextResponse.json(await emitirDaFila(uuid(body.id, "nota")));
      case "cancelar_nota":
        return NextResponse.json(await cancelarNota(neg, uuid(body.id, "nota"),
          texto(body.motivo, "justificativa", 300)));
      case "fiscal_credencial": {
        const tk = String(body.token ?? "").trim();
        await query(
          "UPDATE food_lojas SET fiscal_token_ref = $3 WHERE id = $1 AND negocio_id = $2",
          [lojaId, neg, tk ? cifrar(tk) : null]
        );
        return NextResponse.json({ ok: true });
      }

      // ---------- cupom
      case "cupom": {
        const cod = texto(body.codigo, "codigo", 30).toUpperCase().replace(/\s+/g, "");
        const tipo = opcao(body.tipo, "tipo", ["percentual", "valor", "frete_gratis"] as const, "percentual");
        if (body.id) {
          await query(
            `UPDATE food_cupons
                SET codigo = $3, tipo = $4, valor = $5, teto = $6, minimo = $7,
                    limite_total = $8, limite_pessoa = $9, termina_em = $10,
                    hora_inicio = $11, hora_fim = $12, dias_semana = $13, ativo = $14
              WHERE id = $1 AND negocio_id = $2`,
            [uuid(body.id, "cupom"), neg, cod, tipo,
             dinheiro(body.valor, "valor"), body.teto ? dinheiro(body.teto, "teto") : null,
             dinheiro(body.minimo, "minimo", { padrao: 0 }),
             body.limite_total ? numero(body.limite_total, "limite", { min: 1, max: 100000 }) : null,
             numero(body.limite_pessoa, "limite por pessoa", { min: 1, max: 100, padrao: 1 }),
             textoOpcional(body.termina_em, 40),
             textoOpcional(body.hora_inicio, 8), textoOpcional(body.hora_fim, 8),
             Array.isArray(body.dias_semana) ? body.dias_semana.map(Number) : null,
             booleano(body.ativo, true)]
          );
          return NextResponse.json({ ok: true });
        }
        return NextResponse.json((await query(
          `INSERT INTO food_cupons
             (negocio_id, loja_id, codigo, tipo, valor, teto, minimo, limite_total,
              limite_pessoa, termina_em, hora_inicio, hora_fim, dias_semana, primeira_compra)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
           ON CONFLICT (loja_id, codigo) DO UPDATE SET ativo = true
           RETURNING id, codigo`,
          [neg, lojaId, cod, tipo, dinheiro(body.valor, "valor"),
           body.teto ? dinheiro(body.teto, "teto") : null,
           dinheiro(body.minimo, "minimo", { padrao: 0 }),
           body.limite_total ? numero(body.limite_total, "limite", { min: 1, max: 100000 }) : null,
           numero(body.limite_pessoa, "limite por pessoa", { min: 1, max: 100, padrao: 1 }),
           textoOpcional(body.termina_em, 40),
           textoOpcional(body.hora_inicio, 8), textoOpcional(body.hora_fim, 8),
           Array.isArray(body.dias_semana) ? body.dias_semana.map(Number) : null,
           booleano(body.primeira_compra)]
        )).rows[0]);
      }
      case "excluir_cupom":
        await query("UPDATE food_cupons SET ativo = false WHERE id = $1 AND negocio_id = $2",
          [uuid(body.id, "cupom"), neg]);
        return NextResponse.json({ ok: true });

      // ---------- resposta do dono a uma avaliacao
      case "responder_avaliacao":
        await query(
          `UPDATE food_avaliacoes SET resposta = $3, respondida_em = now()
            WHERE id = $1 AND negocio_id = $2`,
          [uuid(body.id, "avaliacao"), neg, texto(body.resposta, "resposta", 500)]
        );
        return NextResponse.json({ ok: true });

      case "fechar_sessao":
        await fecharSessao(
          neg, String(body.sessaoId), String(body.por ?? "painel"),
          typeof body.motivo === "string" && body.motivo.trim()
            ? body.motivo.slice(0, 200)
            : "fechada pelo painel sem pagamento registrado"
        );
        return NextResponse.json({ ok: true });
      case "abrir_caixa":
        return NextResponse.json(await abrirCaixa(neg, lojaId,
          dinheiro(body.saldo, "saldo inicial", { padrao: 0 }), textoOpcional(body.por, 80) ?? undefined));
      case "fechar_caixa":
        await fecharCaixa(neg, uuid(body.caixaId, "caixa"),
          dinheiro(body.saldo, "saldo final", { padrao: 0 }));
        return NextResponse.json({ ok: true });

      // ---------- credencial do PSP (fica cifrada; nunca volta para a tela)
      case "psp_credencial": {
        const token = String(body.token ?? "").trim();
        await query(
          "UPDATE food_lojas SET pix_token_cifrado = $3 WHERE id = $1 AND negocio_id = $2",
          [lojaId, neg, token ? cifrar(token) : null]
        );
        return NextResponse.json({ ok: true });
      }

      // ---------- hardware
      case "criar_impressora":
        return NextResponse.json(await criarImpressora(neg, lojaId, {
          nome: String(body.nome), tipo: body.tipo as never,
          areaId: (body.areaId as string) ?? null, colunas: Number(body.colunas ?? 48),
        }));
      case "criar_dispositivo":
        return NextResponse.json(await criarDispositivo(neg, lojaId, {
          nome: String(body.nome), tipo: body.tipo as never, areaId: (body.areaId as string) ?? null,
        }));
      case "criar_equipe": {
        // o PIN do garcom vive hasheado, igual senha
        const pin = typeof body.pin === "string" && /^\d{4}$/.test(body.pin)
          ? await hashPassword(body.pin) : null;
        return NextResponse.json(await criarMembroEquipe(neg, lojaId,
          texto(body.nome, "nome", 80),
          opcao(body.papel, "papel", PAPEIS, "garcom"), pin));
      }

      // ---------- estoque
      case "criar_insumo":
        return NextResponse.json(await criarInsumo(neg, lojaId, {
          nome: String(body.nome), unidade: String(body.unidade ?? "un"),
          minimo: Number(body.minimo ?? 0), custo: Number(body.custo ?? 0),
        }));
      case "ficha_tecnica":
        await definirFichaTecnica(neg, String(body.produtoId), String(body.insumoId), Number(body.quantidade ?? 0));
        return NextResponse.json({ ok: true });
      // ---------- edição do cardápio
      case "excluir_produto":
        return NextResponse.json({ resultado: await excluirProduto(neg, String(body.produtoId)) });
      case "excluir_categoria":
        return NextResponse.json({ resultado: await excluirCategoria(neg, String(body.categoriaId)) });
      case "excluir_variacao":
        await excluirVariacao(neg, String(body.id));
        return NextResponse.json({ ok: true });
      case "excluir_grupo":
        await excluirGrupoOpcao(neg, String(body.id));
        return NextResponse.json({ ok: true });
      case "excluir_opcao":
        await excluirOpcao(neg, String(body.id));
        return NextResponse.json({ ok: true });
      case "reordenar":
        await reordenar(neg, body.tabela as never, (body.ids ?? []) as string[]);
        return NextResponse.json({ ok: true });
      case "foto": {
        const m = await salvarMidia(neg, lojaId, String(body.dataUrl ?? ""), String(body.origem ?? "produto"));
        if (body.produtoId) {
          await query(
            "UPDATE food_produtos SET imagem_url = $3, midia_id = $4 WHERE id = $1 AND negocio_id = $2",
            [String(body.produtoId), neg, m.url, m.id]
          );
        }
        if (body.origem === "logo") {
          await query(
            "UPDATE food_lojas SET logo_url = $3, logo_midia_id = $4 WHERE id = $1 AND negocio_id = $2",
            [lojaId, neg, m.url, m.id]
          );
        }
        return NextResponse.json(m);
      }

      case "duplicar_produto":
        return NextResponse.json(await duplicarProduto(neg, String(body.produtoId)));
      case "esgotar_categoria":
        return NextResponse.json({
          afetados: await esgotarCategoria(neg, String(body.categoriaId), !!body.esgotado),
        });
      case "reajustar_precos":
        return NextResponse.json({
          afetados: await reajustarPrecos(neg, lojaId, Number(body.percentual),
            (body.categoriaId as string) ?? null),
        });
      case "mover_produto":
        await moverProduto(neg, String(body.produtoId), String(body.categoriaId));
        return NextResponse.json({ ok: true });

      // ---------- edição de mesas
      case "atualizar_mesa":
        await atualizarMesa(neg, String(body.mesaId), (body.campos ?? {}) as never);
        return NextResponse.json({ ok: true });
      case "excluir_mesa":
        return NextResponse.json({ resultado: await excluirMesa(neg, String(body.mesaId)) });

      // ---------- edição de áreas, impressoras, tablets e equipe
      case "atualizar_area":
        await atualizarArea(neg, String(body.id), (body.campos ?? {}) as never);
        return NextResponse.json({ ok: true });
      case "excluir_area":
        await excluirArea(neg, String(body.id));
        return NextResponse.json({ ok: true });
      case "atualizar_impressora":
        await atualizarImpressora(neg, String(body.id), (body.campos ?? {}) as never);
        return NextResponse.json({ ok: true });
      case "excluir_impressora":
        await excluirImpressora(neg, String(body.id));
        return NextResponse.json({ ok: true });
      case "atualizar_dispositivo":
        await atualizarDispositivo(neg, String(body.id), (body.campos ?? {}) as never);
        return NextResponse.json({ ok: true });
      case "excluir_dispositivo":
        await excluirDispositivo(neg, String(body.id));
        return NextResponse.json({ ok: true });
      // ---------- pareamento do tablet
      case "parear_dispositivo":
        return NextResponse.json(await abrirPareamento(neg, uuid(body.id, "aparelho"),
          numero(body.horas, "horas", { min: 1, max: 168, padrao: 48 })));
      case "desparear_dispositivo":
        await desparear(neg, uuid(body.id, "aparelho"));
        return NextResponse.json({ ok: true });

      case "regravar_dispositivo":
        return NextResponse.json({ token: await regravarDispositivo(neg, String(body.id)) });
      case "atualizar_equipe": {
        const campos = (body.campos ?? {}) as { pin?: string } & Record<string, unknown>;
        const pinHash = typeof campos.pin === "string" && /^[0-9]{4}$/.test(campos.pin)
          ? await hashPassword(campos.pin) : null;
        await atualizarEquipe(neg, String(body.id), {
          nome: campos.nome as string | undefined,
          papel: campos.papel as string | undefined,
          ativo: campos.ativo as boolean | undefined,
          pinHash,
        });
        return NextResponse.json({ ok: true });
      }
      case "excluir_equipe":
        await excluirEquipe(neg, String(body.id));
        return NextResponse.json({ ok: true });

      // ---------- horário e delivery
      case "horarios":
        await salvarHorarios(neg, lojaId, (body.faixas ?? []) as never);
        return NextResponse.json({ ok: true });
      case "bairro":
        return NextResponse.json(await upsertBairro(neg, lojaId, body as never));
      case "excluir_bairro":
        await excluirBairro(neg, String(body.id));
        return NextResponse.json({ ok: true });
      case "despachar":
        await despacharPedido(neg, String(body.pedidoId), (body.entregadorId as string) ?? null);
        return NextResponse.json({ ok: true });

      case "entrada_estoque":
        await entradaEstoque(neg, uuid(body.insumoId, "insumo"),
          numero(body.quantidade, "quantidade", { min: 0.0001, max: 1000000 }),
          dinheiro(body.custo, "custo", { padrao: 0 }),
          textoOpcional(body.obs, 200) ?? undefined);
        return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ erro: "acao" }, { status: 400 });
  } catch (e) {
    return respostaErro(e, { neg, acao });
  }
}
