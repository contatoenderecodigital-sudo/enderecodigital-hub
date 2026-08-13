import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import type { Hub, Negocio } from "@/lib/types";

// Seed inicial idempotente. Chame UMA vez:  /api/bootstrap?token=SEU_TOKEN
// Cria: hub "Endereço Digital", usuario owner (env), cliente demo "Padaria Aroma".
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!process.env.BOOTSTRAP_TOKEN || token !== process.env.BOOTSTRAP_TOKEN) {
    return NextResponse.json({ erro: "token invalido" }, { status: 401 });
  }

  const out: Record<string, string> = {};

  // 1) hub Endereço Digital
  let hub = (
    await query<Hub>("SELECT * FROM hubs WHERE slug = 'endereco-digital'")
  ).rows[0];
  if (!hub) {
    hub = (
      await query<Hub>(
        `INSERT INTO hubs
           (nome, slug, tema_modo, cor_destaque, cor_apoio, cor_fundo, cor_texto,
            mod_site, mod_instagram, mod_financeiro, mod_crm, login_titulo, login_botao, descricao)
         VALUES ('Endereço Digital','endereco-digital','escuro','#C9A961','#1B2A4A','#0B1838','#F5F3EE',
                 true, true, false, true, 'Endereço Digital', 'Entrar',
                 'Plataforma da Endereço Digital')
         RETURNING *`
      )
    ).rows[0];
    out.hub = "criado";
  } else {
    out.hub = "existente";
  }

  // 2) owner da plataforma (a partir das envs)
  const oemail = (process.env.OWNER_EMAIL || "").toLowerCase();
  const opass = process.env.OWNER_PASSWORD || "";
  if (oemail && opass) {
    const existe = (
      await query("SELECT id FROM usuarios WHERE papel='owner_plataforma' AND lower(email)=lower($1)", [
        oemail,
      ])
    ).rows[0];
    if (!existe) {
      const h = await hashPassword(opass);
      await query(
        "INSERT INTO usuarios (email, senha_hash, papel) VALUES ($1,$2,'owner_plataforma')",
        [oemail, h]
      );
      out.owner = "criado";
    } else {
      out.owner = "existente";
    }
  } else {
    out.owner = "sem OWNER_EMAIL/OWNER_PASSWORD";
  }

  // 3) cliente demo "Padaria Aroma" (dentro do hub) + login
  let demo = (
    await query<Negocio>("SELECT * FROM negocios WHERE slug = 'padaria-aroma'")
  ).rows[0];
  if (!demo) {
    demo = (
      await query<Negocio>(
        `INSERT INTO negocios
           (hub_id, slug, nome, nome_fantasia, segmento, marca_cor, resp_nome, status)
         VALUES ($1,'padaria-aroma','Padaria Aroma LTDA','Padaria Aroma','Alimentação',
                 '#C0392B','Kemilly','ativo')
         RETURNING *`,
        [hub.id]
      )
    ).rows[0];
    const dh = await hashPassword("aroma123");
    await query(
      "INSERT INTO usuarios (negocio_id, email, senha_hash, papel) VALUES ($1,'aroma@demo.com',$2,'dono')",
      [demo.id, dh]
    );
    out.demo = "criado (login: aroma@demo.com / aroma123)";
  } else {
    out.demo = "existente";
  }

  return NextResponse.json({ ok: true, ...out });
}
