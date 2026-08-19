import { NextResponse } from "next/server";
import { query, exec } from "@/lib/groow/db";
import { getAtribuicao } from "@/lib/groow/queries";

export const dynamic = "force-dynamic";

async function tabelaExiste(nome: string): Promise<boolean> {
  const rows = await query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = 'groow' AND table_name = $1`,
    [nome]
  );
  return Number(rows[0]?.n ?? 0) > 0;
}

export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const de = sp.get("de") ?? undefined;   // 'YYYY-MM'
    const ate = sp.get("ate") ?? undefined;

    const canais = await getAtribuicao(de, ate);

    let investimentos: unknown[] = [];
    let utms: unknown[] = [];
    if (await tabelaExiste("trafego_investimentos")) {
      investimentos = await query(
        `SELECT id, canal, mes, valor FROM trafego_investimentos ORDER BY mes DESC, canal LIMIT 120`
      );
    }
    if (await tabelaExiste("utm_links")) {
      utms = await query(
        `SELECT id, nome, url_final, utm_source, utm_medium, utm_campaign,
                to_char(created_at,'DD/MM/YY') AS criado_em
         FROM utm_links ORDER BY id DESC LIMIT 50`
      );
    }
    return NextResponse.json({ canais, investimentos, utms });
  } catch (err) {
    console.error("[trafego]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: {
    acao?: string;
    canal?: string; mes?: string; valor?: number;                          // investimento
    nome?: string; url?: string; source?: string; medium?: string;         // utm
    campaign?: string; content?: string; term?: string;
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  try {
    if (body.acao === "investimento") {
      if (!body.canal || !/^\d{4}-\d{2}$/.test(body.mes ?? "")) {
        return NextResponse.json({ error: "Canal e mês (YYYY-MM) obrigatórios" }, { status: 400 });
      }
      const valor = Math.max(0, Number(body.valor) || 0);
      await exec(
        `INSERT INTO trafego_investimentos (canal, mes, valor) VALUES ($1, $2, $3)
         ON CONFLICT (canal, mes) DO UPDATE SET valor = EXCLUDED.valor`,
        [body.canal, body.mes as string, valor]
      );
      return NextResponse.json({ ok: true });
    }

    if (body.acao === "utm") {
      const url = (body.url ?? "").trim();
      if (!url || !body.source?.trim() || !body.medium?.trim() || !body.campaign?.trim()) {
        return NextResponse.json({ error: "URL, source, medium e campaign são obrigatórios" }, { status: 400 });
      }
      let final: string;
      try {
        const u = new URL(url.startsWith("http") ? url : `https://${url}`);
        u.searchParams.set("utm_source", body.source.trim());
        u.searchParams.set("utm_medium", body.medium.trim());
        u.searchParams.set("utm_campaign", body.campaign.trim());
        if (body.content?.trim()) u.searchParams.set("utm_content", body.content.trim());
        if (body.term?.trim()) u.searchParams.set("utm_term", body.term.trim());
        final = u.toString();
      } catch {
        return NextResponse.json({ error: "URL inválida" }, { status: 400 });
      }
      const r = await exec(
        `INSERT INTO utm_links (nome, url_final, utm_source, utm_medium, utm_campaign, utm_content, utm_term)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [body.nome?.trim() || body.campaign.trim(), final, body.source.trim(), body.medium.trim(), body.campaign.trim(), body.content?.trim() || null, body.term?.trim() || null]
      );
      return NextResponse.json({ ok: true, id: r.insertId, url_final: final });
    }

    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (err) {
    console.error("[trafego]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const utm = sp.get("utm");
    const inv = sp.get("inv");
    if (utm) { await exec(`DELETE FROM utm_links WHERE id = $1`, [Number(utm)]); return NextResponse.json({ ok: true }); }
    if (inv) { await exec(`DELETE FROM trafego_investimentos WHERE id = $1`, [Number(inv)]); return NextResponse.json({ ok: true }); }
    return NextResponse.json({ error: "Nada pra excluir" }, { status: 400 });
  } catch (err) {
    console.error("[trafego]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}
