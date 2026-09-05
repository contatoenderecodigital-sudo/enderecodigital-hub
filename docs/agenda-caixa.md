# Conferência diária do caixa

A rota `/painel/caixa` faz uma leitura das comandas existentes do módulo Agenda.
O negócio vem da sessão com `activeNegocioId`; a tela e o link de navegação
exigem Agenda habilitada na combinação negócio/hub.

## Valores exibidos

- A data selecionada usa o fuso `America/Sao_Paulo`. O filtro considera
  `fechada_em` a partir da meia-noite inclusive até a meia-noite seguinte exclusiva.
- Somente comandas com status atual `fechada` compõem os totais. Os descontos
  já estão incorporados em `total_cent` e não são subtraídos novamente.
- Total e taxas aparecem por forma de pagamento, incluindo fiado, pacote,
  cortesia e pagamento não informado.
- Recebimento após taxas soma dinheiro, Pix, débito e crédito, subtraindo
  apenas as taxas desses grupos. É uma estimativa pelas comandas; não comprova
  liquidação bancária e não representa lucro.
- Comandas ainda abertas, criadas até o dia consultado, aparecem como pendência
  e ficam fora dos totais. Esse aviso mostra o estado atual, inclusive quando
  a data consultada está no passado.

## Limites

O schema disponível não oferece um registro próprio de fechamento diário,
contagem de dinheiro, fundo de abertura, sangrias, suprimentos ou reabertura.
A tela informa explicitamente que é uma conferência, sem botão que simule
persistência. Alterações e cancelamentos posteriores mudam a consulta.

Não foi criada nem aplicada migration. A função `conferirCaixaDoDia` executa
somente SELECT e não inicializa configurações nem altera comandas.

## Verificação local

```text
node node_modules/typescript/bin/tsc --noEmit --incremental false
node --test testes/agenda-caixa.test.mjs testes/agenda.test.mjs testes/agenda-produtos.test.mjs
```

Os testes usam banco simulado, sem conexão externa. Cobrem os totais por forma,
taxas, desconto já aplicado, estados de comanda, datas inválidas, tenant e acesso
condicionado ao módulo. A consulta deve ser validada com dados de homologação
antes de publicação; não houve consulta a banco real durante esta implementação.
