# Endereço Digital Hub — a plataforma

Software web white-label (clone melhorado do MazyoHub) rodando em **enderecodigital.tech**,
numa VPS Hostinger (São Paulo) com Coolify. Estudo-fonte do concorrente:
`C:\Users\Eliezer\Desktop\ENDERECOHUB\ANALISE-COMPLETA.md` (+70 prints + transcrição de 2h).

## A hierarquia (3 níveis) — o coração da arquitetura

```
PLATAFORMA   = enderecodigital.tech (o software; o DONO é o Eliezer / owner da plataforma)
   │
   ├── HUB "Endereço Digital"       marca white-label #1 (tema/logo/módulos/domínio próprios)
   │      ├── Cliente: Doce Pão      workspace com módulos ligados/desligados
   │      ├── Cliente: Padaria Aroma
   │      └── ...
   │
   ├── HUB "ClinicDigital"          outro nicho/marca (criado depois)
   │      └── clientes de clínica...
   │
   └── HUB "N"                       quantos hubs quiser
```

Equivale aos 3 hubs do concorrente (MazyoHub / Hub3D / OdontoHub). Cada **hub** é uma marca
completa; cada **cliente** é um workspace dentro de um hub; cada **usuário** loga e cai no
seu escopo. O Eliezer (owner) vê e gerencia tudo, cria hubs e cadastra clientes.

## O que reaproveita (não reinventar)

O blueprint em `../site-enderecodigital/docs/multitenant/` já resolve o **nível Cliente**:
- isolamento por `negocio_id` (`lib/tenant.ts` — `scopedDb`, cofre que injeta o tenant);
- WhatsApp OFICIAL multi-tenant (`lib/embedded-signup.ts`, `webhook-multitenant.ts` —
  roteia por `phone_number_id`, descarta número desconhecido);
- super-admin + impersonação auditada (`SUPER-ADMIN.md`);
- white-label por tenant (`lib/branding.ts`).

O que **falta** e este repo adiciona:
1. **Camada HUB** acima do `negocio` (tabela `hubs`; `negocios.hub_id`).
2. **Owner da plataforma** (Eliezer) acima de tudo (papel `owner_plataforma`).
3. **Casca do produto**: workspace shell (Visão Geral + módulos), console do owner
   (Clientes, Workspaces, Hubs, Contas Claude, Tokens, Auditoria).
4. **Módulos**: Meu Site, Instagram (perfil+gerador+Canva), CRM/Funil visual, Financeiro.
5. **Motor de IA por tenant** — via **API Anthropic** com custo real medido por `negocio_id`
   (NÃO assento Team revendido: ver ANALISE seção 8.1, risco de ban). "Claude do cliente"
   só se o cliente trouxer a própria assinatura explicitamente.

## Diferenciais que mantemos sobre o concorrente
- WhatsApp **oficial** (Cloud API) em vez de QR não-oficial (sem ban).
- IA por **API Anthropic com custo medido** em vez de assentos Team (sem risco de ToS).
- **Isolamento por design** (scopedDb + RLS) em vez de "segurança por Claude".
- Super-admin **auditado** em vez de faixa verde sem trilha.

## Stack
- **Next.js 16** (App Router, TS) — mesmo padrão dos outros sistemas do dono.
- **Postgres self-hosted** na VPS (via Coolify) — driver `pg` + `DATABASE_URL`.
- **Coolify** (Docker) para build/deploy/SSL a partir de repo Git.
- Multi-hub **por domínio/host header** (um deploy serve todos os hubs).

## Infra (pronta em 13/08/2026)
- VPS: 179.198.126.197 (srv1900431), Ubuntu 24.04, 8GB, Coolify healthy.
- Domínio: enderecodigital.tech (A record → VPS, a configurar). SSL pelo Coolify.
- Acesso: SSH por chave (`~/.ssh/id_ed25519_hub`).

## Ordem de construção (do foco do dono pra fora)
- **Fase 0 — Fundação** (EM ANDAMENTO): schema 3 níveis, repo, Postgres na VPS, deploy
  esqueleto no domínio, login (owner + cliente).
- **Fase 1 — Núcleo empacotado**: workspace shell white-label + WhatsApp oficial + agente
  de IA por tenant (API Anthropic). Entregável vendável: "WhatsApp com IA + painel da marca".
- **Fase 2 — CRM/Funil próprio** + captura de leads (lead automático do WhatsApp, form no
  site, integrações), copiloto do CRM com permissões.
- **Fase 3 — Instagram + gerador Canva** (perfil+métricas via Graph API, biblioteca
  compartilhada, implantar HTML em camadas, editor, agendar/postar).
- **Fase 4 — Console Owner completo + multi-hub por domínio + dashboard de custo/ROAS.**
- **Fase 5 — Financeiro** (se fizer sentido) e escala.
