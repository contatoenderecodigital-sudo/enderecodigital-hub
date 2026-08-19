import { NextResponse } from "next/server";
import { query, exec } from "@/lib/groow/db";
import { statsDaCampanha, type WaCampanha } from "@/lib/groow/wa-campanhas";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const rows = await query<WaCampanha>(`SELECT * FROM wa_campanhas WHERE id = $1 LIMIT 1`, [Number(id)]);
    if (!rows[0]) return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });
    const stats = await statsDaCampanha(Number(id));
    const destinatarios = await query(
      `SELECT id, whatsapp, nome, status, erro, to_char(enviado_em,'DD/MM HH24:MI') AS enviado_em
       FROM wa_campanha_destinatarios WHERE campanha_id = $1
       ORDER BY FIELD(status,'falha','respondeu','lido','entregue','enviado','pendente','optout'), id
       LIMIT 500`,
      [Number(id)]
    );
    return NextResponse.json({ campanha: rows[0], stats, destinatarios });
  } catch (err) {
    console.error("[wa-campanhas/id]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: { acao?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  try {
    const rows = await query<WaCampanha>(`SELECT * FROM wa_campanhas WHERE id = $1 LIMIT 1`, [Number(id)]);
    const c = rows[0];
    if (!c) return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });

    if (body.acao === "iniciar") {
      if (c.status === "concluida") return NextResponse.json({ error: "Campanha já concluída" }, { status: 400 });
      await exec(`UPDATE wa_campanhas SET status = 'enviando' WHERE id = $1`, [Number(id)]);
    } else if (body.acao === "pausar") {
      await exec(`UPDATE wa_campanhas SET status = 'pausada' WHERE id = $1`, [Number(id)]);
    } else if (body.acao === "retomar") {
      await exec(`UPDATE wa_campanhas SET status = 'enviando' WHERE id = $1`, [Number(id)]);
    } else {
      return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[wa-campanhas/id]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    await exec(`DELETE FROM wa_campanhas WHERE id = $1`, [Number(id)]); // cascade apaga destinatários
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[wa-campanhas/id]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}
