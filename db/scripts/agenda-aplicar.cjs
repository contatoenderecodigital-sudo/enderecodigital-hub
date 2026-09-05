// Aplica a migration_0004_agenda de verdade. Uma transacao: ou entra tudo, ou
// nao entra nada. Idempotente, entao rodar de novo nao quebra.
//
// Existe em Node, e nao como `psql -f`, porque psql nao esta instalado nesta
// maquina. O driver `pg` ja e dependencia do projeto.
//
// Precisa do tunel aberto:  powershell -ExecutionPolicy Bypass -File db\scripts\tunel.ps1
const fs = require('fs');
const path = require('path');
// Roda de qualquer lugar: o caminho e relativo ao arquivo, nao ao terminal.
const RAIZ = path.resolve(__dirname, '..', '..');
for (const l of fs.readFileSync(RAIZ + '/.env.local','utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g,'');
}
const { Client } = require('pg');

const TABELAS = [
  'agenda_config','agenda_profissionais','agenda_servicos','agenda_profissional_servicos',
  'agenda_clientes','agenda_jornadas','agenda_excecoes','agenda_agendamentos',
  'agenda_agendamento_servicos','agenda_produtos','agenda_produto_movimentos',
  'agenda_comandas','agenda_comanda_itens','agenda_pacotes','agenda_pacote_itens',
  'agenda_pacote_vendas','agenda_pacote_usos','agenda_fidelidade_movimentos',
  'agenda_lista_espera','agenda_avaliacoes','agenda_profissional_lancamentos',
  'agenda_comissao_fechamentos',
];

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const sql = fs.readFileSync(RAIZ + '/db/migration_0004_agenda.sql', 'utf8');

  // O WARNING do btree_gist e a informacao mais importante do arquivo. Sem
  // isto, ele sai no log do servidor e ninguem ve.
  c.on('notice', (n) => console.log('  aviso do banco:', n.message));

  try {
    await c.query('BEGIN');
    await c.query(sql);
    await c.query('COMMIT');
    console.log('APLICADA.\n');

    const t = await c.query(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema='public' AND table_name = ANY($1)
        ORDER BY table_name`, [TABELAS]);
    console.log('tabelas no banco :', t.rows.length, 'de', TABELAS.length);
    const faltando = TABELAS.filter((n) => !t.rows.some((r) => r.table_name === n));
    if (faltando.length) console.log('FALTANDO         :', faltando.join(', '));

    const fks = await c.query(
      `SELECT count(*)::int AS n FROM pg_constraint
        WHERE contype='f' AND conname LIKE ANY (ARRAY['fk_ps_%','fk_as_%','fk_ci_%',
              'fk_pi_%','fk_pv_%','fk_pu_%','fk_fm_%','fk_le_%','fk_av_%','fk_pl_%',
              'fk_pm_%','fk_comanda_%','fk_agendamento_%','fk_profissionais_%',
              'fk_jornada_%','fk_excecao_%','fk_cf_%'])`);
    console.log('chaves compostas :', fks.rows[0].n, 'ativas');

    // A pergunta que decide se a agenda e confiavel.
    const trava = await c.query(
      `SELECT conname FROM pg_constraint WHERE conname = 'ex_agendamento_sem_sobreposicao'`);
    if (trava.rowCount) {
      console.log('trava de conflito: INSTALADA');
    } else {
      console.log('trava de conflito: AUSENTE');
      console.log('                   O banco NAO vai recusar dois clientes no mesmo');
      console.log('                   horario. Instale a extensao como superusuario');
      console.log('                   (CREATE EXTENSION btree_gist;) e rode de novo.');
      process.exitCode = 1;
    }

    const flags = await c.query(
      `SELECT count(*) FILTER (WHERE mod_agenda) AS hubs_ligados,
              (SELECT count(*) FROM negocios WHERE mod_agenda) AS negocios_ligados
         FROM hubs`);
    console.log('modulo ligado em :', JSON.stringify(flags.rows[0]));
  } catch (e) {
    await c.query('ROLLBACK').catch(()=>{});
    console.log('ERRO, nada foi aplicado:', e.message);
    if (e.detail) console.log('detalhe:', e.detail);
    if (e.hint) console.log('dica:', e.hint);
    process.exitCode = 1;
  } finally { await c.end(); }
})();
