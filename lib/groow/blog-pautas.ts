// Fila de pautas do blog, priorizada por intenção de compra + brecha competitiva.
// O agente diário (blog-ia.ts) puxa daqui em ordem, escrevendo a de maior
// prioridade que ainda não foi publicada, em vez de inventar tema aleatório.
//
// Fonte: estratégia de SEO local/GEO (doc 05). As pautas de "dados próprios"
// (que exigem número real de conversas de clientes) ficam de fora daqui porque
// dependem de dado que só a equipe produz, não a IA. Elas entram manualmente
// quando os dados existirem.
//
// A lista está em ordem de prioridade: quanto mais no topo, mais perto de quem
// contrata. Adicione, remova ou reordene à vontade.

export const BLOG_PAUTAS: string[] = [
  // Tier 1 — custo e decisão (quem busca está perto de contratar)
  "Quanto custa, por mês, uma mensagem de WhatsApp que ninguém respondeu",
  "Contratar mais uma atendente ou automatizar: a conta real",
  "O que custa de verdade uma pessoa só pra responder WhatsApp",
  "Quanto custa automatizar o atendimento de uma empresa",
  "Vale a pena colocar IA pra atender no WhatsApp da minha empresa?",
  "Quantas horas por semana o dono perde fazendo o que um sistema resolvia",
  "Automação com IA: quanto custa, o que entra e o que não entra no preço",
  "Quanto custa digitar nota fiscal na mão (a conta que ninguém faz)",
  "Preciso trocar de sistema pra ter automação? Não, e aqui está o porquê",
  "Quanto de faturamento fica parado em orçamento sem follow-up",

  // Tier 2 — comparação e escolha
  "Chatbot, atendente virtual e agente de IA: a diferença na prática",
  "WhatsApp Business, API oficial e robô de WhatsApp: qual você precisa",
  "Por que a maioria dos robôs de WhatsApp é irregular pelo Meta",
  "Montar sozinho ou contratar automação: o que trava na prática",
  "Agência de marketing ou estúdio de software: quem resolve o seu caso",
  "Sistema pronto ou sob medida: como decidir sem gastar errado",
  "IA que responde x IA que resolve: a diferença que muda o resultado",
  "Estagiário, terceirizado ou automação: comparativo honesto",

  // Tier 3 — segmento x território (alto reconhecimento)
  "Como uma imobiliária usa IA pra só receber lead quente",
  "Corretor de imóveis: como responder anúncio em segundos sem ficar no celular",
  "Escritório de contabilidade: como parar de digitar documento de cliente",
  "Contabilidade: como responder as mesmas 20 dúvidas de cliente sem ocupar a equipe",
  "Clínica e consultório: como a agenda enche sem ninguém ligar",
  "Clínica: como reduzir falta com confirmação e lembrete automático",
  "Advocacia: atendimento inicial e triagem de caso sem ferir a OAB",
  "Advocacia: leitura e organização de documento com IA",
  "Padaria e food: pedido pelo WhatsApp sem telefone tocando",
  "Comércio e distribuidora: orçamento respondido na hora",
  "Salão e estética: agenda, lembrete e retorno de cliente automáticos",

  // Tier 4 — territórios pouco explorados (pouca concorrência)
  "Como parar de ser a pessoa que todo mundo pergunta tudo na empresa",
  "Cobrança com IA: como cobrar sem climão e sem esquecer ninguém",
  "Como fazer o relatório da semana chegar sozinho no seu WhatsApp",
  "IA lendo documento: como parar de passar dado de PDF pro sistema na mão",
  "Como saber o que sua equipe fala com o cliente sem ouvir 200 áudios",
  "Funcionário novo: como treinar sem repetir tudo de novo",
  "Estoque: como a IA avisa antes de faltar",
  "Pós-venda automático: como o cliente volta sem você lembrar dele",
  "Avaliação no Google: como subir a nota sem pedir constrangido",

  // Tier 7 — objeção (fecha quem já está quase lá)
  "\"A IA não vai atender meu cliente do jeito certo\": como evitar isso",
  "Meu cliente vai perceber que é um robô?",
  "Não entendo de tecnologia. Consigo ter isso na minha empresa?",
  "E se der problema no meio da noite? Quem resolve?",
];
