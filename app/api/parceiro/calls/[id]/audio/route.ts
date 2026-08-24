import { NextResponse } from "next/server";
import { exigirParceiro } from "@/lib/groow/parceiro-sessao";
import { getCall, vincularAudio, getLeadDoParceiro } from "@/lib/groow/parceiros";
import {
  salvarGravacao,
  lerGravacao,
  gravacaoExiste,
  caminhoRelativo,
  extensaoDe,
  nomeDownload,
  LIMITE_BYTES,
} from "@/lib/groow/gravacoes";

export const dynamic = "force-dynamic";

/** Sobe a gravação da ligação e amarra no registro da call. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await exigirParceiro();
  if (!auth.ok) return auth.resposta;

  const { id: idBruto } = await ctx.params;
  const id = Number(idBruto);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Id inválido." }, { status: 400 });
  }

  // getCall já filtra por parceiro_id, então uma call de outro dá 404 aqui.
  const call = await getCall(id, auth.parceiro.id);
  if (!call) return NextResponse.json({ error: "Ligação não encontrada." }, { status: 404 });
  if (call.audio_path) {
    return NextResponse.json({ error: "Essa ligação já tem gravação." }, { status: 409 });
  }

  const form = await req.formData().catch(() => null);
  const arquivo = form?.get("audio");
  if (!(arquivo instanceof File)) {
    return NextResponse.json({ error: "Mande o arquivo no campo 'audio'." }, { status: 400 });
  }

  if (arquivo.size === 0) {
    return NextResponse.json({ error: "A gravação chegou vazia." }, { status: 400 });
  }
  if (arquivo.size > LIMITE_BYTES) {
    return NextResponse.json(
      { error: `Gravação grande demais. O limite é ${Math.round(LIMITE_BYTES / 1024 / 1024)} MB.` },
      { status: 413 }
    );
  }

  const mime = arquivo.type || "audio/webm";
  const ext = extensaoDe(mime);
  if (!ext) {
    return NextResponse.json({ error: `Formato de áudio não aceito: ${mime}` }, { status: 415 });
  }

  const relativo = caminhoRelativo(auth.parceiro.id, id, ext);
  try {
    const bytes = Buffer.from(await arquivo.arrayBuffer());
    const { bytes: gravados } = await salvarGravacao(relativo, bytes);
    await vincularAudio(id, auth.parceiro.id, { path: relativo, mime, bytes: gravados });
    return NextResponse.json({ ok: true, bytes: gravados });
  } catch (err) {
    // Volume não montado ou sem permissão de escrita cai aqui. A ligação já
    // ficou registrada, então o parceiro não perde a anotação, só o áudio.
    console.error("[gravacoes] salvar:", err);
    return NextResponse.json(
      { error: "Não consegui guardar a gravação. A anotação da ligação foi salva." },
      { status: 500 }
    );
  }
}

/** Toca ou baixa a gravação. `?download=1` força o download com nome legível. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await exigirParceiro();
  if (!auth.ok) return auth.resposta;

  const { id: idBruto } = await ctx.params;
  const id = Number(idBruto);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Id inválido." }, { status: 400 });
  }

  const call = await getCall(id, auth.parceiro.id);
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
  const ext = call.audio_path.split(".").pop() || "webm";

  const cabecalhos: Record<string, string> = {
    "Content-Type": call.audio_mime || "audio/webm",
    "Content-Length": String(bytes.byteLength),
    "Cache-Control": "private, max-age=3600",
  };

  if (new URL(req.url).searchParams.get("download") === "1") {
    const lead = call.parceiro_lead_id
      ? await getLeadDoParceiro(call.parceiro_lead_id, auth.parceiro.id)
      : null;
    const nome = nomeDownload(lead?.nome || "lead", call.criado_em, ext);
    cabecalhos["Content-Disposition"] = `attachment; filename="${nome}"`;
  }

  return new Response(new Uint8Array(bytes), { headers: cabecalhos });
}
