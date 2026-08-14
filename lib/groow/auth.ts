const COOKIE_NAME = "admin_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

function getSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 24) {
    throw new Error(
      "ADMIN_SESSION_SECRET ausente ou curto (precisa de ao menos 24 chars). Define no .env.local."
    );
  }
  return secret;
}

function getAdminPassword(): string {
  const p = process.env.ADMIN_PASSWORD;
  if (!p || p.length < 8) {
    throw new Error(
      "ADMIN_PASSWORD ausente ou curto (mínimo 8 chars). Define no .env.local."
    );
  }
  return p;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmac(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return toHex(sig);
}

/** Compara a senha com ADMIN_PASSWORD do .env (fallback de primeiro acesso). */
export function verifyPassword(input: string): boolean {
  try {
    return constantTimeEqual(input, getAdminPassword());
  } catch {
    return false;
  }
}

// hashPassword/verifyPasswordFull agora vivem em lib/password.ts (bcrypt).
// Este arquivo é importado pelo middleware, que roda em Edge runtime e não
// suporta bcrypt - por isso a separação.

export async function signToken(): Promise<string> {
  const payload = String(Date.now());
  const sig = await hmac(getSecret(), payload);
  return `${payload}.${sig}`;
}

export async function verifyToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return false;
    const expected = await hmac(getSecret(), payload);
    if (!constantTimeEqual(sig, expected)) return false;
    const issued = Number(payload);
    if (!Number.isFinite(issued)) return false;
    const ageSec = (Date.now() - issued) / 1000;
    return ageSec >= 0 && ageSec <= COOKIE_MAX_AGE;
  } catch {
    return false;
  }
}

export const ADMIN_COOKIE = {
  name: COOKIE_NAME,
  maxAge: COOKIE_MAX_AGE,
};
