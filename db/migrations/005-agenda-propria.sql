-- Agenda propria, com o Google Calendar por baixo no lugar do Cal.com.
--
-- O motor de agenda passa a ser nosso: as regras moram aqui, as vagas sao
-- geradas por lib/groow/agenda.ts e o Google entra so para dois papeis, dizer
-- o que ja esta ocupado e criar o evento com o link do Meet.
--
-- ATENCAO: nao existe migration runner neste projeto. Aplicar na mao, igual as
-- anteriores. Reexecutavel.

SET search_path TO groow, public;

/* ------------------------------------------------- conexao com o Google */

-- Uma linha so, id = 1. Nao e multi-tenant de proposito: quem agenda e a
-- Endereco Digital, e o dia que virar produto para cliente isto vira tabela
-- com negocio_id, nao antes.
CREATE TABLE IF NOT EXISTS groow."google_conta" (
  "id"            SMALLINT NOT NULL DEFAULT 1,
  "email"         VARCHAR(190),
  "calendar_id"   VARCHAR(190) NOT NULL DEFAULT 'primary',
  -- refresh_token e credencial de verdade: guardado cifrado com SENHAS_CHAVE,
  -- nunca cru. Ver lib/groow/segredos.ts.
  "refresh_token" TEXT,
  "access_token"  TEXT,
  "expira_em"     TIMESTAMPTZ,
  "escopo"        TEXT,
  "conectado_em"  TIMESTAMPTZ,
  "atualizado_em" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("id"),
  CONSTRAINT "ck_google_conta_unica" CHECK ("id" = 1)
);

INSERT INTO groow."google_conta" ("id") VALUES (1) ON CONFLICT DO NOTHING;

/* ---------------------------------------------------- regras da agenda */

-- Tambem linha unica. Sao as mesmas regras que estavam no Cal, agora nossas.
CREATE TABLE IF NOT EXISTS groow."agenda_config" (
  "id"                SMALLINT NOT NULL DEFAULT 1,
  "titulo"            VARCHAR(120) NOT NULL DEFAULT 'Diagnóstico',
  "descricao"         TEXT,
  "duracao_min"       SMALLINT NOT NULL DEFAULT 30,
  -- intervalo depois do evento, para nao emendar uma call na outra
  "intervalo_min"     SMALLINT NOT NULL DEFAULT 15,
  -- aviso minimo em horas: impede alguem marcar para daqui vinte minutos
  "aviso_min_horas"   SMALLINT NOT NULL DEFAULT 4,
  -- ate quantos dias corridos para a frente da para marcar
  "janela_dias"       SMALLINT NOT NULL DEFAULT 10,
  -- teto de reunioes por dia, para um dia bom nao virar oito calls
  "max_por_dia"       SMALLINT NOT NULL DEFAULT 4,
  "fuso"              VARCHAR(60) NOT NULL DEFAULT 'America/Sao_Paulo',
  -- janelas por dia da semana: [{dia:1, de:"09:00", ate:"11:30"}, ...]
  -- dia segue getDay() do JS: 0 domingo, 6 sabado.
  "janelas"           JSONB NOT NULL DEFAULT '[]'::jsonb,
  "ativo"             SMALLINT NOT NULL DEFAULT 1,
  "atualizado_em"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("id"),
  CONSTRAINT "ck_agenda_config_unica" CHECK ("id" = 1)
);

-- Semeia com exatamente o que foi configurado no Cal, para a troca de motor
-- nao mudar a disponibilidade no meio do caminho.
INSERT INTO groow."agenda_config" ("id", "janelas", "descricao")
VALUES (
  1,
  '[
    {"dia":1,"de":"09:00","ate":"11:30"},{"dia":1,"de":"14:30","ate":"20:30"},
    {"dia":2,"de":"09:00","ate":"11:30"},{"dia":2,"de":"14:30","ate":"20:30"},
    {"dia":3,"de":"09:00","ate":"11:30"},{"dia":3,"de":"14:30","ate":"20:30"},
    {"dia":4,"de":"09:00","ate":"11:30"},{"dia":4,"de":"14:30","ate":"20:30"},
    {"dia":5,"de":"09:00","ate":"11:30"},{"dia":5,"de":"14:30","ate":"20:30"},
    {"dia":6,"de":"14:30","ate":"20:30"}
  ]'::jsonb,
  'Trinta minutos por vídeo. Te mostramos como está o seu perfil no Google hoje, como ficaria o seu site e a proposta.'
)
ON CONFLICT DO NOTHING;

/* ------------------------------------------- reservas da agenda propria */

-- Espelha cal_agendamentos de proposito: enquanto os dois motores convivem, as
-- telas leem os dois e ninguem perde reuniao na virada.
ALTER TABLE groow."cal_agendamentos"
  -- de onde veio: 'cal' (Cal.com) ou 'google' (motor proprio)
  ADD COLUMN IF NOT EXISTS "origem"          VARCHAR(12) NOT NULL DEFAULT 'cal',
  -- id do evento no Google, para remarcar e cancelar depois
  ADD COLUMN IF NOT EXISTS "google_event_id" VARCHAR(190),
  -- token do link publico de remarcar/cancelar, que vai no WhatsApp
  ADD COLUMN IF NOT EXISTS "token_publico"   VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_agend_token"
  ON groow."cal_agendamentos" ("token_publico")
  WHERE "token_publico" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_agend_google_event"
  ON groow."cal_agendamentos" ("google_event_id")
  WHERE "google_event_id" IS NOT NULL;

-- Trava contra dois cliques pegarem a mesma vaga. O unique no horario e a unica
-- garantia real: checar antes e inserir depois tem janela de corrida.
CREATE UNIQUE INDEX IF NOT EXISTS "uq_agend_horario"
  ON groow."cal_agendamentos" ("reuniao_em")
  WHERE "status" IN ('marcada', 'remarcada');
