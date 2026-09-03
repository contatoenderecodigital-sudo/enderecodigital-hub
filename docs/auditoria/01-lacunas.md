# 01. Auditoria contra o checklist

> Fotografia de 01/09/2026, mantida como estava. O que ja foi corrigido
> desde entao esta em [`03-corrigido.md`](03-corrigido.md).

Classificação usada: **OK** (existe e está correto), **PARCIAL** (existe com
furo), **AUSENTE** (não existe), **QUEBRADO** (existe e está errado a ponto de
dar bug em produção).

Severidade: **P0** impede vender ou põe dinheiro e dado em risco; **P1** gera
cancelamento de cliente; **P2** melhoria.

---

## B1. Sessão de mesa e segurança do QR/NFC

### Existe entidade de sessão separada de pedido?
**OK**. Três níveis de verdade, já no banco: `food_sessoes` (a comanda,
`migration_0003:281-310`), `food_pedidos` (a rodada, `:340-381`) e `food_itens`
(o item, `:384-406`). A sessão tem membros por celular
(`food_sessao_membros`, `:313-321`). Isso é a parte mais bem resolvida do módulo.

### A URL do QR/NFC dá acesso direto a pedir?
**QUEBRADO. P0.** Sim, dá. O token da mesa é a única credencial e ele é
permanente. Não existe emissão de token de sessão no primeiro acesso, não existe
cookie, não existe expiração e não existe vínculo com o momento em que alguém
sentou na mesa.

Evidência: `app/api/food/publico/route.ts:131-134` resolve a mesa direto pelo
token do corpo da requisição e segue para qualquer ação. `lib/food.ts:435-471`
abre uma sessão nova sempre que não houver uma viva.

### O ataque, passo a passo, com base no código real

1. O atacante entra na casa uma vez como cliente comum, encosta o celular no
   cartão da mesa 7 e copia a URL: `/c/boteco-demo/m/x6LX1kaQqF-l`.
   O token não muda nunca, a não ser que o dono regrave o cartão na mão
   (`lib/food.ts:160-167`).
2. Em casa, três da manhã, ele chama
   `POST /api/food/publico {"acao":"entrar","token":"x6LX1kaQqF-l","deviceId":"qualquer-coisa"}`.
   O `deviceId` é inventado pelo próprio cliente
   (`components/food/mesa-app.tsx:36-37`); o servidor aceita qualquer string de
   até 64 caracteres (`app/api/food/publico/route.ts:29`). Como não há sessão
   viva, `entrarNaMesa()` **cria uma comanda nova** (`lib/food.ts:448-454`).
3. Ele chama `acao=pedir` com 40 itens. O limite é só de 40 itens por
   requisição (`app/api/food/publico/route.ts:166`), não de requisições.
4. O pedido entra como `aprovado` (porque `exige_aprovacao_garcom` é `false` por
   padrão, `migration_0003:47`), a comanda é enfileirada para a impressora e o
   estoque é baixado (`lib/food.ts:746-749`).
5. A impressora térmica da cozinha imprime, sozinha, no meio da madrugada. Se ele
   repetir o `pedir` em laço, imprime até acabar a bobina, e o estoque de insumos
   vai a negativo (`lib/food.ts:1229-1232` faz `saldo - qtd` sem piso).

O único freio possível é `limite_sessao_sem_aprov`, que **nasce em 0, que
significa sem limite** (`migration_0003:48`) e só é checado quando maior que zero
(`lib/food.ts:690-697`).

Verificado no ar agora: `POST /api/food/publico {"acao":"resumo","token":"..."}`
respondeu `200` sem cookie nenhum; com token inválido, `404`.

### Existe rate limit por mesa, sessão ou IP nos endpoints de pedido?
**AUSENTE. P0.** Existe uma biblioteca de rate limit no repositório
(`lib/groow/ratelimit.ts`), usada em `/api/login`, `/api/admin/auth` e
`/api/indicacao`. **Nenhuma rota do food a importa.** O IP até é gravado no
pedido (`origem_ip`, `app/api/food/publico/route.ts:19-21`), mas nada o lê.

### Trava contra duas sessões abertas na mesma mesa?
**OK**. Índice único parcial `uq_food_sessao_viva`
(`migration_0003:308-310`) mais `SELECT ... FOR UPDATE` na mesa dentro da
transação (`lib/food.ts:442`). Feito do jeito certo, no banco e não no `if`.

### Ao fechar a conta, os tokens dos celulares são invalidados?
**AUSENTE. P1.** Não existe token de celular para invalidar. `fecharSessao()`
fecha a sessão (`lib/food.ts:551-585`), e o mesmo cartão, com a mesma URL, abre
uma comanda nova no acesso seguinte. O cliente que pagou e foi embora continua
podendo lançar pedido naquela mesa pelo resto da vida do cartão.

