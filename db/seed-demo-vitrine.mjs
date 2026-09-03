// ============================================================================
// A CASA DE DEMONSTRACAO: "Esquina 49", bar e pizzaria em Xanxere.
//
// Isto nao e um seed de teste. E a vitrine que o Sandro abre na frente do dono
// do bar, com o cartao na mao. Por isso a casa precisa parecer VIVA:
//
//   - cardapio cheio, com preco de Xanxere de verdade, alergenico e horario
//   - 45 noites de historico, para o relatorio ter grafico e nao um vazio
//   - 3 mesas abertas AGORA, com itens de idades diferentes, para o KDS
//     mostrar verde, ambar e vermelho na mesma tela
//   - avaliacoes misturadas, para o Marketing ter nota e ter queixa
//
// Sistema vazio demonstra mal. Um grafico sem barra mata a venda mais rapido
// do que qualquer bug.
//
// Rodar:  node db/seed-demo-vitrine.mjs
// De novo:  pode. Apaga a casa anterior e refaz do zero.
// ============================================================================
import pg from "pg";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import bcrypt from "bcryptjs";

const SLUG = "esquina-49";
const NOME = "Esquina 49";
const DIAS_DE_HISTORICO = 45;

// ---------------------------------------------------------------------------
// conexao
// ---------------------------------------------------------------------------
function urlDoBanco() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const m = /^DATABASE_URL=(.+)$/m.exec(env);
  if (!m) throw new Error("DATABASE_URL nao encontrada no .env.local");
  return m[1].trim().replace(/^["']|["']$/g, "");
}

// O cliente entra por fora: em producao e o pg, no teste e o Postgres em
// memoria. Assim a vitrine roda contra PGlite antes de encostar no banco real.
let cli = null;
const q = (sql, params) => cli.query(sql, params);
const um = async (sql, params) => (await q(sql, params)).rows[0];

// ---------------------------------------------------------------------------
// aleatoriedade com semente: rodar duas vezes da a mesma casa, o que importa
// quando o Sandro tira print hoje e mostra o mesmo numero na quinta.
// ---------------------------------------------------------------------------
let semente = 49_1900;
function rnd() {
  semente = (semente * 1103515245 + 12345) & 0x7fffffff;
  return semente / 0x7fffffff;
}
const entre = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const escolher = (arr) => arr[Math.floor(rnd() * arr.length)];
const token = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);

