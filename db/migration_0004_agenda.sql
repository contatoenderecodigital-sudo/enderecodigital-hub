-- ============================================================================
-- migration_0004_agenda.sql — Modulo Agenda. Idempotente.
--
-- Vira o modulo "Agenda" do workspace, ligado por negocio como os outros.
-- Todo dado e escopado por negocio_id, e a leitura passa pelo activeNegocioId
-- da sessao, igual ao CRM e ao modulo Veiculos.
--
-- PRIMEIRO NICHO: barbearia. ALVO: substituir o AppBarber na loja do cliente,
-- nao conviver com ele. Por isso aqui tem agenda, comanda, estoque, pacote,
-- fidelidade, pesquisa e comissao. O chao inteiro, nao so a parte bonita.
--
-- POR QUE "AGENDA" E NAO "BARBEARIA": nenhuma tabela aqui fala de cabelo.
-- Estetica, clinica, manicure e nutricao usam a mesma estrutura, e a Endereco
-- Digital ja atende esses nichos. Nomear pelo nicho obrigaria uma migration
-- nova pro segundo cliente sem ganhar nada.
--
-- DINHEIRO EM CENTAVOS INTEIROS, igual ao resto do hub.
--
-- ISOLAMENTO ENTRE CLIENTES. O hub isola por CODIGO: toda consulta filtra
-- negocio_id vindo da sessao, e nao existe RLS em nenhuma tabela. Funciona
-- enquanto ninguem esquecer um WHERE.
--
-- Aqui, como no modulo Veiculos, vai um degrau a mais que nao depende de
-- ninguem lembrar de nada: as chaves estrangeiras sao COMPOSTAS, carregando
-- negocio_id junto. O Postgres RECUSA na escrita um agendamento apontando pra
-- profissional de outro cliente, um item de comanda cruzando inquilino.
--
-- O que a chave composta nao cobre e a leitura: um SELECT sem WHERE lista
-- tudo. Por isso, em lib/agenda.ts, toda funcao recebe negocioId como primeiro
-- argumento obrigatorio, sem valor padrao.
--
-- REGRA DE APAGAR, e ela tem armadilha. Chave composta NAO pode usar ON DELETE
-- SET NULL: o Postgres anularia as DUAS colunas, inclusive negocio_id, que e
-- NOT NULL, e a exclusao estouraria. O modulo Veiculos tem esse defeito hoje,
-- nas chaves pra filiais e pra leads.
--
-- E tambem nao usa RESTRICT, que e conferido na hora: apagar um negocio inteiro
-- cascateia pra clientes e comandas, e um RESTRICT entre elas travaria a
-- propria cascata.
--
-- Entao aqui e NO ACTION, conferido no fim da instrucao. No uso normal protege
-- igual (apagar cliente que tem comanda falha), e a cascata do negocio passa.
-- Combina com a regra do modulo: nao se apaga registro, se arquiva ou cancela.
--
-- O QUE NAO TEM AQUI, DE PROPOSITO: rede social interna, agendamento por
-- Facebook, SMS, adquirencia propria e emissao de nota fiscal. Ver
-- Desktop/EnderecoDigital/sistema/barbeiro/doc/plano-produto.md.
-- ============================================================================

-- btree_gist e o que permite misturar igualdade de UUID com sobreposicao de
-- intervalo na mesma restricao de exclusao, que e a trava anti duplo
-- agendamento la embaixo. Sem ela o resto do modulo funciona e a trava nao
-- existe, entao o bloco avisa alto em vez de morrer calado.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS btree_gist;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE WARNING 'btree_gist nao pode ser criada por este usuario. A trava de duplo agendamento NAO sera instalada. Rode como superusuario: CREATE EXTENSION btree_gist;';
END $$;

-- ---------------- flag do modulo ------------------------------------------
-- Modulo no hub resolve como negocio.mod_x ?? hub.mod_x (ver modulosEfetivos
-- em lib/types.ts). Entao a flag existe nos DOIS niveis: no hub como padrao da
-- marca, e no negocio como excecao daquele cliente.
--
-- Padrao FALSE no hub: agenda e modulo de nicho, nao serve pra revenda de
-- carro nem pra padaria.
ALTER TABLE hubs     ADD COLUMN IF NOT EXISTS mod_agenda BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS mod_agenda BOOLEAN;

