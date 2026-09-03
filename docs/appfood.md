# AppFood — módulo de restaurante do hub

Cada cliente é um `negocio` do hub. O módulo liga por cliente (`negocios.mod_food`,
com o default vindo de `hubs.mod_food`), igual a Site, Instagram e CRM. O cliente
final não faz login: a autorização dele é o token do cartão da mesa.

---

## 1. Subir

Ja instalado no banco do hub em 2026-09-01 (29 tabelas `food_*`) junto com o
cliente de demonstracao `appfood-demo`. Para instalar em outro ambiente:

```
npm run food:instalar          # so as tabelas, nao mexe em dado nenhum
node db/instalar-food.mjs --demo   # tabelas + cliente de demonstracao com cardapio e 10 mesas
```

As migrations sao idempotentes e rodam em transacao: rodar de novo nao quebra e,
se falhar no meio, nao grava nada.

Tres formas de conferir:

```
npm run test:food                                  # Postgres em memoria, nao toca no banco
npm run test:fluxo -- http://localhost:3010        # app rodando de verdade, ponta a ponta
```

O `test:food` valida estrutura e regras (numero de pedido, comanda unica por
mesa, fila da impressora, conta com servico, ficha tecnica, horario). O
`test:fluxo` faz a noite inteira contra o app: cliente encosta o celular, pede,
a cozinha ve, a impressora puxa a comanda, o garcom entra com PIN e fecha a
conta, e um pedido de delivery entra pelo link.

### Loja de demonstracao ja criada

Cliente `AppFood Demonstracao` (slug `appfood-demo`), separado dos clientes
reais. Boteco Demonstracao, em Xanxere: 3 categorias, 5 produtos com tamanho e
adicional, 10 mesas, dois tablets de cozinha, um de garcom (PIN 1234), uma
impressora e dois bairros de entrega. Para tirar do ar depois:

```sql
DELETE FROM negocios WHERE slug = 'appfood-demo';  -- leva junto tudo do demo
```

## 2. Quem entra por onde

| Quem | URL | Autorização |
|---|---|---|
| Cliente na mesa | `/c/<slug>/m/<token>` | token do cartão NFC |
| Pedido online (delivery e retirada) | `/c/<slug>/pedir` | pública |
| Cardápio de vitrine (bio do Instagram) | `/c/<slug>` | pública |
| Cozinha | `/k/<token-do-tablet>` | token do tablet |
| Garçom | `/g/<token-do-tablet>` | token do tablet + PIN da pessoa |
| Dono e gerente | `/food/<negocio_id>` | login do hub |
| Impressora | `/api/food/print/<chave>` | chave da impressora |
| Webhook do Pix | `/api/food/webhook/mercadopago` | conferido na API do PSP |
| Fila de avisos (cron) | `/api/food/eventos` | `CRON_SECRET` ou owner |

O dono do restaurante loga no hub e cai direto no painel (`app/page.tsx` manda
`dono` e `operador` para `/food/<negocio_id>` quando o módulo está ligado).
No console do owner, a página do cliente tem o botão **Restaurante**.

Abas do painel: Salão, Mesas e cartões, Cardápio, Delivery, Caixa, Estoque,
Configuração.

## 3. O que o DONO edita sozinho

Tudo. Não precisa da agência para nada do dia a dia:

- **Loja**: nome, tipo, endereço, telefone, WhatsApp, cor da marca e logo (upload).
- **Cardápio**: criar e renomear categoria, criar e editar produto, mudar preço,
  subir e descer na ordem, esconder, marcar "acabou", apagar, trocar a foto pelo
  celular, tamanhos (300ml, G, M) e grupos de adicionais com preço.
- **Mesas**: criar em lote, renomear, apelido, lugares, setor, desativar, apagar,
  gerar token novo quando um cartão some.
- **Regras da mesa**: aprovação do garçom, limite por mesa, taxa de serviço,
  couvert, tempo de preparo, aceitar mesa, balcão, delivery e retirada.
- **Horário de funcionamento** por dia da semana, com "forçar aberta" e
  "forçar fechada" ganhando do horário.
- **Áreas de produção**, **impressoras** (com a URL do CloudPRNT para copiar) e
  **tablets** (renomear, ligar, desligar, gerar link novo).
- **Equipe**: criar, mudar papel, trocar PIN, desligar.
- **Bairros de entrega** com taxa e tempo.
- **Pagamento**: ligar o Pix no celular e colar a credencial do PSP.

Regra que vale para tudo: o que já foi vendido nunca some. Produto, categoria ou
mesa com histórico é **desativado**, não apagado, senão o relatório de ontem
muda sozinho.

