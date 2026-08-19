import { NextResponse } from "next/server";
import { query, exec } from "@/lib/groow/db";
import { construtorSql, clausulaWhere } from "@/lib/groow/sql";
import type { Lead } from "@/lib/groow/types";
import { LEAD_STATUSES } from "@/lib/groow/types";
import { buildLeadSelect } from "@/lib/groow/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const q = searchParams.get("q");
  const periodo = searchParams.get("periodo");

  const { p, params } = construtorSql();
  const where: string[] = [];

  if (status && (LEAD_STATUSES as readonly string[]).includes(status)) {
    where.push(`status = ${p(status)}`);
  }
  if (q) {
    // ILIKE e não LIKE: no Postgres o LIKE é sensível a maiúscula, e a busca do
    // painel sempre foi case-insensitive (no MySQL o collation cuidava disso).
    const term = `%${q}%`;
    where.push(`(nome ILIKE ${p(term)} OR empresa ILIKE ${p(term)} OR email ILIKE ${p(term)})`);
  }
  if (periodo === "7d") {
    where.push("created_at >= NOW() - INTERVAL '7 days'");
  } else if (periodo === "30d") {
    where.push("created_at >= NOW() - INTERVAL '30 days'");
  } else if (periodo === "90d") {
    where.push("created_at >= NOW() - INTERVAL '90 days'");
  }

  const whereSql = clausulaWhere(where);

  try {
    const select = await buildLeadSelect([
      "id", "nome", "email", "whatsapp", "empresa", "setor", "faturamento",
      "mensagem", "origem", "fonte_trafego", "site", "endereco", "tem_site_proprio",
      "status", "notas", "ultimo_contato_em",
      "created_at", "updated_at",
    ]);
    const leads = await query<Lead>(
      `SELECT ${select}
       FROM leads
       ${whereSql}
       ORDER BY created_at DESC
       LIMIT 200`,
      params
    );
    return NextResponse.json({ leads });
  } catch (err) {
    console.error("[admin/leads]", err);
    return NextResponse.json(
      { error: "Erro ao processar a requisição." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  let body: { nome: string; empresa?: string; whatsapp?: string; email?: string; setor?: string; cidade?: string; faturamento?: string; origem?: string; fonte_trafego?: string; status?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!body.nome?.trim()) {
    return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
  }
  const status = body.status && (LEAD_STATUSES as readonly string[]).includes(body.status as never)
    ? body.status : "novo";
  try {
    const result = await exec(
      `INSERT INTO leads (nome, empresa, telefone, email, setor, cidade, faturamento, origem, fonte_trafego, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [
        body.nome.trim(),
        body.empresa?.trim() || null,
        body.whatsapp?.trim() || null,
        body.email?.trim() || null,
        body.setor?.trim() || null,
        body.cidade?.trim() || null,
        body.faturamento?.trim() || null,
        body.origem?.trim() || "prospeccao",
        body.fonte_trafego?.trim() || null,
        status,
      ]
    );
    return NextResponse.json({ ok: true, id: result.insertId });
  } catch (err) {
    console.error("[admin/leads]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}
