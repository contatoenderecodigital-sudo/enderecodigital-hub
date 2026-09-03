import "server-only";
import crypto from "node:crypto";
import { pool, query } from "./db";
import type { PoolClient } from "pg";
import {
  acertarSessaoAposPagamento, moverSessao, podePedido,
  ErroKds, type ClienteSQL, type EstadoPedido,
} from "./food-kds-sql";
import { extraDoItem } from "./food-regras";
import { enfileirarNota } from "./food-fiscal";
import { siglas } from "./food-alergenicos";
import type {
  CanalPedido, CardapioCategoria, CardapioProduto, FoodArea, FoodCategoria, FoodImpressora,
  FoodGrupoOpcao, FoodItem, FoodLoja, FoodMesa, FoodOpcao, FoodPedido, FoodSessao, FoodVariacao,
  ItemEntrada, MesaNoMapa, MetodoPagamento, PedidoComItens, StatusItem, StatusPedido,
} from "./food-types";

// ============================================================================
// AppFood — acesso a dados. TODA função recebe negocioId e filtra por ele.
// Exceção consciente: as funções `*Publico` resolvem pela loja/mesa (slug/token
// são únicos globalmente) e por isso NUNCA aceitam id vindo do cliente sem
// passar pelo slug/token.
// ============================================================================

const n = (v: unknown): number => Number(v ?? 0);
const brl = (v: number): string => v.toFixed(2);
function novoToken(bytes = 12): string {
  return crypto.randomBytes(bytes).toString("base64url");
}
function codigoCurto(): string {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 4 }, () => a[crypto.randomInt(a.length)]).join("");
}

// ---------------------------------------------------------------------------
// LOJAS
// ---------------------------------------------------------------------------
export async function listLojas(negocioId: string): Promise<FoodLoja[]> {
  return (await query<FoodLoja>(
    "SELECT * FROM food_lojas WHERE negocio_id = $1 ORDER BY criado_em ASC",
    [negocioId]
  )).rows;
}

export async function getLoja(negocioId: string, lojaId: string): Promise<FoodLoja | null> {
  return (await query<FoodLoja>(
    "SELECT * FROM food_lojas WHERE id = $1 AND negocio_id = $2",
    [lojaId, negocioId]
  )).rows[0] ?? null;
}

export async function lojaPrincipal(negocioId: string): Promise<FoodLoja | null> {
  return (await query<FoodLoja>(
    "SELECT * FROM food_lojas WHERE negocio_id = $1 AND ativo = true ORDER BY criado_em ASC LIMIT 1",
    [negocioId]
  )).rows[0] ?? null;
}

/** Público: resolve a loja pelo slug da URL /c/<slug>. */
export async function getLojaBySlug(slug: string): Promise<FoodLoja | null> {
  return (await query<FoodLoja>(
    "SELECT * FROM food_lojas WHERE slug = $1 AND ativo = true",
    [slug]
  )).rows[0] ?? null;
}

export async function criarLoja(
  negocioId: string,
  input: { nome: string; slug: string; tipo?: string; cidade?: string; uf?: string }
): Promise<FoodLoja> {
  const loja = (await query<FoodLoja>(
    `INSERT INTO food_lojas (negocio_id, slug, nome, tipo, cidade, uf)
     VALUES ($1,$2,$3,COALESCE($4,'restaurante'),$5,COALESCE($6,'SC')) RETURNING *`,
    [negocioId, input.slug, input.nome, input.tipo ?? null, input.cidade ?? null, input.uf ?? null]
  )).rows[0];
  // toda loja nasce com uma área de produção, senão nada imprime nem aparece no KDS
  await query(
    "INSERT INTO food_areas (negocio_id, loja_id, nome, ordem) VALUES ($1,$2,'Cozinha',0)",
    [negocioId, loja.id]
  );
  return loja;
}

export async function atualizarLoja(
  negocioId: string,
  lojaId: string,
  campos: Record<string, unknown>
): Promise<void> {
  const PERMITIDOS = new Set([
    "nome", "tipo", "logo_url", "capa_url", "cor_destaque", "cor_fundo", "tema_modo",
    "telefone", "whatsapp", "endereco", "cidade", "uf", "aceita_mesa", "aceita_balcao",
    "aceita_delivery", "exige_aprovacao_garcom", "limite_sessao_sem_aprov", "taxa_servico_pct",
    "taxa_servico_automatica", "couvert", "tempo_preparo_min", "entrega_raio_km",
    "entrega_pedido_minimo", "aceita_retirada", "pagar_no_app", "pix_provedor", "pix_chave",
    "gorjeta_sugerida_pct", "fiscal_ativo", "fiscal_provedor", "fiscal_cnpj", "fiscal_ambiente",
    "aberto_manual", "ativo",
    // avaliacao e fidelidade
    "google_url", "pedir_avaliacao", "nota_para_google",
    "fidelidade_ativa", "pontos_por_real", "valor_do_ponto", "resgate_minimo",
  ]);
  const chaves = Object.keys(campos).filter((k) => PERMITIDOS.has(k));
  if (!chaves.length) return;
  const sets = chaves.map((k, i) => `${k} = $${i + 3}`).join(", ");
  await query(
    `UPDATE food_lojas SET ${sets} WHERE id = $1 AND negocio_id = $2`,
    [lojaId, negocioId, ...chaves.map((k) => campos[k])]
  );
}

// ---------------------------------------------------------------------------
// ÁREAS DE PRODUÇÃO
// ---------------------------------------------------------------------------
export async function listAreas(negocioId: string, lojaId: string): Promise<FoodArea[]> {
  return (await query<FoodArea>(
    "SELECT * FROM food_areas WHERE negocio_id = $1 AND loja_id = $2 ORDER BY ordem, nome",
    [negocioId, lojaId]
  )).rows;
}

export async function criarArea(
  negocioId: string, lojaId: string, nome: string, cor?: string
): Promise<FoodArea> {
  return (await query<FoodArea>(
    `INSERT INTO food_areas (negocio_id, loja_id, nome, cor,
       ordem) VALUES ($1,$2,$3,$4,
       (SELECT COALESCE(MAX(ordem),0)+1 FROM food_areas WHERE loja_id = $2)) RETURNING *`,
    [negocioId, lojaId, nome, cor ?? null]
  )).rows[0];
}

// ---------------------------------------------------------------------------
// MESAS — o token é o que vai gravado no cartão NFC.
// ---------------------------------------------------------------------------
export async function listMesas(negocioId: string, lojaId: string): Promise<FoodMesa[]> {
  return (await query<FoodMesa>(
    "SELECT * FROM food_mesas WHERE negocio_id = $1 AND loja_id = $2 ORDER BY ordem, numero",
    [negocioId, lojaId]
  )).rows;
}

/** Cria mesas em lote (de 1 a 20, por exemplo). Ignora as que já existem. */
export async function criarMesas(
  negocioId: string, lojaId: string, de: number, ate: number, setor?: string
): Promise<number> {
  let criadas = 0;
  for (let i = de; i <= ate; i++) {
    const r = await query<{ id: string }>(
      `INSERT INTO food_mesas (negocio_id, loja_id, numero, token, setor, ordem)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (loja_id, numero) DO NOTHING
       RETURNING id`,
      [negocioId, lojaId, String(i), novoToken(), setor ?? null, i]
    );
    if (r.rows.length) criadas++;   // a que já existia não conta
  }
  return criadas;
}

