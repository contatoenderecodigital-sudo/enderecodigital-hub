// Prompts e chamadas de IA do módulo Conteúdo Social.
// Mesmo padrão do blog: Claude API direto, JSON estrito na resposta.

import { calcularCustoUsd } from "@/lib/groow/custo-ia";
import { registrarIA } from "@/lib/groow/ia-log";

const API = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-5";

export const PILARES = {
  "captacao-local": "Captação de clientes locais (como negócio local é achado e escolhido no Google/Instagram)",
  "prova-autoridade": "Prova e autoridade (resultados, bastidores da operação, antes/depois, como a Endereço Digital trabalha)",
  "vendas-whatsapp": "Vendas e atendimento no WhatsApp (funil, resposta rápida, IA atendente, follow-up que fecha)",
  "educacao-trafego": "Educação sobre tráfego pago (Google e Meta Ads sem enrolação, erros comuns, quando investir)",
} as const;

export type Pilar = keyof typeof PILARES;

const CONTEXTO_MARCA = `Você cria conteúdo de Instagram da Endereço Digital, agência brasileira que vende
site profissional + tráfego pago + atendimento com IA no WhatsApp + sistemas sob medida pra negócios locais
(barbearia, clínica, salão, restaurante, oficina, pet, imobiliária). Tom: direto, de dono
pra dono, sem jargão de agência, sem promessa milagrosa, português do Brasil informal-profissional.
O público é o DONO do negócio local, fala de dinheiro, cliente entrando e tempo perdido, não de "estratégia omnichannel".

ESTILO HUMANO (obrigatório em legenda, slides e roteiro): PROIBIDO travessão (—), use vírgula,
dois-pontos ou ponto. PROIBIDO clichê de texto de IA ("no mundo de hoje", "é importante ressaltar",
"vale destacar", "em suma", "nesse sentido"). PROIBIDO emoji e símbolo decorativo.

LEGENDA (fórmula da casa, 5 blocos, nesta ordem):
1) HOOK na primeira linha, máximo 8 palavras (é o que aparece antes do "ver mais");
2) contexto em 1 a 3 frases, no tom do dono, sem jargão;
3) no carrossel: linha "Arrasta pro lado" reforçando o formato;
4) UMA ação só (comentar uma palavra OU chamar no direct OU WhatsApp, nunca duas);
5) hashtags 10 a 15 misturando público + nicho + cidade, evitando as gigantes saturadas.
Sem "alavancar", "mindset", "destravar potencial", "sinergia", "caro cliente".
Sem promessa de resultado (nichos regulados: fale de confiança, método e presença).`;

async function chamarClaude(system: string, user: string, maxTokens = 6000, acao = ""): Promise<{ texto: string; custoUsd: number }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada no .env.");
  const t0 = Date.now();
  const res = await fetch(API, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    console.error("[social-ia]", res.status, t.slice(0, 400));
    void registrarIA({ modulo: "social", acao, modelo: MODEL, duracaoMs: Date.now() - t0, status: "erro", detalhe: `HTTP ${res.status}` });
    throw new Error(res.status === 401 ? "Chave da Anthropic inválida (401)." : res.status === 429 ? "Limite de uso da API (429), tenta em instantes." : `Erro na API de IA (${res.status}).`);
  }
  const data = await res.json();
  void registrarIA({ modulo: "social", acao, modelo: MODEL, usage: data?.usage, duracaoMs: Date.now() - t0 });
  // o modelo pode devolver um bloco de thinking antes do texto - pega o bloco de TEXTO
  const texto = (data?.content ?? []).find((b: { type: string }) => b.type === "text")?.text ?? "";
  return { texto, custoUsd: calcularCustoUsd(data?.usage) };
}

function extrairJson<T>(texto: string): T {
  const m = texto.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!m) throw new Error("A IA respondeu num formato inesperado. Tenta de novo.");
  return JSON.parse(m[0]) as T;
}

export interface IdeiaGerada {
  pilar: Pilar;
  tipo: "reel" | "carrossel" | "story";
  hook: string;
  descricao: string;
  formato: string;
}

/** Gera a pauta: N ideias distribuídas pelos pilares. */
export async function gerarPauta(qtd = 24, observacoes = ""): Promise<IdeiaGerada[]> {
  const system = `${CONTEXTO_MARCA}

Gere ideias de post no formato de card de pauta: um HOOK forte (a primeira frase que segura o dedo),
uma descrição de 1-2 frases do que o conteúdo entrega, o tipo (reel, carrossel ou story) e o formato
de gravação/montagem (ex.: "Talking Head", "B-Roll + Mini aula", "UGC + Storytelling", "Print + narração").

Regras:
- Distribui as ideias de forma equilibrada entre os 4 pilares: ${Object.entries(PILARES).map(([k, v]) => `${k} (${v})`).join("; ")}.
- Hooks concretos com situação real e número quando couber ("Seu concorrente responde em 4 minutos. Você demora 3 horas.").
- NADA de hook genérico tipo "5 dicas de marketing".
- Mistura: ~50% reel, ~35% carrossel, ~15% story.

Responda SOMENTE com JSON válido:
{"ideias":[{"pilar":"captacao-local","tipo":"reel","hook":"...","descricao":"...","formato":"..."}]}`;
  const user = `Gere ${qtd} ideias agora.${observacoes ? ` Observações do editor: ${observacoes}` : ""}`;
  const r = await chamarClaude(system, user, 8000, `pauta: ${qtd} ideias`);
  const out = extrairJson<{ ideias: IdeiaGerada[] }>(r.texto);
  return (out.ideias ?? []).filter((i) => i.hook && i.tipo && i.pilar in PILARES);
}

