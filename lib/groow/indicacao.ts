/**
 * Peças compartilhadas entre a landing pública /p/[codigo], a API de captura e
 * os painéis. Fica separado de parceiros.ts porque isto aqui é chamado por
 * rota pública e não deve arrastar o motor de comissão junto.
 */
import { createHash } from "node:crypto";

/** Número do WhatsApp da agência, só dígitos com DDI. */
export function numeroWhatsAppPublico(): string {
  return (process.env.WHATSAPP_NUMERO_PUBLICO || "").replace(/\D/g, "");
}

/** Base pública do hub, usada para montar o link que o parceiro copia. */
export function baseUrlPublica(): string {
  const raw = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://enderecodigital.tech";
  return raw.replace(/\/+$/, "");
}

export function linkDeIndicacao(codigo: string): string {
  return `${baseUrlPublica()}/p/${codigo}`;
}

/**
 * Texto que o prospect envia ao clicar em "chamar no WhatsApp". O sufixo com o
 * código é o que permite atribuir a conversa ao parceiro depois.
 */
export function textoWhatsApp(codigo: string, nomeParceiro: string): string {
  const primeiro = nomeParceiro.trim().split(/\s+/)[0] || nomeParceiro;
  return `Oi! Vim pela indicação do ${primeiro} e quero entender o diagnóstico. (cod: ${codigo})`;
}

export function linkWhatsApp(codigo: string, nomeParceiro: string): string | null {
  const numero = numeroWhatsAppPublico();
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(textoWhatsApp(codigo, nomeParceiro))}`;
}

/** Extrai o código de indicação de uma mensagem recebida. */
export function extrairCodigo(texto: string): string | null {
  const m = String(texto || "").match(/\(?\s*cod\s*[:=]\s*([a-z0-9-]{3,32})\s*\)?/i);
  return m ? m[1].toLowerCase() : null;
}

/** IP nunca é gravado cru: só o hash, o suficiente para deduplicar clique. */
export function hashIp(ip: string): string {
  return createHash("sha256").update(`ed-parceiro:${ip}`).digest("hex").slice(0, 64);
}

const BOT_RE = /bot|crawler|spider|preview|facebookexternalhit|whatsapp|slackbot|telegrambot|discordbot|embedly|curl|wget|python-requests|headless/i;

/** Prefetch do Next e scanner de link do WhatsApp não podem virar clique. */
export function ehBot(userAgent: string | null): boolean {
  if (!userAgent) return true;
  return BOT_RE.test(userAgent);
}
