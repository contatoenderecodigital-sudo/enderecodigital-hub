-- ============================================================================
-- Migração: telas de PLATAFORMA do console (owner).
-- Tabelas de apoio para Feature Flags, Suporte, Assentos Claude e Modelos.
-- Tudo escopado por hub_id (multi-tenant). Rodar no Postgres do VPS.
-- Idempotente: CREATE TABLE IF NOT EXISTS.
-- ============================================================================

-- ---- Feature Flags por hub ----
-- Liga/desliga funcionalidades por hub. A UI conhece as chaves padrão;
-- aqui guardamos só o override (quando o dono mexe no toggle).
CREATE TABLE IF NOT EXISTS hub_flags (
  hub_id     UUID        NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
  chave      TEXT        NOT NULL,
  ligado     BOOLEAN     NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (hub_id, chave)
);

-- ---- Chamados de suporte (por hub) ----
CREATE TABLE IF NOT EXISTS hub_tickets (
  id         SERIAL PRIMARY KEY,
  hub_id     UUID        NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
  assunto    TEXT        NOT NULL,
  mensagem   TEXT        NOT NULL DEFAULT '',
  prioridade TEXT        NOT NULL DEFAULT 'normal',   -- baixa | normal | alta
  status     TEXT        NOT NULL DEFAULT 'aberto',    -- aberto | resolvido
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_hub_tickets_hub ON hub_tickets (hub_id, status);

-- ---- Assentos Claude (quando o cliente traz a própria assinatura) ----
-- O padrão da plataforma é a API central medida; assento é a exceção.
-- Guardamos só a REFERÊNCIA do token (nunca o token cru — esse vive na VPS, root 0600).
CREATE TABLE IF NOT EXISTS ia_assentos (
  id         SERIAL PRIMARY KEY,
  hub_id     UUID        NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
  cliente    TEXT        NOT NULL DEFAULT '',
  plano      TEXT        NOT NULL DEFAULT 'Pro',       -- Pro | Max | Max20x | Team
  token_ref  TEXT        NOT NULL DEFAULT '',          -- apelido/arquivo, nunca o token
  status     TEXT        NOT NULL DEFAULT 'ativo',     -- ativo | reautenticar | inativo
  notas      TEXT        NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ia_assentos_hub ON ia_assentos (hub_id);

-- ---- Modelos padrão do hub (biblioteca de design usada no gerador) ----
CREATE TABLE IF NOT EXISTS hub_modelos (
  id         SERIAL PRIMARY KEY,
  hub_id     UUID        NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
  tipo       TEXT        NOT NULL DEFAULT 'post',      -- post | carrossel | story
  nome       TEXT        NOT NULL,
  nicho      TEXT        NOT NULL DEFAULT '',
  thumb_url  TEXT        NOT NULL DEFAULT '',
  link_url   TEXT        NOT NULL DEFAULT '',          -- link do Canva / referência
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hub_modelos_hub ON hub_modelos (hub_id, tipo);
