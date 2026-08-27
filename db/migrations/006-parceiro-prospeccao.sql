-- Prospeccao no painel do parceiro, com teto de busca.
--
-- Cada busca chama a API do Google Places, que e cobrada por requisicao e paga
-- pelo dono. A rota de admin nao tem freio porque so o dono acessa; abrindo
-- para o parceiro sem teto, uma tarde de cliques vira conta no fim do mes.
--
-- ATENCAO: nao existe migration runner. Aplicar na mao. Reexecutavel.

SET search_path TO groow, public;

ALTER TABLE groow."parceiros"
  -- Buscas por dia. Zero desliga a prospeccao para esse parceiro.
  ADD COLUMN IF NOT EXISTS "buscas_por_dia" SMALLINT NOT NULL DEFAULT 20;

-- Contador diario. Em tabela e nao em memoria de proposito: o rate limit em
-- memoria zera a cada deploy, e aqui o que esta sendo protegido e dinheiro.
CREATE TABLE IF NOT EXISTS groow."parceiro_buscas" (
  "parceiro_id" INTEGER NOT NULL,
  "dia"         DATE NOT NULL,
  "total"       INTEGER NOT NULL DEFAULT 0,
  "ultima_em"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("parceiro_id", "dia")
);

CREATE INDEX IF NOT EXISTS "ix_parceiro_buscas_dia"
  ON groow."parceiro_buscas" ("dia" DESC);
