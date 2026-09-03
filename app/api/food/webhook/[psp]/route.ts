import { NextResponse, type NextRequest } from "next/server";
import { query } from "@/lib/db";
import { confirmarPagamentoPSP } from "@/lib/food";
import { pagamentoConfirmadoNoPSP } from "@/lib/food-pix";

// ============================================================================
// Webhook do PSP (Pix). O aviso não é prova de nada: ele traz um id, e a gente
// pergunta ao próprio PSP se aquilo foi pago. Só então a conta é baixada.
//
// Configure no Mercado Pago: https://<host>/api/food/webhook/mercadopago
// ============================================================================

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ psp: string }> }) {
  const { psp } = await ctx.params;
  const url = new URL(req.url);
  const body = await req.json().catch(() => ({} as Record<string, unknown>));

  // Mercado Pago manda { type/action, data: { id } }; alguns eventos vêm por query.
  const pspId =
    (body as { data?: { id?: string | number } })?.data?.id?.toString() ??
    url.searchParams.get("data.id") ??
    url.searchParams.get("id");

  if (!pspId) return NextResponse.json({ ok: true, ignorado: "sem id" });

  // acha o pagamento pendente que estava esperando este id
  const pg = (await query<{ id: string; loja_id: string }>(
    "SELECT id, loja_id FROM food_pagamentos WHERE psp = $1 AND psp_id = $2 AND status = 'pendente'",
    [psp, pspId]
  )).rows[0];
  if (!pg) return NextResponse.json({ ok: true, ignorado: "nao encontrado" });

  const pago = await pagamentoConfirmadoNoPSP(pg.loja_id, pspId);
  if (!pago) return NextResponse.json({ ok: true, status: "ainda nao pago" });

  await confirmarPagamentoPSP(psp, pspId);
  return NextResponse.json({ ok: true, confirmado: true });
}

// alguns provedores validam a URL com um GET antes de ativar
export async function GET() {
  return NextResponse.json({ ok: true });
}
