import "server-only";
import { query, exec } from "@/lib/groow/db";
import type { SituacaoLead } from "@/lib/groow/parceiros-etapas";

/**
 * Fila de reunioes do dono.
 *
 * A fonte e a tabela `cal_agendamentos`, que recebe TODO agendamento do Cal, com
 * parceiro ou sem. Quem marcou pelo link de um parceiro tambem tem um card em
 * `parceiro_leads`, e os dois andam juntos pelo cal_uid: marcar o desfecho aqui
 * move o card no kanban do afiliado, senao ele nunca saberia o que aconteceu.
 */

export type Desfecho = "compareceu" | "nao_compareceu" | "fechou" | "nao_fechou";

export const DESFECHOS: { valor: Desfecho; label: string; cor: string; ajuda: string }[] = [
  {
    valor: "fechou",
    label: "Fechou",
    cor: "#1d8a3a",
    ajuda: "Virou cliente. A comissao so nasce quando o cliente for cadastrado e pagar.",
  },
  {
    valor: "nao_fechou",
    label: "Nao fechou",
    cor: "#7c8698",
    ajuda: "A reuniao aconteceu e nao deu em contrato.",
  },
  {
    valor: "compareceu",
    label: "Compareceu",
    cor: "#2f6fb0",
    ajuda: "Apareceu, mas ainda nao decidiu.",
  },
  {
    valor: "nao_compareceu",
    label: "Nao veio",
    cor: "#c2833a",
    ajuda: "Marcou e nao apareceu.",
  },
];

const DESFECHO_VALIDO = new Set<string>(DESFECHOS.map((d) => d.valor));

export interface Reuniao {
  id: number;
  cal_uid: string;
  nome: string;
  empresa: string | null;
  telefone: string | null;
  email: string | null;
  cidade: string | null;
  codigo: string | null;
  reuniao_em: string;
  reuniao_link: string | null;
  status: string;
  observacao: string | null;
  parceiro_nome: string | null;
  parceiro_codigo: string | null;
  lead_id: number | null;
  lead_situacao: SituacaoLead | null;
  desfecho_nota: string | null;
}

/**
 * `futuras` traz o que ainda vai acontecer, em ordem de quem vem primeiro.
 * `passadas` traz o que ja passou, mais recente antes: e a fila de coisa para
 * anotar o desfecho.
 */
export async function listarReunioes(): Promise<{ futuras: Reuniao[]; passadas: Reuniao[] }> {
  const rows = await query<Reuniao>(
    `SELECT a.id, a.cal_uid, a.nome, a.empresa, a.telefone, a.email, a.cidade,
            a.codigo, a.reuniao_em, a.reuniao_link, a.status, a.observacao,
            p.nome AS parceiro_nome, p.codigo AS parceiro_codigo,
            pl.id AS lead_id, pl.situacao AS lead_situacao, pl.desfecho_nota
       FROM cal_agendamentos a
       LEFT JOIN parceiros p ON p.id = a.parceiro_id
       LEFT JOIN parceiro_leads pl ON pl.cal_uid = a.cal_uid
      WHERE a.status <> 'cancelada'
      ORDER BY a.reuniao_em DESC
      LIMIT 300`
  );
  const agora = Date.now();
  const futuras: Reuniao[] = [];
  const passadas: Reuniao[] = [];
  for (const r of rows) {
    if (new Date(r.reuniao_em).getTime() >= agora) futuras.push(r);
    else passadas.push(r);
  }
  // As futuras vem do SQL em ordem decrescente; quem e proxima tem que aparecer
  // primeiro na tela.
  futuras.reverse();
  return { futuras, passadas };
}

/** Quantas reunioes ainda vao acontecer, para o card de indicador. */
export async function contarReunioesFuturas(): Promise<number> {
  const r = await query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM cal_agendamentos
      WHERE status <> 'cancelada' AND reuniao_em >= NOW()`
  );
  return Number(r[0]?.n ?? 0);
}

export async function marcarDesfecho(
  calUid: string,
  desfecho: Desfecho,
  nota?: string | null
): Promise<void> {
  if (!DESFECHO_VALIDO.has(desfecho)) throw new Error("Desfecho invalido.");
  const limpa = (nota || "").trim().slice(0, 500) || null;

  // Em `cal_agendamentos` so existe presenca: fechar ou nao fechar pressupoe que a
  // pessoa apareceu, entao os dois viram 'compareceu' aqui.
  const statusAgendamento = desfecho === "nao_compareceu" ? "nao_compareceu" : "compareceu";

  await exec(
    `UPDATE cal_agendamentos
        SET status = $1, observacao = COALESCE($2, observacao), atualizado_em = NOW()
      WHERE cal_uid = $3`,
    [statusAgendamento, limpa, calUid]
  );

  // O card do afiliado. Sem isto ele fica olhando "Reuniao marcada" para sempre
  // e nao descobre se a indicacao dele deu em alguma coisa.
  await exec(
    `UPDATE parceiro_leads
        SET situacao = $1, desfecho_em = NOW(),
            desfecho_nota = COALESCE($2, desfecho_nota), atualizado_em = NOW()
      WHERE cal_uid = $3`,
    [desfecho, limpa, calUid]
  );
}
