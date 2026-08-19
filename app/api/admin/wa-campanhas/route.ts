import { NextResponse } from "next/server";
import { query, exec } from "@/lib/groow/db";
import { normalizarZapBR, statsDaCampanha, type WaCampanha } from "@/lib/groow/wa-campanhas";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const campanhas = await query<WaCampanha>(`SELECT * FROM wa_campanhas ORDER BY id DESC LIMIT 100`);
    const out = [];
    for (const c of campanhas) {
      out.push({ ...c, stats: await statsDaCampanha(c.id) });
    }
    return NextResponse.json({ campanhas: out });
  } catch (err) {
    console.error("[wa-campanhas]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}

interface NovoDestinatario { whatsapp: string; nome?: string }

export async function POST(req: Request) {
  let body: {
    nome?: string;
    template_nome?: string;
    template_idioma?: string;
    body_params_modo?: string;
    cap_dia?: number;
    janela_inicio?: number;
    janela_fim?: number;
    pular_domingo?: boolean;
    inicio_agendado?: string | null;
    optin_confirmado?: boolean;
    destinatarios?: NovoDestinatario[];
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!body.nome?.trim()) return NextResponse.json({ error: "Dá um nome pra campanha" }, { status: 400 });
  if (!body.template_nome?.trim()) return NextResponse.json({ error: "Escolhe o template aprovado da Meta" }, { status: 400 });
  if (!body.optin_confirmado) {
    return NextResponse.json({ error: "Confirma o opt-in LGPD dos destinatários antes de criar o disparo." }, { status: 400 });
  }
  const lista = Array.isArray(body.destinatarios) ? body.destinatarios : [];
  if (!lista.length) return NextResponse.json({ error: "Nenhum destinatário válido" }, { status: 400 });

  // normaliza + dedup
  const vistos = new Set<string>();
  const validos: { whatsapp: string; nome: string | null }[] = [];
  let invalidos = 0;
  for (const d of lista) {
    const zap = normalizarZapBR(d.whatsapp);
    if (!zap) { invalidos++; continue; }
    if (vistos.has(zap)) continue;
    vistos.add(zap);
    validos.push({ whatsapp: zap, nome: d.nome?.trim() || null });
  }
  if (!validos.length) return NextResponse.json({ error: "Nenhum número válido após normalização" }, { status: 400 });

  const capDia = Math.min(Math.max(Number(body.cap_dia) || 100, 1), 250);
  const jIni = Math.min(Math.max(Number(body.janela_inicio) ?? 9, 0), 23);
  const jFim = Math.min(Math.max(Number(body.janela_fim) ?? 19, jIni + 1), 24);
  const agendado = body.inicio_agendado ? body.inicio_agendado.replace("T", " ").slice(0, 19) : null;

  try {
    const r = await exec(
      `INSERT INTO wa_campanhas (nome, template_nome, template_idioma, body_params_modo, status, cap_dia, janela_inicio, janela_fim, pular_domingo, inicio_agendado, optin_confirmado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1) RETURNING id`,
      [
        body.nome.trim(),
        body.template_nome.trim(),
        body.template_idioma?.trim() || "pt_BR",
        body.body_params_modo === "nome" ? "nome" : "nenhum",
        agendado ? "agendada" : "rascunho",
        capDia, jIni, jFim,
        body.pular_domingo === false ? 0 : 1,
        agendado,
      ]
    );
    const campId = r.insertId;

    // insere destinatários em lotes
    const CHUNK = 200;
    for (let i = 0; i < validos.length; i += CHUNK) {
      const slice = validos.slice(i, i + CHUNK);
      const values = slice.map((_, j) => `($${j * 3 + 1}, $${j * 3 + 2}, $${j * 3 + 3})`).join(",");
      const params = slice.flatMap((d) => [campId, d.whatsapp, d.nome]);
      await exec(
        `INSERT INTO wa_campanha_destinatarios (campanha_id, whatsapp, nome) VALUES ${values}
         ON CONFLICT (campanha_id, whatsapp) DO NOTHING`,
        params
      );
    }

    return NextResponse.json({ ok: true, id: campId, aceitos: validos.length, invalidos });
  } catch (err) {
    console.error("[wa-campanhas]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}
