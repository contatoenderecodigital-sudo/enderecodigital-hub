# Módulo Agenda

Produto: **MeuBarbeiro** (nome provisório).

Sistema de agendamento e operação para negócio que vende hora de profissional.
Ligado por cliente pela coluna `negocios.mod_agenda`, igual a Site, Instagram,
CRM, Financeiro e Veículos.

**Primeiro nicho: barbearia.** Alvo declarado: substituir o AppBarber na loja do
cliente, não conviver com ele.

O plano de produto, com o mapa funcionalidade a funcionalidade contra o
AppBarber e o que a gente recusa construir, vive em
`Desktop\EnderecoDigital\sistema\barbeiro\doc\plano-produto.md`.

## Por que Agenda e não Barbearia

Nenhuma tabela aqui fala de cabelo. `profissionais`, `servicos`,
`agendamentos`, `comandas` servem igual para estética, clínica, manicure e
nutrição, nichos que a Endereço Digital já atende. Nomear pelo primeiro cliente
obrigaria uma migration nova pro segundo, sem ganhar nada.

Barbearia é o nicho que define o vocabulário das telas: cadeira, comanda,
comissão.

## Toda tabela leva o prefixo `agenda_`

Não é gosto. A primeira versão usava `clientes`, `servicos`, `produtos`,
`comandas`, e a migration morreu na primeira execução: **já existe uma
`public.clientes`** no banco, vinda do sistema da padaria.

O banco está à frente do repositório. Além dessa, há 46 tabelas `food_*` que não
aparecem em migration nenhuma, e mais três schemas (`docepao`, `docepao_teste`,
`groow`). Confiar nos arquivos `.sql` do repositório para saber o que existe é
como confiar no mapa em vez de olhar pela janela.

Nomes genéricos são exatamente os que o próximo módulo vai querer. Por isso todas
as 22 tabelas levam o prefixo, do mesmo jeito que `food_` e `ops_` já fazem aqui.
Antes de criar tabela nova neste banco:

```sql
SELECT table_schema, table_name FROM information_schema.tables
 WHERE table_name = ANY(ARRAY['sua','lista','de','nomes']);
```

## Isolamento entre clientes

Mesma doutrina do módulo Veículos, um degrau acima do resto do hub.

O hub isola por código: toda consulta filtra `negocio_id` vindo do
`activeNegocioId(sessao)`, e **não existe RLS em nenhuma tabela**. Um `WHERE`
esquecido vaza dado entre clientes.

Aqui as chaves estrangeiras são **compostas**, carregando `negocio_id` junto. O
Postgres recusa na escrita um agendamento apontando para profissional de outro
cliente, um item de comanda cruzando inquilino, uma jornada em barbeiro alheio.
Não é disciplina, é o banco barrando.

Na leitura a chave composta não ajuda, então em `lib/agenda.ts` **toda função
recebe `negocioId` como primeiro argumento obrigatório, sem valor padrão**.
Função que não pede inquilino não entra neste módulo. O `negocioId` vem sempre
da sessão, nunca da URL.

## A trava de duplo agendamento

O horário pode ser tomado por quatro portas: site, app, WhatsApp e balcão. Se a
disponibilidade for conferida em código, existe a janela entre conferir e
gravar, e dois clientes marcam as 14h30 do mesmo barbeiro. Acontece pouco, e
quando acontece o dono perde a confiança no sistema inteiro.

Quem recusa é o banco, com restrição de exclusão sobre o intervalo de tempo:

```sql
EXCLUDE USING gist (
  negocio_id WITH =, profissional_id WITH =, tstzrange(inicio, fim) WITH &&
) WHERE (status NOT IN ('cancelado','faltou'))
```

Cancelado e faltou ficam de fora de propósito: horário desmarcado volta a ser
vendável.

Isso exige a extensão `btree_gist`, que é o que permite misturar igualdade de
UUID com sobreposição de intervalo na mesma restrição. A migration tenta criar
e, se o usuário não puder, avisa em `WARNING` e segue sem a trava, em vez de
morrer calado. **Confira depois de aplicar:**

```sql
SELECT conname FROM pg_constraint WHERE conname = 'ex_agendamento_sem_sobreposicao';
```

