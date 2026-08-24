-- Comissão de valor FIXO por venda fechada.
--
-- O modelo original era só percentual (sobre implantação e sobre mensalidade).
-- Na prática o acordo com os primeiros parceiros virou "R$ X por lead que
-- fechar", que não dá pra representar com percentual: o valor mudaria junto
-- com o tamanho do contrato.
--
-- Regra: se comissao_fixa > 0, o parceiro ganha esse valor uma vez, no mês em
-- que o contrato começa, e os percentuais são ignorados. Assim os dois modelos
-- convivem sem um contaminar o outro.

ALTER TABLE groow.parceiros
  ADD COLUMN IF NOT EXISTS comissao_fixa NUMERIC(10,2) NOT NULL DEFAULT 0;

-- 'fixa' entra como tipo de lançamento
ALTER TABLE groow.parceiro_comissoes
  DROP CONSTRAINT IF EXISTS ck_parceiro_comissoes_tipo;
ALTER TABLE groow.parceiro_comissoes
  ADD CONSTRAINT ck_parceiro_comissoes_tipo
  CHECK (tipo IN ('setup', 'recorrente', 'ajuste', 'fixa'));
