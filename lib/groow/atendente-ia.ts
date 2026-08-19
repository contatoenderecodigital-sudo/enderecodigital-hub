// Atendente de IA NATIVO do WhatsApp: quando IA_NATIVA=1, o próprio servidor
// responde o cliente usando a Claude API (a mesma chave do blog), sem depender
// do n8n estar montado. É o caminho à prova de bala pra demo.
//
// Fluxo: webhook recebe mensagem -> responderComIA() pega o histórico da
// conversa, chama o Claude com o cérebro de atendente da Endereço Digital,
// envia a resposta pelo número oficial e grava como origem 'ai'. Se o cliente
// pede humano ou o assunto foge do script, faz handoff (a conversa vira 'Você'
// no admin e a IA silencia até alguém devolver).
import { query, exec } from "@/lib/groow/db";
import { sendWhatsAppText } from "@/lib/groow/whatsapp";
import { registrarIA } from "@/lib/groow/ia-log";
import { calcularCustoUsd } from "@/lib/groow/custo-ia";
import { getBaseConhecimento } from "@/lib/groow/ia-base";

const API = "https://api.anthropic.com/v1/messages";
// Atendimento é tarefa simples (confirmar pedido, agendar, tirar dúvida): o
// Haiku dá conta e custa ~3x menos que o Sonnet. Pra deixar mais esperto num
// nicho difícil, é só pôr WHATSAPP_IA_MODELO=claude-sonnet-5 no .env.local.
const MODEL = process.env.WHATSAPP_IA_MODELO || "claude-haiku-4-5";

const SYSTEM = `Você é a atendente virtual da Endereço Digital, que constrói e opera presença digital
pra negócios: site profissional, tráfego pago no Google e no Meta, atendimento com IA no WhatsApp,
automações e sistemas sob medida.

NÃO fique citando localização nem frases tipo "atende o Brasil inteiro": soa a folheto. Só fale de
onde a empresa fica se a pessoa perguntar (a sede é em Xanxerê SC e o atendimento é todo remoto).

SEU PAPEL: atender quem chama no WhatsApp de forma humana e consultiva, entender o que o negócio
da pessoa precisa e conduzir pro diagnóstico digital gratuito (é o primeiro passo, sem compromisso).
Você NÃO é vendedora insistente: é uma pessoa prestativa que entende do assunto.

COMO CONVERSAR:
- Português do Brasil, tom de gente de verdade, frases curtas. Trate por você.
- Primeira mensagem: cumprimente, se apresente em 1 linha e pergunte sobre o negócio da pessoa
  (que tipo de negócio, o que ela quer resolver: aparecer no Google, vender mais, atender melhor).
- Faça UMA pergunta por vez. Não despeje tudo de uma vez.
- Quando entender a dor, explique em 2-3 frases como a Endereço Digital resolve aquilo e convide
  pro diagnóstico gratuito (a pessoa responde algumas perguntas e recebe uma análise real do que
  está travando o negócio dela). Link: enderecodigital.com/diagnostico
- Preço: NUNCA cite valor fechado. Diga que depende do caso e que o diagnóstico gratuito é o passo
  pra montar a proposta certa.

ESTILO (obrigatório): PROIBIDO travessão (—), use vírgula, dois-pontos ou ponto. PROIBIDO emoji.
PROIBIDO clichê de robô ("como posso ajudar hoje?", "estou aqui para auxiliar"). Fale como brasileiro fala.
Máximo 60 palavras por resposta: é WhatsApp, não e-mail.

QUANDO PASSAR PRO HUMANO: se a pessoa pedir falar com uma pessoa/atendente/humano, reclamar,
falar de cobrança de contrato existente, ou fizer uma pergunta técnica muito específica que você
não tem como responder com segurança, responda APENAS com a tag [HUMANO] seguida de um motivo curto.
Ex: [HUMANO] cliente pediu falar com uma pessoa. Nesse caso não escreva mais nada.`;

interface MsgHist { origem: string; texto: string | null }

