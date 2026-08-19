# Test Plan — Fusão do Hub Endereço Digital dentro do GROOW OS

FASE 1 (só o plano; nenhuma implementação). Cada item é testável de fora via Playwright
(clicando/observando/lendo URL, banners, badges e estados vazios).

## Ambiente

- **URL base:** `https://hub.179.198.126.197.sslip.io`
- **Papel necessário:** `owner_plataforma` (a maioria dos itens). Alguns edge cases exigem um usuário NÃO-owner.
- **Como logar:** abrir `/login`, autenticar como owner. Sessão fica no cookie `ed_session` (nome interno `SESSION_COOKIE`).
- **Como entrar no hub:** a partir da God-view `/owner`, clicar em **Entrar no hub** no card "Endereço Digital"
  (ou navegar direto para `/api/hub/entrar?id=777815b4-7f3a-4813-8331-18e539111710`).
  Isso grava o cookie `ed_hub_op` com o id do hub e redireciona (303) para `/operacao`.
- **Hub de teste:** Endereço Digital — id `777815b4-7f3a-4833-...` (`777815b4-7f3a-4813-8331-18e539111710`),
  2 workspaces (**Doce Pão**, **Padaria Aroma**), dados reais no MySQL (26 leads etc.).
- **Sair do contexto do hub:** faixa "MODO OPERAÇÃO · GROOW OS" → **Voltar ao console** leva a `/owner`.
- **Logout:** avatar (canto) → **Sair** → `/logout` limpa o cookie de sessão e vai para `/login`.

## Legenda dos IDs

- `A-*` — Fluxos principais (caminho feliz, passo a passo).
- `B-*` — Não óbvios (carregamento, erro visível, teclado/foco, F5, back, clique duplo) e **REGRESSÃO** (`B-REG-*`).
- `C-*` — Edge cases (campos vazios/duplicados, tipo errado, sem resultado, sem sessão, sem contexto de hub, não-owner, erro de DB).

Marcação: `[ ]` a testar · `[x]` passou · anotar falha ao lado quando reprovar.

---

## A) Fluxos principais

### A.1 Entrar no hub (God-view → GROOW)

- [ ] A-ENTRAR-01: Em `/owner`, clicar **Entrar no hub** no card "Endereço Digital" → responde 303 e a URL final é `/operacao`; a interface GROOW aparece (sidebar navy fixa + faixa "MODO OPERAÇÃO · GROOW OS").
- [ ] A-ENTRAR-02: Após entrar, o cookie `ed_hub_op` está setado com o id do hub e a sidebar mostra o grupo **Endereço Digital** com exatamente 5 itens (Todos os hubs, Clientes, Workspaces, Contas Claude, Configurações do hub).

### A.2 Navegar por cada item do grupo HUB

- [ ] A-NAV-01: Sidebar → **Todos os hubs** → navega para `/owner` (sai da operação e volta à God-view).
- [ ] A-NAV-02: Sidebar → **Clientes** → carrega `/operacao/hub/clientes` com o título "Clientes" e a tabela de tenants do hub renderizada.
- [ ] A-NAV-03: Sidebar → **Workspaces** → carrega `/operacao/hub/workspaces` com 5 StatCards (Ativos, Em configuração, Com alertas, Integrações, Saúde média) e a tabela listando Doce Pão e Padaria Aroma.
- [ ] A-NAV-04: Sidebar → **Contas Claude** → carrega `/operacao/hub/contas-claude` com o card "API da plataforma / CENTRAL" e o formulário "Conectar conta".
- [ ] A-NAV-05: Sidebar → **Configurações do hub** → carrega `/operacao/hub/config` com o form "Identidade do hub" preenchido com o nome do hub ativo.
- [ ] A-NAV-06: Ao abrir cada rota acima, o item correspondente da sidebar fica destacado em dourado (barra dourada + `aria-current="page"`).

### A.3 Criar cliente (modal Novo cliente)

- [ ] A-CLI-01: Em `/operacao/hub/clientes`, clicar **Novo cliente** → abre o modal com título "Novo cliente" e o select **Hub** já preenchido com o primeiro hub.
- [ ] A-CLI-02: Preencher os obrigatórios (Hub + Nome da empresa) e clicar **Criar cadastro** → redireciona para `/operacao/hub/clientes?ok=1`, mostra o banner verde "Cliente cadastrado com sucesso." e a nova empresa aparece na tabela.
- [ ] A-CLI-03: Após criar, ir para `/operacao/hub/workspaces` → o mesmo cliente aparece na lista de workspaces (revalidação das duas rotas funcionou).

