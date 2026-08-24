import { NextResponse } from "next/server";
import { query, exec } from "@/lib/groow/db";
import { construtorSql, clausulaSet } from "@/lib/groow/sql";
import { hashPassword } from "@/lib/groow/password";
import {
  garantirTabelasParceiros,
  listarParceiros,
  slugCodigo,
  CODIGO_RE,
  num,
} from "@/lib/groow/parceiros";

export const dynamic = "force-dynamic";

/** Lista com os números de cada parceiro, para a tabela do módulo. */
export async function GET() {
  await garantirTabelasParceiros();
  const parceiros = await listarParceiros();

  const [fila, clientes, comissoes, cliques] = await Promise.all([
    query<{ parceiro_id: number; total: number; autorizados: number; promovidos: number }>(
      // COUNT(*) FILTER e não SUM(col = 1): no Postgres a comparação devolve
      // boolean, e SUM de boolean não existe.
      `SELECT parceiro_id, COUNT(*) AS total,
              COUNT(*) FILTER (WHERE optin = 1) AS autorizados,
              COUNT(*) FILTER (WHERE lead_id IS NOT NULL) AS promovidos
         FROM parceiro_leads GROUP BY parceiro_id`
    ),
    query<{ parceiro_id: number; n: number }>(
      `SELECT parceiro_id, COUNT(*) AS n FROM clientes
        WHERE parceiro_id IS NOT NULL GROUP BY parceiro_id`
    ),
    query<{ parceiro_id: number; status: string; total: unknown }>(
      `SELECT parceiro_id, status, SUM(valor) AS total
         FROM parceiro_comissoes WHERE status <> 'cancelado'
        GROUP BY parceiro_id, status`
    ),
    query<{ parceiro_id: number; n: number }>(
      `SELECT parceiro_id, COUNT(*) AS n FROM parceiro_cliques GROUP BY parceiro_id`
    ),
  ]);

  const porId = new Map<number, Record<string, number>>();
  const pega = (id: number) => {
    if (!porId.has(id)) {
      porId.set(id, {
        leads: 0, autorizados: 0, promovidos: 0, clientes: 0,
        cliques: 0, previsto: 0, aprovado: 0, pago: 0,
      });
    }
    return porId.get(id) as Record<string, number>;
  };

  for (const f of fila) {
    const a = pega(f.parceiro_id);
    a.leads = num(f.total);
    a.autorizados = num(f.autorizados);
    a.promovidos = num(f.promovidos);
  }
  for (const c of clientes) pega(c.parceiro_id).clientes = num(c.n);
  for (const c of cliques) pega(c.parceiro_id).cliques = num(c.n);
  for (const c of comissoes) {
    const a = pega(c.parceiro_id);
    if (c.status === "previsto") a.previsto = num(c.total);
    if (c.status === "aprovado") a.aprovado = num(c.total);
    if (c.status === "pago") a.pago = num(c.total);
  }

  return NextResponse.json({
    parceiros: parceiros.map((p) => ({ ...p, ...(porId.get(p.id) ?? pega(p.id)) })),
  });
}

export async function POST(req: Request) {
  await garantirTabelasParceiros();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const nome = String(body.nome || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const senha = String(body.senha || "");
  if (!nome || !email) {
    return NextResponse.json({ error: "Nome e e-mail são obrigatórios." }, { status: 400 });
  }
  if (senha && senha.length < 8) {
    return NextResponse.json({ error: "A senha precisa ter ao menos 8 caracteres." }, { status: 400 });
  }

  const codigo = slugCodigo(String(body.codigo || "") || nome);
  if (!CODIGO_RE.test(codigo)) {
    return NextResponse.json({ error: "Código inválido. Use letras, números e hífen." }, { status: 400 });
  }

  try {
    const r = await exec(
      `INSERT INTO parceiros
         (nome, email, telefone, codigo, senha_hash, comissao_setup_pct, comissao_mensal_pct,
          comissao_meses, comissao_fixa, status, observacao)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [
        nome.slice(0, 160),
        email.slice(0, 190),
        String(body.telefone || "").trim().slice(0, 32) || null,
        codigo,
        senha ? await hashPassword(senha) : null,
        num(body.comissao_setup_pct),
        num(body.comissao_mensal_pct),
        Math.max(1, Math.min(120, num(body.comissao_meses) || 12)),
        Math.max(0, num(body.comissao_fixa)),
        body.status === "pausado" ? "pausado" : "ativo",
        String(body.observacao || "").slice(0, 2000) || null,
      ]
    );
    return NextResponse.json({ ok: true, id: r.insertId, codigo });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (/duplicate/i.test(msg)) {
      return NextResponse.json(
        { error: "Já existe parceiro com esse e-mail ou código." },
        { status: 409 }
      );
    }
    console.error("[parceiros] criar:", err);
    return NextResponse.json({ error: "Não consegui criar." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  await garantirTabelasParceiros();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Id inválido." }, { status: 400 });
  }

  const senha = String(body.senha || "");
  if (senha && senha.length < 8) {
    return NextResponse.json({ error: "A senha precisa ter ao menos 8 caracteres." }, { status: 400 });
  }

  const codigo = body.codigo ? slugCodigo(String(body.codigo)) : null;
  if (codigo && !CODIGO_RE.test(codigo)) {
    return NextResponse.json({ error: "Código inválido." }, { status: 400 });
  }

  try {
    const { p, params } = construtorSql();
    const sets = [
      `nome = COALESCE(${p(String(body.nome || "").trim().slice(0, 160) || null)}, nome)`,
      `telefone = ${p(String(body.telefone || "").trim().slice(0, 32) || null)}`,
      `codigo = COALESCE(${p(codigo)}, codigo)`,
      `comissao_setup_pct = ${p(num(body.comissao_setup_pct))}`,
      `comissao_mensal_pct = ${p(num(body.comissao_mensal_pct))}`,
      `comissao_meses = ${p(Math.max(1, Math.min(120, num(body.comissao_meses) || 12)))}`,
      `comissao_fixa = ${p(Math.max(0, num(body.comissao_fixa)))}`,
      `status = ${p(body.status === "pausado" ? "pausado" : "ativo")}`,
      `observacao = ${p(String(body.observacao || "").slice(0, 2000) || null)}`,
    ];
    if (senha) sets.push(`senha_hash = ${p(await hashPassword(senha))}`);

    await exec(`UPDATE parceiros ${clausulaSet(sets)} WHERE id = ${p(id)}`, params);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (/duplicate/i.test(msg)) {
      return NextResponse.json({ error: "Esse código já está em uso." }, { status: 409 });
    }
    console.error("[parceiros] atualizar:", err);
    return NextResponse.json({ error: "Não consegui salvar." }, { status: 500 });
  }
}
