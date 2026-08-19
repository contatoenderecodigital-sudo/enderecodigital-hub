// Aprovação de conteúdo pelo WhatsApp (fase 2 do Blog SEO).
// Fluxo: cron gera rascunho -> manda pro zap do dono (ADMIN_WHATSAPP) ->
// ele responde APROVAR (publica) ou OUTRO (arquiva, gera novo e reenvia).
// Sem ADMIN_WHATSAPP ou sem WhatsApp configurado, tudo degrada em silêncio
// (o rascunho fica esperando aprovação no admin, como sempre).
import { query, exec } from "@/lib/groow/db";
import { SITE_PUBLICO, PAINEL_URL } from "@/lib/groow/constants";
import { isWhatsAppConfigured, sendWhatsAppText } from "@/lib/groow/whatsapp";

export function adminWhatsapp(): string | null {
  const d = (process.env.ADMIN_WHATSAPP || "").replace(/\D/g, "");
  return d.length >= 12 ? d : null;
}

export function aprovacaoAtiva(): boolean {
  return Boolean(adminWhatsapp() && isWhatsAppConfigured());
}

/** Manda o rascunho pro zap do dono pedindo aprovação. Best-effort. */
export async function enviarPedidoAprovacao(post: { id: number; titulo: string; resumo: string; slug: string }): Promise<boolean> {
  const to = adminWhatsapp();
  if (!to || !isWhatsAppConfigured()) return false;
  const msg =
    `Artigo novo esperando tua aprovacao:\n\n` +
    `*${post.titulo}*\n${post.resumo}\n\n` +
    // preview vai pro PAINEL (domínio privado), não pro site público:
    // é lá que se aprova. Só o link do artigo publicado usa o SITE_PUBLICO.
    `Preview: ${PAINEL_URL}/operacao/blog\n\n` +
    `Responde:\n` +
    `*APROVAR* - publica agora no blog\n` +
    `*OUTRO* - descarto esse e gero um novo tema`;
  try {
    await sendWhatsAppText(to, msg);
    return true;
  } catch (err) {
    // fora da janela de 24h a Meta exige template - loga e segue a vida
    console.warn("[aprovacao] nao consegui mandar o zap:", err instanceof Error ? err.message : err);
    return false;
  }
}

export type ComandoAprovacao = "aprovar" | "outro" | null;

export function interpretarComando(texto: string): ComandoAprovacao {
  const t = (texto || "").trim().toLowerCase();
  if (/^(aprovar|aprovo|aprovado|publicar|publica|pode postar|posta)\b/.test(t)) return "aprovar";
  if (/^(outro|gerar outro|gera outro|reprovar|reprovado|nao|não|troca|proximo|próximo)\b/.test(t)) return "outro";
  return null;
}

/** Último rascunho de IA esperando aprovação (o que foi mandado pro zap). */
export async function rascunhoPendente(): Promise<{ id: number; titulo: string; slug: string } | null> {
  const rows = await query<{ id: number; titulo: string; slug: string }>(
    `SELECT id, titulo, slug FROM blog_posts WHERE status = 'rascunho' AND origem = 'ia' ORDER BY id DESC LIMIT 1`
  );
  return rows[0] ?? null;
}

/** Publica o rascunho pendente e devolve a URL. */
export async function aprovarPendente(): Promise<{ ok: boolean; msg: string }> {
  const p = await rascunhoPendente();
  if (!p) return { ok: false, msg: "Nao tem rascunho esperando aprovacao agora." };
  await exec(`UPDATE blog_posts SET status = 'publicado', published_at = COALESCE(published_at, NOW()) WHERE id = $1`, [p.id]);
  return { ok: true, msg: `No ar!\n${p.titulo}\n${SITE_PUBLICO}/blog/${p.slug}` };
}

/** Arquiva o rascunho pendente (o "OUTRO" - a regeneração é disparada à parte). */
export async function descartarPendente(): Promise<{ ok: boolean; msg: string }> {
  const p = await rascunhoPendente();
  if (!p) return { ok: false, msg: "Nao tem rascunho esperando aprovacao agora." };
  await exec(`UPDATE blog_posts SET status = 'arquivado' WHERE id = $1`, [p.id]);
  return { ok: true, msg: "Descartado. Gerando um tema novo, te mando em 1-2 minutos." };
}
