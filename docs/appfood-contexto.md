# AppFood: contexto do projeto

Documento de passagem de bastão. Serve para outra IA (ou para mim mesmo depois
de um contexto compactado) entender o que é isto, por que foi feito assim e o
que ainda falta, sem precisar reler o código todo.

Detalhe operacional (URLs, protocolo da impressora, planos) está em
[`appfood.md`](appfood.md). Aqui está o porquê.

---

## 1. Quem manda e o que ele quer

O dono é o **Sandro**, da **Endereço Digital**. "Eliezer" é só o nome da conta
do Windows e nunca aparece em texto de cliente. Ele vende presença digital para
negócio local e está montando um hub white-label próprio.

O AppFood é o módulo de restaurante desse hub. A ideia partiu de uma referência
(expressodelivery.com.br) e de uma vontade específica dele: **vender um cartão
de aproximação (NFC) com a marca do restaurante**, que o cliente encosta o
celular e cai no cardápio da casa. O cartão é o que fecha a venda, porque é a
única parte que o dono pega na mão.

**Mercado**: bares, pizzarias e lanchonetes de **Xanxerê e Chapecó**, oeste
catarinense. Venda pessoal, na loja, com o cartão gravado e o cardápio dele já
montado. Sem campanha de marketing. Concorrentes de praça: Xpertus (Xanxerê) e
Abrahão (Chapecó); nacionais: Goomer, Anota AI, Saipos.

O plano comercial (planos, preços para a região, objeções, referências
internacionais como me&u, sunday, Toast, Owner.com) está em
`Desktop\appfood\PLANO-APPFOOD.md`, fora deste repositório.

### Como escrever para ele
Sem emoji e sem travessão, sempre. Em texto de cliente, quem tem credencial é a
empresa, não o Sandro. Regras completas no `~/.claude/CLAUDE.md` dele.

---

## 2. Onde o código vive

**Tudo dentro deste repositório** (`enderecodigital-hub`), como módulo do hub.
A pasta `Desktop\appfood` guarda só o plano comercial. Se alguém procurar o
sistema lá, não vai achar.

O módulo não é um app separado de propósito: o hub já tinha multi-tenant sério
(`negocios` + `negocio_id` em tudo), branding por cliente, super admin com
impersonação e WhatsApp oficial multi-tenant. Fazer fora seria refazer tudo isso
pior.

### Mapa

| Arquivo | O que é |
|---|---|
| `db/migration_0003_food.sql` | schema principal (mesas, cardápio, pedidos, caixa, impressão, estoque) |
| `db/migration_0004_food_edicao.sql` | fotos no banco, bairros de entrega, status `em_entrega` |
| `db/migration_0005_kds.sql` | eventos de transicao, meta de tempo, estados da comanda, fila fiscal, idempotencia do pedido |
| `db/instalar-food.mjs` | aplica as migrations em transação; `--demo` cria o cliente de demonstração |
| `db/testes/estrutura.mjs` e `operacao.mjs` | Postgres em memória (PGlite), não tocam no banco real |
| `db/testes/fluxo-real.mjs` | ponta a ponta contra o app rodando |
| `db/testes/kds.mjs` | 58 checagens da maquina de estados (transicao invalida, idempotencia, desfazer, reconexao) |
| `lib/food.ts` | núcleo: mesas, cardápio, sessão, pedido, KDS, pagamento, impressão, estoque |
| `lib/food-edicao.ts` | o que o dono edita: renomear, reordenar, apagar, horário, bairro, foto |
| `lib/food-auth.ts` | quem pode operar qual negócio |
| `lib/food-pix.ts` | cobrança Pix (Mercado Pago) com credencial por loja |
| `lib/food-eventos.ts` | fila de eventos vira mensagem no WhatsApp oficial |
| `lib/food-kds-sql.ts` | a maquina de estados do item e da comanda (sem import de runtime, para o teste rodar contra Postgres em memoria) |
| `lib/food-kds.ts` | o embrulho da maquina de estados com o pool do app |
| `app/api/food/*` | publico (mesa e delivery), painel, kds, garcom, print, webhook, midia, eventos |
| `app/c/[slug]/*` | cardápio, mesa por NFC, pedido online |
| `app/k/[token]`, `app/g/[token]` | cozinha e garçom, sem login |
| `app/food/[neg]/*` | painel do dono |
| `components/food/*` | as telas |

---

## 3. As regras que não podem ser quebradas

Se mexer no módulo, estas são as decisões que sustentam o resto:

1. **`negocio_id` em toda tabela e em toda consulta.** O isolamento é em código,
   não na confiança. Nenhuma função de leitura aceita id de loja vindo do
   navegador sem antes resolver por slug ou token.
2. **Preço vem do banco, nunca do cliente.** O navegador manda só ids e
   quantidade. Já existe teste que envia preço forjado e confere que é ignorado.
