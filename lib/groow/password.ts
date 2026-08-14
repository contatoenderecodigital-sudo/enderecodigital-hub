/**
 * Hash e verificação de senha do admin - bcrypt.
 *
 * Mora separado de lib/auth.ts DE PROPÓSITO: o auth.ts é importado pelo
 * middleware, que roda em Edge runtime (sem APIs de Node). bcryptjs só
 * funciona no runtime Node, então fica aqui, importado apenas pelas
 * rotas de API (/api/admin/auth e /api/admin/perfil).
 *
 * Migração automática: hashes antigos (SHA-256 hex, 64 chars) continuam
 * aceitos no login, e a rota de auth regrava em bcrypt no primeiro acesso.
 */
import bcrypt from "bcryptjs";
import { verifyPassword as verifyEnvPassword } from "./auth";

const BCRYPT_ROUNDS = 12;

/** Gera hash bcrypt de uma senha. Usar sempre que gravar senha no banco. */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/** Hash bcrypt tem prefixo $2a$/$2b$/$2y$; o legado SHA-256 é hex puro. */
export function isBcryptHash(hash: string): boolean {
  return /^\$2[aby]\$/.test(hash);
}

/** SHA-256 do esquema antigo - só para reconhecer e migrar hashes legados. */
async function legacySha256(password: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface VerifyResult {
  ok: boolean;
  /** true quando a senha bateu num hash legado e precisa ser regravada em bcrypt */
  needsUpgrade: boolean;
}

/**
 * Verifica a senha contra o hash do banco (bcrypt ou legado) e, como
 * fallback, contra ADMIN_PASSWORD do .env.
 */
export async function verifyPasswordFull(
  input: string,
  dbHash: string | null
): Promise<VerifyResult> {
  if (dbHash) {
    if (isBcryptHash(dbHash)) {
      const ok = await bcrypt.compare(input, dbHash);
      if (ok) return { ok: true, needsUpgrade: false };
    } else {
      // hash legado SHA-256: aceita uma última vez e sinaliza upgrade
      const legacy = await legacySha256(input);
      if (legacy === dbHash) return { ok: true, needsUpgrade: true };
    }
  }
  // fallback: senha da env (primeiro acesso, antes de trocar no perfil)
  if (verifyEnvPassword(input)) return { ok: true, needsUpgrade: !dbHash };
  return { ok: false, needsUpgrade: false };
}
