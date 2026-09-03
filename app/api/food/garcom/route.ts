import { NextResponse, type NextRequest } from "next/server";
import { verifyPassword } from "@/lib/auth";
import { query } from "@/lib/db";
import {
  atenderChamado, criarPedido, entrarNaMesa, fecharSessao, imprimirConta, listChamados,
  listEquipe, mapaMesas, montarCardapio, registrarPagamento, resumoSessao, sessaoAtivaDaMesa,
} from "@/lib/food";
import { ErroKds, desfazerItem, moverItem, type EstadoItem } from "@/lib/food-kds";
import {
  autenticarDispositivo, gravarPasseDispositivo, respostaSemAparelho,
} from "@/lib/food-dispositivo";
import {
  COOKIE_EQUIPE, apagarPasseEquipe, assinarPasseEquipe, gravarPasseEquipe,
  lerPasseEquipe, podeNoTurno, turnoVivo, type PasseEquipe,
} from "@/lib/food-equipe-passe";
import { porQueNao, type AcaoEquipe } from "@/lib/food-permissoes";
import { aplicarDesconto, definirTaxaServico } from "@/lib/food-conta";
import { excedeuLimite } from "@/lib/groow/ratelimit";
import { registrarFalha } from "@/lib/log";
import { ErroEntrada, dinheiro, opcao, textoOpcional, uuid } from "@/lib/food-validar";
import type { ItemEntrada, MetodoPagamento } from "@/lib/food-types";

// ============================================================================
// App do garçom no tablet: /g/<token-do-dispositivo>.
//
// Duas credenciais, e as duas são necessárias para mexer em dinheiro:
//   1. o TOKEN DO DISPOSITIVO, que autoriza o tablet a ver o salão;
//   2. o TURNO da pessoa, aberto com PIN, em cookie httpOnly.
//
// O que mexe em dinheiro que não entrou (cortesia, desconto, fechar devendo) e
// o prejuízo de cancelar prato pronto são do gerente. A matriz está em
// lib/food-permissoes.ts.
// ============================================================================

export const dynamic = "force-dynamic";

const METODOS = [
  "dinheiro", "debito", "credito", "pix", "pix_app", "vale", "online", "cortesia",
] as const;

function ip(req: NextRequest): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? req.headers.get("x-real-ip") ?? null;
}

function erro(e: unknown, onde: string) {
  if (e instanceof ErroKds) {
    return NextResponse.json({ erro: e.codigo, mensagem: e.message },
      { status: e.codigo === "TRANSICAO_INVALIDA" ? 409 : 400 });
  }
  if (e instanceof ErroEntrada) {
    return NextResponse.json({ erro: e.codigo, campo: e.campo, mensagem: e.message }, { status: 400 });
  }
  registrarFalha(e, { onde: "food.garcom", acao: onde });
  return NextResponse.json({ erro: "erro", mensagem: "Não deu para completar. Tente de novo." }, { status: 400 });
}

/** A mesa tem que ser da loja DESTE tablet. */
async function mesaDaLoja(mesaId: string, lojaId: string): Promise<boolean> {
  const r = await query<{ id: string }>(
    "SELECT id FROM food_mesas WHERE id = $1 AND loja_id = $2", [mesaId, lojaId]
  );
  return r.rows.length > 0;
}

