-- ============================================================================
-- migration_0004_food_edicao.sql
-- O que faltava para o DONO mexer em tudo sozinho, sem pedir para a agência:
--   1. foto de produto guardada no banco (sem depender de disco ou S3)
--   2. bairros e taxas de entrega
--   3. status "em_entrega" (o motoboy saiu)
--   4. reordenação e apelido de mesa já existiam; aqui entram os campos que faltavam
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. MÍDIA — foto do produto, do logo e da capa. Vive no banco e é servida por
--    /api/food/midia/<id>. Imagem de cardápio é pequena e o navegador já
--    redimensiona antes de enviar.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS food_midias (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id   UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    loja_id      UUID NULL REFERENCES food_lojas(id) ON DELETE CASCADE,
    tipo_mime    TEXT NOT NULL DEFAULT 'image/webp',
    bytes        BYTEA NOT NULL,
    tamanho      INTEGER NOT NULL,
    origem       TEXT NULL,            -- produto | logo | capa
    criado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_food_midias_neg ON food_midias (negocio_id);

-- ----------------------------------------------------------------------------
-- 2. BAIRROS DE ENTREGA — o dono cadastra bairro, taxa e tempo. Sem isso,
--    delivery vira chute do atendente.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS food_bairros (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id    UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    loja_id       UUID NOT NULL REFERENCES food_lojas(id) ON DELETE CASCADE,
    nome          TEXT NOT NULL,
    cidade        TEXT NULL,
    taxa          NUMERIC(10,2) NOT NULL DEFAULT 0,
    tempo_min     INTEGER NOT NULL DEFAULT 40,
    pedido_minimo NUMERIC(10,2) NOT NULL DEFAULT 0,
    ativo         BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (loja_id, nome)
);
CREATE INDEX IF NOT EXISTS idx_food_bairros_loja ON food_bairros (loja_id, ativo);

-- ----------------------------------------------------------------------------
-- 3. "em_entrega" no fluxo do pedido (o motoboy saiu com ele)
-- ----------------------------------------------------------------------------
ALTER TABLE food_pedidos DROP CONSTRAINT IF EXISTS food_pedidos_status_check;
ALTER TABLE food_pedidos ADD CONSTRAINT food_pedidos_status_check
  CHECK (status IN ('pendente','aprovado','em_producao','pronto','em_entrega','entregue','cancelado'));
ALTER TABLE food_pedidos ADD COLUMN IF NOT EXISTS saiu_entrega_em TIMESTAMPTZ NULL;
ALTER TABLE food_pedidos ADD COLUMN IF NOT EXISTS bairro_id UUID NULL REFERENCES food_bairros(id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- 4. Campos que o dono edita e ainda não existiam
-- ----------------------------------------------------------------------------
ALTER TABLE food_lojas    ADD COLUMN IF NOT EXISTS aviso_cardapio TEXT NULL;   -- recado no topo do cardápio
ALTER TABLE food_lojas    ADD COLUMN IF NOT EXISTS instagram TEXT NULL;
ALTER TABLE food_produtos ADD COLUMN IF NOT EXISTS midia_id UUID NULL REFERENCES food_midias(id) ON DELETE SET NULL;
ALTER TABLE food_lojas    ADD COLUMN IF NOT EXISTS logo_midia_id UUID NULL REFERENCES food_midias(id) ON DELETE SET NULL;
