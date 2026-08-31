-- Base separada do funil, e exclusao de lead.
--
-- Empresa vinda da prospeccao caia direto no kanban, e o quadro enchia de gente
-- que o parceiro nem olhou ainda. Agora ela entra na BASE e ele escolhe quem
-- vai para o funil.
--
-- Default 1 de proposito: quem se cadastrou na landing pediu contato, e quem
-- ele digitou na mao ele ja escolheu. So a importacao do Places entra com 0.
--
-- ATENCAO: nao existe migration runner. Aplicar na mao. Reexecutavel.

SET search_path TO groow, public;

ALTER TABLE groow."parceiro_leads"
  ADD COLUMN IF NOT EXISTS "no_funil" SMALLINT NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS "ix_pl_funil"
  ON groow."parceiro_leads" ("parceiro_id", "no_funil");
