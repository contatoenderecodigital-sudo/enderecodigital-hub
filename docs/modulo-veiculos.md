# Módulo Veículos

Sistema para revenda de carros, rodando como módulo do hub. Ligado por cliente
pela coluna `negocios.mod_veiculos`, igual a Site, Instagram, CRM e Financeiro.

**Alvo:** substituir o Autos 360 da OLX na loja do cliente, não conviver com
ele. Por isso o módulo faz o chão inteiro (estoque, custo, portal, lead, venda)
e não só a parte bonita.

## Por que substituir e não ficar por cima

O primeiro desenho era ler o estoque do Autos 360 e montar site e atendimento
em cima. Foi descartado por dois motivos.

O integrador deles é via de mão única: leva estoque **para** os portais, não
entrega para sistema de terceiro. E o Autos 360 é produto da OLX, que é
concorrente. Depender de uma porta que o concorrente controla é ficar com dez
clientes na mão no dia em que ele fechar.

A saída apareceu na pesquisa: os portais aceitam estoque por XML, TXT e
webservice, e a OLX documenta importação vinda de integradores. Então **nós
somos a origem** e publicamos direto. O Autos 360 sai da conta.

## O que se compra em vez de construir

**NF-e.** Focus NFe e NFe.io são APIs REST de emissão. Construir emissor
próprio é um ano brigando com layout, schema e certificado da Sefaz, mais
manutenção eterna. O banco guarda só `vendas.nota_fiscal_id` e a URL do que foi
emitido lá fora.

## Isolamento entre clientes

O hub isola por código: toda consulta filtra `negocio_id` vindo do
`activeNegocioId(sessao)`. **Não existe RLS em nenhuma tabela do hub**, então
um `WHERE` esquecido vaza dado entre clientes.

Este módulo vai um degrau além, e o degrau não depende de ninguém lembrar de
nada: **as chaves estrangeiras são compostas e carregam `negocio_id`**. O
Postgres recusa na escrita uma foto apontando para veículo de outro cliente,
um lead apontando para filial de outro cliente, uma venda cruzando inquilino.

Testado contra o banco real com duas lojas fictícias: cinco tentativas de
cruzamento, cinco recusadas. Roda de novo com
`node db/scripts/veiculos-ensaio-migration.cjs`.

O que a chave composta **não** cobre é a leitura: um `SELECT` sem `WHERE
negocio_id` lista tudo. Por isso, em `lib/veiculos.ts`, **toda função recebe
`negocioId` como primeiro argumento obrigatório, sem valor padrão**. Função que
não pede inquilino não entra neste módulo.

O `negocioId` vem sempre da sessão, nunca da URL. Id de URL é do usuário, e
usuário mente.

## Tabelas

| Tabela | Para que serve |
|---|---|
| `filiais` | Unidades da rede. É também a **unidade de cobrança**: dez lojas pagam dez mensalidades. |
| `veiculos` | O estoque. Tem coluna pública e coluna interna. |
| `veiculo_fotos` | Ordem importa: a primeira é a capa e decide o clique no portal. |
| `veiculo_custos` | Cada real gasto no carro, inclusive a compra. Dá a margem real. |
| `veiculo_precos` | Histórico de preço. Alimenta o aviso de "baixou" e mostra quanto tempo o carro ficou no preço errado. |
| `veiculo_referencias` | FIPE e média de mercado coletadas. |
| `veiculo_publicacoes` | Uma linha por veículo por portal. Mata o anúncio fantasma. |
| `avaliacoes_troca` | Avaliação do carro do cliente, entrada de troca. |
| `vendas` | Fecha o ciclo. `veiculo_troca_id` liga a saída de um com a entrada de outro. |

`leads` é a tabela do CRM que já existia, com `veiculo_id`, `filial_id`,
`responsavel_id` e `primeira_resposta_em` acrescentados. **Não foi criado funil
paralelo**: dois funis no mesmo sistema é o caminho mais curto para perder lead
entre eles.

### Colunas internas, que nunca saem em rota pública

`veiculos.preco_minimo_cent` é o piso de negociação do dono. Guia o vendedor e
o atendente automático. Vazado para o comprador, acaba com a negociação.

`veiculos.placa` fica inteira no banco, mas a rota pública devolve só o último
dígito. Placa cheia em anúncio é convite para clonagem.

`veiculo_custos` inteira é interna.

### Dinheiro

Centavos em `INTEGER`, igual ao resto do hub. Carro de R$ 300 mil dá 30 milhões
de centavos, bem dentro do limite. Converter só na borda, em `emReais()`.

