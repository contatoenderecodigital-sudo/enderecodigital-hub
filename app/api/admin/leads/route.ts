import { NextResponse } from "next/server";
import { query, exec } from "@/lib/groow/db";
import type { Lead } from "@/lib/groow/types";
import { LEAD_STATUSES } from "@/lib/groow/types";
import { buildLeadSelect } from "@/lib/groow/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const q = searchParams.get("q");
  const periodo = searchParams.get("periodo");

  const where: string[] = [];
  const params: (string | number)[] = [];

  if (status && (LEAD_STATUSES as readonly string[]).includes(status)) {
    where.push("status = ?");
    params.push(status);
  }
  if (q) {
    where.push("(nome LIKE ? OR empresa LIKE ? OR email LIKE ?)");
    const term = `%${q}%`;
    params.push(term, term, term);
  }
  if (periodo === "7d") {
    where.push("created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)");
  } else if (periodo === "30d") {
    where.push("created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)");
  } else if (periodo === "90d") {
    where.push("created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)");
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

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
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
