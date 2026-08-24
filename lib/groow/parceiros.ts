/**
 * Programa de parceiros: indicação por link, fila de leads da call fria e
 * comissão sobre venda fechada.
 *
 * Vive no schema `groow` do Postgres, junto de `leads`, `clientes` e
 * `transacoes`, porque a comissão é calculada em cima do contrato do cliente.
 * O schema é aplicado por db/migrations/groow-postgres.sql, não em runtime.
 */
import { query, exec, garantirColuna } from "@/lib/groow/db";
import { construtorSql, clausulaWhere } from "@/lib/groow/sql";

/* ------------------------------------------------------------------ tipos */

export * from "@/lib/groow/parceiros-etapas";
import {
  ETAPAS,
  ETAPA_POR_VALOR,
  RESULTADOS_CALL,
  type SituacaoLead,
  type ResultadoCall,
  type TipoComissao,
  type StatusComissao,
  type Parceiro,
  type ParceiroLead,
  type ParceiroCall,
  type Comissao,
  type PainelParceiro,
  type ResumoComissao,
  type ResultadoApuracao,
  type EntradaLead,
} from "@/lib/groow/parceiros-etapas";

/* ------------------------------------------------------------------ schema */

let tabelasOk = false;

/**
 * Agora que o banco é Postgres, o schema mora em db/migrations/groow-postgres.sql
 * e é aplicado no deploy, não em runtime. Sobrou aqui só a migração leve de
 * coluna, que continua sendo útil para não ter que rodar ALTER na mão.
 */
export async function garantirTabelasParceiros(): Promise<void> {
  if (tabelasOk) return;
  await garantirColuna("leads", "parceiro_id", "INTEGER");
  await garantirColuna("clientes", "parceiro_id", "INTEGER");
  tabelasOk = true;
}


/* ----------------------------------------------------------------- helpers */

/** DECIMAL do mysql2 volta como string. Sempre passar por aqui antes de somar. */
export function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

// Marcas de acento que sobram depois do normalize("NFD"). Montada por code point
// de propósito: o literal some quando o arquivo passa por normalização Unicode.
const DIACRITICOS = new RegExp("[" + String.fromCharCode(0x300) + "-" + String.fromCharCode(0x36f) + "]", "g");

/** "Jaison Alves" vira "jaison-alves". Usado como código do link. */
export function slugCodigo(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(DIACRITICOS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

export const CODIGO_RE = /^[a-z0-9-]{3,32}$/i;

/** Só dígitos, com DDI 55 na frente. Devolve null quando não dá pra usar. */
export function normalizarTelefone(raw: string): string | null {
  const d = String(raw || "").replace(/\D/g, "");
  if (d.length < 10) return null;
  if (d.length <= 11) return `55${d}`;
  return d;
}

/** "2026-08" -> 24320. Facilita comparar competências. */
function compParaIndice(competencia: string): number {
  const m = competencia.match(/^(\d{4})-(\d{2})$/);
  if (!m) return NaN;
  return Number(m[1]) * 12 + Number(m[2]) - 1;
}

/** Competência do mês corrente no fuso de São Paulo. */
export function competenciaAtual(): string {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  });
  return f.format(new Date()).slice(0, 7);
}

export const COMPETENCIA_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/* -------------------------------------------------------------- parceiros */

export async function listarParceiros(): Promise<Parceiro[]> {
  await garantirTabelasParceiros();
  const rows = await query<Parceiro>(
    `SELECT id, nome, email, telefone, codigo, comissao_setup_pct, comissao_mensal_pct,
            comissao_meses, comissao_fixa, status, criado_em
       FROM parceiros
      ORDER BY status = 'ativo' DESC, nome ASC`
  );
  return rows.map((p) => ({
    ...p,
    comissao_setup_pct: num(p.comissao_setup_pct),
    comissao_mensal_pct: num(p.comissao_mensal_pct),
    comissao_meses: num(p.comissao_meses),
    comissao_fixa: num(p.comissao_fixa),
  }));
}

