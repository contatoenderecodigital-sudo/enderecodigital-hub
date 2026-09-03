# 03. O que já foi corrigido desde a auditoria

A auditoria (`01-lacunas.md`) é a fotografia de 01/09/2026, e fica como está.
Este arquivo é o que mudou depois dela, no mesmo dia, com o arquivo e a prova.

**Rodou de verdade em 01/09/2026**: as cinco migracoes aplicadas no banco (35
tabelas food_), 138 checagens offline passando e as 28 checagens do
`npm run test:fluxo` passando contra o app no ar.

**Como conferir tudo de uma vez**: `npm run test:food` (138 checagens, nenhuma
dependência de rede e nenhum toque no banco de produção) e `npx next build`.

---

## P0

### B1.2 e B1.3 A URL da mesa era uma senha eterna
**Antes**: o token do cartão era a única credencial. Quem copiasse a URL abria
uma comanda na mesa 7 às três da manhã e mandava quarenta itens para a
impressora.

**Agora**, três travas somadas:
1. O cartão serve só para **entrar**. Entrar devolve um **passe** em cookie
   httpOnly assinado ([lib/food-mesa-passe.ts](../../lib/food-mesa-passe.ts)),
   amarrado à mesa, à comanda daquele momento e ao celular. Pedir, chamar e
   pagar exigem o passe.
2. Comanda **nova** só nasce com a casa aberta
   (`entrarNaMesa(..., { permitirAbrir })` em [lib/food.ts](../../lib/food.ts)).
   Fora do horário, o cliente vê o cardápio e mais nada. Entrar numa comanda que
   já existe continua livre, porque é o segundo celular da mesa chegando.
3. Quando a conta fecha, a comanda morre e a próxima nasce com id novo: **o
   passe antigo deixa de valer sozinho**, sem lista de revogação. Isso fecha
   também o B1.6 ("ao fechar a conta, os celulares são invalidados").

De quebra, o `membroId` deixou de vir do corpo da requisição e passou a vir de
dentro do passe: ninguém mais lança item na conta de outra pessoa da mesa.

### B1.4 Nenhum rate limit
**Agora** em [app/api/food/publico/route.ts](../../app/api/food/publico/route.ts),
reaproveitando `lib/groow/ratelimit.ts`:

| O quê | Limite |
|---|---|
| Qualquer chamada, por IP | 240 por minuto |
| Qualquer chamada, por mesa | 120 por minuto |
| Entrar na mesa | 20 por 5 min, por mesa e IP |
| Pedir, por celular | 12 por 5 min |
| Pedir, por mesa | 40 por hora |
| Chamar o garçom | 6 por 5 min |
| Pagar | 12 por 10 min |
| Pedido de delivery, por IP | 6 por 10 min |

Uma mesa cheia passa folgado. Um laço de shell, não. O limite é em memória do
processo, e isso está documentado no próprio `ratelimit.ts`: se um dia rodar em
mais de uma instância, troca por Redis.

### B2.5 Sem idempotência no envio do pedido
**Agora**: o carrinho gera uma chave e ela vai junto
([mesa-app.tsx](../../components/food/mesa-app.tsx)). O servidor guarda em
`food_pedidos.chave_idem` com índice único por loja; reenvio com a mesma chave
devolve **o mesmo pedido**, e a corrida de dois envios simultâneos cai no índice
e também devolve o primeiro. Testado ponta a ponta em `db/testes/fluxo-real.mjs`.

### B4.3 a B4.7 Máquina de estados, trilha de auditoria, idempotência e cancelamento
Feitos na rodada do KDS. Detalhe em [docs/kds/01-implementado.md](../kds/01-implementado.md).

---

## P1

### X1 O banco em UTC e a casa abrindo à noite
**Antes**: às 21h de Xanxerê o `CURRENT_DATE` virava. No meio do jantar de
sábado o número do pedido voltava para 1 e o relatório do dia zerava. Pior: o
horário de funcionamento era comparado em UTC, então o delivery recusava pedido
às 21h dizendo "fechada" e aceitava às 15h30 com a casa de portas fechadas.

**Agora** ([db/migration_0006_fuso.sql](../../db/migration_0006_fuso.sql)):
três funções no banco, `food_dia_loja()`, `food_agora_loja()` e
`food_loja_aberta()`, que leem a coluna `food_lojas.fuso` que existia desde a
primeira migração e nunca era lida. Todo `CURRENT_DATE` e `localtime` do módulo
foi trocado.

Junto veio uma correção que ninguém tinha pedido e que o oeste catarinense usa
toda semana: **faixa de horário que atravessa a meia-noite**. Bar que abre 18h e
fecha 02h agora conta como aberto à 01h, e a madrugada pertence ao turno do dia
anterior. Casa sem horário cadastrado conta como aberta, para o dono que ainda
não preencheu a agenda não ficar impedido de vender.

