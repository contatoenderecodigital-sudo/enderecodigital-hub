import { NextResponse } from "next/server";
import {
  getParceiro,
  listarLeadsDoParceiro,
  listarComissoes,
  painelDoParceiro,
} from "@/lib/groow/parceiros";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parceiroId = Number(id);
  if (!Number.isInteger(parceiroId) || parceiroId <= 0) {
    return NextResponse.json({ error: "Id inválido." }, { status: 400 });
  }

  const parceiro = await getParceiro(parceiroId);
  if (!parceiro) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });

  const [leads, comissoes, painel] = await Promise.all([
    listarLeadsDoParceiro(parceiroId),
    listarComissoes(parceiroId),
    painelDoParceiro(parceiroId),
  ]);

  return NextResponse.json({ parceiro, leads, comissoes, painel });
}