export async function GET(req: NextRequest) {
  const auth = await autenticarDispositivo(
    req, new URL(req.url).searchParams.get("token"), ["garcom", "caixa"]);
  const d = auth.disp;
  if (!d) return respostaSemAparelho(auth.erro);

  const turno = await turnoVivo(await lerPasseEquipe(req.cookies.get(COOKIE_EQUIPE)?.value), d.loja_id);

  const [mesas, cardapio, equipe, chamados] = await Promise.all([
    mapaMesas(d.negocio_id, d.loja_id),
    montarCardapio(d.loja_id, { canal: "mesa" }),
    listEquipe(d.negocio_id, d.loja_id),
    listChamados(d.negocio_id, d.loja_id),
  ]);
  return gravarPasseDispositivo(NextResponse.json({
    dispositivo: { nome: d.nome, loja: d.loja_nome, pareouAgora: !!auth.passe },
    mesas, cardapio, chamados,
    // quem está no turno agora, do banco e não do localStorage do tablet
    turno: turno ? { id: turno.e, nome: turno.n, papel: turno.p } : null,
    equipe: equipe.filter((e) => e.ativo && ["garcom", "gerente", "caixa"].includes(e.papel)),
  }), auth.passe);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  // POST nao pareia: quem casa o aparelho e o GET, que devolve o cookie
  const auth = await autenticarDispositivo(req, null, ["garcom", "caixa"]);
  const d = auth.disp;
  if (!d) return respostaSemAparelho(auth.erro);
  const acao = String(body.acao ?? "");
  const de = ip(req);

  if (excedeuLimite(`food:garcom:${d.id}`, { max: 240, janelaSeg: 60 })) {
    return NextResponse.json({ erro: "muitas_tentativas" }, { status: 429 });
  }

  const passe = await turnoVivo(await lerPasseEquipe(req.cookies.get(COOKIE_EQUIPE)?.value), d.loja_id);

  /** Barra a ação quando não há turno ou o papel não alcança. */
  function barrado(a: AcaoEquipe) {
    if (podeNoTurno(passe, a)) return null;
    return NextResponse.json(
      { erro: passe ? "sem_permissao" : "sem_turno", mensagem: porQueNao(passe?.p, a) },
      { status: passe ? 403 : 401 }
    );
  }

  const ator = (p: PasseEquipe) => ({
    tipo: "garcom" as const, id: p.e, nome: p.n, origem: `tablet ${d.nome}`,
  });

  try {
    switch (acao) {
      // ---- abre o turno com o PIN de quatro dígitos
      case "pin": {
        const equipeId = uuid(body.equipeId, "pessoa");
        const e = (await query<{ id: string; nome: string; papel: string; pin_hash: string | null }>(
          "SELECT id, nome, papel, pin_hash FROM food_equipe WHERE id = $1 AND loja_id = $2 AND ativo = true",
          [equipeId, d.loja_id]
        )).rows[0];

        const ok = !!e?.pin_hash && await verifyPassword(String(body.pin ?? ""), e.pin_hash);
        await query(
          `INSERT INTO food_tentativas_pin (negocio_id, loja_id, equipe_id, dispositivo_id, ok, ip)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [d.negocio_id, d.loja_id, e?.id ?? null, d.id, ok, de]
        );
        if (!e?.pin_hash) return NextResponse.json({ erro: "sem_pin", mensagem: "Esta pessoa ainda não tem PIN." }, { status: 403 });
        if (!ok) {
          // A trava conta ERRO, não tentativa: PIN de quatro dígitos são dez
          // mil combinações, e dez erros por tablet a cada cinco minutos deixa
          // isso em oitenta horas de força bruta. Quem acerta de primeira, e é
          // o caso normal numa noite cheia, nunca esbarra na trava.
          if (excedeuLimite(`food:pin:${d.id}`, { max: 10, janelaSeg: 300 })) {
            return NextResponse.json(
              { erro: "muitas_tentativas", mensagem: "PIN errado demais neste tablet. Espere cinco minutos." },
              { status: 429 }
            );
          }
          return NextResponse.json({ erro: "pin", mensagem: "PIN não confere." }, { status: 403 });
        }

        // um turno por pessoa: entrar de novo fecha o anterior
        await query(
          "UPDATE food_turnos SET fechado_em = now() WHERE equipe_id = $1 AND fechado_em IS NULL",
          [e.id]
        );
        const t = (await query<{ id: string }>(
          `INSERT INTO food_turnos (negocio_id, loja_id, equipe_id, dispositivo_id, ip)
           VALUES ($1,$2,$3,$4,$5) RETURNING id`,
          [d.negocio_id, d.loja_id, e.id, d.id, de]
        )).rows[0];

        const res = NextResponse.json({
          ok: true,
          garcom: { id: e.id, nome: e.nome, papel: e.papel },
        });
        gravarPasseEquipe(res, await assinarPasseEquipe({
          t: t.id, e: e.id, n: e.nome, p: e.papel, l: d.loja_id,
        }));
        return res;
      }

      // ---- fecha o turno (o botão "sair" do tablet)
      case "sair": {
        if (passe) {
          await query("UPDATE food_turnos SET fechado_em = now() WHERE id = $1", [passe.t]);
        }
        const res = NextResponse.json({ ok: true });
        apagarPasseEquipe(res);
        return res;
      }

      // ---- comanda da mesa
      case "sessao": {
        if (!passe) return NextResponse.json({ erro: "sem_turno", mensagem: "Entre com o seu PIN." }, { status: 401 });
        const mesaId = uuid(body.mesaId, "mesa");
        if (!(await mesaDaLoja(mesaId, d.loja_id))) return NextResponse.json({ erro: "mesa" }, { status: 404 });
        const s = await sessaoAtivaDaMesa(mesaId);
        if (!s) return NextResponse.json({ sessao: null, pedidos: [], pagamentos: [], membros: [] });
        return NextResponse.json(await resumoSessao(s.id));
      }

      // ---- lançar pedido (entra aprovado: quem lançou foi gente da casa)
      case "pedido": {
        const nao = barrado("lancar_pedido"); if (nao) return nao;
        const mesaId = uuid(body.mesaId, "mesa");
        const mesa = (await query<{
          id: string; negocio_id: string; loja_id: string; numero: string; token: string;
          apelido: string | null; capacidade: number; setor: string | null; ordem: number;
          cartao_gravado_em: string | null; ativa: boolean; criado_em: string;
        }>("SELECT * FROM food_mesas WHERE id = $1 AND loja_id = $2", [mesaId, d.loja_id])).rows[0];
        if (!mesa) return NextResponse.json({ erro: "mesa" }, { status: 404 });

        const { sessao } = await entrarNaMesa(mesa, `garcom:${passe!.e}`, passe!.n);
        const pedido = await criarPedido({
          negocioId: d.negocio_id, lojaId: d.loja_id, canal: "mesa",
          sessaoId: sessao.id, mesaId: mesa.id,
          garcomId: passe!.e,
          itens: (body.itens ?? []) as ItemEntrada[],
          obs: textoOpcional(body.obs, 300),
          chave: textoOpcional(body.chave, 120),
        });
        return NextResponse.json({ ok: true, pedido });
      }

      // ---- mover item no preparo, direto do tablet do garçom
      case "item": {
        const para = opcao(body.para, "estado",
          ["em_producao", "pronto", "entregue", "cancelado"] as const);
        const precisa: AcaoEquipe = para !== "cancelado" ? "mover_item"
          : (String(body.status_atual ?? "") === "pendente" ? "cancelar_pendente" : "cancelar_producao");
        const nao = barrado(precisa); if (nao) return nao;
        const r = await moverItem({
          negocioId: d.negocio_id, itemId: uuid(body.itemId, "item"),
          para: para as EstadoItem, ator: ator(passe!),
          motivo: textoOpcional(body.motivo), chave: textoOpcional(body.chave, 120),
        });
        return NextResponse.json(r);
      }
      case "desfazer": {
        const nao = barrado("mover_item"); if (nao) return nao;
        return NextResponse.json(await desfazerItem({
          negocioId: d.negocio_id, itemId: uuid(body.itemId, "item"), ator: ator(passe!),
        }));
      }

      // ---- receber
      case "pagamento": {
        const metodo = opcao(body.metodo, "forma de pagamento", METODOS);
        const nao = barrado(metodo === "cortesia" ? "cortesia" : "receber_pagamento");
        if (nao) return nao;
        const mesaId = uuid(body.mesaId, "mesa");
        if (!(await mesaDaLoja(mesaId, d.loja_id))) return NextResponse.json({ erro: "mesa" }, { status: 404 });
        const s = await sessaoAtivaDaMesa(mesaId);
        if (!s) return NextResponse.json({ erro: "sem_sessao" }, { status: 409 });
        await registrarPagamento(d.negocio_id, {
          lojaId: d.loja_id, sessaoId: s.id,
          metodo: metodo as MetodoPagamento,
          valor: dinheiro(body.valor, "valor"),
          gorjeta: dinheiro(body.gorjeta, "gorjeta", { padrao: 0 }),
          recebidoPor: passe!.e,
          pagoPor: passe!.n,
        });
        return NextResponse.json({ ok: true });
      }

      // ---- desconto: só gerente, e sempre com motivo
      case "desconto": {
        const nao = barrado("desconto"); if (nao) return nao;
        const mesaId = uuid(body.mesaId, "mesa");
        if (!(await mesaDaLoja(mesaId, d.loja_id))) return NextResponse.json({ erro: "mesa" }, { status: 404 });
        const s = await sessaoAtivaDaMesa(mesaId);
        if (!s) return NextResponse.json({ erro: "sem_sessao" }, { status: 409 });
        return NextResponse.json(await aplicarDesconto({
          negocioId: d.negocio_id, sessaoId: s.id,
          valor: dinheiro(body.valor, "desconto"),
          motivo: String(body.motivo ?? ""),
          ator: ator(passe!),
        }));
      }

      // ---- taxa de serviço: o cliente pode recusar (Lei 13.419/2017)
      case "servico": {
        if (!passe) return NextResponse.json({ erro: "sem_turno" }, { status: 401 });
        const mesaId = uuid(body.mesaId, "mesa");
        if (!(await mesaDaLoja(mesaId, d.loja_id))) return NextResponse.json({ erro: "mesa" }, { status: 404 });
        const s = await sessaoAtivaDaMesa(mesaId);
        if (!s) return NextResponse.json({ erro: "sem_sessao" }, { status: 409 });
        return NextResponse.json(await definirTaxaServico({
          negocioId: d.negocio_id, sessaoId: s.id,
          recusar: body.recusar === true, ator: ator(passe!),
        }));
      }

      // ---- fechar a conta
      case "fechar": {
        const nao = barrado("fechar_conta"); if (nao) return nao;
        const mesaId = uuid(body.mesaId, "mesa");
        if (!(await mesaDaLoja(mesaId, d.loja_id))) return NextResponse.json({ erro: "mesa" }, { status: 404 });
        const s = await sessaoAtivaDaMesa(mesaId);
        if (!s) return NextResponse.json({ erro: "sem_sessao" }, { status: 409 });

        const falta = Math.round((Number(s.total) - Number(s.pago)) * 100) / 100;
        if (falta > 0.01) {
          const nao2 = barrado("fechar_em_aberto"); if (nao2) return nao2;
          const motivo = textoOpcional(body.motivo, 200);
          if (!motivo) {
            return NextResponse.json({
              erro: "motivo_obrigatorio",
              mensagem: `Faltam R$ ${falta.toFixed(2)} na conta. Diga como foi recebido.`,
              falta,
            }, { status: 409 });
          }
          await fecharSessao(d.negocio_id, s.id, passe!.n, motivo);
        } else {
          await fecharSessao(d.negocio_id, s.id, passe!.n);
        }
        return NextResponse.json({ ok: true });
      }

      // ---- a conta impressa, que o garcom leva na mesa
      case "imprimir_conta": {
        if (!passe) return NextResponse.json({ erro: "sem_turno" }, { status: 401 });
        const mesaId = uuid(body.mesaId, "mesa");
        if (!(await mesaDaLoja(mesaId, d.loja_id))) return NextResponse.json({ erro: "mesa" }, { status: 404 });
        const s = await sessaoAtivaDaMesa(mesaId);
        if (!s) return NextResponse.json({ erro: "sem_sessao" }, { status: 409 });
        const r = await imprimirConta(d.negocio_id, s.id);
        return NextResponse.json(r);
      }

      case "chamado": {
        if (!passe) return NextResponse.json({ erro: "sem_turno" }, { status: 401 });
        await atenderChamado(d.negocio_id, uuid(body.chamadoId, "chamado"));
        return NextResponse.json({ ok: true });
      }
    }
    return NextResponse.json({ erro: "acao" }, { status: 400 });
  } catch (e) {
    return erro(e, acao);
  }
}
