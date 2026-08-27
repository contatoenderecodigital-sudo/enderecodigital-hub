/**
 * Oferta de presença local: site + Google Meu Negócio.
 *
 * É o que o parceiro vende na ligação fria. Diferente do playbook de venda
 * consultiva (playbook-vendas.ts), que serve para projeto grande e não fala
 * preço, aqui o preço é de tabela e o parceiro pode dizer na hora.
 *
 * Fonte dos números: tabela-fixa.md (jul/2026). Mudou lá, muda aqui.
 */

/* ------------------------------------------------------------------ preço */

export interface LinhaPreco {
  nome: string;
  valor: string;
  quando: string;
  entrega: string[];
  destaque?: boolean;
}

export const IMPLANTACAO: LinhaPreco = {
  nome: "Site Vitrine",
  valor: "R$ 1.200",
  quando: "uma vez, em até 3x no Pix",
  entrega: [
    "Site completo com a identidade da empresa",
    "Feito pro celular, de onde vem a maioria das visitas",
    "WhatsApp em destaque, com a mensagem já escrita pro cliente só mandar",
    "Serviços, estrutura, horário e localização",
    "Avaliações do Google aparecendo dentro do site",
    "Publicado no domínio da empresa e ligado ao perfil do Google",
    "Até 2 rodadas de alteração, pronto em 5 a 7 dias úteis",
  ],
};

export const MENSAIS: LinhaPreco[] = [
  {
    // Um plano so, de proposito. Dois planos lado a lado fazem o cliente caçar
    // o mais barato e diluem a venda, e o de R$ 97 sozinho nao entrega o que o
    // vendedor esta prometendo na ligação, que é o Google trabalhando.
    nome: "Suporte + Google Meu Negócio",
    valor: "R$ 247",
    quando: "por mês",
    destaque: true,
    entrega: [
      "Perfil do Google otimizado e mantido",
      "Publicações no Google e fotos novas",
      "Estratégia de avaliações montada pro negócio dele",
      "Resposta às avaliações que chegarem",
      "Relatório todo mês",
      "Site no ar 24h e certificado de segurança",
      "Backup semanal",
      "Alterações ilimitadas de texto, foto, horário e serviços",
      "Atendimento direto no WhatsApp",
    ],
  },
];

export const NOTA_PRECO =
  "Sem fidelidade, cancela quando quiser. É um preço só: não ofereça opção, " +
  "senão ele para de decidir se compra e passa a decidir qual é o mais barato.";

/* -------------------------------------------------------- o que vendemos */

export const FRASE_DE_UMA_LINHA =
  "A gente é um estúdio de software aqui da região. Você aparece pra quem procura " +
  "o seu serviço no Google, e quem acha já cai no seu WhatsApp com a conversa começada.";

export const A_LINHA_QUE_AMARRA = "O perfil traz, o site converte, o WhatsApp fecha.";

/* --------------------------------------------------- sequência da ligação */

export interface PassoOferta {
  n: number;
  titulo: string;
  objetivo: string;
  falas: string[];
  dica?: string;
}

export const SEQUENCIA: PassoOferta[] = [
  {
    n: 1,
    titulo: "Abertura",
    objetivo: "Comprar trinta segundos sendo específico. Pedir permissão baixa a guarda.",
    falas: [
      "Aqui é o {seu nome}, da Endereço Digital, aqui de {cidade}. Peguei você no meio de alguma coisa?",
      "Vou ser curto: eu estava olhando o perfil da {empresa} no Google agora pouco e vi uma coisa. Em um minuto você me diz se faz sentido, pode ser?",
    ],
  },
  {
    n: 2,
    titulo: "A pergunta que faz ele se ouvir",
    objetivo:
      "A premissa precisa sair da boca dele, não da sua. Quem afirma discute, quem pergunta convence.",
    falas: [
      "Deixa eu te perguntar uma coisa antes. Quando você precisa de um {profissional de outro ramo} que nunca usou, você faz o quê?",
      "Pois é. E o cliente que ainda não conhece vocês faz exatamente isso.",
    ],
    dica:
      "Escolhe um ramo diferente do dele, senão soa a armadilha. Falando com padaria, pergunta de eletricista.",
  },
  {
    n: 3,
    titulo: "A prova",
    objetivo:
      "Mostrar o que você viu no perfil dele. Isso não é venda, é notícia sobre o negócio dele. Ninguém desliga na cara de notícia.",
    falas: [
      "Você sabia que tem uma avaliação de {mês} reclamando de {assunto} que nunca foi respondida?",
      "A última foto do perfil de vocês é de {ano}.",
      "Vocês estão com {n} avaliações. A {concorrente} ali perto está com {n}.",
      "O perfil não tem link de site, então quem acha vocês não tem pra onde ir depois.",
    ],
    dica: "Concreto, com data e número. Sem adjetivo. Uma ou duas dessas, não as quatro.",
  },
  {
    n: 4,
    titulo: "A implicação, em pergunta",
    objetivo:
      "Tornar visível a perda que ele não vê. Perguntar e calar. O silêncio aqui trabalha por você.",
    falas: [
      "Das pessoas que acharam a sua concorrente essa semana, quantas você acha que teriam ligado pra você?",
      "Quando entra uma avaliação ruim e ninguém responde, o que a próxima pessoa que ler pensa?",
    ],
    dica: "Faça a pergunta e fique quieto. Quem falar primeiro perde.",
  },
  {
    n: 5,
    titulo: "Quanto vale um cliente",
    objetivo:
      "É aqui que o preço fica barato, antes de você falar o preço. A conta tem que ser feita por ele.",
    falas: [
      "Quanto vale um cliente novo pra vocês, em média?",
      "E quantos você acha que passaram e você nem ficou sabendo?",
    ],
    dica:
      "Anote a resposta. É esse número que responde qualquer objeção de preço depois, e é ele que dá a conversa pro time.",
  },
  {
    n: 6,
    titulo: "A oferta em uma linha",
    objetivo: "Explicar o que a gente faz sem virar catálogo. Três peças, uma frase.",
    falas: [
      "O perfil traz, o site converte, o WhatsApp fecha.",
      "A gente arruma o seu perfil do Google e mantém ele vivo todo mês, com foto, publicação e resposta de avaliação.",
      "E o site não é cartão de visita, ele existe pra transformar quem clicou em conversa no seu WhatsApp, com a mensagem já escrita. A pessoa só aperta enviar.",
    ],
  },
  {
    n: 7,
    titulo: "Marcar a reunião",
    objetivo:
      "Sair da ligação com dia e hora escolhidos. Fechar não é o seu trabalho, marcar é. E marcar é o trabalho inteiro.",
    falas: [
      "O que exatamente entra no caso de vocês quem monta é o pessoal, numa conversa de uns trinta minutos por vídeo.",
      "Vou te mandar o link agora no seu WhatsApp, você escolhe o horário que der. Fico aqui na linha enquanto chega.",
      "Consegue amanhã de manhã ou depois de amanhã à tarde?",
    ],
    dica:
      "Mande o link com ele ainda na linha e espere ele escolher. Reunião marcada depois que você desliga é reunião que não acontece. E puxe para os próximos dois dias: cada dia a mais esfria a dor que ele acabou de admitir.",
  },
];

