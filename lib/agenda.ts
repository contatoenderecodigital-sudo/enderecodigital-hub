import "server-only";
import { pool, query } from "./db";

// ============================================================================
//  MODULO AGENDA · a camada de dados
//  Produto: MeuBarbeiro. Primeiro nicho: barbearia.
//
//  A REGRA QUE NAO SE QUEBRA: toda funcao daqui recebe negocioId como PRIMEIRO
//  argumento, obrigatorio, sem valor padrao. Nao existe funcao neste arquivo
//  que leia agenda sem saber de quem e.
//
//  Motivo pratico: as chaves compostas no banco impedem GRAVAR cruzado, mas
//  nao impedem LER. Um select sem WHERE negocio_id lista a agenda de todo
//  mundo. O banco cobre a escrita; este arquivo cobre a leitura.
//
//  Quem chama pega o negocioId do activeNegocioId(sessao), nunca da URL.
//  Id vindo da URL e do usuario, e usuario mente.
//
//  DINHEIRO EM CENTAVOS. Converter so na borda, na hora de mostrar.
// ============================================================================

// Fuso unico, decisao do dono: o produto e so Brasil por enquanto, entao nao
// existe coluna de fuso por barbearia. Fica explicito aqui em vez de depender
// do TZ do servidor, senao a agenda anda uma hora quando alguem mexe no
// container.
export const FUSO = "America/Sao_Paulo";

// ----------------------------------------------------------------------------
//  CONFIG DA CASA
// ----------------------------------------------------------------------------
export type ConfigAgenda = {
  grade_min: number;
  antecedencia_min_horas: number;
  antecedencia_max_dias: number;
  cancelamento_horas: number;
  lembrete_horas_antes: number;
  pede_confirmacao: boolean;
  exige_sinal: boolean;
  sinal_pct: number;
  sinal_apos_faltas: number;
  lista_espera_ativa: boolean;
  pesquisa_ativa: boolean;
  fidelidade_ativa: boolean;
  pontos_por_real: number;
  comissao_servico_pct: number;
  comissao_produto_pct: number;
};

// Cria a linha na primeira leitura. Barbearia recem cadastrada nao pode cair
// numa tela quebrada so porque ninguem abriu a tela de configuracao ainda.
export async function configDaAgenda(negocioId: string): Promise<ConfigAgenda> {
  const { rows } = await query<ConfigAgenda>(
    `INSERT INTO agenda_config (negocio_id) VALUES ($1)
       ON CONFLICT (negocio_id) DO UPDATE SET negocio_id = EXCLUDED.negocio_id
     RETURNING grade_min, antecedencia_min_horas, antecedencia_max_dias,
               cancelamento_horas, lembrete_horas_antes, pede_confirmacao,
               exige_sinal, sinal_pct, sinal_apos_faltas, lista_espera_ativa,
               pesquisa_ativa, fidelidade_ativa,
               pontos_por_real::float8 AS pontos_por_real,
               comissao_servico_pct::float8 AS comissao_servico_pct,
               comissao_produto_pct::float8 AS comissao_produto_pct`,
    [negocioId],
  );
  return rows[0];
}

export async function salvarConfig(
  negocioId: string,
  c: Partial<ConfigAgenda>,
): Promise<void> {
  await query(
    `UPDATE agenda_config SET
       grade_min = coalesce($2, grade_min),
       antecedencia_min_horas = coalesce($3, antecedencia_min_horas),
       antecedencia_max_dias = coalesce($4, antecedencia_max_dias),
       cancelamento_horas = coalesce($5, cancelamento_horas),
       lembrete_horas_antes = coalesce($6, lembrete_horas_antes),
       pede_confirmacao = coalesce($7, pede_confirmacao),
       exige_sinal = coalesce($8, exige_sinal),
       sinal_pct = coalesce($9, sinal_pct),
       sinal_apos_faltas = coalesce($10, sinal_apos_faltas),
       lista_espera_ativa = coalesce($11, lista_espera_ativa),
       pesquisa_ativa = coalesce($12, pesquisa_ativa),
       fidelidade_ativa = coalesce($13, fidelidade_ativa),
       pontos_por_real = coalesce($14, pontos_por_real),
       comissao_servico_pct = coalesce($15, comissao_servico_pct),
       comissao_produto_pct = coalesce($16, comissao_produto_pct),
       atualizado_em = now()
     WHERE negocio_id = $1`,
    [
      negocioId, c.grade_min, c.antecedencia_min_horas, c.antecedencia_max_dias,
      c.cancelamento_horas, c.lembrete_horas_antes, c.pede_confirmacao,
      c.exige_sinal, c.sinal_pct, c.sinal_apos_faltas, c.lista_espera_ativa,
      c.pesquisa_ativa, c.fidelidade_ativa, c.pontos_por_real,
      c.comissao_servico_pct, c.comissao_produto_pct,
    ].map((v) => (v === undefined ? null : v)),
  );
}

// ----------------------------------------------------------------------------
//  PROFISSIONAIS
// ----------------------------------------------------------------------------
export type Profissional = {
  id: string;
  nome: string;
  apelido: string | null;
  telefone: string | null;
  foto: string | null;
  cor: string | null;
  filial_id: string | null;
  filial_nome: string | null;
  usuario_id: string | null;
  comissao_servico_pct: number | null;
  comissao_produto_pct: number | null;
  aceita_online: boolean;
  ordem: number;
  ativo: boolean;
};

export async function listarProfissionais(
  negocioId: string,
  incluirInativos = false,
): Promise<Profissional[]> {
  const { rows } = await query<Profissional>(
    `SELECT p.id, p.nome, p.apelido, p.telefone, p.foto, p.cor,
            p.filial_id, f.nome AS filial_nome, p.usuario_id,
            p.comissao_servico_pct::float8 AS comissao_servico_pct,
            p.comissao_produto_pct::float8 AS comissao_produto_pct,
            p.aceita_online, p.ordem, p.ativo
       FROM agenda_profissionais p
       LEFT JOIN filiais f ON f.id = p.filial_id
      WHERE p.negocio_id = $1 AND ($2 OR p.ativo)
      ORDER BY p.ordem, p.nome`,
    [negocioId, incluirInativos],
  );
  return rows;
}

export type EntradaProfissional = {
  nome: string;
  apelido?: string | null;
  telefone?: string | null;
  cor?: string | null;
  filial_id?: string | null;
  comissao_servico_pct?: number | null;
  comissao_produto_pct?: number | null;
  aceita_online?: boolean;
  ordem?: number;
};

