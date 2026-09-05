import { NextResponse } from "next/server";
import { catalogoPublico, ErroReservaPublica, reservarPublico } from "@/lib/agendamento-publico";

const resposta = (dados: unknown, status = 200) => NextResponse.json(dados, {
  status,
  headers: { "Cache-Control": "no-store" },
});

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const catalogo = await catalogoPublico(slug);
  if (!catalogo) return resposta({ erro: "não_encontrado" }, 404);
  return resposta({
    nome: catalogo.nome, cor: catalogo.cor, logo: catalogo.logo, maxDias: catalogo.maxDias,
    profissionais: catalogo.profissionais, servicos: catalogo.servicos,
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const origem = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origem && host) {
    try {
      if (new URL(origem).host !== host) return resposta({ erro: "origem_inválida" }, 403);
    } catch { return resposta({ erro: "origem_inválida" }, 403); }
  }
  const entrada = await req.json().catch(() => null);
  if (!entrada || typeof entrada !== "object" || Array.isArray(entrada)) return resposta({ erro: "dados_inválidos" }, 400);
  try {
    await reservarPublico(slug, entrada as Record<string, unknown>);
    return resposta({ ok: true }, 201);
  } catch (erro) {
    if (erro instanceof ErroReservaPublica) return resposta({ erro: erro.message }, erro.status);
    console.error("[agendar] reserva:", erro);
    return resposta({ erro: "Não foi possível reservar agora." }, 500);
  }
}
