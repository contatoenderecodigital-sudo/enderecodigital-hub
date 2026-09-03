-- ============================================================================
-- migration_0007_operacao.sql — o que faltava para a casa operar sem furo:
--   1. alergênico no produto (RDC 727/2022 da Anvisa exige a informação no
--      cardápio, ao lado de cada item);
--   2. taxa de serviço que o cliente pode recusar (Lei 13.419/2017: a gorjeta é
--      voluntária, e cobrança compulsória é caso de Procon para o restaurante);
--   3. desconto com autor e motivo, que existia como coluna e ninguém escrevia;
--   4. turno da equipe: o PIN do garçom deixa de ser enfeite e vira sessão.
--
-- Idempotente: pode rodar duas vezes.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ALERGÊNICOS
-- Lista fechada, em `lib/food-alergenicos.ts`. Guardado como texto para o
-- relatório e a comanda impressa não dependerem de tabela de apoio.
-- ----------------------------------------------------------------------------
ALTER TABLE food_produtos ADD COLUMN IF NOT EXISTS alergenicos TEXT[] NULL;
-- "contém traços de": é outra informação e a norma trata separado
ALTER TABLE food_produtos ADD COLUMN IF NOT EXISTS tracos TEXT[] NULL;
ALTER TABLE food_produtos ADD COLUMN IF NOT EXISTS sem_gluten BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE food_produtos ADD COLUMN IF NOT EXISTS sem_lactose BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE food_produtos ADD COLUMN IF NOT EXISTS vegetariano BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE food_produtos ADD COLUMN IF NOT EXISTS vegano      BOOLEAN NOT NULL DEFAULT FALSE;

-- A restrição que o cliente escreveu ao pedir. Vai destacada no cartão da
-- cozinha e na comanda impressa, separada da observação comum ("sem cebola").
ALTER TABLE food_itens ADD COLUMN IF NOT EXISTS restricao TEXT NULL;

-- ----------------------------------------------------------------------------
-- 2. TAXA DE SERVIÇO RECUSÁVEL
-- ----------------------------------------------------------------------------
ALTER TABLE food_sessoes ADD COLUMN IF NOT EXISTS servico_recusado BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE food_sessoes ADD COLUMN IF NOT EXISTS servico_recusado_em TIMESTAMPTZ NULL;

-- ----------------------------------------------------------------------------
-- 3. DESCONTO COM AUTOR E MOTIVO
-- ----------------------------------------------------------------------------
ALTER TABLE food_sessoes ADD COLUMN IF NOT EXISTS desconto_motivo TEXT NULL;
ALTER TABLE food_sessoes ADD COLUMN IF NOT EXISTS desconto_por    TEXT NULL;
ALTER TABLE food_sessoes ADD COLUMN IF NOT EXISTS desconto_em     TIMESTAMPTZ NULL;

-- ----------------------------------------------------------------------------
-- 4. TURNO DA EQUIPE — o PIN vira sessão de verdade.
-- Antes: o PIN era conferido uma vez e o resultado ficava no localStorage do
-- tablet. Toda ação seguinte exigia só o token do dispositivo, que está na URL.
-- Quem pegasse o tablet destravado registrava pagamento em dinheiro, dava
-- cortesia e fechava mesa em nome de qualquer garçom.
-- Agora o PIN abre um turno, e o turno é o que autoriza mexer em dinheiro.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS food_turnos (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id    UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    loja_id       UUID NOT NULL REFERENCES food_lojas(id) ON DELETE CASCADE,
    equipe_id     UUID NOT NULL REFERENCES food_equipe(id) ON DELETE CASCADE,
    dispositivo_id UUID NULL REFERENCES food_dispositivos(id) ON DELETE SET NULL,
    aberto_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
    ultimo_uso    TIMESTAMPTZ NOT NULL DEFAULT now(),
    fechado_em    TIMESTAMPTZ NULL,
    ip            TEXT NULL
);
CREATE INDEX IF NOT EXISTS idx_food_turnos_equipe ON food_turnos (equipe_id, fechado_em);
CREATE INDEX IF NOT EXISTS idx_food_turnos_loja   ON food_turnos (loja_id, aberto_em DESC);

-- Tentativa de PIN errado fica registrada: é o que permite travar por
-- tentativa e é o que responde "quem tentou entrar como o gerente?".
CREATE TABLE IF NOT EXISTS food_tentativas_pin (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id    UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    loja_id       UUID NOT NULL REFERENCES food_lojas(id) ON DELETE CASCADE,
    equipe_id     UUID NULL REFERENCES food_equipe(id) ON DELETE SET NULL,
    dispositivo_id UUID NULL REFERENCES food_dispositivos(id) ON DELETE SET NULL,
    ok            BOOLEAN NOT NULL DEFAULT FALSE,
    ip            TEXT NULL,
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_food_pin_tent ON food_tentativas_pin (loja_id, criado_em DESC);

-- ----------------------------------------------------------------------------
-- 5. PAGAMENTO POR ITEM — a divisão de conta precisa saber o que foi pago.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS food_pagamento_itens (
    pagamento_id  UUID NOT NULL REFERENCES food_pagamentos(id) ON DELETE CASCADE,
    item_id       UUID NOT NULL REFERENCES food_itens(id) ON DELETE CASCADE,
    valor         NUMERIC(12,2) NOT NULL,
    PRIMARY KEY (pagamento_id, item_id)
);
CREATE INDEX IF NOT EXISTS idx_food_pag_itens_item ON food_pagamento_itens (item_id);

-- ============================================================================
-- FIM
-- ============================================================================
