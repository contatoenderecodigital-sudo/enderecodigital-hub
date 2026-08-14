import { NextResponse } from "next/server";
import { query } from "@/lib/groow/db";
import { PIPELINE_COLUMNS, type Lead, type LeadStatus } from "@/lib/groow/types";
import { buildLeadSelect } from "@/lib/groow/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  try {
    const select = await buildLeadSelect([
      "id", "nome", "empresa", "whatsapp", "email", "status", "created_at", "updated_at",
    ]);
    const params: (string | number)[] = [...PIPELINE_COLUMNS];
    const dateWhere: string[] = [];
    if (from) { dateWhere.push("created_at >= ?"); params.push(`${from} 00:00:00`); }
    if (to) { dateWhere.push("created_at <= ?"); params.push(`${to} 23:59:59`); }
    const dateSql = dateWhere.length ? ` AND ${dateWhere.join(" AND ")}` : "";
    const leads = await query<Lead>(
      `SELECT ${select}
       FROM leads
       WHERE status IN (${PIPELINE_COLUMNS.map(() => "?").join(",")})${dateSql}
       ORDER BY updated_at DESC`,
      params
    );

    const grouped: Record<LeadStatus, Lead[]> = {
      novo: [], contatado: [], diagnostico: [], proposta: [], fechado: [],
      assinado: [], perdido: [], recusado: [], frio: [], quente: [],
    };
    for (const l of leads) {
      if (PIPELINE_COLUMNS.includes(l.status)) grouped[l.status].push(l);
    }
    return NextResponse.json({ pipeline: grouped });
  } catch (err) {
    console.error("[admin/pipeline]", err);
    return NextResponse.json(
      { error: "Erro ao processar a requisição." },
      { status: 500 }
    );
  }
}