// Contexto do CRM: quem é esse número no banco. Cria o lead se for a primeira
// vez (todo contato do zap entra no CRM) e vincula a conversa a ele. Nunca
// pode quebrar a resposta da IA, então tudo é defensivo.
async function contextoCRM(conversaId: number, whatsapp: string): Promise<string> {
  const dig = whatsapp.replace(/\D/g, "");
  const nucleo = dig.slice(-8); // últimos 8 dígitos: robusto a variação de DDI/DDD
  const limpa = (col: string) =>
    `REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(${col},''),'+',''),'-',''),' ',''),'(','')`;
  try {
    // nome do perfil que já está na conversa (veio da Meta)
    const conv = await query<{ nome: string | null; lead_id: number | null }>(
      `SELECT nome, lead_id FROM wa_conversas WHERE id = $1 LIMIT 1`, [conversaId]
    );
    const nomePerfil = conv[0]?.nome?.trim() || "";

    // Só `telefone`: a tabela leads não tem coluna `whatsapp` (é por isso que o
    // buildLeadSelect de queries.ts faz o mapeamento). Buscar por ela quebrava.
    const leads = await query<{ id: number; nome: string; empresa: string | null; setor: string | null; cidade: string | null; status: string; notas: string | null }>(
      `SELECT id, nome, empresa, setor, cidade, status, notas FROM leads
       WHERE ${limpa("telefone")} LIKE $1
       ORDER BY id DESC LIMIT 1`,
      [`%${nucleo}%`]
    );

    if (leads[0]) {
      const l = leads[0];
      if (conv[0] && conv[0].lead_id !== l.id) {
        await exec(`UPDATE wa_conversas SET lead_id = $1 WHERE id = $2`, [l.id, conversaId]).catch(() => {});
      }
      const p = [`nome: ${l.nome}`];
      if (l.empresa) p.push(`empresa: ${l.empresa}`);
      if (l.setor) p.push(`ramo: ${l.setor}`);
      if (l.cidade) p.push(`cidade: ${l.cidade}`);
      p.push(`situação no funil: ${l.status}`);
      if (l.notas) p.push(`notas internas da equipe: ${l.notas}`);
      return `\n\nCONTEXTO DO CRM (esse contato JÁ está no sistema, use pra personalizar: chame pela primeira letra do nome ou pelo nome, não peça de novo dados que já temos): ${p.join(", ")}.`;
    }

    // primeiro contato: cria lead novo (todo mundo do zap vira lead)
    const nome = nomePerfil || `WhatsApp ${dig.slice(-4)}`;
    // Com RETURNING id o insert já devolve o lead criado. O código antigo
    // inseria e depois refazia uma busca porque o mysql2 não expunha o id pelo
    // query(); essa segunda ida ao banco deixou de existir.
    const r = await exec(
      `INSERT INTO leads (nome, telefone, origem, status)
       VALUES ($1, $2, 'whatsapp', 'novo') RETURNING id`,
      [nome.slice(0, 120), dig]
    ).catch(() => ({ insertId: 0, affectedRows: 0 }));
    const leadId = r.insertId || null;
    if (leadId && conv[0]) {
      await exec(`UPDATE wa_conversas SET lead_id = $1 WHERE id = $2`, [leadId, conversaId]).catch(() => {});
    }
    return `\n\nCONTEXTO DO CRM: primeiro contato desse número, acabei de criar um lead novo pra ele no sistema${nomePerfil ? ` (nome do perfil: ${nomePerfil})` : ""}. Descubra na conversa o tipo de negócio e o que ele precisa.`;
  } catch (e) {
    console.error("[atendente-ia] contextoCRM", e);
    return "";
  }
}

/**
 * Núcleo: GERA o texto da resposta da IA (não envia nada). É reusado tanto pela
 * resposta automática quanto pelo botão "Chamar IA" do inbox. Retorna:
 *   { texto, handoff: null }  -> resposta pronta
 *   { texto: "", handoff }     -> a IA acha que um humano deve responder
 *   null                        -> não deu pra gerar (sem chave, sem histórico, erro)
 */