export async function criarMesa(
  negocioId: string, lojaId: string, numero: string, capacidade = 4, setor?: string
): Promise<FoodMesa> {
  return (await query<FoodMesa>(
    `INSERT INTO food_mesas (negocio_id, loja_id, numero, token, capacidade, setor)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [negocioId, lojaId, numero, novoToken(), capacidade, setor ?? null]
  )).rows[0];
}

/** Gera token novo (cartão perdido ou clonado). O cartão antigo morre na hora. */
export async function regravarMesa(negocioId: string, mesaId: string): Promise<string> {
  const t = novoToken();
  await query(
    "UPDATE food_mesas SET token = $1, cartao_gravado_em = NULL WHERE id = $2 AND negocio_id = $3",
    [t, mesaId, negocioId]
  );
  return t;
}

export async function marcarCartaoGravado(negocioId: string, mesaId: string): Promise<void> {
  await query(
    "UPDATE food_mesas SET cartao_gravado_em = now() WHERE id = $1 AND negocio_id = $2",
    [mesaId, negocioId]
  );
}

/** Público: resolve a mesa pelo token do cartão. */
export async function getMesaByToken(
  token: string
): Promise<{ mesa: FoodMesa; loja: FoodLoja } | null> {
  const r = await query<FoodMesa & { loja: FoodLoja }>(
    `SELECT m.*, row_to_json(l.*) AS loja
       FROM food_mesas m JOIN food_lojas l ON l.id = m.loja_id
      WHERE m.token = $1 AND m.ativa = true AND l.ativo = true`,
    [token]
  );
  const row = r.rows[0];
  if (!row) return null;
  const { loja, ...mesa } = row as FoodMesa & { loja: FoodLoja };
  return { mesa: mesa as FoodMesa, loja };
}

/** Mapa de mesas do salão: quem está ocupada, há quanto tempo, quanto já consumiu. */
export async function mapaMesas(negocioId: string, lojaId: string): Promise<MesaNoMapa[]> {
  return (await query<MesaNoMapa>(
    `SELECT m.*,
            s.id AS sessao_id, s.status AS sessao_status, s.aberta_em, s.total,
            COALESCE((SELECT COUNT(*) FROM food_itens i
                        JOIN food_pedidos p ON p.id = i.pedido_id
                       WHERE p.sessao_id = s.id AND i.status IN ('pendente','em_producao')), 0) AS itens_pendentes,
            EXISTS (SELECT 1 FROM food_chamados c
                     WHERE c.mesa_id = m.id AND c.status = 'aberto') AS chamado_aberto
       FROM food_mesas m
       LEFT JOIN food_sessoes s
              ON s.mesa_id = m.id
             AND s.status IN ('aberta','conta_pedida','em_pagamento','paga')
      WHERE m.negocio_id = $1 AND m.loja_id = $2 AND m.ativa = true
      ORDER BY m.ordem, m.numero`,
    [negocioId, lojaId]
  )).rows;
}

// ---------------------------------------------------------------------------
// CARDÁPIO
// ---------------------------------------------------------------------------
/**
 * Monta o cardápio inteiro em 4 consultas (sem N+1).
 * `canal` filtra o que aparece na mesa, no balcão ou no delivery.
 * `admin` traz também o que está inativo/esgotado, para a tela de gestão.
 */
export async function montarCardapio(
  lojaId: string,
  opts: { canal?: CanalPedido; admin?: boolean } = {}
): Promise<CardapioCategoria[]> {
  const canal = opts.canal ?? "mesa";
  const admin = !!opts.admin;

  // Horario da categoria valendo: cafe da manha some as 11h, sobremesa aparece
  // as 19h. As colunas existiam desde a primeira migracao, a tela do dono
  // deixava preencher, e a consulta ignorava. O dono configurava e nao via
  // efeito nenhum.
  const janela = `
    AND (c.hora_inicio IS NULL OR c.hora_fim IS NULL
         OR (CASE WHEN c.hora_fim > c.hora_inicio
                  THEN food_agora_loja($1)::time BETWEEN c.hora_inicio AND c.hora_fim
                  ELSE food_agora_loja($1)::time >= c.hora_inicio
                    OR food_agora_loja($1)::time <= c.hora_fim END))`;
  const cats = (await query<FoodCategoria>(
    `SELECT c.* FROM food_categorias c
      WHERE c.loja_id = $1 ${admin ? "" : `AND c.ativa = true AND $2 = ANY(c.canais) ${janela}`}
      ORDER BY c.ordem, c.nome`,
    admin ? [lojaId] : [lojaId, canal]
  )).rows;
  if (!cats.length) return [];

  const ids = cats.map((c) => c.id);
  const prods = (await query<CardapioProduto>(
    `SELECT * FROM food_produtos
      WHERE categoria_id = ANY($1) ${admin ? "" : "AND ativo = true AND $2 = ANY(canais)"}
      ORDER BY ordem, nome`,
    admin ? [ids] : [ids, canal]
  )).rows;

  const pids = prods.map((p) => p.id);
  const vars = pids.length
    ? (await query<FoodVariacao>(
        "SELECT * FROM food_variacoes WHERE produto_id = ANY($1) AND ativa = true ORDER BY ordem",
        [pids]
      )).rows
    : [];
  const grupos = pids.length
    ? (await query<FoodGrupoOpcao>(
        "SELECT * FROM food_grupos_opcao WHERE produto_id = ANY($1) ORDER BY ordem",
        [pids]
      )).rows
    : [];
  const gids = grupos.map((g) => g.id);
  const opcoes = gids.length
    ? (await query<FoodOpcao>(
        "SELECT * FROM food_opcoes WHERE grupo_id = ANY($1) AND ativa = true ORDER BY ordem",
        [gids]
      )).rows
    : [];

  for (const p of prods) {
    p.variacoes = vars.filter((v) => v.produto_id === p.id);
    p.grupos = grupos
      .filter((g) => g.produto_id === p.id)
      .map((g) => ({ ...g, opcoes: opcoes.filter((o) => o.grupo_id === g.id) }));
  }
  return cats.map((c) => ({ ...c, produtos: prods.filter((p) => p.categoria_id === c.id) }));
}

export async function upsertCategoria(
  negocioId: string, lojaId: string,
  input: {
    id?: string; nome: string; descricao?: string | null; ordem?: number;
    canais?: string[]; ativa?: boolean; hora_inicio?: string | null; hora_fim?: string | null;
  }
): Promise<FoodCategoria> {
  const canais = input.canais?.length ? input.canais : null;
  if (input.id) {
    return (await query<FoodCategoria>(
      `UPDATE food_categorias
          SET nome = $3, descricao = $4, ordem = COALESCE($5, ordem),
              canais = COALESCE($6, canais), ativa = COALESCE($7, ativa),
              hora_inicio = $8, hora_fim = $9
        WHERE id = $1 AND negocio_id = $2 RETURNING *`,
      [input.id, negocioId, input.nome, input.descricao ?? null, input.ordem ?? null,
       canais, input.ativa ?? null, input.hora_inicio || null, input.hora_fim || null]
    )).rows[0];
  }
  return (await query<FoodCategoria>(
    `INSERT INTO food_categorias (negocio_id, loja_id, nome, descricao, ordem, canais, hora_inicio, hora_fim)
     VALUES ($1,$2,$3,$4,
       COALESCE($5,(SELECT COALESCE(MAX(ordem),0)+1 FROM food_categorias WHERE loja_id = $2)),
       COALESCE($6, ARRAY['mesa','balcao','delivery']), $7, $8) RETURNING *`,
    [negocioId, lojaId, input.nome, input.descricao ?? null, input.ordem ?? null,
     canais, input.hora_inicio || null, input.hora_fim || null]
  )).rows[0];
}

export async function upsertProduto(
  negocioId: string, lojaId: string,
  input: {
    id?: string; categoria_id: string; nome: string; descricao?: string | null;
    preco: number; preco_promo?: number | null; imagem_url?: string | null;
    area_id?: string | null; codigo?: string | null; serve_pessoas?: number | null;
    tempo_preparo?: number | null; permite_meia?: boolean; tem_variacao?: boolean;
    destaque?: boolean; canais?: string[]; ativo?: boolean; ordem?: number;
  }
): Promise<CardapioProduto> {
  const canais = input.canais?.length ? input.canais : null;
  if (input.id) {
    return (await query<CardapioProduto>(
      `UPDATE food_produtos
          SET categoria_id = $3, nome = $4, descricao = $5, preco = $6,
              preco_promo = $7, imagem_url = $8, area_id = $9,
              codigo = $10, serve_pessoas = $11, tempo_preparo = $12,
              permite_meia = COALESCE($13, permite_meia),
              tem_variacao = COALESCE($14, tem_variacao),
              destaque = COALESCE($15, destaque),
              canais = COALESCE($16, canais),
              ativo = COALESCE($17, ativo),
              ordem = COALESCE($18, ordem)
        WHERE id = $1 AND negocio_id = $2 RETURNING *`,
      [input.id, negocioId, input.categoria_id, input.nome, input.descricao ?? null,
       input.preco, input.preco_promo ?? null, input.imagem_url ?? null, input.area_id ?? null,
       input.codigo ?? null, input.serve_pessoas ?? null, input.tempo_preparo ?? null,
       input.permite_meia ?? null, input.tem_variacao ?? null, input.destaque ?? null,
       canais, input.ativo ?? null, input.ordem ?? null]
    )).rows[0];
  }
  return (await query<CardapioProduto>(
    `INSERT INTO food_produtos
       (negocio_id, loja_id, categoria_id, nome, descricao, preco, preco_promo, imagem_url,
        area_id, codigo, serve_pessoas, tempo_preparo, permite_meia, tem_variacao, destaque,
        canais, ordem)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
             COALESCE($13,false),COALESCE($14,false),COALESCE($15,false),
             COALESCE($16, ARRAY['mesa','balcao','delivery']),
             (SELECT COALESCE(MAX(ordem),0)+1 FROM food_produtos WHERE categoria_id = $3))
     RETURNING *`,
    [negocioId, lojaId, input.categoria_id, input.nome, input.descricao ?? null, input.preco,
     input.preco_promo ?? null, input.imagem_url ?? null, input.area_id ?? null,
     input.codigo ?? null, input.serve_pessoas ?? null, input.tempo_preparo ?? null,
     input.permite_meia ?? null, input.tem_variacao ?? null, input.destaque ?? null, canais]
  )).rows[0];
}

/** Um toque no rush: acabou a picanha, some do cardápio de todo mundo na hora. */
export async function setEsgotado(
  negocioId: string, produtoId: string, esgotado: boolean
): Promise<void> {
  await query(
    `UPDATE food_produtos
        SET esgotado = $3, esgotado_ate = CASE WHEN $3 THEN (now() + interval '12 hours') ELSE NULL END
      WHERE id = $1 AND negocio_id = $2`,
    [produtoId, negocioId, esgotado]
  );
}

export async function upsertVariacao(
  negocioId: string,
  input: { id?: string; produto_id: string; nome: string; preco: number; fatias?: number | null }
): Promise<FoodVariacao> {
  if (input.id) {
    return (await query<FoodVariacao>(
      `UPDATE food_variacoes SET nome = $3, preco = $4, fatias = $5
        WHERE id = $1 AND negocio_id = $2 RETURNING *`,
      [input.id, negocioId, input.nome, input.preco, input.fatias ?? null]
    )).rows[0];
  }
  return (await query<FoodVariacao>(
    `INSERT INTO food_variacoes (negocio_id, produto_id, nome, preco, fatias, ordem)
     VALUES ($1,$2,$3,$4,$5,(SELECT COALESCE(MAX(ordem),0)+1 FROM food_variacoes WHERE produto_id = $2))
     RETURNING *`,
    [negocioId, input.produto_id, input.nome, input.preco, input.fatias ?? null]
  )).rows[0];
}

export async function upsertGrupoOpcao(
  negocioId: string,
  input: { id?: string; produto_id: string; nome: string; minimo: number; maximo: number; obrigatorio: boolean }
): Promise<{ id: string }> {
  if (input.id) {
    return (await query<{ id: string }>(
      `UPDATE food_grupos_opcao SET nome = $3, minimo = $4, maximo = $5, obrigatorio = $6
        WHERE id = $1 AND negocio_id = $2 RETURNING id`,
      [input.id, negocioId, input.nome, input.minimo, input.maximo, input.obrigatorio]
    )).rows[0];
  }
  return (await query<{ id: string }>(
    `INSERT INTO food_grupos_opcao (negocio_id, produto_id, nome, minimo, maximo, obrigatorio, ordem)
     VALUES ($1,$2,$3,$4,$5,$6,(SELECT COALESCE(MAX(ordem),0)+1 FROM food_grupos_opcao WHERE produto_id = $2))
     RETURNING id`,
    [negocioId, input.produto_id, input.nome, input.minimo, input.maximo, input.obrigatorio]
  )).rows[0];
}

export async function upsertOpcao(
  negocioId: string,
  input: { id?: string; grupo_id: string; nome: string; preco_extra: number }
): Promise<FoodOpcao> {
  if (input.id) {
    return (await query<FoodOpcao>(
      `UPDATE food_opcoes SET nome = $3, preco_extra = $4
        WHERE id = $1 AND negocio_id = $2 RETURNING *`,
      [input.id, negocioId, input.nome, input.preco_extra]
    )).rows[0];
  }
  return (await query<FoodOpcao>(
    `INSERT INTO food_opcoes (negocio_id, grupo_id, nome, preco_extra, ordem)
     VALUES ($1,$2,$3,$4,(SELECT COALESCE(MAX(ordem),0)+1 FROM food_opcoes WHERE grupo_id = $2))
     RETURNING *`,
    [negocioId, input.grupo_id, input.nome, input.preco_extra]
  )).rows[0];
}

// ---------------------------------------------------------------------------
// SESSÃO DE MESA (comanda compartilhada)
// ---------------------------------------------------------------------------
export async function sessaoAtivaDaMesa(mesaId: string): Promise<FoodSessao | null> {
  return (await query<FoodSessao>(
    `SELECT * FROM food_sessoes
      WHERE mesa_id = $1 AND status IN ('aberta','conta_pedida','em_pagamento','paga')
      LIMIT 1`,
    [mesaId]
  )).rows[0] ?? null;
}

/**
 * Primeiro celular abre a mesa; os próximos entram na MESMA comanda.
 * Devolve a sessão e o id do membro (o celular).
 */
export async function entrarNaMesa(
  mesa: FoodMesa, deviceId: string, apelido?: string | null,
  opts: { permitirAbrir?: boolean } = {}
): Promise<{ sessao: FoodSessao; membroId: string; novaSessao: boolean }> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    // trava a mesa: duas pessoas encostando o celular ao mesmo tempo não criam 2 comandas
    await c.query("SELECT id FROM food_mesas WHERE id = $1 FOR UPDATE", [mesa.id]);
    let sessao = (await c.query<FoodSessao>(
      `SELECT * FROM food_sessoes
        WHERE mesa_id = $1 AND status IN ('aberta','conta_pedida','em_pagamento','paga') LIMIT 1`,
      [mesa.id]
    )).rows[0];
    const novaSessao = !sessao;
    if (!sessao && opts.permitirAbrir === false) {
      // Ninguem abre comanda na madrugada a partir de uma URL guardada. Entrar
      // numa comanda que JA existe continua liberado: e o segundo celular da
      // mesa chegando, e a casa esta aberta de qualquer jeito.
      await c.query("ROLLBACK");
      throw new ErroKds("CASA_FECHADA", "A casa esta fechada agora.");
    }
    if (!sessao) {
      sessao = (await c.query<FoodSessao>(
        `INSERT INTO food_sessoes (negocio_id, loja_id, mesa_id, codigo) VALUES ($1,$2,$3,$4) RETURNING *`,
        [mesa.negocio_id, mesa.loja_id, mesa.id, codigoCurto()]
      )).rows[0];
    }
    const membro = (await c.query<{ id: string }>(
      `INSERT INTO food_sessao_membros (negocio_id, sessao_id, device_id, apelido)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (sessao_id, device_id)
       DO UPDATE SET apelido = COALESCE(EXCLUDED.apelido, food_sessao_membros.apelido)
       RETURNING id`,
      [mesa.negocio_id, sessao.id, deviceId, apelido ?? null]
    )).rows[0];
    await c.query("COMMIT");
    return { sessao, membroId: membro.id, novaSessao };
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}

/** Tudo que a mesa consumiu, para a tela do cliente e para a conta. */
export async function resumoSessao(sessaoId: string): Promise<{
  sessao: FoodSessao | null;
  pedidos: PedidoComItens[];
  pagamentos: { id: string; metodo: string; valor: string; gorjeta: string; status: string; pago_por: string | null }[];
  membros: { id: string; apelido: string | null; device_id: string }[];
}> {
  const sessao = (await query<FoodSessao>("SELECT * FROM food_sessoes WHERE id = $1", [sessaoId])).rows[0] ?? null;
  if (!sessao) return { sessao: null, pedidos: [], pagamentos: [], membros: [] };
  const pedidos = (await query<PedidoComItens>(
    "SELECT * FROM food_pedidos WHERE sessao_id = $1 AND status <> 'cancelado' ORDER BY criado_em",
    [sessaoId]
  )).rows;
  const itens = pedidos.length
    ? (await query<FoodItem>(
        "SELECT * FROM food_itens WHERE pedido_id = ANY($1) AND status <> 'cancelado' ORDER BY criado_em",
        [pedidos.map((p) => p.id)]
      )).rows
    : [];
  for (const p of pedidos) p.itens = itens.filter((i) => i.pedido_id === p.id);
  const pagamentos = (await query<{ id: string; metodo: string; valor: string; gorjeta: string; status: string; pago_por: string | null }>(
    "SELECT id, metodo, valor, gorjeta, status, pago_por FROM food_pagamentos WHERE sessao_id = $1 ORDER BY criado_em",
    [sessaoId]
  )).rows;
  const membros = (await query<{ id: string; apelido: string | null; device_id: string }>(
    "SELECT id, apelido, device_id FROM food_sessao_membros WHERE sessao_id = $1 ORDER BY entrou_em",
    [sessaoId]
  )).rows;
  return { sessao, pedidos, pagamentos, membros };
}

/** Recalcula subtotal, serviço, couvert e total. Chamado dentro da transação. */
async function recalcularSessao(c: PoolClient, sessaoId: string): Promise<void> {
  await c.query(
    `WITH soma AS (
       SELECT COALESCE(SUM(i.preco_total),0) AS sub
         FROM food_itens i JOIN food_pedidos p ON p.id = i.pedido_id
        WHERE p.sessao_id = $1 AND p.status <> 'cancelado' AND i.status <> 'cancelado'
     ), pago AS (
       SELECT COALESCE(SUM(valor + gorjeta),0) AS pg
         FROM food_pagamentos WHERE sessao_id = $1 AND status = 'confirmado'
     )
     UPDATE food_sessoes s
        SET subtotal = soma.sub,
            couvert_total = l.couvert * s.pessoas,
            -- taxa recusada pelo cliente vale ZERO. A Lei 13.419/2017 trata a
            -- gorjeta como voluntaria, e o artigo 39 do CDC proibe pressionar.
            taxa_servico = CASE
                             WHEN s.servico_recusado THEN 0
                             WHEN l.taxa_servico_automatica
                               THEN ROUND(soma.sub * l.taxa_servico_pct / 100, 2)
                             ELSE s.taxa_servico END,
            total = soma.sub
                    + (l.couvert * s.pessoas)
                    + CASE
                        WHEN s.servico_recusado THEN 0
                        WHEN l.taxa_servico_automatica
                          THEN ROUND(soma.sub * l.taxa_servico_pct / 100, 2)
                        ELSE s.taxa_servico END
                    - s.desconto,
            pago = pago.pg
       FROM soma, pago, food_lojas l
      WHERE s.id = $1 AND l.id = s.loja_id`,
    [sessaoId]
  );
}

/** A mesma recalculacao, para quem mexe na conta de fora (lib/food-conta.ts). */
export async function recalcularSessaoPublico(c: PoolClient, sessaoId: string): Promise<void> {
  await recalcularSessao(c, sessaoId);
}

export async function pedirConta(negocioId: string, sessaoId: string): Promise<void> {
  // Passa pela maquina de estados: a transicao fica registrada com autor.
  // Se a comanda ja estava adiante (em pagamento, paga), segue o baile.
  const cx = await pool.connect();
  try {
    await moverSessao(cx as unknown as ClienteSQL, {
      negocioId, sessaoId, para: "conta_pedida",
      ator: { tipo: "cliente", nome: "mesa", origem: "celular do cliente" },
    });
  } catch (e) {
    if (!(e instanceof ErroKds)) throw e;
  } finally {
    cx.release();
  }
  const s = (await query<{ loja_id: string; mesa_id: string }>(
    "SELECT loja_id, mesa_id FROM food_sessoes WHERE id = $1 AND negocio_id = $2",
    [sessaoId, negocioId]
  )).rows[0];
  if (s) {
    await query(
      `INSERT INTO food_chamados (negocio_id, loja_id, mesa_id, sessao_id, tipo)
       VALUES ($1,$2,$3,$4,'conta')`,
      [negocioId, s.loja_id, s.mesa_id, sessaoId]
    );
  }
}

/**
 * Fecha a comanda pela maquina de estados: em_pagamento -> paga -> fechada.
 * Fechar com saldo em aberto continua possivel (o garcom recebeu na
 * maquininha), mas exige motivo e fica gravado com o valor que faltou.
 */
export async function fecharSessao(
  negocioId: string, sessaoId: string, por: string, motivo?: string | null
): Promise<void> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await recalcularSessao(c, sessaoId);
    const cli = c as unknown as ClienteSQL;
    const ator = { tipo: "garcom" as const, nome: por, origem: "fechamento de conta" };
    for (const passo of ["em_pagamento", "paga", "fechada"] as const) {
      try {
        await moverSessao(cli, {
          negocioId, sessaoId, para: passo, ator,
          motivo: passo === "fechada" ? (motivo ?? null) : null,
          semTransacao: true,
        });
      } catch (e) {
        if (!(e instanceof ErroKds)) throw e;
        // conta em aberto: pula o degrau "paga" e fecha com motivo
        if (e.codigo === "CONTA_EM_ABERTO" || e.codigo === "TRANSICAO_INVALIDA") continue;
        await c.query("ROLLBACK");
        throw e;
      }
    }
    // A mesa pagou e foi embora: nada dela continua na fila da cozinha. Sem
    // isto, o item ficava pendente para sempre e a tela da cozinha enchia de
    // fantasma de comanda fechada.
    await c.query(
      `INSERT INTO food_item_eventos
         (negocio_id, loja_id, item_id, pedido_id, de, para, ator_tipo, ator_nome, motivo)
       SELECT i.negocio_id, p.loja_id, i.id, p.id, i.status, 'entregue', 'sistema', $3,
              'conta fechada'
         FROM food_itens i JOIN food_pedidos p ON p.id = i.pedido_id
        WHERE p.sessao_id = $1 AND i.negocio_id = $2
          AND i.status IN ('pendente','em_producao','pronto')`,
      [sessaoId, negocioId, por]
    );
    await c.query(
      `UPDATE food_itens i
          SET status = 'entregue', entregue_em = now(), atualizado_em = now()
         FROM food_pedidos p
        WHERE p.id = i.pedido_id AND p.sessao_id = $1 AND i.negocio_id = $2
          AND i.status IN ('pendente','em_producao','pronto')`,
      [sessaoId, negocioId]
    );
    await c.query(
      `UPDATE food_pedidos SET status = 'entregue', entregue_em = COALESCE(entregue_em, now()),
                               pago_em = COALESCE(pago_em, now())
        WHERE sessao_id = $1 AND negocio_id = $2 AND status NOT IN ('cancelado')`,
      [sessaoId, negocioId]
    );
    await c.query(
      `UPDATE food_chamados SET status = 'atendido', atendido_em = now()
        WHERE sessao_id = $1 AND negocio_id = $2 AND status = 'aberto'`,
      [sessaoId, negocioId]
    );
    await c.query(
      `INSERT INTO food_eventos (negocio_id, loja_id, tipo, sessao_id, payload)
       SELECT $1, loja_id, 'conta_paga', id, jsonb_build_object('total', total) FROM food_sessoes WHERE id = $2`,
      [negocioId, sessaoId]
    );
    // O valor da nota fica gravado na fila junto com a comanda: se o dono
    // mexer na conta depois, a nota ja saiu com o numero certo.
    await c.query(
      `UPDATE food_fiscal_fila f SET valor = s.total
         FROM food_sessoes s WHERE s.id = f.sessao_id AND f.sessao_id = $1`,
      [sessaoId]
    );
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }

  // A nota entra na fila DEPOIS do commit, e falhar aqui nao desfaz a venda.
  // SEFAZ fora do ar nao pode segurar a mesa: a fila insiste sozinha.
  try {
    const l = (await query<{ loja_id: string }>(
      "SELECT loja_id FROM food_sessoes WHERE id = $1", [sessaoId]
    )).rows[0];
    if (l) await enfileirarNota(negocioId, l.loja_id, sessaoId);
  } catch { /* a fila fiscal nunca derruba o fechamento da conta */ }
}

// ---------------------------------------------------------------------------
// PEDIDOS
// ---------------------------------------------------------------------------
export interface NovoPedido {
  negocioId: string;
  lojaId: string;
  canal: CanalPedido;
  itens: ItemEntrada[];
  sessaoId?: string | null;
  mesaId?: string | null;
  membroId?: string | null;
  clienteId?: string | null;
  garcomId?: string | null;
  obs?: string | null;
  deviceId?: string | null;
  ip?: string | null;
  entrega?: Record<string, unknown> | null;
  taxaEntrega?: number;
  /**
   * Chave de idempotencia do carrinho. 3G ruim no salao: o pedido chega, a
   * resposta se perde, o cliente aperta de novo. Com a chave, o segundo envio
   * devolve o MESMO pedido em vez de mandar duas picanhas para a cozinha.
   */
  chave?: string | null;
}

/**
 * Cria o pedido. O PREÇO VEM DO BANCO, nunca do cliente: o navegador só manda
 * ids e quantidade. Em uma transação: numera, insere, atualiza a comanda,
 * enfileira a impressão, baixa o estoque e registra o evento.
 */
export async function criarPedido(input: NovoPedido): Promise<PedidoComItens> {
  const { negocioId, lojaId, canal } = input;
  if (!input.itens?.length) throw new Error("Pedido sem itens");

  // Antes de qualquer coisa: ja agimos com esta chave? Entao e reenvio.
  if (input.chave) {
    const ja = await pedidoPorChave(negocioId, lojaId, input.chave);
    if (ja) return ja;
  }

  const c = await pool.connect();
  try {
    await c.query("BEGIN");

    const loja = (await c.query<FoodLoja>(
      "SELECT * FROM food_lojas WHERE id = $1 AND negocio_id = $2",
      [lojaId, negocioId]
    )).rows[0];
    if (!loja) throw new Error("Loja não encontrada");

    // ---- preços reais do banco
    const prodIds = [...new Set(input.itens.map((i) => i.produto_id))];
    const produtos = (await c.query<{
      id: string; nome: string; preco: string; preco_promo: string | null;
      area_id: string | null; esgotado: boolean; ativo: boolean; loja_id: string;
    }>(
      "SELECT id, nome, preco, preco_promo, area_id, esgotado, ativo, loja_id FROM food_produtos WHERE id = ANY($1)",
      [prodIds]
    )).rows;

    const varIds = input.itens.map((i) => i.variacao_id).filter(Boolean) as string[];
    const variacoes = varIds.length
      ? (await c.query<{ id: string; produto_id: string; nome: string; preco: string }>(
          "SELECT id, produto_id, nome, preco FROM food_variacoes WHERE id = ANY($1)",
          [varIds]
        )).rows
      : [];

    const opcIds = input.itens.flatMap((i) => i.opcoes ?? []);
    const opcoes = opcIds.length
      ? (await c.query<{
          id: string; nome: string; preco_extra: string; grupo_id: string;
          grupo_nome: string; grupo_produto: string; esgotada: boolean;
        }>(
          `SELECT o.id, o.nome, o.preco_extra, o.grupo_id, g.nome AS grupo_nome,
                  g.produto_id AS grupo_produto, o.esgotado AS esgotada
             FROM food_opcoes o JOIN food_grupos_opcao g ON g.id = o.grupo_id
            WHERE o.id = ANY($1) AND o.ativa = true`,
          [opcIds]
        )).rows
      : [];

    // As REGRAS do cardapio (obrigatorio, minimo, maximo, forma de somar) viviam
    // so no navegador. Quem chamasse a API por fora mandava churrasco sem o
    // ponto da carne, ou trinta adicionais num grupo de maximo 1, ou grudava o
    // adicional de OUTRO produto (inclusive de outro restaurante). Agora valem
    // aqui, na mesma transacao em que o preco vem do banco.
    const grupos = prodIds.length
      ? (await c.query<{
          id: string; produto_id: string; nome: string;
          minimo: number; maximo: number; obrigatorio: boolean; tipo_preco: string;
        }>(
          `SELECT id, produto_id, nome, minimo, maximo, obrigatorio, tipo_preco
             FROM food_grupos_opcao WHERE produto_id = ANY($1)`,
          [prodIds]
        )).rows
      : [];

    // ---- monta os itens já com preço calculado no servidor
    let subtotal = 0;
    const linhas: {
      produto_id: string; variacao_id: string | null; area_id: string | null;
      nome: string; qtd: number; unit: number; total: number;
      opcoes: { grupo: string; nome: string; preco: number }[];
      obs: string | null; restricao: string | null;
    }[] = [];

    for (const it of input.itens) {
      const p = produtos.find((x) => x.id === it.produto_id);
      if (!p || !p.ativo || p.loja_id !== lojaId) throw new Error("Produto indisponível");
      if (p.esgotado) throw new Error(`${p.nome} está esgotado`);
      const v = it.variacao_id ? variacoes.find((x) => x.id === it.variacao_id && x.produto_id === p.id) : null;
      if (it.variacao_id && !v) throw new Error("Tamanho inválido");

      const base = v ? n(v.preco) : (p.preco_promo != null ? n(p.preco_promo) : n(p.preco));

      const pedidas = it.opcoes ?? [];
      const escolhidas = pedidas
        .map((oid) => opcoes.find((o) => o.id === oid))
        .filter(Boolean) as typeof opcoes;
      if (escolhidas.length !== pedidas.length) throw new Error("Opcao indisponivel");

      // obrigatorio, minimo, maximo, opcao de outro produto e a forma de somar
      // (soma, maior, media) ficam em lib/food-regras.ts, que e testado sozinho
      const extra = extraDoItem(p, grupos, escolhidas);
      const qtd = Math.max(1, Math.min(99, Number(it.qtd) || 1));
      const unit = base + extra;
      const total = Math.round(unit * qtd * 100) / 100;
      subtotal += total;
      linhas.push({
        produto_id: p.id,
        variacao_id: v?.id ?? null,
        area_id: p.area_id,
        nome: v ? `${p.nome} (${v.nome})` : p.nome,
        qtd, unit, total,
        opcoes: escolhidas.map((o) => ({ grupo: o.grupo_nome, nome: o.nome, preco: n(o.preco_extra) })),
        obs: it.obs ?? null,
        // alergia nao e observacao comum: vai em campo proprio e sai destacada
        // no cartao da cozinha e na comanda impressa
        restricao: typeof it.restricao === "string" ? it.restricao.slice(0, 200) : null,
      });
    }

    // ---- limite anti abuso na mesa
    if (canal === "mesa" && n(loja.limite_sessao_sem_aprov) > 0 && input.sessaoId) {
      const atual = n((await c.query<{ subtotal: string }>(
        "SELECT subtotal FROM food_sessoes WHERE id = $1", [input.sessaoId]
      )).rows[0]?.subtotal);
      if (atual + subtotal > n(loja.limite_sessao_sem_aprov) && !input.garcomId) {
        throw new Error("LIMITE_SESSAO");
      }
    }

    // ---- número do dia (contador por loja)
    // O dia e o da CASA, no fuso da loja. Com CURRENT_DATE (UTC) o contador
    // virava as 21h de Xanxere, no meio do jantar de sabado.
    const numero = (await c.query<{ ultimo: number }>(
      `INSERT INTO food_contadores (loja_id, dia, ultimo)
       VALUES ($1, food_dia_loja($1), 1)
       ON CONFLICT (loja_id, dia) DO UPDATE SET ultimo = food_contadores.ultimo + 1
       RETURNING ultimo`,
      [lojaId]
    )).rows[0].ultimo;

    // Pedido do garçom entra aprovado. O do celular na mesa respeita a regra da
    // loja. O de delivery SEMPRE espera a loja aceitar: endereço e tempo têm que
    // ser conferidos antes de a cozinha começar.
    const precisaAprovar =
      (canal === "mesa" && loja.exige_aprovacao_garcom && !input.garcomId) ||
      canal === "delivery" ||
      canal === "whatsapp";
    const status: StatusPedido = precisaAprovar ? "pendente" : "aprovado";
    const taxaEntrega = canal === "delivery" ? (input.taxaEntrega ?? 0) : 0;
    const total = Math.round((subtotal + taxaEntrega) * 100) / 100;

    const pedido = (await c.query<FoodPedido>(
      `INSERT INTO food_pedidos
         (negocio_id, loja_id, numero_dia, dia, canal, sessao_id, mesa_id, cliente_id, garcom_id,
          status, origem_device, origem_ip, obs, subtotal, taxa_entrega, total, entrega_json,
          chave_idem, aprovado_em)
       VALUES ($1,$2,$3,food_dia_loja($2),$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
               CASE WHEN $9 = 'aprovado' THEN now() ELSE NULL END)
       RETURNING *`,
      [negocioId, lojaId, numero, canal, input.sessaoId ?? null, input.mesaId ?? null,
       input.clienteId ?? null, input.garcomId ?? null, status, input.deviceId ?? null,
       input.ip ?? null, input.obs ?? null, brl(subtotal), brl(taxaEntrega), brl(total),
       input.entrega ? JSON.stringify(input.entrega) : null, input.chave ?? null]
    )).rows[0];

    for (const l of linhas) {
      await c.query(
        `INSERT INTO food_itens
           (negocio_id, pedido_id, produto_id, variacao_id, area_id, nome_snapshot, qtd,
            preco_unit, preco_total, opcoes_json, obs, restricao, membro_id, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [negocioId, pedido.id, l.produto_id, l.variacao_id, l.area_id, l.nome, l.qtd,
         brl(l.unit), brl(l.total), JSON.stringify(l.opcoes), l.obs, l.restricao,
         input.membroId ?? null, "pendente"]
      );
    }

    if (input.sessaoId) await recalcularSessao(c, input.sessaoId);

    if (!precisaAprovar) {
      await enfileirarComanda(c, negocioId, pedido.id);
      await baixarEstoque(c, negocioId, pedido.id);
    }

    await c.query(
      `INSERT INTO food_eventos (negocio_id, loja_id, tipo, pedido_id, sessao_id, cliente_id, payload)
       VALUES ($1,$2,'pedido_criado',$3,$4,$5,$6)`,
      [negocioId, lojaId, pedido.id, input.sessaoId ?? null, input.clienteId ?? null,
       JSON.stringify({ numero, canal, total })]
    );

    await c.query("COMMIT");
    const itens = (await query<FoodItem>(
      "SELECT * FROM food_itens WHERE pedido_id = $1 ORDER BY criado_em", [pedido.id]
    )).rows;
    return { ...pedido, itens };
  } catch (e) {
    await c.query("ROLLBACK");
    // Dois envios ao mesmo tempo com a mesma chave: um grava, o outro bate no
    // indice unico. O que bateu devolve o pedido do primeiro, nao um erro.
    if (input.chave && e instanceof Error && /chave/i.test(String((e as { constraint?: string }).constraint ?? e.message))) {
      const ja = await pedidoPorChave(negocioId, lojaId, input.chave);
      if (ja) return ja;
    }
    throw e;
  } finally {
    c.release();
  }
}

