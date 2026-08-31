import { NextResponse } from "next/server";
import { exigirParceiro } from "@/lib/groow/parceiro-sessao";
import { geocodificarCidade } from "@/lib/groow/geocodificar";
import { excedeuLimite } from "@/lib/groow/ratelimit";

/**
 * Mesma geocodificacao do dono, com sessao de parceiro.
 *
 * Existe porque o mapa e o MESMO componente nos dois paineis: sem esta rota o
 * parceiro tomava unauthorized do middleware ao buscar a cidade no mapa, e a
 * prospecao inteira ficava inutil para ele.
 *
 * Nao desconta do teto diario: quem custa de verdade e a busca de empresas, e
 * cobrar o parceiro por posicionar o mapa faria ele evitar justamente a parte
 * que deixa a busca boa. Mas tem freio de rajada, senao alguem segurando tecla
 * na caixa de cidade vira chamada paga em serie.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await exigirParceiro();
  if (!auth.ok) return auth.resposta;

  if (excedeuLimite(`geo:${auth.parceiro.id}`, { max: 40, janelaSeg: 600 })) {
    return NextResponse.json(
      { error: "Muitas buscas de cidade seguidas. Espere um minuto." },
      { status: 429 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { cidade?: string };
  const r = await geocodificarCidade(body.cidade || "");
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ opcoes: r.opcoes });
}
