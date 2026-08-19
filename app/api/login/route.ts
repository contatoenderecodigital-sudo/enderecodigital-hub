import { NextResponse } from "next/server";
import { findUsuariosByEmail } from "@/lib/data";
import { verifyPassword } from "@/lib/auth";
import { signSession, SESSION_COOKIE, cookieOptions } from "@/lib/session";
import { excedeuLimite, ipDoRequest } from "@/lib/groow/ratelimit";

// Redirect com Location RELATIVO: o navegador resolve contra a URL publica.
// (req.url aqui reflete o host interno 0.0.0.0:3000 atras do proxy.)
function redir(path: string): NextResponse {
  return new NextResponse(null, { status: 303, headers: { Location: path } });
}

export async function POST(req: Request) {
  // Agora cada tentativa consulta dois bancos (Postgres + MySQL). Sem freio,
  // isso vira vetor de forca bruta barato.
  if (excedeuLimite(`login:${ipDoRequest(req)}`, { max: 8, janelaSeg: 600 })) {
    return redir("/login?erro=limite");
  }

  const form = await req.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const senha = String(form.get("senha") || "");

  if (!email || !senha) return redir("/login?erro=1");

  // Postgres fora do ar nao pode virar 500 nem trancar o parceiro fora: o
  // fallback do MySQL logo abaixo precisa continuar sendo tentado.
  let usuarios: Awaited<ReturnType<typeof findUsuariosByEmail>> = [];
  try {
    usuarios = await findUsuariosByEmail(email);
  } catch (err) {
    console.error("[login] Postgres indisponivel:", err);
  }

  for (const u of usuarios) {
    if (await verifyPassword(senha, u.senha_hash)) {
      const token = await signSession({
        uid: u.id,
        email: u.email,
        papel: u.papel,
        negocio_id: u.negocio_id,
        hub_id: u.hub_id,
        imp: null,
      });
      const res = redir(u.papel === "owner_plataforma" ? "/owner" : "/login");
      res.cookies.set(SESSION_COOKIE, token, cookieOptions());
      return res;
    }
  }

  // Fallback: parceiro. Mora na tabela `parceiros` do MySQL, nao em `usuarios`
  // do Postgres. O Postgres tem precedencia, entao e-mail duplicado nos dois
  // bancos loga como usuario, nunca como parceiro.
  try {
    const { query } = await import("@/lib/groow/db");
    const { garantirTabelasParceiros } = await import("@/lib/groow/parceiros");
    await garantirTabelasParceiros();
    const rows = await query<{
      id: number;
      email: string;
      senha_hash: string | null;
      status: string;
    }>(
      `SELECT id, email, senha_hash, status FROM parceiros WHERE email = $1 LIMIT 1`,
      [email]
    );
    const p = rows[0];
    // O guard do senha_hash importa: bcrypt.compare com hash null joga excecao.
    // Usa verifyPassword de lib/auth (bcrypt.compare puro) e NUNCA o
    // verifyPasswordFull de lib/groow/password, que aceita ADMIN_PASSWORD como
    // fallback e deixaria qualquer um entrar como qualquer parceiro.
    if (
      p?.senha_hash &&
      p.status === "ativo" &&
      (await verifyPassword(senha, p.senha_hash))
    ) {
      const token = await signSession({
        uid: `parceiro:${p.id}`,
        email: p.email,
        papel: "parceiro",
        negocio_id: null,
        hub_id: null,
        imp: null,
        parceiro_id: p.id,
      });
      const res = redir("/parceiro");
      res.cookies.set(SESSION_COOKIE, token, cookieOptions());
      return res;
    }
  } catch (err) {
    // MySQL fora do ar nao pode derrubar o login do owner.
    console.error("[login] fallback parceiro falhou:", err);
  }

  return redir("/login?erro=1");
}
