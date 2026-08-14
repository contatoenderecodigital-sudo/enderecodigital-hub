// Geração de artigo do Blog SEO via Claude API - usada pela rota manual
// (/api/admin/blog/gerar) e pelo agente diário (/api/cron/conteudo-diario).

import { calcularCustoUsd } from "@/lib/groow/custo-ia";
import { registrarIA } from "@/lib/groow/ia-log";
import { BLOG_PAUTAS } from "@/lib/groow/blog-pautas";

const API = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-5";

const SYSTEM = `Você é o redator-chefe de SEO da Endereço Digital, agência brasileira que vende
sites profissionais + tráfego pago + atendimento com IA + sistemas sob medida (software único
pro caso de cada operação, nada pré-moldado) para negócios locais (barbearias, clínicas,
restaurantes, oficinas, salões, etc.) no Brasil inteiro.

PRA QUEM O ARTIGO É (regra número zero, acima de tudo):
O leitor é o EMPREENDEDOR, dono ou gestor de QUALQUER negócio que quer vender mais: mercado,
padaria, imobiliária, loja, restaurante, clínica, academia, oficina, salão, escritório, pet,
prestador de serviço, e-commerce... todos. Ele NÃO sabe (nem quer saber) operar marketing.
Ele pesquisa dor e decisão de compra: "por que meu concorrente aparece no Google e eu não",
"quanto custa um site profissional", "vale a pena anunciar", "como automatizar o WhatsApp",
"como aparecer no Google", "IA pode atender meus clientes".
- PROIBIDO tema de operador/técnico de marketing: configurar pixel, verificação de conta,
  política do Meta/Google, API, CPM, ferramenta de gestor de tráfego. Isso atrai concorrente
  e curioso, não cliente.
- O artigo NUNCA ensina o leitor a virar marketeiro. Ele ajuda o dono a ENTENDER o problema,
  tomar a decisão certa e perceber que o caminho inteligente é ter quem faça por ele. Pode
  dar passos simples que o dono executa em minutos (responder avaliação, tirar foto melhor),
  mas o trabalho técnico aparece como "isso é o que uma equipe especializada resolve pra você".

DIFERENCIAL DA ENDEREÇO DIGITAL (use pra separar do genérico, sem virar propaganda forçada):
Quando o artigo tocar em atendimento, WhatsApp ou IA, deixe claro, de forma natural, o que separa
a Endereço Digital dos apps genéricos de "chatbot no WhatsApp":
- O WhatsApp é OFICIAL (plataforma da Meta), com a cara e o número da própria empresa, sem risco de
  bloqueio. Não é robô pirata pendurado num número qualquer.
- O atendente é INTEGRADO ao sistema da empresa (agenda, estoque, pedidos, preços): responde com a
  informação real do negócio na hora, não com resposta genérica.
- A gente constrói o "cérebro" da empresa, alimentado com tudo que um funcionário precisa saber pra
  atender (catálogo, preços, regras, horários, jeito de falar). Ele atende como quem trabalha ali,
  não como um script pronto igual pra todo mundo.
O contraste honesto: app genérico é um chatbot igual pra todos; aqui é um sistema sob medida com o
conhecimento do negócio dentro. Traga isso só quando o tema pedir, nunca force em artigo que não é
sobre atendimento.

VARIEDADE DE TEMAS (é 1 artigo por dia, 30 por mês, não pode virar disco riscado):
Alterne entre TODAS as frentes que a Endereço Digital vende e o que cerca a vida do
empreendedor: site profissional, tráfego pago no Google e no Meta, atendimento com IA no
WhatsApp, automação de vendas e follow-up, sistemas sob medida (quando planilha e app pronto
não dão conta), Google Meu Negócio e avaliações, Instagram do negócio, funil de WhatsApp,
presença digital em geral, custo/retorno de cada canal.
Alterne também o segmento dos exemplos dentro do artigo (um dia mercado, outro imobiliária,
outro restaurante...), nunca os mesmos nichos em todo artigo.

DIRETRIZES OFICIAIS DO GOOGLE (Search Essentials + guia de conteúdo útil, siga à risca;
conteúdo automatizado sem valor próprio é rebaixado nos core updates):

1. PEOPLE-FIRST: escreva pra resolver a dúvida de verdade, completo o suficiente pra pessoa
   NÃO precisar voltar ao Google. Teste mental: "alguém salvaria esse artigo nos favoritos?"
   Nada de resumo genérico que existe igual em 50 sites, sempre um ângulo próprio.
2. RESPOSTA DIRETA NO TOPO: logo no primeiro parágrafo, responda a pergunta principal em
   40-60 palavras (isso disputa featured snippet e citação em IA). Detalhe depois.
3. E-E-A-T (o Google avalia em TODA busca competitiva desde dez/2025):
   - Experiência: inclua pelo menos 2 observações de quem opera marketing pra negócio local
     no dia a dia ("o que a gente vê acontecer com barbearia que...", erros comuns reais).
   - Expertise: passos concretos e acionáveis, com o "porquê" de cada um.
   - Confiança (o sinal MAIS importante): NUNCA invente estatística ou fonte. Número só
     genérico ("a maioria", "boa parte") ou verificável. Nada de promessa garantida de resultado.
4. SEM SPAM: keyword no título, no primeiro parágrafo e em 1-2 H2s DE FORMA NATURAL, e só.
   Keyword stuffing rebaixa. Variações e sinônimos valem mais que repetição.
5. ESTRUTURA ESCANEÁVEL: H2/H3 descritivos (não slogans), parágrafos de 2-4 frases, listas
   quando enumerar. Título único e descritivo (máx 65 chars). Meta description 140-155 chars
   que gera clique sem clickbait.
6. CONVERSÃO: 1 CTA contextual no meio do artigo e 1 no final, ambos pro
   /diagnostico ("diagnóstico digital gratuito"), sutil, como próximo passo lógico, nunca
   como propaganda. Termine com FAQ de 3 perguntas REAIS que dono de negócio faz (bom pra
   "As pessoas também perguntam" e pra citação por IA).
7. Entre 1200 e 1800 palavras, português do Brasil, direto, sem jargão de agência.
7b. LINKS INTERNOS (SEO): além dos CTAs pro /diagnostico, inclua quando encaixar natural:
   1 link pra /modelos quando falar de exemplo/modelo de site, e 1-2 links pra artigos já
   publicados da lista fornecida (use exatamente o caminho /blog/slug indicado entre colchetes).
   NUNCA invente URL que não esteja na lista. Sem artigo publicado ainda? Só /diagnostico e /modelos.
7c. LOCALIZAÇÃO: NÃO cite cidades específicas (nada de Xanxerê, Chapecó, oeste catarinense ou
   qualquer outra). O público é o Brasil inteiro, então mantenha os exemplos genéricos: fale de
   "um negócio local", "uma clínica", "uma oficina" sem amarrar a nenhuma cidade. Só mencione uma
   cidade se o próprio tema do artigo exigir explicitamente.
8. ESTILO HUMANO (obrigatório): PROIBIDO travessão (—), use vírgula, dois-pontos ou ponto.
   PROIBIDO clichê de texto de IA: "no mundo de hoje", "é importante ressaltar", "vale destacar",
   "em suma", "além disso" repetido, "nesse sentido". PROIBIDO emoji e símbolos decorativos.
   NÃO repita a mesma muleta de experiência ("a gente vê", "a gente costuma") mais de 1 vez
   por artigo: varie a forma de trazer a vivência.
   Escreva como um brasileiro experiente escreve: frase curta, exemplo concreto, opinião quando couber.

FORMATO DA RESPOSTA, responda SOMENTE com JSON válido, sem markdown ao redor:
{
  "titulo": "título SEO com a keyword (máx 65 caracteres)",
  "resumo": "meta description persuasiva (140-155 caracteres)",
  "keyword_foco": "a keyword principal",
  "categoria": "slug curto da categoria (ex: marketing-local, trafego-pago, sites, ia-atendimento)",
  "corpo": "HTML do artigo usando APENAS <h2>, <h3>, <p>, <ul>, <li>, <ol>, <strong>, <em>, <a href>. Sem <h1> (o título já é o h1). Sem <html>/<body>/<head>."
}`;

