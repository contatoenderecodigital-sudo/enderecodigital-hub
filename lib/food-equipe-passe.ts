import "server-only";
import { SignJWT, jwtVerify } from "jose";
import type { NextResponse } from "next/server";
import { query } from "./db";
import { pode, type AcaoEquipe } from "./food-permissoes";

// ============================================================================
// O TURNO da equipe: o PIN do garçom deixa de ser enfeite.
//
// Antes, o PIN era conferido uma vez e o resultado ficava no `localStorage` do
// tablet. Toda ação seguinte exigia só o token do dispositivo, que está na URL.
// Quem pegasse o tablet destravado no balcão registrava pagamento em dinheiro
// de R$ 300 que nunca entrou, dava cortesia e fechava mesa escolhendo em nome
// de qual garçom, porque o `garcomId` vinha no corpo da requisição.
//
// Agora o PIN abre um TURNO: uma linha em `food_turnos` e um cookie httpOnly
// assinado. Quem manda em dinheiro é o turno, não o corpo da requisição.
// ============================================================================

export const COOKIE_EQUIPE = "ed_food_equipe";
const HORAS = 14;                 // um turno de bar não passa disso
const AUDIENCIA = "food-equipe";

export interface PasseEquipe {
  /** id do turno (food_turnos) */
  t: string;
  /** id da pessoa (food_equipe) */
  e: string;
  /** nome, para a trilha de auditoria não precisar de join */
  n: string;
  /** papel: gerente, garcom, caixa, cozinha, entregador */
  p: string;
  /** loja */
  l: string;
}

function segredo(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET ausente");
  return new TextEncoder().encode(s);
}

export async function assinarPasseEquipe(p: PasseEquipe): Promise<string> {
  return new SignJWT({ ...p })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(AUDIENCIA)
    .setIssuedAt()
    .setExpirationTime(`${HORAS}h`)
    .sign(segredo());
}

export async function lerPasseEquipe(token: string | undefined | null): Promise<PasseEquipe | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, segredo(), { audience: AUDIENCIA });
    const p = payload as unknown as PasseEquipe;
    return p?.t && p?.e ? p : null;
  } catch {
    return null;
  }
}

export function gravarPasseEquipe(res: NextResponse, token: string): void {
  res.cookies.set(COOKIE_EQUIPE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: HORAS * 3600,
  });
}

export function apagarPasseEquipe(res: NextResponse): void {
  res.cookies.set(COOKIE_EQUIPE, "", { path: "/", maxAge: 0 });
}

/**
 * O passe é assinado, mas o turno pode ter sido fechado no painel enquanto o
 * tablet estava com o cookie na mão. Por isso a conferência bate no banco.
 * Devolve null quando o turno não vale mais.
 */
export async function turnoVivo(p: PasseEquipe | null, lojaId: string): Promise<PasseEquipe | null> {
  if (!p || p.l !== lojaId) return null;
  const r = await query<{ id: string; papel: string; nome: string }>(
    `SELECT t.id, e.papel, e.nome
       FROM food_turnos t JOIN food_equipe e ON e.id = t.equipe_id
      WHERE t.id = $1 AND t.fechado_em IS NULL AND e.ativo = true AND t.loja_id = $2`,
    [p.t, lojaId]
  );
  const linha = r.rows[0];
  if (!linha) return null;
  await query("UPDATE food_turnos SET ultimo_uso = now() WHERE id = $1", [p.t]);
  // o papel vem do BANCO, não do cookie: promoção e rebaixamento valem na hora
  return { ...p, p: linha.papel, n: linha.nome };
}

export function podeNoTurno(p: PasseEquipe | null, acao: AcaoEquipe): boolean {
  return pode(p?.p, acao);
}
