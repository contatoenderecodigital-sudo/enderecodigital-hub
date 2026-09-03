# 02. Plano: o que dói, em que ordem, e o que custa caro depois

> Fotografia de 01/09/2026, mantida como estava. O que ja foi corrigido
> desde entao esta em [`03-corrigido.md`](03-corrigido.md).

Leia junto com o `01-lacunas.md`, que tem a evidência item a item.

**Resumo em uma linha**: o modelo de dados está bem acima da média do mercado e o
preço vindo do banco está certo; o que falta é a camada de defesa em volta
(sessão de mesa, rate limit, máquina de estados, auditoria) e três bugs de
produção que quebram a demonstração na frente do cliente.

---

## Top 10 achados, por severidade

### 1. P0. A URL da mesa é uma senha eterna que qualquer cliente leva para casa
**Onde**: `app/api/food/publico/route.ts:131-134`, `lib/food.ts:435-471`.
**Cenário**: o cliente janta na sexta, copia a URL do celular
(`/c/boteco-demo/m/x6LX1kaQqF-l`), e no domingo às 3h da manhã chama
`acao=entrar` com um `deviceId` inventado. O sistema abre uma comanda nova na
mesa 7 e aceita 40 itens por requisição, sem limite de requisições. A impressora
da cozinha imprime sozinha e o estoque de insumos vai a negativo.
**Conserto**: no primeiro acesso o servidor emite um token de sessão de curta
duração em cookie httpOnly, amarrado à sessão de mesa e morto no fechamento da
conta, e o token do cartão passa a servir só para abrir a sessão.

### 2. P0. Nenhum rate limit em nenhuma rota do cliente final
**Onde**: `app/api/food/publico/route.ts` inteiro. A biblioteca existe
(`lib/groow/ratelimit.ts`) e é usada só no login.
**Cenário**: um laço de shell com o token de uma mesa gera mil pedidos em um
minuto, mil comandas na fila da impressora e mil linhas de estoque. Sem log, sem
alerta, sem nada para olhar depois.
**Conserto**: limite por token de mesa, por device e por IP nas ações `entrar`,
`pedir`, `chamar` e `pagar`, devolvendo 429.

### 3. P0. Não existe idempotência no envio do pedido
**Onde**: `lib/food.ts:612-769`.
**Cenário**: 3G ruim no salão. O pedido chega ao servidor, a resposta se perde, o
cliente aperta "enviar" de novo. Saem dois pedidos com números diferentes, duas
comandas na cozinha, duas picanhas. O cliente reclama da conta, o dono culpa o
sistema, e não há como provar o que aconteceu.
**Conserto**: o cliente gera uma chave por carrinho, o servidor grava essa chave
com `UNIQUE` no pedido e devolve o pedido já criado quando a chave repetir.

### 4. P0. Status é string solta, sem máquina de estados e sem trilha de auditoria
**Onde**: `lib/food.ts:836-851` (`mudarStatusPedido`), `:898-905`
(`mudarStatusItem`), exposto sem validação em `app/api/food/kds/route.ts:59-62`.
**Cenário**: um toque errado no tablet manda `status: "pendente"` num pedido já
entregue. O pedido volta para a fila da cozinha, entra de novo no faturamento do
dia e ninguém sabe quem fez, quando, nem de qual tablet. O mesmo vale para
ressuscitar pedido cancelado.
**Conserto**: uma função única de transição que valida origem e destino, grava
`{de, para, ator, timestamp, origem}` numa tabela de eventos, e rejeita o resto
com erro claro.

### 5. P0. Nenhum teste tenta ler dado de outro restaurante
**Onde**: `db/testes/` (três arquivos, 472 linhas, 23 checagens de fluxo).
**Cenário**: o isolamento é 100% disciplina de código, sem RLS no Postgres. Basta
alguém esquecer um `AND negocio_id = $2` num `UPDATE` daqui a três meses para o
cardápio de um cliente aparecer no do outro, e nada no `npm test` vai avisar.
**Conserto**: um teste que cria dois negócios e tenta, para cada função pública
da `lib/food.ts`, ler e escrever com o id do vizinho, esperando falha.