export async function getParceiro(id: number): Promise<Parceiro | null> {
  await garantirTabelasParceiros();
  const rows = await query<Parceiro>(
    `SELECT id, nome, email, telefone, codigo, comissao_setup_pct, comissao_mensal_pct,
            comissao_meses, comissao_fixa, status, criado_em
       FROM parceiros WHERE id = $1 LIMIT 1`,
    [id]
  );
  const p = rows[0];
  if (!p) return null;
  return {
    ...p,
    comissao_setup_pct: num(p.comissao_setup_pct),
    comissao_mensal_pct: num(p.comissao_mensal_pct),
    comissao_meses: num(p.comissao_meses),
    comissao_fixa: num(p.comissao_fixa),
  };
}

export async function getParceiroPorCodigo(codigo: string): Promise<Parceiro | null> {
  if (!CODIGO_RE.test(codigo)) return null;
  await garantirTabelasParceiros();
  const rows = await query<Parceiro>(
    `SELECT id, nome, email, telefone, codigo, comissao_setup_pct, comissao_mensal_pct,
            comissao_meses, comissao_fixa, status, criado_em
       FROM parceiros WHERE codigo = $1 AND status = 'ativo' LIMIT 1`,
    [codigo.toLowerCase()]
  );
  return rows[0] ?? null;
}

/* ----------------------------------------------------------------- cliques */

export async function registrarClique(
  parceiroId: number,
  destino: string,
  meta: { ipHash?: string | null; userAgent?: string | null; referer?: string | null }
): Promise<void> {
  await garantirTabelasParceiros();
  await exec(
    `INSERT INTO parceiro_cliques (parceiro_id, destino, ip_hash, user_agent, referer)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      parceiroId,
      destino.slice(0, 20),
      meta.ipHash?.slice(0, 64) ?? null,
      meta.userAgent?.slice(0, 255) ?? null,
      meta.referer?.slice(0, 255) ?? null,
    ]
  );
}

export async function contarCliques(parceiroId: number): Promise<number> {
  await garantirTabelasParceiros();
  const rows = await query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM parceiro_cliques WHERE parceiro_id = $1`,
    [parceiroId]
  );
  return num(rows[0]?.n);
}

/* ------------------------------------------------------------ fila de leads */



/**
 * Cria ou atualiza o lead na fila do parceiro. Idempotente por telefone: a
 * mesma pessoa cadastrada duas vezes atualiza a linha em vez de duplicar.
 */
export async function salvarLeadDoParceiro(
  parceiroId: number,
  e: EntradaLead
): Promise<number> {
  await garantirTabelasParceiros();
  const tel = normalizarTelefone(e.telefone);
  if (!tel) throw new Error("Telefone inválido. Inclua o DDD.");
  const nome = String(e.nome || "").trim();
  if (!nome) throw new Error("Nome é obrigatório.");

  // O lead nasce em "a ligar": o parceiro cadastra quem vai ligar e só depois
  // a ligação acontece. Quem já chega com opt-in pula direto para autorizou.
  const optin = e.optin ? 1 : 0;
  const situacao: SituacaoLead = e.situacao ?? (optin ? "autorizou" : "a_ligar");

  const r = await exec(
    `INSERT INTO parceiro_leads
       (parceiro_id, nome, empresa, telefone, email, cidade, setor, situacao,
        optin, optin_em, optin_origem, optin_prova, observacao)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, ${optin ? "NOW()" : "NULL"}, $10, $11, $12)
     ON CONFLICT (parceiro_id, telefone) DO UPDATE SET
       nome = EXCLUDED.nome,
       empresa = COALESCE(EXCLUDED.empresa, parceiro_leads.empresa),
       email = COALESCE(EXCLUDED.email, parceiro_leads.email),
       cidade = COALESCE(EXCLUDED.cidade, parceiro_leads.cidade),
       setor = COALESCE(EXCLUDED.setor, parceiro_leads.setor),
       situacao = EXCLUDED.situacao,
       optin = GREATEST(parceiro_leads.optin, EXCLUDED.optin),
       optin_em = COALESCE(parceiro_leads.optin_em, EXCLUDED.optin_em),
       optin_origem = COALESCE(EXCLUDED.optin_origem, parceiro_leads.optin_origem),
       optin_prova = COALESCE(EXCLUDED.optin_prova, parceiro_leads.optin_prova),
       observacao = COALESCE(EXCLUDED.observacao, parceiro_leads.observacao)
     RETURNING id`,
    [
      parceiroId,
      nome.slice(0, 160),
      e.empresa?.trim().slice(0, 160) || null,
      tel,
      e.email?.trim().toLowerCase().slice(0, 190) || null,
      e.cidade?.trim().slice(0, 120) || null,
      e.setor?.trim().slice(0, 120) || null,
      situacao,
      optin,
      e.optin_origem?.slice(0, 40) || null,
      e.optin_prova?.slice(0, 2000) || null,
      e.observacao?.slice(0, 2000) || null,
    ]
  );
  return r.insertId;
}

