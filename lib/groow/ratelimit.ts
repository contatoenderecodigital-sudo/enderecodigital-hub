/**
 * Rate limit simples em memória, por IP - protege os formulários públicos
 * (/api/lead e /api/diagnostico) de spam e de abuso do webhook do n8n.
 *
 * Escopo: um processo. Se um dia rodar em várias instâncias, trocar por
 * Redis/Upstash. Para o volume atual (um site institucional), resolve.
 */

type Registro = { contagem: number; reiniciaEm: number };

const memoria = new Map<string, Registro>();

/** Descobre o IP do cliente atrás do proxy (Nginx/aaPanel, Vercel). */
export function ipDoRequest(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "desconhecido";
}

export interface LimiteConfig {
  /** quantas requisições são permitidas na janela */
  max: number;
  /** tamanho da janela em segundos */
  janelaSeg: number;
}

/**
 * Retorna true quando a requisição PASSOU do limite (deve ser bloqueada).
 * Limpa registros vencidos de forma oportunista para não vazar memória.
 */
export function excedeuLimite(chave: string, { max, janelaSeg }: LimiteConfig): boolean {
  const agora = Date.now();
  const janelaMs = janelaSeg * 1000;

  if (memoria.size > 5000) {
    for (const [k, v] of memoria) if (v.reiniciaEm <= agora) memoria.delete(k);
  }

  const atual = memoria.get(chave);
  if (!atual || atual.reiniciaEm <= agora) {
    memoria.set(chave, { contagem: 1, reiniciaEm: agora + janelaMs });
    return false;
  }
  atual.contagem += 1;
  return atual.contagem > max;
}

/** Resposta padrão 429 para quando o limite estoura. */
export function respostaLimite(janelaSeg: number) {
  return new Response(
    JSON.stringify({ error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." }),
    {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": String(janelaSeg) },
    }
  );
}
