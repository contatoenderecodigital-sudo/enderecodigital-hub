-- ============================================================================
-- migration_0003_food.sql — Módulo AppFood (restaurante) do Endereço Digital Hub.
-- ----------------------------------------------------------------------------
-- Regra de ouro do blueprint mantida: TODA tabela tem `negocio_id NOT NULL`
-- + índice. O isolamento é em código (lib/food.ts sempre recebe negocioId).
--
-- Níveis:
--   negocios (tenant)  ->  food_lojas (unidade)  ->  mesas/produtos/pedidos
-- Um negócio pode ter mais de uma loja (matriz e filial) sem duplicar cliente.
--
-- URL pública do cliente final:  /c/<food_lojas.slug>            (cardápio)
--                                /c/<slug>/m/<food_mesas.token>  (mesa via NFC/QR)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. O módulo no hub e no cliente (mesmo padrão dos outros módulos)
-- ----------------------------------------------------------------------------
ALTER TABLE hubs     ADD COLUMN IF NOT EXISTS mod_food BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS mod_food BOOLEAN NULL;

-- ----------------------------------------------------------------------------
-- 1. LOJA — a unidade que abre e fecha, tem mesa, cardápio e caixa.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS food_lojas (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id        UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    slug              TEXT NOT NULL UNIQUE,          -- /c/<slug>
    nome              TEXT NOT NULL,
    tipo              TEXT NOT NULL DEFAULT 'restaurante'
                      CHECK (tipo IN ('restaurante','bar','pizzaria','lanchonete','cafe','sorveteria','outro')),

    -- marca do CLIENTE (o cardápio sai com a cara dele, não do hub)
    logo_url          TEXT NULL,
    capa_url          TEXT NULL,
    cor_destaque      TEXT NULL,
    cor_fundo         TEXT NULL,
    tema_modo         TEXT NOT NULL DEFAULT 'claro' CHECK (tema_modo IN ('claro','escuro')),

    telefone          TEXT NULL,
    whatsapp          TEXT NULL,
    endereco          TEXT NULL,
    cidade            TEXT NULL,
    uf                TEXT NULL DEFAULT 'SC',
    fuso              TEXT NOT NULL DEFAULT 'America/Sao_Paulo',

    -- operação de salão
    aceita_mesa               BOOLEAN NOT NULL DEFAULT TRUE,
    aceita_balcao             BOOLEAN NOT NULL DEFAULT TRUE,
    aceita_delivery           BOOLEAN NOT NULL DEFAULT FALSE,
    exige_aprovacao_garcom    BOOLEAN NOT NULL DEFAULT FALSE,  -- pedido da mesa espera o garçom liberar
    limite_sessao_sem_aprov   NUMERIC(10,2) NOT NULL DEFAULT 0, -- 0 = sem limite
    taxa_servico_pct          NUMERIC(5,2)  NOT NULL DEFAULT 10,
    taxa_servico_automatica   BOOLEAN NOT NULL DEFAULT FALSE,   -- soma sozinha na conta
    couvert                   NUMERIC(10,2) NOT NULL DEFAULT 0,
    tempo_preparo_min         INTEGER NOT NULL DEFAULT 25,

    -- delivery
    entrega_raio_km           NUMERIC(6,2) NULL,
    entrega_pedido_minimo     NUMERIC(10,2) NOT NULL DEFAULT 0,
    aceita_retirada           BOOLEAN NOT NULL DEFAULT TRUE,

    -- pagamento no celular
    pagar_no_app              BOOLEAN NOT NULL DEFAULT FALSE,
    pix_provedor              TEXT NULL,   -- mercadopago | asaas (o dinheiro é do cliente)
    pix_chave                 TEXT NULL,   -- só para exibir
    pix_token_cifrado         TEXT NULL,   -- credencial do PSP, cifrada pelo cofre (lib/cofre.ts)
    gorjeta_sugerida_pct      NUMERIC(5,2) NOT NULL DEFAULT 10,

    -- fiscal (NFC-e; em SC é sempre NFC-e, SAT é só SP)
    fiscal_ativo              BOOLEAN NOT NULL DEFAULT FALSE,
    fiscal_provedor           TEXT NULL,   -- focusnfe | plugnotas
    fiscal_cnpj               TEXT NULL,
    fiscal_ambiente           TEXT NOT NULL DEFAULT 'homologacao'
                              CHECK (fiscal_ambiente IN ('homologacao','producao')),
    fiscal_token_ref          TEXT NULL,   -- ponteiro pro cofre, NUNCA o token em claro

    aberto_manual             BOOLEAN NULL, -- NULL = usa horário; TRUE/FALSE = força
    ativo                     BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em                 TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_food_lojas_negocio ON food_lojas (negocio_id);

-- Horário de funcionamento (0=domingo .. 6=sábado). Várias faixas por dia.
CREATE TABLE IF NOT EXISTS food_horarios (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id   UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    loja_id      UUID NOT NULL REFERENCES food_lojas(id) ON DELETE CASCADE,
    dia_semana   SMALLINT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
    abre         TIME NOT NULL,
    fecha        TIME NOT NULL,
    canal        TEXT NOT NULL DEFAULT 'todos' CHECK (canal IN ('todos','mesa','delivery','balcao'))
);
CREATE INDEX IF NOT EXISTS idx_food_horarios_loja ON food_horarios (loja_id, dia_semana);

-- ----------------------------------------------------------------------------
-- 2. ÁREAS DE PRODUÇÃO — cozinha, chapa, bar, sobremesa. Definem KDS e impressora.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS food_areas (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id   UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    loja_id      UUID NOT NULL REFERENCES food_lojas(id) ON DELETE CASCADE,
    nome         TEXT NOT NULL,
    cor          TEXT NULL,
    ordem        INTEGER NOT NULL DEFAULT 0,
    ativa        BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_food_areas_loja ON food_areas (loja_id);

-- ----------------------------------------------------------------------------
-- 3. MESAS — cada uma com token opaco. É o que vai gravado no cartão NFC.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS food_mesas (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id   UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    loja_id      UUID NOT NULL REFERENCES food_lojas(id) ON DELETE CASCADE,
    numero       TEXT NOT NULL,                 -- "12", "Balcão 3", "Varanda A"
    apelido      TEXT NULL,
    token        TEXT NOT NULL UNIQUE,          -- aleatório, nunca sequencial
    capacidade   SMALLINT NOT NULL DEFAULT 4,
    setor        TEXT NULL,                     -- salão, varanda, mezanino
    ordem        INTEGER NOT NULL DEFAULT 0,
    cartao_gravado_em TIMESTAMPTZ NULL,         -- quando o NFC foi gravado
    ativa        BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (loja_id, numero)
);
CREATE INDEX IF NOT EXISTS idx_food_mesas_loja ON food_mesas (loja_id, ativa);

-- ----------------------------------------------------------------------------
-- 4. CARDÁPIO
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS food_categorias (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id   UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    loja_id      UUID NOT NULL REFERENCES food_lojas(id) ON DELETE CASCADE,
    nome         TEXT NOT NULL,
    descricao    TEXT NULL,
    imagem_url   TEXT NULL,
    ordem        INTEGER NOT NULL DEFAULT 0,
    -- turnos em que aparece: NULL/vazio = sempre. Ex.: {almoco,jantar}
    turnos       TEXT[] NULL,
    hora_inicio  TIME NULL,
    hora_fim     TIME NULL,
    canais       TEXT[] NOT NULL DEFAULT ARRAY['mesa','balcao','delivery'],
    ativa        BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_food_categorias_loja ON food_categorias (loja_id, ordem);

CREATE TABLE IF NOT EXISTS food_produtos (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id     UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    loja_id        UUID NOT NULL REFERENCES food_lojas(id) ON DELETE CASCADE,
    categoria_id   UUID NOT NULL REFERENCES food_categorias(id) ON DELETE CASCADE,
    area_id        UUID NULL REFERENCES food_areas(id) ON DELETE SET NULL, -- onde produz/imprime
    nome           TEXT NOT NULL,
    descricao      TEXT NULL,
    imagem_url     TEXT NULL,
    preco          NUMERIC(10,2) NOT NULL DEFAULT 0,
    preco_promo    NUMERIC(10,2) NULL,
    codigo         TEXT NULL,                    -- código interno / PLU
    serve_pessoas  SMALLINT NULL,
    tempo_preparo  INTEGER NULL,
    -- pizza / tamanhos: quando TRUE, os "tamanhos" vêm de food_variacoes
    tem_variacao   BOOLEAN NOT NULL DEFAULT FALSE,
    permite_meia   BOOLEAN NOT NULL DEFAULT FALSE, -- meia a meia
    destaque       BOOLEAN NOT NULL DEFAULT FALSE,
    ordem          INTEGER NOT NULL DEFAULT 0,
    canais         TEXT[] NOT NULL DEFAULT ARRAY['mesa','balcao','delivery'],
    -- fiscal por item (NFC-e precisa disso quando o módulo fiscal ligar)
    ncm            TEXT NULL,
    cfop           TEXT NULL,
    cest           TEXT NULL,
    csosn          TEXT NULL,
    unidade        TEXT NOT NULL DEFAULT 'UN',
    esgotado       BOOLEAN NOT NULL DEFAULT FALSE,
    esgotado_ate   TIMESTAMPTZ NULL,             -- volta sozinho no dia seguinte
    ativo          BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_food_produtos_cat ON food_produtos (categoria_id, ordem);
CREATE INDEX IF NOT EXISTS idx_food_produtos_loja ON food_produtos (loja_id, ativo);

-- Tamanhos (Pizza G/M/P, Chope 300/500). Preço próprio por variação.
CREATE TABLE IF NOT EXISTS food_variacoes (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id   UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    produto_id   UUID NOT NULL REFERENCES food_produtos(id) ON DELETE CASCADE,
    nome         TEXT NOT NULL,
    preco        NUMERIC(10,2) NOT NULL,
    fatias       SMALLINT NULL,        -- pizza: quantos sabores cabem
    ordem        INTEGER NOT NULL DEFAULT 0,
    ativa        BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_food_variacoes_prod ON food_variacoes (produto_id, ordem);

-- Grupos de opção: "Ponto da carne" (obrigatório, 1), "Adicionais" (0 a 5).
CREATE TABLE IF NOT EXISTS food_grupos_opcao (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id    UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    produto_id    UUID NOT NULL REFERENCES food_produtos(id) ON DELETE CASCADE,
    nome          TEXT NOT NULL,
    minimo        SMALLINT NOT NULL DEFAULT 0,
    maximo        SMALLINT NOT NULL DEFAULT 1,
    obrigatorio   BOOLEAN NOT NULL DEFAULT FALSE,
    tipo_preco    TEXT NOT NULL DEFAULT 'soma' CHECK (tipo_preco IN ('soma','maior','media')),
    ordem         INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_food_grupos_prod ON food_grupos_opcao (produto_id, ordem);

CREATE TABLE IF NOT EXISTS food_opcoes (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id    UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    grupo_id      UUID NOT NULL REFERENCES food_grupos_opcao(id) ON DELETE CASCADE,
    nome          TEXT NOT NULL,
    preco_extra   NUMERIC(10,2) NOT NULL DEFAULT 0,
    insumo_id     UUID NULL,          -- baixa estoque quando escolhida
    insumo_qtd    NUMERIC(12,4) NULL,
    esgotado      BOOLEAN NOT NULL DEFAULT FALSE,
    ordem         INTEGER NOT NULL DEFAULT 0,
    ativa         BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_food_opcoes_grupo ON food_opcoes (grupo_id, ordem);

-- ----------------------------------------------------------------------------
-- 5. CLIENTE FINAL (quem come). Alimenta o CRM do hub.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS food_clientes (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id     UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    nome           TEXT NULL,
    telefone       TEXT NULL,
    email          TEXT NULL,
    cpf            TEXT NULL,                  -- "CPF na nota"
    nascimento     DATE NULL,
    optin_whats    BOOLEAN NOT NULL DEFAULT FALSE,
    endereco_json  JSONB NULL,
    pedidos_qtd    INTEGER NOT NULL DEFAULT 0,
    total_gasto    NUMERIC(12,2) NOT NULL DEFAULT 0,
    primeiro_pedido TIMESTAMPTZ NULL,
    ultimo_pedido  TIMESTAMPTZ NULL,
    criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (negocio_id, telefone)
);
CREATE INDEX IF NOT EXISTS idx_food_clientes_neg ON food_clientes (negocio_id);

-- ----------------------------------------------------------------------------
-- 6. EQUIPE E DISPOSITIVOS — garçom e cozinha entram por PIN, não por senha.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS food_equipe (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id   UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    loja_id      UUID NOT NULL REFERENCES food_lojas(id) ON DELETE CASCADE,
    nome         TEXT NOT NULL,
    papel        TEXT NOT NULL DEFAULT 'garcom'
                 CHECK (papel IN ('gerente','garcom','cozinha','caixa','entregador')),
    pin_hash     TEXT NULL,
    comissao_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
    ativo        BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_food_equipe_loja ON food_equipe (loja_id, ativo);

-- Tablet da cozinha / do garçom: abre por link com token, sem login.
CREATE TABLE IF NOT EXISTS food_dispositivos (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id   UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    loja_id      UUID NOT NULL REFERENCES food_lojas(id) ON DELETE CASCADE,
    nome         TEXT NOT NULL,
    tipo         TEXT NOT NULL DEFAULT 'kds' CHECK (tipo IN ('kds','garcom','caixa','totem')),
    area_id      UUID NULL REFERENCES food_areas(id) ON DELETE SET NULL,
    token        TEXT NOT NULL UNIQUE,      -- /k/<token>
    exige_pin    BOOLEAN NOT NULL DEFAULT FALSE,
    ultimo_uso   TIMESTAMPTZ NULL,
    ativo        BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_food_disp_loja ON food_dispositivos (loja_id, ativo);

-- ----------------------------------------------------------------------------
-- 7. SESSÃO DE MESA — a comanda compartilhada. É o coração do produto.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS food_sessoes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id      UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    loja_id         UUID NOT NULL REFERENCES food_lojas(id) ON DELETE CASCADE,
    mesa_id         UUID NOT NULL REFERENCES food_mesas(id) ON DELETE RESTRICT,
    codigo          TEXT NOT NULL,             -- código curto pra falar em voz alta
    status          TEXT NOT NULL DEFAULT 'aberta'
                    CHECK (status IN ('aberta','conta_pedida','aguardando_pagamento','fechada','cancelada')),
    pessoas         SMALLINT NOT NULL DEFAULT 1,
    garcom_id       UUID NULL REFERENCES food_equipe(id) ON DELETE SET NULL,
    subtotal        NUMERIC(12,2) NOT NULL DEFAULT 0,
    taxa_servico    NUMERIC(12,2) NOT NULL DEFAULT 0,
    couvert_total   NUMERIC(12,2) NOT NULL DEFAULT 0,
    desconto        NUMERIC(12,2) NOT NULL DEFAULT 0,
    total           NUMERIC(12,2) NOT NULL DEFAULT 0,
    pago            NUMERIC(12,2) NOT NULL DEFAULT 0,
    aberta_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
    conta_pedida_em TIMESTAMPTZ NULL,
    fechada_em      TIMESTAMPTZ NULL,
    fechada_por     TEXT NULL
);
CREATE INDEX IF NOT EXISTS idx_food_sessoes_mesa ON food_sessoes (mesa_id, status);
CREATE INDEX IF NOT EXISTS idx_food_sessoes_loja ON food_sessoes (loja_id, status);
-- Uma mesa só pode ter UMA sessão viva. Isto é o que impede comanda duplicada.
CREATE UNIQUE INDEX IF NOT EXISTS uq_food_sessao_viva
    ON food_sessoes (mesa_id)
    WHERE status IN ('aberta','conta_pedida','aguardando_pagamento');

-- Quem está na mesa (cada celular que encostou no cartão).
CREATE TABLE IF NOT EXISTS food_sessao_membros (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id   UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    sessao_id    UUID NOT NULL REFERENCES food_sessoes(id) ON DELETE CASCADE,
    device_id    TEXT NOT NULL,             -- id gerado no navegador do cliente
    apelido      TEXT NULL,                 -- "João", pra dividir a conta depois
    cliente_id   UUID NULL REFERENCES food_clientes(id) ON DELETE SET NULL,
    entrou_em    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (sessao_id, device_id)
);

-- Chamar garçom / pedir a conta.
CREATE TABLE IF NOT EXISTS food_chamados (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id   UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    loja_id      UUID NOT NULL REFERENCES food_lojas(id) ON DELETE CASCADE,
    mesa_id      UUID NOT NULL REFERENCES food_mesas(id) ON DELETE CASCADE,
    sessao_id    UUID NULL REFERENCES food_sessoes(id) ON DELETE CASCADE,
    tipo         TEXT NOT NULL DEFAULT 'garcom' CHECK (tipo IN ('garcom','conta','ajuda')),
    obs          TEXT NULL,
    status       TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','atendido','cancelado')),
    criado_em    TIMESTAMPTZ NOT NULL DEFAULT now(),
    atendido_em  TIMESTAMPTZ NULL,
    atendido_por UUID NULL REFERENCES food_equipe(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_food_chamados_loja ON food_chamados (loja_id, status);

-- ----------------------------------------------------------------------------
-- 8. PEDIDOS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS food_pedidos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id      UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    loja_id         UUID NOT NULL REFERENCES food_lojas(id) ON DELETE CASCADE,
    numero_dia      INTEGER NOT NULL,             -- 1, 2, 3... reinicia por dia/loja
    dia             DATE NOT NULL DEFAULT CURRENT_DATE,
    canal           TEXT NOT NULL DEFAULT 'mesa'
                    CHECK (canal IN ('mesa','balcao','delivery','whatsapp','marketplace')),
    sessao_id       UUID NULL REFERENCES food_sessoes(id) ON DELETE SET NULL,
    mesa_id         UUID NULL REFERENCES food_mesas(id) ON DELETE SET NULL,
    cliente_id      UUID NULL REFERENCES food_clientes(id) ON DELETE SET NULL,
    garcom_id       UUID NULL REFERENCES food_equipe(id) ON DELETE SET NULL,
    status          TEXT NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente','aprovado','em_producao','pronto','entregue','cancelado')),
    origem_device   TEXT NULL,                    -- de qual celular veio (anti abuso)
    origem_ip       TEXT NULL,
    obs             TEXT NULL,
    subtotal        NUMERIC(12,2) NOT NULL DEFAULT 0,
    taxa_entrega    NUMERIC(12,2) NOT NULL DEFAULT 0,
    desconto        NUMERIC(12,2) NOT NULL DEFAULT 0,
    total           NUMERIC(12,2) NOT NULL DEFAULT 0,
    -- delivery
    entrega_json    JSONB NULL,                   -- endereço, bairro, referência
    entregador_id   UUID NULL REFERENCES food_equipe(id) ON DELETE SET NULL,
    previsao_min    INTEGER NULL,
    -- fiscal
    nfce_status     TEXT NULL CHECK (nfce_status IN ('nao_emitida','processando','autorizada','erro','cancelada')),
    nfce_chave      TEXT NULL,
    nfce_url        TEXT NULL,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
    aprovado_em     TIMESTAMPTZ NULL,
    producao_em     TIMESTAMPTZ NULL,
    pronto_em       TIMESTAMPTZ NULL,
    entregue_em     TIMESTAMPTZ NULL,
    cancelado_em    TIMESTAMPTZ NULL,
    cancelado_motivo TEXT NULL,
    pago_em         TIMESTAMPTZ NULL,
    UNIQUE (loja_id, dia, numero_dia)
);
CREATE INDEX IF NOT EXISTS idx_food_pedidos_loja_status ON food_pedidos (loja_id, status, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_food_pedidos_sessao ON food_pedidos (sessao_id);
CREATE INDEX IF NOT EXISTS idx_food_pedidos_dia ON food_pedidos (loja_id, dia);

CREATE TABLE IF NOT EXISTS food_itens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id      UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    pedido_id       UUID NOT NULL REFERENCES food_pedidos(id) ON DELETE CASCADE,
    produto_id      UUID NULL REFERENCES food_produtos(id) ON DELETE SET NULL,
    variacao_id     UUID NULL REFERENCES food_variacoes(id) ON DELETE SET NULL,
    area_id         UUID NULL REFERENCES food_areas(id) ON DELETE SET NULL,
    nome_snapshot   TEXT NOT NULL,             -- nome no momento da venda
    qtd             NUMERIC(10,3) NOT NULL DEFAULT 1,
    preco_unit      NUMERIC(10,2) NOT NULL DEFAULT 0,
    preco_total     NUMERIC(12,2) NOT NULL DEFAULT 0,
    opcoes_json     JSONB NULL,                -- [{grupo,nome,preco}]
    meia_json       JSONB NULL,                -- pizza meia a meia
    obs             TEXT NULL,
    membro_id       UUID NULL REFERENCES food_sessao_membros(id) ON DELETE SET NULL, -- quem pediu
    status          TEXT NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente','em_producao','pronto','entregue','cancelado')),
    producao_em     TIMESTAMPTZ NULL,
    pronto_em       TIMESTAMPTZ NULL,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_food_itens_pedido ON food_itens (pedido_id);
CREATE INDEX IF NOT EXISTS idx_food_itens_area ON food_itens (area_id, status);

-- Contador de número do pedido por loja/dia (evita disputa em rush).
CREATE TABLE IF NOT EXISTS food_contadores (
    loja_id   UUID NOT NULL REFERENCES food_lojas(id) ON DELETE CASCADE,
    dia       DATE NOT NULL,
    ultimo    INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (loja_id, dia)
);

-- ----------------------------------------------------------------------------
-- 9. PAGAMENTO E CAIXA
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS food_caixas (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id    UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    loja_id       UUID NOT NULL REFERENCES food_lojas(id) ON DELETE CASCADE,
    aberto_por    UUID NULL REFERENCES food_equipe(id) ON DELETE SET NULL,
    saldo_inicial NUMERIC(12,2) NOT NULL DEFAULT 0,
    saldo_final   NUMERIC(12,2) NULL,
    diferenca     NUMERIC(12,2) NULL,
    status        TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','fechado')),
    aberto_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
    fechado_em    TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_food_caixas_loja ON food_caixas (loja_id, status);

CREATE TABLE IF NOT EXISTS food_pagamentos (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id    UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    loja_id       UUID NOT NULL REFERENCES food_lojas(id) ON DELETE CASCADE,
    sessao_id     UUID NULL REFERENCES food_sessoes(id) ON DELETE SET NULL,
    pedido_id     UUID NULL REFERENCES food_pedidos(id) ON DELETE SET NULL,
    caixa_id      UUID NULL REFERENCES food_caixas(id) ON DELETE SET NULL,
    metodo        TEXT NOT NULL
                  CHECK (metodo IN ('dinheiro','debito','credito','pix','pix_app','vale','online','cortesia')),
    valor         NUMERIC(12,2) NOT NULL,
    gorjeta       NUMERIC(12,2) NOT NULL DEFAULT 0,
    troco_para    NUMERIC(12,2) NULL,
    status        TEXT NOT NULL DEFAULT 'confirmado'
                  CHECK (status IN ('pendente','confirmado','estornado','falhou','expirado')),
    -- pagamento no celular
    psp           TEXT NULL,
    psp_id        TEXT NULL,                 -- id da cobrança no provedor
    pix_copia_cola TEXT NULL,
    pix_qr_url    TEXT NULL,
    pago_por      TEXT NULL,                 -- apelido do membro que pagou
    membro_id     UUID NULL REFERENCES food_sessao_membros(id) ON DELETE SET NULL,
    recebido_por  UUID NULL REFERENCES food_equipe(id) ON DELETE SET NULL,
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
    confirmado_em TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_food_pag_sessao ON food_pagamentos (sessao_id);
CREATE INDEX IF NOT EXISTS idx_food_pag_loja ON food_pagamentos (loja_id, criado_em DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_food_pag_psp ON food_pagamentos (psp, psp_id) WHERE psp_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS food_caixa_mov (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id   UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    caixa_id     UUID NOT NULL REFERENCES food_caixas(id) ON DELETE CASCADE,
    tipo         TEXT NOT NULL CHECK (tipo IN ('sangria','suprimento','ajuste')),
    valor        NUMERIC(12,2) NOT NULL,
    motivo       TEXT NULL,
    por          UUID NULL REFERENCES food_equipe(id) ON DELETE SET NULL,
    criado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 10. IMPRESSÃO — fila que a impressora (CloudPRNT) ou o agente local consome.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS food_impressoras (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id      UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    loja_id         UUID NOT NULL REFERENCES food_lojas(id) ON DELETE CASCADE,
    area_id         UUID NULL REFERENCES food_areas(id) ON DELETE SET NULL,
    nome            TEXT NOT NULL,
    tipo            TEXT NOT NULL DEFAULT 'cloudprnt'
                    CHECK (tipo IN ('cloudprnt','agente','navegador')),
    chave           TEXT NOT NULL UNIQUE,      -- vai na URL que a impressora consulta
    colunas         SMALLINT NOT NULL DEFAULT 48,
    vias            SMALLINT NOT NULL DEFAULT 1,
    imprime         TEXT[] NOT NULL DEFAULT ARRAY['comanda'], -- comanda | conta | via_cliente
    ultimo_ping     TIMESTAMPTZ NULL,
    ativa           BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_food_impressoras_loja ON food_impressoras (loja_id, ativa);

CREATE TABLE IF NOT EXISTS food_print_jobs (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id     UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    impressora_id  UUID NOT NULL REFERENCES food_impressoras(id) ON DELETE CASCADE,
    pedido_id      UUID NULL REFERENCES food_pedidos(id) ON DELETE SET NULL,
    sessao_id      UUID NULL REFERENCES food_sessoes(id) ON DELETE SET NULL,
    tipo           TEXT NOT NULL DEFAULT 'comanda'
                   CHECK (tipo IN ('comanda','conta','via_cliente','teste')),
    conteudo       TEXT NOT NULL,             -- texto já formatado na largura da impressora
    status         TEXT NOT NULL DEFAULT 'pendente'
                   CHECK (status IN ('pendente','entregue','confirmado','erro','cancelado')),
    tentativas     SMALLINT NOT NULL DEFAULT 0,
    erro           TEXT NULL,
    criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
    entregue_em    TIMESTAMPTZ NULL,
    confirmado_em  TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_food_jobs_fila ON food_print_jobs (impressora_id, status, criado_em);

-- ----------------------------------------------------------------------------
-- 11. ESTOQUE COM FICHA TÉCNICA — baixa insumo, não produto.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS food_insumos (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id    UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    loja_id       UUID NOT NULL REFERENCES food_lojas(id) ON DELETE CASCADE,
    nome          TEXT NOT NULL,
    unidade       TEXT NOT NULL DEFAULT 'kg',   -- kg, g, l, ml, un
    categoria     TEXT NULL,
    saldo         NUMERIC(14,4) NOT NULL DEFAULT 0,
    minimo        NUMERIC(14,4) NOT NULL DEFAULT 0,
    custo_medio   NUMERIC(12,4) NOT NULL DEFAULT 0,
    fornecedor    TEXT NULL,
    ativo         BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_food_insumos_loja ON food_insumos (loja_id, ativo);

CREATE TABLE IF NOT EXISTS food_ficha_tecnica (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id    UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    produto_id    UUID NOT NULL REFERENCES food_produtos(id) ON DELETE CASCADE,
    variacao_id   UUID NULL REFERENCES food_variacoes(id) ON DELETE CASCADE,
    insumo_id     UUID NOT NULL REFERENCES food_insumos(id) ON DELETE CASCADE,
    quantidade    NUMERIC(14,4) NOT NULL,
    UNIQUE (produto_id, variacao_id, insumo_id)
);
CREATE INDEX IF NOT EXISTS idx_food_ficha_prod ON food_ficha_tecnica (produto_id);

CREATE TABLE IF NOT EXISTS food_estoque_mov (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id    UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    insumo_id     UUID NOT NULL REFERENCES food_insumos(id) ON DELETE CASCADE,
    tipo          TEXT NOT NULL CHECK (tipo IN ('entrada','saida_venda','perda','ajuste','inventario')),
    quantidade    NUMERIC(14,4) NOT NULL,       -- positivo entra, negativo sai
    custo_unit    NUMERIC(12,4) NULL,
    saldo_depois  NUMERIC(14,4) NOT NULL DEFAULT 0,
    pedido_id     UUID NULL REFERENCES food_pedidos(id) ON DELETE SET NULL,
    obs           TEXT NULL,
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_food_mov_insumo ON food_estoque_mov (insumo_id, criado_em DESC);

-- ----------------------------------------------------------------------------
-- 12. EVENTOS — fila que o WhatsApp oficial e o CRM do hub consomem.
-- Desacopla: o AppFood só grava o fato; quem dispara é o módulo de zap.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS food_eventos (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negocio_id    UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    loja_id       UUID NULL REFERENCES food_lojas(id) ON DELETE CASCADE,
    tipo          TEXT NOT NULL,   -- pedido_criado, pedido_pronto, saiu_entrega, conta_paga, chamou_garcom
    pedido_id     UUID NULL REFERENCES food_pedidos(id) ON DELETE CASCADE,
    sessao_id     UUID NULL REFERENCES food_sessoes(id) ON DELETE CASCADE,
    cliente_id    UUID NULL REFERENCES food_clientes(id) ON DELETE SET NULL,
    payload       JSONB NULL,
    processado_em TIMESTAMPTZ NULL,
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_food_eventos_fila ON food_eventos (processado_em, criado_em);

-- ============================================================================
-- FIM
-- ============================================================================
