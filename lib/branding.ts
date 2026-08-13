import { headers } from "next/headers";
import { query } from "./db";
import type { Hub } from "./types";

// Marca padrao da plataforma (Endereço Digital: navy + dourado).
export const DEFAULT_BRAND = {
  nome: "Endereço Digital",
  cor_destaque: "#C9A961",
  cor_apoio: "#1B2A4A",
  cor_fundo: "#0B1838",
  cor_texto: "#F5F3EE",
  tema_modo: "escuro" as const,
};

// Resolve o hub pelo host header (multi-hub por dominio). Fallback: 1o hub ativo.
export async function resolveHubByHost(): Promise<Hub | null> {
  let host = "";
  try {
    const h = await headers();
    host = (h.get("host") || "").split(":")[0].toLowerCase();
  } catch {
    host = "";
  }
  if (host) {
    const byDom = await query<Hub>(
      "SELECT * FROM hubs WHERE dominio = $1 AND ativo = true LIMIT 1",
      [host]
    );
    if (byDom.rows[0]) return byDom.rows[0];
  }
  const any = await query<Hub>(
    "SELECT * FROM hubs WHERE ativo = true ORDER BY criado_em ASC LIMIT 1",
    []
  );
  return any.rows[0] ?? null;
}

// Estilo (CSS vars) a partir de um hub (ou do padrao).
export function brandStyle(hub: Hub | null): React.CSSProperties {
  return {
    ["--cor-destaque" as string]: hub?.cor_destaque || DEFAULT_BRAND.cor_destaque,
    ["--cor-apoio" as string]: hub?.cor_apoio || DEFAULT_BRAND.cor_apoio,
    ["--cor-fundo" as string]: hub?.cor_fundo || DEFAULT_BRAND.cor_fundo,
    ["--cor-texto" as string]: hub?.cor_texto || DEFAULT_BRAND.cor_texto,
  } as React.CSSProperties;
}
