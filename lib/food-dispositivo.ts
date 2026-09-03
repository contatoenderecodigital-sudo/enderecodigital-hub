import "server-only";
import crypto from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { NextResponse, type NextRequest } from "next/server";
import { query } from "./db";

// ============================================================================
// PAREAMENTO DO APARELHO.
//
// Antes: o token do tablet vivia na URL (/k/<token>). Ficava no histórico do
// navegador, saía em qualquer print e vazava para quem olhasse a barra de
// endereço. Era a senha da casa passeando à vista.
//
// Agora o link serve UMA VEZ, para casar o aparelho:
//   1. o dono abre o link no tablet da cozinha;
//   2. o servidor grava o pareamento e devolve um passe em cookie httpOnly de
//      um ano, assinado com um segredo daquele aparelho;
//   3. o token da URL para de valer na hora. Se alguém fotografar a tela
//      depois, leva um endereço morto;
//   4. desparear troca o segredo, e todo cookie daquele aparelho morre junto.
//
// A conta que isso fecha: a cozinha nunca vê tela de login, e mesmo assim a
// credencial não anda mais escrita na tela.
// ============================================================================

export const COOKIE_DISPOSITIVO = "ed_food_disp";
const ANOS = 1;
const AUDIENCIA = "food-dispositivo";

export interface DispositivoFood {
  id: string;
  negocio_id: string;
  loja_id: string;
  area_id: string | null;
  tipo: string;
  nome: string;
  loja_nome: string;
  area_nome: string | null;
}

interface PasseDispositivo {
  d: string;   // id do dispositivo
  s: string;   // segredo do aparelho no momento do pareamento
}

function chave(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET ausente");
  return new TextEncoder().encode(s);
}

async function assinar(p: PasseDispositivo): Promise<string> {
  return new SignJWT({ ...p })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(AUDIENCIA)
    .setIssuedAt()
    .setExpirationTime(`${ANOS * 365}d`)
    .sign(chave());
}

async function ler(token: string | undefined | null): Promise<PasseDispositivo | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, chave(), { audience: AUDIENCIA });
    const p = payload as unknown as PasseDispositivo;
    return p?.d && p?.s ? p : null;
  } catch {
    return null;
  }
}

const SELECT_DISP = `
  SELECT d.id, d.negocio_id, d.loja_id, d.area_id, d.tipo, d.nome,
         d.segredo, d.parear_ate, d.pareado_em,
         l.nome AS loja_nome, a.nome AS area_nome
    FROM food_dispositivos d
    JOIN food_lojas l ON l.id = d.loja_id
    LEFT JOIN food_areas a ON a.id = d.area_id`;

type LinhaDisp = DispositivoFood & {
  segredo: string | null; parear_ate: string | null; pareado_em: string | null;
};

function ip(req: NextRequest): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? req.headers.get("x-real-ip") ?? null;
}
function agente(req: NextRequest): string | null {
  return req.headers.get("user-agent")?.slice(0, 200) ?? null;
}

