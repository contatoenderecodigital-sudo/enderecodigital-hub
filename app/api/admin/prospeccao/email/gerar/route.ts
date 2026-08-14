import { NextResponse } from "next/server";
import { calcularCustoUsd, custoEmReais } from "@/lib/groow/custo-ia";
import { registrarIA } from "@/lib/groow/ia-log";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const API = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-5";

// Base de persuasão: Desktop/EnderecoDigital/emails-prospeccao.md (destilado de Cialdini,
// SPIN, Chris Voss, Schwartz, Hormozi, Kahneman, Carnegie). O prompt não escreve email
// "bonito": escreve o ângulo certo pro nível de consciência do prospect.

const BASE = `Você escreve emails de prospecção fria da Endereço Digital, empresa de Xanxerê (SC) que
resolve a operação digital de negócios locais: site, anúncio, Google, atendimento com IA no WhatsApp e
sistema sob medida, tudo com equipe própria. Quem assina é o Eliezer, dono. O destinatário é o DONO do
negócio, achado no Google Maps, não um marketeiro.

FORMATO:
- Corpo com no máximo 130 palavras. Português do Brasil, dono pra dono, frases inteiras.
- Use {{nome}} exatamente assim, uma vez, no primeiro ou segundo parágrafo.
- Assinar com "Eliezer" e, quando o email for mais formal, "Endereço Digital" na linha de baixo.
- Última linha antes da assinatura, sempre: "Se não fizer sentido pra você, responde avisando que não
  escrevo de novo." (educação que protege a reputação do domínio)
- Assunto: máximo 45 caracteres, minúsculo natural, específico. Descreve um fato ou faz uma pergunta,
  nunca anuncia uma oferta.

PROIBIDO:
- travessão, emoji, CAIXA ALTA, ponto de exclamação.
- clichê de texto de IA ("no mundo de hoje", "é importante ressaltar", "no cenário atual").
- as palavras: grátis, gratuito, sem compromisso, promoção, oferta, oportunidade, parceria, exclusivo.
- prometer faturamento, venda ou resultado garantido. A promessa é sempre operacional.
- criticar o negócio do cara ("seu site é ruim", "seu Instagram está abandonado"). Diga o FATO observado
  ("abri no celular e demorou a carregar"), nunca o julgamento. Crítica direta fecha a pessoa.
- pedir reunião, call, telefone ou orçamento. Pedido grande mata a taxa de resposta.
- dizer que ele recebe muitos emails desses ou que o mercado está cheio de gente fazendo isso. É MENTIRA
  na região dele (Xanxerê e Chapecó, cidades pequenas) e ainda te coloca no meio de uma multidão que não
  existe. Rótulo só se for verdade.

PRINCÍPIOS QUE REGEM O TEXTO:
1. Reciprocidade só dispara se o esforço for visível. Se o email menciona algo pronto, tem que ficar
   claro que deu trabalho (o que foi coletado, quanto tempo levou).
2. O pedido final é sempre pequeno: corrigir um detalhe do texto, ou responder uma pergunta. Nunca comprar.
3. Aversão à perda vende mais que promessa de ganho. Não escreva "traga mais clientes", escreva o que já
   está vazando hoje sem ele ver.
4. Fale pro nível de consciência do prospect. Falar de produto pra quem não sabe que tem problema não converte.
5. O desejo real do dono local não é ter site: é aparecer melhor que o concorrente, não perder cliente e
   tirar trabalho das costas. O site é veículo.`;

