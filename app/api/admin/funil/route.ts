import { NextResponse } from "next/server";
import { query } from "@/lib/groow/db";

export const dynamic = "force-dynamic";

// Funil & Performance: raio-x do caminho novo -> contatado -> diagnostico ->
// proposta -> fechado, calculado em cima da tabela de leads que já existe.
// "Chegou na etapa" = está nela agora OU numa etapa mais avançada.

const RANK: Record<string, number> = {
  novo: 1, frio: 1,
  contatado: 2, quente: 2,
  diagnostico: 3,
  proposta: 4,
  fechado: 5, assinado: 5,
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const periodo = url.searchParams.get("periodo") || "90d";
  const wherePeriodo =
    periodo === "30d" ? "WHERE created_at >= NOW() - INTERVAL '30 days'"
    : periodo === "90d" ? "WHERE created_at >= NOW() - INTERVAL '90 days'"
    : "";

  try {
    const porStatus = await query<{ status: string; n: number }>(
      `SELECT status, COUNT(*) AS n FROM leads ${wherePeriodo} GROUP BY status`
    );

    const total = porStatus.reduce((s, r) => s + Number(r.n), 0);
    const perdidos = porStatus.filter((r) => r.status === "perdido" || r.status === "recusado").reduce((s, r) => s + Number(r.n), 0);
    const fechados = porStatus.filter((r) => r.status === "fechado" || r.status === "assinado").reduce((s, r) => s + Number(r.n), 0);

    // funil cumulativo: quem está em etapa avançada também "passou" pelas anteriores
    const etapas = [
      { chave: "novo", label: "Lead entrou" },
      { chave: "contatado", label: "Contatado" },
      { chave: "diagnostico", label: "Diagnóstico" },
      { chave: "proposta", label: "Proposta" },
      { chave: "fechado", label: "Fechado" },
    ].map((e) => {
      const rank = RANK[e.chave];
      const n = porStatus
        .filter((r) => (RANK[r.status] ?? 0) >= rank)
        .reduce((s, r) => s + Number(r.n), 0);
      // leads entram no funil na etapa 1 mesmo que percam depois
      return { ...e, n: e.chave === "novo" ? total - 0 : n };
    });

    const porOrigem = await query<{ origem: string; n: number; fechados: number }>(
      `SELECT COALESCE(NULLIF(origem,''),'sem origem') AS origem, COUNT(*) AS n,
              SUM(CASE WHEN status IN ('fechado','assinado') THEN 1 ELSE 0 END) AS fechados
       FROM leads ${wherePeriodo} GROUP BY COALESCE(NULLIF(origem,''),'sem origem')
       ORDER BY n DESC LIMIT 12`
    );

    const porMes = await query<{ mes: string; n: number; fechados: number }>(
      `SELECT to_char(created_at,'YYYY-MM') AS mes, COUNT(*) AS n,
              SUM(CASE WHEN status IN ('fechado','assinado') THEN 1 ELSE 0 END) AS fechados
       FROM leads WHERE created_at >= NOW() - INTERVAL '6 months'
       GROUP BY mes ORDER BY mes`
    );

    return NextResponse.json({ total, fechados, perdidos, etapas, porOrigem, porMes });
  } catch (err) {
    console.error("[funil]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}
