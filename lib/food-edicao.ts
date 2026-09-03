import "server-only";
import crypto from "node:crypto";
import { pool, query } from "./db";

// ============================================================================
// Tudo que o DONO edita sozinho, sem pedir para a agência: renomear, reordenar,
// desativar, apagar, horário de funcionamento, bairros de entrega e foto.
//
// Regra do módulo: nada some do histórico. O que já foi vendido é DESATIVADO,
// nunca apagado, senão o relatório de ontem muda sozinho.
// ============================================================================

function novoToken(bytes = 12): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

// ---------------------------------------------------------------------------
// CARDÁPIO
// ---------------------------------------------------------------------------
export async function excluirProduto(
  negocioId: string, produtoId: string
): Promise<"apagado" | "desativado"> {
  const vendido = (await query<{ existe: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM food_itens WHERE produto_id = $1) AS existe",
    [produtoId]
  )).rows[0]?.existe;
  if (vendido) {
    await query("UPDATE food_produtos SET ativo = false WHERE id = $1 AND negocio_id = $2", [produtoId, negocioId]);
    return "desativado";
  }
  await query("DELETE FROM food_produtos WHERE id = $1 AND negocio_id = $2", [produtoId, negocioId]);
  return "apagado";
}

export async function excluirCategoria(
  negocioId: string, categoriaId: string
): Promise<"apagada" | "desativada"> {
  const temProduto = (await query<{ existe: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM food_produtos WHERE categoria_id = $1) AS existe",
    [categoriaId]
  )).rows[0]?.existe;
  if (temProduto) {
    await query("UPDATE food_categorias SET ativa = false WHERE id = $1 AND negocio_id = $2", [categoriaId, negocioId]);
    return "desativada";
  }
  await query("DELETE FROM food_categorias WHERE id = $1 AND negocio_id = $2", [categoriaId, negocioId]);
  return "apagada";
}

export async function excluirVariacao(negocioId: string, id: string): Promise<void> {
  const vendida = (await query<{ existe: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM food_itens WHERE variacao_id = $1) AS existe", [id]
  )).rows[0]?.existe;
  if (vendida) {
    await query("UPDATE food_variacoes SET ativa = false WHERE id = $1 AND negocio_id = $2", [id, negocioId]);
  } else {
    await query("DELETE FROM food_variacoes WHERE id = $1 AND negocio_id = $2", [id, negocioId]);
  }
}

export async function excluirGrupoOpcao(negocioId: string, id: string): Promise<void> {
  await query("DELETE FROM food_grupos_opcao WHERE id = $1 AND negocio_id = $2", [id, negocioId]);
}

export async function excluirOpcao(negocioId: string, id: string): Promise<void> {
  // opção já escolhida em pedido antigo fica no snapshot do item, então some só da lista
  await query("UPDATE food_opcoes SET ativa = false WHERE id = $1 AND negocio_id = $2", [id, negocioId]);
}

/** Arrastar para cima e para baixo: o painel manda a lista já na ordem certa. */
export async function reordenar(
  negocioId: string,
  tabela: "food_categorias" | "food_produtos" | "food_mesas" | "food_areas",
  ids: string[]
): Promise<void> {
  const permitidas = ["food_categorias", "food_produtos", "food_mesas", "food_areas"];
  if (!permitidas.includes(tabela)) throw new Error("tabela invalida");
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    for (let i = 0; i < ids.length; i++) {
      await c.query(`UPDATE ${tabela} SET ordem = $3 WHERE id = $1 AND negocio_id = $2`, [ids[i], negocioId, i]);
    }
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally { c.release(); }
}

// ---------------------------------------------------------------------------
// MESAS
// ---------------------------------------------------------------------------
export async function atualizarMesa(
  negocioId: string, mesaId: string,
  campos: { numero?: string; apelido?: string | null; capacidade?: number; setor?: string | null; ativa?: boolean }
): Promise<void> {
  await query(
    `UPDATE food_mesas
        SET numero = COALESCE($3, numero), apelido = $4,
            capacidade = COALESCE($5, capacidade), setor = $6, ativa = COALESCE($7, ativa)
      WHERE id = $1 AND negocio_id = $2`,
    [mesaId, negocioId, campos.numero ?? null, campos.apelido ?? null,
     campos.capacidade ?? null, campos.setor ?? null, campos.ativa ?? null]
  );
}