export interface ArtigoGerado {
  titulo: string;
  resumo: string;
  keyword_foco: string;
  categoria: string;
  corpo: string;
  custo_usd: number;
}

// Sementes de busca alinhadas às frentes da agência: o autocomplete do Google
// devolve o que donos de negócio ESTÃO digitando agora a partir delas.
const SEMENTES_AUTOCOMPLETE = [
  "como fazer minha empresa aparecer no google",
  "quanto custa um site para",
  "vale a pena anunciar no",
  "como automatizar atendimento",
  "google meu negócio como",
  "como conseguir mais clientes para",
  "site ou instagram para",
  "ia para atender cliente",
  "como divulgar minha empresa",
  "quanto custa anunciar no google",
];

/** Autocomplete público do Google: termos que pessoas reais digitam (grátis). */
async function colherAutocomplete(): Promise<string[]> {
  // rotaciona 4 sementes por dia pra variar o cardápio sem repetir sempre
  const inicio = new Date().getDate() % SEMENTES_AUTOCOMPLETE.length;
  const sementes = Array.from({ length: 4 }, (_, i) => SEMENTES_AUTOCOMPLETE[(inicio + i) % SEMENTES_AUTOCOMPLETE.length]);
  const listas = await Promise.all(
    sementes.map(async (s) => {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 5000);
        const r = await fetch(
          `https://suggestqueries.google.com/complete/search?client=firefox&hl=pt-BR&gl=br&q=${encodeURIComponent(s)}`,
          { headers: { "user-agent": "Mozilla/5.0" }, signal: ctrl.signal }
        );
        clearTimeout(timer);
        const d = (await r.json()) as [string, string[]];
        return Array.isArray(d?.[1]) ? d[1].slice(0, 8) : [];
      } catch { return []; }
    })
  );
  return [...new Set(listas.flat())].slice(0, 30);
}

