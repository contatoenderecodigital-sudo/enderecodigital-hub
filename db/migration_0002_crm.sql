-- ============================================================================
-- migration_0002_crm.sql — CRM/Funil de leads (por tenant). Idempotente.
-- ============================================================================

-- token de captura de lead (pro formulario no site do cliente)
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS captura_token TEXT UNIQUE;

-- etapas do funil (por tenant)
CREATE TABLE IF NOT EXISTS funil_etapas (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  nome       TEXT NOT NULL,
  ordem      INTEGER NOT NULL DEFAULT 0,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_funil_etapas_negocio ON funil_etapas (negocio_id, ordem);

-- leads (sempre escopados por negocio_id)
CREATE TABLE IF NOT EXISTS leads (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id   UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  nome         TEXT NOT NULL,
  telefone     TEXT,
  email        TEXT,
  origem       TEXT,
  etapa_id     UUID REFERENCES funil_etapas(id) ON DELETE SET NULL,
  valor_cent   INTEGER NOT NULL DEFAULT 0,
  observacoes  TEXT,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_leads_negocio ON leads (negocio_id);
CREATE INDEX IF NOT EXISTS idx_leads_etapa ON leads (etapa_id);
