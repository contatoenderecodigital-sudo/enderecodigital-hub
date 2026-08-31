-- ============================================================================
-- migration_0003_veiculos.sql — Módulo Veículos (revenda de carros). Idempotente.
--
-- Vira o modulo "Veiculos" do workspace, ligado por negocio como os outros.
-- Todo dado e escopado por negocio_id, e a leitura passa pelo activeNegocioId
-- da sessao, igual ao CRM.
--
-- ALVO: substituir o Autos 360 da OLX na loja do cliente, nao conviver com ele.
-- Por isso aqui tem estoque, custo por veiculo, publicacao em portal, lead com
-- veiculo, avaliacao de troca e venda. O que NAO tem, de proposito, e emissao
-- de nota: NF-e se compra de API externa (Focus NFe / NFe.io) e aqui so fica a
-- referencia do que foi emitido.
--
-- DINHEIRO EM CENTAVOS INTEIROS, igual ao resto do hub. Carro de R$ 300 mil da
-- 30.000.000 centavos, bem dentro do limite do INTEGER.
--
-- FILIAL e a unidade de cobranca: rede de dez lojas paga dez mensalidades.
--
-- ISOLAMENTO ENTRE CLIENTES, e este e o ponto mais importante deste arquivo.
--
-- O hub hoje isola por CODIGO: toda consulta filtra por negocio_id vindo do
-- activeNegocioId da sessao. Funciona enquanto ninguem esquecer um WHERE. Nao
-- existe RLS em nenhuma tabela.
--
-- Aqui vai um degrau a mais, e ele nao depende de ninguem lembrar de nada: as
-- chaves estrangeiras sao COMPOSTAS, carregando negocio_id junto. Na pratica o
-- Postgres passa a RECUSAR uma foto apontando pra um veiculo de outro cliente,
-- um lead apontando pra filial de outro cliente, uma venda cruzando inquilino.
-- Nao e convencao nem disciplina: e o banco barrando na escrita.
--
-- O preco disso e um indice unico a mais por tabela pai. Barato.
-- ============================================================================

-- ---------------- flag do modulo ------------------------------------------
-- Modulo no hub resolve como negocio.mod_x ?? hub.mod_x (ver modulosEfetivos
-- em lib/types.ts). Entao a flag existe nos DOIS niveis: no hub como padrao da
-- marca, e no negocio como excecao daquele cliente. So no negocio, o modulo se
-- comportaria diferente de todos os outros.
--
-- Padrao FALSE no hub: veiculos e modulo de nicho, nao serve pra padaria.
ALTER TABLE hubs     ADD COLUMN IF NOT EXISTS mod_veiculos BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS mod_veiculos BOOLEAN;

-- ---------------- filiais --------------------------------------------------
-- Rede de revenda tem loja em varias cidades e o carro fica em UMA delas. Sem
-- isso o cliente dirige 80 km ate o carro que estava na outra unidade.
CREATE TABLE IF NOT EXISTS filiais (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id    UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  nome          TEXT NOT NULL,
  -- Nome curto pro card do app, onde nao cabe "Faxinal dos Guedes".
  nome_curto    TEXT,
  endereco      TEXT,
  bairro        TEXT,
  cidade        TEXT NOT NULL,
  uf            CHAR(2) NOT NULL,
  cep           TEXT,
  -- Numero do WhatsApp desta unidade, so digitos, com pais e DDD.
  whatsapp      TEXT,
  horario       TEXT,
  latitude      NUMERIC(10,7),
  longitude     NUMERIC(10,7),
  ativa         BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Alvo das chaves compostas. Sem isto, nada consegue apontar pra filial
  -- carregando o inquilino junto.
  CONSTRAINT uq_filiais_id_negocio UNIQUE (id, negocio_id)
);
CREATE INDEX IF NOT EXISTS idx_filiais_negocio ON filiais (negocio_id);

