import "server-only";
import { query } from "./db";
import { decifrar } from "./cofre";
import { log, registrarFalha } from "./log";
import {
  ErroFiscal, ehErroPermanente, montarNfce, proximaTentativa, referenciaDaNota,
  type DadosNota, type EmitenteNota,
} from "./food-fiscal-nota";

// ============================================================================
// NFC-e: emissão, fila e contingência.
//
// A regra que manda: SEFAZ fora do ar NÃO segura a mesa. A conta fecha, a nota
// entra na fila, e a fila insiste sozinha com espera crescente. Erro de
// conteúdo (CNPJ errado, CPF inválido) não fica insistindo à toa: para e chama
// o dono, porque tentar de novo não conserta.
//
// O integrador é o Focus NFe. O certificado A1 fica lá, no CNPJ do
// restaurante; aqui só mora o token, cifrado pelo cofre. A Endereço Digital
// nunca fica no meio do caminho fiscal.
// ============================================================================

const BASE = {
  producao: "https://api.focusnfe.com.br",
  homologacao: "https://homologacao.focusnfe.com.br",
};

interface LojaFiscal {
  id: string; negocio_id: string; nome: string;
  fiscal_ativo: boolean; fiscal_provedor: string | null; fiscal_cnpj: string | null;
  fiscal_ambiente: string; fiscal_token_ref: string | null; fiscal_automatico: boolean;
  fiscal_serie: number; fiscal_regime: string;
  fiscal_csosn_padrao: string; fiscal_cst_padrao: string | null;
  fiscal_cfop_padrao: string; fiscal_ncm_padrao: string;
  fiscal_uf: string | null; fiscal_municipio: string | null; fiscal_cep: string | null;
  fiscal_ie: string | null; fiscal_razao: string | null;
  fuso: string;
}

async function lojaFiscal(lojaId: string): Promise<LojaFiscal | null> {
  return (await query<LojaFiscal>(
    `SELECT id, negocio_id, nome, fiscal_ativo, fiscal_provedor, fiscal_cnpj, fiscal_ambiente,
            fiscal_token_ref, fiscal_automatico, fiscal_serie, fiscal_regime,
            fiscal_csosn_padrao, fiscal_cst_padrao, fiscal_cfop_padrao, fiscal_ncm_padrao,
            fiscal_uf, fiscal_municipio, fiscal_cep, fiscal_ie, fiscal_razao, fuso
       FROM food_lojas WHERE id = $1`,
    [lojaId]
  )).rows[0] ?? null;
}

/** O token do integrador vive cifrado, igual à credencial do Pix. */
function token(l: LojaFiscal): string | null {
  if (!l.fiscal_token_ref) return null;
  try { return decifrar(l.fiscal_token_ref); } catch { return null; }
}

function emitenteDe(l: LojaFiscal): EmitenteNota {
  return {
    cnpj: l.fiscal_cnpj ?? "",
    razao: l.fiscal_razao ?? l.nome,
    ie: l.fiscal_ie,
    uf: l.fiscal_uf,
    municipio: l.fiscal_municipio,
    cep: l.fiscal_cep,
    regime: l.fiscal_regime,
    csosnPadrao: l.fiscal_csosn_padrao,
    cstPadrao: l.fiscal_cst_padrao,
    cfopPadrao: l.fiscal_cfop_padrao,
    ncmPadrao: l.fiscal_ncm_padrao,
    serie: l.fiscal_serie,
  };
}

