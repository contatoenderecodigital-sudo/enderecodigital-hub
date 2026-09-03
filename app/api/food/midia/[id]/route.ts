import { NextResponse } from "next/server";
import { lerMidia } from "@/lib/food-edicao";

// Foto do cardápio. Pública de propósito: é a imagem que aparece para o cliente
// na mesa. O id é UUID, então não dá para varrer o acervo dos outros.

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse(null, { status: 404 });
  const m = await lerMidia(id);
  if (!m) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(m.bytes), {
    status: 200,
    headers: {
      "Content-Type": m.mime,
      // a imagem nunca muda: quando o dono troca a foto, nasce outro id
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
