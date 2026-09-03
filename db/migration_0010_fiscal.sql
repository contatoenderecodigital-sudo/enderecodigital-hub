-- ============================================================================
-- migration_0010_fiscal.sql — NFC-e de verdade.
-- ----------------------------------------------------------------------------
-- Em Santa Catarina é NFC-e (o SAT é só São Paulo, e lá o SAT acabou em
-- 31/12/2025: desde 01/01/2026 é NFC-e no varejo paulista também). A nota sai
-- no CNPJ do restaurante, com o certificado A1 dele, e quem fala com a SEFAZ é
-- um integrador. O escolhido é o Focus NFe, porque cobra por CNPJ e não por
-- nota, e porque a API dele é assíncrona de propósito: manda e pergunta depois.
--
-- A regra que manda aqui: SEFAZ fora do ar NÃO pode segurar a mesa. A venda
-- fecha, a nota entra na fila, e a fila insiste. Isso já estava desenhado na
-- `food_fiscal_fila` da migração 0005; aqui ela ganha o que faltava para
-- emitir de verdade.
--
-- Idempotente: pode rodar duas vezes.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. A LOJA: o que a nota precisa saber sobre quem emite
-- ----------------------------------------------------------------------------
ALTER TABLE food_lojas ADD COLUMN IF NOT EXISTS fiscal_serie          INTEGER NOT NULL DEFAULT 1;
ALTER TABLE food_lojas ADD COLUMN IF NOT EXISTS fiscal_regime         TEXT NOT NULL DEFAULT 'simples'
  CHECK (fiscal_regime IN ('simples','simples_excesso','normal'));
-- Padrões que valem quando o produto não tem os dele. Bar e restaurante no
-- Simples costumam ser CSOSN 102 e CFOP 5102 (venda de mercadoria dentro do
-- estado). Quem tem contador manda mudar; o campo existe para isso.
ALTER TABLE food_lojas ADD COLUMN IF NOT EXISTS fiscal_csosn_padrao   TEXT NOT NULL DEFAULT '102';
ALTER TABLE food_lojas ADD COLUMN IF NOT EXISTS fiscal_cst_padrao     TEXT NULL;
ALTER TABLE food_lojas ADD COLUMN IF NOT EXISTS fiscal_cfop_padrao    TEXT NOT NULL DEFAULT '5102';
ALTER TABLE food_lojas ADD COLUMN IF NOT EXISTS fiscal_ncm_padrao     TEXT NOT NULL DEFAULT '21069090';
ALTER TABLE food_lojas ADD COLUMN IF NOT EXISTS fiscal_uf             TEXT NULL;
ALTER TABLE food_lojas ADD COLUMN IF NOT EXISTS fiscal_municipio      TEXT NULL;
ALTER TABLE food_lojas ADD COLUMN IF NOT EXISTS fiscal_cep            TEXT NULL;
ALTER TABLE food_lojas ADD COLUMN IF NOT EXISTS fiscal_ie             TEXT NULL;
ALTER TABLE food_lojas ADD COLUMN IF NOT EXISTS fiscal_razao          TEXT NULL;
-- Emite sozinho quando a comanda é paga, ou só quando o cliente pede a nota?
ALTER TABLE food_lojas ADD COLUMN IF NOT EXISTS fiscal_automatico     BOOLEAN NOT NULL DEFAULT TRUE;

-- ----------------------------------------------------------------------------
-- 2. A FILA: o que faltava para emitir, acompanhar e cancelar
-- ----------------------------------------------------------------------------
-- A referência única que vai para o integrador. É ela que torna a emissão
-- idempotente: reenviar a mesma referência não gera segunda nota.
ALTER TABLE food_fiscal_fila ADD COLUMN IF NOT EXISTS referencia   TEXT NULL;
ALTER TABLE food_fiscal_fila ADD COLUMN IF NOT EXISTS ambiente     TEXT NULL;
ALTER TABLE food_fiscal_fila ADD COLUMN IF NOT EXISTS valor        NUMERIC(12,2) NULL;
ALTER TABLE food_fiscal_fila ADD COLUMN IF NOT EXISTS chave        TEXT NULL;
ALTER TABLE food_fiscal_fila ADD COLUMN IF NOT EXISTS numero       TEXT NULL;
ALTER TABLE food_fiscal_fila ADD COLUMN IF NOT EXISTS serie        TEXT NULL;
ALTER TABLE food_fiscal_fila ADD COLUMN IF NOT EXISTS protocolo    TEXT NULL;
ALTER TABLE food_fiscal_fila ADD COLUMN IF NOT EXISTS url_danfe    TEXT NULL;
ALTER TABLE food_fiscal_fila ADD COLUMN IF NOT EXISTS url_xml      TEXT NULL;
ALTER TABLE food_fiscal_fila ADD COLUMN IF NOT EXISTS qrcode       TEXT NULL;
ALTER TABLE food_fiscal_fila ADD COLUMN IF NOT EXISTS enviado_em   TIMESTAMPTZ NULL;
ALTER TABLE food_fiscal_fila ADD COLUMN IF NOT EXISTS emitida_em   TIMESTAMPTZ NULL;
ALTER TABLE food_fiscal_fila ADD COLUMN IF NOT EXISTS cancelada_em TIMESTAMPTZ NULL;
ALTER TABLE food_fiscal_fila ADD COLUMN IF NOT EXISTS cancel_motivo TEXT NULL;
-- O que foi mandado e o que voltou, palavra por palavra. Quando o contador
-- perguntar "por que essa nota não saiu", a resposta está aqui.
ALTER TABLE food_fiscal_fila ADD COLUMN IF NOT EXISTS enviado_json JSONB NULL;
ALTER TABLE food_fiscal_fila ADD COLUMN IF NOT EXISTS retorno_json JSONB NULL;

ALTER TABLE food_fiscal_fila DROP CONSTRAINT IF EXISTS food_fiscal_fila_status_check;
ALTER TABLE food_fiscal_fila ADD CONSTRAINT food_fiscal_fila_status_check
  CHECK (status IN ('pendente','processando','emitida','erro','cancelada','desistiu'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_food_fiscal_ref
  ON food_fiscal_fila (referencia) WHERE referencia IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 3. CPF na nota, que o cliente digita na mesa
-- ----------------------------------------------------------------------------
ALTER TABLE food_sessoes  ADD COLUMN IF NOT EXISTS cpf_nota TEXT NULL;
ALTER TABLE food_pedidos  ADD COLUMN IF NOT EXISTS cpf_nota TEXT NULL;

-- ============================================================================
-- FIM
-- ============================================================================
