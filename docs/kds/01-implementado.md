# KDS: o que foi construído

Companheiro do [`00-plano.md`](00-plano.md). Aqui está o que existe no código
hoje, arquivo por arquivo, e o que ainda falta fazer para rodar.

**Estado**: código escrito, `npx tsc --noEmit` limpo, `next build` passando e
**58 de 58 checagens** do teste da máquina de estados passando contra Postgres
em memória. **Falta aplicar a migração no banco** (ver seção 6).

---

## 1. O que mudou no banco

`db/migration_0005_kds.sql`, idempotente, já incluída no `db/instalar-food.mjs`.

| Objeto | O que é |
|---|---|
| `food_item_eventos` | Toda transição de item: `de`, `para`, `ator_tipo`, `ator_id`, `ator_nome`, `origem`, `motivo`, `chave`, `criado_em`. É a trilha de auditoria que a auditoria apontou como AUSENTE / P0. |
| `food_sessao_eventos` | O mesmo para a comanda, mais `valor_aberto` (quanto faltava quando fechou fora da régua). |
| `food_itens.meta_min` | A meta de tempo do item. É o `prep_time_target` do plano. |
| `food_itens.entregue_em`, `cancelado_em`, `cancelado_motivo`, `cancelado_por` | Carimbos que faltavam. |
| `food_itens.atualizado_em` | O relógio que o canal de tempo real observa. |
| `food_areas.meta_min` | Meta por praça (bar 3 a 4 min, chapa 15, confeitaria 8). A migração já ajusta pelas palavras no nome da praça. |
| `food_sessoes` | Estados novos `em_pagamento` e `paga`; `aguardando_pagamento` foi convertido. Índice `uq_food_sessao_viva` recriado: a mesa segue ocupada enquanto estiver `paga` e não `fechada`. |
| `food_fiscal_fila` | Para onde a comanda paga vai quando a loja emite NFC-e. SEFAZ fora do ar deixa a linha em `erro`; a comanda **nunca volta para `aberta`**. |
| `food_lojas.cardapio_rev` | Contador que sobe a cada 86 e a cada edição. É o que apaga o item nos celulares que já estão com o cardápio aberto. |
| `food_pedidos.chave_idem` | Chave de idempotência do pedido, com índice único parcial por loja. Fecha o P0 de "3G ruim manda duas picanhas". |

---

## 2. A máquina de estados

`lib/food-kds-sql.ts` (sem nenhum import de runtime, cliente de banco por
parâmetro) e `lib/food-kds.ts` (o embrulho com o pool).

Transições do item, e são as únicas que existem:

| De | Para |
|---|---|
| `pendente` | `em_producao`, `pronto`, `cancelado` |
| `em_producao` | `pronto`, `cancelado` |
| `pronto` | `entregue`, `cancelado` |
| `entregue`, `cancelado` | nada, é terminal |

- `pendente -> pronto` é permitido de propósito (no bar a cerveja fica pronta
  antes de alguém apertar "fazendo") e grava **também** o evento intermediário
  com ator `sistema`, para o relatório de tempo não mentir.
- Repetir a mesma transição não gera evento nem move `producao_em` / `pronto_em`.
- Transição inválida levanta `ErroKds("TRANSICAO_INVALIDA")` com a frase do que
  era possível dali. A rota devolve 409, nunca falha calada.
- Cancelar sem motivo é recusado.
- `desfazerItem()` reverte a última transição se ela tiver menos de 30 segundos
  (a tela oferece 10; a folga é para a rede da cozinha).
- `moverPedido()` é o "sai tudo": move todo item que pode e ignora os que já
  passaram.

Comanda: `aberta -> conta_pedida -> em_pagamento -> paga -> fechada`.
`paga` exige a conta coberta. `fechada` sai de qualquer estado vivo, mas com
saldo em aberto **exige motivo** e grava o valor que faltou. Pagamento parcial em
mesa aberta não muda o estado, porque no bar quem pagou a primeira rodada
continua pedindo.

Funções de leitura: `estadoKds`, `revisaoKds`, `resumoPorArea`, `historicoItem`,
`marcar86`, `liberarEsgotadosVencidos`.

---

## 3. Endpoints

| Rota | O que faz |
|---|---|
| `GET /api/food/kds?token=` | Estado completo: dispositivo, praças, itens com meta e carimbos, chamados, `rev` e o relógio do servidor. |
| `POST /api/food/kds` | `item` (transição), `desfazer`, `pedido` (sai tudo), `86`, `chamado`. Toda ação aceita `chave` de idempotência. |
| `GET /api/food/kds/stream?token=` | SSE. Manda só a revisão, a cada 2 segundos quando muda, com heartbeat de 20 s e reciclagem aos 10 min. |
| `POST /api/food/painel` | Ganhou `status_item` pela máquina de estados, `desfazer_item`, `sai_tudo`, e o `esgotado` agora sobe o `cardapio_rev`. |
| `GET /api/food/painel?vista=salao` | Ganhou `cozinha` (fila e atraso por praça) e `rev`. |
| `GET /api/food/painel?vista=item&item=` | A linha do tempo de um item: quem mexeu, quando e de onde. |

---

## 4. A tela

`components/food/kds-app.tsx` e `app/food-kds.css`, reescritos.

- Kanban de **item**: Recebido, Em preparo, Pronto. Entregue sai da tela.
- **Nunca perde ticket**: todo (re)conectar do SSE dispara um `fetch` completo,
  e ainda há polling de reserva a cada 20 segundos.
