// ============================================================================
//  SEMENTE · loja de demonstração do módulo Veículos
//
//  Cria o negócio "Lançar Veículos", duas filiais, seis carros com tempos de
//  pátio diferentes e um usuário dono pra entrar no painel.
//
//  SERVE PRA VENDER, não só pra testar. Numa reunião não dá pra abrir painel
//  vazio: o raio-X só convence com carro parado de verdade na tela. Por isso os
//  seis carros são escolhidos, não aleatórios: um recém-chegado, dois normais,
//  um em atenção e dois críticos, sendo um deles claramente acima da FIPE.
//
//  IDEMPOTENTE. Roda de novo e refaz do zero, sem duplicar.
//
//  Pra apagar tudo:  node db/scripts/veiculos-semente-demo.cjs --apagar
// ============================================================================

const fs = require('fs');
const path = require('path');
const RAIZ = path.resolve(__dirname, '..', '..');
for (const l of fs.readFileSync(RAIZ + '/.env.local', 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const { Client } = require('pg');
const bcrypt = require(RAIZ + '/node_modules/bcryptjs');

const SLUG = 'lancar-demo';
const EMAIL = 'demo@lancarveiculos.com.br';
const SENHA = 'lancar2026';

// dias: quanto tempo no pátio. É o que produz o raio-X.
// fipe: referência de mercado, pra mostrar o motivo do carro estar parado.
const CARROS = [
  { marca: 'Toyota', modelo: 'Corolla Cross', versao: 'XRE 2.0', anoF: 2024, anoM: 2025, km: 18400,
    cor: 'Prata', preco: 18990000, custo: 16800000, fipe: 18700000, dias: 9,  filial: 0 },
  { marca: 'Jeep', modelo: 'Compass', versao: 'Longitude T270', anoF: 2023, anoM: 2024, km: 31200,
    cor: 'Cinza', preco: 21490000, custo: 19200000, fipe: 21200000, dias: 24, filial: 0 },
  { marca: 'Volkswagen', modelo: 'Nivus', versao: 'Highline 1.0 TSI', anoF: 2023, anoM: 2023, km: 27800,
    cor: 'Branco', preco: 15990000, custo: 14100000, fipe: 15600000, dias: 38, filial: 1 },
  { marca: 'Toyota', modelo: 'Hilux', versao: 'SRV 2.8 4x4', anoF: 2022, anoM: 2023, km: 62400,
    cor: 'Branco', preco: 28990000, custo: 25600000, fipe: 27000000, dias: 52, filial: 0 },
  // Os dois críticos. O Duster é o caso de manual: parado há mais de 90 dias
  // porque está 15% acima da FIPE.
  { marca: 'Renault', modelo: 'Duster', versao: 'Iconic 1.3 Turbo', anoF: 2022, anoM: 2022, km: 55600,
    cor: 'Laranja', preco: 11290000, custo: 10400000, fipe: 9800000, dias: 96, filial: 1 },
  { marca: 'Honda', modelo: 'HR-V', versao: 'EXL 1.5', anoF: 2022, anoM: 2022, km: 48100,
    cor: 'Prata', preco: 13990000, custo: 12900000, fipe: 13400000, dias: 71, filial: 0 },
];

(async () => {
  const apagar = process.argv.includes('--apagar');
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  try {
    await c.query('BEGIN');

    // Apaga a demo anterior. O cascade leva filiais, veículos, fotos e custos.
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

    const neg = (await c.query(
      `INSERT INTO negocios (hub_id, slug, nome, nome_fantasia, segmento, mod_veiculos, mod_crm, status, observacoes)
       VALUES ($1,$2,'Lançar Veículos LTDA','Lançar Veículos','Revenda de veículos',true,true,'ativo',
               'Loja de demonstração do módulo Veículos. Pode apagar sem dó.')
       RETURNING id`, [hub, SLUG])).rows[0].id;

    const filiais = [];
    for (const f of [
      { nome: 'Lançar Xanxerê', curto: 'Xanxerê', cidade: 'Xanxerê' },
      { nome: 'Lançar Faxinal dos Guedes', curto: 'Faxinal dos G.', cidade: 'Faxinal dos Guedes' },
    ]) {
      filiais.push((await c.query(
        `INSERT INTO filiais (negocio_id, nome, nome_curto, cidade, uf, whatsapp, horario)
         VALUES ($1,$2,$3,$4,'SC','5549999999999','Seg a sex, 8h às 18h30') RETURNING id`,
        [neg, f.nome, f.curto, f.cidade])).rows[0].id);
    }

    for (const v of CARROS) {
      const id = (await c.query(
        `INSERT INTO veiculos (negocio_id, filial_id, marca, modelo, versao, ano_fabricacao, ano_modelo,
                               km, cor, cambio, combustivel, carroceria, preco_cent, preco_minimo_cent,
                               unico_dono, ipva_pago, licenciado, status, entrada_em, publicado, itens)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Automático','Flex','suv',$10,$11,
                 true,true,true,'disponivel',CURRENT_DATE - $12::int,true,
                 ARRAY['Multimídia','Câmera de ré','Ar digital'])
         RETURNING id`,
        [neg, filiais[v.filial], v.marca, v.modelo, v.versao, v.anoF, v.anoM, v.km, v.cor,
         v.preco, Math.round(v.preco * 0.94), v.dias])).rows[0].id;

      await c.query(
        `INSERT INTO veiculo_custos (negocio_id, veiculo_id, tipo, descricao, valor_cent)
         VALUES ($1,$2,'aquisicao','Compra do veículo',$3)`, [neg, id, v.custo]);
      await c.query(
        `INSERT INTO veiculo_referencias (negocio_id, veiculo_id, fipe_cent, amostra)
         VALUES ($1,$2,$3,12)`, [neg, id, v.fipe]);
    }

    await c.query(
      `INSERT INTO usuarios (negocio_id, email, senha_hash, papel)
       VALUES ($1,$2,$3,'dono')`,
      [neg, EMAIL, await bcrypt.hash(SENHA, 10)]);

    await c.query('COMMIT');

    console.log('\nDEMO CRIADA.\n');
    console.log('  negócio  : Lançar Veículos (' + SLUG + ')');
    console.log('  filiais  : 2 · carros: ' + CARROS.length);
    console.log('  entrar   : ' + EMAIL);
    console.log('  senha    : ' + SENHA);
    console.log('  painel   : /painel  →  /painel/veiculos');
    console.log('\nApagar tudo: node db/scripts/veiculos-semente-demo.cjs --apagar');
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    console.log('ERRO, nada foi criado:', e.message);
    if (e.detail) console.log('detalhe:', e.detail);
    process.exitCode = 1;
  } finally { await c.end(); }
})();
