// Modelos demonstrativos por nicho - mini-sites fictícios pra prospecção
// ("olha como ficaria o site do seu negócio"). Cada nicho tem paleta e
// conteúdo próprios; o template é um só (app/modelos/[nicho]/page.tsx).

export interface ModeloNicho {
  slug: string;
  nichoLabel: string;        // como aparece na galeria ("Barbearia")
  empresa: string;           // nome fictício
  tagline: string;
  cidade: string;
  paleta: {
    bg: string;              // fundo geral
    surface: string;         // cards
    primary: string;         // cor da marca fictícia
    accent: string;          // botões/destaques
    text: string;
    textSoft: string;
  };
  hero: { titulo: string; sub: string; cta: string };
  servicos: { nome: string; desc: string; preco: string }[];
  provas: { texto: string; autor: string }[];
  horarios: string[];
  beneficios: string[];
}

export const MODELOS: ModeloNicho[] = [
  {
    slug: "barbearia",
    nichoLabel: "Barbearia",
    empresa: "Barbearia Quadrante",
    tagline: "Corte clássico, atitude moderna",
    cidade: "Chapecó, SC",
    paleta: {
      bg: "#12100E",
      surface: "#1D1915",
      primary: "#E8C87A",
      accent: "#C2472E",
      text: "#F4EDE1",
      textSoft: "rgba(244,237,225,0.65)",
    },
    hero: {
      titulo: "Agende seu corte em 30 segundos, sem ligar.",
      sub: "Escolha o barbeiro, o horário e pronto: confirmação na hora pelo WhatsApp. Sem fila, sem espera, sem furo.",
      cta: "Agendar pelo WhatsApp",
    },
    servicos: [
      { nome: "Corte degradê", desc: "Máquina e tesoura, acabamento na navalha", preco: "R$ 45" },
      { nome: "Barba completa", desc: "Toalha quente, navalha e finalização", preco: "R$ 35" },
      { nome: "Combo corte + barba", desc: "O ritual completo, com desconto", preco: "R$ 70" },
      { nome: "Pezinho / acabamento", desc: "Manutenção entre cortes", preco: "R$ 20" },
    ],
    provas: [
      { texto: "Agendei pelo site em segundos e fui atendido na hora marcada. Nunca mais fila.", autor: "Cliente da unidade Centro" },
      { texto: "O lembrete no WhatsApp salvou meu casamento com o horário. Corte impecável.", autor: "Cliente mensalista" },
    ],
    horarios: ["Seg a Sex: 9h às 20h", "Sábado: 8h às 18h", "Domingo: fechado"],
    beneficios: ["Agendamento online 24h", "Lembrete automático no WhatsApp", "Programa de fidelidade: 10º corte grátis"],
  },
  {
    slug: "clinica-estetica",
    nichoLabel: "Clínica de Estética",
    empresa: "Studio Aura Estética",
    tagline: "Sua melhor versão, com ciência e cuidado",
    cidade: "Chapecó, SC",
    paleta: {
      bg: "#FAF6F2",
      surface: "#FFFFFF",
      primary: "#8A5A44",
      accent: "#C89B7B",
      text: "#33261F",
      textSoft: "rgba(51,38,31,0.62)",
    },
    hero: {
      titulo: "Avaliação gratuita com quem entende da sua pele.",
      sub: "Protocolos personalizados de limpeza, rejuvenescimento e harmonização, com acompanhamento de verdade do começo ao resultado.",
      cta: "Agendar avaliação gratuita",
    },
    servicos: [
      { nome: "Limpeza de pele profunda", desc: "Extração + hidratação + máscara calmante", preco: "R$ 180" },
      { nome: "Peeling químico", desc: "Renovação celular com protocolo gradual", preco: "R$ 250" },
      { nome: "Microagulhamento", desc: "Estímulo de colágeno pra cicatrizes e poros", preco: "R$ 320" },
      { nome: "Drenagem linfática", desc: "Sessão corporal de 60 minutos", preco: "R$ 150" },
    ],
    provas: [
      { texto: "Três sessões e minha pele mudou de vida. E o acompanhamento pelo WhatsApp é um carinho à parte.", autor: "Paciente do protocolo facial" },
      { texto: "Marquei a avaliação pelo site num domingo à noite. Segunda de manhã já estava confirmada.", autor: "Paciente nova" },
    ],
    horarios: ["Seg a Sex: 8h às 19h", "Sábado: 8h às 13h"],
    beneficios: ["Avaliação inicial gratuita", "Protocolos com registro fotográfico de evolução", "Parcelamento em até 6x"],
  },
  {
    slug: "contabilidade",
    nichoLabel: "Escritório de Contabilidade",
    empresa: "Exata Contabilidade",
    tagline: "Sua empresa em dia, seu tempo de volta",
    cidade: "Chapecó, SC",
    paleta: {
      bg: "#F4F7FA",
      surface: "#FFFFFF",
      primary: "#0E3A5D",
      accent: "#1B7F79",
      text: "#16283A",
      textSoft: "rgba(22,40,58,0.62)",
    },
    hero: {
      titulo: "Abra sua empresa grátis e pague menos imposto todo mês.",
      sub: "Contabilidade completa pra MEI, Simples e Lucro Presumido, com atendimento humano no WhatsApp e relatório mensal que você entende.",
      cta: "Falar com um contador agora",
    },
    servicos: [
      { nome: "Abertura de empresa", desc: "CNPJ pronto em dias, sem custo de honorário", preco: "Grátis" },
      { nome: "Contabilidade mensal", desc: "Fiscal, contábil e pró-labore inclusos", preco: "a partir de R$ 189/mês" },
      { nome: "Migração de MEI", desc: "Desenquadramento sem dor de cabeça", preco: "R$ 149" },
      { nome: "Planejamento tributário", desc: "Análise anual pra pagar o mínimo legal", preco: "sob consulta" },
    ],
    provas: [
      { texto: "Economizei mais de R$ 400 por mês só ajustando o enquadramento. Se paga sozinho.", autor: "Dono de e-commerce" },
      { texto: "Respondem no WhatsApp em minutos. Meu contador antigo demorava uma semana.", autor: "Prestador de serviços" },
    ],
    horarios: ["Seg a Sex: 8h às 18h", "Plantão fiscal em época de IR"],
    beneficios: ["Atendimento pelo WhatsApp com contador de verdade", "Relatório mensal simplificado", "Certificado digital com desconto"],
  },
  {
    slug: "dentista",
    nichoLabel: "Clínica Odontológica",
    empresa: "Zanotto Odontologia",
    tagline: "Odontologia que se planeja antes de começar",
    cidade: "Chapecó, SC",
    paleta: {
      bg: "#F2F6FC",
      surface: "#FFFFFF",
      primary: "#0F3A79",
      accent: "#1667D6",
      text: "#0E1B2E",
      textSoft: "rgba(14,27,46,0.62)",
    },
    hero: {
      titulo: "Seis especialistas na mesma clínica, um plano só pro seu caso.",
      sub: "Avaliação com exame clínico, fotos e plano de tratamento por escrito antes de qualquer procedimento. Você sabe o que vai ser feito, em quanto tempo e por quanto.",
      cta: "Agendar avaliação",
    },
    servicos: [
      { nome: "Implante dentário", desc: "Planejamento digital e coroa de cerâmica", preco: "a partir de R$ 2.400" },
      { nome: "Alinhador transparente", desc: "Escaneamento 3D e acompanhamento mensal", preco: "a partir de R$ 6.900" },
      { nome: "Facetas e lentes", desc: "Ensaio do sorriso antes de desgastar dente", preco: "a partir de R$ 1.500/dente" },
      { nome: "Clareamento dental", desc: "Consultório + moldeira pra manutenção", preco: "R$ 890" },
    ],
    provas: [
      { texto: "Recebi o plano por escrito com valor fechado na primeira consulta. Nada de orçamento crescendo no meio do tratamento.", autor: "Paciente de implante" },
      { texto: "Marquei pelo WhatsApp num sábado e já saí com o horário confirmado. Meu filho é atendido na mesma clínica.", autor: "Paciente de ortodontia" },
    ],
    horarios: ["Seg a Sex: 8h às 19h", "Sábado: 8h às 12h"],
    beneficios: ["Plano de tratamento por escrito na avaliação", "Escaneamento 3D e simulação do resultado", "Parcelamento e convênios odontológicos"],
  },
  {
    slug: "pizzaria",
    nichoLabel: "Pizzaria",
    empresa: "Bortolotto Pizzaria",
    tagline: "Forno a lenha, massa de 48 horas",
    cidade: "Concórdia, SC",
    paleta: {
      bg: "#073D25",
      surface: "#0B4E31",
      primary: "#F4F1EA",
      accent: "#0A6B3D",
      text: "#F4F1EA",
      textSoft: "rgba(244,241,234,0.66)",
    },
    hero: {
      titulo: "Escolhe a pizza olhando a foto e manda o pedido pronto no WhatsApp.",
      sub: "Cardápio com foto de cada sabor, três tamanhos com preço na tela e checagem de bairro antes de você perguntar se entrega.",
      cta: "Pedir no WhatsApp",
    },
    servicos: [
      { nome: "Marguerita", desc: "Molho de tomate pelado, muçarela e manjericão fresco", preco: "R$ 42 a R$ 74" },
      { nome: "Calabresa", desc: "Calabresa fatiada fina e cebola em rodela", preco: "R$ 42 a R$ 74" },
      { nome: "Portuguesa", desc: "Presunto, ovo, ervilha, cebola e azeitona", preco: "R$ 46 a R$ 80" },
      { nome: "Bortolotto", desc: "A da casa: receita fechada desde 1997", preco: "R$ 56 a R$ 95" },
    ],
    provas: [
      { texto: "Montei o pedido pelo site e chegou no WhatsApp escrito certinho. Não precisou ditar sabor por telefone.", autor: "Cliente de entrega" },
      { texto: "Dá pra ver o tamanho e o preço antes de pedir. Acabou a surpresa na hora de pagar.", autor: "Cliente do salão" },
    ],
    horarios: ["Quarta a domingo: 18h30 às 23h", "Sexta e sábado: até meia-noite", "Segunda e terça: fechado"],
    beneficios: ["Cardápio com foto de todos os sabores", "Pedido montado no site e enviado pronto no WhatsApp", "Consulta de entrega por bairro"],
  },
  {
    slug: "hamburgueria",
    nichoLabel: "Hamburgueria",
    empresa: "Fritz Hamburgueria",
    tagline: "Lanche na chapa, montado na hora",
    cidade: "Pinhalzinho, SC",
    paleta: {
      bg: "#FBF4E6",
      surface: "#FFFFFF",
      primary: "#9A2B1E",
      accent: "#C98B2E",
      text: "#1C1815",
      textSoft: "rgba(28,24,21,0.62)",
    },
    hero: {
      titulo: "O cliente monta o lanche na tela e o pedido chega escrito no WhatsApp.",
      sub: "Pão, carne, queijo e adicionais escolhidos um a um, com o preço somando na frente do cliente. Menos erro no balcão, menos ida e volta no chat.",
      cta: "Montar meu lanche",
    },
    servicos: [
      { nome: "Bacon do Rudi", desc: "Bacon em cubo tostado, cheddar e cebola caramelizada", preco: "R$ 34" },
      { nome: "Kassler", desc: "Lombo defumado, chucrute da casa e queijo colonial", preco: "R$ 35" },
      { nome: "Combo com batata", desc: "Lanche, batata e bebida", preco: "R$ 45" },
      { nome: "Monte o seu", desc: "Escolhe pão, carne, queijo e adicionais um a um", preco: "a partir de R$ 24" },
    ],
    provas: [
      { texto: "O pedido já chega escrito com tudo que eu marquei. Nunca mais veio lanche errado.", autor: "Cliente de entrega" },
      { texto: "Montei o meu na tela com o preço somando na frente. Bem melhor que perguntar item por item.", autor: "Cliente do salão" },
    ],
    horarios: ["Terça a domingo: a partir das 18h", "Segunda: fechado"],
    beneficios: ["Montador de lanche com preço em tempo real", "Pedido enviado pronto no WhatsApp", "Cardápio de salão e entrega no mesmo site"],
  },
];

export function getModelo(slug: string): ModeloNicho | undefined {
  return MODELOS.find((m) => m.slug === slug);
}