- **Sobrevive à internet caindo**: último estado em `localStorage`, fila de ações
  pendentes com chave de idempotência, reenvio automático a cada 5 segundos, e
  faixa fixa "Sem conexão, N ações pendentes".
- **Som**: dois tons por WebAudio (ticket novo e ticket estourado), destravados
  no primeiro toque, com botão de mudo guardado no aparelho.
- **Dedo com luva**: botão de 64px, fonte de 17 a 23px, tema escuro de alto
  contraste.
- **Desfazer de 10 segundos** em toda transição, com contagem, sem senha.
- **Cor pelo relógio**: verde até 70% da meta, âmbar de 70% a 100%, vermelho
  passou. Na coluna Pronto o cronômetro conta o **tempo parado na janela**, e
  fica âmbar aos 3 minutos e vermelho aos 5.
- **Filtro por praça** em chips, guardado por aparelho.
- **Botão 86** no cartão, com confirmação, que derruba o item do cardápio de
  todos os celulares abertos.
- O celular na mesa compara o `cardapio_rev` que já vem no resumo de 10 em 10
  segundos e recarrega o cardápio sozinho quando o 86 acontece.

O painel do salão (`components/food/painel-salao.tsx`) passou a mostrar o bloco
"Cozinha agora", com fila e atraso por praça, **do mesmo estado** que o KDS
consome.

---

## 5. Testes

`db/testes/kds.mjs`, rodando com `npm run test:kds` (ou junto no
`npm run test:food`). PGlite, não encosta em produção. 58 checagens:

1. tabela de transições, incluindo as proibidas;
2. transição válida grava evento com autor, origem e carimbo;
3. transição inválida recusada, estado inventado recusado, item de outro negócio
   intocado;
4. transição repetida idempotente, sem evento duplicado e sem mover o `ready_at`;
5. dois atores e reenvio de rede ruim: um evento só;
6. cancelamento sem motivo recusado, com motivo grava autor;
7. atalho `pendente -> pronto` grava o evento intermediário;
8. desfazer dentro e fora da janela;
9. **reconexão sem perda de ticket**: a revisão muda, o fetch completo traz o
   estado novo e nenhum ticket some;
10. meta herdada da praça e resumo por praça;
11. botão 86 e volta automática do esgotado vencido;
12. máquina da comanda inteira, fila fiscal e fechamento com saldo em aberto;
13. "sai tudo" no pedido, idempotente;
14. mesa que foi embora sem consumir.

**Limite conhecido**: PGlite é uma conexão só, então a corrida de verdade (dois
tablets no mesmo milissegundo, serializada pelo `FOR UPDATE`) não é exercitada
pelo teste. O que o teste garante é o efeito: quem chega depois não escreve de
novo. O teste está comentado dizendo isso.

---

## 6. O que falta para rodar

**1. Aplicar a migração** (o `.env.local` aponta para o banco de produção por
túnel, então isto mexe em produção):

```
npm run food:instalar
```

Verificado antes de escrever: o módulo food no banco tem só a loja de
demonstração, **zero comandas e zero itens**, então a conversão de status não
toca em dado nenhum de cliente.

**2. Rodar os testes e o fluxo ponta a ponta:**

```
npm run test:food
npm run dev
npm run test:fluxo -- http://localhost:3010
```

**3. Conferir na mão**: abrir `/k/<token do tablet>`, lançar um pedido pela mesa
de demonstração, e desligar o wifi do aparelho para ver a faixa de offline e a
fila de ações pendentes.

---

## 7. O que este trabalho fechou da auditoria

| Achado | Status |
|---|---|
| B4.3 Máquina de estados explícita (AUSENTE / P0) | Fechado |
| B4.4 Transições inválidas bloqueadas (QUEBRADO / P0) | Fechado |
| B4.5 Trilha de auditoria (AUSENTE / P0) | Fechado |
| B4.6 Transições idempotentes (PARCIAL / P1) | Fechado |
| B4.7 Cancelamento com motivo e autor (QUEBRADO / P1) | Fechado |
| B4.8 Tempo real com ressincronização (PARCIAL / P2) | Fechado, com SSE e fetch completo |
| B5.1 86 em tempo real nos celulares abertos (QUEBRADO / P1) | Fechado |
| B5.4 Fotos do cardápio caindo no login (QUEBRADO / P1) | Fechado (uma linha no `middleware.ts`) |
| B6.3 Fechar conta sem conferir pagamento (PARCIAL / P2) | Fechado, com motivo e valor em aberto gravados |
| B3.2 Comanda de outro cliente pelo `vista=sessao` (PARCIAL / P1) | Fechado |
| B3.2 Mesa de outra loja pelo tablet do garçom (PARCIAL / P1) | Fechado |
| B2.5 Idempotência do pedido (AUSENTE / P0) | Coluna e índice criados; **falta ligar em `criarPedido()` e no celular** |
| X3 `esgotado_ate` nunca lido (QUEBRADO / P2) | Fechado |

**Continua aberto e é o próximo da fila**: token de sessão de mesa (B1.2),
rate limit (B1.4), fuso horário UTC contra BRT (X1), validação de grupos de
opção no servidor (B2.2), divisão de conta (B6.2), alergênicos (B5.3) e taxa de
serviço recusável (B6.5).
