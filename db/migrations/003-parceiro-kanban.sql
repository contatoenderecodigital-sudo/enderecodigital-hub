-- Kanban de call fria + gravação dentro do lead.
--
-- O lead do parceiro passa a nascer em "a_ligar" (cadastra primeiro, liga depois)
-- e a percorrer etapas até o opt-in. Cada tentativa de ligação vira uma linha em
-- parceiro_calls, com o áudio guardado no volume /data/gravacoes.
--
-- Re-executável: tudo é IF NOT EXISTS ou DROP + recreate de constraint.

SET search_path TO groow, public;

/* ---------------------------------------------------------------- etapas */

ALTER TABLE groow."parceiro_leads"
  ADD COLUMN IF NOT EXISTS "tentativas"       SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "ultima_tentativa" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "proximo_retorno"  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "ordem"            INTEGER NOT NULL DEFAULT 0;

-- Duas etapas novas: "a_ligar" (cadastrado, ainda não ligou) e "nao_atendeu"
-- (tentou e não falou com ninguém), que é o desfecho mais comum de call fria e
-- sem ele não dá para saber se ligou uma vez ou seis.
ALTER TABLE groow."parceiro_leads" DROP CONSTRAINT IF EXISTS "ck_parceiro_leads_situacao";
ALTER TABLE groow."parceiro_leads" ADD CONSTRAINT "ck_parceiro_leads_situacao"
  CHECK ("situacao" IN ('a_ligar', 'nao_atendeu', 'ligou', 'vai_chamar', 'autorizou', 'recusou'));

ALTER TABLE groow."parceiro_leads" ALTER COLUMN "situacao" SET DEFAULT 'a_ligar';

CREATE INDEX IF NOT EXISTS "ix_pl_retorno"
  ON groow."parceiro_leads" ("parceiro_id", "proximo_retorno")
  WHERE "proximo_retorno" IS NOT NULL;

/* ----------------------------------------------------------- gravações */

ALTER TABLE groow."parceiro_calls"
  ADD COLUMN IF NOT EXISTS "audio_path"  VARCHAR(300),
  ADD COLUMN IF NOT EXISTS "audio_mime"  VARCHAR(80),
  ADD COLUMN IF NOT EXISTS "audio_bytes" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "resultado"   TEXT NOT NULL DEFAULT 'atendeu';

-- Desfecho da tentativa. Separado da etapa do lead de propósito: o lead pode
-- estar em "em conversa" e a última tentativa ter caído na caixa postal.
ALTER TABLE groow."parceiro_calls" DROP CONSTRAINT IF EXISTS "ck_parceiro_calls_resultado";
ALTER TABLE groow."parceiro_calls" ADD CONSTRAINT "ck_parceiro_calls_resultado"
  CHECK ("resultado" IN ('atendeu', 'nao_atendeu', 'caixa_postal', 'numero_errado', 'ocupado'));

CREATE INDEX IF NOT EXISTS "ix_call_lead"
  ON groow."parceiro_calls" ("parceiro_lead_id", "criado_em" DESC);

/* ------------------------------------------------------------- backfill */

-- Quem já está cadastrado e nunca teve ligação registrada volta para "a ligar".
-- Só mexe em quem está em 'ligou' sem nenhuma call: os demais têm desfecho real.
UPDATE groow."parceiro_leads" pl
   SET "situacao" = 'a_ligar'
 WHERE pl."situacao" = 'ligou'
   AND NOT EXISTS (SELECT 1 FROM groow."parceiro_calls" c WHERE c."parceiro_lead_id" = pl."id");
