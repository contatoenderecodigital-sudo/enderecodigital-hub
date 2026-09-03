# KDS em Kanban: plano de implementação

Base: `docs/auditoria/01-lacunas.md`. Os nomes de tabela abaixo são os que a
auditoria encontrou de verdade no banco (`food_sessoes`, `food_pedidos`,
`food_itens`, `food_areas`), não nomes inventados.

**O que já existe e não vai ser refeito**: o modelo de três níveis, a praça por
item (`food_itens.area_id`), a fila de impressão, o mapa de mesas e o preço vindo
do banco. **O que vai ser construído**: a máquina de estados validada com trilha
de auditoria, os endpoints idempotentes, o canal de tempo real e a tela.

---

## 1. Vocabulário: o nome no plano e o nome no banco

| No plano | No banco | Observação |
|---|---|---|
| `table_session` | `food_sessoes` | já existe, com índice único parcial de comanda viva |
| `order` (rodada) | `food_pedidos` | já existe, com `numero_dia` por loja e dia |
| `order_item` | `food_itens` | já existe, com `area_id`, `producao_em`, `pronto_em` |
| praça | `food_areas` | já existe, uma por loja, ligada a produto e impressora |
| `prep_time_target` | `food_itens.meta_min` | **novo**, com fallback para a área e para a loja |
| tabela de eventos do item | `food_item_eventos` | **nova** |
| tabela de eventos da comanda | `food_sessao_eventos` | **nova** |

---

## 2. Migração do banco (`db/migration_0005_kds.sql`)

1. **`food_item_eventos`**: `id`, `negocio_id`, `loja_id`, `item_id`,
   `pedido_id`, `de`, `para`, `ator_tipo` (`kds`, `garcom`, `painel`, `cliente`,
   `sistema`), `ator_id`, `ator_nome`, `origem`, `motivo`, `criado_em`.
   Toda transição escreve aqui, dentro da mesma transação do `UPDATE`.
2. **`food_sessao_eventos`**: o mesmo para a comanda.
3. **`food_itens`** ganha: `meta_min` (a meta de tempo daquele item),
   `entregue_em`, `cancelado_em`, `cancelado_motivo`, `cancelado_por` e
   `atualizado_em` (o carimbo que alimenta o canal de tempo real).
4. **`food_areas`** ganha `meta_min` (padrão 15 minutos). A meta de um item é
   `COALESCE(item.meta_min, produto.tempo_preparo, area.meta_min,
   loja.tempo_preparo_min)`.
5. **`food_sessoes`**: o `CHECK` de status passa a ser
   `aberta, conta_pedida, em_pagamento, paga, fechada, cancelada`. O valor antigo
   `aguardando_pagamento` é convertido para `em_pagamento` na própria migração, e
   o índice `uq_food_sessao_viva` é recriado com a lista nova (uma mesa continua
   ocupada enquanto a comanda estiver `paga` e ainda não `fechada`). Ganha
   `em_pagamento_em` e `paga_em`.
6. **`food_fiscal_fila`**: `sessao_id`, `status`
   (`pendente`, `processando`, `emitida`, `erro`), `tentativas`, `erro`. É para
   onde a comanda vai quando `PAGA` e a loja tem `fiscal_ativo`. Se a emissão
   falhar, a linha fica em `erro` e é reprocessada; **a comanda nunca volta para
   `aberta`**.
7. **`food_lojas.cardapio_rev`**: contador que sobe a cada mudança de cardápio.
   É o que faz o botão 86 apagar o item nos celulares já abertos.

A migração é idempotente (`IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS`) e entra
na lista do `db/instalar-food.mjs`.

---

## 3. Máquina de estados do item

```
pendente ──> em_producao ──> pronto ──> entregue
   │              │            │
   └──────────────┴────────────┴──> cancelado (exige motivo)
```

Tabela de transições permitidas, escrita uma vez em
`lib/food-kds-sql.ts` e usada por todo mundo:

| De | Para permitido |
|---|---|
| `pendente` | `em_producao`, `pronto`, `cancelado` |
| `em_producao` | `pronto`, `cancelado` |
| `pronto` | `entregue`, `cancelado` |
| `entregue` | nada (terminal) |
| `cancelado` | nada (terminal) |

Regras:

- **`pendente -> pronto` é permitido de propósito.** No bar, a cerveja fica
  pronta antes de alguém apertar "fazendo". Quando isso acontece, o serviço grava
  também o evento intermediário com `ator_tipo = 'sistema'` e carimba
  `producao_em = now()`, para o relatório de tempo não mentir.
- **`em_producao` grava `producao_em`. `pronto` grava `pronto_em`.** Só na
  primeira vez: repetir a transição não move o relógio.
- **Cancelar exige motivo e autor.** Sem motivo, erro 400.
- **Voltar não é transição, é desfazer.** A máquina para frente é estrita. O
  desfazer é uma ação própria (ver abaixo), sempre auditada.

### Idempotência e dois atores ao mesmo tempo

Tudo acontece dentro de uma transação com `SELECT ... FOR UPDATE` no item:

1. Trava o item e lê o status atual.
2. Se o status atual **já é o destino**: não escreve nada, não gera evento,
   devolve `{ ok: true, repetido: true }`. Dois garçons batendo "pronto" no mesmo
   segundo geram um evento só.
3. Se a transição é válida: `UPDATE` + evento, devolve `{ ok: true, de, para }`.
4. Se é inválida: erro `TRANSICAO_INVALIDA` com a mensagem do que era possível
   dali. Nunca falha em silêncio.

### Desfazer de 10 segundos

`acao: "desfazer"` no item: lê o último evento, e só reverte se ele tiver menos
de **30 segundos** (o botão some com 10 na tela; a folga é para a rede ruim da
cozinha). Volta o status para `evento.de`, limpa o carimbo que aquela transição
tinha gravado e escreve um evento novo com `motivo = 'desfazer'`. Sem senha e sem
menu, como pedido.

---

## 4. Máquina de estados da comanda

```
aberta ──> conta_pedida ──> em_pagamento ──> paga ──> fechada
```

| De | Para permitido |
|---|---|
| `aberta` | `conta_pedida`, `cancelada` |
| `conta_pedida` | `em_pagamento`, `aberta` (a mesa pediu mais uma) |
| `em_pagamento` | `paga`, `conta_pedida` |
| `paga` | `fechada` |
| `fechada`, `cancelada` | terminal |

- `paga` só entra quando `pago >= total` (tolerância de um centavo). O
  `registrarPagamento` já existente passa a empurrar a comanda por essa régua
  sozinho.
- `fechada` a partir de `paga` é o caminho normal. Fechar com saldo em aberto
  continua **possível** (o garçom recebeu na maquininha e o sistema não viu), mas
  agora exige `motivo` e fica gravado no evento com o valor que faltou. Isso
  fecha o furo B6 da auditoria sem travar a operação.
- Em `paga`, se `loja.fiscal_ativo`, entra na `food_fiscal_fila`. Falha de SEFAZ
  não desfaz nada.

---

## 5. Camada de serviço

Dois arquivos, e a separação tem motivo:

- **`lib/food-kds-sql.ts`**: a máquina de estados e o SQL. **Sem nenhum import de
  runtime** (só `import type` do `pg`), e toda função recebe o cliente de banco
  por parâmetro. É isso que permite rodar teste de verdade contra um Postgres em
  memória, sem subir o app e sem encostar no banco de produção.
- **`lib/food-kds.ts`**: o embrulho com `server-only` que pega o cliente do pool
  e é o que as rotas importam.

Funções: `moverItem`, `desfazerItem`, `moverSessao`, `fecharComanda`,
`estadoKds`, `revisaoKds`, `marcar86`, `resumoPorArea`.

---

## 6. Endpoints (todos idempotentes)

`GET /api/food/kds?token=` devolve o **estado completo**: dispositivo, áreas
disponíveis para o filtro, itens com meta e carimbos, chamados, `rev` e `agora`
(o relógio do servidor, para a tela não depender da hora do tablet).

`POST /api/food/kds`:

| Ação | Corpo | O que faz |
|---|---|---|
| `item` | `itemId`, `para`, `motivo?` | transição validada e idempotente |
| `desfazer` | `itemId` | reverte a última transição recente |
| `86` | `produtoId`, `esgotado` | esgota e sobe `cardapio_rev` |
| `chamado` | `chamadoId` | atende o chamado |
| `pedido` | `pedidoId`, `para` | transição do pedido, agora validada |