async function registrar(
  d: { negocio_id: string; loja_id: string; id: string } | null,
  tipo: "pareou" | "recusado" | "desapareado" | "uso_negado",
  req: NextRequest, detalhe?: string
): Promise<void> {
  if (!d) return;
  await query(
    `INSERT INTO food_dispositivo_acessos
       (negocio_id, loja_id, dispositivo_id, tipo, ip, agente, detalhe)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [d.negocio_id, d.loja_id, d.id, tipo, ip(req), agente(req), detalhe ?? null]
  );
}

export interface Autenticacao {
  /** o aparelho, quando reconhecido */
  disp: DispositivoFood | null;
  /** cookie a gravar na resposta (só no pareamento) */
  passe?: string;
  /** por que não entrou, para a tela dizer o que fazer */
  erro?: "sem_aparelho" | "link_expirado" | "link_ja_usado";
}

/**
 * Reconhece o aparelho. Aceita, nesta ordem:
 *   1. o cookie de pareamento (o caminho normal, todo dia);
 *   2. o token da URL, e SÓ enquanto a janela de pareamento estiver aberta.
 */
export async function autenticarDispositivo(
  req: NextRequest, tokenDaUrl: string | null | undefined,
  tiposAceitos?: string[]
): Promise<Autenticacao> {
  // ---- 1. o aparelho já casado
  const passe = await ler(req.cookies.get(COOKIE_DISPOSITIVO)?.value);
  if (passe) {
    const r = await query<LinhaDisp>(
      `${SELECT_DISP} WHERE d.id = $1 AND d.ativo = true`, [passe.d]
    );
    const d = r.rows[0];
    if (d && d.segredo && d.segredo === passe.s) {
      if (tiposAceitos && !tiposAceitos.includes(d.tipo)) return { disp: null, erro: "sem_aparelho" };
      await query("UPDATE food_dispositivos SET ultimo_uso = now() WHERE id = $1", [d.id]);
      return { disp: d };
    }
    // segredo trocado: o dono despareou este aparelho
    if (d) await registrar(d, "uso_negado", req, "passe de aparelho desapareado");
  }

  // ---- 2. o link de pareamento
  if (!tokenDaUrl) return { disp: null, erro: "sem_aparelho" };
  const r = await query<LinhaDisp>(
    `${SELECT_DISP} WHERE d.token = $1 AND d.ativo = true`, [tokenDaUrl]
  );
  const d = r.rows[0];
  if (!d) return { disp: null, erro: "sem_aparelho" };
  if (tiposAceitos && !tiposAceitos.includes(d.tipo)) return { disp: null, erro: "sem_aparelho" };

  const janelaAberta = !!d.parear_ate && new Date(d.parear_ate).getTime() > Date.now();
  if (!janelaAberta) {
    await registrar(d, "recusado", req, d.pareado_em ? "link ja usado" : "janela de pareamento vencida");
    return { disp: null, erro: d.pareado_em ? "link_ja_usado" : "link_expirado" };
  }

  // ---- casa o aparelho e fecha a janela atrás dele
  const segredo = crypto.randomBytes(24).toString("base64url");
  await query(
    `UPDATE food_dispositivos
        SET segredo = $2, pareado_em = now(), pareado_ip = $3, pareado_agente = $4,
            parear_ate = NULL, ultimo_uso = now()
      WHERE id = $1`,
    [d.id, segredo, ip(req), agente(req)]
  );
  await registrar(d, "pareou", req, `aparelho casado com ${d.nome}`);
  return { disp: d, passe: await assinar({ d: d.id, s: segredo }) };
}

/** Gruda o passe do aparelho na resposta, quando o pareamento acabou de acontecer. */
export function gravarPasseDispositivo(res: NextResponse, passe: string | undefined): NextResponse {
  if (passe) {
    res.cookies.set(COOKIE_DISPOSITIVO, passe, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ANOS * 365 * 24 * 3600,
    });
  }
  return res;
}

/** A resposta padrão de quem não é um aparelho da casa. */
export function respostaSemAparelho(erro: Autenticacao["erro"]) {
  const mensagem =
    erro === "link_ja_usado"
      ? "Este link já foi usado para parear outro aparelho. Peça um link novo na configuração."
      : erro === "link_expirado"
        ? "O link de pareamento venceu. Gere outro na configuração."
        : "Aparelho não reconhecido. Abra o link de pareamento uma vez neste tablet.";
  return NextResponse.json({ erro: "dispositivo", motivo: erro, mensagem }, { status: 404 });
}

/**
 * Abre uma janela nova de pareamento (o dono clicando em "parear outro
 * aparelho" no painel). Não mexe no segredo: o tablet que já está casado
 * continua funcionando enquanto o novo não entra.
 */
export async function abrirPareamento(
  negocioId: string, dispositivoId: string, horas = 48
): Promise<{ token: string; ate: string }> {
  const r = await query<{ token: string; parear_ate: string }>(
    `UPDATE food_dispositivos
        SET parear_ate = now() + ($3 || ' hours')::interval
      WHERE id = $1 AND negocio_id = $2
      RETURNING token, parear_ate`,
    [dispositivoId, negocioId, String(horas)]
  );
  const linha = r.rows[0];
  if (!linha) throw new Error("Aparelho não encontrado");
  return { token: linha.token, ate: linha.parear_ate };
}

/**
 * Desparear: troca o segredo e derruba TODOS os cookies daquele aparelho de uma
 * vez. É o botão de "perdi o tablet" e o de "demiti o garçom que levou o tablet
 * para casa".
 */
export async function desparear(negocioId: string, dispositivoId: string): Promise<void> {
  await query(
    `UPDATE food_dispositivos
        SET segredo = NULL, pareado_em = NULL, pareado_ip = NULL,
            pareado_agente = NULL, parear_ate = NULL
      WHERE id = $1 AND negocio_id = $2`,
    [dispositivoId, negocioId]
  );
  await query(
    `INSERT INTO food_dispositivo_acessos (negocio_id, loja_id, dispositivo_id, tipo, detalhe)
     SELECT negocio_id, loja_id, id, 'desapareado', 'desapareado pelo painel'
       FROM food_dispositivos WHERE id = $1 AND negocio_id = $2`,
    [dispositivoId, negocioId]
  );
}

/** Os últimos acessos de aparelho da loja, para o dono bater o olho. */
export async function acessosDeAparelho(negocioId: string, lojaId: string) {
  return (await query<{
    tipo: string; nome: string | null; ip: string | null;
    detalhe: string | null; criado_em: string;
  }>(
    `SELECT a.tipo, d.nome, a.ip, a.detalhe, a.criado_em
       FROM food_dispositivo_acessos a
       LEFT JOIN food_dispositivos d ON d.id = a.dispositivo_id
      WHERE a.negocio_id = $1 AND a.loja_id = $2
      ORDER BY a.criado_em DESC LIMIT 50`,
    [negocioId, lojaId]
  )).rows;
}