// Cada ângulo é uma estrutura fechada. O modelo escolhe palavra, não escolhe estratégia.
const ANGULOS: Record<string, { rotulo: string; previa: boolean; instrucao: string }> = {
  padrao: {
    rotulo: "Padrão (reciprocidade + micro-sim)",
    previa: true,
    instrucao: `ÂNGULO: entrega antes da venda. O site do negócio JÁ FOI MONTADO e está esperando ele abrir.
- 1) primeiro parágrafo: diz exatamente o que você coletou do perfil dele no Google (endereço, telefone,
  horário, avaliações) e que montou uma página com isso. Mencione que levou um tempo real de trabalho.
- 2) o link {{previa}}.
- 3) diz que os dados são os dele mesmos, mas que o texto de apresentação você escreveu por fora, então
  tem coisa errada sobre o jeito dele trabalhar.
- 4) pedido único: que ele responda qual parte está errada, que você corrige hoje.
- Não fale de preço, pacote, reunião nem prazo de entrega.`,
  },
  perda: {
    rotulo: "Aversão à perda (sem site)",
    previa: true,
    instrucao: `ÂNGULO: o que ele está perdendo hoje sem saber. Estrutura problema, agita, solução.
- 1) problema concreto: quem procura o serviço dele na região acha o negócio no mapa, mas não tem pra
  onde clicar pra ver mais, então volta pro Google e clica no concorrente que tem site.
- 2) agita com o custo invisível: isso não aparece em relatório nenhum e ninguém liga pra avisar que desistiu.
- 3) a página que faltava já está montada, com os dados reais dele: {{previa}}
- 4) pedido pequeno: dizer o que está errado ali que você arruma hoje.
- Sem número inventado de perda. Nada de "você perde X clientes por mês".`,
  },
  prova: {
    rotulo: "Prova social devolvida (nota alta)",
    previa: true,
    instrucao: `ÂNGULO: devolver pra ele o que os clientes dele escrevem. É o de maior conversão.
- 1) você estava olhando negócios do ramo na região e parou nas avaliações da {{nome}}. Cite o TEOR do
  que os clientes elogiam (use exatamente o que vier nas observações do editor; se não vier nada
  específico, escreva a frase de forma que o editor só precise colar a citação entre aspas).
- 2) a virada: quem pesquisa no Google e nunca foi lá não vê nada disso, vê nome, endereço e telefone
  igual todo mundo.
- 3) você pegou as avaliações dele e montou uma página que mostra isso: {{previa}}
- 4) pedido pequeno: corrigir o que estiver errado nos dados.
- Nunca invente uma citação de avaliação. Se não houver citação real disponível, fale do teor sem aspas.`,
  },
  pegadinha: {
    rotulo: "Desarma a desconfiança (qual é a pegadinha)",
    previa: true,
    instrucao: `ÂNGULO: nomear a desconfiança antes dela virar defesa. Em cidade pequena o dono não está
cansado de email de agência, ele está desconfiado de presente sem motivo.
- 1) primeira linha nomeia isso: ele deve estar se perguntando qual é a pegadinha de alguém montar um
  site pro negócio dele sem ele pedir. Responde na hora que não tem pegadinha, e explica o motivo real:
  é mais fácil mostrar do que explicar, porque a maioria não consegue imaginar o próprio negócio na
  internet só pela conversa.
- 2) o link {{previa}}, com os dados e as avaliações do Google dele.
- 3) se não gostar, não precisa responder nada. Se gostar, dizer o que está errado no texto.
- Tom calmo e direto. Nada de defensivo nem de justificativa longa.`,
  },
  prometido: {
    rotulo: "Já prometeram e não entregaram",
    previa: true,
    instrucao: `ÂNGULO: em cidade pequena, quase todo negócio sem site já teve alguém que ficou de fazer
(conhecido, sobrinho, freelancer) e a coisa morreu no meio.
- 1) nomear isso sem culpar ninguém e sem falar mal de terceiro: se for como a maioria dos negócios
  daqui, alguém já ficou de fazer e a coisa morreu no meio, é comum e quase nunca é culpa dele.
- 2) o contraste, dito como fato e não como vantagem: você fez o contrário, montou primeiro e manda o
  link depois.
- 3) o link {{previa}}.
- 4) pedido pequeno de correção.
- Proibido comparar-se com amador ou insinuar que os outros são ruins.`,
  },
  siteVelho: {
    rotulo: "Site velho ou quebrado no celular",
    previa: true,
    instrucao: `ÂNGULO: antes, depois, ponte. O prospect já tem site, então a dor é o site atual.
- 1) o fato observado, nunca o julgamento: você abriu o site no celular e ele demora a carregar ou o
  menu desmonta na tela pequena. Como quase todo mundo procura pelo celular, quem tem pressa fecha
  antes de achar o telefone.
- 2) o depois: você refez a página do jeito que ela abriria hoje, rápida, com o contato sempre na tela.
  Link: {{previa}}
- 3) a ponte, reduzindo esforço e risco percebidos: trocar não faz perder o que ele já tem no Google, e
  quem faz a mudança é a equipe. Do lado dele é só aprovar.
- Não diga que o site atual é feio, ruim, antigo ou amador.`,
  },
  operacao: {
    rotulo: "Já tem site e anuncia (reenquadro)",
    previa: false,
    instrucao: `ÂNGULO: ensinar algo que reenquadra o problema. Esse prospect não tem dor de site.
- 1) autoridade curta na abertura: Endereço Digital, de Xanxerê, parceiros oficiais do WhatsApp
  credenciados pela Meta.
- 2) reconhece que ele já tem site e já anuncia, e diz que não veio falar disso.
- 3) o reenquadro: o gargalo de quem já chegou nesse ponto raramente é o site, é o que acontece depois
  que a pessoa chama, principalmente fora do horário. O anúncio roda o dia inteiro e o atendimento não.
- 4) fecha com UMA pergunta que ele consiga responder sem se comprometer, começando com "como" ou "o
  que". Exemplo do tipo certo: como vocês fazem hoje quando chega mensagem às nove da noite perguntando preço.
- Sem link, sem prévia, sem oferta. O email inteiro existe pra ganhar uma resposta de uma linha.`,
  },
  pergunta: {
    rotulo: "Uma pergunta só (resgate de lista fria)",
    previa: false,
    instrucao: `ÂNGULO: pergunta única de diagnóstico, pra quem não abriu nada nos toques anteriores.
- No máximo 70 palavras. Sem link nenhum (email sem link entrega melhor).
- 1) apresentação de uma linha.
- 2) a pergunta, avisando que é rápida e que você para de escrever depois: hoje, quando aparece cliente
  novo, ele chega mais por indicação ou por internet.
- 3) o motivo da pergunta, que é o que faz ele responder: muda completamente o que faz sentido fazer, e
  você não quer oferecer a coisa errada.
- Sem oferta, sem serviço citado, sem CTA além da resposta.`,
  },
};