export async function excluirMesa(
  negocioId: string, mesaId: string
): Promise<"apagada" | "desativada"> {
  const usada = (await query<{ existe: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM food_sessoes WHERE mesa_id = $1) AS existe", [mesaId]
  )).rows[0]?.existe;
  if (usada) {
    await query("UPDATE food_mesas SET ativa = false WHERE id = $1 AND negocio_id = $2", [mesaId, negocioId]);
    return "desativada";
  }
  await query("DELETE FROM food_mesas WHERE id = $1 AND negocio_id = $2", [mesaId, negocioId]);
  return "apagada";
}

// ---------------------------------------------------------------------------
// ÁREAS, IMPRESSORAS, TABLETS E EQUIPE
// ---------------------------------------------------------------------------
export async function atualizarArea(
  negocioId: string, id: string, campos: { nome?: string; cor?: string | null; ativa?: boolean }
): Promise<void> {
  await query(
    `UPDATE food_areas SET nome = COALESCE($3, nome), cor = $4, ativa = COALESCE($5, ativa)
      WHERE id = $1 AND negocio_id = $2`,
    [id, negocioId, campos.nome ?? null, campos.cor ?? null, campos.ativa ?? null]
  );
}

export async function excluirArea(negocioId: string, id: string): Promise<void> {
  await query("UPDATE food_areas SET ativa = false WHERE id = $1 AND negocio_id = $2", [id, negocioId]);
}

export async function atualizarImpressora(
  negocioId: string, id: string,
  campos: { nome?: string; areaId?: string | null; colunas?: number; vias?: number; ativa?: boolean }
): Promise<void> {
  await query(
    `UPDATE food_impressoras
        SET nome = COALESCE($3, nome), area_id = $4, colunas = COALESCE($5, colunas),
            vias = COALESCE($6, vias), ativa = COALESCE($7, ativa)
      WHERE id = $1 AND negocio_id = $2`,
    [id, negocioId, campos.nome ?? null, campos.areaId ?? null,
     campos.colunas ?? null, campos.vias ?? null, campos.ativa ?? null]
  );
}

export async function excluirImpressora(negocioId: string, id: string): Promise<void> {
  await query("DELETE FROM food_impressoras WHERE id = $1 AND negocio_id = $2", [id, negocioId]);
}

export async function atualizarDispositivo(
  negocioId: string, id: string, campos: { nome?: string; areaId?: string | null; ativo?: boolean }
): Promise<void> {
  await query(
    `UPDATE food_dispositivos SET nome = COALESCE($3, nome), area_id = $4, ativo = COALESCE($5, ativo)
      WHERE id = $1 AND negocio_id = $2`,
    [id, negocioId, campos.nome ?? null, campos.areaId ?? null, campos.ativo ?? null]
  );
}

export async function excluirDispositivo(negocioId: string, id: string): Promise<void> {
  await query("DELETE FROM food_dispositivos WHERE id = $1 AND negocio_id = $2", [id, negocioId]);
}

/** Tablet perdido ou emprestado: link novo, o antigo morre na hora. */
export async function regravarDispositivo(negocioId: string, id: string): Promise<string> {
  const t = novoToken(12);
  await query("UPDATE food_dispositivos SET token = $3 WHERE id = $1 AND negocio_id = $2", [id, negocioId, t]);
  return t;
}

export async function atualizarEquipe(
  negocioId: string, id: string,
  campos: { nome?: string; papel?: string; ativo?: boolean; pinHash?: string | null }
): Promise<void> {
  await query(
    `UPDATE food_equipe
        SET nome = COALESCE($3, nome), papel = COALESCE($4, papel),
            ativo = COALESCE($5, ativo), pin_hash = COALESCE($6, pin_hash)
      WHERE id = $1 AND negocio_id = $2`,
    [id, negocioId, campos.nome ?? null, campos.papel ?? null,
     campos.ativo ?? null, campos.pinHash ?? null]
  );
}

export async function excluirEquipe(negocioId: string, id: string): Promise<void> {
  await query("UPDATE food_equipe SET ativo = false WHERE id = $1 AND negocio_id = $2", [id, negocioId]);
}

// ---------------------------------------------------------------------------
// HORÁRIO DE FUNCIONAMENTO
// ---------------------------------------------------------------------------
export interface Horario {
  id: string;
  dia_semana: number;
  abre: string;
  fecha: string;
  canal: string;
}