export async function gerarRespostaIA(
  conversaId: number,
  whatsapp: string,
  acao = "resposta WhatsApp"
): Promise<{ texto: string; handoff: string | null } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { console.error("[atendente-ia] sem ANTHROPIC_API_KEY"); return null; }

  // histórico recente da conversa, ordem cronológica. 40 linhas porque com os
  // balões cada balão vira uma linha: 16 cobria só 3-4 rodadas e a IA esquecia
  // o que o cliente já tinha respondido (ex.: quantas pessoas na festa)
  const hist = await query<MsgHist>(
    `SELECT origem, texto FROM wa_mensagens
     WHERE conversa_id = $1 AND origem IN ('user','ai','humano') AND texto IS NOT NULL
     ORDER BY id DESC LIMIT 40`,
    [conversaId]
  );
  const brutos = hist
    .reverse()
    .map((m) => ({ role: m.origem === "user" ? "user" : "assistant", content: m.texto as string }));
  // a API exige alternância user/assistant: balões seguidos (nossos ou do
  // cliente) viram um turno só, senão a chamada é recusada
  const messages: { role: string; content: string }[] = [];
  for (const m of brutos) {
    const ant = messages[messages.length - 1];
    if (ant && ant.role === m.role) ant.content += `\n\n${m.content}`;
    else messages.push({ ...m });
  }
  // começa no cliente e termina no último turno do cliente: tira respostas
  // nossas penduradas nas pontas (deixa a IA responder o que ele falou por último)
  while (messages.length && messages[0].role !== "user") messages.shift();
  while (messages.length && messages[messages.length - 1].role !== "user") messages.pop();
  if (!messages.length) return null;

  // a IA não tem relógio: sem isso ela chuta saudação e data ("esse mês" virava
  // qualquer mês). Data e hora reais de Brasília entram no prompt de sistema.
  const agora = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full", timeStyle: "short", timeZone: "America/Sao_Paulo",
  }).format(new Date());
  const ctxTempo = `\n\nAGORA É: ${agora}, horário de Brasília. Use isso pra saudação (bom dia até 12h, boa tarde até 18h, boa noite depois) e pra converter datas relativas do cliente ("esse mês", "amanhã", "semana que vem") em DD/MM/AAAA. NUNCA chute mês ou ano.`;

  // injeta o que o sistema sabe desse contato (e cria/vincula o lead)
  const crm = await contextoCRM(conversaId, whatsapp);
  // e a base de conhecimento do negócio (cardápio, preços, horários, regras)
  const base = await getBaseConhecimento();
  const baseBloco = base
    ? `\n\nBASE DE CONHECIMENTO DO NEGÓCIO (use pra responder com precisão; se a resposta está aqui, responda direto sem inventar):\n${base}`
    : "";

  const t0 = Date.now();
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        // prompt caching: a parte fixa (persona + cérebro) é idêntica em toda
        // chamada e fica no cache da Anthropic por 5 min, cobrada a 10% do preço
        // nas repetições. Hora e CRM mudam a cada chamada, então ficam FORA do
        // bloco cacheado (dentro, invalidariam o cache inteiro toda vez).
        system: [
          { type: "text", text: SYSTEM + baseBloco, cache_control: { type: "ephemeral" } },
          { type: "text", text: ctxTempo + crm },
        ],
        messages,
      }),
    });
    if (!res.ok) {
      console.error("[atendente-ia] Anthropic", res.status);
      void registrarIA({ modulo: "atendimento", acao, modelo: MODEL, duracaoMs: Date.now() - t0, status: "erro", detalhe: `HTTP ${res.status}` });
      return null;
    }
    const data = await res.json();
    void registrarIA({ modulo: "atendimento", acao, modelo: MODEL, usage: data?.usage, duracaoMs: Date.now() - t0 });
    const bloco = (data?.content ?? []).filter((b: { type: string }) => b.type === "text");
    const resposta = (bloco[bloco.length - 1]?.text ?? "").trim();
    if (!resposta) return null;

    if (/^\[HUMANO\]/i.test(resposta)) {
      const motivo = resposta.replace(/^\[HUMANO\]\s*/i, "").slice(0, 118) || "atendimento humano";
      return { texto: "", handoff: motivo };
    }
    return { texto: resposta, handoff: null };
  } catch (err) {
    console.error("[atendente-ia] gerar", err);
    return null;
  }
}