-- ---------------- agenda_config -------------------------------------------
-- Uma linha por negocio. Existe pra que a regra da casa fique em dado e nao
-- espalhada em constante de codigo, que foi o problema do persona.ts do Doce
-- Pao (horario e prazo viraram placeholder e ninguem lembrou de trocar).
CREATE TABLE IF NOT EXISTS agenda_config (
  negocio_id            UUID PRIMARY KEY REFERENCES negocios(id) ON DELETE CASCADE,

  -- Grade da agenda em minutos. 15 pra barbearia com corte de 30, 30 pra
  -- estetica com sessao longa.
  grade_min             INTEGER NOT NULL DEFAULT 15 CHECK (grade_min IN (5,10,15,20,30,60)),
  -- Quanto tempo antes o cliente ainda pode marcar sozinho. Sem isso alguem
  -- marca pras 14h as 13h58 e o barbeiro descobre com o cliente na porta.
  antecedencia_min_horas INTEGER NOT NULL DEFAULT 1,
  -- Ate quantos dias pra frente a agenda abre. Agenda infinita enche de
  -- marcacao que ninguem lembra.
  antecedencia_max_dias  INTEGER NOT NULL DEFAULT 60,
  -- Prazo pro proprio cliente cancelar sem falar com ninguem.
  cancelamento_horas     INTEGER NOT NULL DEFAULT 3,

  -- Lembrete e confirmacao, ambos por WhatsApp.
  lembrete_horas_antes   INTEGER NOT NULL DEFAULT 24,
  pede_confirmacao       BOOLEAN NOT NULL DEFAULT TRUE,

  -- Sinal. Nao e pra todo mundo: e a resposta pro cliente que ja faltou.
  exige_sinal            BOOLEAN NOT NULL DEFAULT FALSE,
  sinal_pct              INTEGER NOT NULL DEFAULT 0 CHECK (sinal_pct BETWEEN 0 AND 100),
  -- Faltas ate exigir sinal daquele cliente especifico.
  sinal_apos_faltas      INTEGER NOT NULL DEFAULT 2,

  lista_espera_ativa     BOOLEAN NOT NULL DEFAULT TRUE,
  pesquisa_ativa         BOOLEAN NOT NULL DEFAULT TRUE,

  fidelidade_ativa       BOOLEAN NOT NULL DEFAULT FALSE,
  -- Quantos pontos por real gasto.
  pontos_por_real        NUMERIC(6,2) NOT NULL DEFAULT 1,

  -- Comissao padrao da casa. O profissional pode ter a dele.
  comissao_servico_pct   NUMERIC(5,2) NOT NULL DEFAULT 50 CHECK (comissao_servico_pct BETWEEN 0 AND 100),
  comissao_produto_pct   NUMERIC(5,2) NOT NULL DEFAULT 10 CHECK (comissao_produto_pct BETWEEN 0 AND 100),

  atualizado_em          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------- profissionais -------------------------------------------
-- O barbeiro. usuario_id liga ao login: o profissional entra no painel e ve o
-- proprio fechamento de comissao, que e o que faz o time inteiro defender o
-- sistema em vez de so o dono.
CREATE TABLE IF NOT EXISTS agenda_profissionais (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id    UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  filial_id     UUID,
  -- NULL enquanto o barbeiro nao tem login proprio.
  usuario_id    UUID REFERENCES usuarios(id) ON DELETE SET NULL,

  nome          TEXT NOT NULL,
  -- Como aparece no card da agenda, onde nao cabe nome inteiro.
  apelido       TEXT,
  telefone      TEXT,
  -- Caminho relativo no volume persistente, igual as fotos de veiculo.
  foto          TEXT,
  -- Cor da faixa dele na agenda do dia.
  cor           TEXT,
  bio           TEXT,

  -- Comissao dele. NULL cai no padrao da casa em agenda_config.
  comissao_servico_pct NUMERIC(5,2) CHECK (comissao_servico_pct BETWEEN 0 AND 100),
  comissao_produto_pct NUMERIC(5,2) CHECK (comissao_produto_pct BETWEEN 0 AND 100),

  -- Barbeiro que so atende quem chega, sem agenda publica.
  aceita_online BOOLEAN NOT NULL DEFAULT TRUE,
  ordem         INTEGER NOT NULL DEFAULT 0,
  ativo         BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_profissionais_id_negocio UNIQUE (id, negocio_id),
  CONSTRAINT fk_profissionais_filial
    FOREIGN KEY (filial_id, negocio_id) REFERENCES filiais (id, negocio_id) ON DELETE NO ACTION
);
CREATE INDEX IF NOT EXISTS idx_profissionais_negocio ON agenda_profissionais (negocio_id) WHERE ativo;
CREATE INDEX IF NOT EXISTS idx_profissionais_usuario ON agenda_profissionais (usuario_id);

-- ---------------- servicos -------------------------------------------------
-- duracao_min e o que o cliente ocupa da cadeira. intervalo_pos_min e a
-- limpeza depois, que existe de verdade e some de todo sistema: sem ela a
-- agenda promete um encaixe que na pratica atrasa o dia inteiro.
CREATE TABLE IF NOT EXISTS agenda_servicos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id    UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,

  nome          TEXT NOT NULL,
  descricao     TEXT,
  categoria     TEXT,
  duracao_min   INTEGER NOT NULL CHECK (duracao_min > 0),
  intervalo_pos_min INTEGER NOT NULL DEFAULT 0 CHECK (intervalo_pos_min >= 0),

  preco_cent    INTEGER NOT NULL CHECK (preco_cent >= 0),
  -- INTERNO. Insumo gasto no servico. Nunca sai em rota publica.
  custo_cent    INTEGER NOT NULL DEFAULT 0 CHECK (custo_cent >= 0),

  -- Prazo sugerido de retorno deste servico. E so o ponto de partida: o
  -- raio-X usa o intervalo REAL daquele cliente, que e melhor que qualquer
  -- prazo de tabela.
  retorno_dias  INTEGER,

  -- FALSE = existe na comanda mas nao aparece pro cliente marcar sozinho.
  online        BOOLEAN NOT NULL DEFAULT TRUE,
  ordem         INTEGER NOT NULL DEFAULT 0,
  ativo         BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_servicos_id_negocio UNIQUE (id, negocio_id)
);
CREATE INDEX IF NOT EXISTS idx_servicos_negocio ON agenda_servicos (negocio_id) WHERE ativo;

