import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { query, exec } from "@/lib/groow/db";
import { garantirTabelaRelatorios } from "@/lib/groow/relatorios";

export const dynamic = "force-dynamic";

// Relatório white-label mensal por cliente: você preenche os números e o que
// foi feito, o cliente recebe um link bonito com a marca da agência.

const DADOS_INICIAIS = {
  resumo: "",
  metricas: [
    { label: "Leads gerados", valor: "", variacao: "" },
    { label: "Conversas no WhatsApp", valor: "", variacao: "" },
    { label: "Visitas no site", valor: "", variacao: "" },
    { label: "Investimento em anúncios", valor: "", variacao: "" },
  ],
  trabalhos: [] as string[],
  proximos: [] as string[],
};

export async function GET() {
  try {
    await garantirTabelaRelatorios();
    const relatorios = await query(
      `SELECT id, cliente, periodo, token, DATE_FORMAT(updated_at,'%d/%m %H:%i') AS atualizado_em
       FROM relatorios_cliente ORDER BY updated_at DESC LIMIT 200`
    );
    return NextResponse.json({ relatorios });
  } catch (err) {
    console.error("[relatorios GET]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: { cliente?: string; periodo?: string };
  try { body = await req.json(); } catch { body = {}; }
  const cliente = (body.cliente || "").trim() || "Cliente";
  const agora = new Date();
  const periodo = (body.periodo || "").trim() || `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;

  try {
    await garantirTabelaRelatorios();
    const token = randomBytes(16).toString("hex");
    const r = await exec(
      `INSERT INTO relatorios_cliente (cliente, periodo, dados, token) VALUES (?, ?, ?, ?)`,
      [cliente.slice(0, 190), periodo.slice(0, 20), JSON.stringify(DADOS_INICIAIS), token]
    );
    return NextResponse.json({ ok: true, id: r.insertId, token });
  } catch (err) {
    console.error("[relatorios POST]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}