Vazio significa que a trava não entrou.

## Uma armadilha de chave composta, que o módulo Veículos tem hoje

Chave estrangeira composta **não pode** usar `ON DELETE SET NULL`. O Postgres
anula as duas colunas, inclusive `negocio_id`, que é `NOT NULL`, e a exclusão
estoura.

O `migration_0003_veiculos.sql` faz isso em seis chaves:
`veiculos.filial_id`, `leads.veiculo_id`, `leads.filial_id`,
`avaliacoes_troca.lead_id`, `vendas.veiculo_troca_id` e `vendas.filial_id`. Nas
seis, a tabela filha tem `negocio_id UUID NOT NULL`, então a exclusão falha com
violação de não nulo em vez de anular a coluna.

Só não apareceu ainda porque ninguém apagou uma filial nem um veículo. Fica
como conserto pendente do módulo Veículos, não deste.

`RESTRICT` também não serve, porque é conferido na hora: apagar um negócio
cascateia para clientes e comandas, e um `RESTRICT` entre elas travaria a
própria cascata.

Este módulo usa `NO ACTION`, conferido no fim da instrução. No uso normal
protege igual, e a cascata do negócio passa.

## Tabelas

| Tabela | Para que serve |
|---|---|
| `agenda_config` | A regra da casa em dado, não em constante de código. Uma linha por negócio |
| `profissionais` | O barbeiro. `usuario_id` liga ao login, e é assim que ele vê o próprio fechamento |
| `servicos` | Duração, preço, e o intervalo de limpeza depois, que some de todo sistema |
| `profissional_servicos` | Quem faz o quê, com preço e duração próprios |
| `clientes` | Quem senta na cadeira. Não confundir com `negocios`, que é a barbearia |
| `agenda_jornadas` | Jornada por dia da semana. Duas linhas no mesmo dia é turno partido |
| `agenda_excecoes` | Folga, feriado, jornada estendida. Sem profissional vale pra casa inteira |
| `agendamentos` | O coração. Tem a trava de sobreposição |
| `agendamento_servicos` | Corte mais barba no mesmo horário, com preço congelado |
| `produtos` | Cosmético de venda, de uso interno, e produto de bar |
| `produto_movimentos` | Toda mudança de estoque com motivo. O saldo nunca se edita na mão |
| `comandas` | Todo atendimento concluído vira uma. Avulsa para quem só compra |
| `comanda_itens` | O profissional fica no item, não na comanda. A comissão sai daqui |
| `pacotes`, `pacote_itens` | Dez cortes pagos hoje |
| `pacote_vendas`, `pacote_usos` | Sessão comprada contra sessão usada |
| `fidelidade_movimentos` | Extrato, não saldo |
| `lista_espera` | Agenda cheia não pode virar cliente perdido |
| `avaliacoes` | Uma pergunta no zap depois do atendimento |
| `profissional_lancamentos` | Vale, adiantamento e consumo do barbeiro |
| `comissao_fechamentos` | O período fechado e congelado. O que foi pago foi pago |

### Dinheiro

Centavos em `INTEGER`, igual ao resto do hub. Converter só na borda.

### O que fica congelado, e por quê

Preço e duração são copiados para `agendamento_servicos` e `comanda_itens` no
momento do combinado. Nome do serviço também. Mudar a tabela de preços amanhã
não pode reescrever o que foi acertado ontem, e relatório do mês passado que
muda de valor sozinho destrói a confiança do time no sistema.

A comissão segue a mesma regra: percentual e valor ficam gravados no item.

### O que não existe de propósito

Não existe apagar cliente, comanda ou agendamento concluído, só arquivar e
cancelar. Apagar levaria junto comissão, faturamento e histórico.

Não tem rede social interna, agendamento por Facebook, SMS, adquirência própria
nem emissão de nota fiscal. O porquê de cada um está no plano de produto.

## Antes de rodar qualquer script

O banco é **produção**, não sandbox. Precisa do túnel SSH aberto em outra
janela. No PowerShell, que é o terminal desta máquina:

```
powershell -ExecutionPolicy Bypass -File db\scripts\tunel.ps1
```

Não devolve nada e não sai. É isso mesmo, é o que mantém o túnel de pé.