-- ---------------- veiculos -------------------------------------------------
-- Tem coluna que o comprador ve e coluna que so a loja ve. As internas estao
-- marcadas: custo de aquisicao e piso de negociacao vazados pro comprador
-- acabam com a margem da loja.
CREATE TABLE IF NOT EXISTS veiculos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id    UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  filial_id     UUID,

  marca         TEXT NOT NULL,
  modelo        TEXT NOT NULL,
  versao        TEXT,
  -- No Brasil o anuncio mostra fabricacao/modelo, e os dois valores importam.
  ano_fabricacao SMALLINT NOT NULL,
  ano_modelo     SMALLINT NOT NULL,
  km            INTEGER NOT NULL DEFAULT 0,
  cor           TEXT,
  cambio        TEXT CHECK (cambio IN ('Manual','Automático','Automatizado','CVT')),
  combustivel   TEXT CHECK (combustivel IN ('Flex','Gasolina','Diesel','Etanol','Híbrido','Elétrico','GNV')),
  carroceria    TEXT CHECK (carroceria IN ('hatch','sedan','suv','picape','minivan','cupe','conversivel','furgao','caminhao','moto')),
  portas        SMALLINT,

  -- Placa inteira fica aqui, mas rota publica devolve so o ultimo digito:
  -- placa cheia em anuncio e convite pra clonagem.
  placa         TEXT,
  chassi        TEXT,
  renavam       TEXT,

  preco_cent    INTEGER NOT NULL DEFAULT 0,
  -- INTERNO: piso que o dono aceita. Guia o vendedor e o atendente automatico.
  -- Nunca sai em rota publica.
  preco_minimo_cent INTEGER,

  aceita_troca          BOOLEAN NOT NULL DEFAULT TRUE,
  aceita_financiamento  BOOLEAN NOT NULL DEFAULT TRUE,

  -- Procedencia, que e o que vende seminovo.
  unico_dono              BOOLEAN NOT NULL DEFAULT FALSE,
  revisoes_concessionaria BOOLEAN NOT NULL DEFAULT FALSE,
  ipva_pago               BOOLEAN NOT NULL DEFAULT FALSE,
  licenciado              BOOLEAN NOT NULL DEFAULT FALSE,
  garantia_fabrica_ate    DATE,

  itens         TEXT[] NOT NULL DEFAULT '{}',
  observacoes   TEXT,

  status        TEXT NOT NULL DEFAULT 'preparacao'
                CHECK (status IN ('preparacao','disponivel','reservado','vendido','arquivado')),
  origem        TEXT NOT NULL DEFAULT 'proprio'
                CHECK (origem IN ('proprio','consignado')),

  -- Data de ENTRADA NO PATIO, nao do cadastro. E a base do giro, o numero que
  -- o dono olha: acima de 60 dias a rentabilidade despenca.
  entrada_em    DATE NOT NULL DEFAULT CURRENT_DATE,
  vendido_em    DATE,

  publicado     BOOLEAN NOT NULL DEFAULT FALSE,
  destaque      BOOLEAN NOT NULL DEFAULT FALSE,

  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Vendido sem data quebra todo calculo de giro. Melhor barrar na entrada.
  CONSTRAINT ck_veiculo_venda_tem_data CHECK (status <> 'vendido' OR vendido_em IS NOT NULL),
  -- A filial TEM que ser do mesmo cliente. Chave composta, nao simples.
  CONSTRAINT fk_veiculos_filial FOREIGN KEY (filial_id, negocio_id)
    REFERENCES filiais (id, negocio_id) ON DELETE SET NULL,
  CONSTRAINT uq_veiculos_id_negocio UNIQUE (id, negocio_id)
);
CREATE INDEX IF NOT EXISTS idx_veiculos_negocio ON veiculos (negocio_id, status);
CREATE INDEX IF NOT EXISTS idx_veiculos_negocio_entrada ON veiculos (negocio_id, entrada_em);
CREATE INDEX IF NOT EXISTS idx_veiculos_filial ON veiculos (filial_id);
CREATE INDEX IF NOT EXISTS idx_veiculos_publicado ON veiculos (negocio_id) WHERE publicado;
CREATE UNIQUE INDEX IF NOT EXISTS uq_veiculos_placa ON veiculos (negocio_id, placa) WHERE placa IS NOT NULL;

