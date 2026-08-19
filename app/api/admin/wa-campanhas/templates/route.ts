import { NextResponse } from "next/server";
import { getWhatsAppTemplates, type WaTemplate } from "@/lib/groow/whatsapp";

export const dynamic = "force-dynamic";

// cache simples em memória - templates mudam raramente
let cache: { em: number; data: WaTemplate[] } | null = null;
const TTL_MS = 5 * 60 * 1000;

export async function GET() {
  try {
    if (cache && Date.now() - cache.em < TTL_MS) {
      return NextResponse.json({ templates: cache.data, cacheado: true });
    }
    const todos = await getWhatsAppTemplates();
    const aprovados = todos.filter((t) => t.status === "APPROVED");
    cache = { em: Date.now(), data: aprovados };
    return NextResponse.json({ templates: aprovados, total: todos.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao buscar templates";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
