# Publicação no Coolify

Este roteiro deixa o **MeuBarbeiro** pronto para publicar sem expor segredos e sem alterar o banco de produção automaticamente.

## Antes de criar o recurso

1. Faça o merge/commit da versão aprovada no repositório conectado ao Coolify.
2. Confirme que o banco PostgreSQL já está acessível pela rede interna do Coolify.
3. Gere um segredo novo para sessão (por exemplo, `openssl rand -hex 32`). Não reutilize o valor de desenvolvimento.
4. Execute os testes locais descritos em [Validação](#validação) antes do primeiro deploy.

## Criar a aplicação

No Coolify, crie uma aplicação a partir do repositório Git e selecione a branch que será publicada.

- **Build pack:** Dockerfile
- **Dockerfile:** `Dockerfile` na raiz do projeto
- **Porta exposta:** `3000`
- **Health check:** `/api/health`

O Dockerfile já gera a saída standalone do Next.js e inicia o servidor em `0.0.0.0:3000`. Não é necessário definir um comando de inicialização manual.

## Variáveis obrigatórias

Cadastre as variáveis diretamente no Coolify, nunca no Git:

| Variável | Uso |
| --- | --- |
| `DATABASE_URL` | Conexão PostgreSQL. Dentro do Coolify, use o hostname interno do serviço de banco. |
| `SESSION_SECRET` | Segredo longo e exclusivo para assinar a sessão. |
| `APP_URL` | URL pública definitiva, com `https://`. |

`BOOTSTRAP_TOKEN`, `OWNER_EMAIL` e `OWNER_PASSWORD` só são necessários no primeiro bootstrap de uma instalação vazia. Após o uso, remova `BOOTSTRAP_TOKEN` e não deixe senha inicial reutilizável no ambiente.

As variáveis de WhatsApp e de IA permanecem vazias nesta etapa. Elas serão configuradas depois da validação do produto e do domínio.

## Banco e migrações

Não habilite migrações automáticas no processo de build ou startup. Primeiro faça backup do PostgreSQL e aplique a migração correspondente manualmente, com confirmação do responsável pelo banco. Em seguida, valide os dados de uma barbearia de teste antes de apontar clientes reais para a nova versão.

## Domínio

Adicione o domínio no recurso, ative HTTPS automático e atualize `APP_URL` com a mesma URL. Depois confira:

- `https://SEU-DOMINIO/api/health` retorna `{ "ok": true }`;
- login e painel funcionam;
- a página pública `https://SEU-DOMINIO/agendar/SEU-SLUG` abre sem login;
- um agendamento de teste aparece na agenda da barbearia.

## Validação

No diretório do projeto, rode:

```powershell
node node_modules/typescript/bin/tsc --noEmit --incremental false
node --test testes/agenda.test.mjs testes/meubarbeiro-financeiro.test.cjs testes/agenda-produtos.test.mjs
node node_modules/next/dist/bin/next build
```

O último comando simula a compilação que o Docker executará. Se algum deles falhar, não publique até corrigir a causa.

## Próxima etapa: WhatsApp

Depois do deploy estável, configure separadamente as credenciais da API oficial do WhatsApp (`WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_WABA_ID`, `WHATSAPP_VERIFY_TOKEN` e `WHATSAPP_APP_SECRET`). Use um número de teste e modelos aprovados antes de ativar qualquer disparo para clientes.
