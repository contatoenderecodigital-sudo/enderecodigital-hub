import "server-only";
import { cookies } from "next/headers";

// Qual HUB o owner está operando AGORA (nível 2: dentro de um hub).
// Toda leitura/escrita da operação (ops_*) filtra por este id.
export const HUB_COOKIE = "ed_hub_op";

export async function hubOpId(): Promise<string | null> {
  const c = await cookies();
  return c.get(HUB_COOKIE)?.value ?? null;
}
