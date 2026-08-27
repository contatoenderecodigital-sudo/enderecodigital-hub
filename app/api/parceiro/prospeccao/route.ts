import { NextResponse } from "next/server";
import { exigirParceiro } from "@/lib/groow/parceiro-sessao";
import { query, exec } from "@/lib/groow/db";
import { buscarEmpresas, type ParamsBusca } from "@/lib/groow/prospeccao";

/**
 * Prospeccao para o parceiro: acha empresa no Google Maps para ele ligar.
 *
 * Reaproveita a rota de admin em vez de duplicar o motor de busca e a formula
 * de score. O que existe aqui a mais e o TETO DIARIO: cada busca e uma chamada
 * paga da API do Google Places, e quem paga e o dono. Sem teto, uma tarde de
 * cliques do parceiro vira conta no fim do mes.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const auth = await exigirParceiro();
  if (!auth.ok) return auth.resposta;
  const parceiro = auth.parceiro;

  const teto = Number(
    (
      await query<{ buscas_por_dia: number }>(
        `SELECT buscas_por_dia FROM parceiros WHERE id = $1`,
        [parceiro.id]
      )
    )[0]?.buscas_por_dia ?? 0
  );
  if (teto <= 0) {
    return NextResponse.json(
      { error: "A busca de empresas não está liberada na sua conta." },
      { status: 403 }
    );
  }

  // Dia no fuso de Sao Paulo: virar o contador a meia-noite UTC daria ao
  // parceiro um teto novo as 21h.
  const hoje = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const usadas = Number(
    (
      await query<{ total: number }>(
        `SELECT total FROM parceiro_buscas WHERE parceiro_id = $1 AND dia = $2`,
        [parceiro.id, hoje]
      )
    )[0]?.total ?? 0
  );
  if (usadas >= teto) {
    return NextResponse.json(
      {
        error: `Você já fez as ${teto} buscas de hoje. Amanhã zera.`,
        restantes: 0,
      },
      { status: 429 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  // Conta ANTES de chamar o Google. Contar depois deixaria a janela entre a
  // chamada e a gravacao aberta para clique repetido, que e justamente o caso
  // de quem esta impaciente com a busca demorando.
  await exec(
    `INSERT INTO parceiro_buscas (parceiro_id, dia, total)
     VALUES ($1, $2, 1)
     ON CONFLICT (parceiro_id, dia) DO UPDATE
       SET total = parceiro_buscas.total + 1, ultima_em = NOW()`,
    [parceiro.id, hoje]
  );

  // Limite mais apertado que o do dono: uma pagina por busca, ate 20 empresas.
  // Tres paginas triplicariam o custo de cada clique.
  const r = await buscarEmpresas({ ...(body as ParamsBusca), maxPaginas: 1 });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });

  const { ok: _ok, ...dados } = r;
  return NextResponse.json({ ...dados, restantes: Math.max(0, teto - usadas - 1) });
}

/** Quantas buscas ainda restam hoje, para a tela mostrar antes de gastar. */
export async function GET() {
  const auth = await exigirParceiro();
  if (!auth.ok) return auth.resposta;

  const hoje = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const teto = Number(
    (
      await query<{ buscas_por_dia: number }>(
        `SELECT buscas_por_dia FROM parceiros WHERE id = $1`,
        [auth.parceiro.id]
      )
    )[0]?.buscas_por_dia ?? 0
  );
  const usadas = Number(
    (
      await query<{ total: number }>(
        `SELECT total FROM parceiro_buscas WHERE parceiro_id = $1 AND dia = $2`,
        [auth.parceiro.id, hoje]
      )
    )[0]?.total ?? 0
  );

  return NextResponse.json({ teto, usadas, restantes: Math.max(0, teto - usadas) });
}
