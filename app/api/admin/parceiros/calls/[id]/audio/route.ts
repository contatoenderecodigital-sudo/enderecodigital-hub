import { NextResponse } from "next/server";
import { getCallAdmin, getParceiro } from "@/lib/groow/parceiros";
import { lerGravacao, gravacaoExiste, nomeDownload } from "@/lib/groow/gravacoes";

export const dynamic = "force-dynamic";

/**
 * A mesma gravação da ligação, mas pelo meu lado. O middleware já tranca
 * /api/admin para owner_plataforma, então aqui não filtro por parceiro: o
 * ponto de existir esta rota é justamente ouvir as ligações de todo mundo.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: idBruto } = await ctx.params;
  const id = Number(idBruto);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Id inválido." }, { status: 400 });
  }

  const call = await getCallAdmin(id);
  if (!call?.audio_path) {
    return NextResponse.json({ error: "Sem gravação." }, { status: 404 });
  }
  if (!(await gravacaoExiste(call.audio_path))) {
    return NextResponse.json(
      { error: "O arquivo dessa gravação não está mais no disco." },
      { status: 410 }
    );
  }

  const bytes = await lerGravacao(call.audio_path);
  const cabecalhos: Record<string, string> = {
    "Content-Type": call.audio_mime || "audio/webm",
    "Content-Length": String(bytes.byteLength),
    "Cache-Control": "private, max-age=3600",
  };

  if (new URL(req.url).searchParams.get("download") === "1") {
    const ext = call.audio_path.split(".").pop() || "webm";
    const parceiro = await getParceiro(call.parceiro_id);
    const nome = nomeDownload(parceiro?.nome || "parceiro", call.criado_em, ext);
    cabecalhos["Content-Disposition"] = `attachment; filename="${nome}"`;
  }

  return new Response(new Uint8Array(bytes), { headers: cabecalhos });
}
