export type QuestionType = "single" | "multi" | "text" | "textarea";

export interface QuizQuestion {
  id: string;
  text: string;
  type: QuestionType;
  options?: string[];
  hasOther?: boolean;
  limit?: number;
}

export interface QuizNicho {
  id: string;
  icon: string;
  label: string;
  description: string;
  questions: QuizQuestion[];
}

export const QUIZ_NICHOS: QuizNicho[] = [
  {
    id: "saude",
    icon: "🩺",
    label: "Saúde",
    description: "Médico, dentista, psicólogo, fisio, nutricionista, estética",
    questions: [
      {
        id: "saude_q1",
        text: "Qual sua área?",
        type: "single",
        options: [
          "Médico (clínico geral ou especialista)",
          "Dentista",
          "Psicólogo / psicanalista",
          "Fisioterapeuta",
          "Nutricionista",
          "Estética (esteticista, biomédica, dermato)",
          "Outra área da saúde",
        ],
        hasOther: true,
      },
      {
        id: "saude_q2",
        text: "Você atende sozinho ou tem equipe?",
        type: "single",
        options: [
          "Sozinho(a)",
          "Tenho 2-4 profissionais",
          "Clínica com 5+ profissionais",
        ],
      },
      {
        id: "saude_q3",
        text: "Atende particular, convênio ou os dois?",
        type: "single",
        options: ["Só particular", "Só convênio", "Os dois"],
      },
      {
        id: "saude_q4",
        text: "Por onde os pacientes novos chegam hoje? (pode marcar mais de um)",
        type: "multi",
        options: [
          "Indicação de outros pacientes",
          "Instagram",
          "Google",
          "Convênio te indicou",
          "WhatsApp direto",
          "Site próprio",
          "Não sei dizer",
        ],
      },
      {
        id: "saude_q5",
        text: "Quantos pacientes novos por mês, mais ou menos?",
        type: "single",
        options: ["Menos de 5", "Entre 5 e 15", "Entre 15 e 30", "Mais de 30"],
      },
      {
        id: "saude_q6",
        text: "O que mais te incomoda hoje? (pode marcar mais de uma)",
        type: "multi",
        options: [
          "Cliente manda mensagem fora do horário e eu não consigo responder a tempo",
          "Marcou e não veio (falta)",
          "Não aparece gente nova procurando, só os de indicação",
          "Tenho muita agenda pra organizar e perco horário",
          "Quase ninguém me acha no Google",
          "Outra coisa (escrever)",
        ],
        hasOther: true,
      },
      {
        id: "saude_q7",
        text: "Você atende presencial, online ou os dois?",
        type: "single",
        options: ["Só presencial", "Só online", "Os dois (híbrido)"],
      },
      {
        id: "saude_q8",
        text: "Você já tem...",
        type: "multi",
        options: [
          "Site próprio",
          "Perfil ativo no Instagram",
          "Google Meu Negócio configurado",
          "Agendamento online",
          "Nenhum dos anteriores",
        ],
      },
    ],
  },

  {
    id: "direito",
    icon: "⚖️",
    label: "Direito",
    description: "Advogado solo ou escritório",
    questions: [
      {
        id: "direito_q1",
        text: "Você atua...",
        type: "single",
        options: [
          "Sozinho (autônomo)",
          "Em escritório próprio com 2-5 advogados",
          "Em escritório com 6+ advogados",
          "Sou sócio de escritório maior",
        ],
      },
      {
        id: "direito_q2",
        text: "Suas áreas de atuação principais (até 3)",
        type: "multi",
        limit: 3,
        options: [
          "Família e sucessões",
          "Trabalhista",
          "Cível",
          "Criminal",
          "Empresarial / societário",
          "Tributário",
          "Previdenciário",
          "Consumidor",
          "Imobiliário",
          "Outra (escrever)",
        ],
        hasOther: true,
      },
      {
        id: "direito_q3",
        text: "Atende mais pessoa física, jurídica ou os dois?",
        type: "single",
        options: ["Só pessoa física", "Só pessoa jurídica", "Os dois"],
      },
      {
        id: "direito_q4",
        text: "Como cliente novo geralmente chega?",
        type: "multi",
        options: [
          "Indicação de outro cliente",
          "Indicação de colega advogado",
          "Instagram",
          "Google",
          "Site próprio",
          "WhatsApp direto",
          "Não sei dizer",
        ],
      },
      {
        id: "direito_q5",
        text: "Quantos casos novos por mês?",
        type: "single",
        options: ["Menos de 3", "Entre 3 e 10", "Entre 10 e 25", "Mais de 25"],
      },
      {
        id: "direito_q6",
        text: "Você tem alguém pra responder os primeiros contatos?",
        type: "single",
        options: [
          "Sou eu mesmo(a) que respondo",
          "Tenho secretária ou recepcionista",
          "Tenho equipe de atendimento",
        ],
      },
      {
        id: "direito_q7",
        text: "O que está te impedindo de crescer hoje? (pode marcar mais de uma)",
        type: "multi",
        options: [
          "Não respondo a tempo quem entra em contato",
          "Não apareço no Google pra quem procura advogado da minha área",
          "Cliente potencial liga mas some depois",
          "Não tenho como mostrar minha credibilidade online (site, casos)",
          "Tenho muito trabalho jurídico, falta tempo pra captação",
          "Outra coisa (escrever)",
        ],
        hasOther: true,
      },
      {
        id: "direito_q8",
        text: "Você já tem...",
        type: "multi",
        options: [
          "Site próprio",
          "Instagram do escritório/seu",
          "Google Meu Negócio",
          "LinkedIn ativo",
          "Nenhum dos anteriores",
        ],
      },
    ],
  },

  {
    id: "ecommerce",
    icon: "🛒",
    label: "E-commerce",
    description: "Loja online (produto físico ou digital)",
    questions: [
      {
        id: "ecom_q1",
        text: "Que tipo de produto você vende?",
        type: "single",
        options: [
          "Roupas / acessórios",
          "Cosméticos / perfumaria",
          "Alimentos / bebidas",
          "Casa e decoração",
          "Eletrônicos / tecnologia",
          "Artesanato",
          "Produto digital (curso, ebook, software)",
          "Outro (escrever)",
        ],
        hasOther: true,
      },
      {
        id: "ecom_q2",
        text: "Onde você vende hoje?",
        type: "multi",
        options: [
          "Loja própria (site)",
          "Marketplace",
          "Instagram / WhatsApp direto",
          "Loja física + online",
          "Ainda não vendo online",
        ],
      },
      {
        id: "ecom_q3",
        text: "Quantos pedidos por mês, mais ou menos?",
        type: "single",
        options: [
          "Ainda não comecei",
          "Menos de 20",
          "Entre 20 e 100",
          "Entre 100 e 500",
          "Mais de 500",
        ],
      },
      {
        id: "ecom_q4",
        text: "Qual o ticket médio (valor médio do pedido)?",
        type: "single",
        options: ["Até R$ 50", "R$ 50 a R$ 150", "R$ 150 a R$ 500", "Mais de R$ 500"],
      },
      {
        id: "ecom_q5",
        text: "De onde vem a maior parte dos clientes?",
        type: "single",
        options: [
          "Anúncios pagos",
          "Tráfego orgânico (Google, Insta)",
          "Indicação / boca a boca",
          "Cliente recorrente",
          "Não sei dizer",
        ],
      },
      {
        id: "ecom_q6",
        text: "Qual a sua maior dificuldade hoje? (pode marcar mais de uma)",
        type: "multi",
        options: [
          "Não consigo vender no automático, preciso ficar respondendo cliente um a um",
          "Tenho visitas no site/Insta mas pouca venda",
          "Pago muito anúncio e o retorno está caindo",
          "Não apareço no Google pra quem procura meu produto",
          "Cliente abandona o carrinho e não volta",
          "Não sei o que funciona e o que não funciona",
          "Outra coisa (escrever)",
        ],
        hasOther: true,
      },
      {
        id: "ecom_q7",
        text: "Como funciona a logística dos envios?",
        type: "single",
        options: [
          "Faço entrega própria (moto/carro local)",
          "Correios / Jadlog / Loggi (envio nacional)",
          "O marketplace cuida (FULL, Mercado Envios)",
          "Misturo os modelos conforme o pedido",
          "Ainda não envio (vou começar agora)",
        ],
      },
      {
        id: "ecom_q8",
        text: "Você já tem...",
        type: "multi",
        options: [
          "Loja online própria",
          "Instagram ativo da loja",
          "Lista de email/WhatsApp de clientes",
          "Google Meu Negócio (se tem ponto físico)",
          "Nenhum dos anteriores",
        ],
      },
    ],
  },

  {
    id: "beleza",
    icon: "💇",
    label: "Beleza",
    description: "Salão, barbearia, manicure, estética",
    questions: [
      {
        id: "beleza_q1",
        text: "Que tipo de serviço você presta?",
        type: "multi",
        options: [
          "Cabelo (corte, coloração, escova)",
          "Barbearia",
          "Unhas (manicure, pedicure, alongamento)",
          "Estética facial",
          "Estética corporal",
          "Sobrancelha / lash",
          "Maquiagem",
          "Depilação",
          "Outro (escrever)",
        ],
        hasOther: true,
      },
      {
        id: "beleza_q2",
        text: "Você atende sozinha ou tem equipe?",
        type: "single",
        options: [
          "Sozinha(o)",
          "2-4 profissionais",
          "5+ profissionais (salão grande)",
        ],
      },
      {
        id: "beleza_q3",
        text: "Como o cliente marca horário hoje?",
        type: "single",
        options: [
          "WhatsApp comigo",
          "WhatsApp com recepcionista/secretária",
          "App de agendamento",
          "Liga no telefone",
          "Cliente passa no salão pra agendar",
        ],
      },
      {
        id: "beleza_q4",
        text: "Quantos atendimentos por semana, mais ou menos?",
        type: "single",
        options: ["Menos de 20", "20 a 50", "50 a 100", "Mais de 100"],
      },
      {
        id: "beleza_q5",
        text: "Faltas (cliente marca e não vem) são problema?",
        type: "single",
        options: [
          "Quase nunca",
          "Acontece, mas não é grave",
          "É um problema sério, perco horário toda semana",
        ],
      },
      {
        id: "beleza_q6",
        text: "O que mais te incomoda hoje? (pode marcar mais de uma)",
        type: "multi",
        options: [
          "Cliente manda mensagem de madrugada/fim de semana e eu só vejo depois",
          "Esqueço de confirmar / lembrar / fazer pós-venda",
          "Não aparece cliente novo, vivo só dos antigos",
          "Tenho que ficar respondendo \"qual valor?\" o dia todo",
          "Não apareço no Google quando procuram meu serviço na minha região",
          "Outra coisa (escrever)",
        ],
        hasOther: true,
      },
      {
        id: "beleza_q7",
        text: "Você oferece pacote/combo/programa de fidelidade?",
        type: "single",
        options: [
          "Sim, vendo pacotes (ex: 5 sessões com desconto)",
          "Sim, tenho clube de fidelidade (recorrente)",
          "Tenho mas não consigo divulgar bem",
          "Não ofereço, todo atendimento é avulso",
        ],
      },
      {
        id: "beleza_q8",
        text: "Você já tem...",
        type: "multi",
        options: [
          "Instagram ativo",
          "Google Meu Negócio (com fotos e horário)",
          "Site próprio",
          "Agendamento online",
          "Sistema pra cobrar/registrar atendimento",
          "Nenhum dos anteriores",
        ],
      },
    ],
  },

  {
    id: "alimentacao",
    icon: "🍽️",
    label: "Alimentação",
    description: "Marmitaria, restaurante, confeitaria, padaria",
    questions: [
      {
        id: "alim_q1",
        text: "Que tipo de alimentação você produz?",
        type: "single",
        options: [
          "Marmitaria / comida pronta",
          "Restaurante (almoço/jantar)",
          "Confeitaria / doceria",
          "Padaria",
          "Cafeteria / lanchonete",
          "Comida fitness / saudável",
          "Hambúrguer / pizzaria",
          "Outro (escrever)",
        ],
        hasOther: true,
      },
      {
        id: "alim_q2",
        text: "Você vende mais...",
        type: "single",
        options: [
          "Delivery",
          "Retirada no balcão",
          "Consumo no local",
          "Mix dos três",
        ],
      },
      {
        id: "alim_q3",
        text: "Como o cliente faz pedido hoje?",
        type: "multi",
        options: [
          "WhatsApp",
          "Plataforma de delivery",
          "Cardápio próprio online",
          "Liga no telefone",
          "Passa no local",
        ],
      },
      {
        id: "alim_q4",
        text: "Quantos pedidos médios por dia?",
        type: "single",
        options: ["Menos de 20", "20 a 50", "50 a 100", "Mais de 100"],
      },
      {
        id: "alim_q5",
        text: "Você trabalha com cliente recorrente (assinatura, fechamento mensal) ou cada pedido é avulso?",
        type: "single",
        options: [
          "100% avulso",
          "Tenho alguns fixos (delivery semanal, almoço de empresa)",
          "A maior parte é fixo / assinatura",
        ],
      },
      {
        id: "alim_q6",
        text: "O que mais te incomoda hoje? (pode marcar mais de uma)",
        type: "multi",
        options: [
          "Fico o dia todo respondendo \"qual o cardápio hoje?\" no WhatsApp",
          "A taxa das plataformas de delivery come o lucro",
          "Não aparece cliente novo, só os que já conhecem",
          "Pedido vem errado / esqueço de fazer",
          "Não tenho como mostrar as fotos da comida pra atrair mais",
          "Outra coisa (escrever)",
        ],
        hasOther: true,
      },
      {
        id: "alim_q7",
        text: "Você faz encomendas especiais (festas, eventos, marmita pra empresa)?",
        type: "single",
        options: [
          "Sim, é uma parte importante da minha receita",
          "Sim, mas é pouco, só quando me procuram",
          "Não, só vendo o produto normal",
          "Gostaria de oferecer, mas não sei como divulgar",
        ],
      },
      {
        id: "alim_q8",
        text: "Você já tem...",
        type: "multi",
        options: [
          "Cardápio digital próprio",
          "Instagram com fotos boas dos produtos",
          "Cadastro em plataforma de delivery",
          "Google Meu Negócio (com fotos e horário)",
          "Site / hotsite",
          "Nenhum dos anteriores",
        ],
      },
    ],
  },

  {
    id: "hospedagem",
    icon: "🏨",
    label: "Hospedagem",
    description: "Pousada, hotel, chalé, casa de temporada",
    questions: [
      {
        id: "hosp_q1",
        text: "Tipo de hospedagem?",
        type: "single",
        options: [
          "Pousada",
          "Hotel",
          "Chalé / cabana",
          "Casa de temporada",
          "Hostel",
          "Camping / glamping",
          "Outro (escrever)",
        ],
        hasOther: true,
      },
      {
        id: "hosp_q2",
        text: "Quantas unidades (quartos / chalés / camas)?",
        type: "single",
        options: ["1 a 3", "4 a 10", "11 a 25", "Mais de 25"],
      },
      {
        id: "hosp_q3",
        text: "Onde você recebe as reservas hoje?",
        type: "multi",
        options: [
          "Plataformas de reserva (Booking, Airbnb, etc)",
          "Site próprio com reserva direta",
          "WhatsApp / Instagram",
          "Telefone",
        ],
      },
      {
        id: "hosp_q4",
        text: "Como anda a ocupação fora de temporada?",
        type: "single",
        options: [
          "Muito boa, quase sempre cheio",
          "Razoável, com baixas eventuais",
          "Baixa, é onde mais perco dinheiro",
          "Fecho fora de temporada",
        ],
      },
      {
        id: "hosp_q5",
        text: "Você consegue mostrar suas fotos e diferenciais em algum lugar próprio?",
        type: "single",
        options: [
          "Sim, tenho site próprio com fotos e tudo",
          "Só tenho perfil no Insta com fotos",
          "Só apareço dentro das plataformas de reserva",
          "Quase não tenho presença online",
        ],
      },
      {
        id: "hosp_q6",
        text: "Qual a maior dificuldade hoje? (pode marcar mais de uma)",
        type: "multi",
        options: [
          "A taxa das plataformas de reserva come a margem",
          "Cliente reserva pela plataforma e eu não tenho contato pra fidelizar",
          "Não consigo manter ocupação fora de temporada",
          "Hóspede não acha informação clara do que tem perto, o que oferecemos",
          "Reserva manual é um caos, perco tempo confirmando",
          "Outra coisa (escrever)",
        ],
        hasOther: true,
      },
      {
        id: "hosp_q7",
        text: "Que tipo de hóspede mais te procura?",
        type: "single",
        options: [
          "Casal / lua de mel",
          "Família com crianças",
          "Grupo de amigos",
          "Viajante a trabalho / corporativo",
          "Pet friendly (gente com cachorro/gato)",
          "É bem misturado, sem perfil dominante",
        ],
      },
      {
        id: "hosp_q8",
        text: "Você já tem...",
        type: "multi",
        options: [
          "Site próprio com reserva direta",
          "Google Meu Negócio com fotos",
          "Instagram ativo",
          "Cadastro completo nas plataformas de reserva com boas avaliações",
          "Sistema de gestão de reservas",
          "Nenhum dos anteriores",
        ],
      },
    ],
  },

  {
    id: "educacao",
    icon: "🎓",
    label: "Educação",
    description: "Escola, curso, idiomas, reforço, professor particular",
    questions: [
      {
        id: "edu_q1",
        text: "Que tipo de educação você oferece?",
        type: "single",
        options: [
          "Escola (infantil, fundamental, médio)",
          "Curso livre (idiomas, música, arte, profissionalizante)",
          "Reforço escolar",
          "Pré-vestibular / cursinho",
          "Curso online (você produz e vende)",
          "Aula particular (sou professor solo)",
          "Treinamento corporativo",
          "Outro (escrever)",
        ],
        hasOther: true,
      },
      {
        id: "edu_q2",
        text: "É presencial, online ou os dois?",
        type: "single",
        options: ["Só presencial", "Só online", "Os dois (híbrido)"],
      },
      {
        id: "edu_q3",
        text: "Você atua sozinho ou tem equipe?",
        type: "single",
        options: [
          "Sozinho(a), eu mesmo dou aula",
          "2-5 professores",
          "6-20 professores",
          "Mais de 20 professores",
        ],
      },
      {
        id: "edu_q4",
        text: "Como o aluno novo costuma chegar?",
        type: "multi",
        options: [
          "Indicação de outros alunos / pais",
          "Instagram",
          "Google",
          "Anúncio pago",
          "Site próprio",
          "WhatsApp direto",
          "Cartaz / panfleto (offline)",
          "Não sei dizer",
        ],
      },
      {
        id: "edu_q5",
        text: "Quantos alunos novos por mês?",
        type: "single",
        options: ["Menos de 5", "5 a 20", "20 a 50", "Mais de 50"],
      },
      {
        id: "edu_q6",
        text: "Você trabalha com turmas com data fixa ou matrícula contínua?",
        type: "single",
        options: [
          "Turmas com data de início fixa (semestral, trimestral)",
          "Matrícula contínua (entra a qualquer hora)",
          "Os dois modelos",
        ],
      },
      {
        id: "edu_q7",
        text: "Qual a maior dificuldade hoje? (pode marcar mais de uma)",
        type: "multi",
        options: [
          "Aluno/pai faz pergunta no Insta ou WhatsApp e some sem matricular",
          "Não consigo encher a turma no início do semestre",
          "Aluno desiste no meio do curso (evasão)",
          "Não tenho como mostrar resultados/depoimentos dos alunos antigos",
          "Aparece pouco aluno novo, dependo da renovação",
          "Outra coisa (escrever)",
        ],
        hasOther: true,
      },
      {
        id: "edu_q8",
        text: "Você já tem...",
        type: "multi",
        options: [
          "Site próprio",
          "Instagram ativo",
          "Google Meu Negócio",
          "Plataforma EAD",
          "Sistema de matrícula online",
          "Nenhum dos anteriores",
        ],
      },
    ],
  },

  {
    id: "servicos",
    icon: "🔧",
    label: "Serviços técnicos",
    description: "Encanador, eletricista, mecânico, marceneiro, refrigeração",
    questions: [
      {
        id: "serv_q1",
        text: "Qual o serviço principal?",
        type: "single",
        options: [
          "Encanador / hidráulica",
          "Eletricista",
          "Mecânica de carro",
          "Mecânica de moto",
          "Refrigeração (ar condicionado, geladeira, freezer)",
          "Marceneiro / móveis sob medida",
          "Pedreiro / pequenas reformas",
          "Pintor",
          "Jardinagem / paisagismo",
          "Limpeza de piscina, dedetização, similares",
          "Outro (escrever)",
        ],
        hasOther: true,
      },
      {
        id: "serv_q2",
        text: "Você atua sozinho ou tem equipe?",
        type: "single",
        options: [
          "Sozinho(a)",
          "Eu + 1 ajudante",
          "Equipe de 3-5 pessoas",
          "Tenho oficina/loja com vários profissionais",
        ],
      },
      {
        id: "serv_q3",
        text: "Atende mais residencial, comercial ou os dois?",
        type: "single",
        options: [
          "Só residencial (casa, apartamento)",
          "Só comercial (empresa, escritório, indústria)",
          "Os dois",
        ],
      },
      {
        id: "serv_q4",
        text: "Como o cliente novo costuma chegar?",
        type: "multi",
        options: [
          "Indicação",
          "Google",
          "Instagram / Facebook",
          "WhatsApp direto",
          "Cliente passou na frente da oficina",
          "Anúncio pago",
          "Cadastro em plataforma de serviços",
          "Não sei dizer",
        ],
      },
      {
        id: "serv_q5",
        text: "Quantos chamados/serviços por semana?",
        type: "single",
        options: ["Menos de 5", "5 a 15", "15 a 40", "Mais de 40"],
      },
      {
        id: "serv_q6",
        text: "Quanto tempo costuma passar entre o cliente entrar em contato e fechar o serviço?",
        type: "single",
        options: [
          "Mesma hora (urgência: vazamento, pane elétrica)",
          "1-2 dias",
          "3-7 dias",
          "Mais de uma semana (orçamento grande, projeto)",
        ],
      },
      {
        id: "serv_q7",
        text: "Qual a maior dificuldade hoje? (pode marcar mais de uma)",
        type: "multi",
        options: [
          "Cliente pede orçamento e some sem fechar",
          "Apareço pouco quando alguém pesquisa meu serviço na cidade",
          "Pego serviço pequeno e perco tempo deslocando",
          "Tenho serviço demais e não tenho tempo de organizar agenda",
          "Não consigo cobrar mais caro porque cliente sempre pede \"outro orçamento\"",
          "Outra coisa (escrever)",
        ],
        hasOther: true,
      },
      {
        id: "serv_q8",
        text: "Você já tem...",
        type: "multi",
        options: [
          "Site próprio",
          "Google Meu Negócio (com fotos dos trabalhos)",
          "Instagram com portfólio",
          "Cadastro em plataforma de serviços",
          "Sistema pra mandar orçamento por WhatsApp/email",
          "Nenhum dos anteriores",
        ],
      },
    ],
  },

  {
    id: "academia",
    icon: "🏋️",
    label: "Academia / Personal",
    description: "Academia, crossfit, pilates, yoga, personal",
    questions: [
      {
        id: "acad_q1",
        text: "Que tipo de atividade você oferece?",
        type: "single",
        options: [
          "Academia tradicional (musculação + cardio)",
          "Crossfit / funcional",
          "Pilates",
          "Yoga",
          "Personal trainer (atendimento individual)",
          "Aulas de luta / boxe / jiu-jitsu",
          "Dança",
          "Outro (escrever)",
        ],
        hasOther: true,
      },
      {
        id: "acad_q2",
        text: "É espaço físico, online ou os dois?",
        type: "single",
        options: [
          "Espaço físico próprio (academia/estúdio)",
          "Atendimento online (personal/aula remota)",
          "Personal em domicílio",
          "Misto (físico + online)",
        ],
      },
      {
        id: "acad_q3",
        text: "Você atua sozinho ou tem equipe?",
        type: "single",
        options: [
          "Sozinho(a), personal solo",
          "Eu + 1-3 professores",
          "Equipe de 4-10 professores",
          "Academia grande, 10+ professores",
        ],
      },
      {
        id: "acad_q4",
        text: "Como o aluno novo costuma chegar?",
        type: "multi",
        options: [
          "Indicação",
          "Instagram",
          "Google",
          "Passou na frente da academia / cartaz",
          "Anúncio pago",
          "WhatsApp direto",
          "Não sei dizer",
        ],
      },
      {
        id: "acad_q5",
        text: "Quantos alunos ativos hoje?",
        type: "single",
        options: ["Menos de 20", "20 a 80", "80 a 200", "Mais de 200"],
      },
      {
        id: "acad_q6",
        text: "Trabalha mais com qual modelo de plano?",
        type: "single",
        options: [
          "Mensal",
          "Trimestral / semestral",
          "Anual (matrícula longa)",
          "Aula avulsa / pacote",
          "Mix dos modelos",
        ],
      },
      {
        id: "acad_q7",
        text: "Qual a maior dificuldade hoje? (pode marcar mais de uma)",
        type: "multi",
        options: [
          "Aluno faz aula experimental e não fecha o plano",
          "Aluno fecha plano mas desiste no 2º-3º mês",
          "Aparece pouco aluno novo",
          "Aluno faz pergunta no Insta e some sem agendar a experimental",
          "Não tenho como mostrar resultados de alunos antigos",
          "Outra coisa (escrever)",
        ],
        hasOther: true,
      },
      {
        id: "acad_q8",
        text: "Você já tem...",
        type: "multi",
        options: [
          "Site próprio",
          "Instagram ativo (vídeos / fotos / depoimentos)",
          "Google Meu Negócio com fotos",
          "Sistema de gestão de alunos",
          "Plataforma de treino/dieta online",
          "Nenhum dos anteriores",
        ],
      },
    ],
  },

  {
    id: "imobiliaria",
    icon: "🏠",
    label: "Imobiliária",
    description: "Corretor, imobiliária, incorporadora",
    questions: [
      {
        id: "imob_q1",
        text: "Você atua como...",
        type: "single",
        options: [
          "Corretor solo (autônomo)",
          "Imobiliária pequena (2-10 corretores)",
          "Imobiliária grande (10+ corretores)",
          "Incorporadora / construtora",
        ],
      },
      {
        id: "imob_q2",
        text: "Trabalha mais com...",
        type: "multi",
        options: [
          "Aluguel residencial",
          "Venda residencial",
          "Aluguel comercial",
          "Venda comercial / investimento",
          "Lançamentos (incorporação)",
          "Temporada",
        ],
      },
      {
        id: "imob_q3",
        text: "Quantos imóveis você tem na carteira hoje?",
        type: "single",
        options: ["Menos de 20", "20 a 80", "80 a 300", "Mais de 300"],
      },
      {
        id: "imob_q4",
        text: "Como o cliente novo costuma chegar?",
        type: "multi",
        options: [
          "Indicação",
          "Plataformas imobiliárias (ZAP, Viva Real, etc)",
          "Google",
          "Instagram",
          "WhatsApp direto",
          "Placa no imóvel",
          "Anúncio pago",
          "Não sei dizer",
        ],
      },
      {
        id: "imob_q5",
        text: "Quantos fechamentos por mês, mais ou menos?",
        type: "single",
        options: ["Menos de 2", "2 a 5", "5 a 15", "Mais de 15"],
      },
      {
        id: "imob_q6",
        text: "Você tem site próprio com vitrine dos imóveis?",
        type: "single",
        options: [
          "Sim, atualizado em tempo real",
          "Sim, mas a vitrine está desatualizada",
          "Não, dependo só das plataformas imobiliárias",
        ],
      },
      {
        id: "imob_q7",
        text: "Qual a maior dificuldade hoje? (pode marcar mais de uma)",
        type: "multi",
        options: [
          "Lead chega pela plataforma, faço atendimento, e ele fecha com outro corretor",
          "Pago caro pras plataformas e o retorno está caindo",
          "Não apareço no Google quando alguém procura imóvel na minha cidade/bairro",
          "Cliente pede informação e some, não consigo manter contato",
          "Não tenho como mostrar minha expertise pra atrair cliente de outro nível",
          "Outra coisa (escrever)",
        ],
        hasOther: true,
      },
      {
        id: "imob_q8",
        text: "Você já tem...",
        type: "multi",
        options: [
          "Site próprio com vitrine de imóveis",
          "Cadastro nas plataformas imobiliárias",
          "Instagram com fotos dos imóveis",
          "Google Meu Negócio",
          "CRM / sistema de gestão de leads",
          "Nenhum dos anteriores",
        ],
      },
    ],
  },

  {
    id: "pet",
    icon: "🐾",
    label: "Pet",
    description: "Pet shop, veterinária, banho e tosa, hotel para pets",
    questions: [
      {
        id: "pet_q1",
        text: "Que tipo de serviço você oferece?",
        type: "single",
        options: [
          "Pet shop (ração, acessórios, produtos)",
          "Banho e tosa",
          "Veterinária clínica",
          "Veterinária + pet shop (completo)",
          "Hotel / creche para pets",
          "Adestramento",
          "Outro (escrever)",
        ],
        hasOther: true,
      },
      {
        id: "pet_q2",
        text: "Você atende sozinho ou tem equipe?",
        type: "single",
        options: [
          "Sozinho(a)",
          "2-4 profissionais",
          "5+ profissionais (clínica ou loja grande)",
        ],
      },
      {
        id: "pet_q3",
        text: "Como o tutor novo costuma chegar?",
        type: "multi",
        options: [
          "Indicação de outros tutores",
          "Instagram",
          "Google",
          "WhatsApp direto",
          "Passou na frente do estabelecimento",
          "Anúncio pago",
          "Não sei dizer",
        ],
      },
      {
        id: "pet_q4",
        text: "Quantos atendimentos por semana, mais ou menos?",
        type: "single",
        options: ["Menos de 20", "20 a 50", "50 a 120", "Mais de 120"],
      },
      {
        id: "pet_q5",
        text: "Faltas e cancelamentos de última hora são um problema?",
        type: "single",
        options: [
          "Quase nunca acontece",
          "Acontece às vezes, mas não é grave",
          "É um problema sério, perco horário toda semana",
        ],
      },
      {
        id: "pet_q6",
        text: "O que mais te incomoda hoje? (pode marcar mais de uma)",
        type: "multi",
        options: [
          "Cliente manda mensagem de madrugada e eu só vejo depois",
          "Esqueço de lembrar vacinas, retorno ou banho periódico",
          "Não aparece tutor novo, vivo só dos antigos",
          "Fico respondendo \"qual o valor do banho?\" o dia todo",
          "Não apareço no Google quando procuram pet shop / vet na minha cidade",
          "Outra coisa (escrever)",
        ],
        hasOther: true,
      },
      {
        id: "pet_q7",
        text: "Você lembra os tutores de vacinas, banho periódico ou retorno?",
        type: "single",
        options: [
          "Sim, tenho sistema que manda automaticamente",
          "Sim, mas é manual, eu mesmo lembro e mando",
          "Às vezes, quando lembro",
          "Não faço isso ainda",
        ],
      },
      {
        id: "pet_q8",
        text: "Você já tem...",
        type: "multi",
        options: [
          "Site próprio",
          "Instagram ativo com fotos dos pets",
          "Google Meu Negócio (com horário e avaliações)",
          "Sistema de agendamento online",
          "WhatsApp Business configurado",
          "Nenhum dos anteriores",
        ],
      },
    ],
  },

  {
    id: "outro",
    icon: "✨",
    label: "Outro",
    description: "Outro tipo de negócio",
    questions: [
      {
        id: "outro_q1",
        text: "Que tipo de negócio é o seu?",
        type: "text",
      },
      {
        id: "outro_q2",
        text: "Há quanto tempo o negócio existe?",
        type: "single",
        options: [
          "Ainda não comecei",
          "Menos de 1 ano",
          "1 a 3 anos",
          "3 a 10 anos",
          "Mais de 10 anos",
        ],
      },
      {
        id: "outro_q3",
        text: "Atende sozinho ou tem equipe?",
        type: "single",
        options: [
          "Sozinho(a)",
          "2-5 pessoas",
          "6-20 pessoas",
          "Mais de 20 pessoas",
        ],
      },
      {
        id: "outro_q4",
        text: "Como o cliente novo geralmente chega?",
        type: "multi",
        options: [
          "Indicação",
          "Instagram",
          "Google",
          "Anúncios pagos",
          "Site próprio",
          "WhatsApp direto",
          "Passou na frente do estabelecimento",
          "Não sei dizer",
        ],
      },
      {
        id: "outro_q5",
        text: "Quantos clientes novos por mês, mais ou menos?",
        type: "single",
        options: [
          "Menos de 5",
          "5 a 20",
          "20 a 50",
          "50 a 200",
          "Mais de 200",
        ],
      },
      {
        id: "outro_q6",
        text: "Qual a maior dificuldade hoje?",
        type: "textarea",
      },
      {
        id: "outro_q7",
        text: "Você já tentou contratar agência ou profissional de marketing antes?",
        type: "single",
        options: [
          "Sim, e funcionou, só estou buscando melhorar",
          "Sim, mas não funcionou (perdi dinheiro/tempo)",
          "Nunca contratei, sempre fiz sozinho",
          "Pensei em contratar mas não sei nem por onde começar",
        ],
      },
      {
        id: "outro_q8",
        text: "Você já tem...",
        type: "multi",
        options: [
          "Site próprio",
          "Instagram ativo",
          "Google Meu Negócio",
          "Lista de email/WhatsApp de clientes",
          "Sistema de gestão / vendas online",
          "Nenhum dos anteriores",
        ],
      },
    ],
  },
];