### O identificador da mesa na URL é opaco?
**OK**. `crypto.randomBytes(12).toString("base64url")`, 96 bits
(`lib/food.ts:20-22`), com `UNIQUE` no banco (`migration_0003:120`). Não é
sequencial e não dá para varrer.

---

## B2. Integridade de dinheiro

### O total é recalculado no servidor?
**OK. Este é o ponto mais forte do módulo.** O navegador manda só
`produto_id`, `variacao_id`, `qtd`, ids de opção e observação
(`lib/food-types.ts:228-235`). O preço é buscado do banco dentro da transação
(`lib/food.ts:627-687`) e o `preco` que venha no corpo é simplesmente ignorado.
Existe teste que envia `preco: 0.01` e confere que o total sai pelo cardápio
(`db/testes/fluxo-real.mjs:98-103`).

### Adicionais, opcionais e regras de combinação são validados no backend?
**QUEBRADO. P1.** O preço do adicional vem do banco, mas **as regras não são
verificadas em lugar nenhum do servidor**:

- Grupo obrigatório pode vir vazio. `criarPedido()` só soma o que veio
  (`lib/food.ts:670-673`). A validação de "escolha 1 opção" existe só no
  navegador (`components/food/mesa-app.tsx:352`, `:428`).
- O `maximo` do grupo não é respeitado: dá para mandar 30 ids de adicional num
  grupo de máximo 1.
- **A opção não é checada contra o produto.** A consulta busca as opções por id
  solto (`lib/food.ts:646-651`), sem exigir que o grupo pertença ao produto
  pedido. Dá para grudar em uma picanha o adicional de outro produto, inclusive
  de outro restaurante, e o nome falso vai impresso na comanda da cozinha.
- `tipo_preco` ('soma', 'maior', 'media') é ignorado: sempre soma
  (`lib/food.ts:673`).
- Pizza meia a meia: o campo `meia` existe no tipo de entrada
  (`lib/food-types.ts:233`) e a coluna `meia_json` existe no banco, mas
  `criarPedido()` nunca lê nem grava (`lib/food.ts:662-687`). Quem pedir metade
  calabresa metade portuguesa paga um só e a cozinha não fica sabendo.

Consequência prática: um garçom mal-intencionado, ou só um bug de front, lança
churrasco sem o ponto da carne e a cozinha para para perguntar.

### Valores monetários são inteiros em centavos ou float?
**PARCIAL. P2.** No banco é `NUMERIC(10,2)` e `NUMERIC(12,2)`, que é decimal
exato (`migration_0003:355`, `:434`, `:299-305`). No servidor, o cálculo passa
por `number` do JavaScript (`lib/food.ts:673-677`), mas cada linha é arredondada
com `Math.round(x*100)/100` antes de somar e gravada como texto de 2 casas
(`lib/food.ts:19`). O risco real é baixo. Não é o padrão de centavos inteiros,
mas também não é o erro clássico de float acumulado.

### Desconto e cortesia exigem permissão de gerente?
**AUSENTE. P1.** Não existe desconto. A coluna `food_sessoes.desconto` entra no
total (`lib/food.ts:524`) mas **nenhum endpoint a preenche**. O método de
pagamento `cortesia` existe na lista (`migration_0003:441`) e qualquer um com o
token do tablet do garçom pode registrar um pagamento de cortesia de qualquer
valor (`app/api/food/garcom/route.ts:96-106`), sem PIN, sem gerente e sem
registro de quem autorizou.

### Existe chave de idempotência no envio do pedido?
**AUSENTE. P0.** Não existe. O botão trava enquanto a requisição está no ar
(`components/food/mesa-app.tsx:106`), mas isso não cobre o caso real: em 3G ruim
o pedido chega ao servidor, a resposta se perde, o cliente aperta de novo e a
cozinha recebe **duas comandas iguais**, com dois números de pedido, duas
impressões e duas baixas de estoque. Não há como distinguir isso de um cliente
que realmente pediu duas caipirinhas.

O único ponto do sistema com idempotência é o Pix: chave enviada ao Mercado Pago
(`lib/food-pix.ts:48`) e `uq_food_pag_psp` no banco (`migration_0003:459`).

---

## B3. Multi-tenant

### Toda tabela relevante tem coluna de estabelecimento?
**OK**. `negocio_id NOT NULL` com índice em todas as 28 tabelas de negócio. A
única sem é `food_contadores` (`migration_0003:410-415`), que é chaveada por
`loja_id` e não guarda dado de cliente.

### Toda query filtra por ela?
**PARCIAL. P1.** A regra é seguida em quase tudo. As exceções encontradas, cada
uma um vazamento em potencial entre clientes:

| Função | Arquivo:linha | O furo |
|---|---|---|
| `resumoSessao(sessaoId)` | `lib/food.ts:474-501` | Nenhuma consulta filtra por negócio. Exposta em `GET /api/food/painel?vista=sessao&sessao=<uuid>` (`app/api/food/painel/route.ts:89-92`): um dono logado que saiba um UUID de sessão lê a comanda inteira de outro restaurante, com itens, valores e pagamentos. |
| `sessaoAtivaDaMesa(mesaId)` no tablet do garçom | `app/api/food/garcom/route.ts:67, 97, 108` | O `mesaId` vem do corpo e **não é conferido contra a loja do dispositivo**. O caso `pedido` faz essa conferência (`:79`); `sessao`, `pagamento` e `fechar` não fazem. |
| `fecharSessao()` | `lib/food.ts:551-585` | O `UPDATE food_sessoes` filtra por negócio, mas o `UPDATE food_pedidos SET status='entregue'` logo abaixo (`:563-568`) filtra só por `sessao_id`. Combinado com o furo acima, um tablet de garçom fecha os pedidos de uma sessão de outro cliente. |
| `confirmarJob(jobId)` | `lib/food.ts:1175-1182` | Atualiza a fila de impressão só pelo id do job, sem conferir a chave da impressora nem o negócio. A rota é pública (`app/api/food/print/[chave]/route.ts:29-34`), então qualquer um que descubra um UUID de job marca a comanda como impressa e ela some da fila da cozinha. |
| `upsertProduto`, `upsertVariacao`, `upsertGrupoOpcao`, `upsertOpcao`, `moverProduto` | `lib/food.ts:302, 362, 381, 400`, `lib/food-edicao.ts:481` | O `id` do próprio registro é filtrado por negócio, mas o **pai** (`categoria_id`, `produto_id`, `grupo_id`) vem do corpo sem conferência. Um dono pode pendurar produto ou opção dentro da categoria de outro restaurante, e o item aparece no cardápio do vizinho. |
| `mudarStatusItem()` | `lib/food.ts:907-922` | O segundo `UPDATE` resolve o pedido pelo item sem filtro de negócio. Na prática é inócuo (recalcula o status a partir dos próprios itens), mas é escrita fora do inquilino. |

Todos esses furos exigem conhecer um UUID de outro cliente, então não são
varredura em massa. São, porém, exatamente o tipo de coisa que aparece quando o
mesmo hub hospedar dois restaurantes concorrentes na mesma cidade.

### O isolamento é garantido no banco?
**AUSENTE. P1.** Não existe Row Level Security, view por inquilino nem política
no Postgres. Busca por `ROW LEVEL SECURITY`, `CREATE POLICY`, `current_setting`
nos `.sql` e na `lib`: zero resultados. O isolamento é 100% disciplina de código,
o que a própria documentação assume (`docs/appfood-contexto.md`, regra 1).

### Existe teste que tenta ler dados de outro estabelecimento?
**AUSENTE. P0.** Os três scripts (`db/testes/estrutura.mjs`,
`operacao.mjs`, `fluxo-real.mjs`) não têm nenhuma checagem negativa de
isolamento. Como o isolamento é só código, e código muda, isso é a rede de
segurança que não existe.

---

## B4. Pedido, itens e Kanban

### O modelo é de três níveis?
**OK** no banco: sessão, rodada, item (ver B1).
**PARCIAL na tela**: o KDS junta os itens por número de pedido e mostra um cartão
por comanda (`components/food/kds-app.tsx:55-60, 87`), não um cartão por item.

### Cada item tem praça de preparo?
**PARCIAL. P1.** A coluna existe e é herdada do produto no momento do pedido
(`food_itens.area_id`, preenchida em `lib/food.ts:681`), e o KDS filtra pela área
do dispositivo (`lib/food.ts:879-881`). Os dois furos:
1. `area_id` do produto é opcional (`migration_0003:151`); produto sem área vira
   item sem praça, que **não aparece em nenhum KDS com área definida** e some da
   cozinha silenciosamente.
2. Não existe `prep_time_target` por item. O `tempo_preparo` do produto
   (`migration_0003:147`) nunca é lido pela tela.

### Existe máquina de estados explícita?
**AUSENTE. P0 de dívida arquitetural.** O status é string solta, atualizada com
`UPDATE` direto em cinco lugares:

| Estado do item | Onde é escrito |
|---|---|
| `pendente` (nasce) | `lib/food.ts:740` |
| `em_producao`, `pronto`, `entregue`, `cancelado` | `lib/food.ts:898-905` (`mudarStatusItem`) |
| `cancelado` em massa | `lib/food.ts:853` (cancelamento do pedido) |

| Estado do pedido | Onde é escrito |
|---|---|
| `pendente` ou `aprovado` (nasce) | `lib/food.ts:714, 718-730` |
| `aprovado` | `lib/food.ts:819` (`aprovarPedido`) |
| qualquer um | `lib/food.ts:836-851` (`mudarStatusPedido`) |
| `pronto` ou `em_producao` derivado dos itens | `lib/food.ts:907-922` |
| `entregue` em massa ao fechar a conta | `lib/food.ts:563-568` |
| `em_entrega` | `lib/food-edicao.ts:365-371` |