export async function criarProfissional(
  negocioId: string,
  p: EntradaProfissional,
): Promise<string> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO agenda_profissionais
       (negocio_id, nome, apelido, telefone, cor, filial_id,
        comissao_servico_pct, comissao_produto_pct, aceita_online, ordem)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,coalesce($9,true),coalesce($10,0))
     RETURNING id`,
    [negocioId, p.nome, p.apelido ?? null, p.telefone ?? null, p.cor ?? null,
     p.filial_id ?? null, p.comissao_servico_pct ?? null,
     p.comissao_produto_pct ?? null, p.aceita_online ?? null, p.ordem ?? null],
  );
  return rows[0].id;
}

export async function atualizarProfissional(
  negocioId: string,
  id: string,
  p: EntradaProfissional,
): Promise<void> {
  await query(
    `UPDATE agenda_profissionais SET
       nome = $3, apelido = $4, telefone = $5, cor = $6, filial_id = $7,
       comissao_servico_pct = $8, comissao_produto_pct = $9,
       aceita_online = coalesce($10, aceita_online), ordem = coalesce($11, ordem)
     WHERE negocio_id = $1 AND id = $2`,
    [negocioId, id, p.nome, p.apelido ?? null, p.telefone ?? null, p.cor ?? null,
     p.filial_id ?? null, p.comissao_servico_pct ?? null,
     p.comissao_produto_pct ?? null, p.aceita_online ?? null, p.ordem ?? null],
  );
}

// Nao existe apagar profissional: a comissao dele, as comandas e o historico
// iriam junto, e o fechamento do mes passado mudaria sozinho.
export async function arquivarProfissional(negocioId: string, id: string): Promise<void> {
  await query(
    `UPDATE agenda_profissionais SET ativo = false WHERE negocio_id = $1 AND id = $2`,
    [negocioId, id],
  );
}

// ----------------------------------------------------------------------------
//  SERVICOS
// ----------------------------------------------------------------------------
export type Servico = {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  duracao_min: number;
  intervalo_pos_min: number;
  preco_cent: number;
  custo_cent: number;
  retorno_dias: number | null;
  online: boolean;
  ordem: number;
  ativo: boolean;
};

export async function listarServicos(
  negocioId: string,
  incluirInativos = false,
): Promise<Servico[]> {
  const { rows } = await query<Servico>(
    `SELECT id, nome, descricao, categoria, duracao_min, intervalo_pos_min,
            preco_cent, custo_cent, retorno_dias, online, ordem, ativo
       FROM agenda_servicos
      WHERE negocio_id = $1 AND ($2 OR ativo)
      ORDER BY ordem, nome`,
    [negocioId, incluirInativos],
  );
  return rows;
}

export type EntradaServico = {
  nome: string;
  descricao?: string | null;
  categoria?: string | null;
  duracao_min: number;
  intervalo_pos_min?: number;
  preco_cent: number;
  custo_cent?: number;
  retorno_dias?: number | null;
  online?: boolean;
  ordem?: number;
};

export async function criarServico(negocioId: string, s: EntradaServico): Promise<string> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO agenda_servicos
       (negocio_id, nome, descricao, categoria, duracao_min, intervalo_pos_min,
        preco_cent, custo_cent, retorno_dias, online, ordem)
     VALUES ($1,$2,$3,$4,$5,coalesce($6,0),$7,coalesce($8,0),$9,
             coalesce($10,true),coalesce($11,0))
     RETURNING id`,
    [negocioId, s.nome, s.descricao ?? null, s.categoria ?? null, s.duracao_min,
     s.intervalo_pos_min ?? null, s.preco_cent, s.custo_cent ?? null,
     s.retorno_dias ?? null, s.online ?? null, s.ordem ?? null],
  );
  return rows[0].id;
}

export async function atualizarServico(
  negocioId: string,
  id: string,
  s: EntradaServico,
): Promise<void> {
  await query(
    `UPDATE agenda_servicos SET
       nome = $3, descricao = $4, categoria = $5, duracao_min = $6,
       intervalo_pos_min = coalesce($7,0), preco_cent = $8,
       custo_cent = coalesce($9,0), retorno_dias = $10,
       online = coalesce($11, online), ordem = coalesce($12, ordem)
     WHERE negocio_id = $1 AND id = $2`,
    [negocioId, id, s.nome, s.descricao ?? null, s.categoria ?? null,
     s.duracao_min, s.intervalo_pos_min ?? null, s.preco_cent,
     s.custo_cent ?? null, s.retorno_dias ?? null, s.online ?? null,
     s.ordem ?? null],
  );
}

export async function arquivarServico(negocioId: string, id: string): Promise<void> {
  await query(`UPDATE agenda_servicos SET ativo = false WHERE negocio_id = $1 AND id = $2`,
    [negocioId, id]);
}

// ----------------------------------------------------------------------------
//  JORNADA
// ----------------------------------------------------------------------------
export type Jornada = {
  id: string;
  profissional_id: string;
  dia_semana: number;
  inicio: string;
  fim: string;
};

export async function jornadaDoProfissional(
  negocioId: string,
  profissionalId: string,
): Promise<Jornada[]> {
  const { rows } = await query<Jornada>(
    `SELECT id, profissional_id, dia_semana, inicio::text, fim::text
       FROM agenda_jornadas
      WHERE negocio_id = $1 AND profissional_id = $2
      ORDER BY dia_semana, inicio`,
    [negocioId, profissionalId],
  );
  return rows;
}

// Troca a semana inteira de uma vez. Editar faixa a faixa deixaria a jornada
// pela metade se a tela quebrasse no meio do caminho.
export async function salvarJornada(
  negocioId: string,
  profissionalId: string,
  faixas: { dia_semana: number; inicio: string; fim: string }[],
): Promise<void> {
  await query(
    `DELETE FROM agenda_jornadas WHERE negocio_id = $1 AND profissional_id = $2`,
    [negocioId, profissionalId],
  );
  for (const f of faixas) {
    await query(
      `INSERT INTO agenda_jornadas (negocio_id, profissional_id, dia_semana, inicio, fim)
       VALUES ($1,$2,$3,$4,$5)`,
      [negocioId, profissionalId, f.dia_semana, f.inicio, f.fim],
    );
  }
}

export async function criarExcecao(
  negocioId: string,
  e: {
    profissional_id?: string | null;
    data: string;
    tipo: "fechado" | "jornada";
    inicio?: string | null;
    fim?: string | null;
    motivo?: string | null;
  },
): Promise<string> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO agenda_excecoes (negocio_id, profissional_id, data, tipo, inicio, fim, motivo)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [negocioId, e.profissional_id ?? null, e.data, e.tipo,
     e.inicio ?? null, e.fim ?? null, e.motivo ?? null],
  );
  return rows[0].id;
}

// ----------------------------------------------------------------------------
//  CLIENTES
// ----------------------------------------------------------------------------
export type Cliente = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  nascimento: string | null;
  observacoes: string | null;
  alerta: string | null;
  bloqueado: boolean;
  aceita_campanha: boolean;
};

// O telefone e a chave humana: e por ele que o WhatsApp acha a pessoa. Duas
// fichas com o mesmo numero partem o historico ao meio e o raio-X passa a
// achar que o cliente sumiu quando ele so foi recadastrado.
export async function acharOuCriarCliente(
  negocioId: string,
  nome: string,
  telefone: string | null,
  origem = "painel",
): Promise<string> {
  if (telefone) {
    const { rows } = await query<{ id: string }>(
      `INSERT INTO agenda_clientes (negocio_id, nome, telefone, origem)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (negocio_id, telefone) WHERE telefone IS NOT NULL
       DO UPDATE SET nome = EXCLUDED.nome
       RETURNING id`,
      [negocioId, nome, telefone, origem],
    );
    return rows[0].id;
  }
  const { rows } = await query<{ id: string }>(
    `INSERT INTO agenda_clientes (negocio_id, nome, origem) VALUES ($1,$2,$3) RETURNING id`,
    [negocioId, nome, origem],
  );
  return rows[0].id;
}

