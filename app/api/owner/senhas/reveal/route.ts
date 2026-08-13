import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { revelarSenha } from "@/lib/ops";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const s = await getSession();
  if (!s || s.papel !== "owner_plataforma")
    return NextResponse.json({ error: "nao_autorizado" }, { status: 401 });
  let body: { id?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "json" }, { status: 400 }); }
  const id = Number(body.id);
  if (!id) return NextResponse.json({ error: "sem id" }, { status: 400 });
  const senha = await revelarSenha(id);
  if (senha === null) return NextResponse.json({ error: "não foi possível abrir (chave trocada?)" }, { status: 500 });
  return NextResponse.json({ senha });
}