### 6. P1. As fotos do cardápio estão quebradas em produção
**Onde**: `middleware.ts:18-25`. `/api/food/midia` não está na lista pública.
**Cenário**: reproduzido agora contra o servidor local:
`GET /api/food/midia/<uuid>` responde `307` para `/login`. O dono sobe as fotos
dos pratos pelo painel, vê tudo bonito enquanto está logado, e **o cliente na
mesa vê o cardápio inteiro sem imagem nenhuma**. Isso mata a demonstração e é
exatamente o que o Sandro vai mostrar na frente do dono do bar.
**Conserto**: acrescentar `/api/food/midia` à lista de rotas públicas do
middleware.

### 7. P1. O banco roda em UTC e a casa abre à noite
**Onde**: banco confirmado em `TimeZone = UTC` (consulta de leitura ao Postgres
de produção); `food_lojas.fuso` existe e nunca é lido.
`lib/food.ts:701` (contador do pedido em `CURRENT_DATE`),
`migration_0003:345` (`dia DATE DEFAULT CURRENT_DATE`),
`lib/food-edicao.ts:246-254` (`EXTRACT(DOW FROM now())` e `localtime`),
`lib/food.ts:1290, 1395, 1450` (relatórios e caixa por `CURRENT_DATE`).
**Cenário duplo, os dois em horário de pico**:
1. Às 21h de Xanxerê vira meia-noite em UTC. No meio do jantar de sábado, o
   número do pedido volta para 1, o relatório do dia zera e a noite de trabalho
   fica partida entre dois dias.
2. O horário de funcionamento é comparado em UTC: um bar que abre 18h-23h é
   avaliado como 18h-23h UTC, ou seja, 15h-20h locais. O pedido de delivery é
   recusado com "fechada" às 21h, quando a casa está cheia, e aceito às 15h30,
   quando está fechada.
**Conserto**: trocar `CURRENT_DATE` e `localtime` por `(now() AT TIME ZONE
l.fuso)` em todas as consultas de dia e de horário, ou fixar `TimeZone` da
conexão em `America/Sao_Paulo`.

### 8. P1. O PIN do garçom é decoração
**Onde**: `app/api/food/garcom/route.ts:54-63` valida o PIN e devolve `ok`;
`components/food/garcom-app.tsx:75` guarda no `localStorage`; todas as demais
ações exigem só o token do dispositivo, que está na URL.
**Cenário**: alguém fotografa a URL do tablet do garçom, ou o tablet fica
destravado no balcão. Sem PIN nenhum, essa pessoa registra pagamento em
dinheiro de R$ 300 que nunca entrou, dá cortesia, fecha mesas e escolhe em nome
de qual garçom aquilo foi feito, porque o `garcomId` vem no corpo da requisição.
**Conserto**: o `pin` emite um token curto por pessoa, e ações de dinheiro
(pagamento, cortesia, fechar conta, cancelar) exigem esse token no servidor.

### 9. P1. Taxa de serviço automática sem como recusar
**Onde**: `lib/food.ts:518-523`, `components/food/mesa-app.tsx:101-102`.
**Cenário**: a casa liga `taxa_servico_automatica`, os 10% entram no total
gravado no banco e não há nenhum caminho, em nenhuma tela, para o cliente tirar.
A Lei 13.419/2017 trata a gorjeta como opcional. É reclamação no Procon do
restaurante e mancha em quem vendeu o sistema.
**Conserto**: exibir a taxa como linha destacada e recusável no celular e no
fechamento, com o valor recalculado, e registrar a recusa.

### 10. P1. Regras do cardápio existem só no navegador
**Onde**: `lib/food.ts:646-673` (nenhuma validação de grupo);
`components/food/mesa-app.tsx:352-359` (a única validação que existe).
**Cenário**: qualquer chamada fora da tela oficial manda um churrasco sem o ponto
da carne obrigatório, ou com 30 adicionais num grupo de máximo 1, ou com o
adicional de outro produto (a consulta busca opção por id solto, sem exigir que o
grupo seja do produto). A cozinha para para perguntar, ou solta o prato errado.
**Conserto**: validar mínimo, máximo, obrigatório e pertencimento do grupo ao
produto dentro de `criarPedido()`, na mesma transação em que o preço é buscado.

---