// ---------------------------------------------------------------------------
// O QUE VAI NA NOTA: monta a partir da comanda fechada
// ---------------------------------------------------------------------------
async function dadosDaComanda(l: LojaFiscal, sessaoId: string): Promise<DadosNota> {
  const s = (await query<{ desconto: string; cpf_nota: string | null; agora: string }>(
    `SELECT s.desconto, s.cpf_nota,
            to_char(food_agora_loja($2), 'YYYY-MM-DD"T"HH24:MI:SS') ||
            to_char(now() AT TIME ZONE food_fuso_loja($2) - now(), 'HH24:MI') AS agora
       FROM food_sessoes s WHERE s.id = $1`,
    [sessaoId, l.id]
  )).rows[0];

  const itens = (await query<{
    nome_snapshot: string; qtd: string; preco_unit: string; preco_total: string;
    codigo: string | null; ncm: string | null; cfop: string | null;
    csosn: string | null; unidade: string | null;
  }>(
    `SELECT i.nome_snapshot, i.qtd, i.preco_unit, i.preco_total,
            p.codigo, p.ncm, p.cfop, p.csosn, p.unidade
       FROM food_itens i
       JOIN food_pedidos ped ON ped.id = i.pedido_id
       LEFT JOIN food_produtos p ON p.id = i.produto_id
      WHERE ped.sessao_id = $1 AND i.status <> 'cancelado' AND ped.status <> 'cancelado'
      ORDER BY i.criado_em`,
    [sessaoId]
  )).rows;

  const pagamentos = (await query<{ metodo: string; valor: string; gorjeta: string }>(
    `SELECT metodo, valor, gorjeta FROM food_pagamentos
      WHERE sessao_id = $1 AND status = 'confirmado'`,
    [sessaoId]
  )).rows;

  return {
    emitente: emitenteDe(l),
    // a gorjeta NÃO entra na nota: é do garçom, não é venda de mercadoria
    itens: itens.map((i) => ({
      nome: i.nome_snapshot,
      qtd: Number(i.qtd),
      precoUnit: Number(i.preco_unit),
      precoTotal: Number(i.preco_total),
      codigo: i.codigo, ncm: i.ncm, cfop: i.cfop, csosn: i.csosn, unidade: i.unidade,
    })),
    pagamentos: pagamentos.map((p) => ({ metodo: p.metodo, valor: Number(p.valor) })),
    desconto: Number(s?.desconto ?? 0),
    cpf: s?.cpf_nota ?? null,
    dataEmissao: (s?.agora ?? new Date().toISOString()).replace(/(-\d\d)(\d\d)$/, "$1:$2"),
  };
}

// ---------------------------------------------------------------------------
// A FILA
// ---------------------------------------------------------------------------
export async function enfileirarNota(
  negocioId: string, lojaId: string, sessaoId: string
): Promise<{ enfileirada: boolean; motivo?: string }> {
  const l = await lojaFiscal(lojaId);
  if (!l?.fiscal_ativo) return { enfileirada: false, motivo: "fiscal desligado" };
  const ref = referenciaDaNota(lojaId, sessaoId);
  const r = await query<{ id: string }>(
    `INSERT INTO food_fiscal_fila
       (negocio_id, loja_id, sessao_id, referencia, ambiente, status)
     VALUES ($1,$2,$3,$4,$5,'pendente')
     ON CONFLICT (sessao_id) WHERE sessao_id IS NOT NULL
     DO UPDATE SET referencia = EXCLUDED.referencia,
                   ambiente = EXCLUDED.ambiente,
                   status = CASE WHEN food_fiscal_fila.status IN ('emitida','cancelada')
                                 THEN food_fiscal_fila.status ELSE 'pendente' END
     RETURNING id`,
    [negocioId, lojaId, sessaoId, ref, l.fiscal_ambiente]
  );
  return { enfileirada: r.rows.length > 0 };
}

/**
 * Emite uma linha da fila. Devolve o que aconteceu, sem levantar erro: quem
 * chama é a fila, e a fila não pode morrer por causa de uma nota.
 */