export async function listarLeadsDoParceiro(parceiroId: number): Promise<ParceiroLead[]> {
  await garantirTabelasParceiros();
  const rows = await query<ParceiroLead>(
    `SELECT pl.*, l.status AS lead_status,
            (SELECT COUNT(*) FROM parceiro_calls c
              WHERE c.parceiro_lead_id = pl.id AND c.audio_path IS NOT NULL) AS gravacoes
       FROM parceiro_leads pl
       LEFT JOIN leads l ON l.id = pl.lead_id
      WHERE pl.parceiro_id = $1
      ORDER BY pl.ordem ASC, pl.atualizado_em DESC
      LIMIT 500`,
    [parceiroId]
  );
  return rows.map((r) => ({ ...r, gravacoes: num(r.gravacoes) }));
}

/**
 * Move o card de coluna no kanban. `ordem` guarda a posição dentro da coluna
 * para o card não pular de lugar a cada recarga.
 */
export async function moverEtapa(
  id: number,
  parceiroId: number,
  situacao: SituacaoLead,
  ordem = 0
): Promise<boolean> {
  await garantirTabelasParceiros();
  if (!ETAPA_POR_VALOR.has(situacao)) throw new Error("Etapa desconhecida.");

  // Arrastar para "Autorizou contato" não inventa opt-in: sem prova registrada
  // o disparo continua travado. Aqui só marca a data, a prova vem do formulário.
  const r = await exec(
    `UPDATE parceiro_leads
        SET situacao = $1,
            ordem = $2,
            optin = CASE WHEN $1 = 'autorizou' THEN 1 ELSE optin END,
            optin_em = CASE WHEN $1 = 'autorizou' THEN COALESCE(optin_em, NOW()) ELSE optin_em END,
            atualizado_em = NOW()
      WHERE id = $3 AND parceiro_id = $4`,
    [situacao, ordem, id, parceiroId]
  );
  return r.affectedRows > 0;
}

/** Agenda (ou limpa, com null) o retorno de uma ligação. */
export async function agendarRetorno(
  id: number,
  parceiroId: number,
  quando: string | null
): Promise<boolean> {
  await garantirTabelasParceiros();
  const r = await exec(
    `UPDATE parceiro_leads SET proximo_retorno = $1, atualizado_em = NOW()
      WHERE id = $2 AND parceiro_id = $3`,
    [quando, id, parceiroId]
  );
  return r.affectedRows > 0;
}

/* ------------------------------------------------------------ ligações */

/**
 * Registra uma tentativa de ligação no lead. O áudio entra depois, pelo
 * upload, porque a gravação só termina quando a ligação acaba.
 *
 * Além de criar a linha em `parceiro_calls`, empurra o lead para a etapa que
 * corresponde ao desfecho e incrementa o contador de tentativas. É isso que
 * responde "liguei quantas vezes para esse cara".
 */