// ---------------------------------------------------------------------------
// O CARDAPIO. Preco de bar de Xanxere em 2026, nao preco de capital.
// area: qual praca produz. Isso e o que faz o KDS ter colunas diferentes.
// ---------------------------------------------------------------------------
const CARDAPIO = [
  {
    cat: "Para comecar", ordem: 0, itens: [
      { nome: "Polenta frita com queijo", desc: "Polenta cremosa por dentro, crocante por fora, com parmesao ralado na hora", preco: 38, area: "Cozinha", alerg: ["leite"] },
      { nome: "Bolinho de costela", desc: "8 unidades, com maionese verde da casa", preco: 46, area: "Cozinha", alerg: ["gluten", "leite", "ovos"] },
      { nome: "Torresmo de rolo", desc: "Barriga de porco enrolada e frita, com limao", preco: 42, area: "Cozinha", semGluten: true, semLactose: true },
      { nome: "Frango a passarinho", desc: "Com alho frito e cheiro verde", preco: 52, area: "Cozinha", semLactose: true },
      { nome: "Batata frita com cheddar e bacon", desc: "Serve 2 pessoas", preco: 45, area: "Chapa", alerg: ["leite"] },
      { nome: "Iscas de tilapia", desc: "Empanadas na farinha panko, com molho tartaro", preco: 58, area: "Cozinha", alerg: ["gluten", "peixes", "ovos"] },
    ],
  },
  {
    // Categoria com horario: some do cardapio fora da faixa. E o recurso que
    // o dono de pizzaria testa na hora, porque ele nao vende pizza no almoco.
    cat: "Pizzas", ordem: 1, horario: ["18:00", "23:30"], itens: [
      { nome: "Pizza de calabresa", desc: "Calabresa fatiada, cebola e azeitona. 8 fatias", preco: 62, area: "Forno", alerg: ["gluten", "leite"] },
      { nome: "Pizza de mussarela", desc: "Mussarela, tomate e oregano. 8 fatias", preco: 58, area: "Forno", alerg: ["gluten", "leite"], vegetariano: true },
      { nome: "Pizza de frango com catupiry", desc: "Frango desfiado com requeijao cremoso. 8 fatias", preco: 68, area: "Forno", alerg: ["gluten", "leite"] },
      { nome: "Pizza portuguesa", desc: "Presunto, ovo, cebola, ervilha e azeitona. 8 fatias", preco: 68, area: "Forno", alerg: ["gluten", "leite", "ovos"] },
      { nome: "Pizza quatro queijos", desc: "Mussarela, provolone, gorgonzola e parmesao. 8 fatias", preco: 72, area: "Forno", alerg: ["gluten", "leite"], vegetariano: true },
      { nome: "Pizza de chocolate com morango", desc: "Chocolate ao leite e morango fresco. 8 fatias", preco: 58, area: "Forno", alerg: ["gluten", "leite", "soja"], vegetariano: true },
    ],
  },
  {
    cat: "Da chapa", ordem: 2, itens: [
      { nome: "X-salada", desc: "Hamburguer 180g, queijo, alface, tomate e maionese", preco: 32, area: "Chapa", alerg: ["gluten", "leite", "ovos"] },
      { nome: "X-bacon duplo", desc: "Dois hamburgueres 180g, cheddar e bacon crocante", preco: 42, area: "Chapa", alerg: ["gluten", "leite", "ovos"] },
      { nome: "X-tudo", desc: "Hamburguer, ovo, bacon, presunto, queijo, milho e batata palha", preco: 46, area: "Chapa", alerg: ["gluten", "leite", "ovos"] },
      { nome: "Sanduiche de pernil", desc: "Pernil desfiado no pao italiano, com vinagrete", preco: 38, area: "Chapa", alerg: ["gluten"] },
    ],
  },
  {
    cat: "Pratos", ordem: 3, itens: [
      { nome: "Costela no bafo", desc: "Assada 8 horas, acompanha mandioca e vinagrete", preco: 98, area: "Cozinha", semGluten: true, semLactose: true,
        grupo: { nome: "Acompanhamento", min: 1, max: 1, obrigatorio: true, opcoes: [["Mandioca frita", 0], ["Arroz carreteiro", 8], ["Batata rustica", 6]] } },
      { nome: "Picanha na chapa", desc: "400g para dividir, com farofa, vinagrete e pao de alho", preco: 149, area: "Chapa", alerg: ["gluten", "leite"] },
      { nome: "File a parmegiana", desc: "Com arroz e fritas", preco: 89, area: "Cozinha", alerg: ["gluten", "leite", "ovos"] },
      { nome: "Galeto com polenta", desc: "Meio galeto assado, polenta mole e salada", preco: 76, area: "Cozinha", alerg: ["leite"] },
    ],
  },
  {
    cat: "Bebidas", ordem: 4, itens: [
      { nome: "Chope pilsen", area: "Bar", alerg: ["gluten"], variacoes: [["300ml", 12], ["500ml", 18]] },
      { nome: "Cerveja long neck", desc: "Heineken, Budweiser ou Original", preco: 14, area: "Bar", alerg: ["gluten"] },
      { nome: "Caipirinha", area: "Bar", semGluten: true, semLactose: true, variacoes: [["Limao", 22], ["Maracuja", 25], ["Morango", 25]] },
      { nome: "Refrigerante lata", preco: 8, area: "Bar", semGluten: true, semLactose: true },
      { nome: "Suco natural", desc: "Laranja, abacaxi com hortela ou maracuja", preco: 14, area: "Bar", semGluten: true, vegano: true },
      { nome: "Agua mineral", preco: 5, area: "Bar", semGluten: true, vegano: true },
    ],
  },
  {
    cat: "Sobremesas", ordem: 5, itens: [
      { nome: "Petit gateau", desc: "Com sorvete de creme", preco: 32, area: "Cozinha", alerg: ["gluten", "leite", "ovos"], vegetariano: true },
      { nome: "Pudim de leite", desc: "Fatia generosa, da vovo", preco: 18, area: "Cozinha", alerg: ["leite", "ovos"], semGluten: true, vegetariano: true },
    ],
  },
];

// pesos de venda: o que sai muito numa noite de bar, para a curva ficar real
const PESOS = {
  "Chope pilsen": 22, "Cerveja long neck": 16, "Refrigerante lata": 9, "Caipirinha": 8,
  "Polenta frita com queijo": 8, "Batata frita com cheddar e bacon": 7, "Frango a passarinho": 6,
  "Pizza de calabresa": 7, "Pizza de frango com catupiry": 5, "Pizza de mussarela": 4,
  "Pizza portuguesa": 3, "Pizza quatro queijos": 3, "Pizza de chocolate com morango": 2,
  "X-bacon duplo": 5, "X-salada": 4, "X-tudo": 4, "Sanduiche de pernil": 2,
  "Bolinho de costela": 4, "Torresmo de rolo": 4, "Iscas de tilapia": 2,
  "Costela no bafo": 4, "Picanha na chapa": 3, "File a parmegiana": 3, "Galeto com polenta": 2,
  "Suco natural": 3, "Agua mineral": 3, "Petit gateau": 2, "Pudim de leite": 2,
};

const MOTIVOS_CANCELA = [
  "cliente desistiu", "saiu errado da cozinha", "demorou demais", "acabou o ingrediente",
];
const QUEIXAS = [
  "demora", "atendimento", "temperatura", "preco", "barulho",
];

