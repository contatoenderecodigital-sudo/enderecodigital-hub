"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IcoExternal, IcoPlus, IcoSearch, IcoSettings, IcoTrash, IcoX } from "@/components/icons";
import { IcoCardapio, IcoCopiar, IcoFoto, IcoSetaBaixo, IcoSetaCima } from "./icones";
import { ALERGENICOS, MARCAS } from "@/lib/food-alergenicos";
import type { CardapioCategoria, CardapioProduto, FoodArea } from "@/lib/food-types";

// ============================================================================
// Cardápio: categorias à esquerda, produtos à direita, e uma janela por produto
// com tudo que ele tem (preço, promoção, foto, tamanhos, adicionais, canais).
// Mais as ações que o dono faz no meio do expediente: esgotar a categoria
// inteira, duplicar um item parecido e reajustar preço em porcentagem.
// ============================================================================

const CANAIS: [string, string][] = [["mesa", "Mesa"], ["balcao", "Balcão"], ["delivery", "Delivery"]];

const money = (v: number | string) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Reduz a foto no próprio navegador: sobe leve e rápido, mesmo no 4G. */
async function prepararFoto(file: File, lado = 1000): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const escala = Math.min(1, lado / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * escala);
  const h = Math.round(bitmap.height * escala);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, w, h);
  return canvas.toDataURL("image/webp", 0.8);
}

