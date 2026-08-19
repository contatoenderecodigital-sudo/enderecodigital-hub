import { NextResponse } from "next/server";
import { query, exec } from "@/lib/groow/db";
import { construtorSql, clausulaSet } from "@/lib/groow/sql";
import { cifrar, decifrar } from "@/lib/groow/cofre";

export const dynamic = "force-dynamic";

// GET → revela UMA senha (decifra na hora; nada de lote)
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const rows = await query<{ segredo: string }>(`SELECT segredo FROM senhas_cofre WHERE id = $1 LIMIT 1`, [Number(id)]);
    if (!rows[0]) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    return NextResponse.json({ senha: decifrar(rows[0].segredo) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("SENHAS_CHAVE")) return NextResponse.json({ error: msg }, { status: 500 });
    console.error("[senhas/id GET]", err);
    return NextResponse.json({ error: "Não foi possível decifrar (a SENHAS_CHAVE mudou desde que essa senha foi salva?)." }, { status: 500 });
  }
}

// PATCH → edita campos; se vier senha nova, recifra
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: { cliente?: string; servico?: string; url?: string; usuario?: string; senha?: string; notas?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  try {
    const { p, params } = construtorSql();
    const sets: string[] = [];
    const campos: [keyof typeof body, string, number][] = [
      ["cliente", "cliente", 190], ["servico", "servico", 190], ["url", "url", 490], ["usuario", "usuario", 250], ["notas", "notas", 490],
    ];
    for (const [k, col, max] of campos) {
      if (body[k] !== undefined) { sets.push(`${col} = ${p(String(body[k]).trim().slice(0, max))}`); }
    }
    if (body.senha) sets.push(`segredo = ${p(cifrar(body.senha))}`);
    if (!sets.length) return NextResponse.json({ error: "Nada pra atualizar" }, { status: 400 });
    await exec(`UPDATE senhas_cofre ${clausulaSet(sets)} WHERE id = ${p(Number(id))}`, params);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("SENHAS_CHAVE")) return NextResponse.json({ error: msg }, { status: 500 });
    console.error("[senhas/id PATCH]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    await exec(`DELETE FROM senhas_cofre WHERE id = $1`, [Number(id)]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[senhas/id DELETE]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}