3. **O que já foi vendido nunca é apagado.** Produto, categoria ou mesa com
   histórico vira inativo. Senão o relatório de ontem muda quando o dono mexe no
   cardápio hoje.
4. **Uma comanda viva por mesa**, garantido por índice parcial único no banco
   (`uq_food_sessao_viva`), não por `if` no código. Dois celulares encostando ao
   mesmo tempo não criam duas contas.
5. **Token de mesa é opaco e aleatório.** Nunca 1, 2, 3, senão qualquer um pede
   da calçada. Trocar o token mata o cartão antigo na hora.
6. **Credencial nao mora na URL.** O link do tablet (`/k/<token>`) serve UMA vez,
   para parear o aparelho; dali em diante quem autoriza e o cookie do aparelho.
   Nao volte a aceitar token de URL em acao de escrita.
7. **Cliente final não tem login, mas tem PASSE.** O token do cartão serve para
   ENTRAR; entrar emite um passe em cookie httpOnly (`lib/food-mesa-passe.ts`)
   amarrado a mesa, comanda e celular, e e ele que autoriza pedir, chamar e
   pagar. Comanda nova so nasce com a casa aberta. Quando a conta fecha, o passe
   morre sozinho, porque o id da comanda esta dentro dele. Nao volte a aceitar
   `membroId` vindo do corpo da requisicao.
8. **Dinheiro que nao entrou e do gerente.** Cortesia, desconto, fechar conta
   devendo e cancelar prato que ja esta na chapa exigem turno aberto com papel
   `gerente` (`lib/food-permissoes.ts`). O `garcomId` nunca mais vem do corpo da
   requisicao: vem do turno.
9. **Status de item so muda pela maquina de estados.** `moverItem()` de
   `lib/food-kds-sql.ts` valida a transicao, e idempotente e grava quem, quando
   e de onde em `food_item_eventos`. Nao existe `UPDATE food_itens SET status`
   em nenhum outro lugar, e nao pode voltar a existir: e isso que sustenta o
   relatorio de tempo e a resposta para "quem cancelou a picanha".
10. **Credencial de terceiro fica cifrada** (`lib/cofre.ts`, env `SENHAS_CHAVE`) e
   nunca volta para a tela.

---

## 4. Decisões e o porquê

**Impressão sem PC na loja.** A impressora (Star CloudPRNT ou Epson Server
Direct Print) pergunta ao servidor se tem comanda, baixa e confirma. Funciona
atrás de qualquer roteador, sem VPN e sem máquina no local. O agente local só
existe para impressora antiga que o cliente já tem. E o padrão de venda é o KDS
na tela, que custa zero.

**Pedido online entra pendente.** Delivery e WhatsApp esperam a loja aceitar
antes de ir para a cozinha: endereço e tempo precisam ser conferidos. Pedido de
mesa entra direto, a não ser que o dono ligue a aprovação do garçom.

**Taxa de entrega vem do bairro cadastrado.** Nunca do navegador. Sem bairro
cadastrado, o pedido é recusado em vez de sair com frete errado.

**Pix é do restaurante.** A credencial do PSP é por loja, cifrada, e o dinheiro
cai na conta dele. A Endereço Digital não fica no meio do fluxo financeiro. E o
webhook do PSP não é prova de nada: o servidor pergunta à API do provedor antes
de baixar a conta.

**WhatsApp por fila.** O módulo só grava o fato em `food_eventos`; quem dispara
é `lib/food-eventos.ts` pelo cron. Assim, trocar o canal ou desligar o disparo
não mexe na operação. Só sai mensagem para quem tem opt-in, porque fora da
janela de 24 horas a Meta exige template aprovado.

**Fiscal foi feito na rodada 5.** O texto abaixo fica como registro do porque da
decisao original; hoje a emissao existe, testada em homologacao, e o que falta e
a conta no integrador.

**Fiscal ficou fora do MVP.** Em SC é NFC-e (SAT é só São Paulo), a nota sai no
CNPJ do restaurante com o certificado A1 dele, e se integra por API (Focus NFe a
R$ 59,90 por CNPJ). Os campos existem no banco; falta plugar quando houver
cliente pedindo. Detalhe em `appfood.md`, seção 9.

**Foto no banco, não em disco.** O deploy é container; disco não sobrevive. O
navegador redimensiona antes de enviar, então o peso é pequeno, e a imagem é
servida por `/api/food/midia/<id>` com cache eterno (trocar a foto cria outro
id).

---

## 5. Estado em 2026-09-01

**Instalado no banco de produção do hub**: 29 tabelas `food_*`. Os dois clientes
reais (Padaria Doce Pão e Lançar Veículos) não foram alterados, só ganharam a
coluna `mod_food`.