/** O pedido que ja nasceu desta chave de idempotencia, com os itens. */
async function pedidoPorChave(
  negocioId: string, lojaId: string, chave: string
): Promise<PedidoComItens | null> {
  const p = (await query<PedidoComItens>(
    `SELECT * FROM food_pedidos
      WHERE negocio_id = $1 AND loja_id = $2 AND chave_idem = $3`,
    [negocioId, lojaId, chave]
  )).rows[0];
  if (!p) return null;
  p.itens = (await query<FoodItem>(
    "SELECT * FROM food_itens WHERE pedido_id = $1 ORDER BY criado_em", [p.id]
  )).rows;
  return p;
}

export async function listPedidos(
  negocioId: string, lojaId: string,
  filtro: { status?: StatusPedido[]; canal?: CanalPedido; hoje?: boolean; limite?: number } = {}
): Promise<PedidoComItens[]> {
  const cond: string[] = ["p.negocio_id = $1", "p.loja_id = $2"];
  const params: unknown[] = [negocioId, lojaId];
  if (filtro.status?.length) { params.push(filtro.status); cond.push(`p.status = ANY($${params.length})`); }
  if (filtro.canal) { params.push(filtro.canal); cond.push(`p.canal = $${params.length}`); }
  if (filtro.hoje) cond.push("p.dia = food_dia_loja(p.loja_id)");
  params.push(filtro.limite ?? 200);

  const pedidos = (await query<PedidoComItens>(
    `SELECT p.*, m.numero AS mesa_numero
       FROM food_pedidos p LEFT JOIN food_mesas m ON m.id = p.mesa_id
      WHERE ${cond.join(" AND ")}
      ORDER BY p.criado_em DESC
      LIMIT $${params.length}`,
    params
  )).rows;
  if (!pedidos.length) return [];
  const itens = (await query<FoodItem>(
    "SELECT * FROM food_itens WHERE pedido_id = ANY($1) ORDER BY criado_em",
    [pedidos.map((p) => p.id)]
  )).rows;
  for (const p of pedidos) p.itens = itens.filter((i) => i.pedido_id === p.id);
  return pedidos;
}