### A.4 Editar / arquivar workspace

- [ ] A-WS-EDIT-01: Workspaces → menu (…) de uma linha → **Editar workspace** → faz POST em `/api/impersonar` e cai no painel do cliente em `/app/config-hub` (MODO OWNER daquele workspace).
- [ ] A-WS-ARCH-01: Workspaces → menu (…) → **Arquivar** → a linha passa a exibir o badge "Arquivado"; ao filtrar por **Arquivados** ela aparece; nos filtros Ativos ela some.
- [ ] A-WS-REACT-01: Numa linha arquivada, o menu (…) mostra **Reativar** → clicar volta o status para "Ativo".

### A.5 Toggles de conta Claude

- [ ] A-CC-CONNECT-01: Contas Claude → preencher "Nome / apelido" e clicar **Conectar** → redireciona `?ok=1`, banner verde "Conta conectada." e um novo card de conta surge.
- [ ] A-CC-TOGGLE-01: Num card de conta, clicar **Tornar compartilhada / Tornar dedicada** → o badge "COMPARTILHADA" aparece/some conforme o toggle.
- [ ] A-CC-STATUS-01: Num card de conta, clicar **Desativar / Ativar** → o badge de status alterna entre "ativa" e "inativa".
- [ ] A-CC-DEL-01: Num card de conta, clicar o botão de lixeira (Excluir) → o card some da lista após o reload.

### A.6 Salvar config do hub

- [ ] A-CFG-SAVE-01: Configurações do hub → alterar Nome, Cor de destaque e Teto de IA/mês → clicar **Salvar configurações** → redireciona `?ok=1`, banner verde "Configurações salvas."; ao recarregar, os valores persistem nos campos.

### A.7 Voltar ao console / Sair

- [ ] A-BACK-01: Clicar **Voltar ao console** na faixa superior → navega para `/owner` (God-view, tema claro próprio, sem a sidebar navy da operação).
- [ ] A-LOGOUT-01: Avatar → menu de perfil → **Sair** → vai para `/logout`, o cookie de sessão é limpo e a URL final é `/login`.

---

## B) Não óbvios + regressão

### B.1 Carregamento, erro, teclado, recarga, back, clique duplo

- [ ] B-LOAD-01: Ao navegar entre as páginas do grupo HUB, o conteúdo (server-rendered) aparece sem spinner infinito e sem flash do tema claro (o script inline aplica `ed2-dark` antes da pintura).
- [ ] B-ERR-VIS-01: Em Contas Claude, tentar **Conectar** sem nome (contornando o `required`, ex.: remover o atributo via devtools e submeter) → a action redireciona com `?erro=nome`; observar se existe mensagem de erro VISÍVEL na tela. Esperado: erro claro ao usuário (a página só renderiza banner para `ok`, então a ausência de aviso é defeito a registrar).
- [ ] B-FOCUS-ESC-01: Abrir o modal "Novo cliente" e pressionar **Esc** → esperado: o modal fecha. (Hoje só fecha por clique no overlay, no X ou em Cancelar; se Esc não fechar, registrar como falha de acessibilidade.)
- [ ] B-KBD-TAB-01: No modal "Novo cliente", navegar por **Tab** pelos campos → o foco percorre os campos em ordem lógica e permanece visível; **Shift+Tab** volta.
- [ ] B-F5-01: Em `/operacao/hub/clientes`, apertar **F5** → a página recarrega, continua no hub (cookie `ed_hub_op` persiste), a tabela re-renderiza e NÃO redireciona para `/owner`.
- [ ] B-BACK-BTN-01: Navegar Clientes → Workspaces e clicar **Voltar** do navegador → retorna a `/operacao/hub/clientes` com a tabela intacta.
- [ ] B-DBLCLICK-NOVO-01: Clicar duas vezes rápido em **Novo cliente** → abre apenas UM modal (sem sobreposição/duplicação).
- [ ] B-DBLCLICK-SAVE-01: No modal, preencher e dar **duplo clique** em "Criar cadastro" → apenas UM cliente é criado (verificar que não surgem duas linhas iguais na tabela).
- [ ] B-DBLCLICK-CFG-01: Em Config, dar **duplo clique** em "Salvar configurações" → salva uma vez, sem erro/tela branca.

### B.2 Regressão (o que já existia não pode quebrar)

