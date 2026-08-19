import { NextResponse } from "next/server";
import { query } from "@/lib/groow/db";
import type { Cliente } from "@/lib/groow/types";

export const dynamic = "force-dynamic";

interface MonthlyPoint {
  mes: string;
  faturamento: number;
}

export async function GET() {
  try {
    const [sumRow] = await query<{ total: string | null; qtd: number }>(
      `SELECT COALESCE(SUM(valor_mensal),0) AS total, COUNT(*) AS qtd
       FROM clientes WHERE status = 'ativo'`
    );
    const mensal = Number(sumRow?.total ?? 0);
    const ativos = Number(sumRow?.qtd ?? 0);
    const trimestral = mensal * 3;
    const ticketMedio = ativos > 0 ? mensal / ativos : 0;

    // Faturamento últimos 12 meses (projeção: valor_mensal de clientes ativos no mês)
    // Versão simplificada: projeção linear baseada nos clientes atuais.
    const mensalSeries: MonthlyPoint[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ativosNoMes = await query<{ total: string | null }>(
        `SELECT COALESCE(SUM(valor_mensal),0) AS total
         FROM clientes
         WHERE inicio_contrato <= $1
           AND (fim_contrato IS NULL OR fim_contrato >= $2)
           AND status IN ('ativo','concluido')`,
        [d.toISOString().slice(0, 10), d.toISOString().slice(0, 10)]
      );
      mensalSeries.push({
        mes: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
        faturamento: Number(ativosNoMes[0]?.total ?? 0),
      });
    }

    // Setup totals
    const [setupRow] = await query<{ total: string | null; qtd: number }>(
      `SELECT COALESCE(SUM(valor_setup),0) AS total, COUNT(*) AS qtd
       FROM clientes WHERE valor_setup > 0`
    );
    const totalSetup = Number(setupRow?.total ?? 0);

    // Setup por mês (quando o contrato iniciou)
    const setupSeries: MonthlyPoint[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const fimMes = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const rows = await query<{ total: string | null }>(
        `SELECT COALESCE(SUM(valor_setup),0) AS total
         FROM clientes
         WHERE inicio_contrato BETWEEN $1 AND $2
           AND valor_setup > 0`,
        [d.toISOString().slice(0, 10), fimMes.toISOString().slice(0, 10)]
      );
      setupSeries.push({
        mes: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
        faturamento: Number(rows[0]?.total ?? 0),
      });
    }

    const clientes = await query<Cliente>(
      `SELECT id, empresa, plano, valor_mensal, valor_setup, status, inicio_contrato, fim_contrato
       FROM clientes
       ORDER BY status = 'ativo' DESC, valor_mensal DESC`
    );

    const vencendo = await query<{
      id: number; empresa: string; fim_contrato: string;
    }>(
      `SELECT id, empresa, fim_contrato
       FROM clientes
       WHERE status = 'ativo'
         AND fim_contrato IS NOT NULL
         AND fim_contrato BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
       ORDER BY fim_contrato ASC`
    );

    return NextResponse.json({
      resumo: { mensal, trimestral, ticketMedio, ativos, totalSetup },
      mensalSeries,
      setupSeries,
      clientes,
      vencendo,
    });
  } catch (err) {
    console.error("[admin/financeiro]", err);
    return NextResponse.json(
      { error: "Erro ao processar a requisição." },
      { status: 500 }
    );
  }
}