Toda ação aceita `chave` (idempotency key) opcional: a mesma chave repetida
devolve o resultado anterior em vez de agir de novo. É o que faz a fila offline
do tablet poder reenviar sem medo.

`GET /api/food/kds/stream?token=` é o canal de tempo real (SSE).

---

## 7. Canal de tempo real

SSE, não WebSocket: passa em qualquer proxy, reconecta sozinho e não precisa de
infraestrutura nova. O servidor consulta uma revisão barata (o maior
`atualizado_em` dos itens do dia, a contagem de chamados e o `cardapio_rev`) a
cada 2 segundos e só empurra quando muda. Heartbeat a cada 20 segundos, e a
conexão se encerra sozinha aos 10 minutos para o cliente reciclar.

No cliente:

- **Ao conectar e ao reconectar, sempre um `fetch` completo do estado.** O stream
  só avisa que mudou; quem manda é o `GET`. É isso que garante que nada se perde
  no intervalo em que a conexão esteve fora.
- Backoff exponencial de 1s até 30s, com sorteio para dois tablets não voltarem
  no mesmo instante.
- Polling de segurança a cada 20 segundos mesmo com o stream vivo.

---

## 8. A tela da cozinha

Colunas Kanban de **item**, não de pedido: `RECEBIDO`, `EM PREPARO`, `PRONTO`.
`ENTREGUE` sai da tela. Cada cartão traz quantidade, nome, opções, observação em
destaque, mesa ou canal, número do pedido e o relógio.

| Requisito | Como |
|---|---|
| Nunca perde ticket | `fetch` completo em todo (re)conectar, mais polling de 20s |
| Sobrevive à internet caindo | último estado em `localStorage`, fila de ações pendentes, faixa fixa "offline, N ações pendentes" |
| Som | dois tons por WebAudio (novo e estourado), destravados no primeiro toque, com botão de mudo persistido |
| Dedo com luva | alvo mínimo de 64px, fonte de 17px para cima, contraste alto, tema escuro |
| Desfazer | faixa de 10 segundos com contagem, sem senha e sem menu |
| Cor pelo relógio | verde até 70% da meta, âmbar de 70% a 100%, vermelho passou |
| Coluna Pronto | conta o tempo **parado na janela** desde `pronto_em`, e fica vermelha depois de 5 minutos |
| Filtro por praça | chips no topo, guardado por dispositivo em `localStorage` |
| Botão 86 | no cartão, esgota o produto e derruba do cardápio de todos os celulares abertos |

O celular do cliente passa a comparar o `cardapio_rev` que vem no resumo (que ele
já busca a cada 10 segundos) e recarrega o cardápio quando ele muda. É assim que
o 86 chega na mesa sem WebSocket no celular.

---

## 9. Testes

`db/testes/kds.mjs`, rodando contra PGlite (Postgres em memória, não encosta em
produção), importando a camada de serviço de verdade:

1. Transição válida move e grava o evento com ator e origem.
2. **Transição inválida é rejeitada** (`entregue -> pendente`, `cancelado ->
   pronto`) com erro claro.
3. **Transição repetida é idempotente**: dois "pronto" seguidos, um evento só, e
   `pronto_em` não se move.
4. **Dois atores simultâneos**: duas transições concorrentes na mesma conexão
   serializada pelo `FOR UPDATE`, resultado final consistente e sem evento
   duplicado.
5. Cancelamento sem motivo é recusado.
6. `pendente -> pronto` grava o evento intermediário e o `producao_em`.
7. Desfazer dentro da janela volta o estado; fora da janela é recusado.
8. **Reconexão sem perda de ticket**: a revisão muda a cada transição, e o estado
   completo buscado depois contém o item que entrou "enquanto a conexão estava
   fora".
9. Máquina da comanda: `aberta -> paga` direto é recusado; fechar com saldo em
   aberto exige motivo; `paga` com fiscal ligado enfileira e não volta atrás.

---

## 10. Ordem de execução

1. Migração e tabelas de evento
2. `lib/food-kds-sql.ts` com a máquina validada, e os testes dela
3. Endpoints idempotentes
4. Canal SSE, com o teste de derrubar e voltar
5. Tela do KDS
6. Painel do salão consumindo o mesmo estado (resumo por praça e itens
   estourados)
