# Comissões da Agenda

## Escopo entregue

A rota `/painel/comissoes` usa exclusivamente as tabelas já criadas pela Agenda:

- `agenda_comanda_itens`, para a comissão congelada no fechamento da comanda;
- `agenda_profissional_lancamentos`, para vale, adiantamento e consumo;
- `agenda_comissao_fechamentos`, para congelar o acerto mensal por profissional;
- `agenda_profissionais`, para validar que o profissional pertence ao negócio da sessão.

Não há migration nova. A tela não lê nem altera caixa, repasses de forma de pagamento ou estoque. O período contábil usa `America/Sao_Paulo`, como o restante da Agenda.

## Segurança e tenant

O `negocio_id` vem de `activeNegocioId(sessao)` e nunca de URL ou formulário. Todas as consultas e escritas também exigem o par `negocio_id + profissional_id`. Um UUID de profissional de outro tenant não produz leitura nem lançamento.

A página e as server actions aceitam somente `dono` e `owner_plataforma` quando o owner está impersonando um negócio. O link também só aparece para esses papéis.

## Limitação de papel existente

A sessão atual não possui papel `profissional` e não carrega um `profissional_id` confiável. Embora `agenda_profissionais.usuario_id` exista, o papel genérico `operador` não permite distinguir um barbeiro de um atendente. Inferir essa identidade por parâmetro de URL abriria acesso ao extrato de colegas.

Por isso, esta versão é deliberadamente um painel seguro do dono: `operador`, `parceiro`, `admin_hub` e qualquer login sem papel de dono são redirecionados antes de qualquer consulta de comissão.

Para liberar um extrato individual no futuro, a autenticação precisa representar explicitamente o papel profissional e resolver no servidor o vínculo entre `sessao.uid` e `agenda_profissionais.usuario_id`. Nesse modo, a consulta deve ignorar qualquer profissional vindo da URL e usar apenas o vínculo da sessão.

## Regras de fechamento

- Serviço e produto entram somente por comandas com status `fechada`.
- Vale, adiantamento, consumo e desconto reduzem o líquido; bônus aumenta.
- O fechamento é serializado por negócio, profissional e competência para evitar duplicidade concorrente.
- Depois de `fechado` ou `pago`, o fechamento é idempotente e seus totais congelados são exibidos.
- Um novo lançamento com data dentro de um período fechado ou pago é recusado.