export async function buscarClientes(
  negocioId: string,
  termo: string,
  limite = 20,
): Promise<Cliente[]> {
  const { rows } = await query<Cliente>(
    `SELECT id, nome, telefone, email, nascimento::text, observacoes, alerta,
            bloqueado, aceita_campanha
       FROM agenda_clientes
      WHERE negocio_id = $1
        AND ($2 = '' OR nome ILIKE '%' || $2 || '%' OR telefone LIKE '%' || $2 || '%')
      ORDER BY nome LIMIT $3`,
    [negocioId, termo, limite],
  );
  return rows;
}

// ----------------------------------------------------------------------------
//  AGENDA DO DIA · a tela que o dono abre de manha
// ----------------------------------------------------------------------------
export type StatusAgendamento =
  | "pendente" | "confirmado" | "em_atendimento" | "concluido" | "faltou" | "cancelado";

export type ItemAgenda = {
  id: string;
  profissional_id: string;
  profissional_nome: string;
  profissional_cor: string | null;
  cliente_id: string;
  cliente_nome: string;
  cliente_telefone: string | null;
  cliente_alerta: string | null;
  inicio: string;
  fim: string;
  status: StatusAgendamento;
  origem: string;
  preco_previsto_cent: number;
  observacao: string | null;
  servicos: string[];
  comanda_id: string | null;
};

export async function agendaDoDia(
  negocioId: string,
  data: string,
  profissionalId?: string | null,
): Promise<ItemAgenda[]> {
  const { rows } = await query<ItemAgenda>(
    `SELECT a.id, a.profissional_id, p.nome AS profissional_nome, p.cor AS profissional_cor,
            a.cliente_id, c.nome AS cliente_nome, c.telefone AS cliente_telefone,
            c.alerta AS cliente_alerta,
            a.inicio, a.fim, a.status, a.origem, a.preco_previsto_cent, a.observacao,
            coalesce(
              (SELECT array_agg(s.nome ORDER BY asv.ordem)
                 FROM agenda_agendamento_servicos asv
                 JOIN agenda_servicos s ON s.id = asv.servico_id
                WHERE asv.agendamento_id = a.id), '{}') AS servicos,
            (SELECT cm.id FROM agenda_comandas cm
              WHERE cm.agendamento_id = a.id AND cm.status <> 'cancelada'
              LIMIT 1) AS comanda_id
       FROM agenda_agendamentos a
       JOIN agenda_profissionais p ON p.id = a.profissional_id
       JOIN agenda_clientes c ON c.id = a.cliente_id
      WHERE a.negocio_id = $1
        AND (a.inicio AT TIME ZONE $3)::date = $2::date
        AND ($4::uuid IS NULL OR a.profissional_id = $4)
        AND a.status <> 'cancelado'
      ORDER BY a.inicio, p.ordem`,
    [negocioId, data, FUSO, profissionalId ?? null],
  );
  return rows;
}

// ----------------------------------------------------------------------------
//  MOVIMENTO DE UM DIA
//
//  Os numeros do topo da agenda. Sao do DIA QUE ESTA NA TELA, nao de hoje: com
//  numero fixo em hoje, quem abre a quarta le "na agenda hoje 40" com uma lista
//  de 27 embaixo, e passa a desconfiar dos dois.
// ----------------------------------------------------------------------------
export type MovimentoDia = {
  agendados: number;
  concluidos: number;
  faltas: number;
  /** Comandas fechadas no dia. Dinheiro que entrou, nao previsao. */
  faturado_cent: number;
};

export async function movimentoDoDia(
  negocioId: string,
  data: string,
  profissionalId?: string | null,
): Promise<MovimentoDia> {
  const { rows } = await query<MovimentoDia>(
    `SELECT
       count(*) FILTER (WHERE a.status NOT IN ('cancelado','faltou'))::int AS agendados,
       count(*) FILTER (WHERE a.status = 'concluido')::int AS concluidos,
       count(*) FILTER (WHERE a.status = 'faltou')::int AS faltas,
       coalesce((
         SELECT sum(cm.total_cent) FROM agenda_comandas cm
          WHERE cm.negocio_id = $1 AND cm.status = 'fechada'
            AND (cm.fechada_em AT TIME ZONE $3)::date = $2::date
            AND ($4::uuid IS NULL OR EXISTS (
              SELECT 1 FROM agenda_comanda_itens ci
               WHERE ci.comanda_id = cm.id AND ci.profissional_id = $4))
       ), 0)::int AS faturado_cent
     FROM agenda_agendamentos a
    WHERE a.negocio_id = $1
      AND (a.inicio AT TIME ZONE $3)::date = $2::date
      AND ($4::uuid IS NULL OR a.profissional_id = $4)`,
    [negocioId, data, FUSO, profissionalId ?? null],
  );
  return rows[0];
}

// ----------------------------------------------------------------------------
//  FAIXAS DE TRABALHO DO DIA
//
//  As janelas em que a casa realmente atende, unidas entre todos os
//  profissionais. Existe porque a agenda do dia precisa distinguir BURACO de
//  ALMOCO: sem isso, a parada das 12h as 13h30 aparecia na tela como "90 min de
//  cadeira vazia", e o dono, que fecha pro almoco de proposito, perde a
//  confianca no numero logo na primeira olhada.
// ----------------------------------------------------------------------------
export type FaixaTrabalho = { inicio: string; fim: string };

export async function faixasDoDia(
  negocioId: string,
  data: string,
  profissionalId?: string | null,
): Promise<FaixaTrabalho[]> {
  const { rows } = await query<FaixaTrabalho>(
    `WITH alvo AS (
       SELECT p.id FROM agenda_profissionais p
        WHERE p.negocio_id = $1 AND p.ativo
          AND ($3::uuid IS NULL OR p.id = $3)
     ),
     fechado_casa AS (
       SELECT 1 FROM agenda_excecoes
        WHERE negocio_id = $1 AND data = $2::date
          AND tipo = 'fechado' AND profissional_id IS NULL
     )
     SELECT inicio::text, fim::text FROM (
       SELECT e.inicio, e.fim FROM agenda_excecoes e
         JOIN alvo a ON a.id = e.profissional_id
        WHERE e.negocio_id = $1 AND e.data = $2::date AND e.tipo = 'jornada'
       UNION ALL
       SELECT j.inicio, j.fim FROM agenda_jornadas j
         JOIN alvo a ON a.id = j.profissional_id
        WHERE j.negocio_id = $1
          AND j.dia_semana = EXTRACT(DOW FROM $2::date)
          AND NOT EXISTS (
            SELECT 1 FROM agenda_excecoes e2
             WHERE e2.negocio_id = $1 AND e2.data = $2::date
               AND e2.profissional_id = j.profissional_id)
     ) f
      WHERE NOT EXISTS (SELECT 1 FROM fechado_casa)
      ORDER BY inicio`,
    [negocioId, data, profissionalId ?? null],
  );

  // Une o que se sobrepoe: tres barbeiros com a mesma jornada devolvem a mesma
  // faixa tres vezes, e a tela so precisa saber quando a casa esta aberta.
  const unidas: FaixaTrabalho[] = [];
  for (const f of rows) {
    const ultima = unidas[unidas.length - 1];
    if (ultima && f.inicio <= ultima.fim) {
      if (f.fim > ultima.fim) ultima.fim = f.fim;
    } else {
      unidas.push({ ...f });
    }
  }
  return unidas;
}

