// ============================================================================
//  SEMENTE · Barbearia Lâmina, a demonstração do módulo Agenda
//
//  SERVE PRA VENDER, não só pra testar. Numa reunião não dá pra abrir painel
//  vazio, e também não dá pra abrir painel com número que não fecha: barbearia
//  de três cadeiras faturando R$ 500 no mês entrega na hora que o dado é
//  inventado, e aí o dono para de acreditar no resto da tela.
//
//  Por isso a base tem TAMANHO DE BARBEARIA DE VERDADE. Três cadeiras, jornada
//  de terça a sábado, cerca de 480 pessoas na base e três meses de histórico.
//  Ocupação, ticket médio e comissão saem nos patamares que o dono reconhece,
//  porque são calculados a partir do movimento, não escritos à mão.
//
//  E nada do que importa é sorteado. Os HERÓIS são escritos um a um, e é deles
//  que saem as linhas que ganham a reunião:
//
//   · dois clientes críticos, atrasados mais de 50% sobre o próprio ritmo;
//   · três em atenção;
//   · dois fregueses em dia, pra lista não parecer alarmista;
//   · faltas concentradas em três pessoas, que é o que justifica pedir sinal
//     desses e não da clientela inteira;
//   · terça de manhã vazia de propósito, o buraco estrutural que o dono nunca
//     enxerga sozinho;
//   · um barbeiro que corta bem e não vende produto nenhum.
//
//  O resto da base é massa de fundo: existe pra que os números de cima sejam
//  verdade, e ela não aparece em lugar nenhum da tela.
//
//  IDEMPOTENTE. Roda de novo e refaz do zero, sem duplicar.
//
//  Pra apagar tudo:  node db/scripts/agenda-semente-demo.cjs --apagar
//
//  Precisa do túnel aberto em outra janela:
//    powershell -ExecutionPolicy Bypass -File db\scripts\tunel.ps1
// ============================================================================

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const RAIZ = path.resolve(__dirname, '..', '..');
for (const l of fs.readFileSync(RAIZ + '/.env.local', 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const { Client } = require('pg');
const bcrypt = require(RAIZ + '/node_modules/bcryptjs');

const SLUG = 'lamina-demo';
const EMAIL = 'demo@barbearialamina.com.br';
const SENHA = 'lamina2026';
const EMAIL_BARBEIRO = 'alex@barbearialamina.com.br';

// Brasil não tem mais horário de verão desde 2019, então o deslocamento é fixo.
const TZ = '-03';
const DIAS_HISTORICO = 92;
// O tamanho da base não é gosto: ele é o que faz o histórico rodar no mesmo
// ritmo da semana que vem. Com base pequena o passado sai a 19 atendimentos por
// dia e o futuro a 30, e a barbearia aparece em explosão, o que ninguém acredita.
// Com intervalo médio de 28 dias, cada pessoa volta ~3,2 vezes em três meses,
// então é o número de clientes que fixa o movimento diário.
const CLIENTES_MASSA = 700;

// Ocupação alvo por dia da semana. É o que faz a tela parecer uma barbearia
// que roda: sábado lotado, meio de semana cheio, e a TERÇA fraca de propósito.
const OCUPACAO = { 2: 0.42, 3: 0.74, 4: 0.78, 5: 0.86, 6: 0.93 };

const PROFISSIONAIS = [
  { nome: 'Alex Bordignon',  apelido: 'Alex',  cor: '#c9a227', comissao: 55, telefone: '5549991000001' },
  { nome: 'Tiago Mendes',    apelido: 'Tiago', cor: '#6fd39b', comissao: 50, telefone: '5549991000002' },
  // O Rafa corta bem e não vende produto. É a linha de treinamento no raio-X.
  { nome: 'Rafael Prux',     apelido: 'Rafa',  cor: '#7ab6f0', comissao: 45, telefone: '5549991000003' },
];

const SERVICOS = [
  { chave: 'corte',     nome: 'Corte',           dur: 30,  pos: 5,  preco: 4500,  retorno: 21, peso: 55 },
  { chave: 'combo',     nome: 'Corte com barba', dur: 60,  pos: 5,  preco: 7000,  retorno: 21, peso: 22 },
  { chave: 'barba',     nome: 'Barba',           dur: 30,  pos: 5,  preco: 3500,  retorno: 14, peso: 12 },
  { chave: 'pezinho',   nome: 'Pezinho',         dur: 15,  pos: 0,  preco: 2000,  retorno: 10, peso: 8 },
  { chave: 'platinado', nome: 'Platinado',       dur: 120, pos: 10, preco: 18000, retorno: 45, peso: 3 },
];

const PRODUTOS = [
  { nome: 'Pomada modeladora', cat: 'cosmetico', preco: 4500, custo: 2200, estoque: 14, min: 5 },
  { nome: 'Óleo para barba',   cat: 'cosmetico', preco: 5500, custo: 2700, estoque: 3,  min: 5 },
  { nome: 'Shampoo antiqueda', cat: 'cosmetico', preco: 6900, custo: 3400, estoque: 9,  min: 4 },
  { nome: 'Cerveja long neck', cat: 'bar',       preco: 1200, custo: 500,  estoque: 48, min: 24 },
  { nome: 'Refrigerante lata', cat: 'bar',       preco: 800,  custo: 300,  estoque: 30, min: 12 },
];

// Os heróis. Cada um existe por um motivo e o motivo está escrito.
//
// Herói NÃO leva falta no lugar de uma visita: falta come uma visita
// concluída, o intervalo entre as concluídas dobra, e o ritmo que o raio-X
// calcula deixa de ser o ritmo real da pessoa. Foi assim que o Diego virou "a
// cada 37 dias" na primeira versão desta semente, quando o combinado era 28.
const HEROIS = [
  { nome: 'João Vitor Munaretto', tel: '5549992000101', intervalo: 21, prof: 0, srv: 'combo', sumiu: 38, papel: 'critico' },
  { nome: 'Diego Slongo',         tel: '5549992000103', intervalo: 28, prof: 0, srv: 'corte', sumiu: 51, papel: 'critico' },
  { nome: 'Marcos Feltrin',       tel: '5549992000102', intervalo: 20, prof: 1, srv: 'corte', sumiu: 29, papel: 'atencao' },
  { nome: 'Rodrigo Panozzo',      tel: '5549992000104', intervalo: 30, prof: 2, srv: 'corte', sumiu: 39, papel: 'atencao' },
  { nome: 'Eduardo Sartor',       tel: '5549992000110', intervalo: 35, prof: 0, srv: 'platinado', sumiu: 45, papel: 'atencao' },
  { nome: 'Anderson Kruger',      tel: '5549992000105', intervalo: 12, prof: 0, srv: 'corte', papel: 'fiel' },
  { nome: 'Vinícius Dallabrida',  tel: '5549992000106', intervalo: 15, prof: 1, srv: 'combo', papel: 'fiel' },
  // Os que faltam. Concentrado em três de propósito: falta espalhada não vira
  // decisão, falta concentrada vira política de sinal só pra esses.
  { nome: 'Maicon Tonello',       tel: '5549992000112', intervalo: 26, prof: 2, srv: 'corte', faltas: 4, papel: 'faltoso' },
  { nome: 'Cristian Boff',        tel: '5549992000111', intervalo: 16, prof: 1, srv: 'barba', faltas: 3, papel: 'faltoso' },
  { nome: 'Willian Grando',       tel: '5549992000113', intervalo: 19, prof: 0, srv: 'corte', faltas: 3, papel: 'faltoso' },
];

// Massa de fundo. Nomes da região, descendência italiana e alemã, que é o que
// se lê numa lista de clientes de Xanxerê.
const PRIMEIROS = ['Adriano','Alan','Alexandre','André','Augusto','Bruno','Caio','Carlos','César','Cleiton',
  'Daniel','Danilo','Davi','Douglas','Edson','Emerson','Fábio','Fernando','Gabriel','Gilmar','Guilherme',
  'Gustavo','Henrique','Hugo','Igor','Jean','Jonas','Jorge','José','Juliano','Kevin','Leandro','Leonardo',
  'Lucas','Luciano','Luís','Marcelo','Marcio','Mateus','Matheus','Maurício','Nelson','Nicolas','Otávio',
  'Patrick','Paulo','Pedro','Rafael','Renan','Ricardo','Roberto','Rogério','Ronaldo','Samuel','Sérgio',
  'Thiago','Tomás','Valdir','Vitor','Wagner'];
const SOBRENOMES = ['Andreatta','Baldissera','Bertan','Bianchi','Bortoluzzi','Brancher','Cadorin','Callegari',
  'Cerutti','Dallagnol','De Marco','Facchini','Fávero','Fontana','Girardi','Gnoatto','Grando','Guerra',
  'Hoffmann','Kessler','Klein','Lazzarotto','Lorenzon','Maccari','Marchi','Mazzurana','Menegatti','Nardi',
  'Oliveira','Pagno','Pelisser','Perin','Pretto','Rambo','Reichert','Rossi','Sartori','Scapin','Schmidt',
  'Segalin','Simonetti','Sordi','Tonial','Trentin','Vicenzi','Wagner','Zanella','Zatta'];

// ---------------------------------------------------------------------------
//  aleatório com semente fixa
//
//  A demo tem que sair igual toda vez. Número que você mostrou na reunião
//  passada não pode sumir na próxima.
// ---------------------------------------------------------------------------
let semente = 20260905;
function sorte() {
  semente = (semente * 1103515245 + 12345) % 2147483648;
  return semente / 2147483648;
}
const entre = (a, b) => a + Math.floor(sorte() * (b - a + 1));
const escolha = (lista) => lista[entre(0, lista.length - 1)];

// ---------------------------------------------------------------------------
//  datas
// ---------------------------------------------------------------------------
const HOJE = new Date();
function diaISO(offset) {
  const d = new Date(Date.UTC(HOJE.getFullYear(), HOJE.getMonth(), HOJE.getDate()));
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}
const diaDaSemana = (iso) => new Date(iso + 'T12:00:00Z').getUTCDay();
function desloca(iso, n) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
// Barbearia fecha domingo e segunda. Domingo cai pro sábado e segunda sobe pra
// terça: jogar os dois pro sábado empilharia o fim de semana, e a terça, que
// precisa aparecer fraca, ficaria fraca por acidente e não por escolha.
function paraDiaAberto(iso) {
  const d = diaDaSemana(iso);
  if (d === 0) return desloca(iso, -1);
  if (d === 1) return desloca(iso, 1);
  return iso;
}
const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const carimbo = (iso, min) => `${iso} ${hhmm(min)}:00${TZ}`;

// ---------------------------------------------------------------------------
//  alocação de horário
//
//  A trava de sobreposição do banco é real e vale também pra semente: gerar
//  dois atendimentos em cima do outro faria o script morrer no meio.
// ---------------------------------------------------------------------------
const ABRE = 9 * 60, ALMOCO_INI = 12 * 60, ALMOCO_FIM = 13 * 60 + 30, FECHA = 19 * 60;
const ocupacao = new Map(); // `prof|dia` -> [[ini, fim], ...]

function livre(chave, ini, fim) {
  if (ini < ABRE || fim > FECHA) return false;
  if (ini < ALMOCO_FIM && fim > ALMOCO_INI) return false; // atravessa o almoço
  return !(ocupacao.get(chave) || []).some(([a, b]) => ini < b && fim > a);
}
// `semVolta` desliga a segunda passada. Serve pra terça de manhã, que precisa
// continuar vazia: com a volta ligada o buraco se preencheria sozinho e a demo
// perderia a linha que vira campanha de terça.
function alocar(profIdx, iso, duracao, preferido = ABRE, semVolta = false) {
  const chave = `${profIdx}|${iso}`;
  if (!ocupacao.has(chave)) ocupacao.set(chave, []);
  for (const partida of semVolta ? [preferido] : [preferido, ABRE]) {
    for (let ini = partida; ini + duracao <= FECHA; ini += 15) {
      if (livre(chave, ini, ini + duracao)) {
        ocupacao.get(chave).push([ini, ini + duracao]);
        return ini;
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
//  inserção em lote
//
//  São mais de dez mil linhas. Uma instrução por linha, atravessando o túnel
//  SSH, levaria dezenas de minutos e ninguém rodaria a semente duas vezes.
// ---------------------------------------------------------------------------
async function emLote(c, tabela, colunas, linhas, porVez = 400) {
  for (let i = 0; i < linhas.length; i += porVez) {
    const fatia = linhas.slice(i, i + porVez);
    const valores = fatia.map((_, j) =>
      '(' + colunas.map((__, k) => `$${j * colunas.length + k + 1}`).join(',') + ')').join(',');
    await c.query(
      `INSERT INTO ${tabela} (${colunas.join(',')}) VALUES ${valores}`,
      fatia.flat(),
    );
  }
}

// ---------------------------------------------------------------------------
(async () => {
  const apagar = process.argv.includes('--apagar');
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  try {
    await c.query('BEGIN');

    const antigo = await c.query(`SELECT id FROM negocios WHERE slug = $1`, [SLUG]);
    if (antigo.rows[0]) {
      await c.query(`DELETE FROM usuarios WHERE negocio_id = $1`, [antigo.rows[0].id]);
      await c.query(`DELETE FROM negocios WHERE id = $1`, [antigo.rows[0].id]);
      console.log('demo anterior apagada');
    }
    if (apagar) {
      await c.query('COMMIT');
      console.log('Pronto. Nada mais foi tocado.');
      return;
    }

    const hub = (await c.query(`SELECT id FROM hubs ORDER BY criado_em LIMIT 1`)).rows[0].id;
    // O módulo é de nicho e vem desligado no hub. A demo liga só pra ela.
    await c.query(`UPDATE hubs SET mod_agenda = false WHERE id = $1`, [hub]);

    const neg = (await c.query(
      `INSERT INTO negocios (hub_id, slug, nome, nome_fantasia, segmento, marca_cor,
                             mod_agenda, mod_crm, status, observacoes)
       VALUES ($1,$2,'Barbearia Lâmina LTDA','Barbearia Lâmina','Barbearia','#c9a227',
               true,true,'ativo',
               'Barbearia de demonstração do módulo Agenda. Pode apagar sem dó.')
       RETURNING id`, [hub, SLUG])).rows[0].id;

    const hash = await bcrypt.hash(SENHA, 10);
    await c.query(
      `INSERT INTO usuarios (negocio_id, email, senha_hash, papel) VALUES ($1,$2,$3,'dono')`,
      [neg, EMAIL, hash]);
    // O barbeiro entra também: é ele que vê o próprio fechamento de comissão, e
    // é isso que faz o time inteiro defender o sistema junto com o dono.
    const uBarbeiro = (await c.query(
      `INSERT INTO usuarios (negocio_id, email, senha_hash, papel) VALUES ($1,$2,$3,'operador')
       RETURNING id`, [neg, EMAIL_BARBEIRO, hash])).rows[0].id;

    const filial = (await c.query(
      `INSERT INTO filiais (negocio_id, nome, nome_curto, endereco, bairro, cidade, uf, whatsapp, horario)
       VALUES ($1,'Barbearia Lâmina Centro','Centro','Rua Rui Barbosa, 421','Centro','Xanxerê','SC',
               '5549991000000','Terça a sábado, 9h às 19h') RETURNING id`, [neg])).rows[0].id;

    await c.query(
      `INSERT INTO agenda_config (negocio_id, grade_min, antecedencia_min_horas,
                                  lembrete_horas_antes, pesquisa_ativa, comissao_servico_pct)
       VALUES ($1, 15, 2, 24, true, 50)`, [neg]);

    // ---- profissionais ----
    const profs = PROFISSIONAIS.map((p, i) => ({ id: randomUUID(), ordem: i, ...p }));
    await emLote(c, 'agenda_profissionais',
      ['id','negocio_id','filial_id','usuario_id','nome','apelido','telefone','cor','comissao_servico_pct','ordem'],
      profs.map((p, i) => [p.id, neg, filial, i === 0 ? uBarbeiro : null,
        p.nome, p.apelido, p.telefone, p.cor, p.comissao, i]));

    // ---- serviços ----
    const servicos = {};
    const linhasServ = SERVICOS.map((s, i) => {
      const id = randomUUID();
      servicos[s.chave] = { id, ...s };
      return [id, neg, s.nome, s.dur, s.pos, s.preco, Math.round(s.preco * 0.08), s.retorno, i];
    });
    await emLote(c, 'agenda_servicos',
      ['id','negocio_id','nome','duracao_min','intervalo_pos_min','preco_cent','custo_cent','retorno_dias','ordem'],
      linhasServ);
    // Sorteio de serviço por peso: corte é a maioria, platinado é raro.
    const SORTEIO_SRV = SERVICOS.flatMap((s) => Array(s.peso).fill(s.chave));

    // ---- produtos ----
    const produtos = PRODUTOS.map((p) => ({ id: randomUUID(), ...p }));
    await emLote(c, 'agenda_produtos',
      ['id','negocio_id','nome','categoria','preco_cent','custo_cent','estoque_minimo'],
      produtos.map((p) => [p.id, neg, p.nome, p.cat, p.preco, p.custo, p.min]));
    // O saldo entra por movimento, nunca na mão: é o gatilho que mantém a
    // coluna estoque igual à soma dos movimentos.
    // A data vai explicita: mandar null numa coluna NOT NULL atropela o DEFAULT
    // da tabela em vez de cair nele, e a insercao estoura.
    const compraInicial = carimbo(paraDiaAberto(diaISO(-DIAS_HISTORICO)), ABRE);
    const movimentos = produtos.map((p) =>
      [randomUUID(), neg, p.id, 'entrada', p.estoque, p.custo, null, 'Estoque inicial', compraInicial]);

    // ---- jornada: terça a sábado, com almoço ----
    const jornadas = [];
    for (const p of profs) {
      for (let dow = 2; dow <= 6; dow++) {
        // O Rafa é o mais novo da casa e só trabalha de quarta a sábado.
        if (p.apelido === 'Rafa' && dow === 2) continue;
        jornadas.push([randomUUID(), neg, p.id, dow, hhmm(ABRE), hhmm(ALMOCO_INI)]);
        jornadas.push([randomUUID(), neg, p.id, dow, hhmm(ALMOCO_FIM), hhmm(FECHA)]);
      }
    }
    await emLote(c, 'agenda_jornadas',
      ['id','negocio_id','profissional_id','dia_semana','inicio','fim'], jornadas);

    // ---- clientes ----
    const usados = new Set();
    const clientes = HEROIS.map((h) => ({ id: randomUUID(), heroi: true, ...h }));
    for (const h of clientes) usados.add(h.nome);
    let tel = 5549993000000;
    let voltas = 0;
    while (clientes.length < HEROIS.length + CLIENTES_MASSA && voltas < 40000) {
      voltas++;
      const nome = `${escolha(PRIMEIROS)} ${escolha(SOBRENOMES)}`;
      if (usados.has(nome)) continue;
      usados.add(nome);
      clientes.push({
        id: randomUUID(), nome, tel: String(++tel), heroi: false,
        intervalo: entre(12, 45),
        prof: entre(0, profs.length - 1),
        srv: escolha(SORTEIO_SRV),
        // A maioria está em dia. Alguns atrasam sozinhos, que é o normal de
        // qualquer base, e é isso que dá volume à lista sem inventar drama.
        sumiu: sorte() < 0.13 ? entre(20, 70) : null,
      });
    }
    await emLote(c, 'agenda_clientes',
      ['id','negocio_id','nome','telefone','origem','nascimento'],
      clientes.map((cl) => [cl.id, neg, cl.nome, cl.tel,
        cl.heroi ? 'whatsapp' : escolha(['whatsapp','site','painel','indicacao','presencial']),
        `19${entre(78, 99)}-${String(entre(1, 12)).padStart(2, '0')}-${String(entre(1, 28)).padStart(2, '0')}`]));

    // ---- histórico ----
    const agendamentos = [], agServicos = [], comandas = [], comandaItens = [], avaliacoes = [];
    let numero = 0;

    function marcar(cl, iso, profIdx, srv, status) {
      const dur = srv.dur + srv.pos;
      // Fim de tarde é o pico da barbearia. Cliente de manhã existe, mas é a
      // minoria, e é isso que deixa a manhã com buraco de verdade.
      const preferido = sorte() < 0.62 ? 14 * 60 : ABRE;
      const ini = alocar(profIdx, iso, dur, preferido);
      if (ini === null) return null;
      const id = randomUUID();
      agendamentos.push([id, neg, filial, profs[profIdx].id, cl.id,
        carimbo(iso, ini), carimbo(iso, ini + dur), status,
        sorte() < 0.62 ? 'whatsapp' : (sorte() < 0.5 ? 'site' : 'painel'), srv.preco,
        status === 'faltou' ? null : carimbo(iso, ini)]);
      agServicos.push([randomUUID(), neg, id, srv.id, profs[profIdx].id, srv.preco, srv.dur, 0]);
      if (status !== 'concluido') return { id, ini, dur };

      // ---- comanda ----
      const itens = [{ tipo: 'servico', srv: srv.id, prod: null, desc: srv.nome, preco: srv.preco }];
      // O Rafa quase não vende produto. É a coluna Produto do raio-X, e é
      // conversa de treinamento, não de demissão.
      const chance = profs[profIdx].apelido === 'Rafa' ? 0.02 : 0.26;
      if (sorte() < chance) {
        const pr = escolha(produtos);
        itens.push({ tipo: 'produto', srv: null, prod: pr.id, desc: pr.nome, preco: pr.preco });
      }
      const subtotal = itens.reduce((t, i) => t + i.preco, 0);
      const forma = escolha(['dinheiro','pix','pix','debito','credito']);
      // Maquininha come parte do que entrou. Sem isso o dono acha que faturou
      // o valor cheio.
      const taxa = forma === 'credito' ? Math.round(subtotal * 0.0399)
        : forma === 'debito' ? Math.round(subtotal * 0.0149) : 0;
      const comanda = randomUUID();
      comandas.push([comanda, neg, filial, cl.id, id, ++numero, 'fechada',
        subtotal, subtotal, taxa, forma, carimbo(iso, ini), carimbo(iso, ini + dur)]);
      for (const it of itens) {
        const pct = it.tipo === 'servico' ? profs[profIdx].comissao : 10;
        comandaItens.push([randomUUID(), neg, comanda, it.tipo, it.srv, it.prod, profs[profIdx].id,
          it.desc, 1, it.preco, it.preco, pct, Math.round(it.preco * pct / 100), carimbo(iso, ini + dur)]);
        if (it.tipo === 'produto') {
          movimentos.push([randomUUID(), neg, it.prod, 'venda', -1, null, comanda, null, carimbo(iso, ini + dur)]);
        }
      }
      // Pesquisa só nos últimos 60 dias: a nota que interessa é a recente.
      const idade = Math.round((Date.now() - new Date(carimbo(iso, ini)).getTime()) / 86400000);
      if (idade <= 60 && sorte() < 0.38) {
        const nota = profs[profIdx].apelido === 'Rafa'
          ? (sorte() < 0.28 ? 3 : 4) : (sorte() < 0.86 ? 5 : 4);
        avaliacoes.push([randomUUID(), neg, id, cl.id, profs[profIdx].id, nota, carimbo(iso, ini + dur + 60)]);
      }
      return { id, ini, dur };
    }

    // Heróis primeiro, pra garantir que o horário deles cabe antes da massa
    // encher a agenda. A linha que ganha a reunião não pode depender de sobra.
    const ordem = [...clientes].sort((a, b) => (b.heroi ? 1 : 0) - (a.heroi ? 1 : 0));

    for (const cl of ordem) {
      const ultima = cl.sumiu ?? Math.max(1, Math.round(cl.intervalo * (0.15 + sorte() * 0.5)));
      const offsets = [];
      for (let d = ultima; d <= DIAS_HISTORICO; d += cl.intervalo + entre(-2, 2)) offsets.push(d);
      offsets.reverse(); // do mais antigo pro mais recente

      let faltasRestantes = cl.faltas ?? 0;
      for (const off of offsets) {
        const iso = paraDiaAberto(diaISO(-off));
        let profIdx = sorte() < 0.88 ? cl.prof : entre(0, profs.length - 1);
        if (profs[profIdx].apelido === 'Rafa' && diaDaSemana(iso) === 2) profIdx = entre(0, 1);
        const srv = servicos[cl.heroi ? cl.srv : (sorte() < 0.75 ? cl.srv : escolha(SORTEIO_SRV))];

        // A falta entra como uma marcação A MAIS, alguns dias antes da visita
        // que aconteceu. Assim ela não come uma visita concluída e o ritmo da
        // pessoa continua sendo o ritmo dela.
        //
        // Sem sorteio: com moeda no meio, o faltoso de quatro faltas saía com
        // uma, e a linha "três faltas ou mais é candidato a sinal" ficava sem
        // ninguém embaixo dela. Se o dia estiver cheio, tenta o anterior.
        if (faltasRestantes > 0 && off < 78) {
          for (const recuo of [3, 4, 5, 6, 7]) {
            const isoFalta = paraDiaAberto(diaISO(-(off + recuo)));
            if (marcar(cl, isoFalta, profIdx, srv, 'faltou')) { faltasRestantes--; break; }
          }
        }
        marcar(cl, iso, profIdx, srv, 'concluido');
      }
    }

    // Faltas espalhadas na massa, poucas, pra taxa da casa não ficar zerada.
    for (const cl of clientes.filter((x) => !x.heroi).slice(0, 22)) {
      const iso = paraDiaAberto(diaISO(-entre(5, 70)));
      marcar(cl, iso, cl.prof, servicos[cl.srv], 'faltou');
    }

    // ---- a semana que vem ----
    // Preenchida até a ocupação alvo de cada dia, e a TERÇA DE MANHÃ fica
    // vazia: é o buraco estrutural que o dono nunca enxerga sozinho, e é o que
    // vira campanha de terça.
    //
    // Quem está sumido NÃO entra aqui. Um atendimento hoje zeraria os dias sem
    // vir e apagaria o João Vitor do raio-X. E é o certo pela lógica também:
    // quem sumiu não tem horário marcado.
    const disponiveis = clientes.filter((cl) => !cl.sumiu);
    let futuros = 0;
    const agora = HOJE.getHours() * 60 + HOJE.getMinutes();

    for (let off = 0; off <= 6; off++) {
      const iso = diaISO(off);
      const dow = diaDaSemana(iso);
      if (dow === 0 || dow === 1) continue;

      const barbeiros = dow === 2 ? 2 : 3; // Rafa não trabalha terça
      const minutosDia = barbeiros * ((ALMOCO_INI - ABRE) + (FECHA - ALMOCO_FIM));
      const alvo = Math.round(minutosDia * OCUPACAO[dow]);
      const jaNoDia = new Set();
      let usado = 0, tentativas = 0;

      while (usado < alvo && tentativas < 600) {
        tentativas++;
        const cl = escolha(disponiveis);
        // Mesmo nome duas vezes no mesmo dia denuncia que a tela é gerada.
        if (jaNoDia.has(cl.nome)) continue;
        let profIdx = sorte() < 0.8 ? cl.prof : entre(0, profs.length - 1);
        if (profs[profIdx].apelido === 'Rafa' && dow === 2) profIdx = entre(0, 1);

        const srv = servicos[sorte() < 0.7 ? cl.srv : escolha(SORTEIO_SRV)];
        const dur = srv.dur + srv.pos;
        // Terça: nada antes do almoço, e sem a segunda passada que preencheria
        // a manhã de volta.
        const preferido = dow === 2 ? ALMOCO_FIM : (sorte() < 0.55 ? 14 * 60 : ABRE);
        const ini = alocar(profIdx, iso, dur, preferido, dow === 2);
        if (ini === null) continue;
        jaNoDia.add(cl.nome);
        usado += dur;

        // O que já passou hoje aparece como atendido, e o resto como marcado.
        const status = off === 0 && ini + dur < agora ? 'concluido'
          : off === 0 && ini <= agora ? 'em_atendimento'
          : sorte() < 0.78 ? 'confirmado' : 'pendente';

        const id = randomUUID();
        agendamentos.push([id, neg, filial, profs[profIdx].id, cl.id,
          carimbo(iso, ini), carimbo(iso, ini + dur), status,
          sorte() < 0.66 ? 'whatsapp' : 'site', srv.preco,
          status === 'pendente' ? null : carimbo(iso, ini)]);
        agServicos.push([randomUUID(), neg, id, srv.id, profs[profIdx].id, srv.preco, srv.dur, 0]);

        // Atendimento de hoje que já terminou também fecha comanda, senão o
        // caixa do dia aparece zerado na tela principal.
        if (status === 'concluido') {
          const comanda = randomUUID();
          comandas.push([comanda, neg, filial, cl.id, id, ++numero, 'fechada',
            srv.preco, srv.preco, 0, 'pix', carimbo(iso, ini), carimbo(iso, ini + dur)]);
          comandaItens.push([randomUUID(), neg, comanda, 'servico', srv.id, null, profs[profIdx].id,
            srv.nome, 1, srv.preco, srv.preco, profs[profIdx].comissao,
            Math.round(srv.preco * profs[profIdx].comissao / 100), carimbo(iso, ini + dur)]);
        }
        futuros++;
      }
    }

    // ---- grava tudo ----
    await emLote(c, 'agenda_agendamentos',
      ['id','negocio_id','filial_id','profissional_id','cliente_id','inicio','fim','status','origem','preco_previsto_cent','confirmado_em'],
      agendamentos, 300);
    await emLote(c, 'agenda_agendamento_servicos',
      ['id','negocio_id','agendamento_id','servico_id','profissional_id','preco_cent','duracao_min','ordem'],
      agServicos, 400);
    await emLote(c, 'agenda_comandas',
      ['id','negocio_id','filial_id','cliente_id','agendamento_id','numero','status','subtotal_cent','total_cent','taxa_cent','forma_pagamento','aberta_em','fechada_em'],
      comandas, 250);
    await emLote(c, 'agenda_comanda_itens',
      ['id','negocio_id','comanda_id','tipo','servico_id','produto_id','profissional_id','descricao','quantidade','preco_unit_cent','total_cent','comissao_pct','comissao_cent','criado_em'],
      comandaItens, 250);
    await emLote(c, 'agenda_produto_movimentos',
      ['id','negocio_id','produto_id','tipo','quantidade','custo_unit_cent','comanda_id','motivo','criado_em'],
      movimentos, 400);
    await emLote(c, 'agenda_avaliacoes',
      ['id','negocio_id','agendamento_id','cliente_id','profissional_id','nota','criado_em'],
      avaliacoes, 400);

    // ---- vale do mês, o desconto que sempre vira discussão ----
    await c.query(
      `INSERT INTO agenda_profissional_lancamentos (negocio_id, profissional_id, tipo, valor_cent, descricao, data)
       VALUES ($1,$2,'vale',20000,'Adiantamento dia 15',$3::date)`,
      [neg, profs[1].id, diaISO(-10)]);

    await c.query('COMMIT');

    const concluidos = agendamentos.filter((a) => a[7] === 'concluido').length;
    const faltou = agendamentos.filter((a) => a[7] === 'faltou').length;
    console.log('');
    console.log('  Barbearia Lâmina criada.');
    console.log('');
    console.log(`  ${clientes.length} clientes · ${concluidos} atendimentos · ${faltou} faltas`);
    console.log(`  ${comandas.length} comandas · ${avaliacoes.length} avaliações · ${futuros} na semana`);
    console.log('');
    console.log(`  entrar: ${EMAIL}`);
    console.log(`  senha:  ${SENHA}`);
    console.log(`  barbeiro (Alex): ${EMAIL_BARBEIRO}, mesma senha`);
    console.log('');
    console.log('  Painel em /painel/agenda, raio-X em /painel/agenda/raio-x');
    console.log('');
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    console.log('ERRO:', e.message);
    if (e.detail) console.log('detalhe:', e.detail);
    process.exitCode = 1;
  } finally {
    await c.end();
  }
})();
