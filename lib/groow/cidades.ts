// Cidades-alvo pra SEO local. Correção da auditoria de páginas de cidade:
// - Os "setores" agora são os SEGMENTOS QUE A GENTE VENDE (clínica, imobiliária,
//   contabilidade, oficina...), não o PIB da cidade (agroindústria, madeira). A
//   Aurora e a BRF não são clientes; quem atende ELAS é.
// - A economia local entra como CONTEXTO que cria a cadeia de clientes.
// - 4 cidades principais ganham página própria (conteúdo real). As 8 pequenas
//   ficam numa página regional única, pra não virar doorway page (penalização).

export interface Cidade {
  slug: string;
  nome: string;
  tier: "principal" | "regional";
  // contexto local próprio: economia como pano de fundo que aponta pro cliente
  intro?: string;
  // segmentos que a Endereço Digital consegue vender de verdade na cidade
  segmentos?: string;
  // FAQ próprio (só nas principais), pra conteúdo único e schema FAQPage
  faq?: { q: string; a: string }[];
}

function faqPadrao(nome: string, segmentos: string): { q: string; a: string }[] {
  return [
    {
      q: `A Endereço Digital atende ${nome}?`,
      a: `Sim. Somos um estúdio de software e IA do oeste catarinense e atendemos empresas de ${nome} e região, de forma remota e presencial quando faz sentido. Todo o desenvolvimento e o suporte são do nosso time, sem terceirização.`,
    },
    {
      q: `Que tipo de empresa de ${nome} vocês atendem?`,
      a: `${segmentos}. O sistema é montado do zero pro seu caso, então funciona pra qualquer negócio que atende cliente, marca horário ou manda orçamento.`,
    },
    {
      q: `Quanto custa automatizar o atendimento de uma empresa em ${nome}?`,
      a: `Depende do que a sua operação precisa, e é por isso que o Raio-X é gratuito: ele mostra onde você perde tempo e dinheiro e quanto isso custa por mês, antes de qualquer proposta.`,
    },
  ];
}

export const CIDADES: Cidade[] = [
  {
    slug: "xanxere",
    nome: "Xanxerê",
    tier: "principal",
    segmentos: "Clínicas e odontologia, imobiliárias, escritórios de contabilidade e advocacia, comércio, oficinas, agropecuárias e restaurantes",
    intro:
      "Xanxerê é a nossa cidade e o polo da microrregião: a força do agro e da agroindústria sustenta uma cadeia de comércio, oficinas, clínicas e escritórios que vivem de agilidade. A gente conhece esse mercado de dentro e sabe que aqui quem demora pra responder perde pro concorrente do lado.",
    faq: faqPadrao(
      "Xanxerê",
      "Clínicas, imobiliárias, contabilidade, advocacia, comércio, oficinas, agropecuárias e restaurantes"
    ),
  },
  {
    slug: "chapeco",
    nome: "Chapecó",
    tier: "principal",
    segmentos: "Clínicas e odontologia, imobiliárias, escritórios de contabilidade e advocacia, distribuidoras, concessionárias e restaurantes",
    intro:
      "A agroindústria de Chapecó, a maior do oeste, movimenta uma cadeia enorme de fornecedores, transportadoras, distribuidoras e prestadores de serviço. Some a isso as clínicas, imobiliárias e escritórios que atendem a cidade, e você tem um mercado grande e disputado: aqui quem responde primeiro fecha, e quem demora perde pro concorrente da esquina.",
    faq: faqPadrao(
      "Chapecó",
      "Clínicas, imobiliárias, contabilidade, advocacia, distribuidoras, concessionárias e restaurantes"
    ),
  },
  {
    slug: "concordia",
    nome: "Concórdia",
    tier: "principal",
    segmentos: "Clínicas, imobiliárias, escritórios de contabilidade, comércio, oficinas e transportadoras",
    intro:
      "Concórdia é referência em agroindústria de suínos e aves, e essa força sustenta uma teia de prestadores, transportadoras, oficinas e escritórios que vivem de agilidade. Num mercado tão movimentado, orçamento parado e mensagem sem resposta são faturamento evaporando.",
    faq: faqPadrao(
      "Concórdia",
      "Clínicas, imobiliárias, contabilidade, comércio, oficinas e transportadoras"
    ),
  },
  {
    slug: "xaxim",
    nome: "Xaxim",
    tier: "principal",
    segmentos: "Comércio, clínicas, oficinas, escritórios de contabilidade e alimentação",
    intro:
      "Xaxim cresce colada em Chapecó, com comércio, oficinas e serviços que atendem a cidade e a região. O dono aqui costuma tocar tudo sozinho: vende, atende, cobra e ainda responde o WhatsApp de madrugada. É exatamente esse gargalo que dá pra tirar das costas dele.",
    faq: faqPadrao("Xaxim", "Comércio, clínicas, oficinas, contabilidade e alimentação"),
  },
  {
    slug: "sao-lourenco-do-oeste",
    nome: "São Lourenço do Oeste",
    tier: "principal",
    segmentos: "Comércio, clínicas, escritórios de contabilidade, agropecuárias e oficinas",
    intro:
      "São Lourenço do Oeste é o polo do extremo-oeste: comércio, saúde e serviços que atendem toda a microrregião. Quanto maior o alcance, mais mensagem cai, e mais fácil deixar cliente sem resposta. Organizar esse volume sem perder o toque humano é onde a automação entra.",
    faq: faqPadrao(
      "São Lourenço do Oeste",
      "Comércio, clínicas, contabilidade, agropecuárias e oficinas"
    ),
  },

  // Regionais (entram na página única do oeste catarinense, sem página própria
  // até fechar cliente com case na cidade)
  { slug: "faxinal-dos-guedes", nome: "Faxinal dos Guedes", tier: "regional" },
  { slug: "ponte-serrada", nome: "Ponte Serrada", tier: "regional" },
  { slug: "sao-domingos", nome: "São Domingos", tier: "regional" },
  { slug: "abelardo-luz", nome: "Abelardo Luz", tier: "regional" },
  { slug: "seara", nome: "Seara", tier: "regional" },
  { slug: "coronel-freitas", nome: "Coronel Freitas", tier: "regional" },
  { slug: "quilombo", nome: "Quilombo", tier: "regional" },
  { slug: "ipumirim", nome: "Ipumirim", tier: "regional" },
];

export const CIDADES_PRINCIPAIS = CIDADES.filter((c) => c.tier === "principal");
export const CIDADES_REGIONAIS = CIDADES.filter((c) => c.tier === "regional");

export function getCidadePrincipal(slug: string): Cidade | undefined {
  return CIDADES_PRINCIPAIS.find((c) => c.slug === slug);
}