// ----------------------------------------------------------------------------
//  HORARIOS LIVRES
//
//  Monta a grade do dia a partir da jornada, tira o que ja esta ocupado e o que
//  esta dentro da antecedencia minima. Roda no banco de proposito: fazer isso
//  no Node significaria trazer a agenda inteira pra memoria a cada consulta do
//  site e do WhatsApp.
//
//  Isto NAO e a trava de conflito. A trava e a restricao de exclusao no banco.
//  Aqui e so a lista bonita que se mostra pro cliente; entre mostrar e gravar
//  existe uma janela, e quem fecha a janela e o Postgres.
// ----------------------------------------------------------------------------
export async function horariosLivres(
  negocioId: string,
  profissionalId: string,
  data: string,
  duracaoMin: number,
): Promise<string[]> {
  const { rows } = await query<{ inicio: string }>(
    `WITH cfg AS (
       SELECT grade_min, antecedencia_min_horas
         FROM agenda_config WHERE negocio_id = $1
     ),
     -- Fechamento da casa inteira (feriado) manda em todo mundo.
     fechado_casa AS (
       SELECT 1 FROM agenda_excecoes
        WHERE negocio_id = $1 AND data = $3::date
          AND tipo = 'fechado' AND profissional_id IS NULL
     ),
     -- Excecao do proprio profissional SUBSTITUI a jornada do dia. Se a
     -- excecao dele for 'fechado', a primeira parte nao devolve nada e a
     -- segunda e bloqueada pelo NOT EXISTS: o dia fica vazio, que e o certo.
     janelas AS (
       SELECT inicio, fim FROM agenda_excecoes
        WHERE negocio_id = $1 AND data = $3::date
          AND tipo = 'jornada' AND profissional_id = $2
       UNION ALL
       SELECT j.inicio, j.fim FROM agenda_jornadas j
        WHERE j.negocio_id = $1 AND j.profissional_id = $2
          AND j.dia_semana = EXTRACT(DOW FROM $3::date)
          AND NOT EXISTS (
            SELECT 1 FROM agenda_excecoes e
             WHERE e.negocio_id = $1 AND e.data = $3::date
               AND e.profissional_id = $2)
     )
     SELECT to_char(gs AT TIME ZONE $5, 'HH24:MI') AS inicio
       FROM janelas w, cfg,
            LATERAL generate_series(
              ($3::date + w.inicio) AT TIME ZONE $5,
              (($3::date + w.fim) AT TIME ZONE $5) - ($4 * interval '1 minute'),
              (cfg.grade_min * interval '1 minute')
            ) AS gs
      WHERE NOT EXISTS (SELECT 1 FROM fechado_casa)
        -- Ninguem marca pras 14h as 13h58.
        AND gs >= now() + (cfg.antecedencia_min_horas * interval '1 hour')
        AND NOT EXISTS (
          SELECT 1 FROM agenda_agendamentos a
           WHERE a.negocio_id = $1 AND a.profissional_id = $2
             AND a.status NOT IN ('cancelado','faltou')
             AND tstzrange(a.inicio, a.fim)
                 && tstzrange(gs, gs + ($4 * interval '1 minute'))
        )
      ORDER BY gs`,
    [negocioId, profissionalId, data, duracaoMin, FUSO],
  );
  return rows.map((r) => r.inicio);
}

// ----------------------------------------------------------------------------
//  MARCAR
// ----------------------------------------------------------------------------
export class HorarioOcupado extends Error {
  constructor() {
    super("Esse horário acabou de ser tomado. Escolha outro.");
    this.name = "HorarioOcupado";
  }
}

export type NovoAgendamento = {
  profissional_id: string;
  cliente_id: string;
  /** Timestamp com fuso, ex: "2026-10-01T14:00:00-03:00". */
  inicio: string;
  servico_ids: string[];
  origem?: "whatsapp" | "site" | "app" | "painel" | "encaixe";
  filial_id?: string | null;
  observacao?: string | null;
};