export async function getPedido(negocioId: string, pedidoId: string): Promise<PedidoComItens | null> {
  const p = (await query<PedidoComItens>(
    `SELECT p.*, m.numero AS mesa_numero
       FROM food_pedidos p LEFT JOIN food_mesas m ON m.id = p.mesa_id
      WHERE p.id = $1 AND p.negocio_id = $2`,
    [pedidoId, negocioId]
  )).rows[0];
  if (!p) return null;
  p.itens = (await query<FoodItem>(
    "SELECT * FROM food_itens WHERE pedido_id = $1 ORDER BY criado_em", [pedidoId]
  )).rows;
  return p;
}

/** Aprovar libera para a cozinha: imprime a comanda e baixa o estoque. */
export async function aprovarPedido(negocioId: string, pedidoId: string, garcomId?: string): Promise<void> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const r = await c.query<FoodPedido>(
      `UPDATE food_pedidos SET status = 'aprovado', aprovado_em = now(), garcom_id = COALESCE($3, garcom_id)
        WHERE id = $1 AND negocio_id = $2 AND status = 'pendente' RETURNING *`,
      [pedidoId, negocioId, garcomId ?? null]
    );
    if (r.rows[0]) {
      await enfileirarComanda(c, negocioId, pedidoId);
      await baixarEstoque(c, negocioId, pedidoId);
    }
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}

