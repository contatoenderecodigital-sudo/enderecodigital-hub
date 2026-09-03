// ============================================================================
// Alergênicos e restrições no cardápio.
//
// A RDC 727/2022 da Anvisa exige que bar e restaurante informem a presença de
// glúten, lactose, leite, peixe, crustáceos, ovos, soja, amendoim e castanhas,
// ao lado de cada item do cardápio. Não é diferencial de venda: é obrigação do
// restaurante, e cardápio digital sem esse campo deixa o cliente fora da norma.
//
// A sigla existe porque ela precisa caber em três lugares ao mesmo tempo: no
// card do celular, no cartão da cozinha e na comanda impressa em 48 colunas.
// Nada de ícone bonito que a impressora térmica não desenha.
//
// Arquivo puro, sem import de runtime.
// ============================================================================

export interface Alergenico {
  chave: string;
  /** o que aparece no celular do cliente */
  nome: string;
  /** três letras, o que cabe no cartão da cozinha e na comanda impressa */
  sigla: string;
}

export const ALERGENICOS: Alergenico[] = [
  { chave: "gluten", nome: "Glúten", sigla: "GLU" },
  { chave: "lactose", nome: "Lactose", sigla: "LAC" },
  { chave: "leite", nome: "Leite", sigla: "LEI" },
  { chave: "ovo", nome: "Ovo", sigla: "OVO" },
  { chave: "soja", nome: "Soja", sigla: "SOJ" },
  { chave: "peixe", nome: "Peixe", sigla: "PEI" },
  { chave: "crustaceo", nome: "Crustáceos", sigla: "CRU" },
  { chave: "amendoim", nome: "Amendoim", sigla: "AME" },
  { chave: "castanha", nome: "Castanhas e nozes", sigla: "CAS" },
  { chave: "trigo", nome: "Trigo", sigla: "TRI" },
  { chave: "mel", nome: "Mel", sigla: "MEL" },
  { chave: "alcool", nome: "Álcool", sigla: "ALC" },
];

const PORCHAVE = new Map(ALERGENICOS.map((a) => [a.chave, a]));

export function alergenicoValido(chave: string): boolean {
  return PORCHAVE.has(chave);
}

/** Limpa o que veio do navegador: só chaves conhecidas, sem repetir. */
export function limparAlergenicos(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const limpo = [...new Set(v.map(String).filter(alergenicoValido))];
  return limpo.length ? limpo : null;
}

export function nomeDe(chave: string): string {
  return PORCHAVE.get(chave)?.nome ?? chave;
}

export function siglaDe(chave: string): string {
  return PORCHAVE.get(chave)?.sigla ?? chave.slice(0, 3).toUpperCase();
}

/** "Contém glúten, leite e ovo." Para a tela do cliente. */
export function frase(chaves: string[] | null | undefined, prefixo = "Contém"): string | null {
  const lista = (chaves ?? []).filter(alergenicoValido).map(nomeDe);
  if (!lista.length) return null;
  if (lista.length === 1) return `${prefixo} ${lista[0].toLowerCase()}.`;
  const ultimo = lista.pop() as string;
  return `${prefixo} ${lista.join(", ").toLowerCase()} e ${ultimo.toLowerCase()}.`;
}

/** "GLU LAC OVO". Para o cartão da cozinha e para a comanda impressa. */
export function siglas(chaves: string[] | null | undefined): string {
  return (chaves ?? []).filter(alergenicoValido).map(siglaDe).join(" ");
}

/**
 * As marcas positivas do produto, que são argumento de venda e não obrigação.
 * Ficam separadas dos alergênicos de propósito: uma coisa é "contém", outra é
 * "não contém", e a norma trata as duas diferente.
 */
export const MARCAS = [
  { chave: "sem_gluten", nome: "Sem glúten", sigla: "S/GLU" },
  { chave: "sem_lactose", nome: "Sem lactose", sigla: "S/LAC" },
  { chave: "vegetariano", nome: "Vegetariano", sigla: "VEG" },
  { chave: "vegano", nome: "Vegano", sigla: "VGN" },
] as const;
