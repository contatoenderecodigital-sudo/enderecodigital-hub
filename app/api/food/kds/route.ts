import { NextResponse, type NextRequest } from "next/server";
import { query } from "@/lib/db";
import { atenderChamado, listChamados } from "@/lib/food";
import {
  ErroKds, atorDoDispositivo, desfazerItem, estadoKds,
  marcar86, moverItem, moverPedido, revisaoKds,
  type EstadoItem,
} from "@/lib/food-kds";
import {
  autenticarDispositivo, gravarPasseDispositivo, respostaSemAparelho,
} from "@/lib/food-dispositivo";
import { excedeuLimite } from "@/lib/groow/ratelimit";
import { registrarFalha } from "@/lib/log";

// ============================================================================
// KDS: a tela da cozinha. Autorização = TOKEN DO DISPOSITIVO (food_dispositivos),
// não login. O tablet abre /k/<token> e fica lá.
//
// Toda mudança de estado passa pela máquina de `lib/food-kds-sql.ts`: validada,
// idempotente e gravada em `food_item_eventos` com quem, quando e de onde.
// ============================================================================

export const dynamic = "force-dynamic";

const ator = atorDoDispositivo;

function erro(e: unknown) {
  if (e instanceof ErroKds) {
    return NextResponse.json(
      { erro: e.codigo, mensagem: e.message, detalhe: e.detalhe },
      { status: e.codigo === "TRANSICAO_INVALIDA" ? 409 : 400 }
    );
  }
  return NextResponse.json({ erro: "ERRO", mensagem: "Não deu para completar." }, { status: 400 });
}

// ---- o estado completo. É isto que a tela busca ao abrir e a cada reconexão.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const auth = await autenticarDispositivo(req, url.searchParams.get("token"));
  const d = auth.disp;
  if (!d) return respostaSemAparelho(auth.erro);

  const [itens, chamados, areas, rev] = await Promise.all([
    estadoKds(d.negocio_id, d.loja_id, d.area_id),
    listChamados(d.negocio_id, d.loja_id),
    query<{ id: string; nome: string; meta_min: number }>(
      `SELECT id, nome, meta_min FROM food_areas
        WHERE loja_id = $1 AND ativa = true ${d.area_id ? "AND id = $2" : ""}
        ORDER BY ordem, nome`,
      d.area_id ? [d.loja_id, d.area_id] : [d.loja_id]
    ).then((r) => r.rows),
    revisaoKds(d.loja_id),
  ]);

  // Quando o aparelho acabou de parear, o passe sai grudado nesta resposta e o
  // link da URL morre. Da proxima vez quem entra e o cookie.
  return gravarPasseDispositivo(NextResponse.json({
    dispositivo: {
      nome: d.nome, tipo: d.tipo, loja: d.loja_nome,
      area: d.area_nome, areaId: d.area_id,
      pareouAgora: !!auth.passe,
    },
    areas, itens, chamados, rev,
    agora: new Date().toISOString(),
  }), auth.passe);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  // POST nao pareia: quem casa o aparelho e o GET, que devolve o cookie
  const auth = await autenticarDispositivo(req, null);
  const d = auth.disp;
  if (!d) return respostaSemAparelho(auth.erro);

  // uma cozinha inteira em rush nao passa disso; um script passa
  if (excedeuLimite(`food:kds:${d.id}`, { max: 300, janelaSeg: 60 })) {
    return NextResponse.json({ erro: "muitas_tentativas" }, { status: 429 });
  }

  const texto = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : null);

  try {
    switch (String(body.acao ?? "")) {
      // ---- mover um item de coluna
      case "item": {
        const r = await moverItem({
          negocioId: d.negocio_id,
          itemId: String(body.itemId ?? ""),
          para: String(body.para ?? body.status ?? "") as EstadoItem,
          ator: ator(d),
          motivo: texto(body.motivo),
          chave: texto(body.chave, 120),
        });
        return NextResponse.json({ ...r, rev: await revisaoKds(d.loja_id) });
      }

      // ---- a faixa de 10 segundos
      case "desfazer": {
        const r = await desfazerItem({
          negocioId: d.negocio_id, itemId: String(body.itemId ?? ""), ator: ator(d),
        });
        return NextResponse.json({ ...r, rev: await revisaoKds(d.loja_id) });
      }

      // ---- "sai tudo": o pedido inteiro de uma vez
      case "pedido": {
        const r = await moverPedido({
          negocioId: d.negocio_id,
          pedidoId: String(body.pedidoId ?? ""),
          para: String(body.para ?? body.status ?? "") as EstadoItem,
          ator: ator(d),
          motivo: texto(body.motivo),
        });
        return NextResponse.json({ ...r, rev: await revisaoKds(d.loja_id) });
      }

      // ---- 86: acabou. Some do cardápio de todos os celulares abertos.
      case "86": {
        const r = await marcar86({
          negocioId: d.negocio_id, lojaId: d.loja_id,
          produtoId: String(body.produtoId ?? ""),
          esgotado: body.esgotado !== false,
          ator: ator(d),
        });
        return NextResponse.json({ ...r, rev: await revisaoKds(d.loja_id) });
      }

      case "chamado": {
        await atenderChamado(d.negocio_id, String(body.chamadoId ?? ""));
        return NextResponse.json({ ok: true, rev: await revisaoKds(d.loja_id) });
      }
    }
    return NextResponse.json({ erro: "acao" }, { status: 400 });
  } catch (e) {
    if (!(e instanceof ErroKds)) {
      registrarFalha(e, { onde: "food.kds", loja: d.loja_id, acao: String(body.acao ?? "") });
    }
    return erro(e);
  }
}