/**
 * Gera UMA mensagem de retomada (follow-up) pro cliente que parou de responder.
 * Curta, natural, sem cobrar. Não envia, só devolve o texto. Usada pelo worker
 * de follow-up automático. Retorna null se não der.
 */
export async function gerarFollowupIA(conversaId: number, whatsapp: string, toque: number): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const hist = await query<MsgHist>(
    `SELECT origem, texto FROM wa_mensagens
     WHERE conversa_id = $1 AND origem IN ('user','ai','humano') AND texto IS NOT NULL
     ORDER BY id DESC LIMIT 12`,
    [conversaId]
  );
  if (!hist.length) return null;
  const transcript = hist.reverse()
    .map((m) => `${m.origem === "user" ? "Cliente" : "Você"}: ${m.texto}`)
    .join("\n");

  const base = await getBaseConhecimento();
  // mesmo texto do bloco fixo da resposta normal: bytes idênticos = cache
  // compartilhado entre atendimento e follow-up
  const baseBloco = base
    ? `\n\nBASE DE CONHECIMENTO DO NEGÓCIO (use pra responder com precisão; se a resposta está aqui, responda direto sem inventar):\n${base}`
    : "";
  const tarefa = `\n\nTAREFA AGORA: o cliente parou de responder. Escreva UMA mensagem curta de retomada pra trazer ele de volta.
Regras: no máximo 22 palavras, tom leve, sem cobrar, sem "tudo bem?" genérico, puxe gancho do que já foi conversado.
${toque >= 2 ? "Este é o último toque: seja gentil e deixe a porta aberta sem insistir." : ""}
Responda SOMENTE com a mensagem, nada mais.`;
  const system = [
    { type: "text", text: SYSTEM + baseBloco, cache_control: { type: "ephemeral" } },
    { type: "text", text: tarefa },
  ];

  const t0 = Date.now();
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: 120, system, messages: [{ role: "user", content: `Conversa até agora:\n${transcript}\n\nEscreva só a mensagem de retomada.` }] }),
    });
    if (!res.ok) {
      void registrarIA({ modulo: "atendimento", acao: "follow-up", modelo: MODEL, duracaoMs: Date.now() - t0, status: "erro", detalhe: `HTTP ${res.status}` });
      return null;
    }
    const data = await res.json();
    void registrarIA({ modulo: "atendimento", acao: "follow-up", modelo: MODEL, usage: data?.usage, duracaoMs: Date.now() - t0 });
    const bloco = (data?.content ?? []).filter((b: { type: string }) => b.type === "text");
    const txt = (bloco[bloco.length - 1]?.text ?? "").trim();
    return txt || null;
  } catch (err) {
    console.error("[atendente-ia] follow-up", err);
    return null;
  }
}

// Envia a resposta da IA em balões separados: cada bloco separado por linha em
// branco vira uma mensagem própria no WhatsApp (parece pessoa digitando, não um
// textão). Sem atraso artificial entre balões: o próprio envio sequencial espaça.
async function enviarEmBaloes(conversaId: number, whatsapp: string, texto: string): Promise<void> {
  const partes = texto.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  // trava de segurança: no máximo 5 balões; o excedente vai junto no último
  const baloes = partes.length > 5 ? [...partes.slice(0, 4), partes.slice(4).join("\n\n")] : partes;
  let ultimo = "";
  for (const parte of baloes) {
    const { wamid } = await sendWhatsAppText(whatsapp, parte);
    await query(
      `INSERT INTO wa_mensagens (conversa_id, origem, tipo, texto, wamid, status_entrega) VALUES ($1, 'ai', 'text', $2, $3, 'sent')`,
      [conversaId, parte, wamid]
    );
    ultimo = parte;
  }
  if (ultimo) {
    await query(`UPDATE wa_conversas SET ultima_mensagem = $1, ultima_mensagem_em = NOW() WHERE id = $2`, [ultimo.slice(0, 500), conversaId]);
  }
}