-- ---------------- profissional_servicos ------------------------------------
-- Quem faz o que. Barbeiro veterano cobra mais e demora menos no mesmo corte,
-- entao preco e duracao podem ser sobrescritos aqui. NULL herda do servico.
CREATE TABLE IF NOT EXISTS agenda_profissional_servicos (
  negocio_id      UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  profissional_id UUID NOT NULL,
  servico_id      UUID NOT NULL,
  preco_cent      INTEGER CHECK (preco_cent >= 0),
  duracao_min     INTEGER CHECK (duracao_min > 0),

  PRIMARY KEY (profissional_id, servico_id),
  CONSTRAINT fk_ps_profissional
    FOREIGN KEY (profissional_id, negocio_id) REFERENCES agenda_profissionais (id, negocio_id) ON DELETE CASCADE,
  CONSTRAINT fk_ps_servico
    FOREIGN KEY (servico_id, negocio_id) REFERENCES agenda_servicos (id, negocio_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ps_negocio ON agenda_profissional_servicos (negocio_id);

-- ---------------- clientes -------------------------------------------------
-- O cliente do cliente: quem senta na cadeira. Nao confundir com negocios, que
-- e a barbearia, nem com ops_clientes, que sao os clientes da propria Endereco
-- Digital.
--
-- A chave humana e o telefone, porque e por ele que o WhatsApp acha a pessoa.
CREATE TABLE IF NOT EXISTS agenda_clientes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id    UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,

  nome          TEXT NOT NULL,
  -- So digitos, com pais e DDD, igual ao resto do hub.
  telefone      TEXT,
  email         TEXT,
  nascimento    DATE,

  -- INTERNO. Como a pessoa gosta do corte, maquina que usa, o que nao pode.
  observacoes   TEXT,
  -- INTERNO e vermelho na tela: alergia, quimica, o que der problema.
  alerta        TEXT,

  origem        TEXT CHECK (origem IS NULL OR origem IN ('whatsapp','site','app','painel','indicacao','presencial')),
  -- Cliente que faltou demais perde o direito de marcar sozinho.
  bloqueado     BOOLEAN NOT NULL DEFAULT FALSE,
  -- Optou por nao receber campanha. Respeitar isso e o que mantem o numero
  -- oficial vivo no WhatsApp.
  aceita_campanha BOOLEAN NOT NULL DEFAULT TRUE,

  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_clientes_id_negocio UNIQUE (id, negocio_id)
);
-- Mesmo telefone duas vezes na mesma barbearia vira historico partido ao meio,
-- e o raio-X passa a achar que o cliente sumiu quando ele so foi recadastrado.
CREATE UNIQUE INDEX IF NOT EXISTS uq_clientes_negocio_telefone
  ON agenda_clientes (negocio_id, telefone) WHERE telefone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clientes_negocio ON agenda_clientes (negocio_id);
-- Aniversariante do mes, sem varrer a base inteira.
CREATE INDEX IF NOT EXISTS idx_clientes_nascimento
  ON agenda_clientes (negocio_id, (EXTRACT(MONTH FROM nascimento))) WHERE nascimento IS NOT NULL;

-- ---------------- agenda_jornadas ------------------------------------------
-- Jornada por dia da semana, por profissional. Mais de uma linha no mesmo dia
-- e turno partido, que e o normal de quem fecha pro almoco.
CREATE TABLE IF NOT EXISTS agenda_jornadas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id      UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  profissional_id UUID NOT NULL,
  -- 0 domingo, 6 sabado, igual ao EXTRACT(DOW) do Postgres.
  dia_semana      SMALLINT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  inicio          TIME NOT NULL,
  fim             TIME NOT NULL,

  CONSTRAINT ck_jornada_ordem CHECK (fim > inicio),
  CONSTRAINT fk_jornada_profissional
    FOREIGN KEY (profissional_id, negocio_id) REFERENCES agenda_profissionais (id, negocio_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_jornadas_prof ON agenda_jornadas (profissional_id, dia_semana);

-- ---------------- agenda_excecoes ------------------------------------------
-- O dia que foge da regra: folga, feriado, jornada estendida na vespera de
-- Natal. profissional_id NULL vale pra barbearia inteira, que e como se fecha
-- no feriado sem editar a jornada de cada um.
CREATE TABLE IF NOT EXISTS agenda_excecoes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id      UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  profissional_id UUID,
  data            DATE NOT NULL,
  -- fechado ignora inicio e fim. jornada substitui a do dia.
  tipo            TEXT NOT NULL CHECK (tipo IN ('fechado','jornada')),
  inicio          TIME,
  fim             TIME,
  motivo          TEXT,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT ck_excecao_jornada CHECK (
    tipo = 'fechado' OR (inicio IS NOT NULL AND fim IS NOT NULL AND fim > inicio)
  ),
  CONSTRAINT fk_excecao_profissional
    FOREIGN KEY (profissional_id, negocio_id) REFERENCES agenda_profissionais (id, negocio_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_excecoes_negocio_data ON agenda_excecoes (negocio_id, data);

-- ---------------- agendamentos ---------------------------------------------
-- O coracao do modulo. Quatro portas marcam no mesmo lugar: site, app,
-- WhatsApp e balcao. Ver a trava logo abaixo da tabela.
CREATE TABLE IF NOT EXISTS agenda_agendamentos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id      UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  filial_id       UUID,
  profissional_id UUID NOT NULL,
  cliente_id      UUID NOT NULL,

  inicio          TIMESTAMPTZ NOT NULL,
  -- Ja inclui o intervalo pos servico. E o que a cadeira fica ocupada de fato.
  fim             TIMESTAMPTZ NOT NULL,

  status          TEXT NOT NULL DEFAULT 'confirmado'
                  CHECK (status IN ('pendente','confirmado','em_atendimento','concluido','faltou','cancelado')),
  origem          TEXT NOT NULL DEFAULT 'painel'
                  CHECK (origem IN ('whatsapp','site','app','painel','encaixe')),

  -- Somatorio dos servicos no momento da marcacao. O que vale no fim e a
  -- comanda, isto aqui e a previsao que alimenta a conta de cadeira vazia.
  preco_previsto_cent INTEGER NOT NULL DEFAULT 0 CHECK (preco_previsto_cent >= 0),

  observacao      TEXT,
  confirmado_em   TIMESTAMPTZ,
  lembrete_em     TIMESTAMPTZ,
  pesquisa_em     TIMESTAMPTZ,
  cancelado_em    TIMESTAMPTZ,
  cancelado_por   TEXT CHECK (cancelado_por IS NULL OR cancelado_por IN ('cliente','barbearia')),
  motivo_cancelamento TEXT,

  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT ck_agendamento_ordem CHECK (fim > inicio),
  CONSTRAINT uq_agendamentos_id_negocio UNIQUE (id, negocio_id),
  CONSTRAINT fk_agendamento_profissional
    FOREIGN KEY (profissional_id, negocio_id) REFERENCES agenda_profissionais (id, negocio_id) ON DELETE NO ACTION,
  CONSTRAINT fk_agendamento_cliente
    FOREIGN KEY (cliente_id, negocio_id) REFERENCES agenda_clientes (id, negocio_id) ON DELETE NO ACTION,
  CONSTRAINT fk_agendamento_filial
    FOREIGN KEY (filial_id, negocio_id) REFERENCES filiais (id, negocio_id) ON DELETE NO ACTION
);
CREATE INDEX IF NOT EXISTS idx_agendamentos_dia ON agenda_agendamentos (negocio_id, inicio);
CREATE INDEX IF NOT EXISTS idx_agendamentos_prof_dia ON agenda_agendamentos (profissional_id, inicio);
-- O raio-X pergunta "quando foi a ultima vez de cada cliente" a cada carga.
CREATE INDEX IF NOT EXISTS idx_agendamentos_cliente ON agenda_agendamentos (cliente_id, inicio DESC);

-- A TRAVA. Dois clientes na mesma cadeira no mesmo horario e o erro que faz o
-- dono perder a confianca no sistema inteiro, e ele acontece na janela entre
-- conferir disponibilidade e gravar. Checagem em codigo nao fecha essa janela
-- quando o site e o WhatsApp gravam no mesmo segundo.
--
-- Aqui quem recusa e o banco. Cancelado e faltou ficam de fora: horario
-- desmarcado volta a ser vendavel.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ex_agendamento_sem_sobreposicao') THEN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'btree_gist') THEN
      ALTER TABLE agenda_agendamentos ADD CONSTRAINT ex_agendamento_sem_sobreposicao
        EXCLUDE USING gist (
          negocio_id WITH =,
          profissional_id WITH =,
          tstzrange(inicio, fim) WITH &&
        ) WHERE (status NOT IN ('cancelado','faltou'));
    ELSE
      RAISE WARNING 'Sem btree_gist: agendamentos ficou SEM a trava de sobreposicao. Instale a extensao e rode esta migration de novo.';
    END IF;
  END IF;
END $$;

-- ---------------- agendamento_servicos -------------------------------------
-- Um horario pode ter corte mais barba, e as vezes com profissional diferente
-- em cada um. Preco e duracao ficam congelados aqui: mudar a tabela de precos
-- amanha nao pode reescrever o que foi combinado ontem.
CREATE TABLE IF NOT EXISTS agenda_agendamento_servicos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id      UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  agendamento_id  UUID NOT NULL,
  servico_id      UUID NOT NULL,
  profissional_id UUID NOT NULL,
  preco_cent      INTEGER NOT NULL CHECK (preco_cent >= 0),
  duracao_min     INTEGER NOT NULL CHECK (duracao_min > 0),
  ordem           INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT fk_as_agendamento
    FOREIGN KEY (agendamento_id, negocio_id) REFERENCES agenda_agendamentos (id, negocio_id) ON DELETE CASCADE,
  CONSTRAINT fk_as_servico
    FOREIGN KEY (servico_id, negocio_id) REFERENCES agenda_servicos (id, negocio_id) ON DELETE NO ACTION,
  CONSTRAINT fk_as_profissional
    FOREIGN KEY (profissional_id, negocio_id) REFERENCES agenda_profissionais (id, negocio_id) ON DELETE NO ACTION
);
CREATE INDEX IF NOT EXISTS idx_as_agendamento ON agenda_agendamento_servicos (agendamento_id);

-- ---------------- produtos -------------------------------------------------
-- Cosmetico pra vender, cosmetico de uso interno e produto de bar. Barbearia
-- perde dinheiro em produto vencido e em produto que sumiu, e nenhum dos dois
-- aparece se o estoque nao existir.
CREATE TABLE IF NOT EXISTS agenda_produtos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id    UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,

  nome          TEXT NOT NULL,
  sku           TEXT,
  categoria     TEXT CHECK (categoria IS NULL OR categoria IN ('cosmetico','bar','uso_interno','outro')),
  marca         TEXT,

  preco_cent    INTEGER NOT NULL DEFAULT 0 CHECK (preco_cent >= 0),
  -- INTERNO. Da a margem por produto e nunca sai em rota publica.
  custo_cent    INTEGER NOT NULL DEFAULT 0 CHECK (custo_cent >= 0),

  -- Saldo materializado. A verdade e a soma de produto_movimentos, e este
  -- campo existe pra tela nao somar a vida inteira a cada carga. O gatilho
  -- abaixo mantem os dois iguais.
  estoque       NUMERIC(12,3) NOT NULL DEFAULT 0,
  estoque_minimo NUMERIC(12,3) NOT NULL DEFAULT 0,
  validade      DATE,

  -- FALSE = so uso na cadeira, nao entra na comanda como venda.
  revenda       BOOLEAN NOT NULL DEFAULT TRUE,
  ativo         BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_produtos_id_negocio UNIQUE (id, negocio_id)
);
CREATE INDEX IF NOT EXISTS idx_produtos_negocio ON agenda_produtos (negocio_id) WHERE ativo;
-- Alerta de estoque baixo e de validade proxima, as duas telas que evitam
-- prejuizo silencioso.
CREATE INDEX IF NOT EXISTS idx_produtos_validade ON agenda_produtos (negocio_id, validade) WHERE validade IS NOT NULL;

