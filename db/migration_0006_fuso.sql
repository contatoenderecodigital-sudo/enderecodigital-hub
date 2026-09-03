-- ============================================================================
-- migration_0006_fuso.sql — O dia da CASA, não o dia do servidor.
-- ----------------------------------------------------------------------------
-- O banco roda em UTC (conferido: `current_setting('TimeZone')` = UTC). Como
-- todo o código usava `CURRENT_DATE` e `localtime`, acontecia isto:
--
--   1. às 21h de Xanxerê já é meia-noite em UTC. No meio do jantar de sábado o
--      número do pedido voltava para 1 e o relatório do dia zerava, partindo a
--      noite de trabalho em dois dias;
--   2. o horário de funcionamento era comparado em UTC: um bar que abre das 18h
--      às 23h era avaliado como 18h-23h UTC, ou seja, 15h-20h locais. O delivery
--      recusava pedido às 21h dizendo "fechada", e aceitava às 15h30 com a casa
--      de portas fechadas.
--
-- A coluna `food_lojas.fuso` já existia desde a primeira migração e nunca era
-- lida. Agora é ela que manda, por estas três funções.
--
-- Idempotente: pode rodar duas vezes.
-- ============================================================================

-- O fuso da loja, com queda para o horário de Brasília quando não houver.
CREATE OR REPLACE FUNCTION food_fuso_loja(p_loja UUID)
RETURNS TEXT LANGUAGE sql STABLE AS $func$
  SELECT COALESCE(NULLIF((SELECT fuso FROM food_lojas WHERE id = p_loja), ''), 'America/Sao_Paulo')
$func$;

-- O "agora" da casa. É o que substitui now() em toda conta de dia e de hora.
CREATE OR REPLACE FUNCTION food_agora_loja(p_loja UUID)
RETURNS TIMESTAMP LANGUAGE sql STABLE AS $func$
  SELECT (now() AT TIME ZONE food_fuso_loja(p_loja))
$func$;

-- O dia da casa. Vira à meia-noite DELA, não à meia-noite de Greenwich.
CREATE OR REPLACE FUNCTION food_dia_loja(p_loja UUID)
RETURNS DATE LANGUAGE sql STABLE AS $func$
  SELECT (food_agora_loja(p_loja))::date
$func$;

-- ----------------------------------------------------------------------------
-- A loja está aberta agora? Compara no fuso dela e entende faixa que vira a
-- madrugada (bar que abre 18h e fecha 02h é a regra, não a exceção).
-- ----------------------------------------------------------------------------
-- A REGRA, com a hora entrando por parametro. Fica assim para poder ser testada
-- com um relogio fixo: regra de horario que so da para conferir "as 21h de uma
-- terca" e teste que passa ou falha conforme a hora em que roda.
CREATE OR REPLACE FUNCTION food_aberta_em(p_loja UUID, p_quando TIMESTAMP)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $func$
  -- Casa sem horário cadastrado conta como ABERTA. O dono que ainda não
  -- preencheu a agenda não pode ficar impedido de vender por causa disso.
  SELECT NOT EXISTS (SELECT 1 FROM food_horarios WHERE loja_id = p_loja)
      OR EXISTS (
    SELECT 1
      FROM food_horarios h
     WHERE h.loja_id = p_loja
       AND (
             -- faixa normal: 11:30 às 14:00 do mesmo dia
             (h.fecha > h.abre
              AND h.dia_semana = EXTRACT(DOW FROM p_quando)::int
              AND p_quando::time BETWEEN h.abre AND h.fecha)
             -- faixa que vira a madrugada: sábado 18:00 às 02:00
             OR (h.fecha < h.abre
                 AND (
                       (h.dia_semana = EXTRACT(DOW FROM p_quando)::int AND p_quando::time >= h.abre)
                    OR (h.dia_semana = (EXTRACT(DOW FROM p_quando)::int + 6) % 7 AND p_quando::time <= h.fecha)
                 ))
           )
  )
$func$;

CREATE OR REPLACE FUNCTION food_loja_aberta(p_loja UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $func$
  SELECT food_aberta_em(p_loja, food_agora_loja(p_loja))
$func$;

-- ----------------------------------------------------------------------------
-- O `dia` do pedido deixa de nascer do relógio do servidor. Quem grava passa a
-- ser o código, com `food_dia_loja()`. O default fica só como rede de proteção.
-- ----------------------------------------------------------------------------
COMMENT ON COLUMN food_pedidos.dia IS
  'Dia da CASA (fuso da loja), gravado por criarPedido via food_dia_loja(). Nunca CURRENT_DATE.';

-- ============================================================================
-- FIM
-- ============================================================================
