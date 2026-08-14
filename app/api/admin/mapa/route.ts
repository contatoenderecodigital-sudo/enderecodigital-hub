import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { query, exec } from "@/lib/groow/db";
import { garantirTabelaMapa } from "@/lib/groow/mapa";

export const dynamic = "force-dynamic";

// Template inicial: o ecossistema padrão que a Endereço Digital vende.
// Já nasce apresentável - o dono só adapta pro cliente.
const TEMPLATE = {
  nodes: [
    { id: "t1", x: 40,  y: 60,  titulo: "Anúncio Meta (IG/FB)", tipo: "canal" },
    { id: "t2", x: 40,  y: 200, titulo: "Google / Maps (GBP)",  tipo: "canal" },
    { id: "t3", x: 40,  y: 340, titulo: "Indicação",            tipo: "canal" },
    { id: "t4", x: 340, y: 200, titulo: "Site profissional",    tipo: "etapa" },
    { id: "t5", x: 640, y: 200, titulo: "WhatsApp com IA",      tipo: "ferramenta" },
    { id: "t6", x: 940, y: 200, titulo: "Pipeline de vendas",   tipo: "etapa" },
    { id: "t7", x: 1240, y: 200, titulo: "Cliente fechado",     tipo: "etapa" },
    { id: "t8", x: 1240, y: 380, titulo: "Pós-venda + avaliações", tipo: "nota" },
  ],
  edges: [
    // sem seta de retorno cruzando o mapa: em apresentação, fluxo limpo vende mais
    { de: "t1", para: "t4" }, { de: "t2", para: "t4" }, { de: "t3", para: "t5" },
    { de: "t4", para: "t5" }, { de: "t5", para: "t6" }, { de: "t6", para: "t7" },
    { de: "t7", para: "t8" },
  ],
};

// GET → lista de mapas
export async function GET() {
  try {
    await garantirTabelaMapa();
    const mapas = await query(
      `SELECT id, nome, token, DATE_FORMAT(updated_at,'%d/%m %H:%i') AS atualizado_em
       FROM mapas_ecossistema ORDER BY updated_at DESC LIMIT 100`
    );
    return NextResponse.json({ mapas });
  } catch (err) {
    console.error("[mapa GET]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}

// POST { nome? } → cria mapa novo já com o template
export async function POST(req: Request) {
  let body: { nome?: string };
  try { body = await req.json(); } catch { body = {}; }
  const nome = (body.nome || "").trim() || "Novo mapa";

  try {
    await garantirTabelaMapa();
    const token = randomBytes(16).toString("hex");
    const r = await exec(
      `INSERT INTO mapas_ecossistema (nome, dados, token) VALUES (?, ?, ?)`,
      [nome.slice(0, 190), JSON.stringify(TEMPLATE), token]
    );
    return NextResponse.json({ ok: true, id: r.insertId, token });
  } catch (err) {
    console.error("[mapa POST]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}
