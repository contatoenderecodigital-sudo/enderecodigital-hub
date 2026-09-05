// Ensaio da migration do modulo Agenda + PROVA DE ISOLAMENTO + PROVA DA TRAVA
// DE DUPLO AGENDAMENTO.
//
// Tudo dentro de UMA transacao, com ROLLBACK no fim. Producao nao e sandbox.
//
// Precisa do tunel aberto em outra janela:
//   powershell -ExecutionPolicy Bypass -File db\scripts\tunel.ps1
const fs = require('fs');
const path = require('path');
// Roda de qualquer lugar: o caminho e relativo ao arquivo, nao ao terminal.
const RAIZ = path.resolve(__dirname, '..', '..');
for (const l of fs.readFileSync(RAIZ + '/.env.local','utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g,'');
}
const { Client } = require('pg');

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const sql = fs.readFileSync(RAIZ + '/db/migration_0004_agenda.sql', 'utf8');

  // O WARNING do btree_gist e a informacao mais importante da migration. Sem
  // isto, ele sai no log do servidor e ninguem ve.
  c.on('notice', (n) => console.log('  aviso do banco:', n.message));

  const deveFalhar = async (rotulo, fn) => {
    try {
      await c.query('SAVEPOINT s'); await fn(); await c.query('RELEASE SAVEPOINT s');
      console.log('FALHA:', rotulo, '<= PASSOU E NAO DEVIA');
      process.exitCode = 1;
    } catch (e) {
      await c.query('ROLLBACK TO SAVEPOINT s');
      console.log('barrado pelo banco:', rotulo);
    }
  };
  const devePassar = async (rotulo, fn) => {
    try { await c.query('SAVEPOINT s'); await fn(); await c.query('RELEASE SAVEPOINT s');
          console.log('aceito         :', rotulo); }
    catch (e) { await c.query('ROLLBACK TO SAVEPOINT s');
          console.log('FALHA:', rotulo, '<= FOI BARRADO E NAO DEVIA:', e.message);
          process.exitCode = 1; }
  };

  try {
    await c.query('BEGIN');
    await c.query(sql);
    await c.query(sql); // idempotencia
    console.log('migration      : roda, e roda duas vezes');

    const trava = (await c.query(
      `SELECT 1 FROM pg_constraint WHERE conname = 'ex_agendamento_sem_sobreposicao'`)).rowCount;
    console.log('trava gist     :', trava ? 'instalada' : 'AUSENTE, btree_gist nao existe neste banco');

    // Duas barbearias ficticias dentro da transacao, so pra provar o isolamento.
    const hub = (await c.query(`SELECT id FROM hubs LIMIT 1`)).rows[0].id;
    const novoNegocio = async (slug, nome) => (await c.query(
      `INSERT INTO negocios (hub_id, slug, nome) VALUES ($1,$2,$3) RETURNING id`,
      [hub, slug, nome])).rows[0].id;
    const a = await novoNegocio('ensaio-barbearia-a', 'Ensaio Barbearia A');
    const b = await novoNegocio('ensaio-barbearia-b', 'Ensaio Barbearia B');

    const filialA = (await c.query(
      `INSERT INTO filiais (negocio_id, nome, cidade, uf) VALUES ($1,'Centro','Xanxerê','SC') RETURNING id`,
      [a])).rows[0].id;
    const profA = (await c.query(
      `INSERT INTO agenda_profissionais (negocio_id, filial_id, nome) VALUES ($1,$2,'Alex') RETURNING id`,
      [a, filialA])).rows[0].id;
    const profA2 = (await c.query(
      `INSERT INTO agenda_profissionais (negocio_id, nome) VALUES ($1,'Tiago') RETURNING id`, [a])).rows[0].id;
    const servA = (await c.query(
      `INSERT INTO agenda_servicos (negocio_id, nome, duracao_min, preco_cent)
       VALUES ($1,'Corte',30,6500) RETURNING id`, [a])).rows[0].id;
    const cliA = (await c.query(
      `INSERT INTO agenda_clientes (negocio_id, nome, telefone) VALUES ($1,'João Vitor','5549999990001') RETURNING id`,
      [a])).rows[0].id;
    const comandaA = (await c.query(
      `INSERT INTO agenda_comandas (negocio_id, cliente_id) VALUES ($1,$2) RETURNING id`, [a, cliA])).rows[0].id;
    console.log('caso normal    : barbearia A criou filial, profissional, servico, cliente e comanda');

    // ---- isolamento entre inquilinos -------------------------------------
    await deveFalhar('profissional da B apontando pra filial da A', () =>
      c.query(`INSERT INTO agenda_profissionais (negocio_id, filial_id, nome) VALUES ($1,$2,'Intruso')`, [b, filialA]));

    await deveFalhar('agendamento da B com profissional da A', () =>
      c.query(`INSERT INTO agenda_agendamentos (negocio_id, profissional_id, cliente_id, inicio, fim)
               VALUES ($1,$2,$3,'2026-10-01 14:00-03','2026-10-01 14:30-03')`, [b, profA, cliA]));

    await deveFalhar('agendamento da B com cliente da A', () => (async () => {
      const p = (await c.query(`INSERT INTO agenda_profissionais (negocio_id, nome) VALUES ($1,'Prof B') RETURNING id`, [b])).rows[0].id;
      await c.query(`INSERT INTO agenda_agendamentos (negocio_id, profissional_id, cliente_id, inicio, fim)
                     VALUES ($1,$2,$3,'2026-10-01 14:00-03','2026-10-01 14:30-03')`, [b, p, cliA]);
    })());

    await deveFalhar('item de comanda da B usando servico da A', () =>
      c.query(`INSERT INTO agenda_comanda_itens (negocio_id, comanda_id, tipo, servico_id, descricao, preco_unit_cent, total_cent)
               VALUES ($1,$2,'servico',$3,'Corte',6500,6500)`, [b, comandaA, servA]));

    await deveFalhar('jornada da B no profissional da A', () =>
      c.query(`INSERT INTO agenda_jornadas (negocio_id, profissional_id, dia_semana, inicio, fim)
               VALUES ($1,$2,1,'09:00','18:00')`, [b, profA]));

    // ---- a trava de duplo agendamento ------------------------------------
    const ag1 = (await c.query(
      `INSERT INTO agenda_agendamentos (negocio_id, profissional_id, cliente_id, inicio, fim, preco_previsto_cent)
       VALUES ($1,$2,$3,'2026-10-01 14:00-03','2026-10-01 14:30-03',6500) RETURNING id`,
      [a, profA, cliA])).rows[0].id;
    console.log('caso normal    : 14h00 as 14h30 com o Alex, marcado');

    await deveFalhar('mesmo barbeiro, 14h15, horario sobreposto', () =>
      c.query(`INSERT INTO agenda_agendamentos (negocio_id, profissional_id, cliente_id, inicio, fim)
               VALUES ($1,$2,$3,'2026-10-01 14:15-03','2026-10-01 14:45-03')`, [a, profA, cliA]));

    await devePassar('outro barbeiro, mesmo horario', () =>
      c.query(`INSERT INTO agenda_agendamentos (negocio_id, profissional_id, cliente_id, inicio, fim)
               VALUES ($1,$2,$3,'2026-10-01 14:15-03','2026-10-01 14:45-03')`, [a, profA2, cliA]));

    await devePassar('mesmo barbeiro, encostado no fim do anterior (14h30)', () =>
      c.query(`INSERT INTO agenda_agendamentos (negocio_id, profissional_id, cliente_id, inicio, fim)
               VALUES ($1,$2,$3,'2026-10-01 14:30-03','2026-10-01 15:00-03')`, [a, profA, cliA]));

    await devePassar('horario liberado depois do cancelamento', () => (async () => {
      await c.query(`UPDATE agenda_agendamentos SET status='cancelado' WHERE id=$1`, [ag1]);
      await c.query(`INSERT INTO agenda_agendamentos (negocio_id, profissional_id, cliente_id, inicio, fim)
                     VALUES ($1,$2,$3,'2026-10-01 14:00-03','2026-10-01 14:30-03')`, [a, profA, cliA]);
    })());

    // ---- estoque: o gatilho mantem o saldo -------------------------------
    const prodA = (await c.query(
      `INSERT INTO agenda_produtos (negocio_id, nome, preco_cent, custo_cent) VALUES ($1,'Pomada',4500,2200) RETURNING id`,
      [a])).rows[0].id;
    await c.query(`INSERT INTO agenda_produto_movimentos (negocio_id, produto_id, tipo, quantidade)
                   VALUES ($1,$2,'entrada',12)`, [a, prodA]);
    await c.query(`INSERT INTO agenda_produto_movimentos (negocio_id, produto_id, tipo, quantidade)
                   VALUES ($1,$2,'venda',-3)`, [a, prodA]);
    const saldo = (await c.query(`SELECT estoque FROM agenda_produtos WHERE id=$1`, [prodA])).rows[0].estoque;
    console.log(Number(saldo) === 9
      ? 'estoque        : gatilho somou certo, 12 menos 3 igual a 9'
      : `FALHA: estoque deu ${saldo} e devia dar 9`);
    if (Number(saldo) !== 9) process.exitCode = 1;

    // ---- telefone duplicado na mesma barbearia ---------------------------
    await deveFalhar('mesmo telefone cadastrado duas vezes na barbearia A', () =>
      c.query(`INSERT INTO agenda_clientes (negocio_id, nome, telefone) VALUES ($1,'João de novo','5549999990001')`, [a]));

    await c.query('ROLLBACK');
    console.log('ROLLBACK feito. Banco intocado.');
  } catch (e) {
    await c.query('ROLLBACK').catch(()=>{});
    console.log('ERRO:', e.message);
    if (e.detail) console.log('detalhe:', e.detail);
    if (e.hint) console.log('dica:', e.hint);
    process.exitCode = 1;
  } finally { await c.end(); }
})();
