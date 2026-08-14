import { NextResponse } from "next/server";
import { query, getPool } from "@/lib/groow/db";
import { enviarEmail, textoParaHtmlEmail } from "@/lib/groow/email";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Prospecção por email: dispara pros prospects que o escaneador achou email.
// Regras de proteção da reputação do domínio:
// - máx 50 destinatários por chamada;
// - nunca repete quem já recebeu nos últimos 30 dias (trava anti-spam);
// - intervalo de ~700ms entre envios (limite de taxa do Resend).

async function garantirTabela() {
  await getPool().query(`CREATE TABLE IF NOT EXISTS prospeccao_emails (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    nome_empresa VARCHAR(255) NOT NULL DEFAULT '',
    email VARCHAR(255) NOT NULL,
    assunto VARCHAR(255) NOT NULL DEFAULT '',
    campanha VARCHAR(255) NOT NULL DEFAULT '',
    status ENUM('enviado','erro') NOT NULL DEFAULT 'enviado',
    erro VARCHAR(500) NULL,
    resend_id VARCHAR(80) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_pe_email (email, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}

// GET → histórico recente de envios
export async function GET() {
  try {
    await garantirTabela();
    const envios = await query(
      `SELECT id, nome_empresa, email, assunto, campanha, status, erro,
              DATE_FORMAT(created_at,'%d/%m %H:%i') AS enviado_em
       FROM prospeccao_emails ORDER BY id DESC LIMIT 100`
    );
    return NextResponse.json({ envios });
  } catch (err) {
    console.error("[prospeccao/email GET]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: {
    campanha?: string;
    assunto?: string;
    corpo?: string;
    destinatarios?: { nome?: string; email?: string }[];
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const assunto = (body.assunto || "").trim();
  const corpo = (body.corpo || "").trim();
  const campanha = (body.campanha || "").trim().slice(0, 250);
  const destinatarios = (body.destinatarios ?? [])
    .filter((d) => d.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email))
    .slice(0, 50);

  if (!assunto || !corpo) return NextResponse.json({ error: "Preencha assunto e corpo." }, { status: 400 });
  if (!destinatarios.length) return NextResponse.json({ error: "Nenhum destinatário com email válido." }, { status: 400 });

  try {
    await garantirTabela();

    // trava anti-spam: quem recebeu nos últimos 30 dias não recebe de novo
    const recentes = await query<{ email: string }>(
      `SELECT DISTINCT email FROM prospeccao_emails
       WHERE status = 'enviado' AND created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)`
    );
    const jaContatados = new Set(recentes.map((r) => r.email.toLowerCase()));

    let enviados = 0, pulados = 0, erros = 0;
    const detalhes: { email: string; status: string }[] = [];

    for (const d of destinatarios) {
      const email = d.email!.toLowerCase();
      if (jaContatados.has(email)) { pulados++; detalhes.push({ email, status: "pulado (30d)" }); continue; }
      jaContatados.add(email); // dedup dentro da própria leva também

      const nome = (d.nome || "").trim();
      const corpoFinal = corpo.replace(/\{\{\s*nome\s*\}\}/gi, nome || "tudo bem");
      const r = await enviarEmail({ para: email, assunto, html: textoParaHtmlEmail(corpoFinal) });

      await query(
        `INSERT INTO prospeccao_emails (nome_empresa, email, assunto, campanha, status, erro, resend_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [nome.slice(0, 250), email, assunto.slice(0, 250), campanha, r.ok ? "enviado" : "erro", r.ok ? null : (r.erro ?? "erro").slice(0, 490), r.id ?? null]
      );

      if (r.ok) { enviados++; detalhes.push({ email, status: "enviado" }); }
      else {
        erros++; detalhes.push({ email, status: `erro: ${r.erro}` });
        // chave ausente/domínio não verificado: não adianta insistir nos próximos
        if (/RESEND_API_KEY|not verified|401|403/i.test(r.erro ?? "")) {
          return NextResponse.json({ error: r.erro, enviados, pulados, erros, detalhes }, { status: 502 });
        }
      }
      await new Promise((res) => setTimeout(res, 700));
    }

    return NextResponse.json({ ok: true, enviados, pulados, erros, detalhes });
  } catch (err) {
    console.error("[prospeccao/email POST]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}
