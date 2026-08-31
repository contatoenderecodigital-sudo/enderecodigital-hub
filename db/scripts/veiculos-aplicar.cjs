// Aplica a migration_0003_veiculos de verdade. Uma transacao: ou entra tudo,
// ou nao entra nada. Idempotente, entao rodar de novo nao quebra.
const fs = require('fs');
const path = require('path');
// Rodam de qualquer lugar: o caminho e relativo ao arquivo, nao ao terminal.
const RAIZ = path.resolve(__dirname, '..', '..');
for (const l of fs.readFileSync(RAIZ + '/.env.local','utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g,'');
}
const { Client } = require('pg');

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const sql = fs.readFileSync(RAIZ + '/db/migration_0003_veiculos.sql', 'utf8');
  try {
    await c.query('BEGIN');
    await c.query(sql);
    await c.query('COMMIT');
    console.log('APLICADA.\n');

    const t = await c.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_name IN
        ('filiais','veiculos','veiculo_fotos','veiculo_custos','veiculo_precos',
         'veiculo_referencias','veiculo_publicacoes','avaliacoes_troca','vendas')
      ORDER BY table_name`);
    console.log('tabelas no banco :', t.rows.map(r=>r.table_name).join(', '));

    const fks = await c.query(`
      SELECT conname FROM pg_constraint
      WHERE contype='f' AND conname LIKE ANY (ARRAY['fk_veiculo%','fk_vendas%','fk_leads_%','fk_avaliacoes%'])
      ORDER BY conname`);
    console.log('chaves compostas :', fks.rows.length, 'ativas');

    const linhas = await c.query(`
      SELECT (SELECT count(*) FROM veiculos)  AS veiculos,
             (SELECT count(*) FROM filiais)   AS filiais,
             (SELECT count(*) FROM negocios)  AS negocios,
             (SELECT count(*) FROM leads)     AS leads`);
    console.log('conferencia      :', JSON.stringify(linhas.rows[0]));
  } catch (e) {
    await c.query('ROLLBACK').catch(()=>{});
    console.log('ERRO, nada foi aplicado:', e.message);
    process.exitCode = 1;
  } finally { await c.end(); }
})();
