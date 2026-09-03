-- ============================================================================
-- migration_0008_dispositivos.sql — o link do tablet deixa de ser a senha.
-- ----------------------------------------------------------------------------
-- O problema: o token do tablet da cozinha e do garçom viajava na URL
-- (/k/<token>). Isso quer dizer que ele fica no histórico do navegador, aparece
-- em qualquer print da tela, e qualquer pessoa que olhe a barra de endereço por
-- cima do ombro leva a credencial da casa inteira embora.
--
-- O modelo novo é o de PAREAMENTO, que é como as casas grandes fazem:
--   1. o dono gera o link na configuração e abre UMA vez no tablet;
--   2. o servidor casa o aparelho com a loja, grava um segredo e devolve um
--      passe em cookie httpOnly de longa duração;
--   3. o token da URL morre nesse instante. Dali em diante quem autoriza é o
--      aparelho, não o endereço;
--   4. o dono vê em quantos aparelhos aquilo está pareado, quando cada um foi
--      usado pela última vez, e despareia com um toque. Desparear troca o
--      segredo, e todo cookie antigo morre junto.
--
-- Idempotente: pode rodar duas vezes.
-- ============================================================================

-- Segredo do aparelho: entra no passe assinado. Trocar este valor mata todos os
-- cookies daquele dispositivo de uma vez, que é o que "desparear" faz.
ALTER TABLE food_dispositivos ADD COLUMN IF NOT EXISTS segredo TEXT NULL;
ALTER TABLE food_dispositivos ADD COLUMN IF NOT EXISTS pareado_em TIMESTAMPTZ NULL;
ALTER TABLE food_dispositivos ADD COLUMN IF NOT EXISTS pareado_ip TEXT NULL;
ALTER TABLE food_dispositivos ADD COLUMN IF NOT EXISTS pareado_agente TEXT NULL;
-- Janela em que o link de pareamento vale. Fora dela, o link não casa mais
-- ninguém e o dono precisa gerar outro. Nasce com 48 horas.
ALTER TABLE food_dispositivos ADD COLUMN IF NOT EXISTS parear_ate TIMESTAMPTZ NULL;

-- Todo dispositivo que já existia continua funcionando: ganha janela de
-- pareamento aberta, para o tablet que está no balcão hoje casar sozinho no
-- primeiro acesso, sem ninguém precisar ir lá mexer.
UPDATE food_dispositivos
   SET parear_ate = now() + interval '30 days'
 WHERE parear_ate IS NULL AND pareado_em IS NULL;

-- Quem entrou, de onde e quando. É o que responde "quem abriu a tela da
-- cozinha ontem à noite?" e o que mostra tablet estranho aparecendo.
CREATE TABLE IF NOT EXISTS food_dispositivo_acessos (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id     UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    loja_id        UUID NOT NULL REFERENCES food_lojas(id) ON DELETE CASCADE,
    dispositivo_id UUID NULL REFERENCES food_dispositivos(id) ON DELETE CASCADE,
    tipo           TEXT NOT NULL
                   CHECK (tipo IN ('pareou','recusado','desapareado','uso_negado')),
    ip             TEXT NULL,
    agente         TEXT NULL,
    detalhe        TEXT NULL,
    criado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_food_disp_acessos
    ON food_dispositivo_acessos (loja_id, criado_em DESC);

-- ============================================================================
-- FIM
-- ============================================================================
