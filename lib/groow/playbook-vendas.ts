/**
 * Playbook de venda consultiva por telefone.
 *
 * Destilado de: SPIN Selling (Rackham), Armas da Persuasão (Cialdini), Never
 * Split the Difference (Voss), $100M Offers (Hormozi), Breakthrough Advertising
 * (Schwartz) e Challenger Sale.
 *
 * Serve dois consumidores ao mesmo tempo:
 *  1. os cards que o parceiro navega durante a ligação (funciona sem IA);
 *  2. o system prompt do copiloto, quando COPILOTO_IA_ATIVO estiver ligado.
 */

export interface FaseCall {
  id: string;
  titulo: string;
  objetivo: string;
  /** Falas prontas, para ler no susto. */
  falas: string[];
  /** O que indica que pode passar para a próxima fase. */
  sinalDeAvanco: string;
}

export const FASES: FaseCall[] = [
  {
    id: "abertura",
    titulo: "Abertura",
    objetivo:
      "Comprar trinta segundos de atenção sendo específico. Nada de pitch aqui: pedir permissão baixa a guarda.",
    falas: [
      "Aqui é o {seu nome}, da Endereço Digital. Peguei você no meio de alguma coisa?",
      "Vou ser direto e curto: eu ligo pra empresa de {segmento} aqui de {cidade} porque a gente resolve um problema bem específico. Em um minuto você me diz se faz sentido, pode ser?",
      "Não vim vender site. Vim entender como chega pedido pra você hoje.",
    ],
    sinalDeAvanco: "A pessoa responde uma pergunta sua em vez de dar desculpa para desligar.",
  },
  {
    id: "situacao",
    titulo: "Situação",
    objetivo:
      "Mapear como funciona hoje. Perguntas leves, sem julgamento. Quem escuta controla a conversa.",
    falas: [
      "Hoje o pedido de vocês chega mais por onde: WhatsApp, telefone, aplicativo, balcão?",
      "Quem responde esse WhatsApp no dia a dia?",
      "Vocês trabalham com iFood ou alguma plataforma parecida? Quanto ela fica por pedido?",
      "Em um dia cheio, quantas mensagens vocês recebem mais ou menos?",
    ],
    sinalDeAvanco: "Você já sabe o canal principal, quem opera e qual plataforma cobra dele.",
  },
  {
    id: "problema",
    titulo: "Problema",
    objetivo:
      "Fazer a pessoa admitir a dor com as palavras dela. Não afirme o problema, pergunte até ele aparecer.",
    falas: [
      "O que mais te incomoda nesse processo hoje?",
      "Acontece de mensagem ficar sem resposta em horário de pico?",
      "Quando você está no salão cheio, quem cuida do WhatsApp?",
      "Já perdeu pedido por demora na resposta?",
    ],
    sinalDeAvanco: "A pessoa reclamou de algo concreto sem você ter sugerido.",
  },
  {
    id: "implicacao",
    titulo: "Implicação",
    objetivo:
      "Colocar preço na dor. Esta é a fase que fecha a venda, e é a que quase todo mundo pula.",
    falas: [
      "Quantos pedidos por semana você acha que escapam por isso?",
      "Um ticket médio de vocês dá quanto, mais ou menos? Então isso é mais ou menos {conta} por mês saindo pela porta.",
      "E a comissão da plataforma, no mês fechado, dá quanto?",
      "Isso vem piorando ou está estável desde o ano passado?",
    ],
    sinalDeAvanco: "A pessoa fez a conta em voz alta, ou ficou em silêncio depois do número.",
  },
  {
    id: "visao",
    titulo: "Necessidade de solução",
    objetivo:
      "Fazer a pessoa verbalizar o ganho. Quando é ela quem descreve a solução, ela para de resistir.",
    falas: [
      "Se esse WhatsApp respondesse sozinho e já chegasse pra você com o pedido montado, o que mudaria no seu dia?",
      "Se desse pra tirar a comissão da plataforma do meio, o que você faria com esse dinheiro?",
      "Quanto valeria pra você não perder mais nenhuma mensagem em horário de pico?",
    ],
    sinalDeAvanco: "A pessoa começou a falar no futuro, usando primeira pessoa.",
  },
  {
    id: "ponte",
    titulo: "Ponte para o diagnóstico",
    objetivo:
      "Não vender na ligação. Vender o próximo passo, que é barato para ela e valioso para nós. Reciprocidade antes de pedir.",
    falas: [
      "Olha, eu não vou te empurrar nada agora. O que a gente faz primeiro é um diagnóstico da sua operação, sem custo.",
      "Você recebe o mapa do que está vazando mesmo que decida não fazer nada com a gente.",
      "Posso te mandar no WhatsApp e a gente começa por ali?",
    ],
    sinalDeAvanco: "Ela autorizou o contato. Registre a autorização palavra por palavra.",
  },
  {
    id: "fechamento",
    titulo: "Fechamento do próximo passo",
    objetivo:
      "Um único próximo passo, com data. Confirme o número em voz alta e registre no painel na hora.",
    falas: [
      "Confirma pra mim: o WhatsApp é esse mesmo, {numero}?",
      "Vou te chamar hoje ainda. Quando é melhor, antes ou depois do movimento?",
      "Fechado. Te chamo no WhatsApp {quando}, e já mando o diagnóstico começando.",
    ],
    sinalDeAvanco: "Número confirmado, horário combinado, lead registrado com opt-in.",
  },
];

