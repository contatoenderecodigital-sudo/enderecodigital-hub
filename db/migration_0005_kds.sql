-- ============================================================================
-- migration_0005_kds.sql — KDS em Kanban de ITEM, com máquina de estados.
-- ----------------------------------------------------------------------------
-- O que muda:
--   1. toda transição de item e de comanda vira EVENTO gravado (quem, quando,
--      de onde, por quê). Sem isto não existe relatório de tempo nem resposta
--      para "quem cancelou a picanha de R$ 189".
--   2. o item ganha meta de tempo (`meta_min`), que é o que pinta o cartão de
--      verde, âmbar ou vermelho na tela da cozinha.
--   3. a comanda ganha os estados `em_pagamento` e `paga`. Fiscal que falha vai
--      para fila e a comanda NUNCA volta para `aberta`.
--   4. `cardapio_rev` na loja: é o contador que faz o botão 86 apagar o item
--      dos celulares que já estão com o cardápio aberto.
--
-- Idempotente: pode rodar duas vezes.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. EVENTOS DE TRANSIÇÃO DO ITEM — a trilha de auditoria da cozinha
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS food_item_eventos (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id   UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    loja_id      UUID NOT NULL REFERENCES food_lojas(id) ON DELETE CASCADE,
    item_id      UUID NOT NULL REFERENCES food_itens(id) ON DELETE CASCADE,
    pedido_id    UUID NULL REFERENCES food_pedidos(id) ON DELETE CASCADE,
    de           TEXT NULL,                 -- NULL = nasceu
    para         TEXT NOT NULL,
    ator_tipo    TEXT NOT NULL DEFAULT 'sistema'
                 CHECK (ator_tipo IN ('kds','garcom','painel','cliente','sistema')),
    ator_id      TEXT NULL,                 -- id do garçom, do dispositivo ou do usuário
    ator_nome    TEXT NULL,                 -- nome legível, para o relatório não precisar de join
    origem       TEXT NULL,                 -- nome do tablet, "painel", ip
    motivo       TEXT NULL,                 -- obrigatório no cancelamento
    chave        TEXT NULL,                 -- idempotência: a mesma chave nunca age duas vezes
    -- clock_timestamp e nao now(): dois eventos da mesma transacao (o atalho
    -- pendente -> pronto) precisam de ordem entre si.
    criado_em    TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_food_item_ev_item ON food_item_eventos (item_id, criado_em DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_food_item_ev_chave
    ON food_item_eventos (chave) WHERE chave IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_food_item_ev_loja ON food_item_eventos (loja_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_food_item_ev_neg  ON food_item_eventos (negocio_id);

-- ----------------------------------------------------------------------------
-- 2. EVENTOS DE TRANSIÇÃO DA COMANDA
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS food_sessao_eventos (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id   UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    loja_id      UUID NOT NULL REFERENCES food_lojas(id) ON DELETE CASCADE,
    sessao_id    UUID NOT NULL REFERENCES food_sessoes(id) ON DELETE CASCADE,
    de           TEXT NULL,
    para         TEXT NOT NULL,
    ator_tipo    TEXT NOT NULL DEFAULT 'sistema'
                 CHECK (ator_tipo IN ('kds','garcom','painel','cliente','sistema')),
    ator_id      TEXT NULL,
    ator_nome    TEXT NULL,
    origem       TEXT NULL,
    motivo       TEXT NULL,
    valor_aberto NUMERIC(12,2) NULL,        -- quanto faltava quando fechou fora da régua
    criado_em    TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS idx_food_sessao_ev_sessao ON food_sessao_eventos (sessao_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_food_sessao_ev_loja   ON food_sessao_eventos (loja_id, criado_em DESC);

-- ----------------------------------------------------------------------------
-- 3. O ITEM: meta de tempo, carimbos que faltavam e o relógio da sincronização
-- ----------------------------------------------------------------------------
ALTER TABLE food_itens ADD COLUMN IF NOT EXISTS meta_min          INTEGER NULL;
ALTER TABLE food_itens ADD COLUMN IF NOT EXISTS entregue_em       TIMESTAMPTZ NULL;
ALTER TABLE food_itens ADD COLUMN IF NOT EXISTS cancelado_em      TIMESTAMPTZ NULL;
ALTER TABLE food_itens ADD COLUMN IF NOT EXISTS cancelado_motivo  TEXT NULL;
ALTER TABLE food_itens ADD COLUMN IF NOT EXISTS cancelado_por     TEXT NULL;
-- `atualizado_em` é o que o canal de tempo real observa. Toda transição mexe nele.
ALTER TABLE food_itens ADD COLUMN IF NOT EXISTS atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_food_itens_atualizado ON food_itens (atualizado_em DESC);

-- meta padrão por praça: bar sai em 3 minutos, chapa em 15, confeitaria em 8
ALTER TABLE food_areas ADD COLUMN IF NOT EXISTS meta_min INTEGER NOT NULL DEFAULT 15;

-- ----------------------------------------------------------------------------
-- 4. A COMANDA: estados novos
--    aberta -> conta_pedida -> em_pagamento -> paga -> fechada
--    O valor antigo `aguardando_pagamento` vira `em_pagamento`.
-- ----------------------------------------------------------------------------
ALTER TABLE food_sessoes ADD COLUMN IF NOT EXISTS em_pagamento_em TIMESTAMPTZ NULL;
ALTER TABLE food_sessoes ADD COLUMN IF NOT EXISTS paga_em         TIMESTAMPTZ NULL;

-- a ordem importa: solta a trava, converte o dado, e só então trava de novo
DROP INDEX IF EXISTS uq_food_sessao_viva;
ALTER TABLE food_sessoes DROP CONSTRAINT IF EXISTS food_sessoes_status_check;
UPDATE food_sessoes SET status = 'em_pagamento' WHERE status = 'aguardando_pagamento';
ALTER TABLE food_sessoes ADD CONSTRAINT food_sessoes_status_check
  CHECK (status IN ('aberta','conta_pedida','em_pagamento','paga','fechada','cancelada'));

-- A mesa continua OCUPADA enquanto a comanda estiver paga e não fechada: o
-- cliente pagou pelo celular mas ainda está sentado, e a mesa não pode ser
-- reaberta por baixo dele.
CREATE UNIQUE INDEX IF NOT EXISTS uq_food_sessao_viva
    ON food_sessoes (mesa_id)
    WHERE status IN ('aberta','conta_pedida','em_pagamento','paga');

-- ----------------------------------------------------------------------------
-- 5. FILA FISCAL — para onde a comanda paga vai quando a loja emite NFC-e.
--    SEFAZ fora do ar ou internet caída não desfazem pagamento: fica aqui.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS food_fiscal_fila (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id     UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    loja_id        UUID NOT NULL REFERENCES food_lojas(id) ON DELETE CASCADE,
    sessao_id      UUID NULL REFERENCES food_sessoes(id) ON DELETE SET NULL,
    pedido_id      UUID NULL REFERENCES food_pedidos(id) ON DELETE SET NULL,
    status         TEXT NOT NULL DEFAULT 'pendente'
                   CHECK (status IN ('pendente','processando','emitida','erro','cancelada')),
    tentativas     SMALLINT NOT NULL DEFAULT 0,
    erro           TEXT NULL,
    proxima_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
    criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_food_fiscal_fila ON food_fiscal_fila (status, proxima_em);
CREATE UNIQUE INDEX IF NOT EXISTS uq_food_fiscal_sessao
    ON food_fiscal_fila (sessao_id) WHERE sessao_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 6. CARDÁPIO VIVO — o contador que o celular do cliente compara para saber
--    que precisa recarregar o cardápio (é assim que o 86 chega na mesa).
-- ----------------------------------------------------------------------------
ALTER TABLE food_lojas ADD COLUMN IF NOT EXISTS cardapio_rev BIGINT NOT NULL DEFAULT 1;

-- ----------------------------------------------------------------------------
-- 7. IDEMPOTÊNCIA DO PEDIDO — 3G ruim no salão: o pedido chega, a resposta se
--    perde, o cliente aperta de novo. Com a chave, o segundo envio devolve o
--    mesmo pedido em vez de mandar duas picanhas para a cozinha.
-- ----------------------------------------------------------------------------
ALTER TABLE food_pedidos ADD COLUMN IF NOT EXISTS chave_idem TEXT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_food_pedidos_chave
    ON food_pedidos (loja_id, chave_idem) WHERE chave_idem IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 8. Metas iniciais por tipo de praça, só onde o dono ainda não mexeu.
-- ----------------------------------------------------------------------------
UPDATE food_areas SET meta_min = 4  WHERE meta_min = 15 AND lower(nome) LIKE '%bar%';
UPDATE food_areas SET meta_min = 3  WHERE meta_min = 15 AND (lower(nome) LIKE '%copa%' OR lower(nome) LIKE '%bebida%');
UPDATE food_areas SET meta_min = 8  WHERE meta_min = 15 AND (lower(nome) LIKE '%sobremesa%' OR lower(nome) LIKE '%confeit%');
UPDATE food_areas SET meta_min = 6  WHERE meta_min = 15 AND (lower(nome) LIKE '%fria%' OR lower(nome) LIKE '%salada%');

-- ============================================================================
-- FIM
-- ============================================================================
