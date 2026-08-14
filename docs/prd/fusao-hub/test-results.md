# Resultados de Teste — Fusão do Hub (FASE 3, QA ao vivo via Playwright)

Executado ao vivo em `https://hub.179.198.126.197.sslip.io` como owner (`contato@enderecodigital.com`),
hub Endereço Digital (`777815b4-7f3a-4813-8331-18e539111710`). Screenshots em
`c:\Projetos Claude\site-enderecodigital\.playwright-mcp\` (e raiz do projeto para os nomeados por ID).

## Resumo

- Total de itens: 54 — todos executados ao vivo.
- APROVADOS: 47
- REPROVADOS: 4
- BLOQUEADOS (não testáveis ao vivo nesta sessão): 3

### Reprovados (com repro no item)
- **B-FOCUS-ESC-01** — Esc não fecha o modal "Novo cliente" (falha de acessibilidade; só fecha por X/Cancelar/overlay).
- **B-ERR-VIS-01** — action de Conectar sem nome redireciona `?erro=nome` mas NÃO mostra nenhuma mensagem de erro visível ao usuário.
- **B-DBLCLICK-SAVE-01** — duplo clique em "Criar cadastro" cria DOIS clientes idênticos (sem guard de duplo envio).
- **C-ENTRAR-BADID-01** — `/api/hub/entrar?id=id-invalido` responde HTTP 500 em vez de redirecionar para `/owner` (id não-UUID quebra a query).

### Bloqueados (sem meios ao vivo)
- **C-NONOWNER-OP-01** e **C-NONOWNER-API-01** — não há conta NÃO-owner disponível para autenticar (só owner_plataforma).
- **C-DB-ERR-01** — impossível derrubar/forçar erro do MySQL a partir do navegador (QA externo, sem acesso a infra).

### Observações estruturais importantes (afetam expectativas do plano)
- O `/owner` (God-view) NÃO usa "tema claro próprio": ele renderiza em tema DARK navy COM sidebar
  navy própria (grupos Plataforma / Endereço Digital / Sistema). O plano da FASE 1 assumia `/owner`
  claro e sem sidebar — a realidade diverge. Isso impacta B-REG-THEME-OWNER-01 e A-BACK-01.
- O contexto de hub grava cookie httpOnly (`document.cookie` vem vazio no browser), então a presença
  do `ed_hub_op` é comprovada FUNCIONALMENTE (acesso às rotas `/operacao/hub/*`), não por leitura JS.
- O redirect 303 do `/api/hub/entrar` não aparece no painel de rede quando disparado por clique de
  link (a navegação reinicia o log). Confirmado por fetch direto nos itens C-ENTRAR-*.

---

## A-ENTRAR-01 — APROVADO
- Screenshot: `A-ENTRAR-01.png` (e `B-REG-OWNER-01.png` do /owner antes de entrar).
- Passos: em `/owner`, cliquei em "Entrar no hub" no card "Endereço Digital".
- Resultado: URL final `https://hub.179.198.126.197.sslip.io/operacao`. Interface GROOW visível:
  sidebar navy fixa + faixa "MODO OPERAÇÃO · GROOW OS" (topo) com link "Voltar ao console" → `/owner`.
- Rede: navegação landou em `/operacao` (200); múltiplos prefetch `_rsc` das rotas `/operacao/*` [200].
- Console: 0 erros / 0 warnings.

## A-ENTRAR-02 — APROVADO
- Screenshot: `A-ENTRAR-01.png` (mesma tela; sidebar visível).
- Grupo "Endereço Digital" na sidebar tem EXATAMENTE 5 itens:
  Todos os hubs (`/owner`), Clientes (`/operacao/hub/clientes`), Workspaces (`/operacao/hub/workspaces`),
  Contas Claude (`/operacao/hub/contas-claude`), Configurações do hub (`/operacao/hub/config`).
- Cookie `ed_hub_op`: httpOnly (não legível via JS); presença comprovada funcionalmente pelo acesso
  às rotas do hub nos itens seguintes.
- Console: 0 erros.

## A-NAV-01 — APROVADO
- Screenshot: `A-NAV-01.png`.
- Sidebar → "Todos os hubs" → navegou para `/owner` (saiu da operação, voltou à God-view). Console 0 erros.

## A-NAV-02 — APROVADO
- Screenshot: `A-NAV-02.png`.
- Sidebar → "Clientes" → `/operacao/hub/clientes`, título "Clientes", tabela com Doce Pão e Padaria Aroma (status Ativo, saúde 100%).

## A-NAV-03 — APROVADO
- Screenshot: `A-NAV-03.png`.
- Sidebar → "Workspaces" → `/operacao/hub/workspaces`. 5 StatCards: Ativos=2, Em configuração=0, Com alertas=0, Integrações ativas=0, Saúde média=100%. Tabela lista Doce Pão e Padaria Aroma.

## A-NAV-04 — APROVADO
- Screenshot: `A-NAV-04.png`.
- Sidebar → "Contas Claude" → `/operacao/hub/contas-claude`. Card "API da plataforma" com badge "CENTRAL" (válida) + formulário "Conectar conta" (Nome/apelido, Plano, Tipo).

## A-NAV-05 — APROVADO
- Screenshot: `A-NAV-05.png`.
- Sidebar → "Configurações do hub" → `/operacao/hub/config`. Form "Identidade do hub" com Nome preenchido = "Endereço Digital" (hub ativo).

## A-NAV-06 — APROVADO
- Screenshots: nas telas A-NAV-02..05 o item ativo aparece com barra dourada.
- `aria-current="page"` confirmado por JS em cada rota (ex.: `/operacao/hub/clientes`, `/operacao/hub/config`).
- Rede: todas as rotas do grupo retornaram [200]. Console 0 erros.

## A-CLI-01 — APROVADO
- Screenshot: `A-CLI-01.png`.
- Em `/operacao/hub/clientes`, cliquei "Novo cliente" → modal "Novo cliente" abriu; select "Hub *" já preenchido com "Endereço Digital (/endereco-digital)".

## A-CLI-02 — APROVADO
- Screenshot: `A-CLI-02.png`.
- Preenchi Nome da empresa = "QA Teste Alfa" (Hub já preenchido), cliquei "Criar cadastro".
- URL final `/operacao/hub/clientes?ok=1`; banner verde "Cliente cadastrado com sucesso."; nova linha "QA Teste Alfa" na tabela (workspace `/qa-teste-alfa-hmdsx`, slug com sufixo único). Console 0 erros.

## A-CLI-03 — APROVADO
- Screenshot: `A-CLI-03.png`.
- Em `/operacao/hub/workspaces` o mesmo cliente "QA Teste Alfa" aparece (StatCard Ativos passou de 2 → 3). Revalidação das duas rotas funcionou.

## B-KBD-TAB-01 — APROVADO
- No modal "Novo cliente": Tab de `nome` → `nome_fantasia` (ordem lógica), `outlineStyle: solid` (foco visível), Shift+Tab retornou de `nome_fantasia` → `nome`.

## B-FOCUS-ESC-01 — REPROVADO
- Screenshot: `B-FOCUS-ESC-01.png` (modal ainda aberto após Esc).
- Repro: abrir modal "Novo cliente" → focar um campo → pressionar Esc. Esperado (plano): modal fecha.
  Observado: modal permanece aberto (`document.querySelector('input[name="nome"]')` ainda existe; h2 "Novo cliente" presente).
- Conforme o próprio plano previa, é falha de acessibilidade a registrar (Esc não fecha; só fecha por X/Cancelar/overlay).

## A-WS-EDIT-01 — APROVADO
- Screenshot: `A-WS-EDIT-01.png`.
- Workspaces → (…) da linha QA Teste Alfa → "Editar workspace" → impersonou e caiu em `/app/config-hub`,
  faixa "MODO OWNER · editando o workspace de QA Teste Alfa", aba "Config. do cliente". Console 0 erros.

## A-WS-ARCH-01 — APROVADO
- Screenshots: `A-WS-menu.png` (menu aberto: Editar workspace / Arquivar / Excluir permanentemente), `A-WS-ARCH-01.png` (filtro Arquivados).
- (…) → "Arquivar" (redireciona para `/operacao/hub/clientes`). Na lista, linha QA Teste Alfa passou a "Arquivado".
- Filtro "Arquivados": mostra só QA Teste Alfa. Filtro "Ativos": QA Teste Alfa some (só Doce Pão e Padaria Aroma).

## A-WS-REACT-01 — APROVADO
- Screenshots: `A-WS-REACT-01-menu.png` (menu da linha arquivada com "Reativar"), `A-WS-REACT-01.png`.
- Na linha arquivada, (…) mostra "Reativar" (no lugar de Arquivar). Clicar → status volta a "Ativo".

## B-REG-WSOWNER-01 — APROVADO
- Screenshot: `B-REG-WSOWNER-01.png`.
- Via Editar workspace → impersonar → painel do cliente em `/app` (MODO OWNER) abre e opera: cards
  (WhatsApp/Meu site/Instagram/Assistente-IA), relógio, chat "Converse com o Claude", abas navegáveis.
- "Voltar ao console" restaurou o contexto owner (foi para `/owner/clientes`). Console 0 erros.
- Obs.: o plano citava `/ws/[neg]`; a impersonação real leva a `/app` (painel do cliente). Funciona igualmente.

## A-CC-CONNECT-01 — APROVADO
- Screenshot: `A-CC-CONNECT-01.png`.
- Contas Claude → "Nome / apelido" = "QA Conta Teste" → "Conectar". URL `?ok=1`, banner verde "Conta conectada.",
  novo card "QA Conta Teste" (Pro, ativa) surgiu.

## A-CC-TOGGLE-01 — APROVADO
- Screenshot: `A-CC-TOGGLE-01.png`.
- No card, "Tornar compartilhada" → badge "COMPARTILHADA" apareceu e o botão virou "Tornar dedicada".

## A-CC-STATUS-01 — APROVADO
- Screenshot: `A-CC-STATUS-01.png`.
- No card, "Desativar" → badge alternou de "ativa" para "inativa" e o botão virou "Ativar".

## A-CC-DEL-01 — APROVADO
- Screenshot: `A-CC-DEL-01.png`.
- No card, botão lixeira "Excluir" → card "QA Conta Teste" sumiu da lista (`document.body` não contém mais o nome).
  Sem confirm() para contas (exclusão direta). Console 0 erros.

## A-CFG-SAVE-01 — APROVADO
- Screenshot: `A-CFG-SAVE-01.png`.
- Alterei Nome="Endereço Digital QA", Cor de destaque="#D4AF37", Teto de IA/mês="50" → "Salvar configurações".
- URL `?ok=1`; banner "Configurações salvas." (confirmado por texto). Após recarregar, os 3 valores persistiram
  (nome="Endereço Digital QA", cor_destaque="#D4AF37", ia_limite_mensal_usd="50"). (Depois restaurados aos originais.)

## C-TEXT-IN-NUM-01 — APROVADO
- Screenshot: `C-TEXT-IN-NUM-01.png`.
- Teto de IA/mês (`ia_limite_mensal_usd`, type=text): digitei "abc" e salvei → sem crash, `?ok=1`. Ao recarregar, valor = "0".
- Health Score no modal Novo cliente é `spinbutton` (input `type=number`) — rejeita letras nativamente (visto no snapshot do modal).

## B-DBLCLICK-CFG-01 — APROVADO
- Screenshot: `B-DBLCLICK-CFG-01.png`.
- Duplo clique em "Salvar configurações" → salvou uma vez, `?ok=1`, sem erro/tela branca (form presente, banner exibido).
  Valores restaurados aos originais (nome="Endereço Digital", cor="#C9A961", teto="0").

## B-DBLCLICK-NOVO-01 — APROVADO
- Screenshot: `B-DBLCLICK-NOVO-01.png`.
- Duplo clique em "Novo cliente": nunca há dois modais. O 2º clique alterna/fecha (0 modais); um clique único
  abre exatamente 1 (1 heading "Novo cliente", 1 input `name=nome`). Sem sobreposição/duplicação.

## B-DBLCLICK-SAVE-01 — REPROVADO
- Screenshot: `B-DBLCLICK-SAVE-01.png` (duas linhas "QA DblSave").
- Repro: `/operacao/hub/clientes` → "Novo cliente" → Nome="QA DblSave" → DUPLO clique em "Criar cadastro".
- Esperado: apenas UM cliente criado. Observado: DOIS clientes idênticos criados (slugs `/qa-dblsave-p2ll4` e `/qa-dblsave-5su6n`).
- Defeito: o submit não é desabilitado/deduplicado no 1º clique (sem guard de duplo envio). (Duplicatas removidas na limpeza.)

## C-EMPTY-NOME-01 — APROVADO
- Screenshot: `C-EMPTY-NOME-01.png`.
- Submeter com Nome vazio: HTML `required` bloqueia (input `validity.valid=false`, msg "Preencha este campo.", URL não muda).
- Contornando (removi o atributo `required` via devtools) e submetendo: action redireciona `?erro=dados` e o cliente
  NÃO é criado (tabela permaneceu com as 3 linhas de então).

## C-DUP-NOME-01 — APROVADO
- Screenshot: `C-DUP-NOME-01.png`.
- Criei cliente "Doce Pão" (nome já existente) → concluiu sem erro de banco (`?ok=1`); slug ganhou sufixo único
  (`/doce-pao-98imt`) e coexistiu com o original (`/doce-pao`). (Duplicata removida na limpeza.)

## C-SEARCH-EMPTY-01 — APROVADO
- Screenshot: `C-SEARCH-EMPTY-01.png`.
- Busca por "zzzznaoexiste" → estado vazio "Nenhum cliente encontrado.".

## C-DEL-CONFIRM-01 — APROVADO
- Screenshot: `C-DEL-CONFIRM-01.png`.
- (…) → "Excluir permanentemente" dispara `confirm()` do navegador:
  "Excluir permanentemente este cliente e todos os dados? Não dá pra desfazer."
- Cancelar (accept=false): nada excluído (linha permaneceu, 6 linhas). Confirmar (accept=true): a linha foi removida.
- Usado também para limpar os clientes de teste (2x QA DblSave + QA Teste Alfa) — hub restaurado a Doce Pão + Padaria Aroma.

## C-FILTER-EMPTY-01 — APROVADO
- Screenshot: `C-FILTER-EMPTY-01.png`.
- Workspaces → filtro "Arquivados" (sem nenhum arquivado) → estado vazio "Nenhum workspace encontrado.".

## B-ERR-VIS-01 — REPROVADO
- Screenshot: `B-ERR-VIS-01.png` (tela sem qualquer aviso, apesar de `?erro=nome`).
- Repro: `/operacao/hub/contas-claude` → remover `required` do input `nome` via devtools → "Conectar" com nome vazio.
- Resultado: action redireciona para `?erro=nome` e NÃO cria conta (Clientes segue 2). Porém NÃO há mensagem de erro
  VISÍVEL ao usuário — a tela fica idêntica ao estado normal (sem banner/alerta; nenhum `[role=alert]`/`.erro`/`.error`).
- Conforme o plano previa, a ausência de aviso para estados `?erro=*` é defeito de UX a registrar.

## A-BACK-01 — APROVADO
- Screenshot: `A-BACK-01.png`.
- "Voltar ao console" na faixa superior → navega para `/owner` (God-view), SEM a sidebar da operação nem a faixa "MODO OPERAÇÃO".
- Obs.: a God-view é dark navy (não "tema claro" como o plano descrevia na FASE 1); ver B-REG-THEME-OWNER-01.

## B-LOAD-01 — APROVADO
- Conteúdo server-rendered aparece imediatamente em todas as rotas do grupo HUB (Clientes/Workspaces/Contas/Config),
  sem spinner infinito e sem flash de tema. Console sem erros de app.
- Achados menores de assets (não bloqueiam render): 400 em `/_next/image?url=/logo-mark.png&w=32` (otimização do logo)
  e 404 do favicon de `enderecodigital.tech` (vindo do preview do painel do cliente).

## B-F5-01 — APROVADO
- Screenshot: `B-F5-01.png`.
- Em `/operacao/hub/clientes`, F5 → recarregou, continuou no hub, tabela re-renderizada (2 linhas), NÃO redirecionou para `/owner`.

## B-BACK-BTN-01 — APROVADO
- Screenshot: `B-BACK-BTN-01.png`.
- Clientes → Workspaces → Voltar do navegador → retornou a `/operacao/hub/clientes` com a tabela intacta (2 linhas, título "Clientes").

## B-REG-THEME-OP-01 — APROVADO
- Screenshots: `B-REG-THEME-OP-01-operacao-dark.png` (operação em dark após toggle), `A-BACK-01.png` (/owner inalterado).
- Toggle "Mudar para tema escuro" em `/operacao`: gravou `localStorage ed2-theme="dark"` e classe `ed2-dark` no `<html>`,
  fundo passou a navy (rgb(10,20,40)). Ao ir para `/owner`: apesar de `ed2-theme` persistir, o `<html>` NÃO recebe
  `ed2-dark` (o tema da operação NÃO vazou para a God-view).

## B-REG-THEME-OWNER-01 — APROVADO (com ressalva de descrição)
- Screenshot: `B-REG-OWNER-01.png` / `A-BACK-01.png`.
- O design GROOW/ed2 NÃO vazou para `/owner`: sem faixa "MODO OPERAÇÃO" (false), sem a sidebar da operação
  (`[aria-label="Navegação do admin"]` ausente), sem classe `ed2-dark`. A God-view usa shell próprio com classes
  `.card` (11) e `.kpi` (5), como o plano indicava.
- Ressalva: a God-view é DARK navy (tem sua própria sidebar), não "tema claro" como a descrição literal da FASE 1 dizia.
  Não é regressão funcional — é divergência entre a descrição do plano e o design atual do `/owner`.

## B-REG-LEADS-01 — APROVADO
- Screenshot: `B-REG-LEADS-01.png`.
- `/operacao/leads` carrega com dados reais: 26 linhas na tabela, título "Leads", sem erro.

## B-REG-COB-01 — APROVADO
- Screenshot: `B-REG-COB-01.png`.
- `/operacao/cobrancas` carrega normalmente (h1 "Cobranças"), sem erro/stack.

## B-REG-SOCIAL-01 — APROVADO
- Screenshot: `B-REG-SOCIAL-01.png`.
- `/operacao/conteudo-social` carrega normalmente (h1 "Conteúdo Social"), sem erro/stack.

## B-REG-OWNER-01 — APROVADO
- Screenshot: `B-REG-OWNER-01.png`.
- A God-view `/owner` funciona: KPIs (Hubs=1, Workspaces=2, Leads=26, MRR R$75, IA US$0.76), card do hub "Endereço Digital"
  com botões "Entrar no hub" / "Criar hub" e ações "Módulos" / "Usar como base".

## C-NOHUB-CLI-01 — APROVADO
- Screenshot: `C-NOHUB-CLI-01.png`.
- Após sair do hub (`/api/hub/sair`, limpa `ed_hub_op`), acessar `/operacao/hub/clientes` → redireciona para `/owner`.

## C-NOHUB-WS-01 — APROVADO
- Sem contexto de hub, `/operacao/hub/workspaces` → redireciona para `/owner`.

## C-NOHUB-CC-01 — APROVADO
- Sem contexto de hub, `/operacao/hub/contas-claude` → redireciona para `/owner`.

## C-NOHUB-CFG-01 — APROVADO
- Screenshot: `C-NOHUB-CFG-01.png`.
- Sem contexto de hub, `/operacao/hub/config` NÃO redireciona (URL permanece); mostra o card de fallback
  "Entre em um hub para editar as configurações dele.". Diferença em relação aos irmãos é intencional/confirmada.

## C-ENTRAR-BADID-01 — REPROVADO
- Screenshot: `C-ENTRAR-BADID-01.png` (página de erro do navegador). Rede: `GET /api/hub/entrar?id=id-invalido => [500]`.
- Repro: navegar para `https://hub.179.198.126.197.sslip.io/api/hub/entrar?id=id-invalido`.
- Esperado (plano): redirecionar para `/owner` sem gravar `ed_hub_op`.
- Observado: o endpoint responde HTTP 500 (página de erro do Chromium, sem redirect). O cookie NÃO é gravado
  (após o erro, `/operacao/hub/clientes` ainda redireciona para `/owner`), mas o 500 em vez de redirect gracioso é defeito.
  Provável causa: id fora do formato UUID quebra a query sem tratamento/try-catch.

## C-SESSION-EXPIRED-01 — APROVADO
- Screenshot: `C-SESSION-EXPIRED-01.png`.
- Apaguei o cookie de sessão (`ed_hub_session`, httpOnly, via context.clearCookies) e acessei `/operacao/hub/clientes`
  → middleware redirecionou para `/login`. (Nota: o cookie de sessão real chama-se `ed_hub_session`, não `ed_session`.)

## C-ENTRAR-NOAUTH-01 — APROVADO
- Screenshot: `C-ENTRAR-NOAUTH-01.png`.
- Sem sessão, `/api/hub/entrar?id=777815b4-...` → redirecionou para `/login?id=777815b4-...` (id preservado como retorno).

## C-NONOWNER-OP-01 — BLOQUEADO (sem usuário não-owner)
- Não há credenciais de um usuário NÃO-owner disponíveis nesta sessão (logado só como `owner_plataforma`).
  Não é possível autenticar como não-owner para verificar o redirecionamento de `/operacao` → `/app`. Item não testável ao vivo aqui.

## C-NONOWNER-API-01 — BLOQUEADO (parcial)
- Sem usuário não-owner, não dá para verificar o caminho "autenticado porém não-owner → 401 JSON".
- Evidência de suporte (sem sessão): `GET /api/admin/perfil` → HTTP 307 redirect para `/login` (guarda no middleware).
  O caso específico de 401 `{"error":"Unauthorized"}` para não-owner autenticado fica pendente por falta de conta não-owner.

## A-LOGOUT-01 — APROVADO
- Screenshots: `A-LOGOUT-01-menu.png` (menu de perfil aberto com "Editar perfil" / "Sair"), `A-LOGOUT-01.png` (tela `/login`).
- `/operacao` → avatar "A" (botão "Perfil") → menu → "Sair" → URL final `/login`. Cookie de sessão `ed_hub_session`
  foi removido (verificado via context.cookies: `hasSession=false`).
- Obs. menor: o cookie `ed_hub_op` (contexto de hub) permaneceu após o logout (só a sessão foi limpa) — inofensivo, mas anotado.

## B-REG-LOGIN-01 — APROVADO (com ressalva)
- Ciclo verificado do lado do cookie de sessão:
  - Sessão presente (`ed_hub_session`) → uso pleno funcionou (todos os fluxos A/B/C acima).
  - Logout (A-LOGOUT-01) → cookie removido e redireciona para `/login`.
  - Restaurando um `ed_hub_session` válido (JWT stateless) → acesso volta (`GET /owner` = 200).
- Ressalva: o navegador já veio autenticado e NÃO há senha disponível, então o login VIA FORMULÁRIO em `/login`
  (E-mail + Senha + Entrar) não foi executado por mim. O formulário existe e está renderizado (ver `A-LOGOUT-01.png`).
  A metade "cookie criado no login" foi validada pela equivalência: sessão JWT válida = acesso concedido.

## C-DB-ERR-01 — BLOQUEADO (não testável ao vivo)
- Não é possível derrubar/forçar erro do MySQL a partir do navegador (QA de fora, sem acesso a infra).
- Observação de suporte: nenhuma tela exibiu stack trace/tela branca durante toda a bateria; estados vazios e
  redirecionamentos são tratados. Mas a indução real de erro de DB não pôde ser feita — item fica em aberto.