export async function emitirDaFila(filaId: string): Promise<{
  status: string; mensagem?: string;
}> {
  const f = (await query<{
    id: string; negocio_id: string; loja_id: string; sessao_id: string | null;
    referencia: string | null; tentativas: number; status: string;
  }>(
    "SELECT * FROM food_fiscal_fila WHERE id = $1", [filaId]
  )).rows[0];
  if (!f || !f.sessao_id) return { status: "erro", mensagem: "linha da fila sem comanda" };
  if (["emitida", "cancelada", "desistiu"].includes(f.status)) return { status: f.status };

  const l = await lojaFiscal(f.loja_id);
  if (!l) return { status: "erro", mensagem: "loja não encontrada" };
  const tk = token(l);
  if (!tk) {
    await marcarErro(f.id, f.tentativas, "Falta a credencial do integrador fiscal na configuração.", true);
    return { status: "erro", mensagem: "sem credencial" };
  }

  const ref = f.referencia ?? referenciaDaNota(l.id, f.sessao_id);
  let corpo: Record<string, unknown>;
  try {
    corpo = montarNfce(await dadosDaComanda(l, f.sessao_id));
  } catch (e) {
    const msg = e instanceof ErroFiscal ? e.message : "não deu para montar a nota";
    await marcarErro(f.id, f.tentativas, msg, true);
    return { status: "erro", mensagem: msg };
  }

  await query(
    `UPDATE food_fiscal_fila
        SET status = 'processando', referencia = $2, enviado_em = now(),
            enviado_json = $3::jsonb, tentativas = tentativas + 1, atualizado_em = now()
      WHERE id = $1`,
    [f.id, ref, JSON.stringify(corpo)]
  );

  const base = BASE[l.fiscal_ambiente === "producao" ? "producao" : "homologacao"];
  const auth = "Basic " + Buffer.from(`${tk}:`).toString("base64");

  try {
    const res = await fetch(`${base}/v2/nfce?ref=${encodeURIComponent(ref)}`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(20000),
    });
    const dados = await res.json().catch(() => ({} as Record<string, unknown>));
    await guardarRetorno(f.id, dados);

    // 202 quer dizer "recebi, estou processando": a resposta final vem no
    // acompanhamento. É por isso que a venda não espera a SEFAZ.
    if (res.status === 202 || res.ok) {
      return await acompanhar(f.id, ref, base, auth);
    }
    const msg = String((dados as { mensagem?: string; erros?: unknown }).mensagem ?? `HTTP ${res.status}`);
    await marcarErro(f.id, f.tentativas + 1, msg, ehErroPermanente(msg));
    return { status: "erro", mensagem: msg };
  } catch (e) {
    // rede caiu ou o integrador demorou: isso é contingência, e insiste
    const msg = registrarFalha(e, { onde: "food.fiscal", acao: "emitir", loja: l.id });
    await marcarErro(f.id, f.tentativas + 1, `sem resposta do integrador: ${msg}`, false);
    return { status: "erro", mensagem: msg };
  }
}

