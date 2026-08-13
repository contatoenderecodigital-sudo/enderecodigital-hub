import "server-only";
import type { SessionData } from "./session";

// Qual negocio a sessao pode operar AGORA:
//  - cliente (dono/operador): sempre o proprio negocio_id (nunca outro).
//  - owner_plataforma: apenas o que ele esta impersonando (imp); senao nenhum.
// Toda leitura/escrita de tabela de dado de cliente DEVE filtrar por este id.
export function activeNegocioId(s: SessionData | null): string | null {
  if (!s) return null;
  if (s.papel === "owner_plataforma") return s.imp ?? null;
  return s.negocio_id;
}

export function ehOwner(s: SessionData | null): boolean {
  return s?.papel === "owner_plataforma";
}

// True quando o owner esta dentro do workspace de um cliente (mostra faixa MODO OWNER).
export function estaImpersonando(s: SessionData | null): boolean {
  return !!(s && s.papel === "owner_plataforma" && s.imp);
}
