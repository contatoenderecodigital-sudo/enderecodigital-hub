import { NextResponse } from "next/server";
import { geocodificarCidade } from "@/lib/groow/geocodificar";

// Protegida pelo middleware. O motor vive em lib/, compartilhado com o parceiro.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { cidade?: string };
  const r = await geocodificarCidade(body.cidade || "");
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ opcoes: r.opcoes });
}
