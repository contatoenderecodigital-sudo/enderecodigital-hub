import "server-only";
import { SignJWT, jwtVerify } from "jose";
import type { NextResponse } from "next/server";

// ============================================================================
// O PASSE DA MESA.
//
// O problema que isto resolve: o token do cartão NFC é permanente. Quem jantou
// na sexta e copiou a URL do celular podia, no domingo de madrugada, abrir uma
// comanda na mesa 7 e mandar quarenta itens para a impressora da cozinha.
//
// Agora o cartão serve só para ENTRAR. Ao entrar, o servidor emite um passe
// curto (cookie httpOnly, assinado, 12 horas) amarrado a três coisas:
//   - a mesa,
//   - a COMANDA daquele momento,
//   - o celular que entrou.
//
// Pedir, chamar e pagar exigem o passe. Quando a conta fecha, a comanda morre e
// nasce outra com id novo: o passe antigo deixa de valer sozinho, sem precisar
// de lista de revogação. É por isso que o id da comanda vai dentro dele.
// ============================================================================

export const COOKIE_MESA = "ed_food_mesa";
const HORAS = 12;
const AUDIENCIA = "food-mesa";

export interface PasseMesa {
  /** id da comanda (food_sessoes) */
  s: string;
  /** id da mesa (food_mesas) */
  m: string;
  /** id do membro (food_sessao_membros): quem pediu cada item */
  b: string;
  /** device id gerado no navegador */
  d: string;
}

function segredo(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET ausente");
  return new TextEncoder().encode(s);
}

export async function assinarPasse(p: PasseMesa): Promise<string> {
  return new SignJWT({ ...p })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(AUDIENCIA)
    .setIssuedAt()
    .setExpirationTime(`${HORAS}h`)
    .sign(segredo());
}

export async function lerPasse(token: string | undefined | null): Promise<PasseMesa | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, segredo(), { audience: AUDIENCIA });
    const p = payload as unknown as PasseMesa;
    return p?.s && p?.m ? p : null;
  } catch {
    return null;   // expirado, adulterado ou de outro ambiente
  }
}

/** Gruda o passe na resposta. httpOnly: o JavaScript da página não lê. */
export function gravarPasse(res: NextResponse, token: string): void {
  res.cookies.set(COOKIE_MESA, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: HORAS * 3600,
  });
}

export function apagarPasse(res: NextResponse): void {
  res.cookies.set(COOKIE_MESA, "", { path: "/", maxAge: 0 });
}