export interface SlideCarrossel {
  tipo: "capa" | "conteudo" | "cta";
  titulo: string;
  texto?: string;
  destaque?: string; // frase/numero em destaque dourado
}
export interface ConteudoCarrossel {
  titulo: string;
  slides: SlideCarrossel[];
  legenda: string;
  hashtags: string;
}
export interface ConteudoReel {
  titulo: string;
  gancho: string;       // 0-3s
  roteiro: { tempo: string; fala: string; cena: string }[];
  cta: string;
  legenda: string;
  hashtags: string;
}

/** Gera o conteúdo completo de uma ideia (carrossel ou reel/story). */
export async function gerarConteudo(ideia: { tipo: string; hook: string; descricao: string | null; formato: string; pilar: string }): Promise<{ titulo: string; corpo: string; legenda: string; hashtags: string; custo_usd: number }> {
  if (ideia.tipo === "carrossel") {
    const system = `${CONTEXTO_MARCA}

Gere um CARROSSEL de Instagram (7 a 9 slides, formato 1080x1350).
Estrutura: slide 1 = capa (só o hook reescrito forte, curto, máx 12 palavras + um subtítulo de apoio);
slides do meio = conteúdo (título curto de até 8 palavras + texto de 20-45 palavras, 1 ideia por slide,
use "destaque" pra número/frase de impacto quando couber);
último slide = CTA (convite pro diagnóstico gratuito no link da bio / WhatsApp).

Em cada slide de conteúdo onde uma FOTO agregaria, inclua "foto_prompt": prompt EM INGLÊS
seguindo À RISCA este contrato de estilo (é o que separa foto de agência de imagem com cara de IA):
- PROIBIDO rosto e pessoa inteira ou de corpo: rosto gerado denuncia IA na hora.
  Elemento humano SÓ como detalhe sem rosto: mãos digitando, mão segurando objeto, silhueta desfocada ao fundo.
- Prefira STILL LIFE e ambiente do negócio: balcão, mesa de trabalho, celular apoiado com tela desfocada,
  caderno, ferramenta ou objeto típico do nicho do slide, vitrine, detalhe do espaço.
- Molde do prompt: "premium editorial still life photography, [CENA], directional natural window light,
  soft shadows, warm neutral palette, generous negative space, shallow depth of field,
  subtle 35mm film grain, photorealistic, no people, no faces, no text, no logos, no watermark"
  (troque "no people, no faces" por "hands only, no face visible" quando usar mãos).
- NUNCA: pessoa olhando celular com cara de preocupada, aperto de mão, escritório genérico de banco de imagem.
Onde foto não agrega, omita o campo.

Responda SOMENTE com JSON válido:
{"titulo":"...","slides":[{"tipo":"capa","titulo":"...","texto":"..."},{"tipo":"conteudo","titulo":"...","texto":"...","destaque":"...","foto_prompt":"..."},{"tipo":"cta","titulo":"...","texto":"..."}],"legenda":"legenda pronta seguindo a fórmula de 5 blocos","hashtags":"#... #... (10-15 hashtags nicho + cidade BR)"}`;
    const user = `Hook aprovado: "${ideia.hook}"\nO que o conteúdo entrega: ${ideia.descricao ?? ""}\nPilar: ${ideia.pilar}`;
    const r = await chamarClaude(system, user, 6000, `carrossel: ${ideia.hook.slice(0, 80)}`);
    const out = extrairJson<ConteudoCarrossel>(r.texto);
    return { titulo: out.titulo, corpo: JSON.stringify({ slides: out.slides }), legenda: out.legenda ?? "", hashtags: out.hashtags ?? "", custo_usd: r.custoUsd };
  }

  // reel ou story
  const system = `${CONTEXTO_MARCA}

Gere um ROTEIRO de ${ideia.tipo === "story" ? "story (sequência de 3-5 telas verticais)" : "reel de 30-45 segundos"}.
Formato de gravação: ${ideia.formato || "Talking Head"}.
Estrutura: gancho falado nos primeiros 3 segundos (reescreve o hook pra linguagem falada),
roteiro em blocos com tempo, fala e o que aparece na cena, e CTA final.

Responda SOMENTE com JSON válido:
{"titulo":"...","gancho":"...","roteiro":[{"tempo":"0-3s","fala":"...","cena":"..."}],"cta":"...","legenda":"...","hashtags":"#... (8-12)"}`;
  const user = `Hook aprovado: "${ideia.hook}"\nO que o conteúdo entrega: ${ideia.descricao ?? ""}\nPilar: ${ideia.pilar}`;
  const r = await chamarClaude(system, user, 5000, `${ideia.tipo}: ${ideia.hook.slice(0, 80)}`);
  const out = extrairJson<ConteudoReel>(r.texto);
  return { titulo: out.titulo, corpo: JSON.stringify({ gancho: out.gancho, roteiro: out.roteiro, cta: out.cta }), legenda: out.legenda ?? "", hashtags: out.hashtags ?? "", custo_usd: r.custoUsd };
}