/**
 * Muda o status do PEDIDO. Agora validado: `entregue` nao volta para
 * `pendente` e pedido cancelado nao ressuscita. Quem manda no dia a dia da
 * cozinha e o ITEM (lib/food-kds-sql.ts); isto aqui e para o que nao vem do
 * item: aprovar, despachar e cancelar a rodada inteira.
 */
export async function mudarStatusPedido(
  negocioId: string, pedidoId: string, status: StatusPedido, motivo?: string
): Promise<void> {
  const atual = (await query<{ status: EstadoPedido }>(
    "SELECT status FROM food_pedidos WHERE id = $1 AND negocio_id = $2",
    [pedidoId, negocioId]
  )).rows[0];
  if (!atual) throw new ErroKds("PEDIDO_NAO_ENCONTRADO", "Pedido nao encontrado nesta casa.");
  if (atual.status === status) return;                       // idempotente
  if (!podePedido(atual.status, status as EstadoPedido)) {
    throw new ErroKds("TRANSICAO_INVALIDA",
      `Pedido ${atual.status} nao vai para ${status}.`, `${atual.status} -> ${status}`);
  }
  if (status === "cancelado" && !String(motivo ?? "").trim()) {
    throw new ErroKds("MOTIVO_OBRIGATORIO", "Cancelar o pedido exige motivo.");
  }
  const campos: Record<StatusPedido, string> = {
    pendente: "", aprovado: "aprovado_em = now(),", em_producao: "producao_em = now(),",
    pronto: "pronto_em = now(),", em_entrega: "saiu_entrega_em = now(),",
    entregue: "entregue_em = now(),",
    cancelado: "cancelado_em = now(), cancelado_motivo = $4,",
  };
  const extra = campos[status] || "";
  const params: unknown[] = [pedidoId, negocioId, status];
  if (status === "cancelado") params.push(motivo ?? null);
  await query(
    `UPDATE food_pedidos SET ${extra} status = $3 WHERE id = $1 AND negocio_id = $2`,
    params
  );
  if (status === "cancelado") {
    await query(
      `INSERT INTO food_item_eventos (negocio_id, loja_id, item_id, pedido_id, de, para, ator_tipo, motivo)
       SELECT i.negocio_id, p.loja_id, i.id, p.id, i.status, 'cancelado', 'painel', $2
         FROM food_itens i JOIN food_pedidos p ON p.id = i.pedido_id
        WHERE i.pedido_id = $1 AND i.status <> 'cancelado'`,
      [pedidoId, motivo ?? "pedido cancelado"]
    );
    await query(
      `UPDATE food_itens
          SET status = 'cancelado', cancelado_em = now(), cancelado_motivo = $2,
              atualizado_em = now()
        WHERE pedido_id = $1 AND negocio_id = $3 AND status <> 'cancelado'`,
      [pedidoId, motivo ?? "pedido cancelado", negocioId]
    );
    const s = (await query<{ sessao_id: string | null }>(
      "SELECT sessao_id FROM food_pedidos WHERE id = $1", [pedidoId]
    )).rows[0];
    if (s?.sessao_id) {
      const c = await pool.connect();
      try { await recalcularSessao(c, s.sessao_id); } finally { c.release(); }
    }
  }
  if (status === "pronto" || status === "entregue") {
    await query(
      `INSERT INTO food_eventos (negocio_id, loja_id, tipo, pedido_id, cliente_id)
       SELECT negocio_id, loja_id, $2, id, cliente_id FROM food_pedidos WHERE id = $1`,
      [pedidoId, status === "pronto" ? "pedido_pronto" : "pedido_entregue"]
    );
  }
}