export async function listHorarios(negocioId: string, lojaId: string): Promise<Horario[]> {
  return (await query<Horario>(
    `SELECT id, dia_semana, abre, fecha, canal FROM food_horarios
      WHERE negocio_id = $1 AND loja_id = $2 ORDER BY dia_semana, abre`,
    [negocioId, lojaId]
  )).rows;
}

/** O dono salva a semana inteira de uma vez. */
export async function salvarHorarios(
  negocioId: string, lojaId: string,
  faixas: { dia_semana: number; abre: string; fecha: string; canal?: string }[]
): Promise<void> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("DELETE FROM food_horarios WHERE negocio_id = $1 AND loja_id = $2", [negocioId, lojaId]);
    for (const f of faixas) {
      if (!f.abre || !f.fecha) continue;
      await c.query(
        `INSERT INTO food_horarios (negocio_id, loja_id, dia_semana, abre, fecha, canal)
         VALUES ($1,$2,$3,$4,$5,COALESCE($6,'todos'))`,
        [negocioId, lojaId, f.dia_semana, f.abre, f.fecha, f.canal ?? null]
      );
    }
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally { c.release(); }
}

/** Aberta agora? O "forçar aberto/fechado" do dono ganha do horário. */
export async function lojaEstaAberta(negocioId: string, lojaId: string): Promise<boolean> {
  const l = (await query<{ aberto_manual: boolean | null }>(
    "SELECT aberto_manual FROM food_lojas WHERE id = $1 AND negocio_id = $2",
    [lojaId, negocioId]
  )).rows[0];
  if (l && l.aberto_manual !== null && l.aberto_manual !== undefined) return l.aberto_manual;
  // No fuso da LOJA, e entendendo faixa que vira a madrugada (18h as 02h).
  // Com `localtime` (UTC) o bar era dado como fechado as 21h, cheio.
  const r = await query<{ aberta: boolean }>(
    "SELECT food_loja_aberta($1) AS aberta", [lojaId]
  );
  return !!r.rows[0]?.aberta;
}

// ---------------------------------------------------------------------------
// DELIVERY: bairros e taxas
// ---------------------------------------------------------------------------
export interface Bairro {
  id: string;
  nome: string;
  cidade: string | null;
  taxa: string;
  tempo_min: number;
  pedido_minimo: string;
  ativo: boolean;
}

export async function listBairros(negocioId: string, lojaId: string): Promise<Bairro[]> {
  return (await query<Bairro>(
    `SELECT id, nome, cidade, taxa, tempo_min, pedido_minimo, ativo
       FROM food_bairros WHERE negocio_id = $1 AND loja_id = $2 ORDER BY nome`,
    [negocioId, lojaId]
  )).rows;
}

export async function upsertBairro(
  negocioId: string, lojaId: string,
  input: {
    id?: string; nome: string; cidade?: string | null; taxa: number;
    tempo_min?: number; pedido_minimo?: number; ativo?: boolean;
  }
): Promise<{ id: string }> {
  if (input.id) {
    await query(
      `UPDATE food_bairros
          SET nome = $3, cidade = $4, taxa = $5, tempo_min = COALESCE($6, tempo_min),
              pedido_minimo = COALESCE($7, pedido_minimo), ativo = COALESCE($8, ativo)
        WHERE id = $1 AND negocio_id = $2`,
      [input.id, negocioId, input.nome, input.cidade ?? null, input.taxa,
       input.tempo_min ?? null, input.pedido_minimo ?? null, input.ativo ?? null]
    );
    return { id: input.id };
  }
  return (await query<{ id: string }>(
    `INSERT INTO food_bairros (negocio_id, loja_id, nome, cidade, taxa, tempo_min, pedido_minimo)
     VALUES ($1,$2,$3,$4,$5,COALESCE($6,40),COALESCE($7,0))
     ON CONFLICT (loja_id, nome) DO UPDATE SET taxa = EXCLUDED.taxa
     RETURNING id`,
    [negocioId, lojaId, input.nome, input.cidade ?? null, input.taxa,
     input.tempo_min ?? null, input.pedido_minimo ?? null]
  )).rows[0];
}

export async function excluirBairro(negocioId: string, id: string): Promise<void> {
  await query("DELETE FROM food_bairros WHERE id = $1 AND negocio_id = $2", [id, negocioId]);
}

