import { NextResponse } from "next/server";
import { query, exec } from "@/lib/groow/db";
import { construtorSql, clausulaWhere, clausulaSet } from "@/lib/groow/sql";
import { parseValorBR } from "@/lib/groow/valor";

export const dynamic = "force-dynamic";

interface TransacaoRow {
  id: number;
  cliente_id: number | null;
  tipo: string;
  descricao: string | null;
  valor: string;
  data: string;
  created_at: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const { p, params } = construtorSql();
  const where: string[] = [];
  if (from) where.push(`data >= ${p(from)}`);
  if (to) where.push(`data <= ${p(to)}`);
  const whereSql = clausulaWhere(where);
  try {
    const rows = await query<TransacaoRow>(
      `SELECT id, cliente_id, tipo, descricao, valor, data, created_at
       FROM transacoes ${whereSql} ORDER BY data DESC, id DESC LIMIT 300`,
      params
    );
    return NextResponse.json({ transacoes: rows });
  } catch (err) {
    console.error("[admin/transacoes]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: { cliente_id?: number | null; tipo?: string; descricao?: string; valor: number | string; data?: string; forcar?: boolean };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const valor = parseValorBR(body.valor);
  if (!Number.isFinite(valor) || valor <= 0) {
    return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
  }
  const tipo = ["recorrente", "setup", "avulso", "manual"].includes(body.tipo || "") ? body.tipo! : "manual";
  const data = body.data || new Date().toISOString().slice(0, 10);
  try {
    // Mensalidade é única por cliente+mês: clique repetido em "Marcar pago"
    // não pode duplicar a transação. Lançamento manual passa `forcar` e escapa
    // dessa trava — antes ele era engolido em silêncio quando o cliente já
    // tinha uma recorrente no mês, e a tela ainda dizia "lançado".
    if (tipo === "recorrente" && body.cliente_id && !body.forcar) {
      const dup = await query<{ id: number }>(
        `SELECT id FROM transacoes
         WHERE cliente_id = $1 AND tipo = 'recorrente'
           AND to_char(data,'YYYY-MM') = to_char($2::date, 'YYYY-MM')
         LIMIT 1`,
        [body.cliente_id, data]
      );
      if (dup[0]) return NextResponse.json({ ok: true, id: dup[0].id, jaExistia: true });
    }
    const result = await exec(
      `INSERT INTO transacoes (cliente_id, tipo, descricao, valor, data) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [body.cliente_id || null, tipo, body.descricao?.trim() || null, valor, data]
    );
    return NextResponse.json({ ok: true, id: result.insertId });
  } catch (err) {
    console.error("[admin/transacoes]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}
