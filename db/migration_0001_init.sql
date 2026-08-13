-- ============================================================================
-- migration_0001_init.sql — Endereço Digital Hub. Migração inicial completa.
-- Camada de hub (este repo) + tabelas do blueprint (nível Cliente). Idempotente
-- via IF NOT EXISTS onde possível. Roda em Postgres 15.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------- NÍVEL 2: hubs -------------------------------------------
CREATE TABLE IF NOT EXISTS hubs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome          TEXT NOT NULL,
    slug          TEXT NOT NULL UNIQUE,
    dominio       TEXT UNIQUE,
    versao        TEXT NOT NULL DEFAULT '1.0.0',
    logo_url      TEXT,
    favicon_url   TEXT,
    descricao     TEXT,
    login_titulo  TEXT,
    login_botao   TEXT,
    tema_modo     TEXT NOT NULL DEFAULT 'escuro' CHECK (tema_modo IN ('escuro','claro')),
    cor_destaque  TEXT,
    cor_apoio     TEXT,
    cor_fundo     TEXT,
    cor_texto     TEXT,
    tipografia    TEXT NOT NULL DEFAULT 'moderna' CHECK (tipografia IN ('moderna','classica','mono')),
    mod_site        BOOLEAN NOT NULL DEFAULT TRUE,
    mod_instagram   BOOLEAN NOT NULL DEFAULT TRUE,
    mod_financeiro  BOOLEAN NOT NULL DEFAULT FALSE,
    mod_crm         BOOLEAN NOT NULL DEFAULT FALSE,
    ativo         BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hubs_ativo ON hubs (ativo);