| Estado da sessão | Onde é escrito |
|---|---|
| `aberta` (nasce) | `lib/food.ts:450-453` |
| `conta_pedida` | `lib/food.ts:533-537` |
| `fechada` | `lib/food.ts:558-562` |
| `aguardando_pagamento`, `cancelada` | nunca |

**Transições inválidas possíveis hoje**, todas aceitas pelo código:

- `entregue` volta para `pendente`: `mudarStatusPedido()` não olha o estado atual
  (`lib/food.ts:848-851`), e o `CHECK` do banco só valida o conjunto de valores,
  não a ordem. O KDS expõe isso sem filtro: `POST /api/food/kds {acao:"pedido",
  status:"pendente"}` passa direto (`app/api/food/kds/route.ts:59-62`, que nem
  valida a lista de status, ao contrário do caso `item` logo acima).
- `cancelado` volta para `aprovado`, ressuscitando um pedido cancelado e a receita
  do dia junto.
- `pronto` sem nunca ter passado por `em_producao`: o botão "Pronto" aparece para
  item ainda pendente (`components/food/kds-app.tsx:117-122`), então
  `started_at` (`producao_em`) fica `NULL` e o tempo de preparo daquele item é
  perdido para sempre.

### As transições registram quem, quando e de onde?
**AUSENTE. P0.** Não existe tabela de eventos de transição. Há carimbos de tempo
por estado no pedido (`aprovado_em`, `producao_em`, `pronto_em`,
`entregue_em`, `cancelado_em`) e dois no item (`producao_em`, `pronto_em`), mas
**nenhum registro de autor**. `mudarStatusItem()` nem recebe quem apertou o botão
(`lib/food.ts:898-900`). Quando o dono perguntar quem cancelou a picanha de
R$ 189, o sistema não tem resposta.

### As transições são idempotentes?
**PARCIAL. P1.** Repetir a mesma transição não quebra e não duplica linha,
porque é `UPDATE` de coluna (`lib/food.ts:902-905`). Mas:
- `producao_em` e `pronto_em` são sobrescritos com `now()` a cada clique
  (`lib/food.ts:901`), então dois garçons batendo "pronto" ao mesmo tempo movem o
  relógio e estragam o relatório de tempo.
- Marcar `pronto` gera um evento em `food_eventos` toda vez que o **pedido**
  muda para pronto (`lib/food.ts:862-868`); com dois cliques quase simultâneos em
  itens diferentes do mesmo pedido, dá para gerar dois eventos e mandar duas
  mensagens de WhatsApp para o mesmo cliente.

### Cancelamento exige motivo e autor?
**QUEBRADO. P1.** O campo `cancelado_motivo` existe e é gravado se vier
(`lib/food.ts:843, 847`), mas é **opcional**: o painel manda `body.motivo` sem
obrigar (`app/api/food/painel/route.ts:208-210`) e o KDS cancela sem motivo
nenhum (`app/api/food/kds/route.ts:50-57` aceita `cancelado` na lista de status
do item). Autor não é gravado em lugar nenhum.

### Tempo real e ressincronização
**PARCIAL. P2.** Não há WebSocket nem SSE; é polling de 5 a 10 segundos
(ver `00-inventario.md`, seção 6). O lado bom: cada tick refaz a consulta
completa, então **cair a conexão e voltar não perde ticket**, que é o requisito
que mais quebra KDS de concorrente. O lado ruim: até 5 segundos de atraso, carga
constante no banco e **nenhum indicador de offline**: se o Wi-Fi da cozinha cair,
a tela continua mostrando a última fila como se fosse a atual, para sempre
(`components/food/kds-app.tsx:28-35` não trata falha de rede, só resposta não-ok
na primeira carga).

---

## B5. Cardápio

### Item esgotado some em tempo real nos celulares abertos?
**QUEBRADO. P1.** Não. O cardápio é carregado **uma única vez**, na ação
`entrar` (`components/food/mesa-app.tsx:71-79`). O polling de 10 segundos só
recarrega o resumo da comanda (`:84-92`). Quem está com o celular aberto continua
vendo a picanha esgotada e conseguindo colocar no carrinho; só descobre ao enviar,
quando o servidor recusa com "X está esgotado" (`lib/food.ts:665`). O botão 86 do
painel funciona (`lib/food.ts:351-360`), mas o efeito só aparece para quem abrir
o cardápio depois.

### Controle de disponibilidade por horário?
**QUEBRADO. P2.** As colunas existem (`turnos`, `hora_inicio`, `hora_fim`,
`migration_0003:139-141`), a tela do dono deixa preencher
(`components/food/cardapio-admin.tsx:811, 873`) e o painel até mostra o horário na
lista (`:201`). **Mas `montarCardapio()` não filtra por horário**
(`lib/food.ts:227-241`): o filtro é só `ativa` e `canais`. O dono configura café
da manhã das 7 às 10 e o cliente vê pão na chapa às onze da noite.