// Trava por conversa: o webhook dispara uma resposta PRA CADA mensagem do
// cliente, então rajada ("oi" + "queria salgados") gerava duas respostas
// simultâneas, com saudação dupla e pergunta repetida.
const conversasRespondendo = new Set<number>();

async function ultimaMsg(conversaId: number): Promise<{ id: number; origem: string } | null> {
  const rows = await query<{ id: number; origem: string }>(
    `SELECT id, origem FROM wa_mensagens
     WHERE conversa_id = $1 AND origem IN ('user','ai','humano') AND texto IS NOT NULL
     ORDER BY id DESC LIMIT 1`,
    [conversaId]
  );
  return rows[0] ?? null;
}

export async function responderComIA(conversaId: number, whatsapp: string): Promise<void> {
  if (conversasRespondendo.has(conversaId)) return; // já tem resposta a caminho
  conversasRespondendo.add(conversaId);
  try {
    let referencia: { id: number; origem: string } | null = null;
    let r: { texto: string; handoff: string | null } | null = null;
    // espera a rajada do cliente terminar e regenera se chegar mensagem nova no
    // meio da geração: uma resposta só, já com tudo que ele mandou
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      await new Promise((res) => setTimeout(res, 4000));
      referencia = await ultimaMsg(conversaId);
      if (!referencia || referencia.origem !== "user") return; // nada novo pra responder
      r = await gerarRespostaIA(conversaId, whatsapp);
      if (!r) return;
      const depois = await ultimaMsg(conversaId);
      if (depois && depois.id === referencia.id) break; // ninguém falou no meio: pode enviar
      r = null; // chegou mensagem nova: gera de novo com o contexto completo
    }
    if (!r) return;
    await enviarResposta(conversaId, whatsapp, r);
  } finally {
    conversasRespondendo.delete(conversaId);
  }
  // se o cliente mandou algo enquanto a resposta saía, atende essa sobra agora
  const sobra = await ultimaMsg(conversaId).catch(() => null);
  if (sobra && sobra.origem === "user") void responderComIA(conversaId, whatsapp);
}

async function enviarResposta(
  conversaId: number,
  whatsapp: string,
  r: { texto: string; handoff: string | null }
): Promise<void> {

  // a IA pediu humano: faz handoff e avisa o cliente com uma linha educada
  if (r.handoff) {
    await query(
      `UPDATE wa_conversas SET status = 'handed_off', handoff_em = NOW(), handoff_motivo = $1, nao_lidas = nao_lidas + 1 WHERE id = $2`,
      [r.handoff, conversaId]
    );
    await query(`INSERT INTO wa_mensagens (conversa_id, origem, tipo, texto) VALUES ($1, 'sistema', 'text', $2)`, [conversaId, `IA transferiu: ${r.handoff}`]);
    const aviso = "Perfeito, vou chamar alguém da equipe pra te atender por aqui. Só um instante.";
    try {
      const { wamid } = await sendWhatsAppText(whatsapp, aviso);
      await query(`INSERT INTO wa_mensagens (conversa_id, origem, tipo, texto, wamid, status_entrega) VALUES ($1, 'ai', 'text', $2, $3, 'sent')`, [conversaId, aviso, wamid]);
    } catch { /* fora da janela: humano assume pelo painel mesmo */ }
    return;
  }

  // resposta normal: envia em balões e grava cada um
  try {
    await enviarEmBaloes(conversaId, whatsapp, r.texto);
  } catch (err) {
    console.error("[atendente-ia] enviar", err);
  }
}

// custo só pra manter simetria; calcularCustoUsd é usado dentro do registrarIA
void calcularCustoUsd;
