import { NextResponse } from "next/server";
import { query, garantirColuna } from "@/lib/groow/db";

export const dynamic = "force-dynamic";

async function tabelaExiste(nome: string): Promise<boolean> {
  const rows = await query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?`,
    [nome]
  );
  return Number(rows[0]?.n ?? 0) > 0;
}

// Central de aprovações: tudo que está esperando o OK do dono, num lugar só.
// As ações usam as APIs que já existem (blog/[id], social/[id], wa-campanhas/[id]).
export async function GET() {
  try {
    const out: {
      blog: { id: number; titulo: string; resumo: string; criado_em: string; custo_usd?: string | number | null }[];
      social: { id: number; tipo: string; titulo: string; criado_em: string; custo_usd?: string | number | null }[];
      campanhas: { id: number; nome: string; template_nome: string; total: number }[];
    } = { blog: [], social: [], campanhas: [] };

    if (await tabelaExiste("blog_posts")) {
      await garantirColuna("blog_posts", "custo_usd", "DECIMAL(8,4) NULL DEFAULT NULL AFTER origem");
      out.blog = await query(
        `SELECT id, titulo, resumo, custo_usd, DATE_FORMAT(created_at,'%d/%m %H:%i') AS criado_em
         FROM blog_posts WHERE status = 'rascunho' ORDER BY id DESC LIMIT 20`
      );
    }
    if (await tabelaExiste("social_conteudos")) {
      await garantirColuna("social_conteudos", "custo_usd", "DECIMAL(8,4) NULL DEFAULT NULL AFTER hashtags");
      out.social = await query(
        `SELECT id, tipo, titulo, custo_usd, DATE_FORMAT(created_at,'%d/%m %H:%i') AS criado_em
         FROM social_conteudos WHERE status = 'rascunho' ORDER BY id DESC LIMIT 20`
      );
    }
    if (await tabelaExiste("wa_campanhas")) {
      out.campanhas = await query(
        `SELECT c.id, c.nome, c.template_nome,
                (SELECT COUNT(*) FROM wa_campanha_destinatarios d WHERE d.campanha_id = c.id) AS total
         FROM wa_campanhas c WHERE c.status = 'rascunho' ORDER BY c.id DESC LIMIT 10`
      );
    }
    return NextResponse.json(out);
  } catch (err) {
    console.error("[aprovacoes]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}
