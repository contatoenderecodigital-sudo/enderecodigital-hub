-- ============================================================================
-- uso_ia: detalhamento por chamada (tela PLATAFORMA > Consumo de Tokens).
--
-- Antes desta migração cada linha de uso_ia guardava só: negocio, origem,
-- modelo, tokens de entrada, tokens de saída. Dava pra dizer QUANTO um cliente
-- gastou de token, mas não DE QUEM era o modelo, quanto daquilo foi cache, nem
-- quanto custou — custo_cent existia mas ninguém escrevia nele (ficava 0).
--
-- Colunas novas:
--   provedor        empresa de IA que atendeu a chamada ('claude'=Anthropic,
--                   'openai', 'gemini'). Redundante com o prefixo do modelo de
--                   propósito: modelo novo não quebra o agrupamento por empresa.
--   cache_write     tokens gravados no cache  (Anthropic: 1,25x o preço de entrada)
--   cache_read      tokens lidos do cache     (Anthropic: 0,10x o preço de entrada)
--                   tokens_in já vem SEM cache; prompt real = in + write + read.
--   custo_brl       custo CALCULADO na hora da chamada (tabela de preço x tokens),
--                   em REAIS com 6 casas. Não é centavo inteiro de propósito:
--                   uma conversa no Haiku custa fração de centavo e arredondar
--                   por chamada zeraria o extrato inteiro.
--   preco_in_usd    preço de lista de entrada vigente naquela chamada (US$/1M)
--   preco_out_usd   preço de lista de saída vigente naquela chamada  (US$/1M)
--   usd_brl         câmbio usado naquela chamada
--                   -> os três acima congelam o cálculo: mudar a tabela de preço
--                      amanhã não reescreve o histórico.
--   custo_fonte     'tabela' (calculado aqui) ou 'faturamento' (veio do provedor).
--   latencia_ms     tempo de parede da chamada.
--   req_id          request-id do provedor — é a chave pra bater linha a linha
--                   com o extrato da Anthropic quando o cost_report for ligado.
--   contato         com QUEM era a conversa: número de WhatsApp do cliente final,
--                   ou o usuário do painel no chat interno. É o que permite somar
--                   custo por conversa, e não só por empresa. As mensagens são
--                   amarradas pelo mesmo campo (mensagens.de_numero).
--   erro            mensagem curta quando a chamada falhou (linha fica com 0 tokens).
--
--   custo_faturado_brl  custo que o provedor REALMENTE cobrou por esta chamada.
--                   Fica NULL até o pipeline de faturamento (Anthropic Admin API /
--                   cost_report) entrar no ar. A tela compara os dois e mostra a
--                   divergência em vez de esconder — custo de verdade vem da
--                   fatura, nunca da tabela de preço.
--
-- A coluna custo_cent (integer, que já existia) fica como está para não quebrar
-- o console antigo em /operacao/hub/tokens; ela nunca foi escrita por ninguém.
--
-- Idempotente: ADD COLUMN IF NOT EXISTS. A app também aplica isto em runtime
-- (ensureColunasUso em lib/uso-ia.ts); esta migração é o registro oficial.
-- ============================================================================

ALTER TABLE uso_ia ADD COLUMN IF NOT EXISTS provedor           TEXT;
ALTER TABLE uso_ia ADD COLUMN IF NOT EXISTS cache_write        BIGINT NOT NULL DEFAULT 0;
ALTER TABLE uso_ia ADD COLUMN IF NOT EXISTS cache_read         BIGINT NOT NULL DEFAULT 0;
ALTER TABLE uso_ia ADD COLUMN IF NOT EXISTS custo_brl          NUMERIC(14,6) NOT NULL DEFAULT 0;
ALTER TABLE uso_ia ADD COLUMN IF NOT EXISTS custo_faturado_brl NUMERIC(14,6);
ALTER TABLE uso_ia ADD COLUMN IF NOT EXISTS preco_in_usd       NUMERIC(12,6);
ALTER TABLE uso_ia ADD COLUMN IF NOT EXISTS preco_out_usd      NUMERIC(12,6);
ALTER TABLE uso_ia ADD COLUMN IF NOT EXISTS usd_brl            NUMERIC(10,4);
ALTER TABLE uso_ia ADD COLUMN IF NOT EXISTS custo_fonte        TEXT NOT NULL DEFAULT 'tabela';
ALTER TABLE uso_ia ADD COLUMN IF NOT EXISTS latencia_ms        INTEGER;
ALTER TABLE uso_ia ADD COLUMN IF NOT EXISTS req_id             TEXT;
ALTER TABLE uso_ia ADD COLUMN IF NOT EXISTS contato            TEXT;
ALTER TABLE uso_ia ADD COLUMN IF NOT EXISTS erro               TEXT;

-- Backfill do provedor nas linhas antigas, pelo prefixo do id do modelo.
UPDATE uso_ia SET provedor = CASE
    WHEN modelo ILIKE 'claude%' THEN 'claude'
    WHEN modelo ILIKE 'gemini%' THEN 'gemini'
    WHEN modelo ILIKE 'gpt%' OR modelo ILIKE 'o1%' OR modelo ILIKE 'o3%' THEN 'openai'
    ELSE 'claude'
  END
WHERE provedor IS NULL;

-- Índices para os agrupamentos da tela (por data, por modelo, por origem).
CREATE INDEX IF NOT EXISTS idx_uso_ia_data     ON uso_ia (criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_uso_ia_modelo   ON uso_ia (modelo);
CREATE INDEX IF NOT EXISTS idx_uso_ia_provedor ON uso_ia (provedor);
CREATE INDEX IF NOT EXISTS idx_uso_ia_origem   ON uso_ia (origem);
