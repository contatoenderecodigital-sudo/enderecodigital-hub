import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { desconectar } from "@/lib/wa-conexoes";

// Solta o número do roteador do hub. A partir daqui, mensagem que chegar nele
// é descartada como número desconhecido — que é o comportamento certo: melhor
// não responder do que responder pelo cliente errado.
//
// Não mexe do lado da Meta de propósito. Desassinar a WABA ali é decisão do
// dono da conta, não do painel; e se for só troca de número, desassinar
// atrapalharia. Quem quiser cortar de vez faz no painel da Meta.
export async function POST(req: Request) {
  const s = await getSession();
  if (!s || s.papel !== "owner_plataforma") {
    return NextResponse.json({ erro: "nao_autorizado" }, { status: 401 });
  }
  const { phoneNumberId } = (await req.json().catch(() => ({}))) as { phoneNumberId?: string };
  if (!phoneNumberId) return NextResponse.json({ erro: "sem_numero" }, { status: 400 });

  await desconectar(phoneNumberId);
  return NextResponse.json({ ok: true });
}