-- ---------------- NÍVEL 3: negocios (tenants) -----------------------------
CREATE TABLE IF NOT EXISTS negocios (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hub_id        UUID NOT NULL REFERENCES hubs(id) ON DELETE RESTRICT,
    slug          TEXT NOT NULL UNIQUE,
    nome          TEXT NOT NULL,
    nome_fantasia TEXT,
    segmento      TEXT,
    marca_cor     TEXT,
    marca_logo    TEXT,
    resp_nome     TEXT,
    resp_cargo    TEXT,
    resp_email    TEXT,
    resp_whatsapp TEXT,
    dominio       TEXT,
    site_url      TEXT,
    instagram_url TEXT,
    wpp_comercial TEXT,
    mod_site       BOOLEAN,
    mod_instagram  BOOLEAN,
    mod_financeiro BOOLEAN,
    mod_crm        BOOLEAN,
    tipo_cliente  TEXT NOT NULL DEFAULT 'nao_definido' CHECK (tipo_cliente IN ('recorrente','nao_recorrente','nao_definido')),
    experimental  BOOLEAN NOT NULL DEFAULT FALSE,
    health_score  INTEGER NOT NULL DEFAULT 100 CHECK (health_score BETWEEN 0 AND 100),
    observacoes   TEXT,
    ia_habilitada     BOOLEAN NOT NULL DEFAULT TRUE,
    ia_modo           TEXT NOT NULL DEFAULT 'api_plataforma' CHECK (ia_modo IN ('api_plataforma','claude_cliente','sem_ia')),
    conta_claude_id   UUID,
    ia_modelo_chat    TEXT,
    ia_modelo_gerador TEXT,
    ia_limite_tokens  BIGINT NOT NULL DEFAULT 0,
    status        TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','em_configuracao','arquivado')),
    ativo         BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_negocios_hub ON negocios (hub_id);
CREATE INDEX IF NOT EXISTS idx_negocios_status ON negocios (status);

-- ---------------- usuarios (3 níveis de papel) ----------------------------
CREATE TABLE IF NOT EXISTS usuarios (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id  UUID REFERENCES negocios(id) ON DELETE CASCADE,
    hub_id      UUID REFERENCES hubs(id) ON DELETE CASCADE,
    email       TEXT NOT NULL,
    senha_hash  TEXT NOT NULL,
    papel       TEXT NOT NULL DEFAULT 'operador' CHECK (papel IN ('owner_plataforma','admin_hub','dono','operador')),
    ativo       BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_usuario_escopo CHECK (
        (papel = 'owner_plataforma' AND negocio_id IS NULL AND hub_id IS NULL) OR
        (papel = 'admin_hub'        AND hub_id IS NOT NULL AND negocio_id IS NULL) OR
        (papel IN ('dono','operador') AND negocio_id IS NOT NULL)
    )
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_usuarios_email_negocio ON usuarios (negocio_id, email) WHERE negocio_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_usuarios_email_owner ON usuarios (email) WHERE papel = 'owner_plataforma';
CREATE INDEX IF NOT EXISTS idx_usuarios_negocio ON usuarios (negocio_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_hub ON usuarios (hub_id);

-- ---------------- contas_claude + uso_ia ----------------------------------
CREATE TABLE IF NOT EXISTS contas_claude (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hub_id    UUID REFERENCES hubs(id) ON DELETE SET NULL,
    nome      TEXT NOT NULL,
    tipo      TEXT NOT NULL DEFAULT 'dedicada' CHECK (tipo IN ('compartilhada','dedicada')),
    plano     TEXT,
    token_ref TEXT,
    status    TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','reautenticar','inativa')),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS uso_ia (
    id         BIGSERIAL PRIMARY KEY,
    negocio_id UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    origem     TEXT NOT NULL,
    modelo     TEXT NOT NULL,
    tokens_in  BIGINT NOT NULL DEFAULT 0,
    tokens_out BIGINT NOT NULL DEFAULT 0,
    custo_cent INTEGER NOT NULL DEFAULT 0,
    criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_uso_ia_negocio ON uso_ia (negocio_id);
CREATE INDEX IF NOT EXISTS idx_uso_ia_negocio_data ON uso_ia (negocio_id, criado_em);

-- ---------------- Blueprint: nível Cliente (WhatsApp, cérebro, dados) ------
CREATE TABLE IF NOT EXISTS wa_conexoes (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id       UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    waba_id          TEXT NOT NULL,
    phone_number_id  TEXT NOT NULL UNIQUE,
    access_token     TEXT NOT NULL,
    status           TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','conectado','erro','desconectado')),
    criado_em        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wa_conexoes_negocio ON wa_conexoes (negocio_id);

CREATE TABLE IF NOT EXISTS wa_onboarding_states (
    state       TEXT PRIMARY KEY,
    negocio_id  UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    expira_em   TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_onboarding_negocio ON wa_onboarding_states (negocio_id);

CREATE TABLE IF NOT EXISTS base_conhecimento (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id  UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    titulo      TEXT,
    conteudo    TEXT NOT NULL,
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_base_conhecimento_negocio ON base_conhecimento (negocio_id);

CREATE TABLE IF NOT EXISTS conversas (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id   UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    contato_num  TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','fechada','pausada')),
    criado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_conversas_negocio ON conversas (negocio_id);
CREATE INDEX IF NOT EXISTS idx_conversas_negocio_contato ON conversas (negocio_id, contato_num);

CREATE TABLE IF NOT EXISTS mensagens (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id   UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    conversa_id  UUID REFERENCES conversas(id) ON DELETE CASCADE,
    direcao      TEXT NOT NULL CHECK (direcao IN ('entrada','saida')),
    de_numero    TEXT NOT NULL,
    texto        TEXT NOT NULL,
    wamid        TEXT,
    criado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mensagens_negocio ON mensagens (negocio_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_negocio_conversa ON mensagens (negocio_id, conversa_id);

CREATE TABLE IF NOT EXISTS pedidos (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id   UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    contato_num  TEXT NOT NULL,
    descricao    TEXT NOT NULL,
    valor_cent   INTEGER NOT NULL DEFAULT 0,
    status       TEXT NOT NULL DEFAULT 'novo',
    criado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pedidos_negocio ON pedidos (negocio_id);

CREATE TABLE IF NOT EXISTS auditoria (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ator_usuario_id  TEXT NOT NULL,
    negocio_id_alvo  UUID REFERENCES negocios(id) ON DELETE CASCADE,
    hub_id_alvo      UUID REFERENCES hubs(id) ON DELETE CASCADE,
    acao             TEXT NOT NULL,
    detalhe          TEXT,
    criado_em        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auditoria_negocio ON auditoria (negocio_id_alvo);
CREATE INDEX IF NOT EXISTS idx_auditoria_ator ON auditoria (ator_usuario_id);