export async function registrarCall(
  parceiroId: number,
  entrada: {
    parceiro_lead_id: number;
    resultado: ResultadoCall;
    duracao_seg?: number;
    anotacao?: string | null;
  }
): Promise<number> {
  await garantirTabelasParceiros();

  const lead = await getLeadDoParceiro(entrada.parceiro_lead_id, parceiroId);
  if (!lead) throw new Error("Lead não é seu ou não existe.");

  const conf = RESULTADOS_CALL.find((r) => r.valor === entrada.resultado);
  if (!conf) throw new Error("Resultado de ligação desconhecido.");

  const r = await exec(
    `INSERT INTO parceiro_calls
       (parceiro_id, parceiro_lead_id, resultado, duracao_seg, anotacao)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [
      parceiroId,
      entrada.parceiro_lead_id,
      entrada.resultado,
      Math.max(0, Math.min(60 * 60 * 6, num(entrada.duracao_seg))),
      entrada.anotacao?.slice(0, 8000) || null,
    ]
  );

  // A etapa só avança, nunca volta: quem já autorizou não vira "em conversa"
  // porque o parceiro ligou de novo para confirmar alguma coisa.
  const jaResolvido = lead.situacao === "autorizou" || lead.situacao === "recusou";
  const novaEtapa = jaResolvido ? lead.situacao : conf.etapa;

  await exec(
    `UPDATE parceiro_leads
        SET tentativas = tentativas + 1,
            ultima_tentativa = NOW(),
            situacao = $1,
            atualizado_em = NOW()
      WHERE id = $2 AND parceiro_id = $3`,
    [novaEtapa, entrada.parceiro_lead_id, parceiroId]
  );

  return r.insertId;
}

export async function listarCallsDoLead(
  parceiroLeadId: number,
  parceiroId: number
): Promise<ParceiroCall[]> {
  await garantirTabelasParceiros();
  const rows = await query<ParceiroCall>(
    `SELECT * FROM parceiro_calls
      WHERE parceiro_lead_id = $1 AND parceiro_id = $2
      ORDER BY criado_em DESC LIMIT 200`,
    [parceiroLeadId, parceiroId]
  );
  return rows.map((c) => ({ ...c, audio_bytes: num(c.audio_bytes) }));
}

/**
 * Últimas ligações do parceiro, com o nome do lead junto. É o que eu abro no
 * meu painel para ouvir como eles estão vendendo.
 */
export async function listarCallsDoParceiro(
  parceiroId: number,
  limite = 60
): Promise<(ParceiroCall & { lead_nome: string | null; lead_empresa: string | null })[]> {
  await garantirTabelasParceiros();
  const rows = await query<ParceiroCall & { lead_nome: string | null; lead_empresa: string | null }>(
    `SELECT c.*, pl.nome AS lead_nome, pl.empresa AS lead_empresa
       FROM parceiro_calls c
       LEFT JOIN parceiro_leads pl ON pl.id = c.parceiro_lead_id
      WHERE c.parceiro_id = $1
      ORDER BY c.criado_em DESC
      LIMIT $2`,
    [parceiroId, Math.max(1, Math.min(200, limite))]
  );
  return rows.map((c) => ({ ...c, audio_bytes: num(c.audio_bytes) }));
}

/** Sem filtro de parceiro: só o admin chama, e ele enxerga tudo. */
export async function getCallAdmin(id: number): Promise<ParceiroCall | null> {
  await garantirTabelasParceiros();
  const rows = await query<ParceiroCall>(
    `SELECT * FROM parceiro_calls WHERE id = $1 LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function getCall(id: number, parceiroId: number): Promise<ParceiroCall | null> {
  await garantirTabelasParceiros();
  const rows = await query<ParceiroCall>(
    `SELECT * FROM parceiro_calls WHERE id = $1 AND parceiro_id = $2 LIMIT 1`,
    [id, parceiroId]
  );
  return rows[0] ?? null;
}

export async function vincularAudio(
  id: number,
  parceiroId: number,
  audio: { path: string; mime: string; bytes: number }
): Promise<boolean> {
  await garantirTabelasParceiros();
  const r = await exec(
    `UPDATE parceiro_calls SET audio_path = $1, audio_mime = $2, audio_bytes = $3,
            atualizado_em = NOW()
      WHERE id = $4 AND parceiro_id = $5`,
    [audio.path, audio.mime.slice(0, 80), audio.bytes, id, parceiroId]
  );
  return r.affectedRows > 0;
}

export async function getLeadDoParceiro(
  id: number,
  parceiroId: number
): Promise<ParceiroLead | null> {
  await garantirTabelasParceiros();
  const rows = await query<ParceiroLead>(
    `SELECT * FROM parceiro_leads WHERE id = $1 AND parceiro_id = $2 LIMIT 1`,
    [id, parceiroId]
  );
  return rows[0] ?? null;
}

/**
 * Promove a entrada da fila para lead de verdade na operação, carregando a
 * atribuição. Idempotente: se já tem lead_id, devolve o mesmo.
 */
export async function promoverParaLead(
  parceiroLeadId: number
): Promise<{ leadId: number; jaExistia: boolean }> {
  await garantirTabelasParceiros();
  const rows = await query<ParceiroLead>(
    `SELECT * FROM parceiro_leads WHERE id = $1 LIMIT 1`,
    [parceiroLeadId]
  );
  const pl = rows[0];
  if (!pl) throw new Error("Lead do parceiro não encontrado.");
  if (pl.lead_id) return { leadId: pl.lead_id, jaExistia: true };

  // Reaproveita um lead já existente com o mesmo telefone, em vez de duplicar
  // a base da operação.
  // Só por `telefone`: a coluna `whatsapp` nem sempre existe nesta base (o
  // buildLeadSelect de queries.ts mapeia justamente por causa disso).
  const existente = await query<{ id: number }>(
    `SELECT id FROM leads WHERE telefone = $1 ORDER BY id DESC LIMIT 1`,
    [pl.telefone]
  );

  let leadId: number;
  if (existente[0]?.id) {
    leadId = existente[0].id;
    await exec(
      `UPDATE leads SET parceiro_id = $1, origem = 'indicacao' WHERE id = $2 AND parceiro_id IS NULL`,
      [pl.parceiro_id, leadId]
    );
  } else {
    const r = await exec(
      `INSERT INTO leads (nome, empresa, telefone, email, setor, cidade, origem, status, parceiro_id, notas)
       VALUES ($1, $2, $3, $4, $5, $6, 'indicacao', 'novo', $7, $8) RETURNING id`,
      [
        pl.nome,
        pl.empresa,
        pl.telefone,
        pl.email,
        pl.setor,
        pl.cidade,
        pl.parceiro_id,
        pl.optin_prova ? `Autorização de contato: ${pl.optin_prova}` : null,
      ]
    );
    leadId = r.insertId;
  }

  await exec(`UPDATE parceiro_leads SET lead_id = $1 WHERE id = $2`, [leadId, parceiroLeadId]);
  return { leadId, jaExistia: false };
}

/* --------------------------------------------------------------- comissões */



interface LinhaCliente {
  cliente_id: number;
  lead_id: number | null;
  parceiro_id: number;
  empresa: string;
  valor_mensal: unknown;
  valor_setup: unknown;
  /** já vem como "2026-08" do SQL: o driver devolve DATE como objeto Date. */
  inicio_comp: string | null;
  status: string;
  comissao_setup_pct: unknown;
  comissao_mensal_pct: unknown;
  comissao_meses: unknown;
  comissao_fixa: unknown;
}

/**
 * Apura a comissão de uma competência ("2026-08").
 *
 * Regras:
 *  - setup: paga no mês em que o contrato começou, sobre `valor_setup`.
 *  - recorrente: paga enquanto a competência estiver dentro da janela de
 *    `comissao_meses` a partir do início do contrato, e o cliente estiver ativo.
 *  - snapshot: grava base e percentual do momento, então mudar o contrato
 *    depois não reescreve o passado.
 *  - idempotente: a unique (parceiro, cliente, tipo, competência) impede
 *    duplicata, e linha já aprovada ou paga nunca é sobrescrita.
 */
export async function apurarComissoes(competencia: string): Promise<ResultadoApuracao> {
  if (!COMPETENCIA_RE.test(competencia)) throw new Error("Competência inválida.");
  await garantirTabelasParceiros();

  // Herda a atribuição do lead para o cliente. Evita ter que alterar o fluxo
  // existente de criação de cliente.
  await exec(
    `UPDATE clientes c
        SET parceiro_id = l.parceiro_id
       FROM leads l
      WHERE l.id = c.lead_id
        AND c.parceiro_id IS NULL AND l.parceiro_id IS NOT NULL`
  );

  const alvo = compParaIndice(competencia);
  const linhas = await query<LinhaCliente>(
    // DATE_FORMAT no SQL, e nao slice no JS: o pool usa dateStrings:false, entao
    // inicio_contrato chegaria aqui como objeto Date e o recorte sairia errado.
    `SELECT c.id AS cliente_id, c.lead_id, c.parceiro_id, c.empresa,
            c.valor_mensal, c.valor_setup, c.status,
            to_char(c.inicio_contrato, 'YYYY-MM') AS inicio_comp,
            p.comissao_setup_pct, p.comissao_mensal_pct, p.comissao_meses, p.comissao_fixa
       FROM clientes c
       JOIN parceiros p ON p.id = c.parceiro_id
      WHERE c.parceiro_id IS NOT NULL`
  );

  let criadas = 0;
  let atualizadas = 0;

  for (const c of linhas) {
    if (!c.inicio_comp) continue;
    const inicio = compParaIndice(c.inicio_comp);
    if (!Number.isFinite(inicio) || alvo < inicio) continue;

    const pctSetup = num(c.comissao_setup_pct);
    const pctMensal = num(c.comissao_mensal_pct);
    const meses = num(c.comissao_meses);
    const fixa = num(c.comissao_fixa);

    // Valor fixo por venda fechada: um lançamento só, no mês em que o contrato
    // começa. Quando existe, os percentuais nem entram na conta, senão o
    // parceiro receberia duas vezes pela mesma venda.
    if (fixa > 0) {
      if (alvo === inicio && c.status !== "cancelado") {
        const r = await gravarComissao({
          parceiro_id: c.parceiro_id,
          cliente_id: c.cliente_id,
          lead_id: c.lead_id,
          tipo: "fixa",
          competencia,
          base_valor: 0,
          percentual: 0,
          valorFixo: fixa,
        });
        if (r === "criada") criadas++;
        else if (r === "atualizada") atualizadas++;
      }
      continue;
    }

    // Setup: só na competência de início do contrato.
    if (alvo === inicio && num(c.valor_setup) > 0 && pctSetup > 0 && c.status !== "cancelado") {
      const r = await gravarComissao({
        parceiro_id: c.parceiro_id,
        cliente_id: c.cliente_id,
        lead_id: c.lead_id,
        tipo: "setup",
        competencia,
        base_valor: num(c.valor_setup),
        percentual: pctSetup,
      });
      if (r === "criada") criadas++;
      else if (r === "atualizada") atualizadas++;
    }

    // Recorrente: dentro da janela e com o cliente ativo.
    const dentroDaJanela = alvo - inicio < meses;
    if (dentroDaJanela && num(c.valor_mensal) > 0 && pctMensal > 0 && c.status === "ativo") {
      const r = await gravarComissao({
        parceiro_id: c.parceiro_id,
        cliente_id: c.cliente_id,
        lead_id: c.lead_id,
        tipo: "recorrente",
        competencia,
        base_valor: num(c.valor_mensal),
        percentual: pctMensal,
      });
      if (r === "criada") criadas++;
      else if (r === "atualizada") atualizadas++;
    }
  }

  return { competencia, criadas, atualizadas, clientesAvaliados: linhas.length };
}

async function gravarComissao(c: {
  parceiro_id: number;
  cliente_id: number;
  lead_id: number | null;
  tipo: TipoComissao;
  competencia: string;
  base_valor: number;
  percentual: number;
  /** quando vem, o valor é este e não o resultado do percentual */
  valorFixo?: number;
}): Promise<"criada" | "atualizada" | "intocada"> {
  const valor =
    c.valorFixo != null
      ? Math.round(c.valorFixo * 100) / 100
      : Math.round(c.base_valor * (c.percentual / 100) * 100) / 100;

  // Confere antes de gravar. O affectedRows do INSERT ... ON DUPLICATE KEY não
  // serve para distinguir criada de atualizada aqui: dependendo da flag
  // CLIENT_FOUND_ROWS do driver, um UPDATE que não mudou nada também volta 1,
  // e o relatório da apuração acabava dizendo "criada" toda vez.
  const jaExiste = await query<{ id: number }>(
    `SELECT id FROM parceiro_comissoes
      WHERE parceiro_id = $1 AND cliente_id = $2 AND tipo = $3 AND competencia = $4 LIMIT 1`,
    [c.parceiro_id, c.cliente_id, c.tipo, c.competencia]
  );

  await exec(
    `INSERT INTO parceiro_comissoes
       (parceiro_id, cliente_id, lead_id, tipo, competencia, base_valor, percentual, valor, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'previsto')
     ON CONFLICT (parceiro_id, cliente_id, tipo, competencia) DO UPDATE SET
       base_valor = CASE WHEN parceiro_comissoes.status = 'previsto'
                         THEN EXCLUDED.base_valor ELSE parceiro_comissoes.base_valor END,
       percentual = CASE WHEN parceiro_comissoes.status = 'previsto'
                         THEN EXCLUDED.percentual ELSE parceiro_comissoes.percentual END,
       valor      = CASE WHEN parceiro_comissoes.status = 'previsto'
                         THEN EXCLUDED.valor ELSE parceiro_comissoes.valor END,
       lead_id    = COALESCE(parceiro_comissoes.lead_id, EXCLUDED.lead_id)`,
    [
      c.parceiro_id,
      c.cliente_id,
      c.lead_id,
      c.tipo,
      c.competencia,
      c.base_valor,
      c.percentual,
      valor,
    ]
  );
  return jaExiste[0] ? "atualizada" : "criada";
}

export async function listarComissoes(
  parceiroId: number | null,
  competencia?: string
): Promise<Comissao[]> {
  await garantirTabelasParceiros();
  const { p, params } = construtorSql();
  const where: string[] = [];
  if (parceiroId !== null) where.push(`pc.parceiro_id = ${p(parceiroId)}`);
  if (competencia && COMPETENCIA_RE.test(competencia)) where.push(`pc.competencia = ${p(competencia)}`);
  const rows = await query<Comissao>(
    `SELECT pc.*, c.empresa
       FROM parceiro_comissoes pc
       LEFT JOIN clientes c ON c.id = pc.cliente_id
      ${clausulaWhere(where)}
      ORDER BY pc.competencia DESC, pc.id DESC
      LIMIT 500`,
    params
  );
  return rows.map((r) => ({
    ...r,
    base_valor: num(r.base_valor),
    percentual: num(r.percentual),
    valor: num(r.valor),
  }));
}



export async function resumoComissoes(parceiroId: number): Promise<ResumoComissao> {
  await garantirTabelasParceiros();
  const rows = await query<{ status: StatusComissao; total: unknown }>(
    `SELECT status, SUM(valor) AS total
       FROM parceiro_comissoes
      WHERE parceiro_id = $1 AND status <> 'cancelado'
      GROUP BY status`,
    [parceiroId]
  );
  const r: ResumoComissao = { previsto: 0, aprovado: 0, pago: 0 };
  for (const linha of rows) {
    if (linha.status === "previsto") r.previsto = num(linha.total);
    if (linha.status === "aprovado") r.aprovado = num(linha.total);
    if (linha.status === "pago") r.pago = num(linha.total);
  }
  return r;
}

/* ------------------------------------------------------------- indicadores */



export async function painelDoParceiro(parceiroId: number): Promise<PainelParceiro> {
  await garantirTabelasParceiros();
  const [cliques, fila, clientes, comissao] = await Promise.all([
    contarCliques(parceiroId),
    // COUNT(*) FILTER e não SUM(col = 1): no Postgres a comparação devolve
    // boolean, e SUM de boolean não existe.
    query<{ total: number; autorizados: number; promovidos: number }>(
      `SELECT COUNT(*) AS total,
              COUNT(*) FILTER (WHERE optin = 1) AS autorizados,
              COUNT(*) FILTER (WHERE lead_id IS NOT NULL) AS promovidos
         FROM parceiro_leads WHERE parceiro_id = $1`,
      [parceiroId]
    ),
    query<{ n: number }>(`SELECT COUNT(*) AS n FROM clientes WHERE parceiro_id = $1`, [parceiroId]),
    resumoComissoes(parceiroId),
  ]);
  return {
    cliques,
    leads: num(fila[0]?.total),
    autorizados: num(fila[0]?.autorizados),
    promovidos: num(fila[0]?.promovidos),
    clientes: num(clientes[0]?.n),
    comissao,
  };
}