### Alergênicos e restrições?
**AUSENTE. P1.** Nenhum campo em nenhuma tabela. Busca por "alerg", "gluten",
"lactose", "vegan" e "castanha" em todo o módulo: zero resultados. A observação
livre do cliente (`food_itens.obs`, até 300 caracteres) **chega sim ao cartão da
cozinha** e à comanda impressa (`lib/food.ts:1082`, `components/food/kds-app.tsx:109`),
o que é o mínimo, mas é texto livre sem destaque visual e sem campo estruturado.
Em 2026, com a RDC 727/2022 da Anvisa em vigor para rotulagem, cardápio digital
sem alergênico é risco de imagem e de processo para o restaurante.

### Imagens
**QUEBRADO. P1.** Ver `00-inventario.md`, seção 7.4: a rota
`/api/food/midia/[id]` não está liberada no middleware e responde
`307 -> /login`. **Toda foto de produto está quebrada no celular do cliente.**
Além disso, quando voltar a funcionar: sem `srcset`, sem `loading="lazy"`, sem
`next/image`, formato dependente do upload, teto de 2 MB por imagem
(`lib/food-edicao.ts:322`) e cache eterno correto (`immutable`,
`app/api/food/midia/[id]/route.ts:19`). Peso medido da página do cardápio hoje:
19,2 KB de HTML e 6,3 KB de JSON, com 0 byte de imagem servido.

---

## B6. Fechamento de conta

### Soma da comanda inteira?
**OK**. `recalcularSessao()` soma todos os itens de todas as rodadas de todos os
celulares, tira o cancelado, aplica couvert por pessoa, taxa de serviço e
desconto (`lib/food.ts:505-530`). Roda dentro da transação a cada pedido, a cada
pagamento e no fechamento.

### Divisão de conta?
**AUSENTE. P1.** Nenhuma forma: nem por item, nem por pessoa, nem igual. O dado
para fazer existe (`food_itens.membro_id` guarda quem pediu,
`migration_0003:396`), mas nada consome. Para uma mesa de seis amigos num bar de
Xanxerê, isso é a diferença entre o produto ser usado e o garçom voltar à
maquininha.

### Pagamento parcial?
**PARCIAL. P2.** O modelo suporta: `food_pagamentos` é N por sessão e
`food_sessoes.pago` acumula os confirmados (`lib/food.ts:511-514, 525`). O que
não existe é qualquer regra sobre isso: `fecharSessao()` **não confere se pago
cobre o total** (`lib/food.ts:551-585`). Dá para fechar a mesa com R$ 0 recebido e
o sistema marca tudo como entregue e pago (`:563-568`).

### Pix
**PARCIAL. P1.** É cobrança dinâmica de verdade, não QR estático: cria pagamento
no Mercado Pago com copia e cola imediato (`lib/food-pix.ts:31-69`), com chave de
idempotência. O webhook não confia no aviso e pergunta ao PSP antes de baixar
(`app/api/food/webhook/[psp]/route.ts:35-38`, `lib/food-pix.ts:72-81`). Isso está
bem feito. Os furos:
- **Nenhuma verificação de assinatura do webhook** (o Mercado Pago manda
  `x-signature`). Hoje qualquer um pode disparar o endpoint; o dano é limitado
  porque o servidor confere no PSP, mas é chamada de API não autenticada e sem
  rate limit.
- **Sem conciliação**: não há job que varra pagamentos `pendente` antigos e
  pergunte ao PSP. Se o webhook não chegar (e às vezes não chega), o Pix fica
  pendente para sempre e o caixa fecha com diferença.
- **Sem expiração**: o campo `expiraEm` é lido do PSP (`lib/food-pix.ts:67`) e
  jogado fora, nunca gravado.
- **O valor vem do cliente**: `acao=pagar` aceita qualquer `valor > 0`
  (`app/api/food/publico/route.ts:205-206`), sem confrontar com o saldo da mesa.
- Asaas está declarado no banco como opção mas não implementado
  (`lib/food-pix.ts:36-38`), então a loja que escolher Asaas cai no caminho de
  falha silenciosa e vira "o caixa confirma na mão"
  (`app/api/food/publico/route.ts:213-217`).

### Taxa de serviço: o cliente consegue recusar?
**QUEBRADO. P1, com risco jurídico.** Quando `taxa_servico_automatica` está
ligada, os 10% entram no total da comanda pelo banco
(`lib/food.ts:518-523`) e a tela do cliente mostra o valor já somado
(`components/food/mesa-app.tsx:101-102`). **Não existe nenhum caminho, em nenhuma
tela, para o cliente recusar.** A Lei 13.419/2017 trata a gorjeta como opcional;
cobrança compulsória é reclamação no Procon e é o tipo de coisa que respinga na
Endereço Digital, não só no restaurante.

