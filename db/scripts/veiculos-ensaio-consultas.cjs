// Testa as consultas do modulo com dados ficticios. Transacao com ROLLBACK.
const fs = require('fs');
const path = require('path');
// Rodam de qualquer lugar: o caminho e relativo ao arquivo, nao ao terminal.
const RAIZ = path.resolve(__dirname, '..', '..');
for (const l of fs.readFileSync(RAIZ + '/.env.local','utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g,'');
}
const { Client } = require('pg');

const CAMPOS = `
  v.id, v.filial_id, f.nome AS filial_nome, v.marca, v.modelo, v.versao,
  v.ano_fabricacao, v.ano_modelo, v.km, v.preco_cent, v.status,
  (CURRENT_DATE - v.entrada_em)::int AS dias_parado,
  (SELECT url FROM veiculo_fotos ft WHERE ft.veiculo_id = v.id ORDER BY ft.ordem, ft.criado_em LIMIT 1) AS foto_capa,
  (SELECT count(*)::int FROM veiculo_fotos ft WHERE ft.veiculo_id = v.id) AS qtd_fotos`;

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  try {
    await c.query('BEGIN');
    const hub = (await c.query(`SELECT id FROM hubs LIMIT 1`)).rows[0].id;
    const n = (await c.query(
      `INSERT INTO negocios (hub_id, slug, nome, mod_veiculos) VALUES ($1,'ensaio-carros','Ensaio Carros',true) RETURNING id`, [hub]
    )).rows[0].id;
    const fil = (await c.query(
      `INSERT INTO filiais (negocio_id, nome, nome_curto, cidade, uf) VALUES ($1,'Faxinal dos Guedes','Faxinal dos G.','Faxinal dos Guedes','SC') RETURNING id`, [n]
    )).rows[0].id;

    // Tres carros: um novo, um em atencao, um critico.
    const mk = async (modelo, dias, preco, custo, fipe) => {
      const v = (await c.query(
        `INSERT INTO veiculos (negocio_id, filial_id, marca, modelo, versao, ano_fabricacao, ano_modelo,
                               km, preco_cent, status, entrada_em, publicado)
         VALUES ($1,$2,'Toyota',$3,'XRE 2.0',2023,2024,41200,$4,'disponivel',CURRENT_DATE - $5::int, true)
         RETURNING id`, [n, fil, modelo, preco, dias])).rows[0].id;
      await c.query(`INSERT INTO veiculo_custos (negocio_id, veiculo_id, tipo, valor_cent) VALUES ($1,$2,'aquisicao',$3)`, [n, v, custo]);
      await c.query(`INSERT INTO veiculo_referencias (negocio_id, veiculo_id, fipe_cent) VALUES ($1,$2,$3)`, [n, v, fipe]);
      await c.query(`INSERT INTO veiculo_fotos (negocio_id, veiculo_id, url, ordem) VALUES ($1,$2,'a.jpg',0)`, [n, v]);
      return v;
    };
    await mk('Corolla Cross', 12, 18990000, 16500000, 18500000);
    await mk('Hilux',         52, 28990000, 25000000, 27000000);
    await mk('Duster',        96, 11290000, 10500000,  9800000);

    const lista = await c.query(
      `SELECT ${CAMPOS} FROM veiculos v LEFT JOIN filiais f ON f.id=v.filial_id
        WHERE v.negocio_id=$1 ORDER BY v.destaque DESC, v.entrada_em DESC`, [n]);
    console.log('listarVeiculos   :', lista.rows.length, 'carros ·',
      lista.rows.map(r=>`${r.modelo}(${r.dias_parado}d, ${r.qtd_fotos} foto)`).join(', '));

    const raio = await c.query(
      `WITH custo AS (SELECT veiculo_id, sum(valor_cent)::int AS total FROM veiculo_custos WHERE negocio_id=$1 GROUP BY veiculo_id),
            ref AS (SELECT DISTINCT ON (veiculo_id) veiculo_id, fipe_cent FROM veiculo_referencias WHERE negocio_id=$1 ORDER BY veiculo_id, criado_em DESC)
       SELECT v.modelo, (CURRENT_DATE-v.entrada_em)::int AS dias_parado,
              v.preco_cent - coalesce(c.total,0) AS margem_cent,
              CASE WHEN r.fipe_cent IS NULL OR r.fipe_cent=0 THEN NULL
                   ELSE round(((v.preco_cent::numeric/r.fipe_cent)-1)*100,1) END AS desvio_fipe,
              CASE WHEN (CURRENT_DATE-v.entrada_em)>=60 THEN 'critico'
                   WHEN (CURRENT_DATE-v.entrada_em)>=45 THEN 'atencao' ELSE 'ok' END AS gravidade
         FROM veiculos v LEFT JOIN custo c ON c.veiculo_id=v.id LEFT JOIN ref r ON r.veiculo_id=v.id
        WHERE v.negocio_id=$1 AND v.status IN ('disponivel','reservado')
        ORDER BY (CURRENT_DATE-v.entrada_em) DESC`, [n]);
    console.log('\nraioX:');
    for (const r of raio.rows)
      console.log(`  ${r.gravidade.padEnd(8)} ${r.modelo.padEnd(14)} ${String(r.dias_parado).padStart(3)}d  margem R$ ${(r.margem_cent/100).toLocaleString('pt-BR')}  FIPE ${r.desvio_fipe > 0 ? '+' : ''}${r.desvio_fipe}%`);

    const res = await c.query(
      `SELECT count(*) FILTER (WHERE status='disponivel')::int AS disponiveis,
              count(*) FILTER (WHERE status='disponivel' AND CURRENT_DATE-entrada_em>=60)::int AS parados,
              coalesce(sum(preco_cent) FILTER (WHERE status='disponivel'),0)::bigint AS capital_cent,
              coalesce(round(avg(CURRENT_DATE-entrada_em) FILTER (WHERE status='disponivel')),0)::int AS media_dias,
              count(*) FILTER (WHERE status='vendido' AND vendido_em>=date_trunc('month',CURRENT_DATE))::int AS vendidos_mes
         FROM veiculos WHERE negocio_id=$1`, [n]);
    const s = res.rows[0];
    console.log('\nresumoPatio      :', s.disponiveis, 'disponíveis ·', s.parados, 'parados +60d ·',
      'capital R$', (Number(s.capital_cent)/100).toLocaleString('pt-BR'), '· média', s.media_dias, 'dias');

    const fi = await c.query(
      `SELECT f.nome_curto, (SELECT count(*)::int FROM veiculos v WHERE v.filial_id=f.id AND v.status='disponivel') AS veiculos
         FROM filiais f WHERE f.negocio_id=$1`, [n]);
    console.log('listarFiliais    :', fi.rows.map(r=>`${r.nome_curto} (${r.veiculos})`).join(', '));

    await c.query('ROLLBACK');
    console.log('\nROLLBACK feito. Banco intocado.');
  } catch (e) {
    await c.query('ROLLBACK').catch(()=>{});
    console.log('ERRO:', e.message); if (e.detail) console.log('detalhe:', e.detail);
    process.exitCode = 1;
  } finally { await c.end(); }
})();
