const fs=require('fs');const RAIZ=process.cwd();
for(const l of fs.readFileSync(RAIZ+'/.env.local','utf8').split('\n')){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'');}
const {Client}=require('pg');
const FUSO='America/Sao_Paulo';
(async()=>{
const c=new Client({connectionString:process.env.DATABASE_URL});await c.connect();
const neg=(await c.query("SELECT id FROM negocios WHERE slug='lamina-demo'")).rows[0].id;

const sumidos=await c.query(`
WITH visitas AS (SELECT a.cliente_id,a.inicio,a.profissional_id,
   a.inicio - lag(a.inicio) OVER (PARTITION BY a.cliente_id ORDER BY a.inicio) AS intervalo
  FROM agenda_agendamentos a WHERE a.negocio_id=$1 AND a.status='concluido'),
ritmo AS (SELECT cliente_id,count(*) AS visitas,
   avg(EXTRACT(EPOCH FROM intervalo)/86400) FILTER (WHERE intervalo IS NOT NULL) AS intervalo_dias,
   max(inicio) AS ultima FROM visitas GROUP BY cliente_id HAVING count(*)>=2),
ticket AS (SELECT cliente_id,avg(total_cent) AS medio FROM agenda_comandas
   WHERE negocio_id=$1 AND status='fechada' AND cliente_id IS NOT NULL GROUP BY cliente_id),
preferido AS (SELECT DISTINCT ON (v.cliente_id) v.cliente_id,p.nome FROM visitas v
   JOIN agenda_profissionais p ON p.id=v.profissional_id ORDER BY v.cliente_id,v.inicio DESC)
SELECT c.nome,(CURRENT_DATE-(r.ultima AT TIME ZONE $2)::date)::int AS dias,
  round(r.intervalo_dias)::int AS ritmo,r.visitas::int AS visitas,
  round(coalesce(t.medio,0))::int AS ticket,pf.nome AS prof,
  CASE WHEN (CURRENT_DATE-(r.ultima AT TIME ZONE $2)::date)>=r.intervalo_dias*1.5 THEN 'critico' ELSE 'atencao' END AS grav
 FROM ritmo r JOIN agenda_clientes c ON c.id=r.cliente_id
 LEFT JOIN ticket t ON t.cliente_id=r.cliente_id LEFT JOIN preferido pf ON pf.cliente_id=r.cliente_id
 WHERE r.intervalo_dias>0 AND (CURRENT_DATE-(r.ultima AT TIME ZONE $2)::date)>=r.intervalo_dias*1.15
   AND NOT c.bloqueado
 ORDER BY (CURRENT_DATE-(r.ultima AT TIME ZONE $2)::date)/r.intervalo_dias DESC`,[neg,FUSO]);

console.log('=== CLIENTES INDO EMBORA ===');
for(const r of sumidos.rows)
  console.log(` ${r.grav.padEnd(8)} ${r.nome.padEnd(24)} ${String(r.dias)+'d'} sem vir  costuma a cada ${r.ritmo}d  ticket R$ ${(r.ticket/100).toFixed(2)}  com ${r.prof}`);
if(!sumidos.rows.length) console.log('  VAZIO <= a demo perdeu a linha principal');

const semana=await c.query(`
WITH dias AS (SELECT generate_series(CURRENT_DATE,CURRENT_DATE+6,'1 day')::date AS d),
valor AS (SELECT coalesce(sum(cm.total_cent)::numeric/nullif(sum(EXTRACT(EPOCH FROM (a.fim-a.inicio))/60),0),0) AS cpm
  FROM agenda_comandas cm JOIN agenda_agendamentos a ON a.id=cm.agendamento_id
  WHERE cm.negocio_id=$1 AND cm.status='fechada' AND a.inicio>=now()-interval '90 days'),
capacidade AS (SELECT d.d,sum(EXTRACT(EPOCH FROM (j.fim-j.inicio))/60) AS minutos
  FROM dias d JOIN agenda_profissionais p ON p.negocio_id=$1 AND p.ativo
  JOIN agenda_jornadas j ON j.profissional_id=p.id AND j.dia_semana=EXTRACT(DOW FROM d.d)
  WHERE NOT EXISTS (SELECT 1 FROM agenda_excecoes e WHERE e.negocio_id=$1 AND e.data=d.d
     AND e.tipo='fechado' AND (e.profissional_id IS NULL OR e.profissional_id=p.id)) GROUP BY d.d),
ocupado AS (SELECT (a.inicio AT TIME ZONE $2)::date AS d,sum(EXTRACT(EPOCH FROM (a.fim-a.inicio))/60) AS minutos
  FROM agenda_agendamentos a WHERE a.negocio_id=$1 AND a.status NOT IN ('cancelado','faltou')
  AND (a.inicio AT TIME ZONE $2)::date BETWEEN CURRENT_DATE AND CURRENT_DATE+6 GROUP BY 1)
SELECT to_char(d.d,'Dy DD/MM') AS dia,round(coalesce(c.minutos,0))::int AS cap,
  CASE WHEN coalesce(c.minutos,0)=0 THEN 0 ELSE round(coalesce(o.minutos,0)/c.minutos*100)::int END AS pct,
  round(greatest(coalesce(c.minutos,0)-coalesce(o.minutos,0),0)*(SELECT cpm FROM valor))::int AS potencial
 FROM dias d LEFT JOIN capacidade c ON c.d=d.d LEFT JOIN ocupado o ON o.d=d.d ORDER BY d.d`,[neg,FUSO]);
console.log('\n=== CADEIRA VAZIA, 7 DIAS ===');
let tot=0;
for(const r of semana.rows){tot+=r.potencial;
  console.log(` ${r.dia}  ${r.cap===0?'fechado':(String(r.pct)+'% ocupada').padEnd(14)+'R$ '+(r.potencial/100).toFixed(2)}`);}
console.log(` TOTAL em risco: R$ ${(tot/100).toFixed(2)}`);

const eq=await c.query(`
WITH itens AS (SELECT ci.profissional_id,sum(ci.total_cent) AS total,
   sum(ci.total_cent) FILTER (WHERE ci.tipo='produto') AS produto
  FROM agenda_comanda_itens ci JOIN agenda_comandas cm ON cm.id=ci.comanda_id
  WHERE ci.negocio_id=$1 AND cm.status='fechada' AND cm.fechada_em>=now()-interval '30 days'
  GROUP BY ci.profissional_id),
nota AS (SELECT profissional_id,avg(nota) AS m FROM agenda_avaliacoes WHERE negocio_id=$1 GROUP BY profissional_id)
SELECT p.nome,coalesce(i.total,0)::int AS fat,
  CASE WHEN coalesce(i.total,0)=0 THEN 0 ELSE round(coalesce(i.produto,0)::numeric/i.total*100)::int END AS prodpct,
  round(n.m,1)::float8 AS nota
 FROM agenda_profissionais p LEFT JOIN itens i ON i.profissional_id=p.id
 LEFT JOIN nota n ON n.profissional_id=p.id WHERE p.negocio_id=$1 ORDER BY fat DESC`,[neg]);
console.log('\n=== EQUIPE, 30 DIAS ===');
for(const r of eq.rows) console.log(` ${r.nome.padEnd(18)} R$ ${(r.fat/100).toFixed(2).padStart(9)}  produto ${String(r.prodpct)+'%'}  nota ${r.nota??'·'}`);

const f=await c.query(`SELECT c.nome,count(*)::int n FROM agenda_agendamentos a JOIN agenda_clientes c ON c.id=a.cliente_id
  WHERE a.negocio_id=$1 AND a.status='faltou' GROUP BY c.nome ORDER BY n DESC`,[neg]);
console.log('\n=== FALTAS ===');
for(const r of f.rows) console.log(` ${r.nome.padEnd(24)} ${r.n}`);

const ret=await c.query(`WITH base AS (SELECT DISTINCT cliente_id FROM agenda_agendamentos
  WHERE negocio_id=$1 AND status='concluido' AND inicio>=now()-interval '60 days' AND inicio<now()-interval '30 days'),
voltou AS (SELECT DISTINCT a.cliente_id FROM agenda_agendamentos a JOIN base b ON b.cliente_id=a.cliente_id
  WHERE a.negocio_id=$1 AND a.status='concluido' AND a.inicio>=now()-interval '30 days')
SELECT CASE WHEN (SELECT count(*) FROM base)=0 THEN 0 ELSE round((SELECT count(*) FROM voltou)::numeric/(SELECT count(*) FROM base)*100)::int END AS pct`,[neg]);
console.log('\nretorno em 30 dias:',ret.rows[0].pct+'%');
await c.end();})().catch(e=>{console.log('ERRO',e.message);process.exit(1)});
