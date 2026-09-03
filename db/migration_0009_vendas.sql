-- ============================================================================
-- migration_0009_vendas.sql — o que os concorrentes vendem e a gente não tinha.
-- ----------------------------------------------------------------------------
-- Da pesquisa de mercado (docs/mercado/concorrentes.md):
--
--   1. CUPOM. A Goomer e a Yooga anunciam promoção e cupom como funcionalidade
--      de venda. A gente não tinha nem desconto até ontem.
--   2. AVALIAÇÃO. Nenhum player brasileiro pesquisado mostra isso bem, e para
--      bar de bairro a nota do Google é o ativo de marketing mais importante que
--      existe. Perguntar na hora que a conta fecha é o único momento em que o
--      cliente ainda está satisfeito e com o celular na mão.
--   3. FIDELIDADE. Yooga e Neemo vendem. A base de clientes já existe
--      (`food_clientes`), faltava o saldo e o histórico.
--
-- Idempotente: pode rodar duas vezes.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CUPOM
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS food_cupons (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id    UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    loja_id       UUID NOT NULL REFERENCES food_lojas(id) ON DELETE CASCADE,
    codigo        TEXT NOT NULL,
    tipo          TEXT NOT NULL DEFAULT 'percentual'
                  CHECK (tipo IN ('percentual','valor','frete_gratis')),
    valor         NUMERIC(10,2) NOT NULL DEFAULT 0,   -- 10 = 10% ou R$ 10
    /** teto do desconto quando é percentual, para 20% não virar R$ 200 */
    teto          NUMERIC(10,2) NULL,
    minimo        NUMERIC(10,2) NOT NULL DEFAULT 0,   -- só vale acima disto
    canais        TEXT[] NOT NULL DEFAULT ARRAY['mesa','balcao','delivery'],
    /** quantos podem usar no total, e quantas vezes cada pessoa */
    limite_total  INTEGER NULL,
    limite_pessoa INTEGER NOT NULL DEFAULT 1,
    usos          INTEGER NOT NULL DEFAULT 0,
    comeca_em     TIMESTAMPTZ NULL,
    termina_em    TIMESTAMPTZ NULL,
    /** happy hour: só vale nestes dias e nesta faixa, no fuso da casa */
    dias_semana   SMALLINT[] NULL,
    hora_inicio   TIME NULL,
    hora_fim      TIME NULL,
    primeira_compra BOOLEAN NOT NULL DEFAULT FALSE,
    ativo         BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (loja_id, codigo)
);
CREATE INDEX IF NOT EXISTS idx_food_cupons_loja ON food_cupons (loja_id, ativo);

