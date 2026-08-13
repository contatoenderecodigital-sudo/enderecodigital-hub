-- ============================================================================
-- schema.sql — Endereço Digital Hub (plataforma multi-hub, multi-tenant).
-- ----------------------------------------------------------------------------
-- Postgres. ESTENDE o blueprint em ../site-enderecodigital/docs/multitenant/.
--
-- Os 3 níveis:
--   PLATAFORMA  -> implícita (o deploy inteiro). Dono = usuário owner_plataforma.
--   HUB         -> tabela `hubs` (marca white-label: tema/logo/módulos/domínio).
--   CLIENTE     -> tabela `negocios` (workspace do cliente; nasce dentro de 1 hub).
--
-- Regra de ouro (do blueprint): TODA tabela de dado de cliente tem
-- `negocio_id NOT NULL` + índice; o isolamento é em código (scopedDb).
-- A camada de hub NÃO relaxa isso — só agrupa negócios por marca.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- hubs — NÍVEL 2. Cada hub é uma marca white-label completa.
-- Ex.: "Endereço Digital", "ClinicDigital". Equivale a MazyoHub/Hub3D/OdontoHub.
-- ----------------------------------------------------------------------------
CREATE TABLE hubs (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome             TEXT        NOT NULL,
    slug             TEXT        NOT NULL UNIQUE,       -- chave interna + subdomínio sugerido
    dominio          TEXT        NULL UNIQUE,           -- host header que resolve este hub
    versao           TEXT        NOT NULL DEFAULT '1.0.0',

    -- Identidade visual (o "Visual" do wizard de criar hub)
    logo_url         TEXT        NULL,
    favicon_url      TEXT        NULL,
    descricao        TEXT        NULL,                  -- descrição PWA
    login_titulo     TEXT        NULL,
    login_botao      TEXT        NULL,
    tema_modo        TEXT        NOT NULL DEFAULT 'escuro' CHECK (tema_modo IN ('escuro','claro')),
    cor_destaque     TEXT        NULL,                  -- hex
    cor_apoio        TEXT        NULL,
    cor_fundo        TEXT        NULL,
    cor_texto        TEXT        NULL,
    tipografia       TEXT        NOT NULL DEFAULT 'moderna'
                     CHECK (tipografia IN ('moderna','classica','mono')),

    -- Módulos default do hub (herdados por cada cliente novo; cliente pode sobrepor).
    -- Visão Geral, Claude e Configurações são sempre presentes; estes são opt-in:
    mod_site         BOOLEAN     NOT NULL DEFAULT TRUE,
    mod_instagram    BOOLEAN     NOT NULL DEFAULT TRUE,
    mod_financeiro   BOOLEAN     NOT NULL DEFAULT FALSE,
    mod_crm          BOOLEAN     NOT NULL DEFAULT FALSE, -- CRM é opt-in (pesa na VPS)

    ativo            BOOLEAN     NOT NULL DEFAULT TRUE,
    criado_em        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hubs_ativo ON hubs (ativo);

-- ----------------------------------------------------------------------------
-- negocios — NÍVEL 3 (o TENANT). ESTENDE o blueprint com hub_id + campos do
-- formulário "Cadastrar Cliente" do concorrente (ANALISE seção 5.3).
-- ----------------------------------------------------------------------------
CREATE TABLE negocios (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hub_id        UUID        NOT NULL REFERENCES hubs(id) ON DELETE RESTRICT, -- em qual hub vive
    slug          TEXT        NOT NULL UNIQUE,          -- workspace slug, ex: /doce-pao-yf0cr

    -- Identidade do cliente (a marca é do CLIENTE, não do hub)
    nome          TEXT        NOT NULL,                 -- razão social
    nome_fantasia TEXT        NULL,                     -- nome comercial/apelido
    segmento      TEXT        NULL,                     -- nicho
    marca_cor     TEXT        NULL,                     -- hex, cor principal da marca
    marca_logo    TEXT        NULL,

    -- Responsável principal
    resp_nome     TEXT        NULL,
    resp_cargo    TEXT        NULL,
    resp_email    TEXT        NULL,
    resp_whatsapp TEXT        NULL,

    -- Presença digital
    dominio       TEXT        NULL,
    site_url      TEXT        NULL,
    instagram_url TEXT        NULL,
    wpp_comercial TEXT        NULL,

    -- Módulos DESTE cliente (sobrepõem o default do hub). NULL = herda do hub.
    mod_site       BOOLEAN    NULL,
    mod_instagram  BOOLEAN    NULL,
    mod_financeiro BOOLEAN    NULL,
    mod_crm        BOOLEAN    NULL,

    -- Operacional
    tipo_cliente  TEXT        NOT NULL DEFAULT 'nao_definido'
                  CHECK (tipo_cliente IN ('recorrente','nao_recorrente','nao_definido')),
    experimental  BOOLEAN     NOT NULL DEFAULT FALSE,   -- sem login, só p/ testar o fluxo
    health_score  INTEGER     NOT NULL DEFAULT 100 CHECK (health_score BETWEEN 0 AND 100),
    observacoes   TEXT        NULL,

    -- Motor de IA do cliente (nosso caminho: API Anthropic medida, NÃO assento Team)
    ia_habilitada    BOOLEAN  NOT NULL DEFAULT TRUE,
    ia_modo          TEXT     NOT NULL DEFAULT 'api_plataforma'
                     CHECK (ia_modo IN ('api_plataforma','claude_cliente','sem_ia')),
    conta_claude_id  UUID     NULL,                     -- se claude_cliente, aponta contas_claude
    ia_modelo_chat   TEXT     NULL,                     -- ex: claude-sonnet-...
    ia_modelo_gerador TEXT    NULL,
    ia_limite_tokens BIGINT   NOT NULL DEFAULT 0,       -- 0 = ilimitado

    status        TEXT        NOT NULL DEFAULT 'ativo'
                  CHECK (status IN ('ativo','em_configuracao','arquivado')),
    ativo         BOOLEAN     NOT NULL DEFAULT TRUE,
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_negocios_hub ON negocios (hub_id);
CREATE INDEX idx_negocios_status ON negocios (status);

-- ----------------------------------------------------------------------------
-- usuarios — quem loga. ESTENDE o blueprint para os 3 níveis de papel.
--   owner_plataforma -> Eliezer. negocio_id NULL, hub_id NULL. Vê tudo.
--   admin_hub        -> gerencia 1 hub. hub_id setado, negocio_id NULL. (opcional)
--   dono/operador    -> escopado a 1 cliente. negocio_id setado.
-- ----------------------------------------------------------------------------
CREATE TABLE usuarios (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id  UUID        NULL REFERENCES negocios(id) ON DELETE CASCADE,
    hub_id      UUID        NULL REFERENCES hubs(id) ON DELETE CASCADE,
    email       TEXT        NOT NULL,
    senha_hash  TEXT        NOT NULL,
    papel       TEXT        NOT NULL DEFAULT 'operador'
                CHECK (papel IN ('owner_plataforma','admin_hub','dono','operador')),
    ativo       BOOLEAN     NOT NULL DEFAULT TRUE,
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- coerência entre papel e escopo:
    CONSTRAINT ck_usuario_escopo CHECK (
        (papel = 'owner_plataforma' AND negocio_id IS NULL AND hub_id IS NULL) OR
        (papel = 'admin_hub'        AND hub_id IS NOT NULL AND negocio_id IS NULL) OR
        (papel IN ('dono','operador') AND negocio_id IS NOT NULL)
    )
);
-- email único por escopo (mesmo email pode existir em tenants diferentes).
CREATE UNIQUE INDEX uq_usuarios_email_negocio ON usuarios (negocio_id, email)
    WHERE negocio_id IS NOT NULL;
CREATE UNIQUE INDEX uq_usuarios_email_owner ON usuarios (email)
    WHERE papel = 'owner_plataforma';
CREATE INDEX idx_usuarios_negocio ON usuarios (negocio_id);
CREATE INDEX idx_usuarios_hub ON usuarios (hub_id);

-- ----------------------------------------------------------------------------
-- contas_claude — contas/assentos de IA conectados (ANALISE seção 2.2).
-- No NOSSO modelo o padrão é API da plataforma (billing real). Esta tabela
-- cobre o caso "Claude do cliente" (o cliente traz a própria assinatura).
-- Token NUNCA no banco em texto: guardamos referência; o segredo fica cifrado
-- ou só na VPS (arquivo root 0600), conforme o modo.
-- ----------------------------------------------------------------------------
CREATE TABLE contas_claude (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hub_id         UUID       NULL REFERENCES hubs(id) ON DELETE SET NULL,
    nome           TEXT       NOT NULL,
    tipo           TEXT       NOT NULL DEFAULT 'dedicada'
                   CHECK (tipo IN ('compartilhada','dedicada')),
    plano          TEXT       NULL,                     -- Pro / Max / Max20x / Team
    token_ref      TEXT       NULL,                     -- referência (nunca o token cru)
    status         TEXT       NOT NULL DEFAULT 'ativa'
                   CHECK (status IN ('ativa','reautenticar','inativa')),
    criado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- uso_ia — medição de custo/uso por tenant (ANALISE aba "Tokens").
-- O dono exige CUSTO REAL, não estimativa (memória feedback_custo_real).
-- ----------------------------------------------------------------------------
CREATE TABLE uso_ia (
    id            BIGSERIAL PRIMARY KEY,
    negocio_id    UUID        NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    origem        TEXT        NOT NULL,                 -- 'chat' | 'gerador' | 'agente_crm' | 'whatsapp'
    modelo        TEXT        NOT NULL,
    tokens_in     BIGINT      NOT NULL DEFAULT 0,
    tokens_out    BIGINT      NOT NULL DEFAULT 0,
    custo_cent    INTEGER     NOT NULL DEFAULT 0,       -- centavos (fonte: faturamento real)
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_uso_ia_negocio ON uso_ia (negocio_id);
CREATE INDEX idx_uso_ia_negocio_data ON uso_ia (negocio_id, criado_em);

-- ============================================================================
-- Do blueprint (../site-enderecodigital/docs/multitenant/schema.sql):
-- wa_conexoes, wa_onboarding_states, base_conhecimento, conversas, mensagens,
-- pedidos, auditoria — TODAS entram AQUI sem mudança (já são escopadas por
-- negocio_id). Como negocios agora tem hub_id, elas herdam o hub pelo negócio.
-- Serão coladas na migração inicial junto com este arquivo.
-- ============================================================================

-- Seed mínimo (Fase 0): o hub #1 e o owner da plataforma são criados por script
-- de bootstrap (db/bootstrap.ts) lendo variáveis de ambiente — NUNCA senha aqui.
