import type { ClienteSQL } from "./food-kds-sql";

/**
 * Erro de regra de venda, com codigo para a tela saber o que dizer. Nao vem do
 * food-kds-sql de proposito: este arquivo nao importa NADA em tempo de
 * execucao, e e isso que deixa as consultas serem testadas fora do app.
 */
export class ErroVenda extends Error {
  codigo = "ERRO";
  constructor(codigo: string, mensagem: string) {
    super(mensagem);
    this.name = "ErroVenda";
    this.codigo = codigo;
  }
}

// ============================================================================
// CUPOM, AVALIAÇÃO e FIDELIDADE.
//
// Vem direto da pesquisa de mercado: cupom e fidelidade a concorrência anuncia
// e a gente não tinha; avaliação ninguém no Brasil faz bem, e para bar de
// bairro a nota do Google é o ativo de marketing mais importante que existe.
//
// Sem import de runtime, cliente de banco por parâmetro: testável direto.
// ============================================================================

const n = (v: unknown): number => Number(v ?? 0);
const cent = (v: number): number => Math.round(v * 100) / 100;

// ---------------------------------------------------------------------------
// CUPOM
// ---------------------------------------------------------------------------
export interface CupomAplicado {
  id: string;
  codigo: string;
  desconto: number;
  fretegratis: boolean;
  descricao: string;
}

interface LinhaCupom {
  id: string; codigo: string; tipo: string; valor: string; teto: string | null;
  minimo: string; canais: string[]; limite_total: number | null; limite_pessoa: number;
  usos: number; comeca_em: string | null; termina_em: string | null;
  dias_semana: number[] | null; hora_inicio: string | null; hora_fim: string | null;
  primeira_compra: boolean; agora_dow: number; agora_hora: string;
}

/**
 * Confere o cupom e diz quanto ele abate. Recusa com frase pronta para a tela.
 * O desconto SAI DAQUI, nunca do navegador.
 */