export default function CardapioAdmin({ neg, slug }: { neg: string; slug: string }) {
  const [cardapio, setCardapio] = useState<CardapioCategoria[]>([]);
  const [areas, setAreas] = useState<FoodArea[]>([]);
  const [catAtiva, setCatAtiva] = useState<string | null>(null);
  const [editando, setEditando] = useState<(Partial<CardapioProduto> & { categoria_id?: string }) | null>(null);
  const [editandoCat, setEditandoCat] = useState<CardapioCategoria | null>(null);
  const [ferramentas, setFerramentas] = useState(false);
  const [busca, setBusca] = useState("");
  const [novaCat, setNovaCat] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const r = await fetch(`/api/food/painel?neg=${neg}&vista=cardapio`, { cache: "no-store" });
    if (!r.ok) return;
    const d = await r.json();
    const lista: CardapioCategoria[] = d.cardapio ?? [];
    setCardapio(lista);
    setAreas(d.areas ?? []);
    setCatAtiva((atual) => (atual && lista.some((c) => c.id === atual) ? atual : lista[0]?.id ?? null));
  }, [neg]);

  useEffect(() => { carregar(); }, [carregar]);

  const acao = useCallback(async (payload: Record<string, unknown>) => {
    const r = await fetch("/api/food/painel", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ neg, ...payload }),
    });
    const d = await r.json().catch(() => ({}));
    await carregar();
    return d as Record<string, unknown>;
  }, [neg, carregar]);

  function avisar(t: string) { setMsg(t); setTimeout(() => setMsg(null), 2800); }

  const categoria = useMemo(() => cardapio.find((c) => c.id === catAtiva) ?? null, [cardapio, catAtiva]);
  const achados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return null;
    return cardapio.flatMap((c) =>
      c.produtos.filter((p) => p.nome.toLowerCase().includes(t) || (p.descricao ?? "").toLowerCase().includes(t))
        .map((p) => ({ p, cat: c }))
    );
  }, [busca, cardapio]);

  const totais = useMemo(() => {
    const prods = cardapio.flatMap((c) => c.produtos);
    return {
      categorias: cardapio.length,
      produtos: prods.length,
      esgotados: prods.filter((p) => p.esgotado).length,
      semFoto: prods.filter((p) => !p.imagem_url).length,
    };
  }, [cardapio]);

  async function mover(tabela: "food_categorias" | "food_produtos", ids: string[], id: string, delta: number) {
    const i = ids.indexOf(id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= ids.length) return;
    const novo = [...ids];
    [novo[i], novo[j]] = [novo[j], novo[i]];
    await acao({ acao: "reordenar", tabela, ids: novo });
  }

  async function salvarProduto(dados: Partial<CardapioProduto> & { categoria_id?: string }) {
    const salvo = await acao({
      acao: "produto",
      id: dados.id,
      categoria_id: dados.categoria_id,
      nome: dados.nome,
      descricao: dados.descricao ?? null,
      preco: Number(dados.preco ?? 0),
      preco_promo: dados.preco_promo ? Number(dados.preco_promo) : null,
      imagem_url: dados.imagem_url ?? null,
      area_id: dados.area_id ?? null,
      codigo: dados.codigo ?? null,
      serve_pessoas: dados.serve_pessoas ? Number(dados.serve_pessoas) : null,
      tempo_preparo: dados.tempo_preparo ? Number(dados.tempo_preparo) : null,
      permite_meia: dados.permite_meia ?? false,
      destaque: dados.destaque ?? false,
      canais: dados.canais ?? ["mesa", "balcao", "delivery"],
      ativo: dados.ativo ?? true,
    });
    // alergenico vai em acao propria: e informacao com obrigacao legal atras,
    // e o painel precisa poder gravar so isso quando o dono corrigir depois
    const idFinal = dados.id ?? (salvo?.id as string | undefined);
    if (idFinal) {
      const d = dados as unknown as Record<string, unknown>;
      await acao({
        acao: "alergenicos", produtoId: idFinal,
        alergenicos: d.alergenicos ?? [], tracos: d.tracos ?? [],
        sem_gluten: !!d.sem_gluten, sem_lactose: !!d.sem_lactose,
        vegetariano: !!d.vegetariano, vegano: !!d.vegano,
      });
    }
    if (!dados.id && salvo?.id) {
      setEditando({ ...(salvo as unknown as CardapioProduto) });
      avisar("Produto criado. Agora dá para pôr foto, tamanhos e adicionais.");
    } else {
      setEditando(null);
      avisar("Salvo");
    }
  }

  const idsCat = cardapio.map((c) => c.id);
  const idsProd = categoria?.produtos.map((p) => p.id) ?? [];

  // ---------- cardápio ainda vazio
  if (!cardapio.length) {
    return (
      <>
        <Cabecalho slug={slug} msg={msg} totais={null} onFerramentas={() => {}} />
        <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <span className="icon-box" style={{ margin: "0 auto 14px" }}><IcoCardapio /></span>
          <h2 style={{ fontSize: 20, margin: "0 0 6px" }}>Comece pela primeira categoria</h2>
          <p className="muted" style={{ maxWidth: 520, margin: "0 auto 18px", fontSize: 14 }}>
            Categoria é a divisão do cardápio: Para começar, Pratos, Bebidas, Sobremesas.
            Depois você cadastra os produtos dentro dela.
          </p>
          <div className="row" style={{ justifyContent: "center", maxWidth: 420, margin: "0 auto" }}>
            <input value={novaCat} onChange={(e) => setNovaCat(e.target.value)} placeholder="Ex.: Pratos" />
            <button className="btn"
                    onClick={async () => { if (novaCat.trim()) { await acao({ acao: "categoria", nome: novaCat.trim() }); setNovaCat(""); } }}>
              Criar
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Cabecalho slug={slug} msg={msg} totais={totais} onFerramentas={() => setFerramentas(true)} />

      {/* ---------- busca ---------- */}
      <div className="card" style={{ marginBottom: 14, padding: 12 }}>
        <div className="row" style={{ gap: 10 }}>
          <span className="muted" style={{ display: "flex", alignItems: "center" }}>
            <IcoSearch width={17} height={17} />
          </span>
          <input value={busca} onChange={(e) => setBusca(e.target.value)}
                 placeholder="Procurar produto pelo nome (útil quando o cardápio é grande)"
                 style={{ border: "none", background: "transparent", padding: 0 }} />
          {busca && <button className="btn btn-ghost btn-sm" onClick={() => setBusca("")}>Limpar</button>}
        </div>
      </div>

      {achados ? (
        <div className="card">
          <h2 style={{ fontSize: 16, margin: "0 0 10px" }}>
            {achados.length} resultado(s) para {busca}
          </h2>
          {achados.map(({ p, cat }) => (
            <div key={p.id} className="prod-linha" style={{ marginBottom: 8 }}>
              <span style={{ flex: 1 }}>
                <b>{p.nome}</b>
                <span className="muted" style={{ display: "block", fontSize: 12.5 }}>{cat.nome}</span>
              </span>
              <b className="gold">{p.variacoes.length ? "por tamanho" : money(p.preco)}</b>
              <button className="btn btn-ghost btn-sm" onClick={() => { setCatAtiva(cat.id); setEditando({ ...p }); setBusca(""); }}>
                Abrir
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="cols-cardapio">
          {/* ---------- categorias ---------- */}
          <div className="card" style={{ padding: 14 }}>
            <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 10 }}>
              Categorias
            </div>

            {cardapio.map((c) => (
              <div key={c.id} className={"cat-linha" + (c.id === catAtiva ? " ativa" : "")} onClick={() => setCatAtiva(c.id)}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ fontSize: 14, opacity: c.ativa ? 1 : 0.5 }}>{c.nome}</b>
                  <span className="muted" style={{ fontSize: 12, display: "block" }}>
                    {c.produtos.length} item(ns)
                    {!c.ativa && " · escondida"}
                    {c.hora_inicio && ` · ${String(c.hora_inicio).slice(0, 5)} às ${String(c.hora_fim).slice(0, 5)}`}
                  </span>
                </span>
                <span className="cat-acoes" onClick={(e) => e.stopPropagation()}>
                  <button className="icon-btn-mini" title="Subir" onClick={() => mover("food_categorias", idsCat, c.id, -1)}>
                    <IcoSetaCima width={13} height={13} />
                  </button>
                  <button className="icon-btn-mini" title="Descer" onClick={() => mover("food_categorias", idsCat, c.id, 1)}>
                    <IcoSetaBaixo width={13} height={13} />
                  </button>
                  <button className="icon-btn-mini" title="Configurar categoria" onClick={() => setEditandoCat(c)}>
                    <IcoSettings width={13} height={13} />
                  </button>
                </span>
              </div>
            ))}

            <div className="row" style={{ gap: 6, marginTop: 12 }}>
              <input value={novaCat} onChange={(e) => setNovaCat(e.target.value)} placeholder="Nova categoria"
                     style={{ padding: "8px 10px", fontSize: 13.5 }}
                     onKeyDown={async (e) => {
                       if (e.key === "Enter" && novaCat.trim()) { await acao({ acao: "categoria", nome: novaCat.trim() }); setNovaCat(""); }
                     }} />
              <button className="btn btn-sm"
                      onClick={async () => { if (novaCat.trim()) { await acao({ acao: "categoria", nome: novaCat.trim() }); setNovaCat(""); } }}>
                <IcoPlus width={15} height={15} />
              </button>
            </div>
          </div>

          {/* ---------- produtos ---------- */}
          <div>
            {categoria && (
              <div className="card">
                <div className="spread" style={{ marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 19 }}>{categoria.nome}</h2>
                    <p className="muted" style={{ margin: "2px 0 0", fontSize: 13 }}>
                      {categoria.produtos.length} produto(s)
                      {categoria.canais?.length && categoria.canais.length < 3 &&
                        ` · só em ${categoria.canais.join(", ")}`}
                    </p>
                  </div>
                  <div className="row">
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditandoCat(categoria)}>
                      <IcoSettings width={15} height={15} /> Configurar
                    </button>
                    <button className="btn btn-ghost btn-sm"
                            onClick={async () => {
                              const r = await acao({ acao: "esgotar_categoria", categoriaId: categoria.id, esgotado: true });
                              avisar(`${r?.afetados ?? 0} item(ns) marcados como esgotados`);
                            }}>
                      Acabou tudo
                    </button>
                    <button className="btn btn-sm"
                            onClick={() => setEditando({ categoria_id: categoria.id, nome: "", preco: "0", ativo: true })}>
                      <IcoPlus width={16} height={16} /> Novo produto
                    </button>
                  </div>
                </div>

                {categoria.produtos.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "36px 20px" }}>
                    <b>Nenhum produto em {categoria.nome}</b>
                    <p className="muted" style={{ fontSize: 13.5, maxWidth: 440, margin: "6px auto 14px" }}>
                      Cadastre com nome, preço e foto. Se o item tem tamanhos (300ml e 500ml), os preços
                      ficam nos tamanhos, dentro do produto.
                    </p>
                    <button className="btn btn-sm"
                            onClick={() => setEditando({ categoria_id: categoria.id, nome: "", preco: "0", ativo: true })}>
                      <IcoPlus width={16} height={16} /> Criar o primeiro
                    </button>
                  </div>
                ) : (
                  <div className="grid" style={{ gap: 10 }}>
                    {categoria.produtos.map((p) => (
                      <div key={p.id} className="prod-linha" style={{ opacity: p.ativo ? 1 : 0.5 }}>
                        {p.imagem_url
                          ? <img src={p.imagem_url} alt="" className="prod-foto" />
                          : <span className="prod-foto vazia"><IcoFoto width={18} height={18} /></span>}

                        <span style={{ flex: 1, minWidth: 0 }}>
                          <b style={{ fontSize: 15 }}>{p.nome}</b>
                          {p.destaque && <span className="badge gold" style={{ marginLeft: 8 }}>destaque</span>}
                          {p.esgotado && <span className="badge warn" style={{ marginLeft: 8 }}>esgotado</span>}
                          {!p.ativo && <span className="badge" style={{ marginLeft: 8 }}>escondido</span>}
                          {p.descricao && <span className="muted" style={{ display: "block", fontSize: 12.5 }}>{p.descricao}</span>}
                          <span className="muted" style={{ display: "block", fontSize: 12 }}>
                            {p.variacoes.length > 0 && p.variacoes.map((v) => `${v.nome} ${money(v.preco)}`).join("  ·  ")}
                            {p.grupos.length > 0 && (p.variacoes.length ? "  ·  " : "") +
                              p.grupos.map((g) => `${g.nome} (${g.opcoes.length})`).join("  ·  ")}
                            {p.canais?.length < 3 && `  ·  só ${p.canais.join(", ")}`}
                          </span>
                        </span>

                        <span style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          {p.preco_promo ? (
                            <>
                              <s className="muted" style={{ fontSize: 12 }}>{money(p.preco)}</s>{" "}
                              <b className="gold">{money(p.preco_promo)}</b>
                            </>
                          ) : (
                            <b className="gold">{p.variacoes.length ? "por tamanho" : money(p.preco)}</b>
                          )}
                        </span>

                        <span className="row" style={{ gap: 4 }}>
                          <button className="icon-btn-mini" title="Subir" onClick={() => mover("food_produtos", idsProd, p.id, -1)}>
                            <IcoSetaCima width={13} height={13} />
                          </button>
                          <button className="icon-btn-mini" title="Descer" onClick={() => mover("food_produtos", idsProd, p.id, 1)}>
                            <IcoSetaBaixo width={13} height={13} />
                          </button>
                          <button className="icon-btn-mini" title="Duplicar"
                                  onClick={async () => { await acao({ acao: "duplicar_produto", produtoId: p.id }); avisar("Cópia criada, escondida do cardápio até você revisar"); }}>
                            <IcoCopiar width={13} height={13} />
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditando({ ...p })}>Editar</button>
                          <button className={"btn btn-sm" + (p.esgotado ? "" : " btn-ghost")}
                                  onClick={() => acao({ acao: "esgotado", produtoId: p.id, esgotado: !p.esgotado })}>
                            {p.esgotado ? "Tem de novo" : "Acabou"}
                          </button>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {editando && (
        <JanelaProduto
          produto={editando}
          areas={areas}
          categorias={cardapio}
          onFechar={() => setEditando(null)}
          onSalvar={salvarProduto}
          onAcao={acao}
          onAviso={avisar}
          onRecarregarProduto={async (id) => {
            const r = await fetch(`/api/food/painel?neg=${neg}&vista=cardapio`, { cache: "no-store" });
            const d = await r.json();
            const achado = (d.cardapio ?? []).flatMap((c: CardapioCategoria) => c.produtos)
              .find((p: CardapioProduto) => p.id === id);
            if (achado) setEditando(achado);
            setCardapio(d.cardapio ?? []);
          }}
        />
      )}

      {editandoCat && (
        <JanelaCategoria
          categoria={editandoCat}
          onFechar={() => setEditandoCat(null)}
          onSalvar={async (c) => {
            await acao({ acao: "categoria", ...c });
            setEditandoCat(null);
            avisar("Categoria salva");
          }}
          onExcluir={async () => {
            if (!confirm(`Apagar a categoria ${editandoCat.nome}?`)) return;
            const r = await acao({ acao: "excluir_categoria", categoriaId: editandoCat.id });
            setEditandoCat(null);
            avisar(r?.resultado === "desativada"
              ? "Tinha produto dentro, então foi escondida em vez de apagada"
              : "Categoria apagada");
          }}
        />
      )}

      {ferramentas && (
        <JanelaFerramentas
          categorias={cardapio}
          onFechar={() => setFerramentas(false)}
          onAcao={acao}
          onAviso={avisar}
        />
      )}

      <style>{`
        .cols-cardapio { display: grid; gap: 16px; grid-template-columns: 288px minmax(0,1fr); align-items: start; }
        @media (max-width: 900px) { .cols-cardapio { grid-template-columns: 1fr; } }
        .cat-linha { display: flex; align-items: center; gap: 8px; padding: 9px 10px; border-radius: 11px; cursor: pointer; }
        .cat-acoes { display: flex; gap: 3px; opacity: 0; transition: opacity .12s; }
        .cat-linha:hover .cat-acoes, .cat-linha.ativa .cat-acoes { opacity: 1; }
        .icon-btn-mini { width: 25px; height: 25px; border-radius: 7px; display: grid; place-items: center;
          cursor: pointer; font-size: 12px; line-height: 1; }
        .prod-linha { display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 14px; flex-wrap: wrap; }
        .prod-foto { width: 52px; height: 52px; border-radius: 11px; object-fit: cover; flex: none; }
        .prod-foto.vazia { display: grid; place-items: center; }
      `}</style>
    </>
  );
}

// ---------------------------------------------------------------------------
function Cabecalho({
  slug, msg, totais, onFerramentas,
}: {
  slug: string;
  msg: string | null;
  totais: { categorias: number; produtos: number; esgotados: number; semFoto: number } | null;
  onFerramentas: () => void;
}) {
  return (
    <div className="page-head">
      <div>
        <span className="eyebrow">Restaurante</span>
        <h1>Cardápio</h1>
        <p className="muted">
          {totais
            ? <>{totais.produtos} produtos em {totais.categorias} categorias
                {totais.esgotados > 0 && ` · ${totais.esgotados} esgotado(s)`}
                {totais.semFoto > 0 && ` · ${totais.semFoto} sem foto`}</>
            : "O que você cadastra aqui é o que o cliente vê no celular."}
        </p>
      </div>
      <div className="row">
        {msg && <span className="badge ok">{msg}</span>}
        <a className="btn btn-ghost btn-sm" href={`/c/${slug}`} target="_blank" rel="noreferrer">
          <IcoExternal width={15} height={15} /> Ver como o cliente vê
        </a>
        <button className="btn btn-ghost btn-sm" onClick={onFerramentas}>
          <IcoSettings width={15} height={15} /> Ferramentas
        </button>
      </div>
    </div>
  );
}

function JanelaProduto({
  produto, areas, categorias, onFechar, onSalvar, onAcao, onAviso, onRecarregarProduto,
}: {
  produto: Partial<CardapioProduto> & { categoria_id?: string };
  areas: FoodArea[];
  categorias: CardapioCategoria[];
  onFechar: () => void;
  onSalvar: (p: Partial<CardapioProduto> & { categoria_id?: string }) => void;
  onAcao: (p: Record<string, unknown>) => Promise<Record<string, unknown>>;
  onAviso: (t: string) => void;
  onRecarregarProduto: (id: string) => Promise<void>;
}) {
  const [form, setForm] = useState(produto);
  const [aba, setAba] = useState<"basico" | "tamanhos" | "adicionais" | "avancado">("basico");
  const [subindo, setSubindo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [varNome, setVarNome] = useState("");
  const [varPreco, setVarPreco] = useState("");
  const [grpNome, setGrpNome] = useState("");
  const [grpObrig, setGrpObrig] = useState(false);
  const [grpMax, setGrpMax] = useState("5");
  const [opc, setOpc] = useState<Record<string, { nome: string; preco: string }>>({});

  useEffect(() => setForm(produto), [produto]);
  const novo = !form.id;
  const canais = form.canais ?? ["mesa", "balcao", "delivery"];

  function campo(k: string, v: unknown) { setForm((f) => ({ ...f, [k]: v })); }
  function toggleCanal(c: string) {
    campo("canais", canais.includes(c) ? canais.filter((x) => x !== c) : [...canais, c]);
  }

  async function enviarFoto(file: File) {
    if (!form.id) return;
    setSubindo(true);
    try {
      const dataUrl = await prepararFoto(file);
      const r = await onAcao({ acao: "foto", produtoId: form.id, dataUrl, origem: "produto" });
      if (typeof r?.url === "string") { campo("imagem_url", r.url); onAviso("Foto trocada"); }
      else onAviso("Não deu para subir a foto");
    } catch { onAviso("Arquivo de imagem inválido"); }
    setSubindo(false);
  }

  return (
    <div className="modal-overlay" onClick={onFechar}>
      <div className="modal-panel" style={{ maxWidth: 760 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="icon-box"><IcoCardapio /></span>
          <div>
            <h2>{novo ? "Novo produto" : form.nome}</h2>
            <p>{novo ? "Nome e preço já bastam. O resto dá para completar depois." : "Editando o produto"}</p>
          </div>
          <button className="modal-close" onClick={onFechar}><IcoX width={17} height={17} /></button>
        </div>

        {!novo && (
          <div className="row" style={{ gap: 4, padding: "12px 24px 0", flexWrap: "wrap" }}>
            {([["basico", "Básico"], ["tamanhos", `Tamanhos (${form.variacoes?.length ?? 0})`],
               ["adicionais", `Adicionais (${form.grupos?.length ?? 0})`], ["avancado", "Avançado"]] as const).map(([k, r]) => (
              <button key={k} className={"wsnav-tab" + (aba === k ? " active" : "")} onClick={() => setAba(k as never)}>
                {r}
              </button>
            ))}
          </div>
        )}

        <div className="modal-body">
          {(novo || aba === "basico") && (
            <div className="cols-2">
              <div>
                <label style={{ marginTop: 0 }}>Nome do produto</label>
                <input value={form.nome ?? ""} autoFocus onChange={(e) => campo("nome", e.target.value)}
                       placeholder="Costela no bafo" />

                <label>Descrição</label>
                <input value={form.descricao ?? ""} onChange={(e) => campo("descricao", e.target.value)}
                       placeholder="Acompanha mandioca e vinagrete" />

                <div className="cols-2">
                  <div>
                    <label>Preço</label>
                    <input type="number" step="0.01" value={String(form.preco ?? "")}
                           onChange={(e) => campo("preco", e.target.value)} placeholder="0,00" />
                  </div>
                  <div>
                    <label>Preço promocional</label>
                    <input type="number" step="0.01" value={String(form.preco_promo ?? "")}
                           onChange={(e) => campo("preco_promo", e.target.value)} placeholder="opcional" />
                  </div>
                </div>
                <p className="muted" style={{ fontSize: 12, margin: "6px 0 0" }}>
                  Com promoção preenchida, o cliente vê o preço antigo riscado. Se o produto tem tamanhos,
                  deixe o preço em 0 e cadastre na aba Tamanhos.
                </p>

                <label>Categoria</label>
                <select value={form.categoria_id ?? ""} onChange={(e) => campo("categoria_id", e.target.value)}>
                  {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>

              <div>
                <label style={{ marginTop: 0 }}>Foto</label>
                <button className="fd-foto-alvo"
                        onClick={() => (form.id ? fileRef.current?.click() : onAviso("Salve o produto primeiro"))}
                        style={{
                          width: "100%", aspectRatio: "4/3", borderRadius: 16, cursor: "pointer",
                          border: form.imagem_url ? "1px solid var(--fd-line)" : "1px dashed #cfd3d9",
                          background: form.imagem_url ? `center/cover url(${form.imagem_url})` : "#f4f5f7",
                          display: "grid", placeItems: "center", padding: 12,
                        }}>
                  {!form.imagem_url && (
                    <span style={{ textAlign: "center" }}>
                      <IcoFoto width={26} height={26} />
                      <span style={{ display: "block", fontSize: 13, marginTop: 8, fontWeight: 600 }}>
                        {subindo ? "Subindo..." : novo ? "Salve o produto para poder pôr a foto" : "Clique para escolher a foto"}
                      </span>
                      <span style={{ display: "block", fontSize: 11.5, marginTop: 4 }}>
                        serve foto do próprio celular
                      </span>
                    </span>
                  )}
                </button>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
                       onChange={(e) => { const f = e.target.files?.[0]; if (f) enviarFoto(f); }} />
                {form.imagem_url && (
                  <div className="row" style={{ marginTop: 8, gap: 8 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>Trocar</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => campo("imagem_url", null)}>Tirar foto</button>
                  </div>
                )}

                <label>Onde é preparado</label>
                <select value={form.area_id ?? ""} onChange={(e) => campo("area_id", e.target.value || null)}>
                  <option value="">Sem área definida</option>
                  {areas.filter((a) => a.ativa).map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
                </select>
                <p className="muted" style={{ fontSize: 12, margin: "6px 0 0" }}>
                  Define em qual tela da cozinha aparece e em qual impressora a comanda sai.
                </p>

                <label>
                  <span className="row" style={{ gap: 8 }}>
                    <input type="checkbox" style={{ width: 16 }} checked={form.ativo ?? true}
                           onChange={(e) => campo("ativo", e.target.checked)} />
                    Aparece no cardápio
                  </span>
                </label>
              </div>
            </div>
          )}

          {!novo && aba === "avancado" && (
            <div className="cols-2">
              <div>
                <label style={{ marginTop: 0 }}>Onde este produto aparece</label>
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  {CANAIS.map(([v, r]) => (
                    <label key={v} style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 7 }}>
                      <input type="checkbox" style={{ width: 16 }} checked={canais.includes(v)}
                             onChange={() => toggleCanal(v)} />
                      {r}
                    </label>
                  ))}
                </div>
                <p className="muted" style={{ fontSize: 12, margin: "6px 0 0" }}>
                  Serve para item que só existe no salão (chope na torneira) ou só no delivery (combo família).
                </p>

                <label>Tempo de preparo (minutos)</label>
                <input type="number" value={String(form.tempo_preparo ?? "")}
                       onChange={(e) => campo("tempo_preparo", e.target.value)} placeholder="usa o tempo da loja" />

                <label>Serve quantas pessoas</label>
                <input type="number" value={String(form.serve_pessoas ?? "")}
                       onChange={(e) => campo("serve_pessoas", e.target.value)} placeholder="opcional" />
              </div>

              <div>
                <label style={{ marginTop: 0 }}>Código interno (PLU)</label>
                <input value={form.codigo ?? ""} onChange={(e) => campo("codigo", e.target.value)}
                       placeholder="usado por quem já tem numeração própria" />

                <label>
                  <span className="row" style={{ gap: 8 }}>
                    <input type="checkbox" style={{ width: 16 }} checked={form.destaque ?? false}
                           onChange={(e) => campo("destaque", e.target.checked)} />
                    Marcar como destaque da casa
                  </span>
                </label>

                <label>
                  <span className="row" style={{ gap: 8 }}>
                    <input type="checkbox" style={{ width: 16 }} checked={form.permite_meia ?? false}
                           onChange={(e) => campo("permite_meia", e.target.checked)} />
                    Aceita meia a meia (pizza)
                  </span>
                </label>

                {/* A RDC 727/2022 da Anvisa exige a informacao de alergenico ao
                    lado de cada item do cardapio. Nao e diferencial: e o que
                    tira o restaurante de risco. */}
                <div className="glass-soft" style={{ padding: 12, borderRadius: 12, marginTop: 16 }}>
                  <b style={{ fontSize: 13.5 }}>O que este prato contém</b>
                  <p className="muted" style={{ fontSize: 12.5, margin: "4px 0 10px" }}>
                    Aparece no celular do cliente e vai destacado no cartão da cozinha.
                    A Anvisa (RDC 727/2022) exige esta informação no cardápio.
                  </p>
                  <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                    {ALERGENICOS.map((a) => {
                      const marcado = (form.alergenicos ?? []).includes(a.chave);
                      return (
                        <label key={a.chave}
                               style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                          <input type="checkbox" style={{ width: 16 }} checked={marcado}
                                 onChange={(e) => campo("alergenicos",
                                   e.target.checked
                                     ? [...(form.alergenicos ?? []), a.chave]
                                     : (form.alergenicos ?? []).filter((x: string) => x !== a.chave))} />
                          {a.nome}
                        </label>
                      );
                    })}
                  </div>
                  <div className="row" style={{ flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                    {MARCAS.map((m) => (
                      <label key={m.chave}
                             style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                        <input type="checkbox" style={{ width: 16 }}
                               checked={!!(form as unknown as Record<string, unknown>)[m.chave]}
                               onChange={(e) => campo(m.chave, e.target.checked)} />
                        {m.nome}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="glass-soft" style={{ padding: 12, borderRadius: 12, marginTop: 16 }}>
                  <b style={{ fontSize: 13.5 }}>Duplicar este produto</b>
                  <p className="muted" style={{ fontSize: 12.5, margin: "4px 0 10px" }}>
                    Cria uma cópia com tamanhos e adicionais iguais, escondida até você revisar.
                    Serve para cadastrar item parecido em segundos.
                  </p>
                  <button className="btn btn-ghost btn-sm"
                          onClick={async () => {
                            await onAcao({ acao: "duplicar_produto", produtoId: form.id });
                            onAviso("Cópia criada");
                            onFechar();
                          }}>
                    <IcoCopiar width={14} height={14} /> Duplicar
                  </button>
                </div>
              </div>
            </div>
          )}

          {!novo && aba === "tamanhos" && (
            <div>
              <p className="muted" style={{ marginTop: 0, fontSize: 13.5 }}>
                Use quando o mesmo item tem preços diferentes: chope 300ml e 500ml, pizza média e grande.
                Com tamanho cadastrado, o cliente escolhe na hora de pedir e o preço sai daqui.
              </p>
              {(form.variacoes ?? []).map((v) => (
                <div key={v.id} className="spread" style={{ padding: "9px 0", borderBottom: "1px solid var(--fd-line)" }}>
                  <span><b>{v.nome}</b> <span className="muted">{money(v.preco)}</span></span>
                  <button className="btn btn-ghost btn-sm"
                          onClick={async () => {
                            await onAcao({ acao: "excluir_variacao", id: v.id });
                            await onRecarregarProduto(form.id!);
                            onAviso("Tamanho removido");
                          }}>
                    <IcoTrash width={14} height={14} />
                  </button>
                </div>
              ))}
              <div className="row" style={{ gap: 8, marginTop: 12 }}>
                <input placeholder="Nome do tamanho (300ml, G)" value={varNome} onChange={(e) => setVarNome(e.target.value)} />
                <input placeholder="Preço" type="number" step="0.01" value={varPreco}
                       onChange={(e) => setVarPreco(e.target.value)} style={{ maxWidth: 130 }} />
                <button className="btn"
                        onClick={async () => {
                          if (!varNome) return;
                          await onAcao({ acao: "variacao", produto_id: form.id, nome: varNome, preco: Number(varPreco || 0) });
                          await onAcao({ acao: "produto", id: form.id, categoria_id: form.categoria_id,
                                         nome: form.nome, preco: Number(form.preco ?? 0), tem_variacao: true });
                          setVarNome(""); setVarPreco("");
                          await onRecarregarProduto(form.id!);
                          onAviso("Tamanho adicionado");
                        }}>
                  Adicionar
                </button>
              </div>
            </div>
          )}

          {!novo && aba === "adicionais" && (
            <div>
              <p className="muted" style={{ marginTop: 0, fontSize: 13.5 }}>
                Grupo é a pergunta que o cliente responde ao pedir: Ponto da carne (obrigatório, escolhe um)
                ou Adicionais (opcional, escolhe vários). Dentro do grupo entram as opções, com preço extra quando tiver.
              </p>

              {(form.grupos ?? []).map((g) => (
                <div key={g.id} className="glass-soft" style={{ padding: 14, borderRadius: 14, marginBottom: 10 }}>
                  <div className="spread">
                    <b>{g.nome} <span className="muted" style={{ fontWeight: 400 }}>
                      {g.obrigatorio ? "· obrigatório, escolhe 1" : `· opcional, até ${g.maximo}`}
                    </span></b>
                    <button className="btn btn-ghost btn-sm"
                            onClick={async () => {
                              if (!confirm(`Apagar o grupo ${g.nome}?`)) return;
                              await onAcao({ acao: "excluir_grupo", id: g.id });
                              await onRecarregarProduto(form.id!);
                            }}>
                      <IcoTrash width={14} height={14} />
                    </button>
                  </div>
                  {g.opcoes.map((o) => (
                    <div key={o.id} className="spread" style={{ fontSize: 13.5, padding: "5px 0" }}>
                      <span>{o.nome} {Number(o.preco_extra) > 0 && <span className="gold">+ {money(o.preco_extra)}</span>}</span>
                      <button className="icon-btn-mini"
                              onClick={async () => {
                                await onAcao({ acao: "excluir_opcao", id: o.id });
                                await onRecarregarProduto(form.id!);
                              }}>
                        <IcoX width={12} height={12} />
                      </button>
                    </div>
                  ))}
                  <div className="row" style={{ gap: 6, marginTop: 8 }}>
                    <input placeholder="Nova opção" value={opc[g.id]?.nome ?? ""}
                           onChange={(e) => setOpc((s) => ({ ...s, [g.id]: { nome: e.target.value, preco: s[g.id]?.preco ?? "" } }))}
                           style={{ padding: "8px 10px", fontSize: 13.5 }} />
                    <input placeholder="+R$" type="number" step="0.01" value={opc[g.id]?.preco ?? ""}
                           onChange={(e) => setOpc((s) => ({ ...s, [g.id]: { nome: s[g.id]?.nome ?? "", preco: e.target.value } }))}
                           style={{ maxWidth: 100, padding: "8px 10px", fontSize: 13.5 }} />
                    <button className="btn btn-ghost btn-sm"
                            onClick={async () => {
                              const v = opc[g.id];
                              if (!v?.nome) return;
                              await onAcao({ acao: "opcao", grupo_id: g.id, nome: v.nome, preco_extra: Number(v.preco || 0) });
                              setOpc((s) => ({ ...s, [g.id]: { nome: "", preco: "" } }));
                              await onRecarregarProduto(form.id!);
                            }}>
                      Add
                    </button>
                  </div>
                </div>
              ))}

              <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <input placeholder="Nome do grupo (Ponto da carne, Adicionais)" value={grpNome}
                       onChange={(e) => setGrpNome(e.target.value)} />
                <label style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" }}>
                  <input type="checkbox" style={{ width: 16 }} checked={grpObrig} onChange={(e) => setGrpObrig(e.target.checked)} />
                  obrigatório
                </label>
                {!grpObrig && (
                  <input type="number" value={grpMax} onChange={(e) => setGrpMax(e.target.value)}
                         style={{ maxWidth: 90 }} title="quantas opções o cliente pode escolher" />
                )}
                <button className="btn"
                        onClick={async () => {
                          if (!grpNome) return;
                          await onAcao({
                            acao: "grupo", produto_id: form.id, nome: grpNome,
                            minimo: grpObrig ? 1 : 0, maximo: grpObrig ? 1 : Number(grpMax || 5), obrigatorio: grpObrig,
                          });
                          setGrpNome(""); setGrpObrig(false); setGrpMax("5");
                          await onRecarregarProduto(form.id!);
                          onAviso("Grupo criado");
                        }}>
                  Criar grupo
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="modal-foot">
          {!novo && (
            <button className="btn btn-ghost" style={{ marginRight: "auto" }}
                    onClick={async () => {
                      if (!confirm(`Apagar ${form.nome}?`)) return;
                      const r = await onAcao({ acao: "excluir_produto", produtoId: form.id });
                      onAviso(r?.resultado === "desativado"
                        ? "Já foi vendido, então saiu do cardápio mas ficou no histórico"
                        : "Produto apagado");
                      onFechar();
                    }}>
              <IcoTrash width={15} height={15} /> Apagar
            </button>
          )}
          <button className="btn btn-ghost" onClick={onFechar}>Fechar</button>
          <button className="btn" onClick={() => onSalvar(form)}>{novo ? "Criar produto" : "Salvar"}</button>
        </div>
      </div>
    </div>
  );
}

function JanelaCategoria({
  categoria, onFechar, onSalvar, onExcluir,
}: {
  categoria: CardapioCategoria;
  onFechar: () => void;
  onSalvar: (c: Record<string, unknown>) => void;
  onExcluir: () => void;
}) {
  const [nome, setNome] = useState(categoria.nome);
  const [descricao, setDescricao] = useState(categoria.descricao ?? "");
  const [ativa, setAtiva] = useState(categoria.ativa);
  const [canais, setCanais] = useState<string[]>(categoria.canais ?? ["mesa", "balcao", "delivery"]);
  const [inicio, setInicio] = useState(categoria.hora_inicio ? String(categoria.hora_inicio).slice(0, 5) : "");
  const [fim, setFim] = useState(categoria.hora_fim ? String(categoria.hora_fim).slice(0, 5) : "");

  return (
    <div className="modal-overlay" onClick={onFechar}>
      <div className="modal-panel" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="icon-box"><IcoCardapio /></span>
          <div>
            <h2>{categoria.nome}</h2>
            <p>Configuração da categoria</p>
          </div>
          <button className="modal-close" onClick={onFechar}><IcoX width={17} height={17} /></button>
        </div>

        <div className="modal-body">
          <div>
            <label style={{ marginTop: 0 }}>Nome</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} />

            <label>Descrição (aparece embaixo do título no cardápio)</label>
            <input value={descricao} onChange={(e) => setDescricao(e.target.value)}
                   placeholder="Serve 2 pessoas, acompanha guarnição" />

            <label>Onde esta categoria aparece</label>
            <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
              {CANAIS.map(([v, r]) => (
                <label key={v} style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 7 }}>
                  <input type="checkbox" style={{ width: 16 }} checked={canais.includes(v)}
                         onChange={() => setCanais((s) => s.includes(v) ? s.filter((x) => x !== v) : [...s, v])} />
                  {r}
                </label>
              ))}
            </div>

            <label>Só aparece neste horário (opcional)</label>
            <div className="row" style={{ gap: 8 }}>
              <input type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} style={{ maxWidth: 140 }} />
              <span className="muted">até</span>
              <input type="time" value={fim} onChange={(e) => setFim(e.target.value)} style={{ maxWidth: 140 }} />
            </div>
            <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              Serve para o almoço executivo sumir à noite, ou o café da manhã sumir depois das 11h.
            </p>

            <label>
              <span className="row" style={{ gap: 8 }}>
                <input type="checkbox" style={{ width: 16 }} checked={ativa} onChange={(e) => setAtiva(e.target.checked)} />
                Categoria visível no cardápio
              </span>
            </label>
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn btn-ghost" style={{ marginRight: "auto" }} onClick={onExcluir}>
            <IcoTrash width={15} height={15} /> Apagar
          </button>
          <button className="btn btn-ghost" onClick={onFechar}>Cancelar</button>
          <button className="btn"
                  onClick={() => onSalvar({
                    id: categoria.id, nome, descricao, ativa, canais,
                    hora_inicio: inicio || null, hora_fim: fim || null,
                  })}>
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

function JanelaFerramentas({
  categorias, onFechar, onAcao, onAviso,
}: {
  categorias: CardapioCategoria[];
  onFechar: () => void;
  onAcao: (p: Record<string, unknown>) => Promise<Record<string, unknown>>;
  onAviso: (t: string) => void;
}) {
  const [pct, setPct] = useState("5");
  const [alvo, setAlvo] = useState("");

  return (
    <div className="modal-overlay" onClick={onFechar}>
      <div className="modal-panel" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="icon-box"><IcoSettings /></span>
          <div>
            <h2>Ferramentas do cardápio</h2>
            <p>Coisas que ninguém quer fazer item por item</p>
          </div>
          <button className="modal-close" onClick={onFechar}><IcoX width={17} height={17} /></button>
        </div>

        <div className="modal-body">
          <div className="glass-soft" style={{ padding: 16, borderRadius: 14 }}>
            <b>Reajustar preços</b>
            <p className="muted" style={{ fontSize: 13, margin: "4px 0 12px" }}>
              Sobe ou desce o preço de todos os itens em porcentagem, incluindo os tamanhos.
              Use número negativo para baixar. O valor é arredondado nos centavos.
            </p>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <input type="number" step="0.5" value={pct} onChange={(e) => setPct(e.target.value)}
                     style={{ maxWidth: 110 }} />
              <span className="muted">%</span>
              <select value={alvo} onChange={(e) => setAlvo(e.target.value)} style={{ maxWidth: 220 }}>
                <option value="">no cardápio inteiro</option>
                {categorias.map((c) => <option key={c.id} value={c.id}>só em {c.nome}</option>)}
              </select>
              <button className="btn btn-sm"
                      onClick={async () => {
                        const onde = alvo ? categorias.find((c) => c.id === alvo)?.nome : "o cardápio inteiro";
                        if (!confirm(`Reajustar ${pct}% em ${onde}? Isso muda os preços agora.`)) return;
                        const r = await onAcao({ acao: "reajustar_precos", percentual: Number(pct), categoriaId: alvo || null });
                        onAviso(`${r?.afetados ?? 0} produto(s) reajustados`);
                        onFechar();
                      }}>
                Aplicar
              </button>
            </div>
          </div>

          <div className="glass-soft" style={{ padding: 16, borderRadius: 14 }}>
            <b>Fim de expediente</b>
            <p className="muted" style={{ fontSize: 13, margin: "4px 0 12px" }}>
              Marca a categoria inteira como esgotada, ou devolve tudo para o cardápio.
              O esgotado volta sozinho depois de 12 horas.
            </p>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <select value={alvo} onChange={(e) => setAlvo(e.target.value)} style={{ maxWidth: 220 }}>
                <option value="">escolha a categoria</option>
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
              <button className="btn btn-ghost btn-sm" disabled={!alvo}
                      onClick={async () => {
                        const r = await onAcao({ acao: "esgotar_categoria", categoriaId: alvo, esgotado: true });
                        onAviso(`${r?.afetados ?? 0} item(ns) esgotados`);
                      }}>
                Acabou tudo
              </button>
              <button className="btn btn-ghost btn-sm" disabled={!alvo}
                      onClick={async () => {
                        const r = await onAcao({ acao: "esgotar_categoria", categoriaId: alvo, esgotado: false });
                        onAviso(`${r?.afetados ?? 0} item(ns) de volta ao cardápio`);
                      }}>
                Voltou tudo
              </button>
            </div>
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onFechar}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