### B2.2 As regras do cardápio só existiam no navegador
**Antes**: "escolha 1 opção" era um `disabled` no botão. Por fora da tela dava
para mandar churrasco sem o ponto da carne, trinta adicionais num grupo de
máximo 1, ou grudar o adicional de outro produto, inclusive de outro
restaurante.

**Agora** ([lib/food-regras.ts](../../lib/food-regras.ts)), dentro da mesma
transação em que o preço vem do banco: obrigatório, mínimo, máximo, opção que
não pertence ao produto, opção esgotada, e a forma de somar (`soma`, `maior`,
`media`). O `maior` é o que faz **pizza meia a meia cobrar o sabor mais caro** em
vez da soma dos dois, que era o comportamento errado de antes.

O arquivo não importa nada em tempo de execução, então é testado direto, sem
banco: oito checagens no `db/testes/kds.mjs`.

### B6.4 O cliente podia "pagar" mais do que a mesa devia
`acao=pagar` agora confere o saldo em aberto da comanda antes de gerar o Pix.

### B3.2 Vazamentos entre clientes
Comanda de outro restaurante pelo `vista=sessao` e mesa de outra loja pelo
tablet do garçom: os dois fechados na rodada do KDS.

### B5.4 As fotos do cardápio caíam no `/login`
Uma linha no `middleware.ts`. Era o bug mais barato e o mais caro de deixar
passar: o cardápio da demonstração aparecia sem foto nenhuma no celular.

---

## Rodada 3

### B7.1 e B2.4. O PIN do garçom era enfeite, e não existia papel
**Antes**: `food_equipe.papel` tinha cinco valores no banco e não era consultado
em nenhuma decisão. O PIN era conferido uma vez e o resultado ficava no
`localStorage` do tablet; toda ação seguinte exigia só o token do dispositivo,
que está na URL. Quem pegasse o tablet destravado registrava pagamento em
dinheiro que nunca entrou, dava cortesia e escolhia em nome de qual garçom.

**Agora**:
- o PIN abre um **turno** ([lib/food-equipe-passe.ts](../../lib/food-equipe-passe.ts)):
  uma linha em `food_turnos` e um cookie httpOnly assinado, de 14 horas;
- o papel vem do **banco** a cada requisição, não do cookie: promover ou
  rebaixar alguém vale na hora;
- a matriz de permissão está em [lib/food-permissoes.ts](../../lib/food-permissoes.ts),
  pura e testada. Cortesia, desconto, fechar conta devendo e cancelar prato que
  já está na chapa são do **gerente**. O resto é da operação;
- tentativa de PIN errado é gravada em `food_tentativas_pin`, com IP e tablet, e
  oito erros em cinco minutos travam o aparelho. PIN de quatro dígitos são dez
  mil combinações: sem trava, um tablet esquecido vira senha de gerente;
- **desconto passou a existir**, com valor, motivo e autor, gravado na comanda
  ([lib/food-conta.ts](../../lib/food-conta.ts)). A coluna existia desde a
  primeira migração e nenhum endpoint escrevia nela.

### B6.5. Taxa de serviço agora é recusável
**Onde**: `food_sessoes.servico_recusado`, aplicado dentro de
`recalcularSessao()`, com botão no celular do cliente e no tablet do garçom.
A Lei 13.419/2017 trata a gorjeta como voluntária e o artigo 39 do CDC proíbe
pressionar. A recusa fica registrada em `food_sessao_eventos`.

### B5.3. Alergênicos
**Onde**: `food_produtos.alergenicos`, `tracos`, `sem_gluten`, `sem_lactose`,
`vegetariano`, `vegano`, com a lista canônica em
[lib/food-alergenicos.ts](../../lib/food-alergenicos.ts).

A RDC 727/2022 da Anvisa exige a informação ao lado de cada item do cardápio.
Aparece: etiqueta no card do produto, bloco "contém" na janela do produto, campo
próprio de **alergia do cliente** no pedido (separado da observação comum), e
faixa vermelha `ALERGIA:` no cartão da cozinha e na comanda impressa. A sigla de
três letras existe porque precisa caber na impressora térmica de 48 colunas.

### B6.2. Divisão de conta
**Onde**: [lib/food-conta.ts](../../lib/food-conta.ts) e a ação `divisao` no
celular. Três jeitos: igual entre os celulares da mesa, por pessoa (usando o
`membro_id` do item, que era gravado e nunca lido) e por item.

O valor de "pagar estes itens" é calculado **no servidor** a partir dos ids: o
navegador diz quais itens, nunca quanto. `food_pagamento_itens` amarra o
pagamento aos itens, para a mesma rodada não ser paga duas vezes.