-- ---------------- fotos ----------------------------------------------------
-- A ordem importa: a primeira e a capa, e e ela que decide o clique no portal.
CREATE TABLE IF NOT EXISTS veiculo_fotos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id  UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  veiculo_id  UUID NOT NULL,
  url         TEXT NOT NULL,
  ordem       SMALLINT NOT NULL DEFAULT 0,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_veiculo_fotos_veiculo FOREIGN KEY (veiculo_id, negocio_id)
    REFERENCES veiculos (id, negocio_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_veiculo_fotos_veiculo ON veiculo_fotos (veiculo_id, ordem);

-- ---------------- custos ---------------------------------------------------
-- Cada real gasto no carro entra aqui, incluindo a compra. E o que permite
-- dizer a margem REAL em vez da imaginada: sem isso o dono acha que ganhou 12
-- mil e ganhou 4. A margem liquida do setor fica entre 4% e 9%.
CREATE TABLE IF NOT EXISTS veiculo_custos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id  UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  veiculo_id  UUID NOT NULL,
  tipo        TEXT NOT NULL
              CHECK (tipo IN ('aquisicao','documentacao','mecanica','funilaria','estetica','comissao','frete','outro')),
  descricao   TEXT,
  valor_cent  INTEGER NOT NULL DEFAULT 0,
  data        DATE NOT NULL DEFAULT CURRENT_DATE,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_veiculo_custos_veiculo FOREIGN KEY (veiculo_id, negocio_id)
    REFERENCES veiculos (id, negocio_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_veiculo_custos_veiculo ON veiculo_custos (veiculo_id);

-- ---------------- historico de preco ---------------------------------------
-- Toda mudanca de preco fica registrada. Serve pra avisar quem salvou o carro
-- que baixou, e pra mostrar pro dono que ele segurou o preco errado por quatro
-- meses.
CREATE TABLE IF NOT EXISTS veiculo_precos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id      UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  veiculo_id      UUID NOT NULL,
  preco_antigo_cent INTEGER,
  preco_novo_cent   INTEGER NOT NULL,
  usuario_id      UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_veiculo_precos_veiculo FOREIGN KEY (veiculo_id, negocio_id)
    REFERENCES veiculos (id, negocio_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_veiculo_precos_veiculo ON veiculo_precos (veiculo_id, criado_em DESC);

-- ---------------- referencia de mercado ------------------------------------
-- FIPE e media dos portais. E o que transforma "esse carro esta parado" em
-- "esse carro esta parado PORQUE esta 8% acima do mercado", que e a frase que
-- faz o dono agir. Preco acima do mercado e a causa mais comum de carro parado.
CREATE TABLE IF NOT EXISTS veiculo_referencias (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id        UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  veiculo_id        UUID NOT NULL,
  fipe_cent         INTEGER,
  media_mercado_cent INTEGER,
  amostra           SMALLINT,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_veiculo_referencias_veiculo FOREIGN KEY (veiculo_id, negocio_id)
    REFERENCES veiculos (id, negocio_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_veiculo_referencias_veiculo ON veiculo_referencias (veiculo_id, criado_em DESC);

-- ---------------- publicacao nos portais -----------------------------------
-- Uma linha por veiculo por portal. E esta tabela que mata o anuncio fantasma:
-- vendeu, todas as linhas viram 'removido' e o robo despublica. Sem registrar
-- por portal nao da pra saber onde o anuncio ficou vivo, e a loja queima o
-- tempo da equipe com comprador atras de carro que ja foi.
CREATE TABLE IF NOT EXISTS veiculo_publicacoes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id    UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  veiculo_id    UUID NOT NULL,
  portal        TEXT NOT NULL
                CHECK (portal IN ('olx','webmotors','icarros','mercadolivre','mobiauto','site')),
  status        TEXT NOT NULL DEFAULT 'pendente'
                CHECK (status IN ('pendente','publicado','erro','removido')),
  id_externo    TEXT,
  url           TEXT,
  erro          TEXT,
  publicado_em  TIMESTAMPTZ,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_veiculo_portal UNIQUE (veiculo_id, portal),
  CONSTRAINT fk_veiculo_publicacoes_veiculo FOREIGN KEY (veiculo_id, negocio_id)
    REFERENCES veiculos (id, negocio_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_veiculo_publicacoes_pendente ON veiculo_publicacoes (negocio_id, status);

-- ---------------- lead ganha veiculo e filial ------------------------------
-- Reaproveita a tabela leads do CRM em vez de criar um funil paralelo. Dois
-- funis no mesmo sistema e o caminho mais curto pra perder lead entre eles.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS veiculo_id UUID;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS filial_id  UUID;

-- Veiculo e filial do lead TEM que ser do mesmo cliente do lead. O banco recusa
-- o contrario. DO $$ porque ADD CONSTRAINT nao tem IF NOT EXISTS.
DO $$ BEGIN
  ALTER TABLE leads ADD CONSTRAINT uq_leads_id_negocio UNIQUE (id, negocio_id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE leads ADD CONSTRAINT fk_leads_veiculo
    FOREIGN KEY (veiculo_id, negocio_id) REFERENCES veiculos (id, negocio_id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE leads ADD CONSTRAINT fk_leads_filial
    FOREIGN KEY (filial_id, negocio_id) REFERENCES filiais (id, negocio_id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- Quanto a loja demorou pra responder. Existe por um motivo so: lead que
-- espera mais de cinco minutos ja esta na concorrencia, e hoje nenhum lojista
-- sabe esse numero da propria operacao.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS primeira_resposta_em TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS responsavel_id UUID REFERENCES usuarios(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_leads_veiculo ON leads (veiculo_id);

-- ---------------- avaliacao de troca ---------------------------------------
-- Entra pelo site sem cadastro nenhum, entao quase tudo e opcional. Exigir
-- campo aqui derruba o envio, e o avaliador descobre o resto pela placa.
-- Vale porque boa parte da venda de seminovo comeca assim: a pessoa so compra
-- o proximo depois de saber quanto vale o dela.
CREATE TABLE IF NOT EXISTS avaliacoes_troca (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id    UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  lead_id       UUID,
  marca         TEXT NOT NULL,
  modelo        TEXT NOT NULL,
  versao        TEXT,
  ano           SMALLINT,
  km            INTEGER,
  observacoes   TEXT,
  nome          TEXT,
  telefone      TEXT,
  valor_ofertado_cent INTEGER,
  avaliado_por  UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  avaliado_em   TIMESTAMPTZ,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_avaliacoes_lead FOREIGN KEY (lead_id, negocio_id)
    REFERENCES leads (id, negocio_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_troca_negocio ON avaliacoes_troca (negocio_id, criado_em DESC);

-- ---------------- venda ----------------------------------------------------
-- Fecha o ciclo do veiculo. veiculo_troca_id aponta pro carro que ENTROU na
-- troca, entao uma troca gera saida de um e entrada de outro, ligados.
CREATE TABLE IF NOT EXISTS vendas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id      UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  filial_id       UUID,
  veiculo_id      UUID NOT NULL,
  lead_id         UUID,
  vendedor_id     UUID REFERENCES usuarios(id) ON DELETE SET NULL,

  comprador_nome  TEXT NOT NULL,
  comprador_telefone TEXT,
  comprador_documento TEXT,

  valor_cent      INTEGER NOT NULL DEFAULT 0,
  forma           TEXT NOT NULL CHECK (forma IN ('avista','financiado','consorcio','troca')),
  entrada_cent    INTEGER,
  financeira      TEXT,
  parcelas        SMALLINT,
  veiculo_troca_id UUID,
  comissao_cent   INTEGER,

  -- Referencia da nota emitida no servico externo. A emissao nao mora aqui.
  nota_fiscal_id  TEXT,
  nota_fiscal_url TEXT,

  data            DATE NOT NULL DEFAULT CURRENT_DATE,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Venda nao cruza inquilino em nenhuma das pontas.
  CONSTRAINT fk_vendas_veiculo FOREIGN KEY (veiculo_id, negocio_id)
    REFERENCES veiculos (id, negocio_id) ON DELETE RESTRICT,
  CONSTRAINT fk_vendas_troca FOREIGN KEY (veiculo_troca_id, negocio_id)
    REFERENCES veiculos (id, negocio_id) ON DELETE SET NULL,
  CONSTRAINT fk_vendas_filial FOREIGN KEY (filial_id, negocio_id)
    REFERENCES filiais (id, negocio_id) ON DELETE SET NULL,
  CONSTRAINT fk_vendas_lead FOREIGN KEY (lead_id, negocio_id)
    REFERENCES leads (id, negocio_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_vendas_negocio ON vendas (negocio_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_vendas_vendedor ON vendas (vendedor_id);
-- Um veiculo se vende uma vez. Venda duplicada quebra o giro e a comissao.
CREATE UNIQUE INDEX IF NOT EXISTS uq_vendas_veiculo ON vendas (veiculo_id);
