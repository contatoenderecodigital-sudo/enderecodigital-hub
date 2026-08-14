import { NextResponse } from "next/server";
import { ADMIN_COOKIE, signToken } from "@/lib/groow/auth";
import { hashPassword, verifyPasswordFull } from "@/lib/groow/password";
import { query, exec } from "@/lib/groow/db";
import { excedeuLimite, ipDoRequest, respostaLimite } from "@/lib/groow/ratelimit";
import { apiError } from "@/lib/groow/http";

// Login é alvo clássico de força bruta: 8 tentativas por IP a cada 10 min.
const LIMITE = { max: 8, janelaSeg: 600 };

export async function POST(request: Request) {
  const ip = ipDoRequest(request);
  if (excedeuLimite(`login:${ip}`, LIMITE)) {
    return respostaLimite(LIMITE.janelaSeg);
  }

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const password = String(body.password || "");
  if (!password) {
    return NextResponse.json({ error: "Senha obrigatória" }, { status: 400 });
  }

  // Busca hash do banco (se a senha foi trocada no perfil)
  let dbHash: string | null = null;
  try {
    const rows = await query<{ senha_hash: string | null }>(
      `SELECT senha_hash FROM admin_perfil WHERE id = 1 LIMIT 1`
    );
    dbHash = rows[0]?.senha_hash ?? null;
  } catch { /* tabela pode não existir ainda */ }

  const { ok, needsUpgrade } = await verifyPasswordFull(password, dbHash);
  if (!ok) {
    return NextResponse.json({ error: "Senha incorreta" }, { status: 401 });
  }

  // Migra hash legado (SHA-256) ou grava o primeiro hash a partir da env.
  if (needsUpgrade) {
    try {
      const novo = await hashPassword(password);
      await exec(`INSERT IGNORE INTO admin_perfil (id, nome) VALUES (1, 'Admin')`);
      await exec(`UPDATE admin_perfil SET senha_hash = ? WHERE id = 1`, [novo]);
    } catch (err) {
      // não impede o login - só registra
      apiError("auth:upgrade-hash", err);
    }
  }

  const token = await signToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: ADMIN_COOKIE.name,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_COOKIE.maxAge,
  });
  return res;
}
