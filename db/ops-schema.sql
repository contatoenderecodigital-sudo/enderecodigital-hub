-- ============================================================
-- GROOW OS — operação da agência (nível PLATAFORMA / owner-only)
-- Migração do admin antigo (MySQL db_enderecodigital) para o Postgres do hub.
-- Namespace ops_* para NÃO colidir com as tabelas do produto multi-tenant
-- (negocios, leads, etc. são do nível Cliente; estas são da agência).
-- Idempotente: CREATE TABLE IF NOT EXISTS.
-- ============================================================

-- trigger util p/ updated_at (equivalente ao ON UPDATE CURRENT_TIMESTAMP do MySQL)
CREATE OR REPLACE FUNCTION ops_touch_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- CRM da agência: leads → agendamentos → follow_ups → clientes → tarefas
-- ============================================================
CREATE TABLE IF NOT EXISTS ops_leads (
  id                SERIAL PRIMARY KEY,
  nome              TEXT NOT NULL,
  email             TEXT NOT NULL DEFAULT '',
  whatsapp          TEXT NOT NULL DEFAULT '',
  empresa           TEXT NOT NULL DEFAULT '',
  faturamento       TEXT,
  mensagem          TEXT,
  setor             TEXT,
  cidade            TEXT,
  site              TEXT,
  endereco          TEXT,
  place_id          TEXT,                     -- Google Places (dedup da prospecção)
  tem_site_proprio  BOOLEAN,
  telefone          TEXT,                     -- alias histórico de whatsapp
  origem            TEXT DEFAULT 'site/agendar',
  fonte_trafego     TEXT,                     -- google | meta | tiktok | ... (ROAS)
  status            TEXT NOT NULL DEFAULT 'novo'
                    CHECK (status IN ('novo','contatado','diagnostico','proposta','fechado','perdido','frio','quente')),
  notas             TEXT,
  ultimo_contato_em TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ops_leads_status ON ops_leads (status);
CREATE INDEX IF NOT EXISTS idx_ops_leads_created ON ops_leads (created_at);
DROP TRIGGER IF EXISTS trg_ops_leads_upd ON ops_leads;
CREATE TRIGGER trg_ops_leads_upd BEFORE UPDATE ON ops_leads FOR EACH ROW EXECUTE FUNCTION ops_touch_updated_at();

CREATE TABLE IF NOT EXISTS ops_agendamentos (
  id           SERIAL PRIMARY KEY,
  lead_id      INT NOT NULL REFERENCES ops_leads(id) ON DELETE CASCADE,
  data_hora    TIMESTAMPTZ NOT NULL,
  duracao_min  INT DEFAULT 45,
  status       TEXT NOT NULL DEFAULT 'agendado'
               CHECK (status IN ('agendado','realizado','cancelado','no_show')),
  link_call    TEXT,
  notas        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ops_agend_data ON ops_agendamentos (data_hora);
DROP TRIGGER IF EXISTS trg_ops_agend_upd ON ops_agendamentos;
CREATE TRIGGER trg_ops_agend_upd BEFORE UPDATE ON ops_agendamentos FOR EACH ROW EXECUTE FUNCTION ops_touch_updated_at();

CREATE TABLE IF NOT EXISTS ops_follow_ups (
  id          SERIAL PRIMARY KEY,
  lead_id     INT NOT NULL REFERENCES ops_leads(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL CHECK (tipo IN ('whatsapp','email','telefone','reuniao','outro')),
  descricao   TEXT NOT NULL,
  resultado   TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ops_fu_lead ON ops_follow_ups (lead_id);

CREATE TABLE IF NOT EXISTS ops_clientes (
  id              SERIAL PRIMARY KEY,
  lead_id         INT REFERENCES ops_leads(id) ON DELETE SET NULL,
  negocio_id      UUID,                       -- vínculo opcional com o tenant do hub (produto)
  empresa         TEXT NOT NULL,
  responsavel     TEXT,
  email           TEXT,
  whatsapp        TEXT,
  plano           TEXT,
  valor_mensal    NUMERIC(10,2) DEFAULT 0,
  valor_setup     NUMERIC(10,2) DEFAULT 0,
  inicio_contrato DATE,
  fim_contrato    DATE,
  status          TEXT NOT NULL DEFAULT 'ativo'
                  CHECK (status IN ('ativo','pausado','cancelado','concluido')),
  progresso       SMALLINT DEFAULT 0,
  modulos         TEXT,
  notas           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ops_clientes_status ON ops_clientes (status);
DROP TRIGGER IF EXISTS trg_ops_clientes_upd ON ops_clientes;
CREATE TRIGGER trg_ops_clientes_upd BEFORE UPDATE ON ops_clientes FOR EACH ROW EXECUTE FUNCTION ops_touch_updated_at();

CREATE TABLE IF NOT EXISTS ops_tarefas (
  id          SERIAL PRIMARY KEY,
  titulo      TEXT NOT NULL,
  descricao   TEXT,
  lead_id     INT REFERENCES ops_leads(id) ON DELETE SET NULL,
  cliente_id  INT REFERENCES ops_clientes(id) ON DELETE SET NULL,
  prioridade  TEXT NOT NULL DEFAULT 'media' CHECK (prioridade IN ('baixa','media','alta')),
  status      TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','feita','cancelada')),
  due_date    DATE,
  feita_em    TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ops_tarefas_status ON ops_tarefas (status, due_date);

-- Transações financeiras (pagamentos recorrentes/setup/avulsos + saídas)
CREATE TABLE IF NOT EXISTS ops_transacoes (
  id          SERIAL PRIMARY KEY,
  cliente_id  INT REFERENCES ops_clientes(id) ON DELETE SET NULL,
  tipo        TEXT NOT NULL DEFAULT 'recorrente',  -- recorrente | setup | avulso | saida
  categoria   TEXT,
  descricao   TEXT,
  valor       NUMERIC(10,2) NOT NULL DEFAULT 0,
  data        DATE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ops_transacoes_cli ON ops_transacoes (cliente_id, data);
CREATE INDEX IF NOT EXISTS idx_ops_transacoes_tipo ON ops_transacoes (tipo, data);

CREATE TABLE IF NOT EXISTS ops_metricas_diarias (
  id           SERIAL PRIMARY KEY,
  data         DATE NOT NULL UNIQUE,
  leads_novos  INT DEFAULT 0,
  diagnosticos INT DEFAULT 0,
  fechamentos  INT DEFAULT 0,
  faturamento  NUMERIC(10,2) DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Prospecção (Maps → prévia → email)
-- ============================================================
CREATE TABLE IF NOT EXISTS ops_prospeccao_emails (
  id           SERIAL PRIMARY KEY,
  nome_empresa TEXT NOT NULL DEFAULT '',
  email        TEXT NOT NULL,
  assunto      TEXT NOT NULL DEFAULT '',
  campanha     TEXT NOT NULL DEFAULT '',      -- "nicho · cidade"
  status       TEXT NOT NULL DEFAULT 'enviado' CHECK (status IN ('enviado','erro')),
  erro         TEXT,
  resend_id    TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ops_pe_email ON ops_prospeccao_emails (email, created_at);

-- ============================================================
-- Tráfego & Atribuição (ROAS)
-- ============================================================
CREATE TABLE IF NOT EXISTS ops_trafego_investimentos (
  id         SERIAL PRIMARY KEY,
  canal      TEXT NOT NULL,                   -- google | meta | tiktok | outro
  mes        CHAR(7) NOT NULL,                -- 'YYYY-MM'
  valor      NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (canal, mes)
);
DROP TRIGGER IF EXISTS trg_ops_invest_upd ON ops_trafego_investimentos;
CREATE TRIGGER trg_ops_invest_upd BEFORE UPDATE ON ops_trafego_investimentos FOR EACH ROW EXECUTE FUNCTION ops_touch_updated_at();

CREATE TABLE IF NOT EXISTS ops_utm_links (
  id           SERIAL PRIMARY KEY,
  nome         TEXT NOT NULL,
  url_final    TEXT NOT NULL,
  utm_source   TEXT NOT NULL,
  utm_medium   TEXT NOT NULL,
  utm_campaign TEXT NOT NULL,
  utm_content  TEXT,
  utm_term     TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Conteúdo Social (banco de ideias + conteúdos gerados)
-- ============================================================
CREATE TABLE IF NOT EXISTS ops_social_ideias (
  id         SERIAL PRIMARY KEY,
  pilar      TEXT NOT NULL,
  tipo       TEXT NOT NULL CHECK (tipo IN ('reel','carrossel','story')),
  hook       TEXT NOT NULL,
  descricao  TEXT,
  formato    TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'nova' CHECK (status IN ('nova','gerada','descartada')),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ops_social_ideias ON ops_social_ideias (status, pilar);

CREATE TABLE IF NOT EXISTS ops_social_conteudos (
  id         SERIAL PRIMARY KEY,
  ideia_id   INT REFERENCES ops_social_ideias(id) ON DELETE SET NULL,
  tipo       TEXT NOT NULL CHECK (tipo IN ('reel','carrossel','story')),
  titulo     TEXT NOT NULL,
  corpo      TEXT NOT NULL,                   -- JSON (roteiro ou slides)
  legenda    TEXT,
  hashtags   TEXT,
  custo_usd  NUMERIC(8,4),
  status     TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','aprovado','publicado')),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ops_social_cont ON ops_social_conteudos (status);

-- ============================================================
-- Relatórios white-label + Cofre de senhas
-- ============================================================
CREATE TABLE IF NOT EXISTS ops_relatorios (
  id         SERIAL PRIMARY KEY,
  cliente    TEXT NOT NULL,
  periodo    TEXT NOT NULL,                   -- "2026-07"
  dados      TEXT NOT NULL,                   -- JSON
  token      TEXT NOT NULL UNIQUE,            -- link público /r/[token]
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_ops_rel_upd ON ops_relatorios;
CREATE TRIGGER trg_ops_rel_upd BEFORE UPDATE ON ops_relatorios FOR EACH ROW EXECUTE FUNCTION ops_touch_updated_at();

CREATE TABLE IF NOT EXISTS ops_senhas_cofre (
  id         SERIAL PRIMARY KEY,
  cliente    TEXT NOT NULL DEFAULT '',
  servico    TEXT NOT NULL,
  url        TEXT NOT NULL DEFAULT '',
  usuario    TEXT NOT NULL DEFAULT '',
  segredo    TEXT NOT NULL,                   -- AES-256-GCM (iv.tag.cifrado)
  notas      TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ops_cofre_cliente ON ops_senhas_cofre (cliente);
DROP TRIGGER IF EXISTS trg_ops_cofre_upd ON ops_senhas_cofre;
CREATE TRIGGER trg_ops_cofre_upd BEFORE UPDATE ON ops_senhas_cofre FOR EACH ROW EXECUTE FUNCTION ops_touch_updated_at();

-- ============================================================
-- Disparos WhatsApp (campanhas com template aprovado Meta)
-- ============================================================
CREATE TABLE IF NOT EXISTS ops_wa_campanhas (
  id               SERIAL PRIMARY KEY,
  nome             TEXT NOT NULL,
  template_nome    TEXT NOT NULL,
  template_idioma  TEXT NOT NULL DEFAULT 'pt_BR',
  body_params_modo TEXT NOT NULL DEFAULT 'nenhum' CHECK (body_params_modo IN ('nenhum','nome')),
  status           TEXT NOT NULL DEFAULT 'rascunho'
                   CHECK (status IN ('rascunho','agendada','enviando','pausada','concluida')),
  cap_dia          SMALLINT NOT NULL DEFAULT 100,
  janela_inicio    SMALLINT NOT NULL DEFAULT 9,
  janela_fim       SMALLINT NOT NULL DEFAULT 19,
  pular_domingo    BOOLEAN NOT NULL DEFAULT true,
  inicio_agendado  TIMESTAMPTZ,
  optin_confirmado BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ops_wa_camp_status ON ops_wa_campanhas (status);
DROP TRIGGER IF EXISTS trg_ops_wa_camp_upd ON ops_wa_campanhas;
CREATE TRIGGER trg_ops_wa_camp_upd BEFORE UPDATE ON ops_wa_campanhas FOR EACH ROW EXECUTE FUNCTION ops_touch_updated_at();

CREATE TABLE IF NOT EXISTS ops_wa_campanha_destinatarios (
  id          SERIAL PRIMARY KEY,
  campanha_id INT NOT NULL REFERENCES ops_wa_campanhas(id) ON DELETE CASCADE,
  whatsapp    TEXT NOT NULL,
  nome        TEXT,
  status      TEXT NOT NULL DEFAULT 'pendente'
              CHECK (status IN ('pendente','enviado','entregue','lido','respondeu','falha','optout')),
  wamid       TEXT,
  erro        TEXT,
  enviado_em  TIMESTAMPTZ,
  UNIQUE (campanha_id, whatsapp)
);
CREATE INDEX IF NOT EXISTS idx_ops_dest_camp_status ON ops_wa_campanha_destinatarios (campanha_id, status);

CREATE TABLE IF NOT EXISTS ops_wa_optout (
  whatsapp   TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Conversas WhatsApp da agência (inbox owner)
-- ============================================================
CREATE TABLE IF NOT EXISTS ops_wa_conversas (
  id                 SERIAL PRIMARY KEY,
  canal              TEXT NOT NULL DEFAULT 'meta' CHECK (canal IN ('meta','evolution')),
  whatsapp           TEXT NOT NULL,
  nome               TEXT,
  lead_id            INT REFERENCES ops_leads(id) ON DELETE SET NULL,
  cliente_id         INT REFERENCES ops_clientes(id) ON DELETE SET NULL,
  status             TEXT NOT NULL DEFAULT 'ai_active' CHECK (status IN ('ai_active','handed_off','closed')),
  nao_lidas          INT NOT NULL DEFAULT 0,
  ultima_mensagem    TEXT,
  ultima_mensagem_em TIMESTAMPTZ,
  handoff_em         TIMESTAMPTZ,
  handoff_motivo     TEXT,
  created_at         TIMESTAMPTZ DEFAULT now(),
  UNIQUE (canal, whatsapp)
);
CREATE INDEX IF NOT EXISTS idx_ops_wa_conv_ultima ON ops_wa_conversas (ultima_mensagem_em);

CREATE TABLE IF NOT EXISTS ops_wa_mensagens (
  id             BIGSERIAL PRIMARY KEY,
  conversa_id    INT NOT NULL REFERENCES ops_wa_conversas(id) ON DELETE CASCADE,
  origem         TEXT NOT NULL CHECK (origem IN ('user','ai','humano','sistema')),
  tipo           TEXT NOT NULL DEFAULT 'text',
  texto          TEXT,
  wamid          TEXT UNIQUE,
  status_entrega TEXT CHECK (status_entrega IN ('pending','sent','delivered','read','failed')),
  metadata       JSONB,
  created_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ops_wa_msg_conv ON ops_wa_mensagens (conversa_id, created_at);

-- ============================================================
-- Blog SEO + Mapa do ecossistema
-- ============================================================
CREATE TABLE IF NOT EXISTS ops_blog_posts (
  id           SERIAL PRIMARY KEY,
  slug         TEXT NOT NULL UNIQUE,
  titulo       TEXT NOT NULL,
  resumo       TEXT NOT NULL DEFAULT '',
  corpo        TEXT NOT NULL,
  keyword_foco TEXT NOT NULL DEFAULT '',
  categoria    TEXT NOT NULL DEFAULT 'marketing-local',
  status       TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','aprovado','publicado','arquivado')),
  origem       TEXT NOT NULL DEFAULT 'ia' CHECK (origem IN ('ia','manual')),
  custo_usd    NUMERIC(8,4),
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  published_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_ops_blog_status ON ops_blog_posts (status, published_at);
DROP TRIGGER IF EXISTS trg_ops_blog_upd ON ops_blog_posts;
CREATE TRIGGER trg_ops_blog_upd BEFORE UPDATE ON ops_blog_posts FOR EACH ROW EXECUTE FUNCTION ops_touch_updated_at();

CREATE TABLE IF NOT EXISTS ops_mapas (
  id         SERIAL PRIMARY KEY,
  nome       TEXT NOT NULL,
  dados      TEXT NOT NULL,                   -- JSON {nodes, edges}
  token      TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_ops_mapas_upd ON ops_mapas;
CREATE TRIGGER trg_ops_mapas_upd BEFORE UPDATE ON ops_mapas FOR EACH ROW EXECUTE FUNCTION ops_touch_updated_at();

-- ============================================================
-- IA & Custos (observabilidade da agência) + Cardápios
-- ============================================================
CREATE TABLE IF NOT EXISTS ops_ia_logs (
  id            BIGSERIAL PRIMARY KEY,
  modulo        TEXT,
  acao          TEXT,
  modelo        TEXT,
  input_tokens  INT DEFAULT 0,
  output_tokens INT DEFAULT 0,
  buscas_web    INT DEFAULT 0,
  custo_usd     NUMERIC(10,5) DEFAULT 0,
  duracao_ms    INT DEFAULT 0,
  status        TEXT DEFAULT 'ok',
  detalhe       TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ops_ia_logs_created ON ops_ia_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_ops_ia_logs_modulo ON ops_ia_logs (modulo, created_at);

CREATE TABLE IF NOT EXISTS ops_ia_base_conhecimento (
  id         SERIAL PRIMARY KEY,
  escopo     TEXT NOT NULL DEFAULT 'geral' UNIQUE,
  conteudo   TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_ops_iabase_upd ON ops_ia_base_conhecimento;
CREATE TRIGGER trg_ops_iabase_upd BEFORE UPDATE ON ops_ia_base_conhecimento FOR EACH ROW EXECUTE FUNCTION ops_touch_updated_at();

CREATE TABLE IF NOT EXISTS ops_ia_followup_config (
  id          SERIAL PRIMARY KEY,
  ativo       BOOLEAN NOT NULL DEFAULT false,
  intervalos  TEXT NOT NULL DEFAULT '[24,72,168]',   -- horas (JSON)
  updated_at  TIMESTAMPTZ DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_ops_iafup_upd ON ops_ia_followup_config;
CREATE TRIGGER trg_ops_iafup_upd BEFORE UPDATE ON ops_ia_followup_config FOR EACH ROW EXECUTE FUNCTION ops_touch_updated_at();

CREATE TABLE IF NOT EXISTS ops_cardapio_respostas (
  id           SERIAL PRIMARY KEY,
  cliente      TEXT NOT NULL DEFAULT '',
  slug         TEXT,
  total_itens  INT DEFAULT 0,
  selecionados TEXT,
  observacoes  TEXT,
  lida         BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now()
);