-- ---------------- produto_movimentos ---------------------------------------
-- Nunca se edita o saldo na mao. Toda mudanca de estoque e uma linha aqui, com
-- motivo. Sem isso, "sumiu tres pomadas" nao tem onde ser investigado.
CREATE TABLE IF NOT EXISTS agenda_produto_movimentos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id    UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  produto_id    UUID NOT NULL,
  tipo          TEXT NOT NULL CHECK (tipo IN ('entrada','venda','uso','perda','ajuste')),
  -- Positiva em entrada e ajuste pra cima, negativa nas saidas.
  quantidade    NUMERIC(12,3) NOT NULL CHECK (quantidade <> 0),
  custo_unit_cent INTEGER CHECK (custo_unit_cent >= 0),
  comanda_id    UUID,
  motivo        TEXT,
  usuario_id    UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_pm_produto
    FOREIGN KEY (produto_id, negocio_id) REFERENCES agenda_produtos (id, negocio_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_pm_produto ON agenda_produto_movimentos (produto_id, criado_em DESC);

-- Mantem produtos.estoque igual a soma dos movimentos. Aqui vale gatilho, e
-- nao codigo, porque movimento entra por tres caminhos: comanda, compra e
-- ajuste. Um deles esquecer de somar deixaria o saldo mentindo pra sempre.
CREATE OR REPLACE FUNCTION aplicar_movimento_estoque() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE agenda_produtos SET estoque = estoque + NEW.quantidade WHERE id = NEW.produto_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE agenda_produtos SET estoque = estoque - OLD.quantidade WHERE id = OLD.produto_id;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE agenda_produtos SET estoque = estoque - OLD.quantidade + NEW.quantidade WHERE id = NEW.produto_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_movimento_estoque ON agenda_produto_movimentos;
CREATE TRIGGER trg_movimento_estoque
  AFTER INSERT OR UPDATE OR DELETE ON agenda_produto_movimentos
  FOR EACH ROW EXECUTE FUNCTION aplicar_movimento_estoque();

-- ---------------- comandas -------------------------------------------------
-- Todo agendamento concluido vira comanda. Quem so passa pra comprar pomada
-- abre comanda sem agendamento, por isso agendamento_id e opcional.
CREATE TABLE IF NOT EXISTS agenda_comandas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id      UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  filial_id       UUID,
  cliente_id      UUID,
  agendamento_id  UUID,

  -- Numero curto do dia, o que o balcao fala em voz alta.
  numero          INTEGER,
  status          TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','fechada','cancelada')),

  subtotal_cent   INTEGER NOT NULL DEFAULT 0 CHECK (subtotal_cent >= 0),
  desconto_cent   INTEGER NOT NULL DEFAULT 0 CHECK (desconto_cent >= 0),
  total_cent      INTEGER NOT NULL DEFAULT 0 CHECK (total_cent >= 0),
  -- Taxa da maquininha. Sem ela o dono acha que faturou o valor cheio.
  taxa_cent       INTEGER NOT NULL DEFAULT 0 CHECK (taxa_cent >= 0),
  forma_pagamento TEXT CHECK (forma_pagamento IS NULL OR forma_pagamento IN ('dinheiro','pix','debito','credito','fiado','pacote','cortesia')),
  parcelas        SMALLINT NOT NULL DEFAULT 1 CHECK (parcelas >= 1),

  observacao      TEXT,
  aberta_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
  fechada_em      TIMESTAMPTZ,

  CONSTRAINT uq_comandas_id_negocio UNIQUE (id, negocio_id),
  CONSTRAINT fk_comanda_cliente
    FOREIGN KEY (cliente_id, negocio_id) REFERENCES agenda_clientes (id, negocio_id) ON DELETE NO ACTION,
  CONSTRAINT fk_comanda_agendamento
    FOREIGN KEY (agendamento_id, negocio_id) REFERENCES agenda_agendamentos (id, negocio_id) ON DELETE NO ACTION,
  CONSTRAINT fk_comanda_filial
    FOREIGN KEY (filial_id, negocio_id) REFERENCES filiais (id, negocio_id) ON DELETE NO ACTION
);
CREATE INDEX IF NOT EXISTS idx_comandas_negocio_dia ON agenda_comandas (negocio_id, aberta_em DESC);
-- Um agendamento nao pode gerar duas comandas, senao o faturamento do dia
-- conta o mesmo corte duas vezes.
CREATE UNIQUE INDEX IF NOT EXISTS uq_comandas_agendamento
  ON agenda_comandas (agendamento_id) WHERE agendamento_id IS NOT NULL AND status <> 'cancelada';

