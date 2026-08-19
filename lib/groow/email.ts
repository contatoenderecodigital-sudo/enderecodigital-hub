// Envio de email via Resend (API REST direta, sem SDK).
// Precisa de RESEND_API_KEY no .env.local (domínio verificado no painel do Resend).
// EMAIL_FROM opcional: "Nome <email@dominio>" - senão usa o padrão da agência.

export async function enviarEmail(opts: {
  para: string;
  assunto: string;
  html: string;
  replyTo?: string;
}): Promise<{ ok: boolean; id?: string; erro?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, erro: "RESEND_API_KEY não configurada no .env.local" };
  const from = process.env.EMAIL_FROM || "Endereço Digital <contato@enderecodigital.com>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        from,
        to: [opts.para],
        subject: opts.assunto,
        html: opts.html,
        ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) return { ok: false, erro: data?.message || `Resend retornou ${res.status}` };
    return { ok: true, id: data?.id };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "falha de rede" };
  }
}

/** Texto simples (com \n) vira HTML de email limpo, sem template pesado de marketing. */
export function textoParaHtmlEmail(texto: string): string {
  const esc = texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const paragrafos = esc
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;max-width:560px;">${paragrafos}</div>`;
}
