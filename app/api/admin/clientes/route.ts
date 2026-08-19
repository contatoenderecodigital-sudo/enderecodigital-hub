import { NextResponse } from "next/server";
import { query, exec } from "@/lib/groow/db";
import { CLIENTE_STATUSES, type Cliente, type ClienteStatus } from "@/lib/groow/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const clientes = await query<Cliente>(
      `SELECT * FROM clientes ORDER BY status = 'ativo' DESC, empresa ASC`
    );
    return NextResponse.json({ clientes });
  } catch (err) {
    console.error("[admin/clientes]", err);
    return NextResponse.json(
      { error: "Erro ao processar a requisição." },
      { status: 500 }
    );
  }
}

interface PostBody {
  lead_id?: number | null;
  empresa: string;
  responsavel?: string;
  email?: string;
  whatsapp?: string;
  plano?: string;
  valor_mensal?: number;
  inicio_contrato: string;
  fim_contrato?: string | null;
  status?: ClienteStatus;
  valor_setup?: number;
  modulos?: string;
  notas?: string;
}

export async function POST(request: Request) {
  let body: PostBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!body.empresa || !body.inicio_contrato) {
    return NextResponse.json(
      { error: "Empresa e início_contrato obrigatórios" },
      { status: 400 }
    );
  }
  const status = body.status && (CLIENTE_STATUSES as readonly string[]).includes(body.status)
    ? body.status : "ativo";

  try {
    const result = await exec(
      `INSERT INTO clientes
        (lead_id, empresa, responsavel, email, whatsapp, plano, valor_mensal, valor_setup,
         inicio_contrato, fim_contrato, status, modulos, notas)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
      [
        body.lead_id ?? null,
        body.empresa,
        body.responsavel ?? null,
        body.email ?? null,
        body.whatsapp ?? null,
        body.plano ?? null,
        body.valor_mensal ?? 0,
        body.valor_setup ?? 0,
        body.inicio_contrato,
        body.fim_contrato ?? null,
        status,
        body.modulos ?? null,
        body.notas ?? null,
      ]
    );
    return NextResponse.json({ ok: true, id: result.insertId });
  } catch (err) {
    console.error("[admin/clientes]", err);
    return NextResponse.json(
      { error: "Erro ao processar a requisição." },
      { status: 500 }
    );
  }
}