-- ---------------- comanda_itens --------------------------------------------
-- profissional_id no ITEM, nao na comanda: o corte foi do Alex e a barba foi
-- do Tiago na mesma passagem, e a comissao de cada um sai daqui.
--
-- A comissao fica congelada em percentual e valor no momento do fechamento.
-- Mudar a comissao da casa em outubro nao pode reescrever o pagamento de
-- setembro, que ja foi feito.
CREATE TABLE IF NOT EXISTS agenda_comanda_itens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id      UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  comanda_id      UUID NOT NULL,
  tipo            TEXT NOT NULL CHECK (tipo IN ('servico','produto','pacote')),
  servico_id      UUID,
  produto_id      UUID,
  profissional_id UUID,

  -- Copia do nome no momento da venda. Servico renomeado depois nao pode
  -- mudar o que esta escrito numa comanda antiga.
  descricao       TEXT NOT NULL,
  quantidade      NUMERIC(12,3) NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  preco_unit_cent INTEGER NOT NULL CHECK (preco_unit_cent >= 0),
  desconto_cent   INTEGER NOT NULL DEFAULT 0 CHECK (desconto_cent >= 0),
  total_cent      INTEGER NOT NULL CHECK (total_cent >= 0),

  comissao_pct    NUMERIC(5,2),
  comissao_cent   INTEGER NOT NULL DEFAULT 0 CHECK (comissao_cent >= 0),

  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT ck_item_referencia CHECK (
    (tipo = 'servico' AND servico_id IS NOT NULL) OR
    (tipo = 'produto' AND produto_id IS NOT NULL) OR
    (tipo = 'pacote')
  ),
  CONSTRAINT fk_ci_comanda
    FOREIGN KEY (comanda_id, negocio_id) REFERENCES agenda_comandas (id, negocio_id) ON DELETE CASCADE,
  CONSTRAINT fk_ci_servico
    FOREIGN KEY (servico_id, negocio_id) REFERENCES agenda_servicos (id, negocio_id) ON DELETE NO ACTION,
  CONSTRAINT fk_ci_produto
    FOREIGN KEY (produto_id, negocio_id) REFERENCES agenda_produtos (id, negocio_id) ON DELETE NO ACTION,
  CONSTRAINT fk_ci_profissional
    FOREIGN KEY (profissional_id, negocio_id) REFERENCES agenda_profissionais (id, negocio_id) ON DELETE NO ACTION
);
CREATE INDEX IF NOT EXISTS idx_ci_comanda ON agenda_comanda_itens (comanda_id);
-- Fechamento de comissao do mes, por profissional.
CREATE INDEX IF NOT EXISTS idx_ci_profissional ON agenda_comanda_itens (profissional_id, criado_em);

