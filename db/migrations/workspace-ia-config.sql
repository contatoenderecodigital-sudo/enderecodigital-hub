-- ============================================================================
-- Tokens & IA (console do owner) — config multi-provedor por workspace + limite do hub.
-- Idempotente: CREATE TABLE/INDEX IF NOT EXISTS. Rode com o role do hub no db
-- enderecodigital_hub. A app também tenta criar estas tabelas em runtime
-- (ensureTabelas em lib/tokens-ia.ts); esta migração é o registro oficial.
-- ============================================================================

-- Config de IA de cada cliente/workspace do hub.
-- Fica AQUI (não em negocios) porque negocios não tem colunas de provedor,
-- apelido-de-chave e trava-de-teto. Ao salvar, a app ESPELHA modelo+limite
-- nas colunas negocios.ia_modelo_chat / ia_limite_tokens (que o painel do hub lê).
CREATE TABLE IF NOT EXISTS workspace_ia_config (
    hub_id        UUID        NOT NULL,
    negocio_id    UUID        NOT NULL PRIMARY KEY,
    provedor      TEXT        NOT NULL DEFAULT 'openai',   -- 'openai' | 'gemini' | 'claude'
    modelo        TEXT        NOT NULL DEFAULT 'gpt-4o-mini',
    limite_tokens BIGINT      NOT NULL DEFAULT 0,          -- 0 = ilimitado
    travado       BOOLEAN     NOT NULL DEFAULT FALSE,      -- teto travado pelo owner
    chave_ref     TEXT        NULL,                        -- APELIDO/ref da chave própria do cliente (nunca o token cru)
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wia_hub ON workspace_ia_config (hub_id);

-- Limite GLOBAL de tokens do hub (0 = ilimitado).
CREATE TABLE IF NOT EXISTS hub_ia_config (
    hub_id        UUID        NOT NULL PRIMARY KEY,
    limite_tokens BIGINT      NOT NULL DEFAULT 0,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- FASE 2 (propagação p/ schema de cliente EXTERNO, ex: docepao.negocios.config):
--   Requer (a) grant de escrita ao schema do cliente e (b) mapeamento
--   hub.negocio_id -> tenant do cliente. Quando existir, a app poderia rodar algo como:
--     UPDATE docepao.negocios
--        SET config = jsonb_set(
--              jsonb_set(config, '{provedor_ia}', to_jsonb($provedor::text), true),
--              '{modelo}', to_jsonb($modelo::text), true)
--      WHERE id = $tenant_id;
--   Enquanto isso não existe, a config vale para os tenants do PRÓPRIO hub
--   (espelhada em negocios.ia_modelo_chat / ia_limite_tokens).
-- ----------------------------------------------------------------------------