## O diferencial: raio-X do pátio

Não é relatório, que todo sistema tem e ninguém abre. É a lista do que fazer
esta semana, e é a tela que ganha a reunião.

Os cortes vêm do mercado: o tempo médio de seminovo no Brasil caiu para 37
dias, e acima de 60 a rentabilidade despenca mesmo com a margem individual
parecendo boa. A margem líquida do setor fica entre 4% e 9%, então giro é
lucro. Preço acima do mercado é a causa mais comum de carro parado.

`raioX()` devolve por veículo: dias parado, custo total real, margem prevista,
desvio da FIPE em pontos percentuais, e gravidade em `critico` (60 dias ou
mais), `atencao` (45 ou mais) e `ok`.

O que sai na tela não é "esse carro está parado", é:

```
critico  Duster          96d  margem R$ 7.900   FIPE +15.2%
```

Está parado **porque** está 15% acima da FIPE, e a margem já caiu para R$ 7.900.

## O painel do cliente, que também nasceu aqui

Até este módulo, **só owner e parceiro tinham onde entrar**. Quem logava como
`dono` ou `operador` voltava para o `/login`, porque a casca do workspace do
cliente não existia (estava listada no README como pendência). Sem ela nenhum
módulo é usável pelo cliente, então ela veio junto.

Mora em **`/painel`**, não em `/ws`. O `/ws/[neg]` já existe e faz outra coisa:
é o owner abrindo por iframe o painel próprio de um cliente com domínio
separado. Em `/ws`, a rota `/ws/veiculos` seria lida pelo Next como `[neg]`
valendo "veiculos".

Entram `dono` e `operador` no próprio negócio, e o owner apenas quando está
impersonando, com a faixa MODO OWNER.

A barra lateral exige **duas** condições: módulo ligado (o cliente contratou) e
pronto (a tela existe). Site e Funil já vêm ligados por padrão do hub e ainda
não têm tela, então não aparecem. Link para 404 ensina a pessoa a não clicar em
mais nada. Quando a tela existir, vira `pronto: true` no `app/painel/layout.tsx`.

## Arquivos

- `db/migration_0003_veiculos.sql` — schema, idempotente.
- `lib/veiculos.ts` — camada de dados. Toda função pede `negocioId`.
- `app/painel/layout.tsx` — casca do workspace do cliente.
- `app/painel/page.tsx` — visão geral.
- `app/painel/veiculos/page.tsx` — raio-X, estoque e lojas.
- `components/painel-nav.tsx` — barra lateral com item ativo.
- `db/scripts/veiculos-semente-demo.cjs` — loja de demonstração.
- `db/scripts/veiculos-ensaio-migration.cjs` — roda a migration numa transação,
  prova o isolamento e desfaz. Não altera nada.
- `db/scripts/veiculos-ensaio-consultas.cjs` — cria dados fictícios, roda as
  consultas, desfaz.
- `db/scripts/veiculos-aplicar.cjs` — aplica de verdade.

## Antes de rodar qualquer script

O banco é **produção**, não sandbox. Precisa do túnel SSH aberto em outro
terminal:

```
ssh -i ~/.ssh/id_ed25519_hub -N -L 5433:172.16.1.7:5432 root@179.198.126.197
```

Não devolve nada e não sai. É isso mesmo, é o que mantém o túnel de pé.

## Loja de demonstração

`node db/scripts/veiculos-semente-demo.cjs` cria a **Lançar Veículos** com duas
filiais e seis carros, e um usuário `dono` para entrar.

Os seis carros são escolhidos, não aleatórios: um recém-chegado, dois normais,
um em atenção e dois críticos, sendo o Duster o caso de manual, parado há 96
dias porque está 15% acima da FIPE. Painel vazio não vende numa reunião.

    entrar: demo@lancarveiculos.com.br
    senha:  lancar2026

Apagar: `node db/scripts/veiculos-semente-demo.cjs --apagar`.

## Estado hoje

Feito: banco aplicado em produção, camada de dados, casca do painel do cliente,
tela de Veículos com raio-X, e loja de demonstração. O app de vitrine está em
`Desktop/EnderecoDigital/sistema/vendadecarros/app-mobile` (Expo, ainda lendo
lista fixa).

A fazer, em ordem: cadastro e edição de veículo pelo painel (hoje só lê), upload
de foto, ligar o app no banco, site por loja, leads e WhatsApp, atendente
automático, integrador de portais, financeiro e fiscal.