-- ---------------- pacotes --------------------------------------------------
-- Dez cortes pagos hoje, usados ao longo do ano. Antecipa caixa e prende o
-- cliente, e e o produto que mais some de sistema pequeno porque exige
-- controlar sessao comprada contra sessao usada.
CREATE TABLE IF NOT EXISTS agenda_pacotes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id    UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  nome          TEXT NOT NULL,
  descricao     TEXT,
  preco_cent    INTEGER NOT NULL CHECK (preco_cent >= 0),
  validade_dias INTEGER,
  ativo         BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_pacotes_id_negocio UNIQUE (id, negocio_id)
);

CREATE TABLE IF NOT EXISTS agenda_pacote_itens (
  negocio_id    UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  pacote_id     UUID NOT NULL,
  servico_id    UUID NOT NULL,
  quantidade    INTEGER NOT NULL CHECK (quantidade > 0),

  PRIMARY KEY (pacote_id, servico_id),
  CONSTRAINT fk_pi_pacote
    FOREIGN KEY (pacote_id, negocio_id) REFERENCES agenda_pacotes (id, negocio_id) ON DELETE CASCADE,
  CONSTRAINT fk_pi_servico
    FOREIGN KEY (servico_id, negocio_id) REFERENCES agenda_servicos (id, negocio_id) ON DELETE NO ACTION
);