/* ------------------------------------------------------ checagem do perfil */

export interface ItemChecagem {
  id: string;
  pergunta: string;
  ajuda: string;
}

export const CHECAGEM: ItemChecagem[] = [
  {
    id: "fotos",
    pergunta: "Qual a data da última foto?",
    ajuda: "Perfil parado há mais de um ano é o gancho mais fácil da ligação.",
  },
  {
    id: "avaliacoes",
    pergunta: "Quantas avaliações tem?",
    ajuda: "Anote o número exato. Número redondo soa a chute.",
  },
  {
    id: "respondidas",
    pergunta: "Alguma avaliação foi respondida?",
    ajuda: "Se tem reclamação sem resposta, é por aí que a conversa começa.",
  },
  {
    id: "concorrente",
    pergunta: "Quantas avaliações tem o concorrente mais perto?",
    ajuda: "A comparação é o que dói. Procure o mesmo ramo, mesma cidade.",
  },
  {
    id: "site",
    pergunta: "O perfil tem link de site?",
    ajuda: "Sem link, quem achou não tem pra onde ir. Essa é a venda inteira numa frase.",
  },
  {
    id: "horario",
    pergunta: "O horário está certo e completo?",
    ajuda: "Horário errado gera avaliação ruim de gente que foi e achou fechado.",
  },
  {
    id: "dono_perfil",
    pergunta: "Quem tem o acesso ao perfil?",
    ajuda:
      "Pergunte na ligação. Muita empresa nunca reivindicou o perfil ou quem criou foi alguém que sumiu. Isso muda o tamanho do trabalho e o time precisa saber antes.",
  },
];

/* ------------------------------------------------------------- quanto custa */

export const QUANTO_CUSTA: { quando: string; fala: string }[] = [
  {
    quando: "Primeira vez que ele perguntar",
    fala:
      "O site fica em mil e duzentos, que dá pra dividir em três de quatrocentos. Depois são duzentos e quarenta e sete por mês pra manter o Google trabalhando, sem fidelidade, cancela quando quiser. Agora, o que exatamente entra no caso de vocês quem monta é o pessoal na reunião.",
  },
  {
    quando: "Se ele puxar assunto sobre o mensal",
    fala:
      "É o que mantém o perfil vivo todo mês: foto, publicação e resposta de avaliação. O pessoal te mostra direitinho na reunião.",
  },
  {
    quando: "Se ele achar caro",
    fala:
      "Você me falou que um cliente novo vale {valor} pra vocês. O ano inteiro se paga com menos de um cliente por mês. Não é pra acreditar em mim, é a sua própria conta.",
  },
  {
    quando: "Se ele quiser desconto",
    fala:
      "Desconto eu não consigo dar, o preço é o mesmo pra todo mundo. O que dá pra fazer é dividir o site em três vezes, aí entra bem mais leve.",
  },
  {
    quando: "Se ele quiser fechar por telefone, sem reunião",
    fala:
      "Eu prefiro que você veja antes o que a gente faz, são trinta minutos. Não quero te vender uma coisa que você não viu.",
  },
  {
    quando: "Se ele perguntar de coisa grande, tipo sistema, delivery ou anúncio",
    fala:
      "Isso a gente faz, mas aí não tem preço de tabela, depende do que a gente achar na sua operação. É exatamente pra isso que serve a reunião.",
  },
];

export const NUNCA_PROMETER: string[] = [
  "Posição no Google, tipo aparecer em primeiro lugar",
  "Número de clientes, de leads ou de vendas",
  "Prazo que não seja os 5 a 7 dias úteis do site",
  "Desconto, cortesia ou teste grátis",
  "Integração com um sistema específico dele",
];

export const RESPOSTA_PADRAO =
  "Isso quem fecha é o time na reunião. Eu não quero te falar número errado.";
