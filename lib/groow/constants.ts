export const COLORS = {
  navy: "#0B1838",
  navyDeep: "#070F26",
  gold: "#C9A961",
  goldSoft: "#D9BE7E",
  cream: "#F5F2EA",
  ink: "#2A3344",
} as const;

// O painel roda num domínio (enderecodigital.tech, privado) e o site público
// que o Google indexa é outro (enderecodigital.com). Todo link "abrir no site",
// ping de IndexNow e URL em e-mail/WhatsApp tem que apontar para o PÚBLICO —
// nunca para o domínio do painel, que é fechado e não tem as páginas.
// Uma constante só, alimentada por env, para não ter que caçar URL no código
// de novo na próxima troca de domínio.
export const SITE_PUBLICO =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://enderecodigital.com";

// Onde o PAINEL responde (domínio privado). Usado em links que levam alguém a
// operar — aprovar artigo, revisar pedido — e que não podem ir pro site público.
export const PAINEL_URL =
  process.env.NEXT_PUBLIC_PAINEL_URL?.replace(/\/+$/, "") || "https://enderecodigital.tech";

export const SITE = {
  name: "Endereço Digital",
  url: SITE_PUBLICO,
  contactEmail: "contato@enderecodigital.com",
  whatsapp: "+55 49 99953-3072",
} as const;

export type MetricFormat = "int" | "percent" | "currency-k";

export interface TerminalMetric {
  label: string;
  from: number;
  to: number;
  format: MetricFormat;
  suffix?: string;
}

export interface TerminalClient {
  id: string;
  redactedReal: string;
  redactedSuffix: string;
  sector: string;
  location: string;
  metrics: TerminalMetric[];
  faturamentoExtra: string;
}

export const TERMINAL_CLIENTS: TerminalClient[] = [
  {
    id: "clinica-estetica-cwb",
    redactedReal: "Premium",
    redactedSuffix: "A",
    sector: "Clínica de Estética Premium",
    location: "Curitiba, PR",
    metrics: [
      { label: "novos clientes/mês", from: 12, to: 47, format: "int" },
      { label: "de cada 10, fecham", from: 2, to: 4, format: "int" },
      { label: "valor médio/venda", from: 4200, to: 6100, format: "currency-k" },
      { label: "compromissos perdidos", from: 28, to: 7, format: "percent" },
    ],
    faturamentoExtra: "+R$ 38.400",
  },
  {
    id: "hotel-boutique-floripa",
    redactedReal: "Boutique",
    redactedSuffix: "B",
    sector: "Hotel Boutique",
    location: "Florianópolis, SC",
    metrics: [
      { label: "reservas novas/mês", from: 23, to: 89, format: "int" },
      { label: "taxa de ocupação", from: 47, to: 78, format: "percent" },
      { label: "diária média", from: 580, to: 920, format: "currency-k" },
      { label: "no-show", from: 18, to: 4, format: "percent" },
    ],
    faturamentoExtra: "+R$ 67.200",
  },
  {
    id: "advocacia-tributaria-sp",
    redactedReal: "Tributário",
    redactedSuffix: "C",
    sector: "Advocacia Tributária",
    location: "São Paulo, SP",
    metrics: [
      { label: "novos contratos/mês", from: 4, to: 14, format: "int" },
      { label: "valor médio do caso", from: 18000, to: 31000, format: "currency-k" },
      { label: "retenção 12 meses", from: 64, to: 91, format: "percent" },
      { label: "agendamentos premium", from: 8, to: 27, format: "int" },
    ],
    faturamentoExtra: "+R$ 142.000",
  },
];

export function formatMetric(value: number, format: MetricFormat): string {
  switch (format) {
    case "int":
      return Math.round(value).toString();
    case "percent":
      return `${Math.round(value)}%`;
    case "currency-k": {
      if (value >= 10000) {
        return `R$ ${(value / 1000).toFixed(0)}k`;
      }
      const k = value / 1000;
      return `R$ ${k.toFixed(1).replace(".", ",")}k`;
    }
  }
}

export interface BentoCard {
  big: boolean;
  value: string;
  label: string;
  detail: string;
  detailIcon: "up" | "down" | "star";
}

export interface BentoClient {
  id: string;
  display: string;
  cards: BentoCard[];
}

export const BENTO_CLIENTS: BentoClient[] = [
  {
    id: "clinica-cwb",
    display: "Clínica de Estética · Curitiba/PR",
    cards: [
      { big: false, value: "Novos pacientes crescentes", label: "", detail: "Volume mensal em alta", detailIcon: "up" },
      { big: false, value: "Aumento no ticket médio", label: "", detail: "Crescimento de receita", detailIcon: "up" },
      { big: false, value: "Redução de faltas", label: "", detail: "Custos operacionais", detailIcon: "down" },
      { big: true, value: "Faturamento extra mensurável", label: "", detail: "Resultado em 60 dias", detailIcon: "star" },
    ],
  },
  {
    id: "hotel-floripa",
    display: "Hotel Boutique · Florianópolis/SC",
    cards: [
      { big: false, value: "Novas reservas crescentes", label: "", detail: "Volume mensal em alta", detailIcon: "up" },
      { big: false, value: "Mais diárias ocupadas", label: "", detail: "Crescimento de receita", detailIcon: "up" },
      { big: false, value: "Menos cancelamentos", label: "", detail: "Custos operacionais", detailIcon: "down" },
      { big: true, value: "Faturamento extra mensurável", label: "", detail: "Resultado em 90 dias", detailIcon: "star" },
    ],
  },
  {
    id: "advocacia-sp",
    display: "Advocacia Tributária · São Paulo/SP",
    cards: [
      { big: false, value: "Novos casos qualificados", label: "", detail: "Volume mensal em alta", detailIcon: "up" },
      { big: false, value: "Aumento no valor por caso", label: "", detail: "Crescimento de receita", detailIcon: "up" },
      { big: false, value: "Retenção de longo prazo", label: "", detail: "Receita recorrente", detailIcon: "up" },
      { big: true, value: "Faturamento extra mensurável", label: "", detail: "Resultado em 90 dias", detailIcon: "star" },
    ],
  },
];