CREATE TABLE IF NOT EXISTS food_cupom_usos (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id   UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    cupom_id     UUID NOT NULL REFERENCES food_cupons(id) ON DELETE CASCADE,
    sessao_id    UUID NULL REFERENCES food_sessoes(id) ON DELETE SET NULL,
    pedido_id    UUID NULL REFERENCES food_pedidos(id) ON DELETE SET NULL,
    cliente_id   UUID NULL REFERENCES food_clientes(id) ON DELETE SET NULL,
    telefone     TEXT NULL,
    desconto     NUMERIC(10,2) NOT NULL,
    criado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_food_cupom_usos ON food_cupom_usos (cupom_id, criado_em DESC);
-- uma comanda usa um cupom só
CREATE UNIQUE INDEX IF NOT EXISTS uq_food_cupom_sessao
    ON food_cupom_usos (sessao_id) WHERE sessao_id IS NOT NULL;

ALTER TABLE food_sessoes ADD COLUMN IF NOT EXISTS cupom_id UUID NULL REFERENCES food_cupons(id) ON DELETE SET NULL;
ALTER TABLE food_pedidos ADD COLUMN IF NOT EXISTS cupom_id UUID NULL REFERENCES food_cupons(id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- 2. AVALIAÇÃO
-- Pergunta curta, na hora que a conta fecha. Nota baixa fica dentro de casa e
-- vira alerta para o dono; nota alta vira convite para avaliar no Google, que é
-- onde o vizinho procura antes de escolher onde jantar.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS food_avaliacoes (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id    UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    loja_id       UUID NOT NULL REFERENCES food_lojas(id) ON DELETE CASCADE,
    sessao_id     UUID NULL REFERENCES food_sessoes(id) ON DELETE SET NULL,
    pedido_id     UUID NULL REFERENCES food_pedidos(id) ON DELETE SET NULL,
    mesa_id       UUID NULL REFERENCES food_mesas(id) ON DELETE SET NULL,
    cliente_id    UUID NULL REFERENCES food_clientes(id) ON DELETE SET NULL,
    nota          SMALLINT NOT NULL CHECK (nota BETWEEN 1 AND 5),
    /** o que foi bom ou ruim: comida, atendimento, tempo, ambiente, preco */
    marcadores    TEXT[] NULL,
    comentario    TEXT NULL,
    /** clicou para avaliar no Google */
    foi_pro_google BOOLEAN NOT NULL DEFAULT FALSE,
    /** o dono respondeu, e o que respondeu */
    respondida_em TIMESTAMPTZ NULL,
    resposta      TEXT NULL,
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_food_aval_loja ON food_avaliacoes (loja_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_food_aval_nota ON food_avaliacoes (loja_id, nota);
-- uma avaliação por comanda
CREATE UNIQUE INDEX IF NOT EXISTS uq_food_aval_sessao
    ON food_avaliacoes (sessao_id) WHERE sessao_id IS NOT NULL;

-- Onde o cliente satisfeito é mandado, e a partir de qual nota.
ALTER TABLE food_lojas ADD COLUMN IF NOT EXISTS google_url TEXT NULL;
ALTER TABLE food_lojas ADD COLUMN IF NOT EXISTS pedir_avaliacao BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE food_lojas ADD COLUMN IF NOT EXISTS nota_para_google SMALLINT NOT NULL DEFAULT 4;

-- ----------------------------------------------------------------------------
-- 3. FIDELIDADE
-- Simples de propósito: pontos por real gasto, resgatáveis em desconto. Cartão
-- de papel carimbado é o que o bar usa hoje, e ele se perde.
-- ----------------------------------------------------------------------------
ALTER TABLE food_lojas ADD COLUMN IF NOT EXISTS fidelidade_ativa BOOLEAN NOT NULL DEFAULT FALSE;
-- quantos pontos por real gasto, e quanto vale cada ponto no resgate
ALTER TABLE food_lojas ADD COLUMN IF NOT EXISTS pontos_por_real NUMERIC(6,2) NOT NULL DEFAULT 1;
ALTER TABLE food_lojas ADD COLUMN IF NOT EXISTS valor_do_ponto NUMERIC(6,4) NOT NULL DEFAULT 0.01;
ALTER TABLE food_lojas ADD COLUMN IF NOT EXISTS resgate_minimo INTEGER NOT NULL DEFAULT 100;

ALTER TABLE food_clientes ADD COLUMN IF NOT EXISTS pontos INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS food_pontos_mov (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id   UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    cliente_id   UUID NOT NULL REFERENCES food_clientes(id) ON DELETE CASCADE,
    sessao_id    UUID NULL REFERENCES food_sessoes(id) ON DELETE SET NULL,
    pedido_id    UUID NULL REFERENCES food_pedidos(id) ON DELETE SET NULL,
    tipo         TEXT NOT NULL CHECK (tipo IN ('ganhou','resgatou','ajuste','expirou')),
    pontos       INTEGER NOT NULL,          -- positivo entra, negativo sai
    saldo_depois INTEGER NOT NULL DEFAULT 0,
    obs          TEXT NULL,
    criado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_food_pontos_cli ON food_pontos_mov (cliente_id, criado_em DESC);

-- O cliente da MESA passa a poder se identificar pelo telefone, que é o que
-- liga a comanda ao cadastro e faz fidelidade e avaliação existirem no salão.
ALTER TABLE food_sessoes ADD COLUMN IF NOT EXISTS cliente_id UUID NULL REFERENCES food_clientes(id) ON DELETE SET NULL;

-- ============================================================================
-- FIM
-- ============================================================================