export async function gerarArtigoBlog(opts: { tema?: string; keyword?: string; observacoes?: string; titulosExistentes?: string[]; _retry?: boolean; _custoPrevio?: number }): Promise<ArtigoGerado> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada no .env, adiciona a chave e reinicia o app.");

  // modo automático: sem tema, a IA escolhe a partir do autocomplete real do Google
  const automatico = !opts.tema?.trim();
  // pesquisa web SÓ se ligada explicitamente: os resultados dela entram como
  // tokens de entrada re-processados a cada rodada interna e multiplicam o
  // custo (artigo de R$ 0,30 virou R$ 4). O autocomplete gratuito já garante
  // demanda real de busca. Religa com BLOG_PESQUISA_WEB=1 no .env.local.
  const comPesquisaWeb = automatico && process.env.BLOG_PESQUISA_WEB === "1";

  const partes: string[] = [];
  if (!automatico) {
    partes.push(`Tema do artigo: ${opts.tema!.trim()}`);
  } else {
    // Fonte primária de tema: a fila de pautas curada (ordenada por prioridade).
    // O agente escolhe a de maior prioridade ainda não publicada, em vez de
    // inventar tema aleatório. Constrói autoridade por cluster, não pilha solta.
    partes.push(
      "MODO AUTOMÁTICO. FILA DE PAUTAS PRIORITÁRIAS (escolha a PRIMEIRA de cima pra baixo " +
      "que ainda NÃO foi publicada, comparando com a lista de já publicados; escreva o artigo " +
      "sobre ela). Se um tema desta fila exigir número/estatística que você não tem com segurança, " +
      "escreva o artigo sem inventar dado, usando expressões honestas (a maioria, boa parte) e a " +
      "experiência de quem opera. NÃO pule a fila por preferência: siga a ordem.\n" +
      BLOG_PAUTAS.map((p, i) => `${i + 1}. ${p}`).join("\n")
    );
    partes.push(
      "Ajuste a palavra-chave foco pra frase exata que o dono digitaria (linguagem leiga). " +
      "Só saia da fila se TODAS as pautas já tiverem sido publicadas; nesse caso, escolha um tema " +
      "de decisão novo, no mesmo espírito (custo, 'vale a pena', 'como escolher', comparação)."
    );
    if (comPesquisaWeb) {
      partes.push(
        "Você TEM busca na web: use no máximo 2 pesquisas só pra confirmar contexto atual. " +
        "CUIDADO: notícia de portal de marketing é escrita pra marketeiro, NÃO vire artigo sobre ela."
      );
    }
    // demanda comprovada: o autocomplete do Google devolve o que pessoas
    // reais digitam HOJE. É a fonte preferencial de tema/keyword.
    const termosReais = await colherAutocomplete();
    if (termosReais.length) {
      partes.push(
        `TERMOS QUE PESSOAS REAIS ESTÃO DIGITANDO NO GOOGLE AGORA (autocomplete de hoje): ${termosReais.join(" | ")}\n` +
        "PRIORIZE escolher o tema e a palavra-chave a partir de UM desses termos (ou variação muito próxima): " +
        "eles têm demanda de busca comprovada. Só fuja da lista se nenhum servir pro leitor dono de negócio."
      );
    }
  }
  if (opts.keyword?.trim()) partes.push(`Palavra-chave foco: ${opts.keyword.trim()}`);
  else if (!automatico) partes.push("Escolha a melhor palavra-chave foco para o tema.");
  if (opts.titulosExistentes?.length) {
    partes.push(
      `Artigos já publicados (NÃO repetir tema; os que tiverem [/blog/slug] podem virar destino de link interno): ${opts.titulosExistentes.slice(0, 60).join(" | ")}`
    );
  }
  if (opts.observacoes?.trim()) partes.push(`Observações do editor: ${opts.observacoes.trim()}`);
  partes.push("Gere o artigo agora seguindo exatamente o formato JSON combinado (a resposta final deve ser SÓ o JSON).");

  const body: Record<string, unknown> = {
    model: MODEL,
    max_tokens: 12000,
    system: SYSTEM,
    messages: [{ role: "user", content: partes.join("\n") }],
  };
  if (comPesquisaWeb) {
    body.tools = [{ type: "web_search_20260209", name: "web_search", max_uses: 2, user_location: { type: "approximate", country: "BR" } }];
  }

  const t0 = Date.now();
  const res = await fetch(API, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify(body),
  });

  const acaoLog = automatico
    ? `artigo no automático (autocomplete${comPesquisaWeb ? " + pesquisa web" : ""})`
    : `artigo: ${opts.tema!.trim().slice(0, 100)}`;

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("[blog-ia] Anthropic", res.status, errText.slice(0, 400));
    void registrarIA({ modulo: "blog", acao: acaoLog, modelo: MODEL, duracaoMs: Date.now() - t0, status: "erro", detalhe: `HTTP ${res.status}` });
    throw new Error(
      res.status === 401 ? "Chave da Anthropic inválida (401). Confere a ANTHROPIC_API_KEY."
      : res.status === 429 ? "Limite de uso da API atingido (429). Tenta de novo em instantes."
      : `Erro na API de IA (${res.status}).`
    );
  }

  const data = await res.json();
  void registrarIA({ modulo: "blog", acao: acaoLog, modelo: MODEL, usage: data?.usage, duracaoMs: Date.now() - t0, detalhe: opts._retry ? "retry" : "" });
  // custo real desta chamada (tokens + buscas web), somado ao de retries anteriores
  const custoAteAqui = (opts._custoPrevio ?? 0) + calcularCustoUsd(data?.usage);
  if (data?.stop_reason === "max_tokens") {
    throw new Error("O artigo saiu longo demais e foi cortado. Tenta de novo (ou tema mais específico).");
  }
  if (data?.stop_reason === "pause_turn") {
    throw new Error("A pesquisa na web demorou mais que o normal. Tenta gerar de novo.");
  }
  // com web search o texto final é o ÚLTIMO bloco de texto (os primeiros são comentários da pesquisa)
  const blocosTexto = (data?.content ?? []).filter((b: { type: string }) => b.type === "text");
  const texto: string = blocosTexto.length ? blocosTexto[blocosTexto.length - 1].text ?? "" : "";
  const match = texto.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("A IA respondeu num formato inesperado. Tenta gerar de novo.");
  let artigo: Partial<ArtigoGerado>;
  try {
    artigo = JSON.parse(match[0]) as Partial<ArtigoGerado>;
  } catch (e) {
    // JSON malformado acontece de vez em quando - UMA nova tentativa automática
    // (importante pro cron das 6h30 rodar sem babá)
    if (!opts._retry) return gerarArtigoBlog({ ...opts, _retry: true, _custoPrevio: custoAteAqui });
    throw new Error(`JSON malformado da IA mesmo após retry: ${e instanceof Error ? e.message : "erro"}`);
  }
  if (!artigo.titulo || !artigo.corpo) {
    if (!opts._retry) return gerarArtigoBlog({ ...opts, _retry: true, _custoPrevio: custoAteAqui });
    throw new Error("Artigo veio incompleto da IA. Tenta de novo.");
  }
  return {
    titulo: artigo.titulo,
    resumo: artigo.resumo ?? "",
    keyword_foco: artigo.keyword_foco ?? opts.keyword ?? "",
    categoria: artigo.categoria ?? "marketing-local",
    corpo: artigo.corpo,
    custo_usd: custoAteAqui,
  };
}
