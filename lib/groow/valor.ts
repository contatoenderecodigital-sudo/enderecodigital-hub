// Leitura de valor em dinheiro digitado por gente de verdade: "400,00", "R$ 1.500,00",
// "1500.50" e "1500" precisam todos virar número. Antes disso o painel usava
// <input type="number">, que devolve string VAZIA quando o browser vê vírgula —
// lançamento de "400,00" era recusado com "valor inválido".
export function parseValorBR(entrada: unknown): number {
  if (typeof entrada === "number") return Number.isFinite(entrada) ? entrada : NaN;
  const bruto = String(entrada ?? "").trim().replace(/[R$\s ]/gi, "");
  if (!bruto) return NaN;
  // Com vírgula, o padrão é brasileiro: ponto é milhar e vírgula é decimal.
  // Sem vírgula, o ponto só é milhar quando agrupa de 3 em 3 ("1.200", "1.200.000"),
  // senão é decimal (é o que vem de campo numérico e de API: "1500.50").
  // Sem essa distinção, "1.200" digitado no painel viraria R$ 1,20.
  const normalizado = bruto.includes(",")
    ? bruto.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(\.\d{3})+$/.test(bruto)
      ? bruto.replace(/\./g, "")
      : bruto;
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : NaN;
}