// ---------------------------------------------------------------------------
// KDS — a tela da cozinha
// ---------------------------------------------------------------------------
export async function itensDaCozinha(
  negocioId: string, lojaId: string, areaId?: string | null
): Promise<(FoodItem & {
  pedido_numero: number; canal: CanalPedido; mesa_numero: string | null; pedido_criado_em: string;
})[]> {
  const params: unknown[] = [negocioId, lojaId];
  let filtroArea = "";
  if (areaId) { params.push(areaId); filtroArea = `AND i.area_id = $${params.length}`; }
  return (await query<FoodItem & {
    pedido_numero: number; canal: CanalPedido; mesa_numero: string | null; pedido_criado_em: string;
  }>(
    `SELECT i.*, p.numero_dia AS pedido_numero, p.canal, p.criado_em AS pedido_criado_em,
            m.numero AS mesa_numero
       FROM food_itens i
       JOIN food_pedidos p ON p.id = i.pedido_id
       LEFT JOIN food_mesas m ON m.id = p.mesa_id
      WHERE i.negocio_id = $1 AND p.loja_id = $2 ${filtroArea}
        AND p.status IN ('aprovado','em_producao','pronto')
        AND i.status IN ('pendente','em_producao','pronto')
      ORDER BY p.criado_em ASC, i.criado_em ASC`,
    params
  )).rows;
}

// mudarStatusItem saiu daqui de proposito. Toda transicao de item passa por
// `moverItem()` de lib/food-kds-sql.ts, que valida, e idempotente e grava quem
// fez, quando e de onde. Nao crie outro caminho.

// ---------------------------------------------------------------------------
// CHAMADOS (chamar garçom / pedir a conta)
// ---------------------------------------------------------------------------
export async function criarChamado(
  negocioId: string, lojaId: string, mesaId: string, sessaoId: string | null,
  tipo: "garcom" | "conta" | "ajuda", obs?: string
): Promise<void> {
  await query(
    `INSERT INTO food_chamados (negocio_id, loja_id, mesa_id, sessao_id, tipo, obs)
     SELECT $1,$2,$3,$4,$5,$6
      WHERE NOT EXISTS (SELECT 1 FROM food_chamados
                         WHERE mesa_id = $3 AND tipo = $5 AND status = 'aberto')`,
    [negocioId, lojaId, mesaId, sessaoId, tipo, obs ?? null]
  );
  await query(
    `INSERT INTO food_eventos (negocio_id, loja_id, tipo, sessao_id) VALUES ($1,$2,'chamou_garcom',$3)`,
    [negocioId, lojaId, sessaoId]
  );
}

export async function listChamados(negocioId: string, lojaId: string) {
  return (await query<{ id: string; tipo: string; obs: string | null; criado_em: string; mesa_numero: string }>(
    `SELECT c.id, c.tipo, c.obs, c.criado_em, m.numero AS mesa_numero
       FROM food_chamados c JOIN food_mesas m ON m.id = c.mesa_id
      WHERE c.negocio_id = $1 AND c.loja_id = $2 AND c.status = 'aberto'
      ORDER BY c.criado_em`,
    [negocioId, lojaId]
  )).rows;
}

export async function atenderChamado(negocioId: string, chamadoId: string): Promise<void> {
  await query(
    "UPDATE food_chamados SET status = 'atendido', atendido_em = now() WHERE id = $1 AND negocio_id = $2",
    [chamadoId, negocioId]
  );
}

