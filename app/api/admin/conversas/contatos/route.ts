// Buscador unificado de contatos pra iniciar conversa no WhatsApp.
// Puxa de leads (que já inclui os prospects importados) e de clientes,
// dedup por número. Usado pelo modal "Nova conversa".
//
// Cada tabela roda no seu próprio try: se uma falhar (ex.: coluna que não
// existe naquele banco), a outra ainda responde, e o erro volta pro front em
// vez de sumir num "nenhum contato" enganoso.
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/groow/db";
import { construtorSql } from "@/lib/groow/sql";
import { getColumns } from "@/lib/groow/queries";
import { normalizarNumeroBR } from "@/lib/groow/whatsapp";

export const dynamic = "force-dynamic";

interface Contato {
  nome: string;
  whatsapp: string;   // normalizado (só dígitos com DDI)
  origem: "lead" | "cliente";
  detalhe: string;    // ramo/empresa/cidade pra diferenciar homônimos
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const like = `%${q}%`;
  const contatos: Contato[] = [];
  const erros: string[] = [];

  // ── LEADS (inclui prospecção importada) ──────────────────────────────────
  // A tabela leads varia de schema entre bancos (a coluna de telefone pode ser
  // whatsapp, telefone, phone ou celular, e setor/cidade podem não existir).
  // Monta a query só com as colunas que realmente existem pra nunca quebrar.
  try {
    const cols = await getColumns("leads");
    const phoneCols = ["whatsapp", "telefone", "phone", "celular"].filter((c) => cols.has(c));
    if (phoneCols.length === 0) {
      erros.push("leads: nenhuma coluna de telefone (whatsapp/telefone/phone/celular)");
    } else {
      const tem = (c: string) => cols.has(c);
      const sel = [
        tem("nome") ? "nome" : "'' AS nome",
        tem("empresa") ? "empresa" : "NULL AS empresa",
        tem("setor") ? "setor" : "NULL AS setor",
        tem("cidade") ? "cidade" : "NULL AS cidade",
        ...phoneCols, // cada coluna de telefone existente, pelo próprio nome
      ].join(", ");
      const phoneNotEmpty = phoneCols.map((c) => `COALESCE(${c},'') <> ''`).join(" OR ");
      const buscaveis = [tem("nome") ? "nome" : null, tem("empresa") ? "empresa" : null, ...phoneCols].filter(Boolean) as string[];
      // ILIKE: no Postgres o LIKE é sensível a maiúscula, e a busca de contato
      // sempre foi case-insensitive (no MySQL quem cuidava era o collation).
      const { p, params } = construtorSql();
      const whereBusca = q ? ` AND (${buscaveis.map((c) => `${c} ILIKE ${p(like)}`).join(" OR ")})` : "";

      const leads = await query<Record<string, string | null>>(
        `SELECT ${sel} FROM leads WHERE (${phoneNotEmpty})${whereBusca} ORDER BY id DESC LIMIT 1000`,
        params
      );
      for (const l of leads) {
        const bruto = phoneCols.map((c) => l[c]).find((v) => v && String(v).trim()) || "";
        const num = normalizarNumeroBR(String(bruto));
        if (!num) continue;
        contatos.push({
          nome: (l.nome || l.empresa || "Sem nome")!.toString().trim(),
          whatsapp: num,
          origem: "lead",
          detalhe: [l.empresa, l.setor, l.cidade].filter(Boolean).join(" · "),
        });
      }
    }
  } catch (err) {
    console.error("[conversas/contatos] leads:", err);
    erros.push("leads: " + (err instanceof Error ? err.message : "erro"));
  }

  // ── CLIENTES ─────────────────────────────────────────────────────────────
  try {
    const { p: pc, params: paramsCli } = construtorSql();
    const clientes = await query<{ empresa: string | null; responsavel: string | null; whatsapp: string | null }>(
      `SELECT empresa, responsavel, whatsapp
       FROM clientes
       WHERE COALESCE(whatsapp,'') <> ''
         ${q ? `AND (empresa ILIKE ${pc(like)} OR responsavel ILIKE ${pc(like)} OR whatsapp ILIKE ${pc(like)})` : ""}
       ORDER BY empresa ASC LIMIT 1000`,
      paramsCli
    );
    for (const c of clientes) {
      const num = normalizarNumeroBR(c.whatsapp || "");
      if (!num) continue;
      contatos.push({
        nome: (c.responsavel || c.empresa || "Cliente").trim(),
        whatsapp: num,
        origem: "cliente",
        detalhe: c.empresa || "",
      });
    }
  } catch (err) {
    console.error("[conversas/contatos] clientes:", err);
    erros.push("clientes: " + (err instanceof Error ? err.message : "erro"));
  }

  // dedup por número: cliente ganha do lead (é o vínculo mais forte)
  const porNumero = new Map<string, Contato>();
  for (const c of contatos) {
    const existente = porNumero.get(c.whatsapp);
    if (!existente || (existente.origem === "lead" && c.origem === "cliente")) {
      porNumero.set(c.whatsapp, c);
    }
  }
  const lista = Array.from(porNumero.values()).slice(0, 500);
  return NextResponse.json({ contatos: lista, total: porNumero.size, ...(erros.length ? { erro: erros.join(" | ") } : {}) });
}
