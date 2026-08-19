// Importação em massa de leads (colar uma lista). Cada linha:
//   nome | whatsapp | nicho | cidade | notas
// Só o nome é obrigatório. Dedup por número (últimos 8 dígitos) pra não duplicar
// quem já está no funil. Origem 'prospeccao' por padrão.
import { NextRequest, NextResponse } from "next/server";
import { query, exec, garantirColuna } from "@/lib/groow/db";
import { normalizarNumeroBR } from "@/lib/groow/whatsapp";

export const dynamic = "force-dynamic";

interface LinhaLead { nome: string; whatsapp?: string; setor?: string; cidade?: string; notas?: string; empresa?: string }

function parseTexto(texto: string): LinhaLead[] {
  return texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const p = l.split("|").map((x) => x.trim());
      return { nome: p[0] || "", whatsapp: p[1] || "", setor: p[2] || "", cidade: p[3] || "", notas: p[4] || "" };
    })
    .filter((l) => l.nome);
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { texto?: string; linhas?: LinhaLead[] };
  const linhas = body.linhas?.length ? body.linhas : parseTexto(body.texto ?? "");
  if (!linhas.length) return NextResponse.json({ error: "Nada pra importar. Cole ao menos uma linha com o nome." }, { status: 400 });

  try {
    await garantirColuna("leads", "notas", "TEXT NULL");
    // números já no banco pra dedup
    const existentes = await query<{ telefone: string | null; whatsapp: string | null }>(
      `SELECT telefone, ${await temWhatsapp() ? "whatsapp" : "NULL AS whatsapp"} FROM leads`
    );
    const jaTem = new Set<string>();
    for (const e of existentes) {
      for (const raw of [e.telefone, e.whatsapp]) {
        const n = (raw || "").replace(/\D/g, "");
        if (n.length >= 8) jaTem.add(n.slice(-8));
      }
    }

    let importados = 0, pulados = 0;
    for (const l of linhas) {
      const num = normalizarNumeroBR(l.whatsapp ?? "");
      const nucleo = num ? num.slice(-8) : "";
      if (nucleo && jaTem.has(nucleo)) { pulados++; continue; }
      await exec(
        `INSERT INTO leads (nome, empresa, telefone, setor, cidade, notas, origem, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'prospeccao', 'novo')`,
        [l.nome.slice(0, 120), (l.empresa || l.nome).slice(0, 160), num || null, (l.setor || "").slice(0, 80) || null, (l.cidade || "").slice(0, 80) || null, (l.notas || "").slice(0, 2000) || null]
      );
      if (nucleo) jaTem.add(nucleo);
      importados++;
    }
    return NextResponse.json({ ok: true, importados, pulados });
  } catch (err) {
    console.error("[leads/importar]", err);
    return NextResponse.json({ error: "Erro ao importar." }, { status: 500 });
  }
}

async function temWhatsapp(): Promise<boolean> {
  try {
    const { getColumns } = await import("@/lib/groow/queries");
    return (await getColumns("leads")).has("whatsapp");
  } catch { return false; }
}