-- A compra. Expira em data absoluta, calculada na venda: mudar validade_dias
-- do pacote amanha nao pode encurtar o que alguem ja comprou.
CREATE TABLE IF NOT EXISTS agenda_pacote_vendas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id    UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  pacote_id     UUID NOT NULL,
  cliente_id    UUID NOT NULL,
  comanda_id    UUID,
  valor_cent    INTEGER NOT NULL CHECK (valor_cent >= 0),
  comprado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_em     DATE,
  cancelado_em  TIMESTAMPTZ,

  CONSTRAINT uq_pv_id_negocio UNIQUE (id, negocio_id),
  CONSTRAINT fk_pv_pacote
    FOREIGN KEY (pacote_id, negocio_id) REFERENCES agenda_pacotes (id, negocio_id) ON DELETE NO ACTION,
  CONSTRAINT fk_pv_cliente
    FOREIGN KEY (cliente_id, negocio_id) REFERENCES agenda_clientes (id, negocio_id) ON DELETE NO ACTION,
  CONSTRAINT fk_pv_comanda
    FOREIGN KEY (comanda_id, negocio_id) REFERENCES agenda_comandas (id, negocio_id) ON DELETE NO ACTION
);
CREATE INDEX IF NOT EXISTS idx_pv_cliente ON agenda_pacote_vendas (cliente_id);

-- Cada sessao gasta. Saldo e quantidade comprada menos linhas aqui, e e isso
-- que o cliente consulta pelo zap: "quantos cortes ainda tenho".
CREATE TABLE IF NOT EXISTS agenda_pacote_usos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id      UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  pacote_venda_id UUID NOT NULL,
  servico_id      UUID NOT NULL,
  agendamento_id  UUID,
  comanda_id      UUID,
  usado_em        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_pu_venda
    FOREIGN KEY (pacote_venda_id, negocio_id) REFERENCES agenda_pacote_vendas (id, negocio_id) ON DELETE CASCADE,
  CONSTRAINT fk_pu_servico
    FOREIGN KEY (servico_id, negocio_id) REFERENCES agenda_servicos (id, negocio_id) ON DELETE NO ACTION
);
CREATE INDEX IF NOT EXISTS idx_pu_venda ON agenda_pacote_usos (pacote_venda_id);

