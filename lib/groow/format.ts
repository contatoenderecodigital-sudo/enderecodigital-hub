/** Formata número de telefone brasileiro: (XX) XXXXX-XXXX */
export function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Conta só os dígitos do telefone */
export function phoneDigits(raw: string): string {
  return (raw || "").replace(/\D/g, "");
}

/**
 * Telefone válido = 10 (fixo) ou 11 (celular) dígitos nacionais,
 * ou já em E.164 BR sem "+": 12/13 dígitos começando com 55.
 */
export function isValidPhone(raw: string): boolean {
  const d = phoneDigits(raw);
  if (d.length === 10 || d.length === 11) return true;
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return true;
  return false;
}

/** Validação simples de email */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