export interface Objecao {
  gatilho: string;
  /** Nomear a emoção antes de responder. Técnica de rótulo do Voss. */
  rotulo: string;
  resposta: string;
  /** Pergunta calibrada: devolve o problema para a pessoa resolver. */
  pergunta: string;
}

export const OBJECOES: Objecao[] = [
  {
    gatilho: "Não tenho interesse",
    rotulo: "Parece que você já recebeu muita ligação parecida essa semana.",
    resposta:
      "Faz sentido. Eu não liguei pra te vender site, liguei porque a maioria das empresas de {segmento} aqui perde pedido no WhatsApp em horário de pico e nem enxerga isso.",
    pergunta: "Se eu estiver errado sobre isso no seu caso, você me corrige em trinta segundos?",
  },
  {
    gatilho: "Já tenho quem cuida disso",
    rotulo: "Ótimo, então você já se preocupou com isso antes.",
    resposta:
      "Não vim substituir ninguém. O diagnóstico serve justamente pra quem já tem alguém, porque mostra o que está fora do radar.",
    pergunta: "O que essa pessoa cuida hoje: o site, o WhatsApp, ou os dois?",
  },
  {
    gatilho: "Quanto custa",
    rotulo: "Você quer saber se cabe no bolso antes de gastar tempo. Justo.",
    resposta:
      "Depende do tamanho da operação, e é exatamente por isso que a primeira etapa é o diagnóstico, que não custa nada. Sem ele eu estaria chutando um número.",
    pergunta: "Qual faixa faria isso ser uma decisão fácil pra você?",
  },
  {
    gatilho: "Manda por e-mail",
    rotulo: "Entendi, agora não é a hora.",
    resposta:
      "Mando sim. Só que e-mail some, e o que eu tenho pra te mostrar é curto.",
    pergunta: "Como eu faço pra isso não morrer na caixa de entrada?",
  },
  {
    gatilho: "Preciso falar com meu sócio",
    rotulo: "Parece que essa decisão não é só sua.",
    resposta:
      "Perfeito, e o diagnóstico ajuda nisso: você leva o mapa pronto pra conversa em vez de levar uma proposta solta.",
    pergunta: "O que ele precisaria ver pra dizer que vale a pena?",
  },
  {
    gatilho: "Estou sem tempo agora",
    rotulo: "Liguei na pior hora.",
    resposta: "Sem problema, não vou tomar seu tempo agora.",
    pergunta: "Qual horário costuma ser mais tranquilo pra você, antes ou depois do movimento?",
  },
  {
    gatilho: "Já tentei isso e não funcionou",
    rotulo: "Parece que você já se queimou com promessa antes.",
    resposta:
      "Isso é comum, e quase sempre o problema não foi a ferramenta, foi ninguém ter olhado a operação antes de ligar o botão.",
    pergunta: "O que exatamente te fizeram na época?",
  },
];

/** Lembretes curtos, para a barra lateral durante a call. */
export const PRINCIPIOS = [
  "Descubra a dor antes de oferecer qualquer coisa.",
  "Quem fala mais é quem está sendo convencido. Deixe a pessoa falar.",
  "O nome dela na conversa vale mais que qualquer adjetivo sobre você.",
  "Nomeie a emoção antes de responder à objeção. Nunca discuta.",
  "Troque ordem por pergunta: use como e o quê.",
  "Perder pesa mais que ganhar. Fale do que já está escapando, não do sonho.",
  "Não venda o serviço na ligação. Venda só o próximo passo.",
  "O não não é o fim, é onde a negociação começa.",
];

/** Prompt do copiloto. Só é usado quando COPILOTO_IA_ATIVO === "1". */
export const SYSTEM_PROMPT = `Você é copiloto de vendas de um consultor da Endereço Digital durante uma ligação fria, ao vivo. Ele está com o telefone no viva voz e você recebe a transcrição parcial da conversa.

Seu trabalho é dar munição em tempo real, não resumir o que já aconteceu.

Regras:
- Responda em no máximo 3 itens, cada um com no máximo 15 palavras.
- Sempre em português do Brasil, tom direto, sem floreio.
- Nunca escreva travessão. Nunca use emoji.
- Nunca mencione que você é uma IA nem que existe um copiloto.
- Se a conversa ainda está rasa, mande pergunta de descoberta, não oferta.
- Se apareceu uma dor, mande pergunta de implicação que coloque número na dor.
- Se apareceu objeção, mande o rótulo da emoção mais uma pergunta calibrada.
- Se a pessoa já verbalizou o ganho, mande a ponte para o diagnóstico.
- Nunca sugira fechar contrato na ligação. O objetivo único é conseguir autorização para chamar no WhatsApp.

Método que você segue: SPIN (situação, problema, implicação, necessidade), rótulo e pergunta calibrada do Voss, prova e autoridade do Cialdini, e a ideia do Hormozi de reduzir esforço e risco em vez de aumentar promessa.

Formato da resposta: JSON com as chaves "fase" (uma de: abertura, situacao, problema, implicacao, visao, ponte, fechamento), "sugestoes" (lista de strings) e "alerta" (string curta ou null, para quando o consultor estiver falando demais, prometendo demais ou pulando a fase de implicação).`;
