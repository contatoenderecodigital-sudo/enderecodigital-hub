import "server-only";

// Camada de dados das conexões de WhatsApp dos clientes do hub.
//
// `wa_conexoes` é a tabela que faz o webhook único funcionar: a Meta entrega
// tudo num endereço só e o hub descobre o dono pelo phone_number_id. Quem
// cadastra é quem roteia — por isso a conexão nasce AQUI, e não no painel do
// cliente (que não tem como saber da existência dos outros).
//
// webhook_destino: preenchido quando o cliente tem aplicação própria (a padaria
// tem motor de pedido e impressão na cozinha; o hub não responde por ela).
// Vazio = o hub atende com a IA dele.

import { query } from "@/lib/db";

export interface ConexaoWa {
  id: string;
  negocio_id: string;
  cliente: string;
  waba_id: string;
  phone_number_id: string;
  status: string;
  webhook_destino: string | null;
  criado_em: string;
}

let _colunaOk = false;
export async function ensureColunaDestino(): Promise<void> {
  if (_colunaOk) return;
  try {
    await query("ALTER TABLE wa_conexoes ADD COLUMN IF NOT EXISTS webhook_destino TEXT");
    _colunaOk = true;
  } catch {
    /* sem privilégio de ALTER: segue sem encaminhamento */
  }
}

export async function listarConexoes(hubId: string | null): Promise<ConexaoWa[]> {
  await ensureColunaDestino();
  const params: unknown[] = [];
  let w = "";
  if (hubId) {
    params.push(hubId);
    w = "WHERE n.hub_id = $1";
  }
  const { rows } = await query<ConexaoWa>(
    `SELECT c.id, c.negocio_id, COALESCE(n.nome_fantasia, n.nome) AS cliente,
            c.waba_id, c.phone_number_id, c.status, c.webhook_destino, c.criado_em
       FROM wa_conexoes c JOIN negocios n ON n.id = c.negocio_id
       ${w} ORDER BY c.criado_em DESC`,
    params
  );
  return rows;
}

/** Grava (ou atualiza) a conexão de um cliente. phone_number_id é único. */
export async function salvarConexao(d: {
  negocioId: string;
  wabaId: string;
  phoneNumberId: string;
  accessToken: string;
  webhookDestino: string | null;
}): Promise<void> {
  await ensureColunaDestino();
  await query(
    `INSERT INTO wa_conexoes (negocio_id, waba_id, phone_number_id, access_token, status, webhook_destino)
     VALUES ($1,$2,$3,$4,'conectado',$5)
     ON CONFLICT (phone_number_id) DO UPDATE SET
       negocio_id = EXCLUDED.negocio_id,
       waba_id = EXCLUDED.waba_id,
       access_token = EXCLUDED.access_token,
       status = 'conectado',
       webhook_destino = EXCLUDED.webhook_destino`,
    [d.negocioId, d.wabaId, d.phoneNumberId, d.accessToken, d.webhookDestino]
  );
}

export async function desconectar(phoneNumberId: string): Promise<void> {
  await query("UPDATE wa_conexoes SET status = 'desconectado' WHERE phone_number_id = $1", [
    phoneNumberId,
  ]);
}

// ---------------------------------------------------------------------------
// Segredo de provisionamento POR CLIENTE
// ---------------------------------------------------------------------------
// É a senha que o hub apresenta ao painel do cliente na hora de entregar as
// credenciais do WhatsApp. Um por cliente, e não um global, por um motivo
// prático: com um segredo só, vazou o de um painel, vale para todos, e não dá
// pra revogar só aquele. Assim cada cliente é uma porta separada.
//
// Nasce sozinho no primeiro uso — ninguém precisa lembrar de gerar. O valor
// aparece na tela de WhatsApp pra ser colado no painel daquele cliente.
let _colunaSegredoOk = false;
async function ensureColunaSegredo(): Promise<void> {
  if (_colunaSegredoOk) return;
  try {
    await query("ALTER TABLE negocios ADD COLUMN IF NOT EXISTS provision_secret TEXT");
    _colunaSegredoOk = true;
  } catch {
    /* sem privilégio: cai no segredo global do env */
  }
}

function gerarSegredo(): string {
  const alfabeto = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return "pv_" + Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join("");
}

export async function segredoDoNegocio(negocioId: string): Promise<string> {
  await ensureColunaSegredo();
  const { rows } = await query<{ provision_secret: string | null }>(
    "SELECT provision_secret FROM negocios WHERE id = $1",
    [negocioId]
  );
  const atual = (rows[0]?.provision_secret || "").trim();
  if (atual) return atual;

  const novo = gerarSegredo();
  await query("UPDATE negocios SET provision_secret = $1 WHERE id = $2", [novo, negocioId]);
  return novo;
}

/** Gira o segredo de um cliente (usar quando desconfiar de vazamento). */
export async function girarSegredo(negocioId: string): Promise<string> {
  await ensureColunaSegredo();
  const novo = gerarSegredo();
  await query("UPDATE negocios SET provision_secret = $1 WHERE id = $2", [novo, negocioId]);
  return novo;
}

/** Onde fica o painel próprio do cliente, se tiver. Sai de negocios.dominio. */
export async function destinoDoNegocio(negocioId: string): Promise<string | null> {
  const { rows } = await query<{ dominio: string | null }>(
    "SELECT dominio FROM negocios WHERE id = $1",
    [negocioId]
  );
  const d = (rows[0]?.dominio || "").trim();
  if (!d) return null;
  const base = d.startsWith("http") ? d : `https://${d}`;
  return `${base.replace(/\/+$/, "")}/api/whatsapp`;
}