- [ ] B-REG-LEADS-01: `/operacao/leads` continua carregando com os dados reais (26 leads) e sem erro.
- [ ] B-REG-COB-01: `/operacao/cobrancas` continua carregando normalmente.
- [ ] B-REG-SOCIAL-01: `/operacao/conteudo-social` continua carregando normalmente.
- [ ] B-REG-OWNER-01: A God-view `/owner` continua funcionando (KPIs, cards de hub, botões Entrar no hub / Criar hub).
- [ ] B-REG-WSOWNER-01: O MODO OWNER do painel de um cliente (`/ws/[neg]`, atingido via Editar workspace → impersonar → `/app`) continua abrindo e operando.
- [ ] B-REG-LOGIN-01: Ciclo login → uso → logout funciona ponta a ponta (cookie criado no login, removido no logout).
- [ ] B-REG-THEME-OWNER-01: O design GROOW (sidebar navy, tokens `ed2`) NÃO vazou para `/owner` — a God-view mantém seu tema claro próprio (classes `card`/`kpi`), sem a sidebar da operação.
- [ ] B-REG-THEME-OP-01: O tema dark/ed2 da operação NÃO vazou para fora; o toggle de tema (`localStorage ed2-theme`) afeta só `/operacao` e não altera o `/owner`.

---

## C) Edge cases

- [ ] C-EMPTY-NOME-01: "Novo cliente" com "Nome da empresa" vazio → o `required` do HTML bloqueia o submit; se contornado, a action redireciona `?erro=dados` e o cliente NÃO é criado.
- [ ] C-DUP-NOME-01: Criar um cliente com nome já existente (ex.: "Doce Pão") → deve concluir sem erro de banco (o slug ganha sufixo curto único); as duas linhas coexistem na tabela.
- [ ] C-TEXT-IN-NUM-01: No campo numérico (Health Score no modal, ou "Teto de IA/mês (US$)" na config) digitar texto → Health Score é `type=number` e rejeita letras; no teto de IA, texto não numérico é convertido para `0` ao salvar (sem crash).
- [ ] C-SEARCH-EMPTY-01: Em Clientes, buscar por algo inexistente (ex.: "zzzznaoexiste") → a tabela mostra o estado vazio "Nenhum cliente encontrado." (e "Nenhum cliente ainda…" quando a lista realmente está vazia).
- [ ] C-FILTER-EMPTY-01: Em Workspaces, aplicar o filtro **Arquivados** quando não há nenhum arquivado → mostra "Nenhum workspace encontrado.".
- [ ] C-SESSION-EXPIRED-01: Apagar o cookie de sessão e acessar `/operacao/hub/clientes` → o middleware redireciona para `/login`.
- [ ] C-NOHUB-CLI-01: Com sessão de owner mas SEM o cookie `ed_hub_op`, acessar `/operacao/hub/clientes` → redireciona para `/owner`.
- [ ] C-NOHUB-WS-01: Idem para `/operacao/hub/workspaces` → redireciona para `/owner`.
- [ ] C-NOHUB-CC-01: Idem para `/operacao/hub/contas-claude` → redireciona para `/owner`.
- [ ] C-NOHUB-CFG-01: `/operacao/hub/config` SEM contexto de hub → NÃO redireciona (comportamento diferente dos irmãos); mostra o card de fallback "Entre em um hub para editar as configurações dele." — verificar se essa diferença é intencional.
- [ ] C-NONOWNER-OP-01: Logado como usuário NÃO-owner, acessar `/operacao` (e `/operacao/hub/*`) → o middleware/layout redireciona para `/app` (barra o acesso).
- [ ] C-NONOWNER-API-01: Usuário NÃO-owner chamando qualquer `/api/admin/*` → responde `401 {"error":"Unauthorized"}` (JSON, não HTML).
- [ ] C-ENTRAR-BADID-01: `/api/hub/entrar?id=id-invalido` → redireciona para `/owner` e NÃO grava o cookie `ed_hub_op`.
- [ ] C-ENTRAR-NOAUTH-01: `/api/hub/entrar?id=...` sem sessão → redireciona para `/login`.
- [ ] C-DB-ERR-01: Com o MySQL indisponível/erro, abrir uma página do HUB → o app degrada com estado vazio/erro elegante, sem tela branca nem stack trace exposto ao usuário.
- [ ] C-DEL-CONFIRM-01: Menu (…) → **Excluir permanentemente** (cliente ou workspace) → aparece o `confirm()` do navegador; **Cancelar** aborta e nada é excluído; confirmar remove.