**Cliente de demonstração criado**: `appfood-demo`, com Boteco Demonstração em
Xanxerê, cardápio, 10 mesas, tablets, impressora, bairros e garçom com PIN 1234.
Apagar com `DELETE FROM negocios WHERE slug = 'appfood-demo'`.

**Testado**: `npm run test:food` (estrutura e regras, Postgres em memória) e
`npm run test:fluxo` (23 checagens contra o app rodando, incluindo a impressora
pelo protocolo real e o PIN do garçom). Todos passaram.

**KDS em Kanban entregue (01/09/2026)**: maquina de estados validada e auditada,
endpoints idempotentes, canal SSE com fetch completo a cada reconexao, tela da
cozinha em Kanban de item com offline, som, desfazer e botao 86, e o painel do
salao consumindo o mesmo estado. Detalhe em `docs/kds/01-implementado.md`.
**As migracoes 0005 e 0006 ainda precisam ser aplicadas no banco**
(`npm run food:instalar`).

**Rodada 5**: NFC-e completa (Focus NFe), com fila de contingencia que insiste
sozinha, cancelamento com justificativa, CPF na nota conferido digito a digito e
tela propria no painel. Mais relatorios de tempo por praca, cardapio por
horario, cupom, avaliacao com empurrao para o Google e fidelidade por pontos.

**Rodada 4 (mesmo dia)**: o link do tablet virou PAREAMENTO. O token da URL
serve uma vez, casa o aparelho, devolve cookie httpOnly de um ano e morre. O
dono despareia pelo painel e derruba o tablet perdido na hora. Nenhuma acao de
escrita pareia: so o abrir da tela.

**Rodada 3 (mesmo dia)**: PIN do garcom virou TURNO com papel valendo no
servidor (cortesia, desconto e fechar devendo sao do gerente), desconto com
motivo e autor, taxa de servico recusavel (Lei 13.419), alergenicos no cardapio
e na cozinha (RDC 727), divisao de conta por pessoa e por item, teste de
vazamento entre clientes, validacao de entrada e log estruturado.

**Rodada 2 (mesmo dia)**: passe de sessao de mesa, rate limit no endpoint
publico, fuso da casa (o banco roda em UTC e virava o dia as 21h de Xanxere),
idempotencia do pedido e as regras do cardapio (obrigatorio, maximo, meia a
meia) valendo no servidor. Detalhe em `docs/auditoria/03-corrigido.md`.

**Auditoria tecnica (01/09/2026)**: `docs/auditoria/`, com inventario, as lacunas
item a item e o plano. Os P0 que continuam abertos: token de sessao de mesa,
rate limit no endpoint publico e o fuso do banco em UTC contra a casa em BRT.

**Falta**:
1. **Deploy.** O código está commitado apenas na máquina do Sandro; o hub em
   produção só mostra as telas depois de push para o GitHub (branch `main`,
   deploy pelo Coolify). Não faço push sem ele pedir.
2. Fiscal (NFC-e).
3. Marketplaces (iFood exige homologação como parceiro).
4. Passada de design. As telas estão cruas por decisão dele: primeiro função,
   depois estética.

---

## 6. Como rodar

```
npm install
npm run dev                                   # sobe local lendo o .env.local
npm run test:food                             # não toca no banco
npm run test:fluxo -- http://localhost:3010   # ponta a ponta, precisa do app no ar
npm run food:instalar                         # aplica as migrations em outro ambiente
```

Login do hub: `/login`, com email e senha. O owner é
`contato@enderecodigital.com`. A senha foi definida no bootstrap do servidor e
não está no `.env.local` local. Se ela se perder, dá para gerar um hash novo com
`bcryptjs` e atualizar `usuarios.senha_hash`.

O dono de um restaurante loga e cai direto em `/food/<negocio_id>` quando o
módulo está ligado para ele (`app/page.tsx`).

---

## 7. Armadilhas já conhecidas

- **Heredoc no Bash desta máquina quebra** quando o conteúdo tem aspas simples
  (SQL). Escrever arquivo com a ferramenta de escrita ou por script Python.
- **PGlite não tem pgcrypto.** Os testes removem o `CREATE EXTENSION` e usam
  `gen_random_uuid()`, que é nativo. No Postgres de verdade a extensão existe.
- **A fila de impressão é FIFO por impressora.** Ao testar, esvazie antes de
  medir, senão você pega a comanda de uma rodada anterior e acha que é bug.
- **`.env.local` aponta para o banco real** por um túnel em `127.0.0.1:5433`.
  Qualquer script que rode aqui está mexendo em produção.
- O `middleware.ts` do Next está marcado como depreciado pela versão nova
  (pede `proxy`). Ainda funciona; quando migrar, lembrar de manter as rotas
  públicas do AppFood liberadas.