// ─── Raio-X da Operação ──────────────────────────────────────────────────────
// 3 perguntas universais (valem pra qualquer nicho) que alimentam a estimativa
// de "quanto a operação está deixando na mesa por mês". Entram no fim do quiz,
// depois das perguntas do nicho.
export const RAIOX_QUESTIONS: QuizQuestion[] = [
  {
    id: "raiox_volume",
    text: "Quantas pessoas te procuram por dia? (mensagem, ligação ou pedido de orçamento)",
    type: "single",
    options: ["Menos de 10", "Entre 10 e 30", "Entre 30 e 60", "Mais de 60"],
  },
  {
    id: "raiox_ticket",
    text: "Quanto vale, em média, uma venda ou atendimento fechado?",
    type: "single",
    options: ["Até R$ 100", "De R$ 100 a R$ 500", "De R$ 500 a R$ 2.000", "Mais de R$ 2.000"],
  },
  {
    id: "raiox_perda",
    text: "De cada 10 pessoas que te procuram, quantas você perde por demora ou falta de resposta?",
    type: "single",
    options: ["Quase nenhuma (0 a 1)", "Algumas (2 a 3)", "Bastante (4 a 5)", "Muitas (6 ou mais)"],
  },
];

// Premissas VISÍVEIS (a conta é honesta e ajustável aqui num lugar só).
const RAIOX_VOLUME: Record<string, number> = {
  "Menos de 10": 6, "Entre 10 e 30": 20, "Entre 30 e 60": 45, "Mais de 60": 75,
};
const RAIOX_TICKET: Record<string, number> = {
  "Até R$ 100": 60, "De R$ 100 a R$ 500": 300, "De R$ 500 a R$ 2.000": 1200, "Mais de R$ 2.000": 3000,
};
const RAIOX_PERDA: Record<string, number> = {
  "Quase nenhuma (0 a 1)": 0.5, "Algumas (2 a 3)": 2.5, "Bastante (4 a 5)": 4.5, "Muitas (6 ou mais)": 7,
};
const RAIOX_DIAS_UTEIS = 26; // dias de operação no mês (ajuste se precisar)