O `tunel.sh` continua existindo e faz o mesmo, mas depende do Git Bash, que
**não está no PATH do PowerShell** nesta máquina (fica em
`C:\Program Files\Git\bin\bash.exe`). O `ssh` do Windows 11 é nativo, então a
versão PowerShell não precisa de nada instalado.

E `psql` também não existe aqui. Por isso a migration se aplica por Node, não
por `psql -f`.

## Ensaio, aplicar, semear

Nesta ordem, com o túnel de pé em outra janela:

```
node db/scripts/agenda-ensaio-migration.cjs   # prova sem alterar nada
node db/scripts/agenda-aplicar.cjs            # aplica de verdade
node db/scripts/agenda-semente-demo.cjs       # cria a Barbearia Lâmina
```

O ensaio:

Roda a migration duas vezes numa transação (idempotência), cria duas barbearias
fictícias, tenta cinco cruzamentos entre inquilinos, testa a trava de
sobreposição nos dois sentidos, confere o gatilho de estoque, e desfaz tudo com
`ROLLBACK`. Não altera nada.

## Arquivos

- `db/migration_0004_agenda.sql` · schema, idempotente.
- `db/scripts/agenda-ensaio-migration.cjs` · ensaio em transação com ROLLBACK.
- `db/scripts/agenda-aplicar.cjs` · aplica a migration (Node, sem psql).
- `db/scripts/tunel.ps1` · o túnel em PowerShell, sem Git Bash.
- `db/scripts/agenda-semente-demo.cjs` · a Barbearia Lâmina.
- `lib/agenda.ts` · camada de dados. Toda função pede `negocioId`.
- `app/painel/agenda/page.tsx` · agenda do dia, com marcar e fechar.
- `app/painel/agenda/acoes.ts` · toda a escrita do módulo, em server actions.
- `app/painel/agenda/raio-x/page.tsx` · o raio-X da cadeira.
- `app/painel/equipe/page.tsx` e `equipe/[id]/page.tsx` · equipe e jornada.
- `app/painel/servicos/page.tsx` · serviços e as regras da casa.
- `app/painel/page.tsx` · bloco Cadeira na visão geral.
- `app/painel/layout.tsx` e `app/globals.css` · a casca do painel, agora
  responsiva.

## Fechar o atendimento é uma transação, não um status

`concluirAtendimento()` muda o status, abre a comanda numerada do dia, lança os
itens com a comissão congelada e pontua fidelidade, tudo dentro de uma
transação, com `FOR UPDATE` na linha do agendamento.

O `FOR UPDATE` não é zelo: dois toques no botão, ou o balcão e o barbeiro ao
mesmo tempo, abririam duas comandas para o mesmo corte e o caixa do dia contaria
o serviço duas vezes.

O desconto sai **proporcional ao peso de cada item**, e a comissão incide sobre
o líquido. Descontar tudo do primeiro item faria o barbeiro do corte pagar
sozinho um desconto que a casa deu no combo.

Reabrir **cancela** a comanda, nunca apaga: comanda que some leva junto o
faturamento do dia e a comissão que o barbeiro já conferiu.

## Três coisas que já custaram retrabalho aqui

**Almoço não é cadeira vazia.** A agenda do dia mostra o buraco entre um
atendimento e o próximo, e na primeira versão a parada das 12h às 13h30 aparecia
como "90 min de cadeira vazia". O dono fecha pro almoço de propósito, e um
número que trata a escolha dele como prejuízo queima a confiança no painel
inteiro na primeira olhada. Por isso existe `faixasDoDia()`: o buraco só conta o
que cai dentro da jornada.

**Os números do topo são do dia que está na tela**, não de hoje. Com número
fixo em hoje, quem abre a quarta lê "na agenda hoje 40" com uma lista de 27
embaixo, e passa a desconfiar dos dois.

**`emReais` do módulo Veículos arredonda pro real inteiro**, porque carro custa
dezenas de milhares e centavo ali é ruído. Em barbearia, corte de R$ 45,00
virando "R$ 45" faz o dono achar que o sistema arredonda o dinheiro dele. Este
módulo tem o seu, e a visão geral importa com apelido para não misturar.

