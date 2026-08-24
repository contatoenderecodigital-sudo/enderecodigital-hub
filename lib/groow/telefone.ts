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