### Emissão fiscal (NFC-e)?
**AUSENTE. P0 para vender.** Decisão consciente e documentada
(`docs/appfood-contexto.md`, seção 4): os campos existem
(`food_pedidos.nfce_status`, `nfce_chave`, `nfce_url`, `food_lojas.fiscal_*`,
`food_produtos.ncm/cfop/cest/csosn`), o código não. Sem fila de contingência,
porque não há emissão nenhuma. Para bar e restaurante em Santa Catarina, sem
NFC-e o sistema não substitui o PDV atual da casa: ele convive com ele, e isso
limita o preço que dá para cobrar.

---

## B7. Operação e backoffice

### Papéis e permissões
**QUEBRADO. P1.** No painel, quem entra no negócio é admin de tudo:
`negocioPermitido()` só distingue `owner_plataforma`, `dono` e `operador`, e os
dois últimos têm exatamente o mesmo poder (`lib/food-auth.ts:11-17`). Não há
diferença entre caixa, gerente e dono nas 55 ações do `POST /api/food/painel`.

Na operação é pior: `food_equipe.papel` existe com cinco valores
(`migration_0003:230-231`) e **não é consultado em nenhuma decisão de
autorização**. O PIN do garçom é verificado uma vez (`app/api/food/garcom/route.ts:54-63`)
e o resultado guardado no `localStorage` do tablet
(`components/food/garcom-app.tsx:75`); **toda ação seguinte exige apenas o token
do dispositivo**, que está na URL. Quem pegar o tablet destravado, ou a URL,
recebe pagamento, dá cortesia e fecha mesa em nome de qualquer garçom, porque o
`garcomId` também vem do corpo da requisição (`:96-106`).

### "Chamar o garçom" da mesa
**OK**. `food_chamados` com tipos `garcom`, `conta` e `ajuda`
(`migration_0003:322-336`), sem duplicar chamado aberto
(`lib/food.ts:928-943`), aparecendo no KDS e no painel do salão
(`components/food/kds-app.tsx:73-81`).

### Painel ou mapa de mesas do salão
**OK**. `mapaMesas()` traz mesa, sessão viva, tempo aberto, total consumido,
itens pendentes e se há chamado, em uma consulta só (`lib/food.ts:193-210`),
renderizado em `components/food/painel-salao.tsx`.

### Relatórios
**PARCIAL. P2.** Existe só o resumo do dia (`lib/food.ts:1281-1317`):
pedidos, faturamento, ticket médio, itens vendidos, quebra por canal e top 10
produtos. Mais o CMV do dia (`:1443-1452`) e o caixa (`:1365-1384`).
**Não existe**: tempo médio por praça (o dado bruto está lá, `producao_em` e
`pronto_em`, mas ninguém agrega), itens mais cancelados, curva por hora,
comparação entre dias, desempenho por garçom.

### Impressão térmica
**OK, e é o ponto mais maduro do módulo.** Três estratégias na mesma URL:
Star CloudPRNT (impressora sozinha na internet, sem PC na loja), agente local em
JSON e navegador (`app/api/food/print/[chave]/route.ts`). Fila por impressora com
`FOR UPDATE SKIP LOCKED` (`lib/food.ts:1146-1153`), uma comanda por área de
produção (`lib/food.ts:1119-1133`), vias configuráveis, confirmação de impressão e
reimpressão. Testado com o protocolo real (`db/testes/fluxo-real.mjs:112-131`).
Os furos são os já citados: `confirmarJob()` sem checagem de dono
(B3) e o `DELETE` do CloudPRNT que confirma o job mais recente por data, e não o
que foi realmente entregue (`app/api/food/print/[chave]/route.ts:74-82`), o que
com duas impressoras na mesma chave confirma o job errado.

---

## B8. Qualidade e risco geral

### Segredos no repositório
**OK**. Varredura por `sk_live|SECRET|PASSWORD|API_KEY|BEGIN RSA|token longo`:
nenhuma credencial em claro. Tudo vem de `process.env`; `.env` e `.env.local`
estão no `.gitignore:5-7`. Credencial de PSP é cifrada pelo cofre
(`lib/cofre.ts`, usada em `app/api/food/painel/route.ts:241-248`) e nunca volta
para a tela. **Ressalva operacional**, não de código: o `.env.local` da máquina
do Sandro aponta para o banco de produção por um túnel, então qualquer script
rodado ali mexe em produção (`docs/appfood-contexto.md`, seção 7).

### Validação de entrada
**AUSENTE. P1.** Nenhuma biblioteca de schema. Todo endpoint lê `req.json()` e
faz `String(body.x)` ou `as never` (`app/api/food/painel/route.ts:182-190` chama
`upsertCategoria(neg, lojaId, body as never)`, jogando o corpo inteiro do
navegador dentro da função). O que salva o sistema hoje é a lista branca de
colunas em `atualizarLoja()` (`lib/food.ts:82-90`), o SQL parametrizado em toda
parte (não achei uma única concatenação de valor em SQL) e os `CHECK` do banco.
Não há injeção de SQL. Há, sim, chance de gravar lixo: `Number(body.valor)` de um
texto vira `NaN` e vai para o banco como `NaN`
(`app/api/food/garcom/route.ts:101`).