// ---------------------------------------------------------------------------
// PAGAMENTOS
// ---------------------------------------------------------------------------
export async function registrarPagamento(
  negocioId: string,
  input: {
    lojaId: string; sessaoId?: string | null; pedidoId?: string | null;
    metodo: MetodoPagamento; valor: number; gorjeta?: number;
    pagoPor?: string | null; membroId?: string | null; recebidoPor?: string | null;
    status?: "pendente" | "confirmado"; psp?: string | null; pspId?: string | null;
    /** divisao por item: quais itens este pagamento quita */
    itens?: { id: string; valor: number }[];
  }
): Promise<{ id: string }> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const caixa = (await c.query<{ id: string }>(
      "SELECT id FROM food_caixas WHERE loja_id = $1 AND status = 'aberto' ORDER BY aberto_em DESC LIMIT 1",
      [input.lojaId]
    )).rows[0];
    const pg = (await c.query<{ id: string }>(
      `INSERT INTO food_pagamentos
         (negocio_id, loja_id, sessao_id, pedido_id, caixa_id, metodo, valor, gorjeta,
          status, psp, psp_id, pago_por, membro_id, recebido_por, confirmado_em)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
               CASE WHEN $9 = 'confirmado' THEN now() ELSE NULL END)
       RETURNING id`,
      [negocioId, input.lojaId, input.sessaoId ?? null, input.pedidoId ?? null, caixa?.id ?? null,
       input.metodo, brl(input.valor), brl(input.gorjeta ?? 0), input.status ?? "confirmado",
       input.psp ?? null, input.pspId ?? null, input.pagoPor ?? null, input.membroId ?? null,
       input.recebidoPor ?? null]
    )).rows[0];
    if (input.itens?.length) {
      for (const it of input.itens) {
        await c.query(
          `INSERT INTO food_pagamento_itens (pagamento_id, item_id, valor)
           VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
          [pg.id, it.id, brl(it.valor)]
        );
      }
    }
    if (input.sessaoId) {
      await recalcularSessao(c, input.sessaoId);
      // conta coberta vira `paga` sozinha, e isso fica registrado
      if ((input.status ?? "confirmado") === "confirmado") {
        await acertarSessaoAposPagamento(c as unknown as ClienteSQL, negocioId, input.sessaoId, {
          tipo: input.recebidoPor ? "garcom" : "cliente",
          id: input.recebidoPor ?? null,
          nome: input.pagoPor ?? null,
          origem: `pagamento ${input.metodo}`,
        });
      }
    }
    if (input.pedidoId && (input.status ?? "confirmado") === "confirmado") {
      await c.query("UPDATE food_pedidos SET pago_em = now() WHERE id = $1", [input.pedidoId]);
    }
    await c.query("COMMIT");
    return pg;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}

/** Confirmação vinda do webhook do PSP (Pix). Idempotente pelo par (psp, psp_id). */
export async function confirmarPagamentoPSP(psp: string, pspId: string): Promise<void> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const r = await c.query<{ id: string; sessao_id: string | null; pedido_id: string | null }>(
      `UPDATE food_pagamentos SET status = 'confirmado', confirmado_em = now()
        WHERE psp = $1 AND psp_id = $2 AND status = 'pendente'
        RETURNING id, sessao_id, pedido_id`,
      [psp, pspId]
    );
    const pg = r.rows[0];
    if (pg?.sessao_id) {
      await recalcularSessao(c, pg.sessao_id);
      const dono = (await c.query<{ negocio_id: string }>(
        "SELECT negocio_id FROM food_sessoes WHERE id = $1", [pg.sessao_id]
      )).rows[0];
      if (dono) {
        await acertarSessaoAposPagamento(c as unknown as ClienteSQL, dono.negocio_id, pg.sessao_id, {
          tipo: "cliente", nome: "Pix no celular", origem: `webhook ${psp}`,
        });
      }
    }
    if (pg?.pedido_id) await c.query("UPDATE food_pedidos SET pago_em = now() WHERE id = $1", [pg.pedido_id]);
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}

// ---------------------------------------------------------------------------
// CAIXA
// ---------------------------------------------------------------------------
export async function abrirCaixa(negocioId: string, lojaId: string, saldoInicial: number, por?: string) {
  return (await query<{ id: string }>(
    `INSERT INTO food_caixas (negocio_id, loja_id, saldo_inicial, aberto_por)
     VALUES ($1,$2,$3,$4) RETURNING id`,
    [negocioId, lojaId, brl(saldoInicial), por ?? null]
  )).rows[0];
}

export async function fecharCaixa(negocioId: string, caixaId: string, saldoFinal: number) {
  await query(
    `UPDATE food_caixas SET status = 'fechado', fechado_em = now(), saldo_final = $3,
            diferenca = $3 - (saldo_inicial
              + COALESCE((SELECT SUM(valor + gorjeta) FROM food_pagamentos
                           WHERE caixa_id = food_caixas.id AND metodo = 'dinheiro' AND status = 'confirmado'),0)
              + COALESCE((SELECT SUM(CASE WHEN tipo = 'suprimento' THEN valor
                                          WHEN tipo = 'sangria' THEN -valor ELSE valor END)
                            FROM food_caixa_mov WHERE caixa_id = food_caixas.id),0))
      WHERE id = $1 AND negocio_id = $2`,
    [caixaId, negocioId, brl(saldoFinal)]
  );
}

// ---------------------------------------------------------------------------
// IMPRESSÃO — a fila que a impressora consulta (CloudPRNT) ou o agente local puxa.
// ---------------------------------------------------------------------------
function linha(char = "-", cols = 48): string { return char.repeat(cols); }
function duasColunas(esq: string, dir: string, cols = 48): string {
  const espaco = Math.max(1, cols - esq.length - dir.length);
  return esq + " ".repeat(espaco) + dir;
}

/** Texto da comanda da cozinha, já quebrado na largura da impressora. */
export function montarComanda(
  p: { numero_dia: number; canal: string; criado_em: string | Date; obs: string | null },
  itens: {
    qtd: string | number; nome_snapshot: string; opcoes_json: { nome: string }[] | null;
    obs: string | null; restricao?: string | null; alergenicos?: string[] | null;
  }[],
  ctx: { loja: string; mesa?: string | null; area?: string | null; cols?: number }
): string {
  const cols = ctx.cols ?? 48;
  const hora = new Date(p.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const out: string[] = [];
  out.push(ctx.loja.toUpperCase());
  if (ctx.area) out.push(`SETOR: ${ctx.area.toUpperCase()}`);
  out.push(linha("=", cols));
  out.push(duasColunas(`PEDIDO #${p.numero_dia}`, hora, cols));
  out.push(p.canal === "mesa" ? `MESA ${ctx.mesa ?? "-"}` : p.canal.toUpperCase());
  out.push(linha("=", cols));
  for (const i of itens) {
    out.push(`${String(Number(i.qtd)).padStart(2, " ")}x ${i.nome_snapshot}`);
    for (const o of i.opcoes_json ?? []) out.push(`    + ${o.nome}`);
    if (i.obs) out.push(`    OBS: ${i.obs}`);
    // alergia nao pode virar mais uma linha de observacao no meio do rush
    if (i.restricao) {
      out.push(linha("*", cols));
      out.push(`ALERGIA: ${i.restricao.toUpperCase()}`);
      out.push(linha("*", cols));
    }
    const alerg = siglas(i.alergenicos ?? null);
    if (alerg) out.push(`    contem: ${alerg}`);
  }
  out.push(linha("-", cols));
  if (p.obs) { out.push(`OBS DO PEDIDO: ${p.obs}`); out.push(linha("-", cols)); }
  out.push("");
  return out.join("\n");
}

/** Enfileira uma comanda por área de produção (cozinha e bar imprimem separado). */
async function enfileirarComanda(c: PoolClient, negocioId: string, pedidoId: string): Promise<void> {
  const p = (await c.query<{
    id: string; numero_dia: number; canal: string; criado_em: string; obs: string | null;
    loja_id: string; loja_nome: string; mesa_numero: string | null;
  }>(
    `SELECT p.id, p.numero_dia, p.canal, p.criado_em, p.obs, p.loja_id,
            l.nome AS loja_nome, m.numero AS mesa_numero
       FROM food_pedidos p JOIN food_lojas l ON l.id = p.loja_id
       LEFT JOIN food_mesas m ON m.id = p.mesa_id
      WHERE p.id = $1`,
    [pedidoId]
  )).rows[0];
  if (!p) return;

  const itens = (await c.query<{
    qtd: string; nome_snapshot: string; opcoes_json: { nome: string }[] | null;
    obs: string | null; restricao: string | null; alergenicos: string[] | null; area_id: string | null;
  }>(
    `SELECT i.qtd, i.nome_snapshot, i.opcoes_json, i.obs, i.restricao, i.area_id,
            p.alergenicos
       FROM food_itens i LEFT JOIN food_produtos p ON p.id = i.produto_id
      WHERE i.pedido_id = $1`,
    [pedidoId]
  )).rows;

  const impressoras = (await c.query<FoodImpressora & { area_nome: string | null }>(
    `SELECT i.*, a.nome AS area_nome FROM food_impressoras i
       LEFT JOIN food_areas a ON a.id = i.area_id
      WHERE i.loja_id = $1 AND i.ativa = true AND 'comanda' = ANY(i.imprime)`,
    [p.loja_id]
  )).rows;

  for (const imp of impressoras) {
    // impressora com área: só os itens daquela área. Sem área: a comanda inteira.
    const meus = imp.area_id ? itens.filter((i) => i.area_id === imp.area_id) : itens;
    if (!meus.length) continue;
    const texto = montarComanda(p, meus, {
      loja: p.loja_nome, mesa: p.mesa_numero, area: imp.area_nome, cols: imp.colunas,
    });
    for (let via = 0; via < Math.max(1, imp.vias); via++) {
      await c.query(
        `INSERT INTO food_print_jobs (negocio_id, impressora_id, pedido_id, tipo, conteudo)
         VALUES ($1,$2,$3,'comanda',$4)`,
        [negocioId, imp.id, pedidoId, texto]
      );
    }
  }
}

/** A impressora perguntou se tem trabalho. Devolve o próximo job e marca entregue. */
export async function proximoJob(chave: string): Promise<{ id: string; conteudo: string } | null> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const imp = (await c.query<{ id: string }>(
      "UPDATE food_impressoras SET ultimo_ping = now() WHERE chave = $1 AND ativa = true RETURNING id",
      [chave]
    )).rows[0];
    if (!imp) { await c.query("ROLLBACK"); return null; }
    const job = (await c.query<{ id: string; conteudo: string }>(
      `UPDATE food_print_jobs SET status = 'entregue', entregue_em = now(), tentativas = tentativas + 1
        WHERE id = (SELECT id FROM food_print_jobs
                     WHERE impressora_id = $1 AND status = 'pendente'
                     ORDER BY criado_em LIMIT 1 FOR UPDATE SKIP LOCKED)
        RETURNING id, conteudo`,
      [imp.id]
    )).rows[0] ?? null;
    await c.query("COMMIT");
    return job;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}

export async function temJobPendente(chave: string): Promise<boolean> {
  const r = await query<{ existe: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM food_print_jobs j
        JOIN food_impressoras i ON i.id = j.impressora_id
       WHERE i.chave = $1 AND i.ativa = true AND j.status = 'pendente') AS existe`,
    [chave]
  );
  await query("UPDATE food_impressoras SET ultimo_ping = now() WHERE chave = $1", [chave]);
  return !!r.rows[0]?.existe;
}

/**
 * A impressora confirma que imprimiu. A CHAVE entra na condicao: sem ela,
 * qualquer um que descobrisse um uuid de job marcava a comanda de outro
 * restaurante como impressa, e ela sumia da fila da cozinha.
 */
export async function confirmarJob(
  jobId: string, ok: boolean, erro?: string, chave?: string
): Promise<boolean> {
  const r = await query<{ id: string }>(
    `UPDATE food_print_jobs j
        SET status = $2, confirmado_em = now(), erro = $3
      WHERE j.id = $1
        AND ($4::text IS NULL OR EXISTS (
              SELECT 1 FROM food_impressoras i
               WHERE i.id = j.impressora_id AND i.chave = $4))
      RETURNING j.id`,
    [jobId, ok ? "confirmado" : "erro", erro ?? null, chave ?? null]
  );
  return r.rows.length > 0;
}

export async function reimprimir(negocioId: string, pedidoId: string): Promise<void> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await enfileirarComanda(c, negocioId, pedidoId);
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally { c.release(); }
}

export async function listImpressoras(negocioId: string, lojaId: string): Promise<FoodImpressora[]> {
  return (await query<FoodImpressora>(
    "SELECT * FROM food_impressoras WHERE negocio_id = $1 AND loja_id = $2 ORDER BY nome",
    [negocioId, lojaId]
  )).rows;
}

export async function criarImpressora(
  negocioId: string, lojaId: string,
  input: { nome: string; tipo?: "cloudprnt" | "agente" | "navegador"; areaId?: string | null; colunas?: number }
): Promise<FoodImpressora> {
  return (await query<FoodImpressora>(
    `INSERT INTO food_impressoras (negocio_id, loja_id, nome, tipo, area_id, chave, colunas)
     VALUES ($1,$2,$3,COALESCE($4,'cloudprnt'),$5,$6,COALESCE($7,48)) RETURNING *`,
    [negocioId, lojaId, input.nome, input.tipo ?? null, input.areaId ?? null, novoToken(16), input.colunas ?? null]
  )).rows[0];
}

// ---------------------------------------------------------------------------
// ESTOQUE — baixa por insumo, via ficha técnica.
// ---------------------------------------------------------------------------
async function baixarEstoque(c: PoolClient, negocioId: string, pedidoId: string): Promise<void> {
  const linhas = (await c.query<{ insumo_id: string; total: string }>(
    `SELECT f.insumo_id, SUM(f.quantidade * i.qtd) AS total
       FROM food_itens i
       JOIN food_ficha_tecnica f
         ON f.produto_id = i.produto_id
        AND (f.variacao_id IS NULL OR f.variacao_id = i.variacao_id)
      WHERE i.pedido_id = $1
      GROUP BY f.insumo_id`,
    [pedidoId]
  )).rows;
  for (const l of linhas) {
    const saldo = (await c.query<{ saldo: string }>(
      "UPDATE food_insumos SET saldo = saldo - $2 WHERE id = $1 RETURNING saldo",
      [l.insumo_id, l.total]
    )).rows[0];
    await c.query(
      `INSERT INTO food_estoque_mov (negocio_id, insumo_id, tipo, quantidade, saldo_depois, pedido_id)
       VALUES ($1,$2,'saida_venda',$3,$4,$5)`,
      [negocioId, l.insumo_id, `-${l.total}`, saldo?.saldo ?? 0, pedidoId]
    );
  }
}

export async function listInsumos(negocioId: string, lojaId: string) {
  return (await query<{
    id: string; nome: string; unidade: string; saldo: string; minimo: string; custo_medio: string;
  }>(
    `SELECT id, nome, unidade, saldo, minimo, custo_medio FROM food_insumos
      WHERE negocio_id = $1 AND loja_id = $2 AND ativo = true ORDER BY nome`,
    [negocioId, lojaId]
  )).rows;
}

export async function entradaEstoque(
  negocioId: string, insumoId: string, quantidade: number, custoUnit: number, obs?: string
): Promise<void> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    // custo médio ponderado
    const r = (await c.query<{ saldo: string }>(
      `UPDATE food_insumos
          SET custo_medio = CASE WHEN (saldo + $2) > 0
                THEN ((saldo * custo_medio) + ($2 * $3)) / (saldo + $2) ELSE $3 END,
              saldo = saldo + $2
        WHERE id = $1 AND negocio_id = $4 RETURNING saldo`,
      [insumoId, quantidade, custoUnit, negocioId]
    )).rows[0];
    await c.query(
      `INSERT INTO food_estoque_mov (negocio_id, insumo_id, tipo, quantidade, custo_unit, saldo_depois, obs)
       VALUES ($1,$2,'entrada',$3,$4,$5,$6)`,
      [negocioId, insumoId, quantidade, custoUnit, r?.saldo ?? 0, obs ?? null]
    );
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally { c.release(); }
}

// ---------------------------------------------------------------------------
// RELATÓRIOS DO DIA (o que o dono abre de manhã)
// ---------------------------------------------------------------------------
export async function resumoDoDia(negocioId: string, lojaId: string, dia?: string) {
  const d = dia ?? null;
  const totais = (await query<{
    pedidos: string; faturamento: string; ticket: string; itens: string;
  }>(
    `SELECT COUNT(*)::text AS pedidos,
            COALESCE(SUM(total),0)::text AS faturamento,
            COALESCE(AVG(total),0)::text AS ticket,
            COALESCE((SELECT SUM(qtd) FROM food_itens i JOIN food_pedidos p2 ON p2.id = i.pedido_id
                       WHERE p2.loja_id = $2 AND p2.dia = COALESCE($3::date, food_dia_loja($2))
                         AND p2.status <> 'cancelado'),0)::text AS itens
       FROM food_pedidos
      WHERE negocio_id = $1 AND loja_id = $2
        AND dia = COALESCE($3::date, food_dia_loja($2)) AND status <> 'cancelado'`,
    [negocioId, lojaId, d]
  )).rows[0];

  const porCanal = (await query<{ canal: string; qtd: string; total: string }>(
    `SELECT canal, COUNT(*)::text AS qtd, COALESCE(SUM(total),0)::text AS total
       FROM food_pedidos
      WHERE negocio_id = $1 AND loja_id = $2
        AND dia = COALESCE($3::date, food_dia_loja($2)) AND status <> 'cancelado'
      GROUP BY canal ORDER BY 3 DESC`,
    [negocioId, lojaId, d]
  )).rows;

  const topProdutos = (await query<{ nome: string; qtd: string; total: string }>(
    `SELECT i.nome_snapshot AS nome, SUM(i.qtd)::text AS qtd, SUM(i.preco_total)::text AS total
       FROM food_itens i JOIN food_pedidos p ON p.id = i.pedido_id
      WHERE p.negocio_id = $1 AND p.loja_id = $2
        AND p.dia = COALESCE($3::date, food_dia_loja($2)) AND p.status <> 'cancelado'
      GROUP BY 1 ORDER BY SUM(i.preco_total) DESC LIMIT 10`,
    [negocioId, lojaId, d]
  )).rows;

  return { totais, porCanal, topProdutos };
}

// ---------------------------------------------------------------------------
// DISPOSITIVOS E EQUIPE (tablet da cozinha, garçom por PIN)
// ---------------------------------------------------------------------------
export async function listDispositivos(negocioId: string, lojaId: string) {
  return (await query<{
    id: string; nome: string; tipo: string; token: string; area_id: string | null;
    area_nome: string | null; ultimo_uso: string | null; ativo: boolean;
    pareado_em: string | null; parear_ate: string | null; pareado_ip: string | null;
  }>(
    `SELECT d.id, d.nome, d.tipo, d.token, d.area_id, d.ultimo_uso, d.ativo,
            d.pareado_em, d.parear_ate, d.pareado_ip,
            a.nome AS area_nome
       FROM food_dispositivos d
       LEFT JOIN food_areas a ON a.id = d.area_id
      WHERE d.negocio_id = $1 AND d.loja_id = $2 ORDER BY d.criado_em`,
    [negocioId, lojaId]
  )).rows;
}

export async function criarDispositivo(
  negocioId: string, lojaId: string,
  input: { nome: string; tipo?: "kds" | "garcom" | "caixa" | "totem"; areaId?: string | null }
) {
  return (await query<{ id: string; token: string }>(
    `INSERT INTO food_dispositivos (negocio_id, loja_id, nome, tipo, area_id, token)
     VALUES ($1,$2,$3,COALESCE($4,'kds'),$5,$6) RETURNING id, token`,
    [negocioId, lojaId, input.nome, input.tipo ?? null, input.areaId ?? null, novoToken(12)]
  )).rows[0];
}

export async function listEquipe(negocioId: string, lojaId: string) {
  return (await query<{ id: string; nome: string; papel: string; ativo: boolean }>(
    "SELECT id, nome, papel, ativo FROM food_equipe WHERE negocio_id = $1 AND loja_id = $2 ORDER BY nome",
    [negocioId, lojaId]
  )).rows;
}

export async function criarMembroEquipe(
  negocioId: string, lojaId: string, nome: string, papel: string, pinHash?: string | null
) {
  return (await query<{ id: string }>(
    `INSERT INTO food_equipe (negocio_id, loja_id, nome, papel, pin_hash)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [negocioId, lojaId, nome, papel, pinHash ?? null]
  )).rows[0];
}