const FIM = `

Responda SOMENTE com JSON válido:
{"assunto":"...","corpo":"texto simples com \\n\\n entre parágrafos"}`;

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY não configurada." }, { status: 500 });

  let body: { nicho?: string; cidade?: string; observacoes?: string; comPrevia?: boolean; angulo?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const chave = body.angulo && ANGULOS[body.angulo] ? body.angulo : "padrao";
  const angulo = ANGULOS[chave];

  // Ângulo que depende de prévia sem prévia gerada viraria promessa sem entrega:
  // cai pro ângulo de pergunta, que não usa link.
  const semPreviaGerada = angulo.previa && !body.comPrevia;
  const anguloFinal = semPreviaGerada ? ANGULOS.pergunta : angulo;

  const SYSTEM = BASE + "\n\n" + anguloFinal.instrucao + FIM;

  const partes = [
    `Nicho dos prospects: ${(body.nicho || "negócios locais").trim()}`,
    `Cidade: ${(body.cidade || "Xanxerê e região").trim()}`,
    "Contexto: a maioria foi encontrada no Google sem site próprio (só o perfil do Maps) ou com site abandonado.",
  ];
  if (anguloFinal.previa) partes.push("Cada destinatário tem uma prévia do próprio site já montada com os dados reais dele, esperando ele abrir. O link entra no lugar de {{previa}}.");
  if (body.observacoes?.trim()) partes.push(`Observações do editor (use como matéria-prima do texto): ${body.observacoes.trim()}`);
  partes.push("Escreva o email agora (a resposta final deve ser SÓ o JSON).");

  try {
    const t0 = Date.now();
    const res = await fetch(API, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: 1500, system: SYSTEM, messages: [{ role: "user", content: partes.join("\n") }] }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.error("[prospeccao/email/gerar]", res.status, t.slice(0, 300));
      void registrarIA({ modulo: "email-prospeccao", acao: `email ${chave}: ${body.nicho ?? ""} ${body.cidade ?? ""}`.trim(), modelo: MODEL, duracaoMs: Date.now() - t0, status: "erro", detalhe: `HTTP ${res.status}` });
      return NextResponse.json({ error: `Erro na API de IA (${res.status}).` }, { status: 502 });
    }
    const data = await res.json();
    void registrarIA({ modulo: "email-prospeccao", acao: `email ${chave}: ${body.nicho ?? ""} ${body.cidade ?? ""}`.trim(), modelo: MODEL, usage: data?.usage, duracaoMs: Date.now() - t0 });
    const blocos = (data?.content ?? []).filter((b: { type: string }) => b.type === "text");
    const texto: string = blocos.length ? blocos[blocos.length - 1].text ?? "" : "";
    const m = texto.match(/\{[\s\S]*\}/);
    if (!m) return NextResponse.json({ error: "A IA respondeu num formato inesperado. Tenta de novo." }, { status: 502 });
    const out = JSON.parse(m[0]) as { assunto?: string; corpo?: string };
    if (!out.assunto || !out.corpo) return NextResponse.json({ error: "Email veio incompleto. Tenta de novo." }, { status: 502 });

    const custoUsd = calcularCustoUsd(data?.usage);
    return NextResponse.json({
      ok: true,
      assunto: out.assunto,
      corpo: out.corpo,
      custo: custoEmReais(custoUsd),
      angulo: semPreviaGerada ? "pergunta" : chave,
      aviso: semPreviaGerada ? "Sem prévias geradas, então escrevi o email de pergunta (sem link). Gera as prévias e escreve de novo pro ângulo que você pediu." : undefined,
    });
  } catch (err) {
    console.error("[prospeccao/email/gerar]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}
