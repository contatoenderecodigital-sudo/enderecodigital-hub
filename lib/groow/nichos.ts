// Banco de nichos curado pra prospecção (estilo Kaptar, calibrado pro ICP
// da Endereço Digital: negócio local que precisa de presença digital,
// mais algumas verticais B2B que pagam bem).

export const NICHOS: { categoria: string; itens: string[] }[] = [
  {
    categoria: "Beleza e Estética",
    itens: [
      "Barbearia", "Salão de beleza", "Clínica de estética", "Studio de sobrancelha",
      "Esmalteria / nail designer", "Studio de cílios", "Clínica de depilação a laser",
      "Studio de micropigmentação", "Studio de bronzeamento", "Loja de cosméticos",
    ],
  },
  {
    categoria: "Saúde e Bem-estar",
    itens: [
      "Clínica odontológica", "Clínica de fisioterapia", "Clínica de psicologia",
      "Clínica de nutrição", "Clínica veterinária", "Clínica médica popular",
      "Laboratório de análises clínicas", "Ótica", "Farmácia de manipulação",
      "Clínica de podologia", "Consultório de fonoaudiologia",
    ],
  },
  {
    categoria: "Alimentação",
    itens: [
      "Restaurante", "Pizzaria", "Hamburgueria", "Churrascaria", "Cafeteria",
      "Confeitaria / doceria", "Padaria", "Açaiteria", "Sushi / japonês",
      "Marmitaria / fit", "Food truck", "Sorveteria", "Distribuidora de bebidas",
    ],
  },
  {
    categoria: "Pet",
    itens: [
      "Pet shop", "Banho e tosa", "Hotel para cães", "Adestrador de cães",
      "Clínica veterinária 24h", "Creche para pets",
    ],
  },
  {
    categoria: "Automotivo",
    itens: [
      "Oficina mecânica", "Auto center", "Funilaria e pintura", "Auto elétrica",
      "Estética automotiva", "Loja de pneus", "Concessionária de seminovos",
      "Guincho 24h", "Instalação de som e película", "Lava rápido",
    ],
  },
  {
    categoria: "Casa e Serviços",
    itens: [
      "Vidraçaria", "Marcenaria / móveis planejados", "Serralheria", "Marmoraria",
      "Empresa de dedetização", "Desentupidora", "Eletricista", "Encanador",
      "Empresa de mudanças", "Paisagismo e jardinagem", "Climatização / ar-condicionado",
      "Energia solar", "Construtora / reformas", "Empresa de limpeza",
    ],
  },
  {
    categoria: "Fitness e Esporte",
    itens: [
      "Academia", "Studio de pilates", "Crossfit / box", "Personal trainer",
      "Studio de dança", "Escola de natação", "Quadra de beach tennis",
      "Loja de suplementos",
    ],
  },
  {
    categoria: "Educação",
    itens: [
      "Escola de idiomas", "Escola infantil / creche", "Curso preparatório",
      "Autoescola", "Escola de música", "Reforço escolar", "Curso profissionalizante",
    ],
  },
  {
    categoria: "Moda e Varejo",
    itens: [
      "Loja de roupas femininas", "Loja de roupas masculinas", "Loja infantil",
      "Loja de calçados", "Joalheria / semijoias", "Loja de móveis",
      "Loja de materiais de construção", "Loja de eletrônicos / celulares",
      "Papelaria", "Floricultura",
    ],
  },
  {
    categoria: "Imobiliário e Jurídico",
    itens: [
      "Imobiliária", "Corretor de imóveis", "Advocacia trabalhista",
      "Advocacia previdenciária", "Advocacia empresarial", "Escritório de contabilidade",
      "Corretora de seguros", "Administradora de condomínios", "Despachante",
    ],
  },
  {
    categoria: "Turismo e Eventos",
    itens: [
      "Pousada", "Hotel", "Agência de viagens", "Buffet de festas",
      "Espaço de eventos", "Fotógrafo de eventos", "Locação de brinquedos",
      "Cerimonial de casamentos",
    ],
  },
  {
    categoria: "B2B e Indústria",
    itens: [
      "Gráfica", "Comunicação visual / fachadas", "Uniformes profissionais",
      "Distribuidora de alimentos", "Transportadora", "Metalúrgica",
      "Fabricante de móveis corporativos", "Empresa de segurança / monitoramento",
      "Locação de equipamentos", "Assistência técnica industrial",
    ],
  },
  {
    categoria: "Agronegócio",
    itens: [
      "Agropecuária", "Distribuidor de insumos agrícolas", "Revenda de tratores e máquinas",
      "Empresa de irrigação", "Produtos veterinários", "Armazém de grãos",
      "Consultoria agronômica",
    ],
  },
];

export const TOTAL_NICHOS = NICHOS.reduce((a, c) => a + c.itens.length, 0);
