# Testar o AppFood inteiro, na mão

Roteiro para conferir tudo clicando, na ordem em que uma noite acontece de
verdade. Cada item diz o que tem que acontecer. Se algo sair diferente, é bug.

Antes de começar: o túnel do banco tem que estar de pé (`127.0.0.1:5433`), e o
app rodando (`npm run dev`). O endereço abaixo usa a porta 3002; ajuste se o
Next escolher outra.

## 0. O automático, que não precisa de você

```
npm run test:food                          # 195 checagens, sem rede, sem banco de produção
npm run test:fluxo -- http://localhost:3002  # 32 checagens contra o app no ar
```

O primeiro roda em Postgres em memória e cobre a máquina de estados, as regras
do cardápio, permissões, fuso, cupom, avaliação, fidelidade e o teste de
vazamento entre clientes. O segundo simula a noite inteira pela API.

---

## 1. O dono monta a casa

Abra `/food/b5ddf221-949d-4c6e-8659-9a94665702b3`.

- [ ] **Salão** mostra o mapa de mesas, o resumo do dia e o bloco "Cozinha
      agora" com a fila por praça
- [ ] **Cardápio**: crie um produto, ponha foto, marque alergênicos (glúten,
      lactose) e uma marca positiva (sem lactose). A foto tem que **aparecer**,
      não dar erro
- [ ] Ainda no cardápio: numa categoria, ponha horário de 07:00 às 10:30 e
      confira que ela **some** do cardápio do cliente fora desse horário
- [ ] **Mesas e cartões**: gere as mesas, veja o link de cada cartão
- [ ] **Configuração**: em "Telas da cozinha e do garçom", clique em
      **Parear aparelho** e copie o link
- [ ] **Marketing**: ponha o link do seu Google, crie um cupom `VOLTA10` de 10%
      com teto de R$ 15, e ligue o programa de pontos

## 2. A cozinha entra

- [ ] Abra o link do tablet da cozinha **uma vez**. A tela abre sem login
- [ ] Abra o **mesmo link** de novo, em outra aba: tem que dizer que o link já
      foi usado. É o pareamento funcionando: a credencial saiu da URL
- [ ] No painel, em Configuração, o aparelho aparece como pareado, com o IP
- [ ] Clique em **Desparear** e recarregue o tablet: ele para de funcionar na
      hora

## 3. O cliente na mesa

Abra o link da mesa no celular (ou em outra janela do navegador).

- [ ] O cardápio abre com a marca da casa e com as fotos
- [ ] Abra um produto: o bloco "contém" aparece com os alergênicos, e existe um
      campo próprio de **alergia**
- [ ] Se o produto tem grupo obrigatório, o botão só libera depois de escolher
- [ ] Mande um pedido com uma alergia escrita
- [ ] Abra a mesma mesa em **outra janela**: cai na mesma comanda
- [ ] Toque em "tem cupom" e use o `VOLTA10`: o desconto aparece na conta
- [ ] Ponha seu telefone em "Sou eu": aparece seu saldo de pontos
- [ ] Na conta, toque em **não quero** ao lado da taxa de serviço: ela zera. É a
      Lei 13.419, e o cliente pode recusar
- [ ] Toque em **Dividir a conta**: aparece igual entre todos e por pessoa

## 4. A cozinha trabalha

- [ ] O pedido aparece no KDS em segundos, sem recarregar a página
- [ ] O cartão mostra a **alergia em faixa vermelha** e os alergênicos do produto
- [ ] O cartão fica verde, depois âmbar, depois vermelho conforme o relógio
      passa da meta da praça
- [ ] Toque em **Fazendo** e depois em **Pronto**. A faixa de desfazer aparece
      por 10 segundos
- [ ] Toque em **Desfazer**: o item volta
- [ ] Tente cancelar um item: **exige motivo**
- [ ] Toque em **86** num produto: ele some do cardápio do celular que está
      aberto, em até 10 segundos, sem recarregar
- [ ] **Desligue o wifi do tablet**: aparece a faixa "sem conexão, N ações
      pendentes", e a tela continua funcionando. Religue: as ações sobem sozinhas