## 4. O cartão NFC

1. Em `/food/<neg>/mesas`, crie as mesas e copie a URL de cada uma.
2. Grave no chip **NTAG213** um registro **NDEF do tipo URL** com essa URL
   (NFC Tools no celular, ou gravadora ACR122U em lote).
3. **Trave o NDEF** depois de gravar.
4. Imprima o mesmo endereço como QR no verso: iPhone antigo e Android com NFC
   desligado não leem o chip.
5. Cartão perdido: "Novo token" mata o antigo na hora.

## 5. Impressão na cozinha

Três caminhos, mesma fila (`food_print_jobs`):

1. **KDS na tela** (padrão, custo zero): tablet em `/k/<token>`.
2. **Star CloudPRNT / Epson Server Direct Print**: cole na impressora
   `https://<host>/api/food/print/<chave>`. Ela pergunta sozinha se tem trabalho
   (POST), baixa o texto (GET) e confirma (DELETE). Sem PC, sem VPN.
3. **Agente local** para impressora antiga: `GET .../print/<chave>?formato=json`
   devolve `{ id, conteudo }`, o agente manda ESC/POS na porta 9100 e confirma
   em `POST .../print/<chave>?formato=json` com `{ id, ok }`.

Impressora com área recebe só os itens daquela área. Sem área, a comanda inteira.

## 6. Delivery e pedido online

- O link `/c/<slug>/pedir` é o canal próprio do restaurante: cardápio, carrinho,
  entrega ou retirada, bairro com taxa, endereço, forma de pagamento e troco.
- A taxa vem sempre do bairro cadastrado, nunca do navegador.
- Todo pedido online entra como **pendente**: a loja aceita antes de a cozinha
  começar. Só depois de aceito é que imprime e baixa estoque.
- Na aba Delivery: aceitar, marcar pronto, escolher quem leva, "saiu para
  entrega" e "entregue". O despacho dispara o aviso no WhatsApp.
- O cliente vira cadastro (`food_clientes`) com opt-in, alimentando o CRM.

## 7. Pagamento pelo celular

- Ligue na Configuração, escolha Mercado Pago e cole o access token do
  RESTAURANTE. Fica cifrado (`lib/cofre.ts`, env `SENHAS_CHAVE`) e não volta
  para a tela. O dinheiro cai na conta dele.
- Na mesa: "Pagar tudo" e, com mais de um celular na comanda, "Pagar só a minha
  parte". O copia e cola aparece na hora.
- O webhook confere na API do PSP antes de baixar a conta.
- Sem PSP, o pagamento fica pendente e o caixa confirma na mão. Nada quebra.

## 8. Avisos no WhatsApp

O módulo não envia nada sozinho: grava em `food_eventos`. O processador
(`lib/food-eventos.ts`) lê a fila e dispara pela Cloud API oficial:

```
* * * * * curl -s -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/food/eventos
```

Só sai mensagem para quem tem telefone e opt-in (delivery e pedido pelo zap).
Cliente de mesa não recebe nada: fora da janela de 24 horas a Meta só aceita
template aprovado.

## 9. Nota fiscal (NFC-e)

- Em Santa Catarina é **NFC-e**. O SAT/CF-e é só São Paulo, então, atendendo o
  oeste catarinense, é uma regra só para todos os clientes.
- A nota sai **no CNPJ do restaurante**, com o **certificado A1 dele** (R$ 150 a
  R$ 250 por ano) e o **CSC** gerado no SEF de SC, mais o credenciamento.
- Você **não homologa nada**: integra uma API.
- Custo real (Focus NFe, tabela pública): **Varejo NFC-e R$ 59,90/mês por CNPJ**
  com 500 notas e R$ 0,05 na extra; Solo R$ 89,90; **Retail+ R$ 629,90 com CNPJs
  ilimitados**. Com poucos clientes, um plano por loja repassado no contrato.
- **Fora do MVP.** Os campos existem (`food_lojas.fiscal_*`,
  `food_pedidos.nfce_*`); falta plugar a API quando houver cliente pedindo.

## 10. Estado

Pronto e testado: schema (26 tabelas), camada de dados, cinco APIs (mesa,
painel, cozinha, garçom, pública de delivery), fila de impressão com CloudPRNT e
agente, Pix com webhook, fila de avisos, e as telas: criar loja, mesa no celular,
pedido online, cardápio de vitrine, KDS, app do garçom com PIN, painel do salão,
mesas e cartões, cardápio, delivery, caixa, estoque com ficha técnica e CMV e
configuração completa.

Falta: fiscal (seção 9), marketplaces (iFood exige homologação como parceiro) e
a passada de design.