export const SETORES = [
  "Clínicas estéticas",
  "Hotéis boutique",
  "Advocacia tributária",
  "Imobiliárias de luxo",
  "Restaurantes autorais",
  "Joalherias",
  "Consultorias B2B",
  "E-commerce de luxo",
] as const;

export const POSICIONAMENTO = [
  {
    titulo: "Construímos, não consultamos",
    texto: "Cuidamos do motor digital do seu negócio. Você não gerencia agência, recebe operação rodando.",
  },
  {
    titulo: "Pagamento por resultado",
    texto: "Cobramos por resultado em reais, não por hora trabalhada. Se não move o faturamento, não cobramos cheio.",
  },
  {
    titulo: "Tecnologia testada em operação",
    texto: "Atendimento, agendamento e qualificação automatizados. Construímos com ferramentas validadas em ambiente real, não em apresentação.",
  },
  {
    titulo: "Construtores, não agência",
    texto: "Construímos a operação digital e tocamos o motor por dentro. Quem fala com você é quem executa, não vendedor.",
  },
  {
    titulo: "30 dias pra mensurar",
    texto: "Primeiro ciclo entrega resultado palpável no primeiro mês. Se não rendeu, conversamos.",
  },
] as const;

export const MODALIDADES = [
  {
    nome: "Essencial",
    badge: "Presença",
    descricao: "O básico bem feito pra existir com seriedade na internet. Presença completa, pronta pra ser achada.",
    para: "Pra quem ainda não existe direito no digital.",
    destaque: false,
  },
  {
    nome: "Completo",
    badge: "Mais escolhido",
    descricao: "Presença, aquisição e automação trabalhando juntas. A operação que traz cliente e atende sozinha.",
    para: "Pra quem quer trazer e atender cliente no automático.",
    destaque: true,
  },
  {
    nome: "Sob medida",
    badge: "Operação robusta",
    descricao: "Quando a operação digital é o centro do negócio. Tudo do Completo, mais o que o seu caso exigir.",
    para: "Pra quem vive do digital e precisa de operação robusta.",
    destaque: false,
  },
] as const;

export const MINI_CASES = [
  {
    setor: "Salão & Barbearia",
    cidade: "Chapecó, SC",
    transformacao:
      "Agenda cheia sozinha: o cliente marca pelo WhatsApp e o lembrete corta as faltas.",
    badge: "Setor ativo",
  },
  {
    setor: "Loja & Comércio",
    cidade: "Xanxerê, SC",
    transformacao:
      "Vende pelo site, fecha no Pix e cada venda cai no WhatsApp do dono na hora.",
    badge: "Setor ativo",
  },
  {
    setor: "Pizzaria & Delivery",
    cidade: "Concórdia, SC",
    transformacao:
      "Pedido montado pelo cardápio no WhatsApp e a comanda cai direto na cozinha.",
    badge: "Setor ativo",
  },
] as const;

export const FAQ_ITEMS = [
  {
    q: "Funciona pro meu tipo de negócio?",
    a: "Se a sua empresa tem gente respondendo mensagem, marcando horário ou mandando orçamento, funciona. O que muda é o que a gente constrói em cima disso: cada projeto é desenhado no diagnóstico, pro seu caso.",
  },
  {
    q: "Não entendo de tecnologia. É complicado?",
    a: "Você não precisa entender de nada. A gente cuida de tudo (site, tráfego e o atendimento por IA) e te entrega funcionando. Você só acompanha o resultado.",
  },
  {
    q: "Vocês são uma agência?",
    a: "Não. Agência vende serviço por mês. A gente constrói sistema. A diferença prática: quando o contrato com uma agência acaba, você fica sem nada. Aqui, o sistema é seu e continua rodando. E você fala direto com quem constrói, sem vendedor no meio.",
  },
  {
    q: "Vocês fazem sistemas sob medida?",
    a: "Fazemos. Além de site, tráfego e IA, desenvolvemos o sistema que a sua operação precisar: agendamento, pedidos, painel de gestão, integrações. Software único, desenhado pro seu caso, nada pré-moldado.",
  },
  {
    q: "Por que não tem preço no site?",
    a: "Porque projeto sob medida não tem tabela. O diagnóstico é gratuito justamente pra saber se faz sentido antes de qualquer número. Se não fizer, a gente fala.",
  },
  {
    q: "E se não funcionar?",
    a: "O risco é nosso, não seu. A gente garante o que está sob o nosso controle: no ar em 30 dias ou você não paga a implantação. O que a gente constrói é seu e continua rodando de qualquer forma.",
  },
  {
    q: "Quanto tempo até ver resultado?",
    a: "A presença sobe rápido. As automações já entregam número no primeiro mês. Em 30 dias você mede o retorno.",
  },
  {
    q: "E se eu já tenho site ou agência?",
    a: "A gente assume ou integra o que já existe. Você não recomeça do zero.",
  },
  {
    q: "Preciso contratar tudo de uma vez?",
    a: "Não. Você começa pela frente mais urgente e expande conforme faz sentido.",
  },
  {
    q: "Como acompanho o que está sendo feito?",
    a: "Com relatório e dashboard ao vivo. Você vê o resultado em número no bolso, não em promessa.",
  },
] as const;
