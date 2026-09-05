import { NextResponse } from "next/server";
import { horariosPublicos } from "@/lib/agendamento-publico";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const u = new URL(req.url);
  const profissionalId = u.searchParams.get("profissional") || "";
  const data = u.searchParams.get("data") || "";
  const servicoIds = (u.searchParams.get("servicos") || "").split(",").filter(Boolean);
  const horarios = await horariosPublicos(slug, profissionalId, servicoIds, data);
  const headers = { "Cache-Control": "no-store" };
  if (horarios === null) return NextResponse.json({ erro: "dados_inválidos" }, { status: 400, headers });
  return NextResponse.json({ horarios }, { headers });
}