// ---------------------------------------------------------------------------
// FOTO — guardada no banco, servida por /api/food/midia/<id>.
// O navegador já redimensiona antes de enviar, então o peso é pequeno.
// ---------------------------------------------------------------------------
export async function salvarMidia(
  negocioId: string, lojaId: string | null, dataUrl: string, origem: string
): Promise<{ id: string; url: string }> {
  const m = /^data:([^;,]+)[;,]/.exec(dataUrl);
  const mime = m?.[1] ?? "image/webp";
  if (!mime.startsWith("image/")) throw new Error("ARQUIVO_NAO_E_IMAGEM");
  const bytes = Buffer.from(dataUrl.replace(/^data:[^,]+,/, ""), "base64");
  if (!bytes.length) throw new Error("IMAGEM_VAZIA");
  if (bytes.length > 2_000_000) throw new Error("IMAGEM_GRANDE");
  const r = await query<{ id: string }>(
    `INSERT INTO food_midias (negocio_id, loja_id, tipo_mime, bytes, tamanho, origem)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [negocioId, lojaId, mime, bytes, bytes.length, origem]
  );
  return { id: r.rows[0].id, url: `/api/food/midia/${r.rows[0].id}` };
}

export async function lerMidia(id: string): Promise<{ bytes: Buffer; mime: string } | null> {
  const r = await query<{ bytes: Buffer; tipo_mime: string }>(
    "SELECT bytes, tipo_mime FROM food_midias WHERE id = $1", [id]
  );
  const row = r.rows[0];
  return row ? { bytes: row.bytes, mime: row.tipo_mime } : null;
}

// ---------------------------------------------------------------------------
// DELIVERY: pedidos em rota
// ---------------------------------------------------------------------------
export async function pedidosDelivery(negocioId: string, lojaId: string) {
  return (await query<{
    id: string; numero_dia: number; status: string; total: string; taxa_entrega: string;
    criado_em: string; entrega_json: Record<string, unknown> | null;
    cliente_nome: string | null; telefone: string | null;
    bairro: string | null; entregador: string | null;
  }>(
    `SELECT p.id, p.numero_dia, p.status, p.total, p.taxa_entrega, p.criado_em, p.entrega_json,
            c.nome AS cliente_nome, c.telefone, b.nome AS bairro, e.nome AS entregador
       FROM food_pedidos p
       LEFT JOIN food_clientes c ON c.id = p.cliente_id
       LEFT JOIN food_bairros b ON b.id = p.bairro_id
       LEFT JOIN food_equipe e ON e.id = p.entregador_id
      WHERE p.negocio_id = $1 AND p.loja_id = $2 AND p.canal = 'delivery'
        AND p.dia = food_dia_loja($2) AND p.status <> 'cancelado'
      ORDER BY p.criado_em DESC`,
    [negocioId, lojaId]
  )).rows;
}

export async function despacharPedido(
  negocioId: string, pedidoId: string, entregadorId: string | null
): Promise<void> {
  await query(
    `UPDATE food_pedidos
        SET status = 'em_entrega', saiu_entrega_em = now(),
            entregador_id = COALESCE($3, entregador_id)
      WHERE id = $1 AND negocio_id = $2`,
    [pedidoId, negocioId, entregadorId]
  );
  await query(
    `INSERT INTO food_eventos (negocio_id, loja_id, tipo, pedido_id, cliente_id)
     SELECT negocio_id, loja_id, 'saiu_entrega', id, cliente_id FROM food_pedidos WHERE id = $1`,
    [pedidoId]
  );
}

// ---------------------------------------------------------------------------
// AÇÕES EM MASSA no cardápio. É o que o dono faz de verdade no dia a dia:
// duplicar um item parecido, esgotar a categoria inteira quando acaba o
// estoque, e reajustar preço sem abrir item por item.
// ---------------------------------------------------------------------------
export async function duplicarProduto(negocioId: string, produtoId: string): Promise<{ id: string }> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const novo = (await c.query<{ id: string }>(
      `INSERT INTO food_produtos
         (negocio_id, loja_id, categoria_id, area_id, nome, descricao, preco, preco_promo,
          imagem_url, codigo, serve_pessoas, tempo_preparo, tem_variacao, permite_meia,
          destaque, canais, ordem, ativo)
       SELECT negocio_id, loja_id, categoria_id, area_id, nome || ' (cópia)', descricao, preco,
              preco_promo, imagem_url, codigo, serve_pessoas, tempo_preparo, tem_variacao,
              permite_meia, destaque, canais,
              (SELECT COALESCE(MAX(ordem),0)+1 FROM food_produtos p2 WHERE p2.categoria_id = p.categoria_id),
              false
         FROM food_produtos p WHERE p.id = $1 AND p.negocio_id = $2
       RETURNING id`,
      [produtoId, negocioId]
    )).rows[0];
    if (!novo) { await c.query("ROLLBACK"); throw new Error("produto nao encontrado"); }

    await c.query(
      `INSERT INTO food_variacoes (negocio_id, produto_id, nome, preco, fatias, ordem, ativa)
       SELECT negocio_id, $2, nome, preco, fatias, ordem, ativa
         FROM food_variacoes WHERE produto_id = $1`,
      [produtoId, novo.id]
    );

    const grupos = (await c.query<{ id: string; novo_id: string }>(
      `WITH copiados AS (
         INSERT INTO food_grupos_opcao (negocio_id, produto_id, nome, minimo, maximo, obrigatorio, tipo_preco, ordem)
         SELECT negocio_id, $2, nome, minimo, maximo, obrigatorio, tipo_preco, ordem
           FROM food_grupos_opcao WHERE produto_id = $1
         RETURNING id, nome, ordem)
       SELECT g.id, c.id AS novo_id FROM food_grupos_opcao g
         JOIN copiados c ON c.nome = g.nome AND c.ordem = g.ordem
        WHERE g.produto_id = $1`,
      [produtoId, novo.id]
    )).rows;

    for (const g of grupos) {
      await c.query(
        `INSERT INTO food_opcoes (negocio_id, grupo_id, nome, preco_extra, insumo_id, insumo_qtd, ordem, ativa)
         SELECT negocio_id, $2, nome, preco_extra, insumo_id, insumo_qtd, ordem, ativa
           FROM food_opcoes WHERE grupo_id = $1`,
        [g.id, g.novo_id]
      );
    }

    await c.query("COMMIT");
    return novo;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally { c.release(); }
}

/** Acabou o estoque do dia: some com a categoria inteira do cardápio. */
export async function esgotarCategoria(
  negocioId: string, categoriaId: string, esgotado: boolean
): Promise<number> {
  const r = await query<{ id: string }>(
    `UPDATE food_produtos
        SET esgotado = $3,
            esgotado_ate = CASE WHEN $3 THEN (now() + interval '12 hours') ELSE NULL END
      WHERE categoria_id = $1 AND negocio_id = $2 RETURNING id`,
    [categoriaId, negocioId, esgotado]
  );
  return r.rows.length;
}

/** Reajuste de preço em porcentagem, na categoria ou no cardápio inteiro. */
export async function reajustarPrecos(
  negocioId: string, lojaId: string, percentual: number, categoriaId?: string | null
): Promise<number> {
  const params: unknown[] = [negocioId, lojaId, percentual];
  let filtro = "";
  if (categoriaId) { params.push(categoriaId); filtro = `AND categoria_id = $${params.length}`; }

  const r = await query<{ id: string }>(
    `UPDATE food_produtos
        SET preco = ROUND(preco * (1 + $3::numeric / 100), 2),
            preco_promo = CASE WHEN preco_promo IS NULL THEN NULL
                               ELSE ROUND(preco_promo * (1 + $3::numeric / 100), 2) END
      WHERE negocio_id = $1 AND loja_id = $2 ${filtro} RETURNING id`,
    params
  );
  await query(
    `UPDATE food_variacoes v
        SET preco = ROUND(v.preco * (1 + $3::numeric / 100), 2)
       FROM food_produtos p
      WHERE v.produto_id = p.id AND p.negocio_id = $1 AND p.loja_id = $2 ${filtro.replace("categoria_id", "p.categoria_id")}`,
    params
  );
  return r.rows.length;
}

/** Mover produto de categoria sem abrir o editor. */
export async function moverProduto(
  negocioId: string, produtoId: string, categoriaId: string
): Promise<void> {
  await query(
    `UPDATE food_produtos
        SET categoria_id = $3,
            ordem = (SELECT COALESCE(MAX(ordem),0)+1 FROM food_produtos WHERE categoria_id = $3)
      WHERE id = $1 AND negocio_id = $2`,
    [produtoId, negocioId, categoriaId]
  );
}