### B3.4. Teste de vazamento entre clientes
**Onde**: [db/testes/isolamento.mjs](../../db/testes/isolamento.mjs), em duas
partes:
1. **dinâmica**: dois restaurantes no mesmo banco, e cada operação do módulo é
   tentada com o id do vizinho, esperando falha. Depois confere que nada do
   vizinho foi tocado e que o dono da casa continua trabalhando;
2. **estática**: varre `lib/food*.ts` atrás de `UPDATE` e `DELETE` em tabela
   `food_` sem filtro de dono. Toda exceção precisa estar declarada com motivo
   escrito. É o que pega o `AND negocio_id` esquecido daqui a três meses, que
   nenhum teste de fluxo pegaria.

### B8.2 e B8.3. Validação de entrada e log estruturado
- [lib/food-validar.ts](../../lib/food-validar.ts): texto com teto, número com
  faixa, dinheiro sem negativo, uuid, escolha em lista fechada. Sem dependência
  nova. `Number(body.valor)` de um texto não vira mais `NaN` no banco.
- [lib/log.ts](../../lib/log.ts): uma linha JSON por evento no stdout, que o
  Docker e o Coolify já coletam, com telefone, CPF, e-mail, token e senha
  cortados na saída. **O erro cru do banco parou de ir para a tela do cliente**:
  agora fica no log e o navegador recebe uma frase.

### Ainda de quebra
- `confirmarJob()` passou a exigir a **chave da impressora**: antes, quem
  descobrisse um uuid de job marcava a comanda de outro restaurante como
  impressa e ela sumia da fila da cozinha.
- Faixa de horário que **atravessa a meia-noite** (bar que abre 18h e fecha 2h)
  agora conta como aberta, e a madrugada pertence ao turno do dia anterior.

---

## Rodada 4

### O link do tablet deixou de ser a senha
**Antes**: o token do aparelho viajava na URL (`/k/<token>`). Isso quer dizer que
ele ficava no histórico do navegador, aparecia em qualquer print da tela e ia
embora com quem olhasse a barra de endereço por cima do ombro. Era a credencial
da casa inteira passeando à vista.

**Agora** ([lib/food-dispositivo.ts](../../lib/food-dispositivo.ts) e
[db/migration_0008_dispositivos.sql](../../db/migration_0008_dispositivos.sql)),
o modelo é o de **pareamento**, que é o que as casas grandes fazem:

1. o dono gera o link na configuração e abre **uma vez** no tablet;
2. o servidor casa o aparelho, grava um segredo e devolve um passe em cookie
   httpOnly de um ano;
3. **o link morre nesse instante**. Quem fotografar a tela depois leva um
   endereço morto, e a resposta diz exatamente isso: "este link já foi usado
   para parear outro aparelho";
4. o dono vê no painel quando cada aparelho pareou e de qual IP, e **despareia
   com um toque**. Desparear troca o segredo, e todo cookie daquele aparelho
   morre junto. É o botão de "perdi o tablet" e o de "o garçom levou o tablet
   para casa";
5. parear só acontece ao **abrir a tela**. Nenhuma ação de escrita casa aparelho,
   para o passe nunca se perder no meio de uma operação.

Tudo isso sem a cozinha ver tela de login uma vez sequer, que é o requisito que
faz qualquer KDS ser abandonado no primeiro sábado cheio.

Junto: `food_dispositivo_acessos` guarda quem pareou, de onde, quando, e as
tentativas recusadas. E o KDS ganhou rate limit próprio (300 por minuto por
aparelho), que faltava.

### Como fica a segurança, camada por camada

| Quem | O que prova quem é | O que acontece se vazar |
|---|---|---|
| Dono e operador | e-mail e senha, cookie JWT httpOnly | trocar a senha derruba tudo |
| Aparelho (cozinha, garçom) | pareamento em cookie httpOnly, segredo por aparelho | desparear mata na hora, sem mexer nos outros |
| Pessoa da equipe | PIN de 4 dígitos abrindo turno, papel vindo do banco | fechar o turno, e o papel limita o estrago |
| Cliente na mesa | passe da comanda em cookie httpOnly, emitido pelo cartão | morre quando a conta fecha |
| Impressora | chave própria na URL, que só entrega texto de comanda | gerar chave nova |

Cada um tem a sua credencial e o seu alcance. Não existe uma senha única que,
vazando, abra a casa inteira, que era exatamente a pergunta certa a fazer.

---

## O que continua aberto

| Item | Severidade | Por que não foi agora |
|---|---|---|
| B6.6 NFC-e e fila de contingência | P0 para vender | A fila já existe (`food_fiscal_fila`); falta o integrador (Focus NFe) e um cliente pedindo |
| B3.3 Row Level Security no Postgres | P1 | Decisão sua: hoje o teste de isolamento cobre o risco por bem menos |
| B8.3 Monitoramento (Sentry ou equivalente) | P2 | O log estruturado existe; falta alguém escutando |
