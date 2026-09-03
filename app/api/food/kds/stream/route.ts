import { type NextRequest } from "next/server";
import { revisaoKds } from "@/lib/food-kds";
import { autenticarDispositivo } from "@/lib/food-dispositivo";

// ============================================================================
// Canal de tempo real do KDS (SSE).
//
// Por que SSE e não WebSocket: passa em qualquer proxy e em qualquer roteador
// de bar, o navegador reconecta sozinho e não precisa de infraestrutura nova.
//
// O canal NÃO manda o estado: manda só a REVISÃO. Quando ela muda, a tela busca
// o estado completo em /api/food/kds. É isso que garante que uma queda de
// conexão nunca perde um ticket: quem manda é sempre o fetch inteiro.
//
// A conexão se encerra sozinha aos 10 minutos para o cliente reciclar, e manda
// um comentário de heartbeat a cada 20 segundos para o proxy não derrubar.
// ============================================================================

export const dynamic = "force-dynamic";

const INTERVALO_MS = 2000;
const HEARTBEAT_MS = 20000;
const VIDA_MS = 10 * 60 * 1000;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  // o canal so aceita aparelho JA pareado: pareamento acontece no GET do estado
  const auth = await autenticarDispositivo(req, url.searchParams.get("token"));
  const d = auth.disp;
  if (!d) return new Response("dispositivo", { status: 404 });

  const enc = new TextEncoder();
  let parar = false;

  const stream = new ReadableStream({
    async start(controle) {
      const manda = (evento: string, dado: unknown) => {
        try {
          controle.enqueue(enc.encode(`event: ${evento}\ndata: ${JSON.stringify(dado)}\n\n`));
        } catch {
          parar = true;
        }
      };

      // 3 segundos de espera antes de o navegador tentar de novo, se cair
      controle.enqueue(enc.encode("retry: 3000\n\n"));

      let ultima = "";
      try {
        ultima = await revisaoKds(d.loja_id);
      } catch { /* banco tossiu: manda mesmo assim e a tela busca tudo */ }
      manda("rev", { rev: ultima, agora: new Date().toISOString() });

      const nascimento = Date.now();
      let ultimoBatimento = Date.now();

      req.signal?.addEventListener("abort", () => { parar = true; });

      while (!parar) {
        await new Promise((r) => setTimeout(r, INTERVALO_MS));
        if (parar) break;

        if (Date.now() - nascimento > VIDA_MS) {
          manda("fim", { motivo: "reciclando" });
          break;
        }

        try {
          const agora = await revisaoKds(d.loja_id);
          if (agora !== ultima) {
            ultima = agora;
            manda("rev", { rev: agora, agora: new Date().toISOString() });
            ultimoBatimento = Date.now();
            continue;
          }
        } catch {
          // erro de banco não derruba o canal: a tela segue no polling de reserva
        }

        if (Date.now() - ultimoBatimento > HEARTBEAT_MS) {
          try { controle.enqueue(enc.encode(": batendo\n\n")); } catch { break; }
          ultimoBatimento = Date.now();
        }
      }

      try { controle.close(); } catch { /* já fechou */ }
    },
    cancel() {
      parar = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Nginx e afins: não bufferize, senão o evento chega junto no fim
      "X-Accel-Buffering": "no",
    },
  });
}
