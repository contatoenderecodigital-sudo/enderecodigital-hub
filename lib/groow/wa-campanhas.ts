// Motor das campanhas de disparo WhatsApp (templates aprovados Meta).
// O tick é chamado por cron (rota /api/whatsapp/tick) ou manualmente no admin;
// cada tick envia um lote pequeno respeitando cap/dia, janela de horário BRT
// e domingo - cadência humana, não metralhadora (a Meta pune número que spamma).
import { query, exec } from "@/lib/groow/db";
import { sendWhatsAppTemplate } from "@/lib/groow/whatsapp";

export interface WaCampanha {
  id: number;
  nome: string;
  template_nome: string;
  template_idioma: string;
  body_params_modo: "nenhum" | "nome";
  status: "rascunho" | "agendada" | "enviando" | "pausada" | "concluida";
  cap_dia: number;
  janela_inicio: number;
  janela_fim: number;
  pular_domingo: number;
  inicio_agendado: string | null;
  optin_confirmado: number;
  created_at: string;
}

export interface WaCampanhaStats {
  total: number;
  pendente: number;
  enviado: number;
  entregue: number;
  lido: number;
  respondeu: number;
  falha: number;
  optout: number;
}

/** Normaliza pra E.164 BR sem "+": 5549999533072. Retorna null se inválido. */
export function normalizarZapBR(raw: string): string | null {
  let d = (raw || "").replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("0")) d = d.replace(/^0+/, "");
  if (!d.startsWith("55")) d = `55${d}`;
  // 55 + DDD(2) + numero(8 ou 9) = 12 ou 13 dígitos
  if (d.length < 12 || d.length > 13) return null;
  return d;
}

async function tabelaExiste(nome: string): Promise<boolean> {
  const rows = await query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?`,
    [nome]
  );
  return Number(rows[0]?.n ?? 0) > 0;
}

/** Hora e dia da semana em Brasília, independente do fuso do servidor. */
function agoraBRT(): { hora: number; domingo: boolean } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    hour: "numeric",
    hour12: false,
    weekday: "short",
  }).formatToParts(new Date());
  const hora = Number(parts.find((p) => p.type === "hour")?.value ?? "12");
  const domingo = parts.find((p) => p.type === "weekday")?.value === "Sun";
  return { hora, domingo };
}

export async function statsDaCampanha(campanhaId: number): Promise<WaCampanhaStats> {
  const rows = await query<{ status: string; n: number }>(
    `SELECT status, COUNT(*) AS n FROM wa_campanha_destinatarios WHERE campanha_id = ? GROUP BY status`,
    [campanhaId]
  );
  const s: WaCampanhaStats = { total: 0, pendente: 0, enviado: 0, entregue: 0, lido: 0, respondeu: 0, falha: 0, optout: 0 };
  for (const r of rows) {
    const n = Number(r.n);
    s.total += n;
    if (r.status in s) (s as unknown as Record<string, number>)[r.status] += n;
  }
  return s;
}

const LOTE_POR_TICK = 10;

/**
 * Processa um tick de envio: pega campanhas ativas, respeita cadência e
 * dispara um lote. Retorna resumo pra log/painel.
 */
export async function processarTick(): Promise<{ enviadas: number; falhas: number; puladas: string[] }> {
  if (!(await tabelaExiste("wa_campanhas"))) return { enviadas: 0, falhas: 0, puladas: ["tabelas não criadas"] };

  const { hora, domingo } = agoraBRT();
  let enviadas = 0;
  let falhas = 0;
  const puladas: string[] = [];

  const campanhas = await query<WaCampanha>(
    `SELECT * FROM wa_campanhas
     WHERE status IN ('agendada','enviando')
       AND (inicio_agendado IS NULL OR inicio_agendado <= NOW())`
  );

  for (const c of campanhas) {
    if (c.pular_domingo && domingo) { puladas.push(`${c.nome}: domingo`); continue; }
    if (hora < c.janela_inicio || hora >= c.janela_fim) { puladas.push(`${c.nome}: fora da janela ${c.janela_inicio}h-${c.janela_fim}h`); continue; }

    const hoje = await query<{ n: number }>(
      `SELECT COUNT(*) AS n FROM wa_campanha_destinatarios
       WHERE campanha_id = ? AND enviado_em IS NOT NULL AND DATE(enviado_em) = CURDATE()`,
      [c.id]
    );
    const restanteHoje = c.cap_dia - Number(hoje[0]?.n ?? 0);
    if (restanteHoje <= 0) { puladas.push(`${c.nome}: cap do dia atingido`); continue; }

    // marca opt-outs pendentes antes de enviar (quem pediu SAIR em outra campanha)
    await exec(
      `UPDATE wa_campanha_destinatarios d
       JOIN wa_optout o ON o.whatsapp = d.whatsapp
       SET d.status = 'optout'
       WHERE d.campanha_id = ? AND d.status = 'pendente'`,
      [c.id]
    );

    const lote = await query<{ id: number; whatsapp: string; nome: string | null }>(
      `SELECT id, whatsapp, nome FROM wa_campanha_destinatarios
       WHERE campanha_id = ? AND status = 'pendente'
       ORDER BY id LIMIT ?`,
      [c.id, Math.min(restanteHoje, LOTE_POR_TICK)]
    );

    if (!lote.length) {
      const pend = await query<{ n: number }>(
        `SELECT COUNT(*) AS n FROM wa_campanha_destinatarios WHERE campanha_id = ? AND status = 'pendente'`,
        [c.id]
      );
      if (Number(pend[0]?.n ?? 0) === 0) {
        await exec(`UPDATE wa_campanhas SET status = 'concluida' WHERE id = ?`, [c.id]);
      }
      continue;
    }

    if (c.status === "agendada") {
      await exec(`UPDATE wa_campanhas SET status = 'enviando' WHERE id = ?`, [c.id]);
    }

    for (const d of lote) {
      try {
        const params = c.body_params_modo === "nome" ? [d.nome?.trim() || "tudo bem"] : [];
        const { wamid } = await sendWhatsAppTemplate(d.whatsapp, c.template_nome, c.template_idioma, params);
        await exec(
          `UPDATE wa_campanha_destinatarios SET status = 'enviado', wamid = ?, enviado_em = NOW(), erro = NULL WHERE id = ?`,
          [wamid, d.id]
        );
        enviadas++;
      } catch (err) {
        await exec(
          `UPDATE wa_campanha_destinatarios SET status = 'falha', erro = ? WHERE id = ?`,
          [(err instanceof Error ? err.message : "erro").slice(0, 250), d.id]
        );
        falhas++;
      }
      // respiro entre envios - cadência humana
      await new Promise((r) => setTimeout(r, 1200));
    }
  }

  return { enviadas, falhas, puladas };
}