/** Pergunta ao integrador em que pé está a nota. */
export async function acompanhar(
  filaId: string, ref: string, base: string, auth: string
): Promise<{ status: string; mensagem?: string }> {
  try {
    const res = await fetch(`${base}/v2/nfce/${encodeURIComponent(ref)}`, {
      headers: { Authorization: auth },
      signal: AbortSignal.timeout(20000),
    });
    const d = await res.json().catch(() => ({} as Record<string, unknown>)) as Record<string, string>;
    await guardarRetorno(filaId, d);

    const st = String(d.status ?? "");
    if (st === "autorizado") {
      await query(
        `UPDATE food_fiscal_fila
            SET status = 'emitida', emitida_em = now(), erro = NULL,
                chave = $2, numero = $3, serie = $4, protocolo = $5,
                url_danfe = $6, url_xml = $7, qrcode = $8, atualizado_em = now()
          WHERE id = $1`,
        [filaId, d.chave_nfe ?? null, d.numero ?? null, d.serie ?? null, d.protocolo ?? null,
         d.caminho_danfe ?? null, d.caminho_xml ?? null, d.qrcode ?? null]
      );
      await marcarPedidosDaNota(filaId, "autorizada", d.chave_nfe ?? null, d.caminho_danfe ?? null);
      log.info("nfce autorizada", { onde: "food.fiscal", fila: filaId, chave: d.chave_nfe ?? null });
      return { status: "emitida" };
    }
    if (st === "processando_autorizacao" || st === "" ) {
      // ainda não voltou: a fila tenta de novo daqui a pouco
      await query(
        "UPDATE food_fiscal_fila SET status = 'pendente', proxima_em = now() + interval '1 minute', atualizado_em = now() WHERE id = $1",
        [filaId]
      );
      return { status: "pendente" };
    }
    const msg = String(d.mensagem_sefaz ?? d.mensagem ?? st);
    const linha = (await query<{ tentativas: number }>(
      "SELECT tentativas FROM food_fiscal_fila WHERE id = $1", [filaId])).rows[0];
    await marcarErro(filaId, linha?.tentativas ?? 1, msg, ehErroPermanente(msg));
    await marcarPedidosDaNota(filaId, "erro", null, null);
    return { status: "erro", mensagem: msg };
  } catch (e) {
    const msg = registrarFalha(e, { onde: "food.fiscal", acao: "acompanhar", fila: filaId });
    await marcarErro(filaId, 1, `sem resposta ao acompanhar: ${msg}`, false);
    return { status: "erro", mensagem: msg };
  }
}

async function guardarRetorno(filaId: string, dados: unknown): Promise<void> {
  await query(
    "UPDATE food_fiscal_fila SET retorno_json = $2::jsonb, atualizado_em = now() WHERE id = $1",
    [filaId, JSON.stringify(dados ?? {})]
  );
}

async function marcarErro(
  filaId: string, tentativas: number, mensagem: string, permanente: boolean
): Promise<void> {
  const minutos = proximaTentativa(tentativas);
  await query(
    `UPDATE food_fiscal_fila
        SET status = $3, erro = $2, atualizado_em = now(),
            proxima_em = now() + ($4 || ' minutes')::interval
      WHERE id = $1`,
    [filaId, mensagem.slice(0, 500), permanente ? "erro" : "pendente", String(minutos)]
  );
  // Depois de muita insistência sem sucesso, para de tentar e chama o dono.
  if (!permanente && tentativas >= 12) {
    await query("UPDATE food_fiscal_fila SET status = 'erro' WHERE id = $1", [filaId]);
  }
}

/** O pedido guarda o resultado, para a tela e a via do cliente. */
async function marcarPedidosDaNota(
  filaId: string, status: string, chave: string | null, url: string | null
): Promise<void> {
  await query(
    `UPDATE food_pedidos p
        SET nfce_status = $2, nfce_chave = COALESCE($3, p.nfce_chave), nfce_url = COALESCE($4, p.nfce_url)
       FROM food_fiscal_fila f
      WHERE f.id = $1 AND p.sessao_id = f.sessao_id AND p.negocio_id = f.negocio_id`,
    [filaId, status, chave, url]
  );
}

/**
 * O cron. Pega o que está na hora, emite e segue. Nunca levanta erro para fora:
 * a fila é a rede de contingência, e rede de contingência não pode cair.
 */
export async function processarFilaFiscal(limite = 20): Promise<{
  tentadas: number; emitidas: number; erros: number;
}> {
  const linhas = (await query<{ id: string }>(
    `SELECT id FROM food_fiscal_fila
      WHERE status = 'pendente' AND proxima_em <= now()
      ORDER BY criado_em LIMIT $1`,
    [limite]
  )).rows;

  let emitidas = 0;
  let erros = 0;
  for (const l of linhas) {
    const r = await emitirDaFila(l.id);
    if (r.status === "emitida") emitidas++;
    else if (r.status === "erro") erros++;
  }
  return { tentadas: linhas.length, emitidas, erros };
}

