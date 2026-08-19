import { NextResponse } from "next/server";
import { getClientePagamentos } from "@/lib/groow/queries";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const pagamentos = await getClientePagamentos(Number(id));
    return NextResponse.json({ pagamentos });
  } catch (err) {
    console.error("[admin/clientes/[id]/pagamentos]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}
