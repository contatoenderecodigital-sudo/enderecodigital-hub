-- ============================================================
-- Escopar a operação (GROOW OS) por HUB.
-- Cada hub passa a ter clientes/leads/carteira/etc. isolados.
-- Backfill: tudo que já existe pertence ao hub "Endereço Digital".
-- ============================================================
\set ED '777815b4-7f3a-4813-8331-18e539111710'

-- IA por hub: chave Anthropic própria de cada hub (fallback = env da plataforma)
ALTER TABLE hubs ADD COLUMN IF NOT EXISTS anthropic_api_key TEXT;
ALTER TABLE hubs ADD COLUMN IF NOT EXISTS ia_limite_mensal_usd NUMERIC(10,2) DEFAULT 0;

DO $$
DECLARE
  ed UUID := '777815b4-7f3a-4813-8331-18e539111710';
  t TEXT;
  tabelas TEXT[] := ARRAY[
    'ops_leads','ops_clientes','ops_transacoes','ops_tarefas','ops_follow_ups','ops_agendamentos',
    'ops_prospeccao_emails','ops_trafego_investimentos','ops_utm_links','ops_social_ideias',
    'ops_social_conteudos','ops_relatorios','ops_senhas_cofre','ops_wa_campanhas','ops_wa_conversas',
    'ops_wa_optout','ops_blog_posts','ops_mapas','ops_ia_logs','ops_cardapio_respostas',
    'ops_metricas_diarias','ops_ia_base_conhecimento','ops_ia_followup_config'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS hub_id UUID', t);
    EXECUTE format('UPDATE %I SET hub_id = %L WHERE hub_id IS NULL', t, ed);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (hub_id)', 'idx_' || t || '_hub', t);
  END LOOP;
END $$;

SELECT 'ops scope por hub aplicado' AS status;
