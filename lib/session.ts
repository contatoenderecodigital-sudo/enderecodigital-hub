// Sessao assinada (JWT). EDGE-SAFE: usa apenas `jose`, sem pg/bcrypt.
// O middleware importa SOMENTE deste arquivo (roda no edge/runtime leve).
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "ed_hub_session";

export type Papel = "owner_plataforma" | "admin_hub" | "dono" | "operador";

export interface SessionData {
  uid: string;
  email: string;
  papel: Papel;
  negocio_id: string | null;
  hub_id: string | null;
  // negocio_id que o OWNER esta "abrindo" (impersonando). So vale pra owner.
  imp?: string | null;
}

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET ausente");
  return new TextEncoder().encode(s);
}

const MAX_AGE = 60 * 60 * 24 * 7; // 7 dias

export async function signSession(data: SessionData): Promise<string> {
  return new SignJWT({ ...data })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
}

export async function verifySession(token: string): Promise<SessionData | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as SessionData;
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE = MAX_AGE;

// Opcoes do cookie de sessao. Dado puro (edge-safe) — usado por route handlers
// que setam o cookie no proprio Response (padrao confiavel p/ set-cookie + redirect).
export function cookieOptions(maxAge: number = MAX_AGE) {
  return {
    httpOnly: true,
    secure: true,
    // "none" garante que o cookie vai em TODA requisicao — inclusive os prefetch
    // do Next (que com "lax" nao carregavam a sessao e quebravam a navegacao).
    sameSite: "none" as const,
    path: "/",
    maxAge,
  };
}
