import { NextResponse } from "next/server";
import { exec } from "@/lib/groow/db";
import { statusIntegracoes, getSpendMensal, getCampanhas30d, getIgResumo } from "@/lib/groow/meta-marketing";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET → status das integrações + dados (quando conectado)
export async function GET() {
  const status = statusIntegracoes();
  const out: Record<string, unknown> = { status };

  if (status.metaAds) {
    try { out.campanhas = await getCampanhas30d(); }
    catch (err) { out.campanhasErro = err instanceof Error ? err.message : "erro"; }
  }
  if (status.instagram) {
    try { out.instagram = await getIgResumo(); }
    catch (err) { out.instagramErro = err instanceof Error ? err.message : "erro"; }
  }
  return NextResponse.json(out);
}

// POST { acao: "sync_spend" } → puxa gasto mensal da Meta e grava em trafego_investimentos
export async function POST(req: Request) {
  let body: { acao?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (body.acao !== "sync_spend") return NextResponse.json({ error: "Ação inválida" }, { status: 400 });

  try {
    const meses = await getSpendMensal(3);
    for (const m of meses) {
      await exec(
        `INSERT INTO trafego_investimentos (canal, mes, valor) VALUES ('meta_ads', ?, ?)
         ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
        [m.mes, Math.round(m.valor * 100) / 100]
      );
    }
    return NextResponse.json({ ok: true, meses: meses.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao sincronizar";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
