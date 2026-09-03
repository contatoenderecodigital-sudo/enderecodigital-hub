import { NextResponse, type NextRequest } from "next/server";
import {
  criarChamado, criarPedido, entrarNaMesa, getLojaBySlug, getMesaByToken,
  montarCardapio, pedirConta, registrarPagamento, resumoSessao, sessaoAtivaDaMesa,
} from "@/lib/food";
import { criarCobrancaPix } from "@/lib/food-pix";
import { listBairros, lojaEstaAberta } from "@/lib/food-edicao";
import { liberarEsgotadosVencidos } from "@/lib/food-kds";
import { query } from "@/lib/db";
import { ErroKds } from "@/lib/food-kds-sql";
import { ErroVenda } from "@/lib/food-vendas";
import { definirTaxaServico, divisaoDaConta, valorDosItens } from "@/lib/food-conta";
import { listaUuid } from "@/lib/food-validar";
import {
  conferirCupom, identificarNaMesa, marcarFoiProGoogle, registrarAvaliacao,
  registrarUsoDeCupom,
} from "@/lib/food-vendas";
import { query as sql } from "@/lib/db";
import { registrarFalha } from "@/lib/log";
import { cpfValido } from "@/lib/food-fiscal-nota";
import { COOKIE_MESA, assinarPasse, gravarPasse, lerPasse } from "@/lib/food-mesa-passe";
import { excedeuLimite } from "@/lib/groow/ratelimit";
import type { ItemEntrada } from "@/lib/food-types";

// ============================================================================
// API pública do cliente final (o celular na mesa). SEM sessão de usuário.
//
// A autorização tem DOIS degraus:
//   1. o TOKEN DA MESA (o que está gravado no cartão NFC) serve para ENTRAR;
//   2. entrar devolve um PASSE em cookie httpOnly, amarrado à mesa, à comanda
//      daquele momento e ao celular. Pedir, chamar e pagar exigem o passe.
//
// Isso é o que impede alguém de guardar a URL da mesa 7 e, de casa, às três da
// manhã, abrir uma comanda e mandar quarenta itens para a impressora: a comanda
// só nasce com a casa aberta, e o passe morre junto com a conta.
//
// Nada aqui aceita id de loja ou de negócio vindo do navegador.
// ============================================================================

export const dynamic = "force-dynamic";

function ip(req: NextRequest): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? req.headers.get("x-real-ip")
      ?? null;
}

/** true quando estourou. Janela em segundos. */
function passou(chave: string, max: number, janelaSeg: number): boolean {
  return excedeuLimite(`food:${chave}`, { max, janelaSeg });
}