export async function conferirCupom(
  c: ClienteSQL,
  e: {
    negocioId: string; lojaId: string; codigo: string; subtotal: number;
    canal: string; taxaEntrega?: number; telefone?: string | null; clienteId?: string | null;
  }
): Promise<CupomAplicado> {
  const codigo = e.codigo.trim().toUpperCase();
  if (!codigo) throw new ErroVenda("CUPOM_INVALIDO", "Digite o cupom.");

  const cp = (await c.query<LinhaCupom>(
    `SELECT cu.*,
            EXTRACT(DOW FROM food_agora_loja($2))::int AS agora_dow,
            food_agora_loja($2)::time::text AS agora_hora
       FROM food_cupons cu
      WHERE cu.negocio_id = $1 AND cu.loja_id = $2 AND UPPER(cu.codigo) = $3`,
    [e.negocioId, e.lojaId, codigo]
  )).rows[0];

  if (!cp) throw new ErroVenda("CUPOM_INVALIDO", "Este cupom não existe.");
  if (!(cp as unknown as { ativo?: boolean }).ativo) {
    throw new ErroVenda("CUPOM_INVALIDO", "Este cupom não está mais valendo.");
  }
  if (cp.comeca_em && new Date(cp.comeca_em) > new Date()) {
    throw new ErroVenda("CUPOM_INVALIDO", "Este cupom ainda não começou.");
  }
  if (cp.termina_em && new Date(cp.termina_em) < new Date()) {
    throw new ErroVenda("CUPOM_INVALIDO", "Este cupom venceu.");
  }
  if (!cp.canais.includes(e.canal)) {
    throw new ErroVenda("CUPOM_INVALIDO", "Este cupom não vale para este tipo de pedido.");
  }
  if (n(cp.minimo) > 0 && e.subtotal < n(cp.minimo)) {
    throw new ErroVenda("CUPOM_MINIMO",
      `Este cupom vale a partir de R$ ${n(cp.minimo).toFixed(2)}.`);
  }
  if (cp.limite_total != null && cp.usos >= cp.limite_total) {
    throw new ErroVenda("CUPOM_ESGOTADO", "Este cupom acabou.");
  }

  // happy hour: dia da semana e faixa de hora, no fuso da casa
  if (cp.dias_semana?.length && !cp.dias_semana.includes(cp.agora_dow)) {
    throw new ErroVenda("CUPOM_FORA_DO_DIA", "Este cupom não vale hoje.");
  }
  if (cp.hora_inicio && cp.hora_fim) {
    const agora = cp.agora_hora.slice(0, 8);
    const dentro = cp.hora_fim > cp.hora_inicio
      ? agora >= cp.hora_inicio && agora <= cp.hora_fim
      : agora >= cp.hora_inicio || agora <= cp.hora_fim;
    if (!dentro) {
      throw new ErroVenda("CUPOM_FORA_DA_HORA",
        `Este cupom vale das ${cp.hora_inicio.slice(0, 5)} às ${cp.hora_fim.slice(0, 5)}.`);
    }
  }

  // quantas vezes esta pessoa já usou
  if (e.telefone || e.clienteId) {
    const usos = n((await c.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM food_cupom_usos
        WHERE cupom_id = $1 AND (telefone = $2 OR cliente_id = $3)`,
      [cp.id, e.telefone ?? null, e.clienteId ?? null]
    )).rows[0]?.n);
    if (usos >= cp.limite_pessoa) {
      throw new ErroVenda("CUPOM_JA_USADO", "Você já usou este cupom.");
    }
    if (cp.primeira_compra && e.clienteId) {
      const antes = n((await c.query<{ n: string }>(
        "SELECT pedidos_qtd::text AS n FROM food_clientes WHERE id = $1", [e.clienteId]
      )).rows[0]?.n);
      if (antes > 1) throw new ErroVenda("CUPOM_SO_PRIMEIRA", "Este cupom é só para a primeira compra.");
    }
  }

  // ---- quanto abate
  let desconto = 0;
  let fretegratis = false;
  let descricao = "";
  if (cp.tipo === "percentual") {
    desconto = cent(e.subtotal * n(cp.valor) / 100);
    if (cp.teto != null && desconto > n(cp.teto)) desconto = n(cp.teto);
    descricao = `${n(cp.valor).toFixed(0)}% de desconto`;
  } else if (cp.tipo === "valor") {
    desconto = Math.min(n(cp.valor), e.subtotal);
    descricao = `R$ ${n(cp.valor).toFixed(2)} de desconto`;
  } else {
    fretegratis = true;
    desconto = cent(e.taxaEntrega ?? 0);
    descricao = "frete grátis";
  }
  // desconto nunca vira troco
  desconto = Math.max(0, Math.min(cent(desconto), e.subtotal + cent(e.taxaEntrega ?? 0)));

  return { id: cp.id, codigo, desconto, fretegratis, descricao };
}

/** Grava o uso. Chamado dentro da transação que fecha o pedido ou a comanda. */
export async function registrarUsoDeCupom(
  c: ClienteSQL,
  e: {
    negocioId: string; cupomId: string; desconto: number;
    sessaoId?: string | null; pedidoId?: string | null;
    clienteId?: string | null; telefone?: string | null;
  }
): Promise<void> {
  await c.query(
    `INSERT INTO food_cupom_usos
       (negocio_id, cupom_id, sessao_id, pedido_id, cliente_id, telefone, desconto)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT DO NOTHING`,
    [e.negocioId, e.cupomId, e.sessaoId ?? null, e.pedidoId ?? null,
     e.clienteId ?? null, e.telefone ?? null, e.desconto.toFixed(2)]
  );
  await c.query(
    "UPDATE food_cupons SET usos = usos + 1 WHERE id = $1 AND negocio_id = $2",
    [e.cupomId, e.negocioId]
  );
}

// ---------------------------------------------------------------------------
// AVALIAÇÃO
// ---------------------------------------------------------------------------
export const MARCADORES = [
  "comida", "atendimento", "tempo de espera", "ambiente", "preço", "limpeza",
] as const;

export async function registrarAvaliacao(
  c: ClienteSQL,
  e: {
    negocioId: string; lojaId: string; nota: number;
    sessaoId?: string | null; pedidoId?: string | null; mesaId?: string | null;
    clienteId?: string | null; marcadores?: string[] | null; comentario?: string | null;
  }
): Promise<{ ok: true; googleUrl: string | null; nota: number }> {
  if (!(e.nota >= 1 && e.nota <= 5)) {
    throw new ErroVenda("NOTA_INVALIDA", "A nota vai de 1 a 5.");
  }
  const marcadores = (e.marcadores ?? []).filter((m) => (MARCADORES as readonly string[]).includes(m));

  await c.query(
    `INSERT INTO food_avaliacoes
       (negocio_id, loja_id, sessao_id, pedido_id, mesa_id, cliente_id, nota, marcadores, comentario)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (sessao_id) WHERE sessao_id IS NOT NULL
     DO UPDATE SET nota = EXCLUDED.nota, marcadores = EXCLUDED.marcadores,
                   comentario = EXCLUDED.comentario, criado_em = now()`,
    [e.negocioId, e.lojaId, e.sessaoId ?? null, e.pedidoId ?? null, e.mesaId ?? null,
     e.clienteId ?? null, e.nota, marcadores.length ? marcadores : null,
     e.comentario?.slice(0, 500) ?? null]
  );

  const loja = (await c.query<{ google_url: string | null; nota_para_google: number }>(
    "SELECT google_url, nota_para_google FROM food_lojas WHERE id = $1", [e.lojaId]
  )).rows[0];

  // Nota boa vai para o Google, porque é lá que o vizinho procura antes de
  // escolher onde jantar. Nota ruim fica dentro de casa e vira alerta para o
  // dono resolver com o cliente ainda na mesa, que é quando dá para resolver.
  const manda = !!loja?.google_url && e.nota >= (loja?.nota_para_google ?? 4);
  if (!manda && e.nota <= 3) {
    await c.query(
      `INSERT INTO food_eventos (negocio_id, loja_id, tipo, sessao_id, payload)
       VALUES ($1,$2,'avaliacao_ruim',$3,$4::jsonb)`,
      [e.negocioId, e.lojaId, e.sessaoId ?? null,
       JSON.stringify({ nota: e.nota, marcadores, comentario: e.comentario ?? null })]
    );
  }
  return { ok: true, googleUrl: manda ? loja.google_url : null, nota: e.nota };
}

export async function marcarFoiProGoogle(
  c: ClienteSQL, negocioId: string, sessaoId: string
): Promise<void> {
  await c.query(
    "UPDATE food_avaliacoes SET foi_pro_google = true WHERE sessao_id = $1 AND negocio_id = $2",
    [sessaoId, negocioId]
  );
}

export async function resumoDeAvaliacoes(c: ClienteSQL, negocioId: string, lojaId: string) {
  const t = (await c.query<{
    media: string; total: string; promotores: string; detratores: string; google: string;
  }>(
    `SELECT COALESCE(ROUND(AVG(nota)::numeric, 2), 0)::text AS media,
            COUNT(*)::text AS total,
            COUNT(*) FILTER (WHERE nota >= 4)::text AS promotores,
            COUNT(*) FILTER (WHERE nota <= 3)::text AS detratores,
            COUNT(*) FILTER (WHERE foi_pro_google)::text AS google
       FROM food_avaliacoes WHERE negocio_id = $1 AND loja_id = $2`,
    [negocioId, lojaId]
  )).rows[0];

  const recentes = (await c.query<{
    nota: number; comentario: string | null; marcadores: string[] | null;
    criado_em: string; mesa: string | null; respondida_em: string | null;
  }>(
    `SELECT a.nota, a.comentario, a.marcadores, a.criado_em, a.respondida_em,
            m.numero AS mesa
       FROM food_avaliacoes a
       LEFT JOIN food_mesas m ON m.id = a.mesa_id
      WHERE a.negocio_id = $1 AND a.loja_id = $2
      ORDER BY a.criado_em DESC LIMIT 30`,
    [negocioId, lojaId]
  )).rows;

  const queixas = (await c.query<{ marcador: string; vezes: string }>(
    `SELECT UNNEST(marcadores) AS marcador, COUNT(*)::text AS vezes
       FROM food_avaliacoes
      WHERE negocio_id = $1 AND loja_id = $2 AND nota <= 3 AND marcadores IS NOT NULL
      GROUP BY 1 ORDER BY COUNT(*) DESC LIMIT 6`,
    [negocioId, lojaId]
  )).rows;

  return { totais: t, recentes, queixas };
}

// ---------------------------------------------------------------------------
// FIDELIDADE
// ---------------------------------------------------------------------------
export async function creditarPontos(
  c: ClienteSQL,
  e: { negocioId: string; lojaId: string; clienteId: string; valorGasto: number; sessaoId?: string | null }
): Promise<number> {
  const l = (await c.query<{ fidelidade_ativa: boolean; pontos_por_real: string }>(
    "SELECT fidelidade_ativa, pontos_por_real FROM food_lojas WHERE id = $1", [e.lojaId]
  )).rows[0];
  if (!l?.fidelidade_ativa) return 0;

  const pontos = Math.floor(e.valorGasto * n(l.pontos_por_real));
  if (pontos <= 0) return 0;

  const saldo = (await c.query<{ pontos: number }>(
    "UPDATE food_clientes SET pontos = pontos + $2 WHERE id = $1 AND negocio_id = $3 RETURNING pontos",
    [e.clienteId, pontos, e.negocioId]
  )).rows[0];
  if (!saldo) return 0;

  await c.query(
    `INSERT INTO food_pontos_mov (negocio_id, cliente_id, sessao_id, tipo, pontos, saldo_depois, obs)
     VALUES ($1,$2,$3,'ganhou',$4,$5,$6)`,
    [e.negocioId, e.clienteId, e.sessaoId ?? null, pontos, saldo.pontos,
     `R$ ${e.valorGasto.toFixed(2)} em consumo`]
  );
  return pontos;
}

export async function resgatarPontos(
  c: ClienteSQL,
  e: { negocioId: string; lojaId: string; clienteId: string; pontos: number; sessaoId?: string | null }
): Promise<{ desconto: number; saldo: number }> {
  const l = (await c.query<{
    fidelidade_ativa: boolean; valor_do_ponto: string; resgate_minimo: number;
  }>(
    "SELECT fidelidade_ativa, valor_do_ponto, resgate_minimo FROM food_lojas WHERE id = $1",
    [e.lojaId]
  )).rows[0];
  if (!l?.fidelidade_ativa) throw new ErroVenda("SEM_FIDELIDADE", "Esta casa não tem programa de pontos.");
  if (e.pontos < l.resgate_minimo) {
    throw new ErroVenda("POUCOS_PONTOS", `O resgate começa em ${l.resgate_minimo} pontos.`);
  }

  const cli = (await c.query<{ pontos: number }>(
    "SELECT pontos FROM food_clientes WHERE id = $1 AND negocio_id = $2", [e.clienteId, e.negocioId]
  )).rows[0];
  if (!cli || cli.pontos < e.pontos) {
    throw new ErroVenda("POUCOS_PONTOS", `Você tem ${cli?.pontos ?? 0} pontos.`);
  }

  const saldo = (await c.query<{ pontos: number }>(
    "UPDATE food_clientes SET pontos = pontos - $2 WHERE id = $1 RETURNING pontos",
    [e.clienteId, e.pontos]
  )).rows[0];
  await c.query(
    `INSERT INTO food_pontos_mov (negocio_id, cliente_id, sessao_id, tipo, pontos, saldo_depois, obs)
     VALUES ($1,$2,$3,'resgatou',$4,$5,'resgate em desconto')`,
    [e.negocioId, e.clienteId, e.sessaoId ?? null, -e.pontos, saldo.pontos]
  );
  return { desconto: cent(e.pontos * n(l.valor_do_ponto)), saldo: saldo.pontos };
}

/** O cliente da mesa se identifica pelo telefone: é o que liga comanda e cadastro. */
export async function identificarNaMesa(
  c: ClienteSQL,
  e: { negocioId: string; sessaoId: string; telefone: string; nome?: string | null }
): Promise<{ clienteId: string; pontos: number; nome: string | null }> {
  const tel = e.telefone.replace(/\D/g, "").slice(0, 15);
  if (tel.length < 10) throw new ErroVenda("TELEFONE_INVALIDO", "Telefone com DDD, por favor.");

  const cli = (await c.query<{ id: string; pontos: number; nome: string | null }>(
    `INSERT INTO food_clientes (negocio_id, nome, telefone)
     VALUES ($1,$2,$3)
     ON CONFLICT (negocio_id, telefone)
     DO UPDATE SET nome = COALESCE(EXCLUDED.nome, food_clientes.nome),
                   ultimo_pedido = now()
     RETURNING id, pontos, nome`,
    [e.negocioId, e.nome?.slice(0, 80) ?? null, tel]
  )).rows[0];

  await c.query(
    "UPDATE food_sessoes SET cliente_id = $2 WHERE id = $1 AND negocio_id = $3",
    [e.sessaoId, cli.id, e.negocioId]
  );
  return { clienteId: cli.id, pontos: cli.pontos, nome: cli.nome };
}
