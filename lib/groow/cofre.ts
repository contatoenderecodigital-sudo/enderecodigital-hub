// Cofre de senhas: AES-256-GCM com chave derivada da env SENHAS_CHAVE.
// A senha NUNCA fica em texto puro no banco; sem a env, nada abre.
// Formato gravado: iv.tag.cifrado (base64, separados por ponto).
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

function chave(): Buffer {
  const s = process.env.SENHAS_CHAVE;
  if (!s || s.length < 12) {
    throw new Error("SENHAS_CHAVE não configurada no .env.local (qualquer frase longa serve; se trocar, as senhas já salvas não abrem mais).");
  }
  return createHash("sha256").update(s).digest();
}

export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", chave(), iv);
  const enc = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return [iv.toString("base64"), c.getAuthTag().toString("base64"), enc.toString("base64")].join(".");
}

export function decifrar(blob: string): string {
  const [ivB, tagB, dataB] = blob.split(".");
  if (!ivB || !tagB || !dataB) throw new Error("registro corrompido");
  const d = createDecipheriv("aes-256-gcm", chave(), Buffer.from(ivB, "base64"));
  d.setAuthTag(Buffer.from(tagB, "base64"));
  return Buffer.concat([d.update(Buffer.from(dataB, "base64")), d.final()]).toString("utf8");
}
