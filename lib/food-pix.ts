import "server-only";
import { decifrar } from "./cofre";
import { query } from "./db";

// ============================================================================
// Pix na mesa. O dinheiro é do RESTAURANTE, não da Endereço Digital: a
// credencial do PSP é por loja e fica cifrada no cofre (SENHAS_CHAVE).
//
// Implementado: Mercado Pago (pagamento Pix direto, com copia-e-cola imediato).
// Asaas ainda não: a API dele exige criar cliente com CPF antes da cobrança, o
// que muda o fluxo da mesa. Enquanto isso, o caixa confirma na mão.
// ============================================================================

export interface CobrancaPix {
  pspId: string;
  copiaCola: string;
  qrBase64: string | null;
  expiraEm: string | null;
}

async function credencial(lojaId: string): Promise<string | null> {
  const r = await query<{ pix_token_cifrado: string | null }>(
    "SELECT pix_token_cifrado FROM food_lojas WHERE id = $1",
    [lojaId]
  );
  const blob = r.rows[0]?.pix_token_cifrado;
  if (!blob) return null;
  try { return decifrar(blob); } catch { return null; }
}

export async function criarCobrancaPix(
  loja: { id: string; nome: string; pix_provedor: string | null },
  valor: number,
  descricao: string
): Promise<CobrancaPix> {
  if (loja.pix_provedor !== "mercadopago") {
    throw new Error("PSP_NAO_CONFIGURADO");
  }
  const token = await credencial(loja.id);
  if (!token) throw new Error("PSP_SEM_CREDENCIAL");

  const res = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      // idempotência: duas pessoas tocando "pagar" ao mesmo tempo não geram duas cobranças
      "X-Idempotency-Key": `${loja.id}-${valor}-${Math.floor(Date.now() / 60000)}`,
    },
    body: JSON.stringify({
      transaction_amount: Number(valor.toFixed(2)),
      description: descricao.slice(0, 60),
      payment_method_id: "pix",
      payer: { email: "cliente@mesa.local" },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`PSP: ${data?.message ?? res.statusText}`);
  }
  const tx = data?.point_of_interaction?.transaction_data;
  if (!tx?.qr_code) throw new Error("PSP: resposta sem copia e cola");
  return {
    pspId: String(data.id),
    copiaCola: tx.qr_code,
    qrBase64: tx.qr_code_base64 ?? null,
    expiraEm: data.date_of_expiration ?? null,
  };
}

/** O webhook só avisa o id. Quem diz se pagou é a API do PSP. */
export async function pagamentoConfirmadoNoPSP(lojaId: string, pspId: string): Promise<boolean> {
  const token = await credencial(lojaId);
  if (!token) return false;
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${pspId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return false;
  const data = await res.json().catch(() => ({}));
  return data?.status === "approved";
}
