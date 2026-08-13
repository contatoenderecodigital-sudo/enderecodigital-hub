import { NextResponse } from "next/server";
import { criarLeadPorToken } from "@/lib/data";

// Endpoint PUBLICO de captura de lead (roda no site do cliente, outra origem -> CORS).
// Resolve o tenant pelo token; cria o lead na 1a etapa do funil daquele tenant.
function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors() });
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  let token = url.searchParams.get("token") || "";
  let nome = "";
  let telefone = "";
  let email = "";

  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    token = token || String(b.token || "");
    nome = String(b.nome || "");
    telefone = String(b.telefone || "");
    email = String(b.email || "");
  } else {
    const f = await req.formData().catch(() => null);
    if (f) {
      token = token || String(f.get("token") || "");
      nome = String(f.get("nome") || "");
      telefone = String(f.get("telefone") || "");
      email = String(f.get("email") || "");
    }
  }

  nome = nome.trim();
  if (!token || !nome) {
    return NextResponse.json({ ok: false, erro: "dados" }, { status: 400, headers: cors() });
  }

  const ok = await criarLeadPorToken(token, {
    nome,
    telefone: telefone.trim() || null,
    email: email.trim() || null,
    origem: "site",
  });
  return NextResponse.json({ ok }, { status: ok ? 200 : 404, headers: cors() });
}