### Tratamento de erro
**PARCIAL. P1.** O usuário não vê stack trace: os `catch` devolvem
`e.message` com status 400 (`app/api/food/painel/route.ts:389-391`,
`publico/route.ts:126-128`). Só que **a mensagem crua do erro do banco vai para o
navegador**: violação de constraint, nome de coluna e nome de tabela vazam para
quem chamou. E não existe log estruturado nem monitoramento: nenhum `console` nos
arquivos do food, nenhum Sentry, nenhum agregador. **Quando um pedido falhar na
noite de sábado, não vai existir registro nenhum de que falhou.**

### Testes
**PARCIAL. P1.** Três scripts, sem framework, rodados por `npm run test:food` e
`npm run test:fluxo`:

| Arquivo | O que cobre |
|---|---|
| `db/testes/estrutura.mjs` (109 linhas) | Aplica schema e migrations em Postgres em memória (PGlite) e confere estrutura, bairros, mídia. |
| `db/testes/operacao.mjs` (145 linhas) | Roda as consultas críticas reais: contador do pedido, sessão, fila de impressão com SKIP LOCKED, KDS, mapa de mesas, fechamento, resumo do dia. |
| `db/testes/fluxo-real.mjs` (218 linhas) | 23 checagens ponta a ponta contra o app no ar: dois celulares na mesma comanda, preço forjado ignorado, cozinha, impressora no protocolo real, PIN do garçom, fechamento, delivery, evento de WhatsApp. |

**O que deveria ter teste e não tem**: isolamento entre negócios (B3), transição
de estado inválida, pedido duplicado por reenvio, grupo obrigatório vazio, opção
de outro produto, fechar conta sem pagar, taxa de serviço, e o middleware
(nenhum teste teria pego a rota de mídia caindo no login).

### N+1 de query
**OK**. O cardápio é montado em 4 consultas com `= ANY($1)`, sem laço
(`lib/food.ts:227-271`), e o comentário no código diz exatamente isso. O KDS é
uma consulta só (`lib/food.ts:882-895`). `listPedidos` e `resumoSessao` fazem duas
consultas e juntam em memória (`:791-796`, `:486-492`). Os laços com `await` que
existem são inserções, não leituras: itens do pedido um a um
(`lib/food.ts:732-742`), criação de mesas em lote (`:136-145`), baixa de estoque
por insumo (`:1228-1238`). Em rush de 40 itens isso são 40 `INSERT` dentro da
mesma transação, aceitável, mas é o candidato natural a virar um `INSERT` único
quando a casa crescer.

### LGPD
**PARCIAL. P1.**

- **O que é guardado**: nome, telefone, e-mail, CPF, nascimento e endereço do
  cliente final (`food_clientes`, `migration_0003:213-227`), mais IP e device id
  em cada pedido (`food_pedidos.origem_ip`, `origem_device`, `:359-360`), mais
  endereço completo de entrega em `entrega_json` (`:365`).
- **Por quanto tempo**: para sempre. Não há política de retenção, nem job de
  expurgo, nem anonimização.
- **Caminho de exclusão**: **não existe**. Nenhum endpoint apaga
  `food_clientes`. O único caminho é `ON DELETE CASCADE` a partir do negócio
  inteiro.
- **Consentimento**: o pedido de delivery grava `optin_whats = true` na marra
  (`app/api/food/publico/route.ts:90-91`), sem caixa de opt-in na tela. Quem pede
  uma pizza passa a receber mensagem de WhatsApp sem ter marcado nada. Isso é
  base legal frágil e é o tipo de detalhe que o concorrente usa contra você numa
  venda para rede.

---

## Tabela final