**A regra global `input, select, textarea { width: 100% }`** vazava para caixa
de seleção: a caixinha esticava até 155px, o rótulo era empurrado para a direita
e o texto quebrava em três linhas. Parecia descuido de quem fez a tela, e era
regra global antiga cobrando o preço. Corrigido em `globals.css`, para checkbox,
radio e campo de cor.

## O painel no celular

A casca do painel era barra lateral de largura fixa sem nenhuma regra de tela
estreita: no telefone ela continuava lá, sobravam uns 150px de conteúdo e a
página rolava de lado. Passou despercebido porque o módulo de Veículos se opera
sentado. O de Agenda não: o dono de barbearia olha a agenda em pé, entre um
corte e outro.

Abaixo de 860px a lateral vira faixa no topo com rolagem horizontal. A correção
está em `app/globals.css` e vale para todos os módulos.

## A barbearia de demonstração

`node db/scripts/agenda-semente-demo.cjs` cria a **Barbearia Lâmina**, com três
barbeiros, cinco meses de histórico e a semana que vem parcialmente cheia.

Nada ali é aleatório. O histórico é gerado a partir do ritmo real de cada
cliente, e é dele que saem sozinhos os dois clientes críticos, os dois em
atenção, as faltas concentradas em duas pessoas, a terça de manhã vazia e o
barbeiro que corta bem e não vende produto. Painel vazio não vende numa reunião,
e painel com dado aleatório não sustenta a segunda pergunta.

    entrar: demo@barbearialamina.com.br
    senha:  lamina2026
    barbeiro (Alex): alex@barbearialamina.com.br, mesma senha

**Rode a semente no dia da reunião.** Leva quatro segundos. O que já passou do
horário HOJE é gravado como atendido, e isso é decidido na hora em que a semente
roda: semeada ontem à noite, a tela abre a reunião com "já atendidos 0" e a
manhã inteira ainda marcada.

O tamanho da base não é enfeite. Com poucos clientes, o histórico roda a 19
atendimentos por dia e a semana seguinte a 30, e a barbearia aparece em
explosão; com base pequena demais, o barbeiro fatura R$ 500 no mês e o dono
percebe na hora que o dado é inventado. `CLIENTES_MASSA` é o que fixa o
movimento diário, porque cada pessoa volta cerca de 3,2 vezes em três meses.

Conferir o que a demo está mostrando, sem abrir o navegador:

```
node db/scripts/agenda-conferir-demo.cjs
```

Apagar: `node db/scripts/agenda-semente-demo.cjs --apagar`.

## Estado hoje

**Aplicado em produção em 05/09/2026.** 22 tabelas, 44 chaves compostas, trava
de sobreposição instalada (o `btree_gist` já existia no banco).

O ensaio passou inteiro: cinco cruzamentos entre inquilinos barrados pelo banco,
a trava recusando horário sobreposto, aceitando outro barbeiro no mesmo horário,
aceitando o horário encostado no fim do anterior, liberando o horário depois do
cancelamento, gatilho de estoque somando certo e telefone duplicado barrado.

A Barbearia Lâmina está no ar com 710 clientes, três meses de histórico e a
semana seguinte marcada. As três telas foram abertas e conferidas no navegador,
em desktop e em 390px. TypeScript limpo.

**O painel escreve.** Marcar, confirmar, pôr na cadeira, concluir com forma de
pagamento e desconto, marcar falta, cancelar com motivo e reabrir. Cadastro de
equipe com comissão própria, jornada da semana com turno partido, folga e
feriado, serviços com duração e tempo de limpeza, e as regras da casa.

Testado no navegador contra o banco real: a trava recusou 11h com o Alex por
sobreposição e devolveu a mensagem certa; marcar em horário livre criou cliente
com telefone normalizado; concluir com crédito e R$ 10 de desconto gerou a
comanda nº 1 do dia com item de R$ 60 líquidos e comissão de 55%, que é a do
Alex e não os 50% da casa; a jornada aceitou abrir um dia novo com turno único e
foi lida de volta correta.

A fazer, em ordem: comanda avulsa e produto na comanda, fechamento de caixa do
dia, site público com agendamento (é lá que entra a grade de horários livres),
WhatsApp com Resend de segunda via, fechamento de comissão do mês e o app do
cliente final.