// ---------------------------------------------------------------------------
export async function semear(cliente, opts = {}) {
  cli = cliente;
  const dias = opts.dias ?? DIAS_DE_HISTORICO;
  const falar = opts.silencioso ? () => {} : console.log;

  const neg = await um("SELECT id, nome FROM negocios WHERE ativo = true ORDER BY criado_em LIMIT 1");
  if (!neg) throw new Error("Nenhum negocio ativo no banco.");
  falar("negocio:", neg.nome, neg.id);
  await q("UPDATE negocios SET mod_food = true WHERE id = $1", [neg.id]);

  // ---- limpa a casa anterior, para poder rodar de novo sem duplicar
  const velha = await um("SELECT id FROM food_lojas WHERE slug = $1", [SLUG]);
  if (velha) {
    await q("DELETE FROM food_lojas WHERE id = $1", [velha.id]);
    falar("casa anterior apagada");
  }

  // ---- a loja
  const loja = await um(
    `INSERT INTO food_lojas
       (negocio_id, slug, nome, tipo, cidade, uf, endereco, telefone, whatsapp,
        cor_destaque, tema_modo, fuso,
        aceita_mesa, aceita_balcao, aceita_delivery, aceita_retirada,
        taxa_servico_pct, taxa_servico_automatica, couvert,
        tempo_preparo_min, gorjeta_sugerida_pct,
        google_url, pedir_avaliacao, nota_para_google,
        fidelidade_ativa, pontos_por_real, valor_do_ponto, resgate_minimo)
     VALUES ($1,$2,$3,'bar','Xanxere','SC','Rua Nereu Ramos, 490, Centro',
             '4933441949','5549933441949',
             '#c2410c','escuro','America/Sao_Paulo',
             true,true,true,true,
             10,true,0,
             30,10,
             'https://g.page/r/esquina49/review', true, 4,
             true, 1, 0.05, 100)
     RETURNING id`,
    [neg.id, SLUG, NOME]
  );
  falar("loja:", NOME, loja.id);

  // ---- horarios: terca a domingo, 17h ate 00h30 (vira a meia noite de proposito)
  for (const d of [0, 2, 3, 4, 5, 6]) {
    await q(
      `INSERT INTO food_horarios (negocio_id, loja_id, dia_semana, abre, fecha, canal)
       VALUES ($1,$2,$3,'17:00','00:30','todos')`,
      [neg.id, loja.id, d]
    );
  }

  // ---- pracas de producao, com meta de tempo diferente cada uma.
  // E a meta que pinta o cartao de verde, ambar e vermelho no KDS.
  const areas = {};
  const defAreas = [["Bar", 4, 0], ["Chapa", 10, 1], ["Forno", 15, 2], ["Cozinha", 22, 3]];
  for (const [nome, meta, ordem] of defAreas) {
    const a = await um(
      `INSERT INTO food_areas (negocio_id, loja_id, nome, ordem, meta_min)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [neg.id, loja.id, nome, ordem, meta]
    );
    areas[nome] = a.id;
  }

  // ---- cardapio
  const produtos = [];
  for (const bloco of CARDAPIO) {
    const cat = await um(
      `INSERT INTO food_categorias (negocio_id, loja_id, nome, ordem, hora_inicio, hora_fim)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [neg.id, loja.id, bloco.cat, bloco.ordem,
       bloco.horario?.[0] ?? null, bloco.horario?.[1] ?? null]
    );

    let ordem = 0;
    for (const it of bloco.itens) {
      const p = await um(
        `INSERT INTO food_produtos
           (negocio_id, loja_id, categoria_id, area_id, nome, descricao, preco,
            tem_variacao, ordem, alergenicos, sem_gluten, sem_lactose, vegetariano, vegano)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
        [neg.id, loja.id, cat.id, areas[it.area], it.nome, it.desc ?? null,
         it.variacoes ? 0 : it.preco, !!it.variacoes, ordem++,
         it.alerg ?? null, !!it.semGluten, !!it.semLactose,
         !!it.vegetariano, !!it.vegano]
      );

      const precos = [];
      if (it.variacoes) {
        let o = 0;
        for (const [nome, preco] of it.variacoes) {
          const v = await um(
            `INSERT INTO food_variacoes (negocio_id, produto_id, nome, preco, ordem)
             VALUES ($1,$2,$3,$4,$5) RETURNING id`,
            [neg.id, p.id, nome, preco, o++]
          );
          precos.push({ variacaoId: v.id, nome: it.nome + " " + nome, preco });
        }
      } else {
        precos.push({ variacaoId: null, nome: it.nome, preco: it.preco });
      }

      if (it.grupo) {
        const g = await um(
          `INSERT INTO food_grupos_opcao (negocio_id, produto_id, nome, minimo, maximo, obrigatorio, ordem)
           VALUES ($1,$2,$3,$4,$5,$6,0) RETURNING id`,
          [neg.id, p.id, it.grupo.nome, it.grupo.min, it.grupo.max, it.grupo.obrigatorio]
        );
        let o = 0;
        for (const [nome, extra] of it.grupo.opcoes) {
          await q(
            `INSERT INTO food_opcoes (negocio_id, grupo_id, nome, preco_extra, ordem)
             VALUES ($1,$2,$3,$4,$5)`,
            [neg.id, g.id, nome, extra, o++]
          );
        }
      }

      produtos.push({
        id: p.id, nome: it.nome, areaId: areas[it.area], area: it.area,
        peso: PESOS[it.nome] ?? 2, precos,
      });
    }
  }
  falar("cardapio:", produtos.length, "produtos");

  // ---- mesas: 18 mesas e o balcao
  const mesas = [];
  for (let i = 1; i <= 18; i++) {
    const m = await um(
      `INSERT INTO food_mesas (negocio_id, loja_id, numero, token, ordem, capacidade, setor)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, numero, token`,
      [neg.id, loja.id, String(i), token(), i,
       i <= 12 ? 4 : 6, i <= 12 ? "Salao" : "Varanda"]
    );
    mesas.push(m);
  }

  // ---- equipe, com PIN de verdade
  const equipe = {};
  const defEquipe = [
    ["Marcia", "gerente", "1234"], ["Jean", "garcom", "2211"], ["Bruna", "garcom", "3322"],
    ["Cleber", "cozinha", "4433"], ["Rose", "caixa", "5544"],
  ];
  for (const [nome, papel, pin] of defEquipe) {
    const e = await um(
      `INSERT INTO food_equipe (negocio_id, loja_id, nome, papel, pin_hash)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, nome, papel`,
      [neg.id, loja.id, nome, papel, await bcrypt.hash(pin, 10)]
    );
    equipe[nome] = e;
  }
  const garcons = [equipe.Jean, equipe.Bruna];

  // ---- tablets: um por praca, mais o do garcom
  const disp = [];
  for (const [nome, tipo, area] of [
    ["Tablet da cozinha", "kds", "Cozinha"], ["Tela do forno", "kds", "Forno"],
    ["Tela da chapa", "kds", "Chapa"], ["Tablet do bar", "kds", "Bar"],
    ["Tablet do garcom", "garcom", null],
  ]) {
    const d = await um(
      `INSERT INTO food_dispositivos (negocio_id, loja_id, nome, tipo, area_id, token)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, nome, tipo, token`,
      [neg.id, loja.id, nome, tipo, area ? areas[area] : null, token()]
    );
    disp.push(d);
  }

  // ---- impressoras. A do caixa imprime a conta, as outras a comanda.
  const imps = [];
  for (const [nome, area, imprime] of [
    ["Impressora da cozinha", "Cozinha", ["comanda"]],
    ["Impressora do bar", "Bar", ["comanda"]],
    ["Impressora do caixa", null, ["conta", "via_cliente"]],
  ]) {
    const i = await um(
      `INSERT INTO food_impressoras (negocio_id, loja_id, area_id, nome, tipo, chave, colunas, imprime)
       VALUES ($1,$2,$3,$4,'cloudprnt',$5,48,$6) RETURNING id, nome, chave`,
      [neg.id, loja.id, area ? areas[area] : null, nome, token() + token(), imprime]
    );
    imps.push(i);
  }

  // ---- cupons
  await q(
    `INSERT INTO food_cupons (negocio_id, loja_id, codigo, tipo, valor, teto, minimo, limite_pessoa)
     VALUES ($1,$2,'VOLTA10','percentual',10,15,50,1)`,
    [neg.id, loja.id]
  );
  await q(
    `INSERT INTO food_cupons (negocio_id, loja_id, codigo, tipo, valor, teto, minimo,
                              dias_semana, hora_inicio, hora_fim, limite_pessoa)
     VALUES ($1,$2,'HAPPY20','percentual',20,25,0,ARRAY[2,3,4]::smallint[],'17:00','19:30',99)`,
    [neg.id, loja.id]
  );

  // ---- clientes que voltam, para a fidelidade ter saldo
  const clientes = [];
  for (const [nome, tel] of [
    ["Sandro", "5549991110001"], ["Alessandra", "5549991110002"], ["Tiago", "5549991110003"],
    ["Fernanda", "5549991110004"], ["Rodrigo", "5549991110005"],
  ]) {
    const c = await um(
      // o cliente e do NEGOCIO, nao da loja: apagar a casa nao apaga ele.
      // Sem o ON CONFLICT, rodar o seed duas vezes quebrava aqui.
      `INSERT INTO food_clientes (negocio_id, nome, telefone, pontos)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (negocio_id, telefone) DO UPDATE SET nome = EXCLUDED.nome,
         pontos = EXCLUDED.pontos
       RETURNING id, nome`,
      [neg.id, nome, tel, entre(40, 380)]
    );
    clientes.push(c);
  }

  // =========================================================================
  // O HISTORICO. 45 noites fechadas, para o relatorio ter grafico.
  // =========================================================================
  const total = { sessoes: 0, itens: 0, faturamento: 0 };
  const somaPesos = produtos.reduce((s, p) => s + p.peso, 0);

  function sorteiaProduto() {
    let n = rnd() * somaPesos;
    for (const p of produtos) { n -= p.peso; if (n <= 0) return p; }
    return produtos[0];
  }

  // A data tem que ser a LOCAL, nao a UTC. Com toISOString(), rodar depois das
  // 21h joga a noite de ontem no dia de hoje, e o historico colide com as
  // mesas que estao abertas agora.
  const meiaNoiteDeHoje = new Date();
  meiaNoiteDeHoje.setHours(0, 0, 0, 0);
  const comoData = (dt) => dt.getFullYear() + "-"
    + String(dt.getMonth() + 1).padStart(2, "0") + "-"
    + String(dt.getDate()).padStart(2, "0");

  for (let d = dias; d >= 1; d--) {
    const dia = new Date(meiaNoiteDeHoje.getTime() - d * 86400000);
    const diaSemana = dia.getDay();
    if (diaSemana === 1) continue;              // segunda a casa fecha
    const dataISO = comoData(dia);

    // sexta e sabado enchem, terca e quarta sao fracas
    const cheio = diaSemana === 5 || diaSemana === 6;
    const comandas = cheio ? entre(34, 48) : entre(14, 26);

    // caixa da noite
    const caixa = await um(
      `INSERT INTO food_caixas (negocio_id, loja_id, aberto_por, saldo_inicial, status,
                                aberto_em, fechado_em, saldo_final)
       VALUES ($1,$2,$3,200,'fechado',
               ($4::date + time '17:00') AT TIME ZONE 'America/Sao_Paulo',
               ($4::date + time '23:59') AT TIME ZONE 'America/Sao_Paulo', 0)
       RETURNING id`,
      [neg.id, loja.id, equipe.Rose.id, dataISO]
    );

    let numero = 0;
    let dinheiroNoCaixa = 200;

    for (let c = 0; c < comandas; c++) {
      const mesa = escolher(mesas);
      const pessoas = entre(1, 5);
      const garcom = escolher(garcons);

      // hora de abertura: pico entre 20h e 22h
      const hAbre = escolher([18, 19, 19, 20, 20, 20, 21, 21, 21, 21, 22, 22, 22, 23]);
      const mAbre = entre(0, 59);
      const abertura = `${dataISO} ${String(hAbre).padStart(2, "0")}:${String(mAbre).padStart(2, "0")}:00`;
      const abreSQL = `('${abertura}' AT TIME ZONE 'America/Sao_Paulo')`;

      const sessao = await um(
        `INSERT INTO food_sessoes (negocio_id, loja_id, mesa_id, codigo, status, pessoas,
                                   garcom_id, aberta_em)
         VALUES ($1,$2,$3,$4,'fechada',$5,$6, ${abreSQL}) RETURNING id`,
        [neg.id, loja.id, mesa.id, token().slice(0, 4).toUpperCase(), pessoas, garcom.id]
      );

      // um membro por pessoa, porque a divisao da conta depende disso
      const membros = [];
      for (let m = 0; m < pessoas; m++) {
        const mb = await um(
          `INSERT INTO food_sessao_membros (negocio_id, sessao_id, device_id, apelido, entrou_em)
           VALUES ($1,$2,$3,$4, ${abreSQL}) RETURNING id`,
          [neg.id, sessao.id, "demo-" + token(), escolher(
            ["Ana", "Bruno", "Carla", "Diego", "Elis", "Fabio", "Gi", "Hugo", "Iara", "Joca"]
          )]
        );
        membros.push(mb.id);
      }

      // de 1 a 3 rodadas de pedido, que e como a mesa pede de verdade
      const rodadas = entre(1, 3);
      let subtotal = 0;
      let itensDaSessao = 0;

      for (let r = 0; r < rodadas; r++) {
        numero++;
        const atrasoRodada = r * entre(18, 45);
        const criado = `${abreSQL} + interval '${atrasoRodada} minutes'`;

        const pedido = await um(
          `INSERT INTO food_pedidos (negocio_id, loja_id, numero_dia, dia, canal, sessao_id,
                                     mesa_id, garcom_id, status, criado_em, aprovado_em, entregue_em)
           VALUES ($1,$2,$3,$4::date,'mesa',$5,$6,$7,'entregue',
                   ${criado}, ${criado} + interval '1 minute',
                   ${criado} + interval '30 minutes')
           RETURNING id`,
          [neg.id, loja.id, numero, dataISO, sessao.id, mesa.id, garcom.id]
        );

        const quantos = entre(2, pessoas + 2);
        for (let i = 0; i < quantos; i++) {
          const prod = sorteiaProduto();
          const preco = escolher(prod.precos);
          const qtd = prod.area === "Bar" ? entre(1, 3) : 1;
          const linha = Number((preco.preco * qtd).toFixed(2));

          // tempos: a maioria dentro da meta, uns 8% estourando de verdade.
          // Relatorio que so mostra numero bonito nao convence ninguem.
          const meta = defAreas.find(([n]) => n === prod.area)[1];
          const estourou = rnd() < 0.08;
          const espera = entre(1, 4);
          const preparo = estourou ? meta + entre(5, 22) : entre(2, Math.max(3, meta - 2));
          const entrega = entre(1, 5);

          const cancelado = rnd() < 0.035;
          const status = cancelado ? "cancelado" : "entregue";

          const item = await um(
            `INSERT INTO food_itens
               (negocio_id, pedido_id, produto_id, variacao_id, area_id, nome_snapshot,
                qtd, preco_unit, preco_total, membro_id, status, meta_min,
                criado_em, producao_em, pronto_em, entregue_em,
                cancelado_em, cancelado_motivo, cancelado_por)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
                     ${criado},
                     ${criado} + interval '${espera} minutes',
                     ${criado} + interval '${espera + preparo} minutes',
                     ${cancelado ? "NULL" : `${criado} + interval '${espera + preparo + entrega} minutes'`},
                     ${cancelado ? `${criado} + interval '${espera + preparo} minutes'` : "NULL"},
                     $13, $14)
             RETURNING id`,
            [neg.id, pedido.id, prod.id, preco.variacaoId, prod.areaId, preco.nome,
             qtd, preco.preco, linha, escolher(membros), status, meta,
             cancelado ? escolher(MOTIVOS_CANCELA) : null,
             cancelado ? escolher([...garcons.map((g) => g.nome), "Cleber", "Marcia"]) : null]
          );

          // a trilha de eventos, que e o que alimenta "quem trabalhou"
          const quem = escolher(["Cleber", "Jean", "Bruna", "Marcia"]);
          const trilha = cancelado
            ? [[null, "pendente", 0], ["pendente", "em_producao", espera], ["em_producao", "cancelado", espera + preparo]]
            : [[null, "pendente", 0], ["pendente", "em_producao", espera],
               ["em_producao", "pronto", espera + preparo], ["pronto", "entregue", espera + preparo + entrega]];
          for (const [de, para, min] of trilha) {
            await q(
              `INSERT INTO food_item_eventos
                 (negocio_id, loja_id, item_id, pedido_id, de, para, ator_tipo, ator_nome, motivo, criado_em)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, ${criado} + interval '${min} minutes')`,
              [neg.id, loja.id, item.id, pedido.id, de, para,
               de === null ? "cliente" : "kds", de === null ? "cliente na mesa" : quem,
               para === "cancelado" ? escolher(MOTIVOS_CANCELA) : null]
            );
          }
          // um desfazer de vez em quando: dedo gordo existe, e o relatorio
          // de retrabalho so tem graca se tiver o que mostrar
          if (!cancelado && rnd() < 0.05) {
            await q(
              `INSERT INTO food_item_eventos
                 (negocio_id, loja_id, item_id, pedido_id, de, para, ator_tipo, ator_nome, motivo, criado_em)
               VALUES ($1,$2,$3,$4,'pronto','em_producao','kds',$5,'desfazer',
                       ${criado} + interval '${espera + preparo} minutes')`,
              [neg.id, loja.id, item.id, pedido.id, quem]
            );
          }

          if (!cancelado) { subtotal += linha; itensDaSessao++; }
        }

        await q("UPDATE food_pedidos SET subtotal = $2, total = $2 WHERE id = $1",
          [pedido.id, subtotal]);
      }

      // ---- fechamento da conta
      // uns 12% recusam a taxa de servico. E direito do cliente (Lei 13.419)
      // e o dono precisa ver que o sistema respeita isso.
      const recusou = rnd() < 0.12;
      const taxa = recusou ? 0 : Number((subtotal * 0.1).toFixed(2));
      const desconto = rnd() < 0.10 ? Number(Math.min(15, subtotal * 0.1).toFixed(2)) : 0;
      const totalConta = Number((subtotal + taxa - desconto).toFixed(2));
      const fecha = `${abreSQL} + interval '${entre(70, 160)} minutes'`;

      await q(
        `UPDATE food_sessoes
            SET subtotal = $2, taxa_servico = $3, desconto = $4, total = $5, pago = $5,
                servico_recusado = $6, servico_recusado_em = CASE WHEN $6 THEN ${fecha} ELSE NULL END,
                desconto_motivo = $7, desconto_por = CASE WHEN $4::numeric > 0 THEN 'Marcia' ELSE NULL END,
                conta_pedida_em = ${fecha} - interval '8 minutes',
                fechada_em = ${fecha}, fechada_por = $8
          WHERE id = $1`,
        [sessao.id, subtotal, taxa, desconto, totalConta, recusou,
         desconto > 0 ? escolher(["cortesia da casa", "cliente antigo", "cupom VOLTA10"]) : null,
         garcom.nome]
      );

      // pagamento, as vezes dividido em dois
      const metodo = escolher(["pix", "credito", "credito", "debito", "dinheiro", "dinheiro"]);
      const partes = pessoas > 2 && rnd() < 0.3 ? 2 : 1;
      for (let pgto = 0; pgto < partes; pgto++) {
        const valor = Number((totalConta / partes).toFixed(2));
        const met = partes > 1 && pgto === 1 ? escolher(["pix", "debito"]) : metodo;
        await q(
          `INSERT INTO food_pagamentos (negocio_id, loja_id, sessao_id, caixa_id, metodo, valor,
                                        status, recebido_por, criado_em, confirmado_em)
           VALUES ($1,$2,$3,$4,$5,$6,'confirmado',$7, ${fecha}, ${fecha})`,
          [neg.id, loja.id, sessao.id, caixa.id, met, valor, garcom.id]
        );
        if (met === "dinheiro") dinheiroNoCaixa += valor;
      }

      // avaliacao: nem todo mundo avalia, e nem toda nota e 5
      if (rnd() < 0.45) {
        const nota = rnd() < 0.68 ? 5 : rnd() < 0.6 ? 4 : entre(1, 3);
        await q(
          `INSERT INTO food_avaliacoes (negocio_id, loja_id, sessao_id, mesa_id, nota,
                                        marcadores, comentario, foi_pro_google, criado_em)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8, ${fecha} + interval '3 minutes')`,
          [neg.id, loja.id, sessao.id, mesa.id, nota,
           nota <= 3 ? [escolher(QUEIXAS)] : null,
           nota <= 3 ? escolher([
             "A pizza demorou quase uma hora.",
             "O chope veio quente.",
             "Ninguem veio na mesa, tive que ir no balcao.",
             "Achei caro pelo tamanho da porcao.",
           ]) : null,
           nota >= 4]
        );
      }

      total.sessoes++;
      total.itens += itensDaSessao;
      total.faturamento += totalConta;
    }

    // sangria da noite, que e o que todo bar faz e ninguem anota
    if (rnd() < 0.55) {
      const valor = entre(50, 300);
      await q(
        `INSERT INTO food_caixa_mov (negocio_id, caixa_id, tipo, valor, motivo, por, criado_em)
         VALUES ($1,$2,'sangria',$3,$4,$5,
                 ($6::date + time '22:00') AT TIME ZONE 'America/Sao_Paulo')`,
        [neg.id, caixa.id, valor,
         escolher(["pagar o motoboy", "comprar gelo", "troco pro caixa 2", "levar pro cofre"]),
         equipe.Rose.id, dataISO]
      );
      dinheiroNoCaixa -= valor;
    }
    await q("UPDATE food_caixas SET saldo_final = $2 WHERE id = $1",
      [caixa.id, Number(dinheiroNoCaixa.toFixed(2))]);

      if (!opts.silencioso) process.stdout.write(".");
  }
  falar("");
  falar("historico:", total.sessoes, "comandas,", total.itens, "itens, R$",
    total.faturamento.toFixed(2));

  // =========================================================================
  // AGORA: mesas abertas com itens de idades diferentes, para o KDS abrir
  // com verde, ambar e vermelho na mesma tela. Sem isto a demo abre vazia.
  // =========================================================================
  const caixaHoje = await um(
    `INSERT INTO food_caixas (negocio_id, loja_id, aberto_por, saldo_inicial, status)
     VALUES ($1,$2,$3,300,'aberto') RETURNING id`,
    [neg.id, loja.id, equipe.Rose.id]
  );

  const vivas = [
    { mesa: mesas[3],  pessoas: 4, min: 2,  nomes: ["Pizza de calabresa", "Chope pilsen", "Polenta frita com queijo"] },
    { mesa: mesas[6],  pessoas: 2, min: 11, nomes: ["X-bacon duplo", "Batata frita com cheddar e bacon", "Refrigerante lata"] },
    { mesa: mesas[10], pessoas: 5, min: 26, nomes: ["Costela no bafo", "Picanha na chapa", "Caipirinha", "Cerveja long neck"] },
  ];

  const ultimo = await um(
    `SELECT COALESCE(MAX(numero_dia), 0)::int AS n FROM food_pedidos
      WHERE loja_id = $1 AND dia = food_dia_loja($1)`, [loja.id]);
  let numHoje = ultimo.n;
  for (const v of vivas) {
    const s = await um(
      `INSERT INTO food_sessoes (negocio_id, loja_id, mesa_id, codigo, status, pessoas, garcom_id,
                                 aberta_em)
       VALUES ($1,$2,$3,$4,'aberta',$5,$6, now() - interval '${v.min + 6} minutes')
       RETURNING id, codigo`,
      [neg.id, loja.id, v.mesa.id, token().slice(0, 4).toUpperCase(), v.pessoas, escolher(garcons).id]
    );
    const mb = await um(
      `INSERT INTO food_sessao_membros (negocio_id, sessao_id, device_id, apelido)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [neg.id, s.id, "demo-" + token(), escolher(["Ana", "Bruno", "Carla", "Diego"])]
    );

    numHoje++;
    const ped = await um(
      `INSERT INTO food_pedidos (negocio_id, loja_id, numero_dia, dia, canal, sessao_id, mesa_id,
                                 status, criado_em, aprovado_em)
       VALUES ($1,$2,$3, food_dia_loja($2), 'mesa',$4,$5,'em_producao',
               now() - interval '${v.min} minutes', now() - interval '${v.min} minutes')
       RETURNING id`,
      [neg.id, loja.id, numHoje, s.id, v.mesa.id]
    );

    let sub = 0;
    for (const nome of v.nomes) {
      const prod = produtos.find((p) => p.nome === nome);
      const preco = prod.precos[0];
      const qtd = prod.area === "Bar" ? 2 : 1;
      const linha = Number((preco.preco * qtd).toFixed(2));
      const meta = defAreas.find(([n]) => n === prod.area)[1];

      // o primeiro item de cada mesa ja esta em producao, os outros pendentes
      const emProducao = nome === v.nomes[0];
      const it = await um(
        `INSERT INTO food_itens (negocio_id, pedido_id, produto_id, variacao_id, area_id,
                                 nome_snapshot, qtd, preco_unit, preco_total, membro_id,
                                 status, meta_min, obs, restricao, criado_em, producao_em)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
                 now() - interval '${v.min} minutes',
                 ${emProducao ? `now() - interval '${Math.max(1, v.min - 2)} minutes'` : "NULL"})
         RETURNING id`,
        [neg.id, ped.id, prod.id, preco.variacaoId, prod.areaId, preco.nome, qtd,
         preco.preco, linha, mb.id, emProducao ? "em_producao" : "pendente", meta,
         nome === "Pizza de calabresa" ? "sem cebola" : null,
         nome === "Costela no bafo" ? "alergia a amendoim" : null]
      );
      await q(
        `INSERT INTO food_item_eventos (negocio_id, loja_id, item_id, pedido_id, de, para,
                                        ator_tipo, ator_nome, criado_em)
         VALUES ($1,$2,$3,$4,NULL,'pendente','cliente','cliente na mesa',
                 now() - interval '${v.min} minutes')`,
        [neg.id, loja.id, it.id, ped.id]
      );
      if (emProducao) {
        await q(
          `INSERT INTO food_item_eventos (negocio_id, loja_id, item_id, pedido_id, de, para,
                                          ator_tipo, ator_nome, criado_em)
           VALUES ($1,$2,$3,$4,'pendente','em_producao','kds','Cleber',
                   now() - interval '${Math.max(1, v.min - 2)} minutes')`,
          [neg.id, loja.id, it.id, ped.id]
        );
      }
      sub += linha;
    }
    await q("UPDATE food_pedidos SET subtotal = $2, total = $2 WHERE id = $1", [ped.id, sub]);
    await q(
      `UPDATE food_sessoes SET subtotal = $2, taxa_servico = $3, total = $4 WHERE id = $1`,
      [s.id, sub, Number((sub * 0.1).toFixed(2)), Number((sub * 1.1).toFixed(2))]
    );
  }
  falar("mesas abertas agora:", vivas.length);

  const resumo = {
    negocioId: neg.id, lojaId: loja.id, slug: SLUG, mesas, disp, imps,
    produtos: produtos.length, ...total,
  };
  if (opts.silencioso) return resumo;

  // ---- o que abrir na demo
  console.log("");
  console.log("=".repeat(70));
  console.log("A CASA ESTA DE PE.  " + NOME + ", Xanxere SC");
  console.log("=".repeat(70));
  console.log("Painel do dono  /food/" + neg.id);
  console.log("Cardapio aberto /c/" + SLUG);
  console.log("");
  console.log("CARTAO DA MESA (grave este no chip)");
  for (const m of mesas.slice(0, 4)) {
    console.log("  mesa " + String(m.numero).padStart(2) + "  /c/" + SLUG + "/m/" + m.token);
  }
  console.log("  ... e mais " + (mesas.length - 4) + " mesas no painel, em Mesas e cartoes");
  console.log("");
  console.log("TELAS DA CASA");
  for (const d of disp) console.log("  " + d.nome.padEnd(20) + (d.tipo === "kds" ? "/k/" : "/g/") + d.token);
  console.log("");
  console.log("PIN DA EQUIPE   Marcia gerente 1234   Jean 2211   Bruna 3322   Rose caixa 5544");
  console.log("CUPONS          VOLTA10 (10%, teto 15)   HAPPY20 (20%, ter a qui, 17h as 19h30)");
  console.log("=".repeat(70));
  return resumo;
}

// ---------------------------------------------------------------------------
// linha de comando: abre o banco de verdade e semeia
// ---------------------------------------------------------------------------
// Chamado direto pela linha de comando, ou importado pelo teste?
// Comparar texto de caminho nao serve: no Windows o argv vem com barra
// invertida e o import.meta.url vem com barra normal, entao nunca batia
// e o script saia calado, sem semear nada. pathToFileURL normaliza os dois.
const chamadoDireto = !!process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;
if (chamadoDireto) {
  const conexao = new pg.Client({
    connectionString: urlDoBanco(), connectionTimeoutMillis: 8000,
  });
  try {
    await conexao.connect();
    console.log("conectado");
    await semear(conexao);
    await conexao.end();
  } catch (e) {
    console.error("FALHOU:", e.message);
    try { await conexao.end(); } catch { /* ja fechou */ }
    process.exit(1);
  }
}
