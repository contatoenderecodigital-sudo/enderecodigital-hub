import { NextResponse, type NextRequest } from "next/server";
import { confirmarJob, proximoJob, temJobPendente } from "@/lib/food";
import { query } from "@/lib/db";

// ============================================================================
// Fila de impressão. Duas formas de consumir, mesma URL:
//
// 1) Star CloudPRNT (impressora sozinha na internet, sem PC no local):
//      POST   -> a impressora pergunta "tem trabalho?"  { jobReady: true }
//      GET    -> ela baixa o texto do próximo job (text/plain)
//      DELETE -> ela confirma que imprimiu
//    Configure na impressora a URL: https://<host>/api/food/print/<chave>
//
// 2) Agente local (impressora antiga na rede da loja, via ESC/POS porta 9100):
//      GET  ?formato=json  -> { id, conteudo } ou 204 quando não há nada
//      POST ?formato=json  -> { id, ok, erro } confirma
//
// A autorização é a CHAVE da impressora na URL. Ela não expõe dado de cliente:
// só devolve o texto da comanda daquela impressora.
// ============================================================================

export const dynamic = "force-dynamic";

// --- CloudPRNT: "tem trabalho?" (e também confirmação do agente local)
export async function POST(req: NextRequest, ctx: { params: Promise<{ chave: string }> }) {
  const { chave } = await ctx.params;
  const url = new URL(req.url);

  if (url.searchParams.get("formato") === "json") {
    const body = await req.json().catch(() => ({}));
    const id = typeof body.id === "string" ? body.id : null;
    if (!id) return NextResponse.json({ erro: "id" }, { status: 400 });
    const feito = await confirmarJob(
      id, body.ok !== false, typeof body.erro === "string" ? body.erro : undefined, chave
    );
    if (!feito) return NextResponse.json({ erro: "job" }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  const pendente = await temJobPendente(chave);
  return NextResponse.json({
    jobReady: pendente,
    mediaTypes: ["text/plain"],
    deleteMethod: "DELETE",
    // a impressora respeita este intervalo entre perguntas (segundos)
    pollInterval: pendente ? 2 : 5,
  });
}

// --- baixa o próximo job
export async function GET(req: NextRequest, ctx: { params: Promise<{ chave: string }> }) {
  const { chave } = await ctx.params;
  const url = new URL(req.url);
  const job = await proximoJob(chave);

  if (url.searchParams.get("formato") === "json") {
    if (!job) return new NextResponse(null, { status: 204 });
    return NextResponse.json(job);
  }

  if (!job) return new NextResponse("", { status: 204 });
  // texto puro: a Star imprime direto e corta no fim.
  return new NextResponse(job.conteudo + "\n\n\n", {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Star-Jobid": job.id,
      "Cache-Control": "no-store",
    },
  });
}

// --- CloudPRNT confirma que imprimiu
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ chave: string }> }) {
  const { chave } = await ctx.params;
  const r = await query<{ id: string }>(
    `SELECT j.id FROM food_print_jobs j
       JOIN food_impressoras i ON i.id = j.impressora_id
      WHERE i.chave = $1 AND j.status = 'entregue'
      ORDER BY j.entregue_em DESC LIMIT 1`,
    [chave]
  );
  const id = r.rows[0]?.id;
  if (id) await confirmarJob(id, true, undefined, chave);
  return new NextResponse(null, { status: 200 });
}
