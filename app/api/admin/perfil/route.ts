import { NextResponse } from "next/server";
import { query, exec } from "@/lib/groow/db";
import { hashPassword } from "@/lib/groow/password";
import { apiError } from "@/lib/groow/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await query<{ nome: string; email: string | null; foto: string | null }>(
      `SELECT nome, email, foto FROM admin_perfil WHERE id = 1 LIMIT 1`
    );
    const p = rows[0] || { nome: "Admin", email: null, foto: null };
    return NextResponse.json({ perfil: { nome: p.nome || "Admin", email: p.email || "", foto: p.foto } });
  } catch {
    // tabela ainda não existe
    return NextResponse.json({ perfil: { nome: "Admin", email: "", foto: null } });
  }
}

export async function PATCH(request: Request) {
  let body: { nome?: string; email?: string; foto?: string; senha?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const sets: string[] = [];
  const vals: (string | null)[] = [];
  if (typeof body.nome === "string") { sets.push("nome = ?"); vals.push(body.nome.trim() || "Admin"); }
  if (typeof body.email === "string") { sets.push("email = ?"); vals.push(body.email.trim() || null); }
  if (typeof body.foto === "string") { sets.push("foto = ?"); vals.push(body.foto || null); }
  if (body.senha && body.senha.length >= 8) {
    const h = await hashPassword(body.senha);
    sets.push("senha_hash = ?"); vals.push(h);
  }
  if (sets.length === 0) return NextResponse.json({ ok: true });

  try {
    // garante a linha id=1
    await exec(`INSERT IGNORE INTO admin_perfil (id, nome) VALUES (1, 'Admin')`);
    await exec(`UPDATE admin_perfil SET ${sets.join(", ")} WHERE id = 1`, vals);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError("perfil:PATCH", err, 500, "Não foi possível salvar o perfil.");
  }
}