// A duracao e o preco saem do banco, nunca do que o cliente mandou: preco
// vindo da borda e preco que o cliente escolheu.
//
// O fim ja inclui o intervalo de limpeza do ultimo servico, senao a agenda
// promete um encaixe que na pratica atrasa o dia inteiro.
export async function criarAgendamento(
  negocioId: string,
  a: NovoAgendamento,
): Promise<string> {
  const { rows: servicos } = await query<{
    id: string; preco_cent: number; duracao_min: number; intervalo_pos_min: number;
  }>(
    `SELECT s.id,
            coalesce(ps.preco_cent, s.preco_cent) AS preco_cent,
            coalesce(ps.duracao_min, s.duracao_min) AS duracao_min,
            s.intervalo_pos_min
       FROM agenda_servicos s
       LEFT JOIN agenda_profissional_servicos ps
              ON ps.servico_id = s.id AND ps.profissional_id = $3
      WHERE s.negocio_id = $1 AND s.id = ANY($2::uuid[]) AND s.ativo`,
    [negocioId, a.servico_ids, a.profissional_id],
  );
  if (servicos.length !== a.servico_ids.length) {
    throw new Error("Serviço inexistente ou desativado.");
  }

  const minutos = servicos.reduce((t, s) => t + s.duracao_min, 0)
    + Math.max(...servicos.map((s) => s.intervalo_pos_min), 0);
  const preco = servicos.reduce((t, s) => t + s.preco_cent, 0);

  try {
    const { rows } = await query<{ id: string }>(
      `INSERT INTO agenda_agendamentos
         (negocio_id, filial_id, profissional_id, cliente_id, inicio, fim,
          origem, preco_previsto_cent, observacao)
       VALUES ($1,$2,$3,$4,$5::timestamptz,
               $5::timestamptz + ($6 * interval '1 minute'),
               coalesce($7,'painel'), $8, $9)
       RETURNING id`,
      [negocioId, a.filial_id ?? null, a.profissional_id, a.cliente_id,
       a.inicio, minutos, a.origem ?? null, preco, a.observacao ?? null],
    );
    const id = rows[0].id;

    // Ordem preservada: o cliente pediu corte e depois barba, e e assim que
    // aparece na comanda.
    for (let i = 0; i < a.servico_ids.length; i++) {
      const s = servicos.find((x) => x.id === a.servico_ids[i])!;
      await query(
        `INSERT INTO agenda_agendamento_servicos
           (negocio_id, agendamento_id, servico_id, profissional_id,
            preco_cent, duracao_min, ordem)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [negocioId, id, s.id, a.profissional_id, s.preco_cent, s.duracao_min, i],
      );
    }
    return id;
  } catch (e) {
    // 23P01 = exclusion_violation. E a trava do banco dizendo que outra porta
    // (site, zap, balcao) gravou o mesmo horario primeiro. Vira mensagem de
    // gente, nao erro 500.
    if ((e as { code?: string }).code === "23P01") throw new HorarioOcupado();
    throw e;
  }
}

export async function mudarStatus(
  negocioId: string,
  id: string,
  status: StatusAgendamento,
  quem?: "cliente" | "barbearia",
  motivo?: string,
): Promise<void> {
  if (status === "concluido") {
    throw new Error("Use o fechamento do atendimento para concluir e gerar a comanda.");
  }
  if (!new Set<StatusAgendamento>(["pendente", "confirmado", "em_atendimento", "faltou", "cancelado"]).has(status)) {
    throw new Error("Status de atendimento inválido.");
  }
  await query(
    `UPDATE agenda_agendamentos SET
       status = $3,
       confirmado_em = CASE WHEN $3 = 'confirmado' THEN now() ELSE confirmado_em END,
       cancelado_em  = CASE WHEN $3 = 'cancelado'  THEN now() ELSE cancelado_em  END,
       cancelado_por = CASE WHEN $3 = 'cancelado'  THEN $4 ELSE cancelado_por END,
       motivo_cancelamento = CASE WHEN $3 = 'cancelado' THEN $5 ELSE motivo_cancelamento END
      WHERE negocio_id = $1 AND id = $2
        AND status IN ('pendente','confirmado','em_atendimento')`,
    [negocioId, id, status, quem ?? null, motivo ?? null],
  );
}

// ============================================================================
//  RAIO-X DA CADEIRA
//
//  O diferencial do produto, e a tela que ganha a reuniao. Nao e relatorio, que
//  todo sistema tem e ninguem abre: e a lista do que fazer esta semana, com
//  nome e sobrenome, e cada linha critica termina numa acao.
//
//  Barbearia vive de recorrencia, e o dono nao enxerga a sangria porque so olha
//  a agenda de hoje. A de hoje esta cheia. A de daqui a tres semanas esta
//  esvaziando e ninguem percebeu.
// ============================================================================

// Quanto o cliente pode atrasar sobre o ritmo DELE antes de virar alerta. Nao
// e prazo de tabela: quem corta a cada 21 dias e quem corta a cada 45 nao
// somem no mesmo dia.
export const ATRASO_ATENCAO = 1.15;
export const ATRASO_CRITICO = 1.5;

export type ClienteSumido = {
  id: string;
  nome: string;
  telefone: string | null;
  ultima_visita: string;
  dias_sem_vir: number;
  intervalo_dias: number;
  visitas: number;
  ticket_medio_cent: number;
  profissional_nome: string | null;
  gravidade: "critico" | "atencao";
};

// So entra quem ja voltou pelo menos uma vez: sem duas visitas nao da pra
// saber o ritmo da pessoa, e chamar de sumido quem veio uma vez so seria
// chute. Quem veio uma vez e nunca voltou e outra lista, de primeira visita.
export async function clientesSumidos(
  negocioId: string,
  limite = 50,
): Promise<ClienteSumido[]> {
  const { rows } = await query<ClienteSumido>(
    `WITH visitas AS (
       SELECT a.cliente_id, a.inicio, a.profissional_id,
              a.inicio - lag(a.inicio) OVER (PARTITION BY a.cliente_id ORDER BY a.inicio) AS intervalo
         FROM agenda_agendamentos a
        WHERE a.negocio_id = $1 AND a.status = 'concluido'
     ),
     ritmo AS (
       SELECT cliente_id,
              count(*) AS visitas,
              avg(EXTRACT(EPOCH FROM intervalo) / 86400)
                FILTER (WHERE intervalo IS NOT NULL) AS intervalo_dias,
              max(inicio) AS ultima
         FROM visitas
        GROUP BY cliente_id
       HAVING count(*) >= 2
     ),
     ticket AS (
       SELECT cliente_id, avg(total_cent) AS medio
         FROM agenda_comandas
        WHERE negocio_id = $1 AND status = 'fechada' AND cliente_id IS NOT NULL
        GROUP BY cliente_id
     ),
     -- Com quem ele costuma cortar. E o nome que entra na mensagem.
     preferido AS (
       SELECT DISTINCT ON (v.cliente_id) v.cliente_id, p.nome
         FROM visitas v JOIN agenda_profissionais p ON p.id = v.profissional_id
        ORDER BY v.cliente_id, v.inicio DESC
     )
     SELECT c.id, c.nome, c.telefone,
            (r.ultima AT TIME ZONE $2)::date::text AS ultima_visita,
            (CURRENT_DATE - (r.ultima AT TIME ZONE $2)::date)::int AS dias_sem_vir,
            round(r.intervalo_dias)::int AS intervalo_dias,
            r.visitas::int AS visitas,
            round(coalesce(t.medio, 0))::int AS ticket_medio_cent,
            pf.nome AS profissional_nome,
            CASE WHEN (CURRENT_DATE - (r.ultima AT TIME ZONE $2)::date)
                      >= r.intervalo_dias * $3 THEN 'critico'
                 ELSE 'atencao' END AS gravidade
       FROM ritmo r
       JOIN agenda_clientes c ON c.id = r.cliente_id
       LEFT JOIN ticket t ON t.cliente_id = r.cliente_id
       LEFT JOIN preferido pf ON pf.cliente_id = r.cliente_id
      WHERE r.intervalo_dias > 0
        AND (CURRENT_DATE - (r.ultima AT TIME ZONE $2)::date) >= r.intervalo_dias * $4
        AND NOT c.bloqueado
      ORDER BY (CURRENT_DATE - (r.ultima AT TIME ZONE $2)::date) / r.intervalo_dias DESC
      LIMIT $5`,
    [negocioId, FUSO, ATRASO_CRITICO, ATRASO_ATENCAO, limite],
  );
  return rows;
}

export type CadeiraVazia = {
  /** Data no formato AAAA-MM-DD. */
  dia: string;
  minutos_capacidade: number;
  minutos_ocupados: number;
  minutos_livres: number;
  ocupacao_pct: number;
  /** Receita que evapora se o buraco nao for preenchido. */
  potencial_cent: number;
};

// Buraco na agenda com preco. Deixa de ser "tem horario livre" e vira "essa
// semana tem R$ 1.240 de cadeira parada".
//
// O potencial usa o faturamento por minuto dos ultimos 90 dias, nao o preco de
// tabela: barbearia com desconto e pacote fatura menos que a tabela diz, e
// prometer o numero cheio numa reuniao e comecar mentindo.
export async function cadeiraVazia(
  negocioId: string,
  dias = 7,
): Promise<CadeiraVazia[]> {
  const { rows } = await query<CadeiraVazia>(
    `WITH dias AS (
       SELECT generate_series(CURRENT_DATE, CURRENT_DATE + ($2 - 1), '1 day')::date AS d
     ),
     -- Quanto vale um minuto de cadeira aqui, pelo que de fato entrou.
     valor AS (
       SELECT coalesce(
         sum(cm.total_cent)::numeric
           / nullif(sum(EXTRACT(EPOCH FROM (a.fim - a.inicio)) / 60), 0), 0) AS cent_por_min
         FROM agenda_comandas cm
         JOIN agenda_agendamentos a ON a.id = cm.agendamento_id
        WHERE cm.negocio_id = $1 AND cm.status = 'fechada'
          AND a.inicio >= now() - interval '90 days'
     ),
     capacidade AS (
       SELECT d.d,
              sum(EXTRACT(EPOCH FROM (j.fim - j.inicio)) / 60) AS minutos
         FROM dias d
         JOIN agenda_profissionais p ON p.negocio_id = $1 AND p.ativo
         JOIN agenda_jornadas j
           ON j.profissional_id = p.id AND j.dia_semana = EXTRACT(DOW FROM d.d)
        WHERE NOT EXISTS (
          SELECT 1 FROM agenda_excecoes e
           WHERE e.negocio_id = $1 AND e.data = d.d AND e.tipo = 'fechado'
             AND (e.profissional_id IS NULL OR e.profissional_id = p.id))
        GROUP BY d.d
     ),
     ocupado AS (
       SELECT (a.inicio AT TIME ZONE $3)::date AS d,
              sum(EXTRACT(EPOCH FROM (a.fim - a.inicio)) / 60) AS minutos
         FROM agenda_agendamentos a
        WHERE a.negocio_id = $1
          AND a.status NOT IN ('cancelado','faltou')
          AND (a.inicio AT TIME ZONE $3)::date
              BETWEEN CURRENT_DATE AND CURRENT_DATE + ($2 - 1)
        GROUP BY 1
     )
     SELECT d.d::text AS dia,
            round(coalesce(c.minutos, 0))::int AS minutos_capacidade,
            round(coalesce(o.minutos, 0))::int AS minutos_ocupados,
            round(greatest(coalesce(c.minutos,0) - coalesce(o.minutos,0), 0))::int AS minutos_livres,
            CASE WHEN coalesce(c.minutos,0) = 0 THEN 0
                 ELSE round(coalesce(o.minutos,0) / c.minutos * 100)::int END AS ocupacao_pct,
            round(greatest(coalesce(c.minutos,0) - coalesce(o.minutos,0), 0)
                  * (SELECT cent_por_min FROM valor))::int AS potencial_cent
       FROM dias d
       LEFT JOIN capacidade c ON c.d = d.d
       LEFT JOIN ocupado o ON o.d = d.d
      ORDER BY d.d`,
    [negocioId, dias, FUSO],
  );
  return rows;
}

export type Faltoso = {
  id: string;
  nome: string;
  telefone: string | null;
  faltas: number;
  atendimentos: number;
  /** Quanto por cento das marcacoes dele viram falta. */
  taxa_pct: number;
  perdido_cent: number;
};

// Quem falta, quantas vezes, e quanto isso custou. E o que justifica pedir
// sinal daquele cliente especifico, sem constranger o resto da clientela.
export async function faltosos(negocioId: string, dias = 90): Promise<Faltoso[]> {
  const { rows } = await query<Faltoso>(
    `SELECT c.id, c.nome, c.telefone,
            count(*) FILTER (WHERE a.status = 'faltou')::int AS faltas,
            count(*) FILTER (WHERE a.status = 'concluido')::int AS atendimentos,
            round(count(*) FILTER (WHERE a.status = 'faltou')::numeric
                  / nullif(count(*) FILTER (WHERE a.status IN ('faltou','concluido')), 0)
                  * 100)::int AS taxa_pct,
            coalesce(sum(a.preco_previsto_cent) FILTER (WHERE a.status = 'faltou'), 0)::int AS perdido_cent
       FROM agenda_agendamentos a
       JOIN agenda_clientes c ON c.id = a.cliente_id
      WHERE a.negocio_id = $1
        AND a.inicio >= now() - ($2 * interval '1 day')
      GROUP BY c.id, c.nome, c.telefone
     HAVING count(*) FILTER (WHERE a.status = 'faltou') > 0
      ORDER BY faltas DESC, perdido_cent DESC`,
    [negocioId, dias],
  );
  return rows;
}

export type DesempenhoProfissional = {
  id: string;
  nome: string;
  atendimentos: number;
  faturamento_cent: number;
  ticket_medio_cent: number;
  /** Quanto do faturamento dele veio de produto, nao de servico. */
  produto_cent: number;
  produto_pct: number;
  comissao_cent: number;
  nota_media: number | null;
  faltas: number;
};

// Barbeiro que corta bem e nunca vende pomada aparece aqui, e isso e conversa
// de treinamento, nao de demissao.
export async function desempenhoProfissionais(
  negocioId: string,
  desde: string,
  ate: string,
): Promise<DesempenhoProfissional[]> {
  const { rows } = await query<DesempenhoProfissional>(
    `WITH itens AS (
       SELECT ci.profissional_id,
              sum(ci.total_cent) AS total,
              sum(ci.total_cent) FILTER (WHERE ci.tipo = 'produto') AS produto,
              sum(ci.comissao_cent) AS comissao
         FROM agenda_comanda_itens ci
         JOIN agenda_comandas cm ON cm.id = ci.comanda_id
        WHERE ci.negocio_id = $1 AND cm.status = 'fechada'
          AND cm.fechada_em::date BETWEEN $2::date AND $3::date
        GROUP BY ci.profissional_id
     ),
     atend AS (
       SELECT profissional_id,
              count(*) FILTER (WHERE status = 'concluido')::int AS atendimentos,
              count(*) FILTER (WHERE status = 'faltou')::int AS faltas
         FROM agenda_agendamentos
        WHERE negocio_id = $1
          AND (inicio AT TIME ZONE $4)::date BETWEEN $2::date AND $3::date
        GROUP BY profissional_id
     ),
     nota AS (
       SELECT profissional_id, avg(nota) AS media
         FROM agenda_avaliacoes
        WHERE negocio_id = $1 AND criado_em::date BETWEEN $2::date AND $3::date
        GROUP BY profissional_id
     )
     SELECT p.id, p.nome,
            coalesce(at.atendimentos, 0) AS atendimentos,
            coalesce(i.total, 0)::int AS faturamento_cent,
            CASE WHEN coalesce(at.atendimentos,0) = 0 THEN 0
                 ELSE round(coalesce(i.total,0)::numeric / at.atendimentos)::int
            END AS ticket_medio_cent,
            coalesce(i.produto, 0)::int AS produto_cent,
            CASE WHEN coalesce(i.total,0) = 0 THEN 0
                 ELSE round(coalesce(i.produto,0)::numeric / i.total * 100)::int
            END AS produto_pct,
            coalesce(i.comissao, 0)::int AS comissao_cent,
            round(n.media, 1)::float8 AS nota_media,
            coalesce(at.faltas, 0) AS faltas
       FROM agenda_profissionais p
       LEFT JOIN itens i ON i.profissional_id = p.id
       LEFT JOIN atend at ON at.profissional_id = p.id
       LEFT JOIN nota n ON n.profissional_id = p.id
      WHERE p.negocio_id = $1 AND p.ativo
      ORDER BY faturamento_cent DESC`,
    [negocioId, desde, ate, FUSO],
  );
  return rows;
}

export type ResumoAgenda = {
  hoje_agendados: number;
  hoje_concluidos: number;
  hoje_faturado_cent: number;
  semana_ocupacao_pct: number;
  semana_potencial_cent: number;
  sumidos_criticos: number;
  /** Quantos dos que vieram no mes retrasado voltaram no mes passado. */
  retorno_pct: number;
};

// Os numeros do topo do painel. Retorno em 30 dias e o que diz se a barbearia
// esta crescendo ou so trocando de cliente.
export async function resumoAgenda(negocioId: string): Promise<ResumoAgenda> {
  const [{ rows: hoje }, semana, sumidos, { rows: retorno }] = await Promise.all([
    query<{ agendados: number; concluidos: number; faturado: number }>(
      `SELECT count(*) FILTER (WHERE a.status NOT IN ('cancelado','faltou'))::int AS agendados,
              count(*) FILTER (WHERE a.status = 'concluido')::int AS concluidos,
              coalesce((SELECT sum(cm.total_cent) FROM agenda_comandas cm
                         WHERE cm.negocio_id = $1 AND cm.status = 'fechada'
                           AND (cm.fechada_em AT TIME ZONE $2)::date = CURRENT_DATE), 0)::int AS faturado
         FROM agenda_agendamentos a
        WHERE a.negocio_id = $1 AND (a.inicio AT TIME ZONE $2)::date = CURRENT_DATE`,
      [negocioId, FUSO],
    ),
    cadeiraVazia(negocioId, 7),
    clientesSumidos(negocioId, 200),
    query<{ pct: number }>(
      `WITH base AS (
         SELECT DISTINCT cliente_id FROM agenda_agendamentos
          WHERE negocio_id = $1 AND status = 'concluido'
            AND inicio >= now() - interval '60 days'
            AND inicio <  now() - interval '30 days'
       ),
       voltou AS (
         SELECT DISTINCT a.cliente_id FROM agenda_agendamentos a
          JOIN base b ON b.cliente_id = a.cliente_id
          WHERE a.negocio_id = $1 AND a.status = 'concluido'
            AND a.inicio >= now() - interval '30 days'
       )
       SELECT CASE WHEN (SELECT count(*) FROM base) = 0 THEN 0
                   ELSE round((SELECT count(*) FROM voltou)::numeric
                              / (SELECT count(*) FROM base) * 100)::int
              END AS pct`,
      [negocioId],
    ),
  ]);

  const capacidade = semana.reduce((t, d) => t + d.minutos_capacidade, 0);
  const ocupado = semana.reduce((t, d) => t + d.minutos_ocupados, 0);

  return {
    hoje_agendados: hoje[0]?.agendados ?? 0,
    hoje_concluidos: hoje[0]?.concluidos ?? 0,
    hoje_faturado_cent: hoje[0]?.faturado ?? 0,
    semana_ocupacao_pct: capacidade === 0 ? 0 : Math.round((ocupado / capacidade) * 100),
    semana_potencial_cent: semana.reduce((t, d) => t + d.potencial_cent, 0),
    sumidos_criticos: sumidos.filter((s) => s.gravidade === "critico").length,
    retorno_pct: retorno[0]?.pct ?? 0,
  };
}

// ============================================================================
//  FECHAR O ATENDIMENTO
//
//  Concluir nao e so mudar um status. E o momento em que o servico vira
//  dinheiro: nasce a comanda, nasce a comissao do barbeiro e nasce a linha que
//  o raio-X usa pra calcular ticket e valor do minuto de cadeira.
//
//  Por isso vai TUDO NUMA TRANSACAO. Status mudado sem comanda deixaria um
//  atendimento que aconteceu e nao faturou; comanda sem status deixaria o
//  cliente eternamente na cadeira. Qualquer uma das metades sozinha estraga o
//  fechamento do mes.
//
//  A COMISSAO FICA CONGELADA no item, em percentual e em valor. Mudar a
//  comissao da casa em outubro nao pode reescrever o pagamento de setembro.
// ============================================================================
export class AtendimentoJaFechado extends Error {
  constructor() {
    super("Esse atendimento já foi fechado.");
    this.name = "AtendimentoJaFechado";
  }
}

export type FechamentoAtendimento = {
  forma_pagamento?: string | null;
  desconto_cent?: number;
  /** Taxa da maquininha, quando a casa lanca. */
  taxa_cent?: number;
  observacao?: string | null;
};

const FORMAS_PAGAMENTO = new Set([
  "dinheiro", "pix", "debito", "credito", "fiado", "pacote", "cortesia",
]);

export async function concluirAtendimento(
  negocioId: string,
  agendamentoId: string,
  op: FechamentoAtendimento = {},
): Promise<string> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");

    // FOR UPDATE segura a linha ate o commit. Sem isso, dois toques no botao
    // "concluir", ou o balcao e o barbeiro ao mesmo tempo, abrem duas comandas
    // pro mesmo corte, e o caixa do dia conta o servico duas vezes.
    const { rows: ag } = await c.query(
      `SELECT id, status, cliente_id, filial_id
         FROM agenda_agendamentos
        WHERE negocio_id = $1 AND id = $2
        FOR UPDATE`,
      [negocioId, agendamentoId],
    );
    if (!ag[0]) throw new Error("Agendamento não encontrado.");
    if (ag[0].status === "concluido" || ag[0].status === "cancelado") {
      throw new AtendimentoJaFechado();
    }

    const { rows: itens } = await c.query(
      `SELECT asv.servico_id, asv.profissional_id, asv.preco_cent, s.nome,
              coalesce(p.comissao_servico_pct, cfg.comissao_servico_pct) AS pct
         FROM agenda_agendamento_servicos asv
         JOIN agenda_servicos s ON s.id = asv.servico_id
         JOIN agenda_profissionais p ON p.id = asv.profissional_id
         CROSS JOIN agenda_config cfg
        WHERE asv.negocio_id = $1 AND asv.agendamento_id = $2
          AND cfg.negocio_id = $1
        ORDER BY asv.ordem`,
      [negocioId, agendamentoId],
    );
    if (itens.length === 0) throw new Error("Atendimento sem serviço lançado.");

    const subtotal = itens.reduce((t: number, i: { preco_cent: number }) => t + i.preco_cent, 0);
    const descontoInformado = op.desconto_cent ?? 0;
    if (!Number.isSafeInteger(descontoInformado) || descontoInformado < 0) {
      throw new Error("Desconto deve ser um valor positivo em centavos inteiros.");
    }
    const desconto = Math.min(descontoInformado, subtotal);
    const total = subtotal - desconto;
    const taxa = op.taxa_cent ?? 0;
    if (!Number.isSafeInteger(taxa) || taxa < 0) {
      throw new Error("Taxa deve ser um valor positivo em centavos inteiros.");
    }
    if (op.forma_pagamento && !FORMAS_PAGAMENTO.has(op.forma_pagamento)) {
      throw new Error("Forma de pagamento inválida.");
    }

    // Numero curto do dia, o que o balcao fala em voz alta. Reinicia todo dia,
    // senao em um ano a barbearia estaria gritando "comanda 4.812".
    // Serializa os fechamentos do negocio, inclusive de agendamentos diferentes.
    // A trava dura ate COMMIT/ROLLBACK e funciona entre processos do servidor.
    await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`agenda:comanda:${negocioId}`]);
    const { rows: prox } = await c.query(
      `SELECT coalesce(max(numero), 0) + 1 AS n
         FROM agenda_comandas
        WHERE negocio_id = $1
          AND (aberta_em AT TIME ZONE $2)::date = (now() AT TIME ZONE $2)::date`,
      [negocioId, FUSO],
    );

    const { rows: cm } = await c.query(
      `INSERT INTO agenda_comandas
         (negocio_id, filial_id, cliente_id, agendamento_id, numero, status,
          subtotal_cent, desconto_cent, total_cent, taxa_cent, forma_pagamento,
          observacao, fechada_em)
       VALUES ($1,$2,$3,$4,$5,'fechada',$6,$7,$8,$9,$10,$11,now())
       RETURNING id`,
      [negocioId, ag[0].filial_id, ag[0].cliente_id, agendamentoId, prox[0].n,
       subtotal, desconto, total, taxa,
       op.forma_pagamento ?? null, op.observacao ?? null],
    );
    const comandaId: string = cm[0].id;

    let precoAcumulado = 0;
    let descontoDistribuido = 0;
    for (const i of itens) {
      // O desconto sai proporcional ao peso do item, e a comissao incide sobre
      // o que sobrou. Descontar tudo do primeiro item faria o barbeiro do corte
      // pagar sozinho um desconto que a casa deu no combo.
      // Rateia pelo acumulado para distribuir os centavos residuais sem perder
      // dinheiro: a soma dos descontos dos itens e exatamente a da comanda.
      precoAcumulado += i.preco_cent;
      const descontoAcumulado = subtotal === 0 ? 0 : Number(
        BigInt(desconto) * BigInt(precoAcumulado) / BigInt(subtotal),
      );
      const proporcional = descontoAcumulado - descontoDistribuido;
      descontoDistribuido = descontoAcumulado;
      const liquido = i.preco_cent - proporcional;
      const pct = Number(i.pct);
      await c.query(
        `INSERT INTO agenda_comanda_itens
           (negocio_id, comanda_id, tipo, servico_id, profissional_id, descricao,
            quantidade, preco_unit_cent, desconto_cent, total_cent,
            comissao_pct, comissao_cent)
         VALUES ($1,$2,'servico',$3,$4,$5,1,$6,$7,$8,$9,$10)`,
        [negocioId, comandaId, i.servico_id, i.profissional_id, i.nome,
         i.preco_cent, proporcional, liquido, pct, Math.round(liquido * pct / 100)],
      );
    }

    await c.query(
      `UPDATE agenda_agendamentos SET status = 'concluido'
        WHERE negocio_id = $1 AND id = $2`,
      [negocioId, agendamentoId],
    );

    // Fidelidade so pontua se a casa ligou. Extrato, nunca saldo solto.
    const { rows: cfg } = await c.query(
      `SELECT fidelidade_ativa, pontos_por_real FROM agenda_config WHERE negocio_id = $1`,
      [negocioId],
    );
    if (cfg[0]?.fidelidade_ativa && ag[0].cliente_id) {
      const pontos = Math.floor((total / 100) * Number(cfg[0].pontos_por_real));
      if (pontos > 0) {
        await c.query(
          `INSERT INTO agenda_fidelidade_movimentos
             (negocio_id, cliente_id, pontos, motivo, comanda_id)
           VALUES ($1,$2,$3,'Atendimento',$4)`,
          [negocioId, ag[0].cliente_id, pontos, comandaId],
        );
      }
    }

    await c.query("COMMIT");
    return comandaId;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

// Reabre atendimento fechado por engano. A comanda e CANCELADA, nunca apagada:
// comanda que some leva junto o faturamento do dia e a comissao que o barbeiro
// ja conferiu.
export async function reabrirAtendimento(
  negocioId: string,
  agendamentoId: string,
): Promise<void> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    // Mesma ordem de trava do fechamento. Duas reaberturas nao podem estornar
    // os mesmos pontos, nem disputar com um fechamento ainda em andamento.
    const { rows: ag } = await c.query(
      `SELECT id, status FROM agenda_agendamentos
        WHERE negocio_id = $1 AND id = $2 FOR UPDATE`,
      [negocioId, agendamentoId],
    );
    if (!ag[0]) throw new Error("Agendamento não encontrado.");
    if (ag[0].status !== "concluido") {
      throw new Error("Somente atendimento concluído pode ser reaberto.");
    }
    const { rows: comandas } = await c.query<{ id: string }>(
      `UPDATE agenda_comandas SET status = 'cancelada'
        WHERE negocio_id = $1 AND agendamento_id = $2 AND status = 'fechada'
        RETURNING id`,
      [negocioId, agendamentoId],
    );
    for (const comanda of comandas) {
      await c.query(
        `INSERT INTO agenda_fidelidade_movimentos
           (negocio_id, cliente_id, pontos, motivo, comanda_id)
         SELECT negocio_id, cliente_id, -sum(pontos)::int,
                'Estorno por reabertura do atendimento', comanda_id
           FROM agenda_fidelidade_movimentos
          WHERE negocio_id = $1 AND comanda_id = $2
          GROUP BY negocio_id, cliente_id, comanda_id
         HAVING sum(pontos) <> 0`,
        [negocioId, comanda.id],
      );
    }
    await c.query(
      `UPDATE agenda_agendamentos SET status = 'confirmado'
        WHERE negocio_id = $1 AND id = $2`,
      [negocioId, agendamentoId],
    );
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

// ----------------------------------------------------------------------------
//  BORDA · a unica conversao de dinheiro
// ----------------------------------------------------------------------------
export function emReais(cent: number): string {
  return (cent / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// "45", "45,50" e "R$ 1.250,90" viram centavos. O dono digita de todo jeito, e
// float em dinheiro perde centavo.
export function paraCentavos(entrada: string): number {
  const limpo = entrada.replace(/[^0-9,.-]/g, "").trim();
  if (!limpo) return 0;
  // Com virgula, ela e o separador decimal e o ponto e milhar.
  const normal = limpo.includes(",")
    ? limpo.replace(/\./g, "").replace(",", ".")
    : limpo;
  const n = Number(normal);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}