export function formatBRL(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

// ─── Raio-X sob medida por nicho ─────────────────────────────────────────────
// Além do vazamento universal (atendimento que não é respondido a tempo), cada
// nicho tem UM vazamento próprio, com pergunta e conta próprias. Regra de ouro:
// todo número sai de algo que a pessoa respondeu + uma premissa VISÍVEL na tela.
// Nada de valor inventado. Os vazamentos escolhidos não se sobrepõem (não conta
// o mesmo cliente perdido duas vezes).

const SEMANAS_MES = 4.3;

function roundMoney(n: number): number {
  return n >= 10000 ? Math.round(n / 1000) * 1000 : Math.round(n / 100) * 100;
}

export interface Vazamento {
  id: string;
  titulo: string;
  valorMes: number;
  detalhe: string;
}

interface LeakConfig {
  pergunta: QuizQuestion;
  calc: (vol: number, ticket: number, resp: string) => Vazamento | null;
}

// vazamento de "falta / no-show": conta direta de furos por semana (não depende
// do volume, então não sobrepõe o vazamento do atendimento).
function vzFalta(rotulo: string): LeakConfig["calc"] {
  const m: Record<string, number> = { "Quase nenhum": 1, "Uns 2 a 4": 3, "Uns 5 a 10": 7, "Mais de 10": 13 };
  return (_vol, ticket, resp) => {
    const furos = m[resp];
    if (furos == null || furos === 0) return null;
    return {
      id: "falta",
      titulo: "Horário que fura (falta)",
      valorMes: roundMoney(furos * SEMANAS_MES * ticket),
      detalhe: `Cerca de ${furos} ${rotulo} por semana, com ticket de ${formatBRL(ticket)}. A maior parte some com confirmação automática no dia anterior.`,
    };
  };
}

// vazamento de "taxa de plataforma": a pessoa informa quanto paga de comissão
// por mês; recuperável em parte trazendo o cliente pro canal próprio.
function vzTaxa(titulo: string, canal: string): LeakConfig["calc"] {
  const m: Record<string, number> = {
    "Quase não uso": 0,
    "Até R$ 1.000": 600,
    "R$ 1.000 a R$ 3.000": 2000,
    "R$ 1.000 a R$ 4.000": 2500,
    "Mais de R$ 3.000": 4500,
    "Mais de R$ 4.000": 6000,
  };
  return (_vol, _ticket, resp) => {
    const taxa = m[resp];
    if (taxa == null || taxa === 0) return null;
    return {
      id: "taxa",
      titulo,
      valorMes: roundMoney(taxa * 0.3),
      detalhe: `Você paga cerca de ${formatBRL(taxa)} por mês de comissão. Trazendo o cliente pro ${canal}, dá pra recuperar boa parte.`,
    };
  };
}

// vazamento de "some depois do contato" (orçamento, matrícula, experimental,
// lead pro concorrente): parte é recuperável com resposta na hora e follow-up.
function vzRecuperavel(
  id: string,
  titulo: string,
  mapa: Record<string, number>,
  recuperavel: number,
  detalheFn: (n: number, recPct: number) => string
): LeakConfig["calc"] {
  return (vol, ticket, resp) => {
    const n = mapa[resp];
    if (n == null || n === 0) return null;
    const mes = vol * RAIOX_DIAS_UTEIS * (n / 10) * ticket * recuperavel;
    return {
      id,
      titulo,
      valorMes: roundMoney(mes),
      detalhe: detalheFn(Math.round(n), Math.round(recuperavel * 100)),
    };
  };
}

const DE10_BAIXO: Record<string, number> = { "1 ou 2": 1.5, "Uns 3 a 4": 3.5, "Uns 5 a 6": 5.5, "7 ou mais": 8 };
const DE10_ALTO: Record<string, number> = { "Umas 3 a 4": 3.5, "Umas 5 a 6": 5.5, "Umas 7 a 8": 7.5, "Quase todas": 9 };
const DE10_ALTO2: Record<string, number> = { "Uns 3 a 4": 3.5, "Uns 5 a 6": 5.5, "Uns 7 a 8": 7.5, "Quase todos": 9 };
const DE10_EXP: Record<string, number> = { "Umas 2 a 3": 2.5, "Umas 4 a 5": 4.5, "Umas 6 a 7": 6.5, "8 ou mais": 9 };

export const RAIOX_NICHO: Record<string, LeakConfig> = {
  saude: {
    pergunta: {
      id: "raiox_falta",
      text: "Por semana, quantos horários furam (paciente marca e não aparece)?",
      type: "single",
      options: ["Quase nenhum", "Uns 2 a 4", "Uns 5 a 10", "Mais de 10"],
    },
    calc: vzFalta("faltas"),
  },
  beleza: {
    pergunta: {
      id: "raiox_falta",
      text: "Por semana, quantos horários furam (cliente marca e não aparece)?",
      type: "single",
      options: ["Quase nenhum", "Uns 2 a 4", "Uns 5 a 10", "Mais de 10"],
    },
    calc: vzFalta("faltas"),
  },
  pet: {
    pergunta: {
      id: "raiox_falta",
      text: "Por semana, quantos horários furam (tutor marca e não aparece)?",
      type: "single",
      options: ["Quase nenhum", "Uns 2 a 4", "Uns 5 a 10", "Mais de 10"],
    },
    calc: vzFalta("faltas"),
  },
  alimentacao: {
    pergunta: {
      id: "raiox_taxa",
      text: "Por mês, quanto mais ou menos as taxas de delivery (iFood e afins) tiram de você?",
      type: "single",
      options: ["Quase não uso", "Até R$ 1.000", "R$ 1.000 a R$ 3.000", "Mais de R$ 3.000"],
    },
    calc: vzTaxa("Taxa dos apps de delivery", "seu canal (cardápio próprio e WhatsApp)"),
  },
  hospedagem: {
    pergunta: {
      id: "raiox_taxa",
      text: "Por mês, quanto as plataformas de reserva (Booking, Airbnb) tiram de comissão?",
      type: "single",
      options: ["Quase não uso", "Até R$ 1.000", "R$ 1.000 a R$ 4.000", "Mais de R$ 4.000"],
    },
    calc: vzTaxa("Comissão das plataformas de reserva", "seu canal de reserva direta"),
  },
  ecommerce: {
    pergunta: {
      id: "raiox_carrinho",
      text: "De cada 10 pessoas que põem produto no carrinho, quantas NÃO finalizam a compra?",
      type: "single",
      options: ["Umas 3 a 4", "Umas 5 a 6", "Umas 7 a 8", "Quase todas"],
    },
    calc: vzRecuperavel(
      "carrinho",
      "Carrinho abandonado",
      DE10_ALTO,
      0.15,
      (n, rec) => `${n} de cada 10 desistem no carrinho. Com lembrete automático, dá pra recuperar perto de ${rec}%.`
    ),
  },
  direito: {
    pergunta: {
      id: "raiox_orcamento",
      text: "De cada 10 pessoas que pedem orçamento ou consulta, quantas somem sem fechar?",
      type: "single",
      options: ["1 ou 2", "Uns 3 a 4", "Uns 5 a 6", "7 ou mais"],
    },
    calc: vzRecuperavel(
      "orcamento",
      "Orçamento que some sem resposta",
      { "1 ou 2": 1.5, "Uns 3 a 4": 3.5, "Uns 5 a 6": 5.5, "7 ou mais": 8 },
      0.35,
      (n, rec) => `${n} de cada 10 somem depois do primeiro contato. Com follow-up automático, dá pra reativar perto de ${rec}%.`
    ),
  },
  servicos: {
    pergunta: {
      id: "raiox_orcamento",
      text: "De cada 10 orçamentos que você manda, quantos somem sem resposta?",
      type: "single",
      options: ["1 ou 2", "Uns 3 a 4", "Uns 5 a 6", "7 ou mais"],
    },
    calc: vzRecuperavel(
      "orcamento",
      "Orçamento que some sem resposta",
      { "1 ou 2": 1.5, "Uns 3 a 4": 3.5, "Uns 5 a 6": 5.5, "7 ou mais": 8 },
      0.35,
      (n, rec) => `${n} de cada 10 orçamentos somem. Com follow-up automático, dá pra reativar perto de ${rec}%.`
    ),
  },
  educacao: {
    pergunta: {
      id: "raiox_matricula",
      text: "De cada 10 interessados que falam com você, quantos NÃO se matriculam?",
      type: "single",
      options: ["Uns 3 a 4", "Uns 5 a 6", "Uns 7 a 8", "Quase todos"],
    },
    calc: vzRecuperavel(
      "matricula",
      "Interessado que não matricula",
      DE10_ALTO2,
      0.3,
      (n, rec) => `${n} de cada 10 interessados não fecham. Com resposta na hora e follow-up, dá pra virar perto de ${rec}%.`
    ),
  },
  academia: {
    pergunta: {
      id: "raiox_experimental",
      text: "De cada 10 aulas experimentais, quantas NÃO viram plano?",
      type: "single",
      options: ["Umas 2 a 3", "Umas 4 a 5", "Umas 6 a 7", "8 ou mais"],
    },
    calc: vzRecuperavel(
      "experimental",
      "Experimental que não vira plano",
      DE10_EXP,
      0.3,
      (n, rec) => `${n} de cada 10 experimentais não fecham plano. Com acompanhamento automático, dá pra virar perto de ${rec}%.`
    ),
  },
  imobiliaria: {
    pergunta: {
      id: "raiox_concorrente",
      text: "De cada 10 leads das plataformas, quantos fecham com outro corretor?",
      type: "single",
      options: ["1 ou 2", "Uns 3 a 4", "Uns 5 a 6", "7 ou mais"],
    },
    calc: vzRecuperavel(
      "concorrente",
      "Lead que fecha com o concorrente",
      DE10_BAIXO,
      0.3,
      (n, rec) => `${n} de cada 10 leads vão pro concorrente por demora. Respondendo na hora, dá pra virar perto de ${rec}%.`
    ),
  },
};

export function raioxQuestionsFor(nichoId: string): QuizQuestion[] {
  const cfg = RAIOX_NICHO[nichoId];
  return cfg ? [...RAIOX_QUESTIONS, cfg.pergunta] : RAIOX_QUESTIONS;
}

export interface RaioXResumo {
  ok: boolean;
  vazamentos: Vazamento[];
  totalMes: number;
  volumeDia: number;
  ticket: number;
}

export function calcularVazamentos(
  nichoId: string,
  get: (id: string) => string
): RaioXResumo {
  const vol = RAIOX_VOLUME[get("raiox_volume")];
  const ticket = RAIOX_TICKET[get("raiox_ticket")];
  if (vol == null || ticket == null) {
    return { ok: false, vazamentos: [], totalMes: 0, volumeDia: 0, ticket: 0 };
  }

  const vazamentos: Vazamento[] = [];

  // vazamento universal: atendimento não respondido a tempo
  const perda = RAIOX_PERDA[get("raiox_perda")];
  if (perda != null) {
    const perdidosMes = Math.round(vol * RAIOX_DIAS_UTEIS * (perda / 10));
    vazamentos.push({
      id: "resposta",
      titulo: "Cliente que não é respondido a tempo",
      valorMes: roundMoney(perdidosMes * ticket),
      detalhe: `Cerca de ${vol} pessoas por dia te procuram. Pela demora, uns ${perdidosMes} por mês ficam sem resposta, com ticket de ${formatBRL(ticket)}.`,
    });
  }

  // vazamento próprio do nicho
  const cfg = RAIOX_NICHO[nichoId];
  if (cfg) {
    const vz = cfg.calc(vol, ticket, get(cfg.pergunta.id));
    if (vz) vazamentos.push(vz);
  }

  const totalMes = vazamentos.reduce((s, v) => s + v.valorMes, 0);
  return { ok: vazamentos.length > 0, vazamentos, totalMes, volumeDia: vol, ticket };
}
