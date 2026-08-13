import { NextResponse } from "next/server";
import { getSession, setSession } from "@/lib/auth";

// Owner sai do workspace do cliente (limpa a impersonacao) e volta ao console.
export async function GET(req: Request) {
  const s = await getSession();
  if (s && s.papel === "owner_plataforma") {
    await setSession({ ...s, imp: null });
  }
  return NextResponse.redirect(new URL("/owner/clientes", req.url));
}
