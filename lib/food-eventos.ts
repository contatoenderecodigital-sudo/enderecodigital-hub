import "server-only";
import { query } from "./db";
import { isWhatsAppConfigured, normalizarNumeroBR, sendWhatsAppText } from "./groow/whatsapp";

// ============================================================================
// Fila de eventos do AppFood -> WhatsApp oficial (Cloud API).
//
// O módulo de restaurante nunca envia mensagem sozinho: ele só grava o fato em
// `food_eventos`. Este processador lê a fila e dispara. Assim, trocar o canal
// (ou desligar o disparo) não mexe em nada da operação.
//
// Regra da Meta: fora da janela de 24 horas só passa template aprovado. Por
// isso mensagem de status só sai para quem falou com o número antes (delivery
// e pedido pelo zap). Cliente de mesa não recebe nada, e está certo assim.
// ============================================================================

interface EventoFila {
  id: string;
  tipo: string;
  negocio_id: string;
  telefone: string | null;
  cliente_nome: string | null;
  optin: boolean | null;
  loja_nome: string | null;
  numero_dia: number | null;
  canal: string | null;
  total: string | null;
  previsao: number | null;
}

function mensagem(e: EventoFila): string | null {
  const nome = e.cliente_nome ? e.cliente_nome.split(" ")[0] : "";
  const ola = nome ? `${nome}, ` : "";
  const loja = e.loja_nome ?? "";
  switch (e.tipo) {
    case "pedido_criado":
      return `${ola}recebemos seu pedido #${e.numero_dia} no ${loja}. Já estamos preparando, leva mais ou menos ${e.previsao ?? 30} minutos.`;
    case "pedido_pronto":
      return e.canal === "delivery"
        ? `${ola}seu pedido #${e.numero_dia} ficou pronto e já vai sair para entrega.`
        : `${ola}seu pedido #${e.numero_dia} está pronto para retirada no ${loja}.`;
    case "saiu_entrega":
      return `${ola}seu pedido #${e.numero_dia} saiu para entrega.`;
    case "pedido_entregue":
      return `${ola}obrigado por pedir no ${loja}. Se der tudo certo por aí, a gente agradece a visita de novo.`;
    default:
      return null; // chamou_garcom e conta_paga são para a operação, não para o cliente
  }
}

/**
 * Processa a fila. Devolve quantos eventos foram tratados.
 * Chamada pelo cron (`/api/food/eventos`) ou na mão pelo painel.
 */
export async function processarEventos(limite = 50): Promise<{ enviados: number; pulados: number }> {
  const eventos = (await query<EventoFila>(
    `SELECT e.id, e.tipo, e.negocio_id,
            c.telefone, c.nome AS cliente_nome, c.optin_whats AS optin,
            l.nome AS loja_nome, l.tempo_preparo_min AS previsao,
            p.numero_dia, p.canal, p.total
       FROM food_eventos e
       LEFT JOIN food_clientes c ON c.id = e.cliente_id
       LEFT JOIN food_lojas l ON l.id = e.loja_id
       LEFT JOIN food_pedidos p ON p.id = e.pedido_id
      WHERE e.processado_em IS NULL
      ORDER BY e.criado_em
      LIMIT $1`,
    [limite]
  )).rows;

  let enviados = 0;
  let pulados = 0;

  for (const e of eventos) {
    const texto = mensagem(e);
    const numero = e.telefone ? normalizarNumeroBR(e.telefone) : null;

    if (texto && numero && e.optin && isWhatsAppConfigured()) {
      try {
        await sendWhatsAppText(numero, texto);
        enviados++;
      } catch {
        // fora da janela de 24h ou número inválido: não trava a fila
        pulados++;
      }
    } else {
      pulados++;
    }
    await query("UPDATE food_eventos SET processado_em = now() WHERE id = $1", [e.id]);
  }

  return { enviados, pulados };
}