## O que eu corrigiria nesta semana, em ordem

Esforço: **P** até meio dia, **M** um a dois dias, **G** três dias ou mais.

| Ordem | O que | Por que primeiro | Esforço |
|---|---|---|---|
| 1 | Liberar `/api/food/midia` no middleware | Uma linha. Hoje o cardápio que você vai demonstrar está sem foto. | P |
| 2 | Fuso: `CURRENT_DATE` e `localtime` respeitando `food_lojas.fuso` | Quebra numeração, relatório e horário de funcionamento em horário de pico, e some sozinho às 21h de todo dia. | P |
| 3 | Rate limit em `/api/food/publico` | Reaproveita `lib/groow/ratelimit.ts`. Fecha o buraco mais barato dos P0. | P |
| 4 | Idempotência no `pedir` (chave por carrinho, `UNIQUE` no banco) | É o bug que o cliente percebe na conta e o dono não sabe explicar. | M |
| 5 | Validar grupos de opção no servidor | Mesma função, mesma transação do preço. Barato e evita prato errado. | M |
| 6 | Sessão de mesa com token httpOnly, morto no fechamento da conta | Fecha o P0 número 1. Mexe no cliente e no servidor, mas não no schema. | M |
| 7 | Máquina de estados única, com tabela de eventos de transição | Base do KDS decente e de todo relatório de tempo. Migration nova. | G |
| 8 | Teste de isolamento entre dois negócios | Depois do 7, porque o 7 mexe em quase todas as escritas de status. | M |
| 9 | Taxa de serviço recusável na tela e no fechamento | Risco jurídico do cliente, e diferencial de venda contra o concorrente. | M |
| 10 | PIN do garçom valendo no servidor para ação de dinheiro | Depois do 7, para reaproveitar o campo de ator da trilha de auditoria. | M |

Do 1 ao 5 dá para fechar em dois dias e já muda o patamar de risco. Do 6 ao 10 é
a semana seguinte.

Ficam **fora** desta semana, de propósito: NFC-e, divisão de conta, alergênicos,
relatórios por praça e marketplaces. São venda, não risco, e o item 7 muda a base
de dados que os relatórios vão usar.

---

## Dívida arquitetural: o que custa caro se não decidir agora

### 1. Máquina de estados (decidir antes de escrever o KDS)
Hoje o status é `UPDATE` espalhado em seis lugares
(`lib/food.ts:740, 819, 849, 853, 908, 563` e `lib/food-edicao.ts:366`). Cada
tela nova que mexer em status multiplica isso. Sem tabela de eventos, **os dados
de tempo de preparo estão sendo perdidos todo dia**, e não dá para recuperar
depois: no dia em que você quiser vender "tempo médio por praça" ou previsão de
entrega, vai ter que esperar três meses de operação nova para ter histórico.
Isso é o que torna o item 7 da lista acima urgente mesmo sendo G.

### 2. Multi-tenant só em código
Funciona e está bem-feito hoje, mas é uma disciplina que depende de quem escreve
a próxima query. Duas saídas, e a escolha muda o custo depois: aceitar o risco e
compensar com o teste automático de isolamento (barato agora, protege para
sempre) ou ligar Row Level Security no Postgres (mais caro, exige passar o
`negocio_id` como `set_config` em toda conexão, mas torna o vazamento
impossível). A hora barata de decidir isso é enquanto são dois clientes reais e
um demo.

### 3. Nível do Kanban: item ou pedido
O banco já está certo (item tem `area_id` e status próprio). A tela não
(`components/food/kds-app.tsx:55-60` agrupa por pedido). Se o KDS for escrito em
cima do agrupamento por pedido, o bar vai receber cartão com sobremesa e a
sobremesa vai sair junto com o prato principal. Refazer isso depois significa
refazer a tela inteira, o filtro por praça, o som e o relatório. Decidir agora
custa zero, porque o modelo de dados já suporta.

### 4. Identidade do cliente na mesa
Hoje não existe: o `deviceId` é inventado pelo navegador. Tudo que depende disso
(dividir a conta por pessoa, pagamento parcial de verdade, fidelidade, CRM do
cliente que come no salão) está bloqueado até haver uma sessão emitida pelo
servidor. É o mesmo trabalho do item 6 da lista da semana, então fazer os dois
juntos sai por um.