/** Cancelar a nota. A SEFAZ dá 30 minutos, e exige justificativa de 15 letras. */
export async function cancelarNota(
  negocioId: string, filaId: string, motivo: string
): Promise<{ ok: boolean; mensagem?: string }> {
  const just = motivo.trim();
  if (just.length < 15) {
    return { ok: false, mensagem: "A SEFAZ exige uma justificativa de pelo menos 15 letras." };
  }
  const f = (await query<{ id: string; loja_id: string; referencia: string | null; status: string }>(
    "SELECT id, loja_id, referencia, status FROM food_fiscal_fila WHERE id = $1 AND negocio_id = $2",
    [filaId, negocioId]
  )).rows[0];
  if (!f) return { ok: false, mensagem: "Nota não encontrada." };
  if (f.status !== "emitida") return { ok: false, mensagem: "Só dá para cancelar nota que foi autorizada." };

  const l = await lojaFiscal(f.loja_id);
  const tk = l ? token(l) : null;
  if (!l || !tk) return { ok: false, mensagem: "Falta a credencial do integrador." };

  const base = BASE[l.fiscal_ambiente === "producao" ? "producao" : "homologacao"];
  try {
    const res = await fetch(`${base}/v2/nfce/${encodeURIComponent(f.referencia ?? "")}`, {
      method: "DELETE",
      headers: {
        Authorization: "Basic " + Buffer.from(`${tk}:`).toString("base64"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ justificativa: just }),
      signal: AbortSignal.timeout(20000),
    });
    const d = await res.json().catch(() => ({}));
    await guardarRetorno(f.id, d);
    if (!res.ok) {
      return { ok: false, mensagem: String((d as { mensagem?: string }).mensagem ?? `HTTP ${res.status}`) };
    }
    await query(
      `UPDATE food_fiscal_fila
          SET status = 'cancelada', cancelada_em = now(), cancel_motivo = $2, atualizado_em = now()
        WHERE id = $1`,
      [f.id, just.slice(0, 300)]
    );
    await marcarPedidosDaNota(f.id, "cancelada", null, null);
    return { ok: true };
  } catch (e) {
    return { ok: false, mensagem: registrarFalha(e, { onde: "food.fiscal", acao: "cancelar" }) };
  }
}

/** O que a tela do dono mostra. */
export async function painelFiscal(negocioId: string, lojaId: string) {
  const totais = (await query<{
    emitidas: string; pendentes: string; erros: string; canceladas: string; valor: string;
  }>(
    `SELECT COUNT(*) FILTER (WHERE status = 'emitida')::text AS emitidas,
            COUNT(*) FILTER (WHERE status IN ('pendente','processando'))::text AS pendentes,
            COUNT(*) FILTER (WHERE status = 'erro')::text AS erros,
            COUNT(*) FILTER (WHERE status = 'cancelada')::text AS canceladas,
            COALESCE(SUM(valor) FILTER (WHERE status = 'emitida'), 0)::text AS valor
       FROM food_fiscal_fila
      WHERE negocio_id = $1 AND loja_id = $2
        AND (criado_em AT TIME ZONE food_fuso_loja($2))::date >= food_dia_loja($2) - 30`,
    [negocioId, lojaId]
  )).rows[0];

  const notas = (await query<{
    id: string; status: string; erro: string | null; numero: string | null;
    chave: string | null; url_danfe: string | null; criado_em: string;
    tentativas: number; mesa: string | null; total: string | null;
  }>(
    `SELECT f.id, f.status, f.erro, f.numero, f.chave, f.url_danfe, f.criado_em, f.tentativas,
            m.numero AS mesa, s.total
       FROM food_fiscal_fila f
       LEFT JOIN food_sessoes s ON s.id = f.sessao_id
       LEFT JOIN food_mesas m ON m.id = s.mesa_id
      WHERE f.negocio_id = $1 AND f.loja_id = $2
      ORDER BY f.criado_em DESC LIMIT 60`,
    [negocioId, lojaId]
  )).rows;

  return { totais, notas };
}
