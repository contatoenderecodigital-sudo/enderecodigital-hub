import { NextResponse } from "next/server";
import { query } from "@/lib/groow/db";
import { registrarIA } from "@/lib/groow/ia-log";

export const dynamic = "force-dynamic";

// Painel IA & Custos: como a IA está trabalhando e quanto cada coisa custou.
export async function GET() {
  try {
    // garante a tabela mesmo antes da primeira geração (registrarIA cria)
    await registrarIA({ modulo: "_ping", acao: "abertura do painel", status: "ok" }).catch(() => {});
    await query(`DELETE FROM ia_logs WHERE modulo = '_ping'`);

    const [hoje] = await query<{ chamadas: number; custo: number }>(
      `SELECT COUNT(*) AS chamadas, COALESCE(SUM(custo_usd),0) AS custo
       FROM ia_logs WHERE DATE(created_at) = CURDATE()`
    );
    const [mes] = await query<{ chamadas: number; custo: number }>(
      `SELECT COUNT(*) AS chamadas, COALESCE(SUM(custo_usd),0) AS custo
       FROM ia_logs WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`
    );
    const porModulo = await query<{ modulo: string; chamadas: number; custo: number; erros: number }>(
      `SELECT modulo, COUNT(*) AS chamadas, COALESCE(SUM(custo_usd),0) AS custo,
              SUM(CASE WHEN status='erro' THEN 1 ELSE 0 END) AS erros
       FROM ia_logs WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY modulo ORDER BY custo DESC`
    );
    const logs = await query(
      `SELECT id, modulo, acao, modelo, input_tokens, output_tokens, buscas_web, custo_usd,
              duracao_ms, status, detalhe, DATE_FORMAT(created_at,'%d/%m %H:%i') AS quando
       FROM ia_logs ORDER BY id DESC LIMIT 120`
    );

    // ── Métricas do atendimento IA no WhatsApp ──────────────────────────────
    // Provam o valor da IA: quanto ela resolve sozinha, quão rápido responde e
    // quanto custa. Tudo defensivo: se as tabelas do WhatsApp não existirem,
    // devolve null e a página só não mostra a seção.
    let atendimento: {
      conversas: number; comIA: number; handoffs: number; resolvidasSozinha: number;
      taxaResolucao: number; taxaHandoff: number; msgsIA: number; msgsCliente: number;
      tempoRespostaMs: number; custoAtendimentoUsd: number;
    } | null = null;
    try {
      const [conv] = await query<{ total: number; handoffs: number }>(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN status='handed_off' OR handoff_em IS NOT NULL THEN 1 ELSE 0 END) AS handoffs
         FROM wa_conversas`
      );
      const [comIA] = await query<{ n: number }>(
        `SELECT COUNT(DISTINCT conversa_id) AS n FROM wa_mensagens WHERE origem='ai'`
      );
      const [msgs] = await query<{ ia: number; cliente: number }>(
        `SELECT SUM(CASE WHEN origem='ai' THEN 1 ELSE 0 END) AS ia,
                SUM(CASE WHEN origem='user' THEN 1 ELSE 0 END) AS cliente
         FROM wa_mensagens`
      );
      const [tempo] = await query<{ ms: number }>(
        `SELECT COALESCE(AVG(duracao_ms),0) AS ms FROM ia_logs
         WHERE modulo='atendimento' AND status='ok' AND duracao_ms > 0`
      );
      const [custo] = await query<{ usd: number }>(
        `SELECT COALESCE(SUM(custo_usd),0) AS usd FROM ia_logs WHERE modulo='atendimento'`
      );
      const total = Number(conv?.total ?? 0);
      const handoffs = Number(conv?.handoffs ?? 0);
      const com = Number(comIA?.n ?? 0);
      const resolvidas = Math.max(0, com - handoffs);
      atendimento = {
        conversas: total,
        comIA: com,
        handoffs,
        resolvidasSozinha: resolvidas,
        taxaResolucao: com > 0 ? Math.round((resolvidas / com) * 100) : 0,
        taxaHandoff: com > 0 ? Math.round((handoffs / com) * 100) : 0,
        msgsIA: Number(msgs?.ia ?? 0),
        msgsCliente: Number(msgs?.cliente ?? 0),
        tempoRespostaMs: Math.round(Number(tempo?.ms ?? 0)),
        custoAtendimentoUsd: Number(custo?.usd ?? 0),
      };
    } catch { atendimento = null; /* tabelas do WhatsApp ainda não existem */ }

    return NextResponse.json({ hoje, mes, porModulo, logs, atendimento });
  } catch (err) {
    console.error("[admin/ia]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}
