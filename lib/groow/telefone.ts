/**
 * Telefone guardado é só dígito com DDI ("5549988887766"). Na tela isso é
 * ilegível, e quem vive olhando essa lista é um vendedor conferindo número.
 */
export function formatarTelefone(bruto: string): string {
  const d = String(bruto || "").replace(/\D/g, "");
  const nacional = d.startsWith("55") && d.length >= 12 ? d.slice(2) : d;

  if (nacional.length === 11) {
    return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 7)}-${nacional.slice(7)}`;
  }
  if (nacional.length === 10) {
    return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 6)}-${nacional.slice(6)}`;
  }
  return bruto;
}

/**
 * Máscara de digitação: enquanto ele digita, vira "(49) 99999-9999".
 *
 * Aceita só dígito, corta em 11 e joga fora o DDI quando o valor vem do banco
 * (lá é guardado como "5549988887766"). Celular no Brasil tem 11 com o nono
 * dígito, fixo tem 10, então a máscara muda de forma no meio da digitação.
 */
export function mascaraTelefone(bruto: string): string {
  let d = String(bruto || "").replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  d = d.slice(0, 11);

  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Só os dígitos nacionais, para validar antes de mandar. */
export function digitosTelefone(bruto: string): string {
  let d = String(bruto || "").replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  return d.slice(0, 11);
}

/**
 * Fixo tem 10, celular tem 11 e o primeiro dígito do número precisa ser 9.
 * É esse 9 que some quando alguém copia um número antigo de agenda.
 */
export function telefoneValido(bruto: string): { ok: boolean; motivo?: string } {
  const d = digitosTelefone(bruto);
  if (d.length < 10) return { ok: false, motivo: "Faltam dígitos. Com DDD dá 10 no fixo e 11 no celular." };
  if (d.length === 11 && d[2] !== "9") {
    return { ok: false, motivo: "Número de 11 dígitos precisa começar com 9 depois do DDD." };
  }
  return { ok: true };
}

/**
 * Formato internacional E.164 ("+5549988887766").
 *
 * E o que o campo de telefone do Cal.com exige. Mandando o que a pessoa digitou
 * ("49 99123 4567") ele cai no seletor "International" e recusa com "Numero de
 * telefone invalido", travando o agendamento na ultima tela.
 */
export function telefoneE164(bruto: string): string {
  const d = digitosTelefone(bruto);
  if (d.length < 10) return "";
  return `+55${d}`;
}