| # | Item do checklist | Status | Sev. | Evidência principal |
|---|---|---|---|---|
| B1.1 | Sessão de mesa separada de pedido | OK | - | `migration_0003:281-406` |
| B1.2 | Token de sessão emitido no 1º acesso | QUEBRADO | P0 | `app/api/food/publico/route.ts:131-134` |
| B1.3 | Trava contra pedido remoto | AUSENTE | P0 | `lib/food.ts:435-471` |
| B1.4 | Rate limit por mesa, sessão ou IP | AUSENTE | P0 | nenhuma rota food importa `lib/groow/ratelimit.ts` |
| B1.5 | Uma comanda viva por mesa | OK | - | `migration_0003:308-310` |
| B1.6 | Invalidar celulares ao fechar a conta | AUSENTE | P1 | `lib/food.ts:551-585` |
| B1.7 | Identificador de mesa opaco | OK | - | `lib/food.ts:20-22` |
| B2.1 | Preço recalculado no servidor | OK | - | `lib/food.ts:627-687` |
| B2.2 | Adicionais e regras validados no backend | QUEBRADO | P1 | `lib/food.ts:646-673` |
| B2.3 | Dinheiro sem float | PARCIAL | P2 | `migration_0003:355`, `lib/food.ts:673-677` |
| B2.4 | Desconto e cortesia com permissão | AUSENTE | P1 | nenhum endpoint grava `desconto` |
| B2.5 | Idempotência no envio do pedido | AUSENTE | P0 | `lib/food.ts:612-769` |
| B3.1 | `negocio_id` em toda tabela | OK | - | `migration_0003` inteiro |
| B3.2 | Toda query filtra por negócio | PARCIAL | P1 | `lib/food.ts:474-501`, `app/api/food/garcom/route.ts:67` |
| B3.3 | Isolamento no banco (RLS) | AUSENTE | P1 | sem `CREATE POLICY` no repositório |
| B3.4 | Teste de vazamento entre clientes | AUSENTE | P0 | `db/testes/` |
| B4.1 | Modelo de três níveis | OK | - | `migration_0003:281-406` |
| B4.2 | Praça por item | PARCIAL | P1 | `lib/food.ts:681`, `migration_0003:151` |
| B4.3 | Máquina de estados explícita | AUSENTE | P0 | `lib/food.ts:836-851` |
| B4.4 | Transições inválidas bloqueadas | QUEBRADO | P0 | `app/api/food/kds/route.ts:59-62` |
| B4.5 | Trilha de auditoria (quem, quando, de onde) | AUSENTE | P0 | `lib/food.ts:898-905` |
| B4.6 | Transições idempotentes | PARCIAL | P1 | `lib/food.ts:901`, `:862-868` |
| B4.7 | Cancelamento com motivo e autor | QUEBRADO | P1 | `app/api/food/painel/route.ts:208-210` |
| B4.8 | Tempo real com ressincronização | PARCIAL | P2 | `components/food/kds-app.tsx:37-42` |
| B5.1 | 86 em tempo real nos celulares abertos | QUEBRADO | P1 | `components/food/mesa-app.tsx:71-92` |
| B5.2 | Disponibilidade por horário | QUEBRADO | P2 | `lib/food.ts:227-241` |
| B5.3 | Alergênicos e restrições | AUSENTE | P1 | nenhum campo no schema |
| B5.4 | Imagens otimizadas | QUEBRADO | P1 | `middleware.ts:18-25` (307 para `/login`) |
| B6.1 | Soma da comanda inteira | OK | - | `lib/food.ts:505-530` |
| B6.2 | Divisão de conta | AUSENTE | P1 | nenhum código |
| B6.3 | Pagamento parcial | PARCIAL | P2 | `lib/food.ts:551-585` fecha sem conferir |
| B6.4 | Pix dinâmico com webhook e conciliação | PARCIAL | P1 | `lib/food-pix.ts`, sem assinatura e sem conciliação |
| B6.5 | Taxa de serviço recusável (Lei 13.419) | QUEBRADO | P1 | `lib/food.ts:518-523` |
| B6.6 | NFC-e e contingência | AUSENTE | P0 | campos sem código |
| B7.1 | Papéis e permissões | QUEBRADO | P1 | `lib/food-auth.ts:11-17`, `app/api/food/garcom/route.ts` |
| B7.2 | Chamar o garçom | OK | - | `lib/food.ts:928-943` |
| B7.3 | Mapa de mesas | OK | - | `lib/food.ts:193-210` |
| B7.4 | Relatórios operacionais | PARCIAL | P2 | `lib/food.ts:1281-1317` |
| B7.5 | Impressão térmica | OK | - | `app/api/food/print/[chave]/route.ts` |
| B8.1 | Segredos fora do repositório | OK | - | `.gitignore:5-7` |
| B8.2 | Validação de entrada | AUSENTE | P1 | `app/api/food/painel/route.ts:182-190` |
| B8.3 | Erro tratado, log e monitoramento | PARCIAL | P1 | `app/api/food/painel/route.ts:389-391` |
| B8.4 | Testes | PARCIAL | P1 | `db/testes/` |
| B8.5 | N+1 de query | OK | - | `lib/food.ts:227-271` |
| B8.6 | LGPD | PARCIAL | P1 | `app/api/food/publico/route.ts:90-91` |

**Fora do checklist, mas encontrado na auditoria e igualmente grave:**

| # | Item | Status | Sev. | Evidência |
|---|---|---|---|---|
| X1 | Fuso horário: banco em UTC, casa em BRT | QUEBRADO | P1 | `lib/food.ts:701`, `lib/food-edicao.ts:246-254` |
| X2 | Fotos do cardápio caem no login | QUEBRADO | P1 | `middleware.ts:18-25` |
| X3 | `esgotado_ate` gravado e nunca lido | QUEBRADO | P2 | `lib/food.ts:356` |
| X4 | Pizza meia a meia não implementada | AUSENTE | P2 | `lib/food.ts:662-687` |