// ---------------------------------------------------------------------------
// CAIXA (leitura) e ESTOQUE (cadastro) — o resto da operação do dia
// ---------------------------------------------------------------------------
export async function caixaAberto(negocioId: string, lojaId: string) {
  return (await query<{
    id: string; saldo_inicial: string; aberto_em: string;
    dinheiro: string; cartao: string; pix: string; total: string;
  }>(
    `SELECT c.id, c.saldo_inicial, c.aberto_em,
            COALESCE((SELECT SUM(valor+gorjeta) FROM food_pagamentos p
                       WHERE p.caixa_id = c.id AND p.status='confirmado' AND p.metodo='dinheiro'),0) AS dinheiro,
            COALESCE((SELECT SUM(valor+gorjeta) FROM food_pagamentos p
                       WHERE p.caixa_id = c.id AND p.status='confirmado' AND p.metodo IN ('debito','credito')),0) AS cartao,
            COALESCE((SELECT SUM(valor+gorjeta) FROM food_pagamentos p
                       WHERE p.caixa_id = c.id AND p.status='confirmado' AND p.metodo IN ('pix','pix_app')),0) AS pix,
            COALESCE((SELECT SUM(valor+gorjeta) FROM food_pagamentos p
                       WHERE p.caixa_id = c.id AND p.status='confirmado'),0) AS total
       FROM food_caixas c
      WHERE c.negocio_id = $1 AND c.loja_id = $2 AND c.status = 'aberto'
      ORDER BY c.aberto_em DESC LIMIT 1`,
    [negocioId, lojaId]
  )).rows[0] ?? null;
}

export async function pagamentosDoDia(negocioId: string, lojaId: string) {
  return (await query<{
    id: string; metodo: string; valor: string; gorjeta: string; status: string;
    criado_em: string; mesa_numero: string | null;
  }>(
    `SELECT p.id, p.metodo, p.valor, p.gorjeta, p.status, p.criado_em, m.numero AS mesa_numero
       FROM food_pagamentos p
       LEFT JOIN food_sessoes s ON s.id = p.sessao_id
       LEFT JOIN food_mesas m ON m.id = s.mesa_id
      WHERE p.negocio_id = $1 AND p.loja_id = $2
        AND (p.criado_em AT TIME ZONE food_fuso_loja($2))::date = food_dia_loja($2)
      ORDER BY p.criado_em DESC LIMIT 200`,
    [negocioId, lojaId]
  )).rows;
}

export async function criarInsumo(
  negocioId: string, lojaId: string,
  input: { nome: string; unidade: string; minimo?: number; custo?: number }
) {
  return (await query<{ id: string }>(
    `INSERT INTO food_insumos (negocio_id, loja_id, nome, unidade, minimo, custo_medio)
     VALUES ($1,$2,$3,$4,COALESCE($5,0),COALESCE($6,0)) RETURNING id`,
    [negocioId, lojaId, input.nome, input.unidade, input.minimo ?? null, input.custo ?? null]
  )).rows[0];
}

/** Liga insumo a produto: é isto que faz a venda baixar o estoque certo. */
export async function definirFichaTecnica(
  negocioId: string, produtoId: string, insumoId: string, quantidade: number
): Promise<void> {
  if (quantidade <= 0) {
    await query(
      "DELETE FROM food_ficha_tecnica WHERE negocio_id = $1 AND produto_id = $2 AND insumo_id = $3",
      [negocioId, produtoId, insumoId]
    );
    return;
  }
  await query(
    `INSERT INTO food_ficha_tecnica (negocio_id, produto_id, insumo_id, quantidade)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (produto_id, variacao_id, insumo_id)
     DO UPDATE SET quantidade = EXCLUDED.quantidade`,
    [negocioId, produtoId, insumoId, quantidade]
  );
}

export async function fichaDoProduto(negocioId: string, produtoId: string) {
  return (await query<{ insumo_id: string; nome: string; unidade: string; quantidade: string; custo_medio: string }>(
    `SELECT f.insumo_id, i.nome, i.unidade, f.quantidade, i.custo_medio
       FROM food_ficha_tecnica f JOIN food_insumos i ON i.id = f.insumo_id
      WHERE f.negocio_id = $1 AND f.produto_id = $2
      ORDER BY i.nome`,
    [negocioId, produtoId]
  )).rows;
}

/** CMV do dia: quanto de insumo saiu pela venda, a custo médio. */
export async function cmvDoDia(negocioId: string, lojaId: string) {
  return (await query<{ custo: string; receita: string }>(
    `SELECT COALESCE(SUM(ABS(m.quantidade) * i.custo_medio),0)::text AS custo,
            COALESCE((SELECT SUM(total) FROM food_pedidos p
                       WHERE p.loja_id = $2 AND p.dia = food_dia_loja($2) AND p.status <> 'cancelado'),0)::text AS receita
       FROM food_estoque_mov m JOIN food_insumos i ON i.id = m.insumo_id
      WHERE m.negocio_id = $1 AND i.loja_id = $2
        AND m.tipo = 'saida_venda'
        AND (m.criado_em AT TIME ZONE food_fuso_loja($2))::date = food_dia_loja($2)`,
    [negocioId, lojaId]
  )).rows[0];
}