### 5. Fiscal
Ficar sem NFC-e é decisão consciente e defensável no MVP, mas define o teto de
preço: sem nota, o AppFood convive com o PDV da casa em vez de substituir. Os
campos já estão no schema (`food_pedidos.nfce_*`, `food_produtos.ncm/csosn`), o
que foi a decisão certa. O que precisa existir antes do primeiro cliente que
peça: fila de contingência para quando a SEFAZ cair, porque emitir nota sem fila
de reprocessamento é pior do que não emitir.

---

## Tabela final para bater o olho

| Bloco | Item | Status | Sev. |
|---|---|---|---|
| B1 | Sessão de mesa separada de pedido | OK | - |
| B1 | Token de sessão no 1º acesso | QUEBRADO | P0 |
| B1 | Trava contra pedido remoto | AUSENTE | P0 |
| B1 | Rate limit | AUSENTE | P0 |
| B1 | Uma comanda viva por mesa | OK | - |
| B1 | Invalidar celulares ao fechar | AUSENTE | P1 |
| B1 | Identificador de mesa opaco | OK | - |
| B2 | Preço recalculado no servidor | OK | - |
| B2 | Adicionais validados no backend | QUEBRADO | P1 |
| B2 | Dinheiro sem float | PARCIAL | P2 |
| B2 | Desconto e cortesia com permissão | AUSENTE | P1 |
| B2 | Idempotência do pedido | AUSENTE | P0 |
| B3 | `negocio_id` em toda tabela | OK | - |
| B3 | Toda query filtra por negócio | PARCIAL | P1 |
| B3 | Isolamento no banco (RLS) | AUSENTE | P1 |
| B3 | Teste de vazamento entre clientes | AUSENTE | P0 |
| B4 | Modelo de três níveis | OK | - |
| B4 | Praça por item | PARCIAL | P1 |
| B4 | Máquina de estados explícita | AUSENTE | P0 |
| B4 | Transições inválidas bloqueadas | QUEBRADO | P0 |
| B4 | Trilha de auditoria | AUSENTE | P0 |
| B4 | Transições idempotentes | PARCIAL | P1 |
| B4 | Cancelamento com motivo e autor | QUEBRADO | P1 |
| B4 | Tempo real com ressincronização | PARCIAL | P2 |
| B5 | 86 em tempo real | QUEBRADO | P1 |
| B5 | Disponibilidade por horário | QUEBRADO | P2 |
| B5 | Alergênicos | AUSENTE | P1 |
| B5 | Imagens otimizadas | QUEBRADO | P1 |
| B6 | Soma da comanda inteira | OK | - |
| B6 | Divisão de conta | AUSENTE | P1 |
| B6 | Pagamento parcial | PARCIAL | P2 |
| B6 | Pix com conciliação | PARCIAL | P1 |
| B6 | Taxa de serviço recusável | QUEBRADO | P1 |
| B6 | NFC-e e contingência | AUSENTE | P0 |
| B7 | Papéis e permissões | QUEBRADO | P1 |
| B7 | Chamar o garçom | OK | - |
| B7 | Mapa de mesas | OK | - |
| B7 | Relatórios operacionais | PARCIAL | P2 |
| B7 | Impressão térmica | OK | - |
| B8 | Segredos fora do repositório | OK | - |
| B8 | Validação de entrada | AUSENTE | P1 |
| B8 | Erro, log e monitoramento | PARCIAL | P1 |
| B8 | Testes | PARCIAL | P1 |
| B8 | N+1 de query | OK | - |
| B8 | LGPD | PARCIAL | P1 |
| X | Fuso horário UTC contra BRT | QUEBRADO | P1 |
| X | Fotos do cardápio caem no login | QUEBRADO | P1 |
| X | `esgotado_ate` nunca lido | QUEBRADO | P2 |
| X | Pizza meia a meia | AUSENTE | P2 |

Contagem, sobre 49 itens: 12 OK, 11 PARCIAL, 14 AUSENTE, 12 QUEBRADO.
Por severidade, sobre os 37 que não estão OK: 9 P0, 21 P1, 7 P2.