function demais(segundos: number) {
  return NextResponse.json(
    { erro: "muitas_tentativas", mensagem: "Calma aí. Tente de novo em instantes." },
    { status: 429, headers: { "Retry-After": String(segundos) } }
  );
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ erro: "json" }, { status: 400 }); }

  const acao = String(body.acao ?? "");
  const token = typeof body.token === "string" ? body.token : "";
  const deviceId = typeof body.deviceId === "string" ? body.deviceId.slice(0, 64) : "";

  // Teto geral por IP. Uma mesa cheia de gente pedindo continua passando
  // folgado; um laço de shell, não.
  const de = ip(req) ?? "sem-ip";
  if (passou(`ip:${de}`, 240, 60)) return demais(60);

  // --- cardápio de vitrine (sem mesa): /c/<slug>
  if (acao === "cardapio_slug") {
    const loja = await getLojaBySlug(String(body.slug ?? ""));
    if (!loja) return NextResponse.json({ erro: "loja" }, { status: 404 });
    await liberarEsgotadosVencidos(loja.id);
    const cardapio = await montarCardapio(loja.id, { canal: "mesa" });
    return NextResponse.json({ loja: publicoLoja(loja), cardapio, cardapio_rev: await rev(loja.id) });
  }

  // --- cardápio de delivery: /c/<slug>/pedir
  if (acao === "cardapio_delivery") {
    const loja = await getLojaBySlug(String(body.slug ?? ""));
    if (!loja) return NextResponse.json({ erro: "loja" }, { status: 404 });
    await liberarEsgotadosVencidos(loja.id);
    const [cardapio, bairros, aberta] = await Promise.all([
      montarCardapio(loja.id, { canal: "delivery" }),
      listBairros(loja.negocio_id, loja.id),
      lojaEstaAberta(loja.negocio_id, loja.id),
    ]);
    return NextResponse.json({
      loja: publicoLoja(loja),
      cardapio,
      bairros: bairros.filter((b) => b.ativo),
      aberta,
      aceita_delivery: loja.aceita_delivery,
      aceita_retirada: loja.aceita_retirada,
      pedido_minimo: loja.entrega_pedido_minimo,
    });
  }

  // --- pedido de delivery ou retirada (sem mesa, sem login)
  if (acao === "pedido_delivery") {
    if (passou(`delivery:${de}`, 6, 600)) return demais(600);
    const loja = await getLojaBySlug(String(body.slug ?? ""));
    if (!loja) return NextResponse.json({ erro: "loja" }, { status: 404 });
    if (!(await lojaEstaAberta(loja.negocio_id, loja.id))) {
      return NextResponse.json({ erro: "fechada" }, { status: 409 });
    }
    const itens = Array.isArray(body.itens) ? (body.itens as ItemEntrada[]) : [];
    if (!itens.length) return NextResponse.json({ erro: "vazio" }, { status: 400 });

    const nome = String(body.nome ?? "").slice(0, 80);
    const telefone = String(body.telefone ?? "").replace(/\D/g, "").slice(0, 15);
    if (!nome || telefone.length < 10) return NextResponse.json({ erro: "contato" }, { status: 400 });

    const retirada = body.retirada === true;
    if (!retirada && !loja.aceita_delivery) return NextResponse.json({ erro: "sem_entrega" }, { status: 403 });
    if (retirada && !loja.aceita_retirada) return NextResponse.json({ erro: "sem_retirada" }, { status: 403 });

    // taxa vem do bairro cadastrado, nunca do navegador
    let taxa = 0;
    let bairroId: string | null = null;
    if (!retirada) {
      const bairros = await listBairros(loja.negocio_id, loja.id);
      const b = bairros.find((x) => x.id === body.bairroId && x.ativo);
      if (!b) return NextResponse.json({ erro: "bairro" }, { status: 400 });
      taxa = Number(b.taxa);
      bairroId = b.id;
    }

    // o cliente vira cadastro do CRM (e é quem recebe o aviso no WhatsApp)
    const cliente = (await query<{ id: string }>(
      `INSERT INTO food_clientes (negocio_id, nome, telefone, optin_whats)
       VALUES ($1,$2,$3,true)
       ON CONFLICT (negocio_id, telefone)
       DO UPDATE SET nome = COALESCE(EXCLUDED.nome, food_clientes.nome),
                     ultimo_pedido = now(),
                     pedidos_qtd = food_clientes.pedidos_qtd + 1
       RETURNING id`,
      [loja.negocio_id, nome, telefone]
    )).rows[0];

    try {
      const pedido = await criarPedido({
        negocioId: loja.negocio_id,
        lojaId: loja.id,
        canal: "delivery",
        clienteId: cliente?.id ?? null,
        itens,
        obs: typeof body.obs === "string" ? body.obs.slice(0, 300) : null,
        deviceId: typeof body.deviceId === "string" ? body.deviceId.slice(0, 64) : null,
        ip: ip(req),
        taxaEntrega: taxa,
        chave: typeof body.chave === "string" ? body.chave.slice(0, 120) : null,
        entrega: retirada
          ? { tipo: "retirada" }
          : {
              tipo: "entrega",
              rua: String(body.rua ?? "").slice(0, 120),
              numero: String(body.numero ?? "").slice(0, 20),
              referencia: String(body.referencia ?? "").slice(0, 120),
              pagamento: String(body.pagamento ?? "").slice(0, 30),
              troco: String(body.troco ?? "").slice(0, 20),
            },
      });
      if (bairroId) {
        await query("UPDATE food_pedidos SET bairro_id = $2 WHERE id = $1", [pedido.id, bairroId]);
      }
      return NextResponse.json({ ok: true, numero: pedido.numero_dia, total: pedido.total });
    } catch (e) {
      return NextResponse.json({ erro: e instanceof Error ? e.message : "erro" }, { status: 400 });
    }
  }

  if (!token) return NextResponse.json({ erro: "token" }, { status: 400 });
  if (passou(`mesa:${token}`, 120, 60)) return demais(60);

  const alvo = await getMesaByToken(token);
  if (!alvo) return NextResponse.json({ erro: "mesa" }, { status: 404 });
  const { mesa, loja } = alvo;

  // ---- o passe: quem já entrou nesta mesa, nesta comanda, neste celular
  const passe = await lerPasse(req.cookies.get(COOKIE_MESA)?.value);
  const sessaoViva = await sessaoAtivaDaMesa(mesa.id);
  const passeVale = !!passe && passe.m === mesa.id && !!sessaoViva && passe.s === sessaoViva.id;

  /** Para tudo que não é "entrar": sem passe válido, não passa. */
  function semPasse() {
    if (passe && sessaoViva && passe.s !== sessaoViva.id) {
      // a conta daquela comanda foi fechada e a mesa recomeçou
      return NextResponse.json(
        { erro: "sessao_encerrada", mensagem: "Esta conta foi fechada. Encoste o celular no cartão de novo." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { erro: "sem_passe", mensagem: "Encoste o celular no cartão da mesa para começar." },
      { status: 401 }
    );
  }

  switch (acao) {
    // ---- encostou o celular no cartão: abre ou entra na comanda da mesa
    case "entrar": {
      if (!loja.aceita_mesa) return NextResponse.json({ erro: "mesa_desligada" }, { status: 403 });
      if (!deviceId) return NextResponse.json({ erro: "device" }, { status: 400 });
      if (passou(`entrar:${mesa.id}:${de}`, 20, 300)) return demais(300);

      const aberta = await lojaEstaAberta(loja.negocio_id, loja.id);
      const apelido = typeof body.apelido === "string" ? body.apelido.slice(0, 40) : null;

      let entrada;
      try {
        // comanda NOVA só com a casa aberta. Entrar numa que já existe, sempre.
        entrada = await entrarNaMesa(mesa, deviceId, apelido, { permitirAbrir: aberta });
      } catch (e) {
        if (e instanceof ErroKds && e.codigo === "CASA_FECHADA") {
          await liberarEsgotadosVencidos(loja.id);
          return NextResponse.json({
            erro: "fechada",
            mensagem: "A casa está fechada agora. O cardápio continua aqui.",
            loja: publicoLoja(loja),
            mesa: { id: mesa.id, numero: mesa.numero, apelido: mesa.apelido },
            cardapio: await montarCardapio(loja.id, { canal: "mesa" }),
            cardapio_rev: await rev(loja.id),
          }, { status: 409 });
        }
        throw e;
      }

      const { sessao, membroId, novaSessao } = entrada;
      await liberarEsgotadosVencidos(loja.id);
      const cardapio = await montarCardapio(loja.id, { canal: "mesa" });
      const resumo = await resumoSessao(sessao.id);

      const res = NextResponse.json({
        loja: publicoLoja(loja),
        mesa: { id: mesa.id, numero: mesa.numero, apelido: mesa.apelido },
        sessao, membroId, novaSessao, cardapio, resumo,
        cardapio_rev: await rev(loja.id),
        aberta,
      });
      gravarPasse(res, await assinarPasse({ s: sessao.id, m: mesa.id, b: membroId, d: deviceId }));
      return res;
    }

    // ---- a comanda da mesa (todo mundo da mesa vê a mesma)
    case "resumo": {
      if (!passeVale) return semPasse();
      const cardapioRev = await rev(loja.id);
      return NextResponse.json({ ...(await resumoSessao(sessaoViva!.id)), cardapio_rev: cardapioRev });
    }

    // ---- cupom: quem diz quanto abate e o servidor
    case "cupom": {
      if (!passeVale) return semPasse();
      if (passou(`cupom:${mesa.id}`, 12, 300)) return demais(300);
      try {
        const cp = await conferirCupom({ query: sql }, {
          negocioId: mesa.negocio_id, lojaId: mesa.loja_id,
          codigo: String(body.codigo ?? ""),
          subtotal: Number(sessaoViva!.subtotal),
          canal: "mesa",
        });
        await sql(
          `UPDATE food_sessoes SET cupom_id = $2, desconto = $3,
                  desconto_motivo = $4, desconto_em = now(), desconto_por = 'cupom'
            WHERE id = $1 AND negocio_id = $5`,
          [sessaoViva!.id, cp.id, cp.desconto.toFixed(2), `cupom ${cp.codigo}`, mesa.negocio_id]
        );
        await registrarUsoDeCupom({ query: sql }, {
          negocioId: mesa.negocio_id, cupomId: cp.id, desconto: cp.desconto,
          sessaoId: sessaoViva!.id,
        });
        return NextResponse.json({ ok: true, ...cp });
      } catch (e) {
        if (e instanceof ErroKds || e instanceof ErroVenda) {
          return NextResponse.json({ erro: e.codigo, mensagem: e.message }, { status: 409 });
        }
        registrarFalha(e, { onde: "food.publico", acao: "cupom", loja: loja.id });
        return NextResponse.json({ erro: "erro" }, { status: 400 });
      }
    }

    // ---- avaliacao, na hora que a conta fecha
    case "avaliar": {
      if (!passeVale) return semPasse();
      if (passou(`avaliar:${mesa.id}`, 8, 600)) return demais(600);
      try {
        const r = await registrarAvaliacao({ query: sql }, {
          negocioId: mesa.negocio_id, lojaId: mesa.loja_id,
          sessaoId: sessaoViva!.id, mesaId: mesa.id,
          nota: Number(body.nota),
          marcadores: Array.isArray(body.marcadores) ? body.marcadores.map(String) : null,
          comentario: typeof body.comentario === "string" ? body.comentario.slice(0, 500) : null,
        });
        return NextResponse.json(r);
      } catch (e) {
        if (e instanceof ErroKds || e instanceof ErroVenda) {
          return NextResponse.json({ erro: e.codigo, mensagem: e.message }, { status: 400 });
        }
        registrarFalha(e, { onde: "food.publico", acao: "avaliar", loja: loja.id });
        return NextResponse.json({ erro: "erro" }, { status: 400 });
      }
    }
    case "foi_pro_google": {
      if (!passeVale) return semPasse();
      await marcarFoiProGoogle({ query: sql }, mesa.negocio_id, sessaoViva!.id);
      return NextResponse.json({ ok: true });
    }

    // ---- CPF na nota, que o cliente pede na hora de fechar
    case "cpf_na_nota": {
      if (!passeVale) return semPasse();
      if (passou(`cpf:${mesa.id}`, 10, 600)) return demais(600);
      const cpf = String(body.cpf ?? "").replace(/\D/g, "").slice(0, 11);
      if (cpf && !cpfValido(cpf)) {
        return NextResponse.json(
          { erro: "cpf", mensagem: "Esse CPF não confere. Confira os números." },
          { status: 400 }
        );
      }
      await sql(
        "UPDATE food_sessoes SET cpf_nota = $2 WHERE id = $1 AND negocio_id = $3",
        [sessaoViva!.id, cpf || null, mesa.negocio_id]
      );
      return NextResponse.json({ ok: true, cpf: cpf || null });
    }

    // ---- o cliente se identifica pelo telefone (fidelidade e historico)
    case "sou_eu": {
      if (!passeVale) return semPasse();
      if (passou(`soueu:${mesa.id}`, 10, 600)) return demais(600);
      try {
        return NextResponse.json(await identificarNaMesa({ query: sql }, {
          negocioId: mesa.negocio_id, sessaoId: sessaoViva!.id,
          telefone: String(body.telefone ?? ""),
          nome: typeof body.nome === "string" ? body.nome.slice(0, 80) : null,
        }));
      } catch (e) {
        if (e instanceof ErroKds || e instanceof ErroVenda) {
          return NextResponse.json({ erro: e.codigo, mensagem: e.message }, { status: 400 });
        }
        registrarFalha(e, { onde: "food.publico", acao: "sou_eu", loja: loja.id });
        return NextResponse.json({ erro: "erro" }, { status: 400 });
      }
    }

    // ---- a conta dividida: igual, por pessoa e por item
    case "divisao": {
      if (!passeVale) return semPasse();
      return NextResponse.json(await divisaoDaConta(mesa.negocio_id, sessaoViva!.id));
    }

    // ---- a taxa de serviço é voluntária (Lei 13.419/2017)
    case "servico": {
      if (!passeVale) return semPasse();
      if (passou(`servico:${mesa.id}`, 10, 300)) return demais(300);
      try {
        return NextResponse.json(await definirTaxaServico({
          negocioId: mesa.negocio_id, sessaoId: sessaoViva!.id,
          recusar: body.recusar === true,
          ator: { tipo: "cliente", nome: "mesa", origem: "celular do cliente" },
        }));
      } catch (e) {
        if (e instanceof ErroKds || e instanceof ErroVenda) {
          return NextResponse.json({ erro: e.codigo, mensagem: e.message }, { status: 409 });
        }
        registrarFalha(e, { onde: "food.publico", acao: "servico", loja: loja.id });
        return NextResponse.json({ erro: "erro" }, { status: 400 });
      }
    }

    // ---- só o cardápio, para quando o 86 mudou alguma coisa
    case "cardapio": {
      await liberarEsgotadosVencidos(loja.id);
      return NextResponse.json({
        cardapio: await montarCardapio(loja.id, { canal: "mesa" }),
        cardapio_rev: await rev(loja.id),
      });
    }

    // ---- enviar pedido
    case "pedir": {
      if (!passeVale) return semPasse();
      if (sessaoViva!.status !== "aberta") {
        return NextResponse.json({ erro: "conta_fechada" }, { status: 409 });
      }
      // um celular manda no máximo 12 pedidos em 5 minutos, e a mesa 40 na hora
      if (passou(`pedir:dev:${passe!.d}`, 12, 300)) return demais(300);
      if (passou(`pedir:mesa:${mesa.id}`, 40, 3600)) return demais(3600);

      const itens = Array.isArray(body.itens) ? (body.itens as ItemEntrada[]) : [];
      if (!itens.length) return NextResponse.json({ erro: "vazio" }, { status: 400 });
      if (itens.length > 40) return NextResponse.json({ erro: "muitos_itens" }, { status: 400 });

      try {
        const pedido = await criarPedido({
          negocioId: mesa.negocio_id,
          lojaId: mesa.loja_id,
          canal: "mesa",
          sessaoId: sessaoViva!.id,
          mesaId: mesa.id,
          // quem pediu vem do PASSE, não do corpo: assim ninguém lança item na
          // conta de outra pessoa da mesa
          membroId: passe!.b,
          itens,
          obs: typeof body.obs === "string" ? body.obs.slice(0, 300) : null,
          deviceId: passe!.d,
          ip: ip(req),
          chave: typeof body.chave === "string" ? body.chave.slice(0, 120) : null,
        });
        return NextResponse.json({ ok: true, pedido, aguardando_garcom: pedido.status === "pendente" });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "erro";
        const status = msg === "LIMITE_SESSAO" ? 409 : 400;
        return NextResponse.json({ erro: msg }, { status });
      }
    }

    // ---- chamar garçom / pedir a conta
    case "chamar": {
      if (!passeVale) return semPasse();
      if (passou(`chamar:${mesa.id}`, 6, 300)) return demais(300);
      const tipo = body.tipo === "conta" ? "conta" : body.tipo === "ajuda" ? "ajuda" : "garcom";
      await criarChamado(mesa.negocio_id, mesa.loja_id, mesa.id, sessaoViva!.id, tipo,
        typeof body.obs === "string" ? body.obs.slice(0, 200) : undefined);
      if (tipo === "conta") await pedirConta(mesa.negocio_id, sessaoViva!.id);
      return NextResponse.json({ ok: true });
    }

    // ---- registrar intenção de pagar pelo celular (Pix cai por webhook)
    case "pagar": {
      if (!passeVale) return semPasse();
      if (!loja.pagar_no_app) return NextResponse.json({ erro: "pagamento_desligado" }, { status: 403 });
      if (passou(`pagar:${mesa.id}`, 12, 600)) return demais(600);

      // Dividindo por item: o cliente diz QUAIS itens está pagando e o valor
      // sai do banco. Nada de aceitar o total que o navegador calculou.
      let itensPagos: { id: string; valor: number }[] = [];
      let valor = Number(body.valor);
      if (Array.isArray(body.itens) && body.itens.length) {
        try {
          const ids = listaUuid(body.itens, "itens", 100);
          const r = await valorDosItens(sessaoViva!.id, ids);
          valor = r.valor;
          itensPagos = r.itens.map((id) => ({ id, valor: 0 }));
        } catch (e) {
          const msg = e instanceof ErroKds ? e.message : "Item inválido";
          return NextResponse.json({ erro: "itens", mensagem: msg }, { status: 400 });
        }
      }
      if (!(valor > 0)) return NextResponse.json({ erro: "valor" }, { status: 400 });
      // não dá para "pagar" mais do que a mesa deve: o troco não é por aqui
      const falta = Math.round((Number(sessaoViva!.total) - Number(sessaoViva!.pago)) * 100) / 100;
      if (falta > 0 && valor > falta + 0.01) {
        return NextResponse.json(
          { erro: "valor_maior", mensagem: `A conta tem R$ ${falta.toFixed(2)} em aberto.` },
          { status: 400 }
        );
      }
      const gorjeta = Number(body.gorjeta) > 0 ? Number(body.gorjeta) : 0;
      const apelido = typeof body.apelido === "string" ? body.apelido.slice(0, 40) : null;

      // Com PSP configurado, o cliente recebe o copia e cola na hora e o
      // webhook baixa a conta sozinho. Sem PSP, fica pendente e o caixa confirma.
      let cobranca: { pspId: string; copiaCola: string; qrBase64: string | null } | null = null;
      try {
        cobranca = await criarCobrancaPix(loja, valor + gorjeta, `${loja.nome} mesa ${mesa.numero}`);
      } catch {
        cobranca = null;
      }

      const pg = await registrarPagamento(mesa.negocio_id, {
        lojaId: mesa.loja_id,
        sessaoId: sessaoViva!.id,
        metodo: "pix_app",
        valor, gorjeta,
        pagoPor: apelido,
        membroId: passe!.b,
        itens: itensPagos.length ? itensPagos : undefined,
        status: "pendente",
        psp: loja.pix_provedor ?? "manual",
        pspId: cobranca?.pspId ?? null,
      });
      return NextResponse.json({
        ok: true,
        pagamento_id: pg.id,
        copia_cola: cobranca?.copiaCola ?? null,
        qr_base64: cobranca?.qrBase64 ?? null,
        aguardando: true,
      });
    }
  }

  return NextResponse.json({ erro: "acao" }, { status: 400 });
}

/** Contador do cardapio: muda a cada 86 e a cada edicao de produto. */
async function rev(lojaId: string): Promise<number> {
  const r = await query<{ cardapio_rev: string }>(
    "SELECT cardapio_rev FROM food_lojas WHERE id = $1", [lojaId]
  );
  return Number(r.rows[0]?.cardapio_rev ?? 0);
}

// Só o que o cliente final precisa ver da loja (nada de fiscal, token ou config interna).
function publicoLoja(l: {
  id: string; slug: string; nome: string; logo_url: string | null; capa_url: string | null;
  cor_destaque: string | null; cor_fundo: string | null; tema_modo: string; telefone: string | null;
  whatsapp: string | null; endereco: string | null; taxa_servico_pct: string;
  taxa_servico_automatica: boolean; couvert: string; pagar_no_app: boolean;
  gorjeta_sugerida_pct: string; tempo_preparo_min: number; exige_aprovacao_garcom: boolean;
  cidade?: string | null;
  pedir_avaliacao?: boolean; google_url?: string | null;
  fidelidade_ativa?: boolean; pontos_por_real?: string; resgate_minimo?: number;
}) {
  return {
    id: l.id, slug: l.slug, nome: l.nome, logo_url: l.logo_url, capa_url: l.capa_url,
    cor_destaque: l.cor_destaque, cor_fundo: l.cor_fundo, tema_modo: l.tema_modo,
    telefone: l.telefone, whatsapp: l.whatsapp, endereco: l.endereco,
    taxa_servico_pct: l.taxa_servico_pct, taxa_servico_automatica: l.taxa_servico_automatica,
    couvert: l.couvert, pagar_no_app: l.pagar_no_app,
    gorjeta_sugerida_pct: l.gorjeta_sugerida_pct, tempo_preparo_min: l.tempo_preparo_min,
    exige_aprovacao_garcom: l.exige_aprovacao_garcom,
    pedir_avaliacao: l.pedir_avaliacao ?? true,
    fidelidade_ativa: l.fidelidade_ativa ?? false,
    resgate_minimo: l.resgate_minimo ?? 100,
  };
}
