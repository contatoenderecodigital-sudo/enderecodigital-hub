import { NextResponse } from "next/server";
import { query, exec, getPool } from "@/lib/groow/db";
import { cifrar } from "@/lib/groow/cofre";

export const dynamic = "force-dynamic";

async function garantirTabela() {
  await getPool().query(`CREATE TABLE IF NOT EXISTS senhas_cofre (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    cliente VARCHAR(200) NOT NULL DEFAULT '',
    servico VARCHAR(200) NOT NULL,
    url VARCHAR(500) NOT NULL DEFAULT '',
    usuario VARCHAR(255) NOT NULL DEFAULT '',
    segredo TEXT NOT NULL,
    notas VARCHAR(500) NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_cofre_cliente (cliente)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}

// GET → lista SEM as senhas (só metadados; revelar é rota própria, 1 por vez)
export async function GET() {
  try {
    await garantirTabela();
    const itens = await query(
      `SELECT id, cliente, servico, url, usuario, notas,
              DATE_FORMAT(updated_at,'%d/%m/%Y') AS atualizado_em
       FROM senhas_cofre ORDER BY cliente, servico LIMIT 500`
    );
    const temChave = !!process.env.SENHAS_CHAVE && process.env.SENHAS_CHAVE.length >= 12;
    return NextResponse.json({ itens, temChave });
  } catch (err) {
    console.error("[senhas GET]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}

// POST → salva credencial nova (senha cifrada antes de tocar o banco)
export async function POST(req: Request) {
  let body: { cliente?: string; servico?: string; url?: string; usuario?: string; senha?: string; notas?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const servico = (body.servico || "").trim();
  const senha = body.senha || "";
  if (!servico || !senha) return NextResponse.json({ error: "Informe pelo menos o serviço e a senha." }, { status: 400 });

  try {
    await garantirTabela();
    const segredo = cifrar(senha);
    const r = await exec(
      `INSERT INTO senhas_cofre (cliente, servico, url, usuario, segredo, notas) VALUES (?, ?, ?, ?, ?, ?)`,
      [(body.cliente || "").trim().slice(0, 190), servico.slice(0, 190), (body.url || "").trim().slice(0, 490), (body.usuario || "").trim().slice(0, 250), segredo, (body.notas || "").trim().slice(0, 490)]
    );
    return NextResponse.json({ ok: true, id: r.insertId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("SENHAS_CHAVE")) return NextResponse.json({ error: msg }, { status: 500 });
    console.error("[senhas POST]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}