- [ ] Filtre por praça: o filtro fica salvo naquele aparelho

## 5. O garçom fecha

- [ ] Abra o tablet do garçom e entre com o PIN (1234 na demonstração)
- [ ] Sem PIN, nenhuma ação de dinheiro passa
- [ ] Tente dar **cortesia** como garçom: recusado, é do gerente
- [ ] Receba o pagamento e feche a conta
- [ ] Feche uma conta com saldo em aberto: **exige motivo**, e o valor que
      faltou fica gravado
- [ ] Como gerente, dê um desconto: exige motivo e fica no seu nome

## 6. Na hora que a conta fecha

- [ ] No celular do cliente, aparece **"Como foi?"** com as notas de 1 a 5
- [ ] Dê 5: aparece o convite para avaliar no **Google**
- [ ] Dê 2: **não** vai para o Google, pede o que houve, e vira alerta no painel
- [ ] Em Marketing, a nota aparece na lista, e a queixa mais comum aparece
      agrupada

## 7. Delivery

- [ ] Abra `/c/boteco-demo/pedir`, monte um pedido, escolha o bairro
- [ ] A taxa vem do bairro cadastrado, nunca do navegador
- [ ] O pedido entra **pendente**, esperando a casa aceitar
- [ ] Em Delivery, aceite e despache

## 8. Nota fiscal (NFC-e)

Em **Nota fiscal**, com o ambiente em **homologação** (nota de teste, não vale
para o fisco):

- [ ] Preencha CNPJ, razão social, inscrição estadual, regime e a série
- [ ] Cole o token do integrador. Ele some da tela depois de salvo, e fica
      cifrado no banco
- [ ] Ligue "Emitir NFC-e"
- [ ] No celular, antes de fechar, o cliente põe o **CPF na nota**. CPF errado é
      recusado na hora, com os dígitos conferidos
- [ ] Feche uma conta: a nota entra na fila
- [ ] A fila roda sozinha. Force com
      `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3002/api/food/fiscal`
- [ ] Autorizada: aparece o número, e o botão **Ver nota** abre o documento
- [ ] Com erro: aparece a mensagem da SEFAZ, em português, e o botão de tentar
      de novo
- [ ] **Desligue a internet e feche uma conta**: a venda fecha do mesmo jeito e a
      nota fica na fila. É a contingência: SEFAZ fora do ar não segura a mesa
- [ ] Cancele uma nota autorizada: exige justificativa de 15 letras, que é o que
      a SEFAZ pede

## 9. Relatórios

- [ ] Em **Relatórios**, veja tempo por praça: espera, preparo, o pior décimo e
      quantos estouraram a meta
- [ ] A curva do dia mostra onde a casa fatura
- [ ] Mais cancelados mostra o **motivo** e **quem** cancelou
- [ ] "Quem trabalhou" mostra toques na cozinha e dinheiro recebido por pessoa

## 10. As travas, se quiser tentar quebrar

- [ ] Copie a URL da mesa e abra numa janela anônima **sem passar pelo cartão**:
      dá para ver o cardápio, mas **pedir dá 401**
- [ ] Mande o mesmo pedido duas vezes rápido: o sistema devolve o **mesmo**
      pedido, não dois
- [ ] Mande um preço no corpo da requisição: é ignorado, vale o do cardápio
- [ ] Fora do horário da casa, o cartão abre o cardápio mas **não abre comanda**

---

## O que ainda não existe, e por quê

| O quê | Situação |
|---|---|
| **NFC-e em produção** | Está pronto e testado em homologação. Para valer de verdade falta o que só você contrata: conta no Focus NFe (cerca de R$ 60 por CNPJ) e o certificado A1 da casa subido lá |
| **Totem de autoatendimento** | A tela da mesa serve de base, falta o modo quiosque |
| **iFood, Rappi** | Exige homologação como parceiro |
| **Combos** | Cupom e promoção por horário existem; combo montado (leve 3 pague 2) não |
| **Monitoramento** | O log estruturado sai no stdout. Falta alguém escutando (Sentry ou equivalente) |
| **Row Level Security** | O isolamento é código mais teste automático. RLS no banco é decisão de arquitetura |
