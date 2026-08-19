import { NextResponse } from "next/server";
import { query, exec } from "@/lib/groow/db";
import { gerarPauta } from "@/lib/groow/social-ia";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  try {
    const ideias = await query(
      `SELECT i.id, i.pilar, i.tipo, i.hook, i.descricao, i.formato, i.status,
              to_char(i.created_at,'DD/MM') AS criada_em,
              (SELECT c.id FROM social_conteudos c WHERE c.ideia_id = i.id ORDER BY c.id DESC LIMIT 1) AS conteudo_id
       FROM social_ideias i
       WHERE i.status <> 'descartada'
       ORDER BY i.status = 'nova' DESC, i.id DESC LIMIT 300`
    );
    const conteudos = await query(
      `SELECT id, ideia_id, tipo, titulo, status, to_char(created_at,'DD/MM HH24:MI') AS criado_em
       FROM social_conteudos ORDER BY id DESC LIMIT 100`
    );
    return NextResponse.json({ ideias, conteudos });
  } catch (err) {
    console.error("[social]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}

// POST { acao: "pauta", qtd?, observacoes? } → gera ideias novas via IA
export async function POST(req: Request) {
  let body: { acao?: string; qtd?: number; observacoes?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (body.acao !== "pauta") return NextResponse.json({ error: "Ação inválida" }, { status: 400 });

  try {
    const qtd = Math.min(Math.max(Number(body.qtd) || 24, 4), 40);
    const ideias = await gerarPauta(qtd, body.observacoes?.trim() || "");
    if (!ideias.length) return NextResponse.json({ error: "A IA não retornou ideias. Tenta de novo." }, { status: 502 });

    for (const i of ideias) {
      await exec(
        `INSERT INTO social_ideias (pilar, tipo, hook, descricao, formato) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [i.pilar, i.tipo, i.hook.slice(0, 250), i.descricao ?? "", (i.formato ?? "").slice(0, 78)]
      );
    }
    return NextResponse.json({ ok: true, geradas: ideias.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao gerar pauta";
    const conhecido = /ANTHROPIC|401|429|formato inesperado/.test(msg);
    if (!conhecido) console.error("[social pauta]", err);
    return NextResponse.json({ error: conhecido ? msg : "Erro ao processar a requisição." }, { status: 502 });
  }
}
