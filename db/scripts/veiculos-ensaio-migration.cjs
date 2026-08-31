// Ensaio da migration + PROVA DE ISOLAMENTO.
// Tudo dentro de UMA transacao, com ROLLBACK no fim. Producao nao e sandbox.
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
    await c.query(sql); // idempotencia
    console.log('migration      : roda, e roda duas vezes');

    // Dois clientes ficticios dentro da transacao, so pra provar o isolamento.
    const hub = (await c.query(`SELECT id FROM hubs LIMIT 1`)).rows[0].id;
    const a = (await c.query(
      `INSERT INTO negocios (hub_id, slug, nome) VALUES ($1,$2,$3) RETURNING id`,
      [hub, 'ensaio-loja-a', 'Ensaio A'])).rows[0].id;
    const b = (await c.query(
      `INSERT INTO negocios (hub_id, slug, nome) VALUES ($1,$2,$3) RETURNING id`,
      [hub, 'ensaio-loja-b', 'Ensaio B'])).rows[0].id;

    const filialA = (await c.query(
      `INSERT INTO filiais (negocio_id, nome, cidade, uf) VALUES ($1,'Matriz A','Xanxerê','SC') RETURNING id`,
      [a])).rows[0].id;
    const veicA = (await c.query(
      `INSERT INTO veiculos (negocio_id, filial_id, marca, modelo, ano_fabricacao, ano_modelo)
       VALUES ($1,$2,'Toyota','Corolla',2024,2025) RETURNING id`, [a, filialA])).rows[0].id;

    console.log('caso normal    : loja A criou filial e veiculo dela');

    const deveFalhar = async (rotulo, fn) => {
      try { await c.query('SAVEPOINT s'); await fn(); await c.query('RELEASE SAVEPOINT s');
            console.log('FALHA DE ISOLAMENTO:', rotulo, '<= PASSOU E NAO DEVIA'); }
      catch (e) { await c.query('ROLLBACK TO SAVEPOINT s');
            console.log('barrado pelo banco:', rotulo); }
    };

    await deveFalhar('veiculo da loja B apontando pra filial da loja A', () =>
      c.query(`INSERT INTO veiculos (negocio_id, filial_id, marca, modelo, ano_fabricacao, ano_modelo)
               VALUES ($1,$2,'Fiat','Toro',2024,2025)`, [b, filialA]));

    await deveFalhar('foto da loja B apontando pra veiculo da loja A', () =>
      c.query(`INSERT INTO veiculo_fotos (negocio_id, veiculo_id, url) VALUES ($1,$2,'x.jpg')`, [b, veicA]));

    await deveFalhar('custo da loja B no veiculo da loja A', () =>
      c.query(`INSERT INTO veiculo_custos (negocio_id, veiculo_id, tipo, valor_cent)
               VALUES ($1,$2,'mecanica',10000)`, [b, veicA]));

    await deveFalhar('venda da loja B do veiculo da loja A', () =>
      c.query(`INSERT INTO vendas (negocio_id, veiculo_id, comprador_nome, forma)
               VALUES ($1,$2,'Fulano','avista')`, [b, veicA]));

    await deveFalhar('lead da loja B apontando pra veiculo da loja A', () =>
      c.query(`INSERT INTO leads (negocio_id, nome, veiculo_id) VALUES ($1,'Beltrano',$2)`, [b, veicA]));

    await c.query('ROLLBACK');
    console.log('ROLLBACK feito. Banco intocado.');
  } catch (e) {
    await c.query('ROLLBACK').catch(()=>{});
    console.log('ERRO:', e.message);
    if (e.detail) console.log('detalhe:', e.detail);
    process.exitCode = 1;
  } finally { await c.end(); }
})();
