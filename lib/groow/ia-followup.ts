// Follow-up automático: a IA reengaja o lead que parou de responder.
// Roda dentro do tick (a cada 5 min). Travas de segurança:
//   - nasce DESLIGADO (ativo=false); só liga quando você aprova no painel
//   - só conversas com a IA ativa (humano que assumiu não é tocado)
//   - só quem PAROU de responder (a gente falou por último)
//   - só dentro da janela de 24h da Meta (texto livre, sem custo de template)
//   - respeita a cadência e o máximo de toques; para quando o cliente responde
//   - respeita opt-out; teto por rodada pra não disparar em rajada
import { query, exec, garantirColuna } from "@/lib/groow/db";
import { sendWhatsAppText } from "@/lib/groow/whatsapp";
import { gerarFollowupIA } from "@/lib/groow/atendente-ia";

export interface FollowupConfig {
  ativo: boolean;
  intervalos: number[]; // horas de silêncio pra cada toque, ex.: [4, 12]
}

const PADRAO: FollowupConfig = { ativo: false, intervalos: [4, 12] };
const TETO_POR_RODADA = 15;

async function garantir() {
  // Schema em db/migrations/groow-postgres.sql, aplicado no deploy. O DDL em
  // runtime era do tempo do MySQL e não vale mais.
  await garantirColuna("wa_conversas", "followups_enviados", "INTEGER NOT NULL DEFAULT 0");
  await garantirColuna("wa_conversas", "ultimo_followup_em", "TIMESTAMPTZ");
}

export async function getFollowupConfig(): Promise<FollowupConfig> {
  try {
    await garantir();
    const r = await query<{ ativo: number; intervalos: string }>(`SELECT ativo, intervalos FROM ia_followup_config WHERE id = 1 LIMIT 1`);
    if (!r[0]) return PADRAO;
    const intervalos = r[0].intervalos.split(",").map((n) => parseInt(n.trim(), 10)).filter((n) => n > 0);
    return { ativo: Boolean(r[0].ativo), intervalos: intervalos.length ? intervalos : PADRAO.intervalos };
  } catch {
    return PADRAO;
  }
}

export async function setFollowupConfig(cfg: FollowupConfig): Promise<void> {
  await garantir();
  const intervalos = (cfg.intervalos ?? []).filter((n) => n > 0 && n <= 24).slice(0, 4);
  await exec(
    `INSERT INTO ia_followup_config (id, ativo, intervalos) VALUES (1, $1, $2)
     ON CONFLICT (id) DO UPDATE SET ativo = EXCLUDED.ativo, intervalos = EXCLUDED.intervalos`,
    [cfg.ativo ? 1 : 0, (intervalos.length ? intervalos : PADRAO.intervalos).join(",")]
  );
}

interface Candidata {
  id: number;
  whatsapp: string;
  followups_enviados: number;
  ultima_mensagem_em: string | null;
  ultima_origem: string | null;
  ultimo_user_em: string | null;
}

/** Roda 1 rodada de follow-up. Retorna quantos foram enviados. */
export async function processarFollowups(): Promise<number> {
  const cfg = await getFollowupConfig();
  if (!cfg.ativo || !cfg.intervalos.length) return 0;

  await garantir();
  const cands = await query<Candidata>(
    `SELECT c.id, c.whatsapp, c.followups_enviados, c.ultima_mensagem_em,
       (SELECT origem FROM wa_mensagens m WHERE m.conversa_id = c.id ORDER BY m.id DESC LIMIT 1) AS ultima_origem,
       (SELECT MAX(created_at) FROM wa_mensagens m WHERE m.conversa_id = c.id AND m.origem = 'user') AS ultimo_user_em
     FROM wa_conversas c
     WHERE c.status = 'ai_active'
     ORDER BY c.ultima_mensagem_em ASC
     LIMIT 300`
  );

  const agora = Date.now();
  const horas = (dt: string | null) => (dt ? (agora - new Date(dt.replace(" ", "T")).getTime()) / 3.6e6 : Infinity);
  let enviados = 0;

  for (const c of cands) {
    if (enviados >= TETO_POR_RODADA) break;
    // a gente tem que ter falado por último (cliente parou de responder)
    if (c.ultima_origem !== "ai" && c.ultima_origem !== "humano") continue;
    // nunca houve mensagem do cliente: não faz cold follow-up
    if (!c.ultimo_user_em) continue;
    // já esgotou os toques
    const toque = Number(c.followups_enviados) || 0;
    if (toque >= cfg.intervalos.length) continue;
    // fora da janela de 24h da Meta: texto livre não entrega
    if (horas(c.ultimo_user_em) >= 23.5) continue;
    // ainda não deu o tempo de silêncio desse toque
    if (horas(c.ultima_mensagem_em) < cfg.intervalos[toque]) continue;
    // opt-out
    try {
      const off = await query<{ n: number }>(`SELECT COUNT(*) AS n FROM wa_optout WHERE whatsapp = $1`, [c.whatsapp]);
      if (Number(off[0]?.n ?? 0) > 0) continue;
    } catch { /* tabela de opt-out pode não existir */ }

    const msg = await gerarFollowupIA(c.id, c.whatsapp, toque + 1);
    if (!msg) continue;
    try {
      const { wamid } = await sendWhatsAppText(c.whatsapp, msg);
      await exec(
        `INSERT INTO wa_mensagens (conversa_id, origem, tipo, texto, wamid, status_entrega) VALUES ($1, 'ai', 'text', $2, $3, 'sent')`,
        [c.id, msg, wamid]
      );
      await exec(
        `UPDATE wa_conversas SET ultima_mensagem = $1, ultima_mensagem_em = NOW(), followups_enviados = followups_enviados + 1, ultimo_followup_em = NOW() WHERE id = $2`,
        [msg.slice(0, 500), c.id]
      );
      enviados++;
    } catch (err) {
      console.error("[followup] envio", c.id, err);
    }
  }
  return enviados;
}