-- ---------------- fidelidade -----------------------------------------------
-- Extrato, nao saldo. Saldo e a soma, e assim o cliente ve de onde veio cada
-- ponto quando reclamar, que ele vai.
CREATE TABLE IF NOT EXISTS agenda_fidelidade_movimentos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id    UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  cliente_id    UUID NOT NULL,
  -- Negativo no resgate.
  pontos        INTEGER NOT NULL CHECK (pontos <> 0),
  motivo        TEXT NOT NULL,
  comanda_id    UUID,
  servico_id    UUID,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_fm_cliente
    FOREIGN KEY (cliente_id, negocio_id) REFERENCES agenda_clientes (id, negocio_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_fm_cliente ON agenda_fidelidade_movimentos (cliente_id, criado_em DESC);

-- ---------------- lista_espera ---------------------------------------------
-- Agenda cheia nao pode significar cliente perdido. Quando um horario vaga, o
-- aviso sai por WhatsApp pra fila daquele dia, sem o dono ficar ligando.
CREATE TABLE IF NOT EXISTS agenda_lista_espera (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id      UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  cliente_id      UUID NOT NULL,
  -- NULL = qualquer profissional, que e a maioria dos casos.
  profissional_id UUID,
  servico_id      UUID,
  data            DATE NOT NULL,
  janela          TEXT NOT NULL DEFAULT 'qualquer' CHECK (janela IN ('manha','tarde','noite','qualquer')),
  status          TEXT NOT NULL DEFAULT 'aguardando' CHECK (status IN ('aguardando','avisado','atendido','expirado')),
  avisado_em      TIMESTAMPTZ,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_le_cliente
    FOREIGN KEY (cliente_id, negocio_id) REFERENCES agenda_clientes (id, negocio_id) ON DELETE CASCADE,
  CONSTRAINT fk_le_profissional
    FOREIGN KEY (profissional_id, negocio_id) REFERENCES agenda_profissionais (id, negocio_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_le_negocio_data ON agenda_lista_espera (negocio_id, data) WHERE status = 'aguardando';

-- ---------------- avaliacoes -----------------------------------------------
-- Uma pergunta no zap depois do atendimento. Nota alta vira convite pra
-- avaliar no Google, que e onde a nota vale dinheiro. Nota baixa fica dentro
-- de casa e vira conversa.
CREATE TABLE IF NOT EXISTS agenda_avaliacoes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id      UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  agendamento_id  UUID,
  cliente_id      UUID NOT NULL,
  profissional_id UUID,
  nota            SMALLINT NOT NULL CHECK (nota BETWEEN 1 AND 5),
  comentario      TEXT,
  -- Marcado a mao pelo dono. Nao publicar depoimento sem alguem ler antes.
  publicavel      BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_av_cliente
    FOREIGN KEY (cliente_id, negocio_id) REFERENCES agenda_clientes (id, negocio_id) ON DELETE CASCADE,
  CONSTRAINT fk_av_profissional
    FOREIGN KEY (profissional_id, negocio_id) REFERENCES agenda_profissionais (id, negocio_id) ON DELETE NO ACTION,
  CONSTRAINT fk_av_agendamento
    FOREIGN KEY (agendamento_id, negocio_id) REFERENCES agenda_agendamentos (id, negocio_id) ON DELETE NO ACTION
);
-- Uma avaliacao por atendimento. Sem isso o cliente responde tres vezes e a
-- media da barbearia vira ficcao.
CREATE UNIQUE INDEX IF NOT EXISTS uq_avaliacoes_agendamento
  ON agenda_avaliacoes (agendamento_id) WHERE agendamento_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_av_profissional ON agenda_avaliacoes (profissional_id, criado_em DESC);

-- ---------------- profissional_lancamentos ---------------------------------
-- Vale, adiantamento e o que o barbeiro consumiu na casa. Sao os descontos que
-- todo mes viram discussao no papel, e e por eles que a conferencia demora.
CREATE TABLE IF NOT EXISTS agenda_profissional_lancamentos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id      UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  profissional_id UUID NOT NULL,
  tipo            TEXT NOT NULL CHECK (tipo IN ('vale','adiantamento','consumo','bonus','desconto')),
  -- Sempre positivo. O tipo diz se soma ou subtrai no liquido.
  valor_cent      INTEGER NOT NULL CHECK (valor_cent > 0),
  descricao       TEXT,
  data            DATE NOT NULL DEFAULT CURRENT_DATE,
  comanda_id      UUID,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fk_pl_profissional
    FOREIGN KEY (profissional_id, negocio_id) REFERENCES agenda_profissionais (id, negocio_id) ON DELETE CASCADE,
  CONSTRAINT fk_pl_comanda
    FOREIGN KEY (comanda_id, negocio_id) REFERENCES agenda_comandas (id, negocio_id) ON DELETE NO ACTION
);
CREATE INDEX IF NOT EXISTS idx_pl_profissional ON agenda_profissional_lancamentos (profissional_id, data);

-- ---------------- comissao_fechamentos -------------------------------------
-- O fechamento do periodo, congelado. Depois de fechado, os numeros nao se
-- recalculam sozinhos: o que foi pago foi pago, e relatorio do mes passado que
-- muda de valor destroi a confianca do time no sistema.
CREATE TABLE IF NOT EXISTS agenda_comissao_fechamentos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id      UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  profissional_id UUID NOT NULL,
  periodo_inicio  DATE NOT NULL,
  periodo_fim     DATE NOT NULL,

  servicos_cent     INTEGER NOT NULL DEFAULT 0,
  produtos_cent     INTEGER NOT NULL DEFAULT 0,
  comissao_cent     INTEGER NOT NULL DEFAULT 0,
  -- Soma dos vales, consumos e bonus ja com sinal aplicado.
  lancamentos_cent  INTEGER NOT NULL DEFAULT 0,
  liquido_cent      INTEGER NOT NULL DEFAULT 0,

  status          TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','fechado','pago')),
  fechado_em      TIMESTAMPTZ,
  pago_em         TIMESTAMPTZ,
  observacao      TEXT,

  CONSTRAINT ck_fechamento_periodo CHECK (periodo_fim >= periodo_inicio),
  CONSTRAINT fk_cf_profissional
    FOREIGN KEY (profissional_id, negocio_id) REFERENCES agenda_profissionais (id, negocio_id) ON DELETE CASCADE
);
-- Dois fechamentos do mesmo periodo pro mesmo profissional e pagamento
-- duplicado esperando pra acontecer.
CREATE UNIQUE INDEX IF NOT EXISTS uq_cf_periodo
  ON agenda_comissao_fechamentos (profissional_id, periodo_inicio, periodo_fim);

-- ---------------- amarras que dependem de tabela definida depois -----------
-- produto_movimentos e fidelidade_movimentos nascem antes de comandas no
-- arquivo, e lista_espera e pacote_usos apontam pra tabelas de secoes
-- anteriores. Sem estas chaves, aquelas colunas seriam UUID solto, e o
-- cabecalho deste arquivo estaria mentindo: existiria caminho de escrita
-- cruzando inquilino que o banco nao barra.
DO $$
DECLARE
  amarra RECORD;
BEGIN
  FOR amarra IN
    SELECT * FROM (VALUES
      ('fk_pm_comanda',    'agenda_produto_movimentos',       'comanda_id',     'agenda_comandas'),
      ('fk_fm_comanda',    'agenda_fidelidade_movimentos',    'comanda_id',     'agenda_comandas'),
      ('fk_fm_servico',    'agenda_fidelidade_movimentos',    'servico_id',     'agenda_servicos'),
      ('fk_pu_agendamento','agenda_pacote_usos',              'agendamento_id', 'agenda_agendamentos'),
      ('fk_pu_comanda',    'agenda_pacote_usos',              'comanda_id',     'agenda_comandas'),
      ('fk_le_servico',    'agenda_lista_espera',             'servico_id',     'agenda_servicos')
    ) AS t(nome, tabela, coluna, alvo)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = amarra.nome) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I, negocio_id) REFERENCES %I (id, negocio_id) ON DELETE NO ACTION',
        amarra.tabela, amarra.nome, amarra.coluna, amarra.alvo);
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- FIM. Confira com:
--   SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1;
--   SELECT conname FROM pg_constraint WHERE conname='ex_agendamento_sem_sobreposicao';
-- A segunda consulta precisa devolver uma linha. Se vier vazia, a trava de
-- duplo agendamento nao entrou e o motivo saiu como WARNING la em cima.
-- ============================================================================
