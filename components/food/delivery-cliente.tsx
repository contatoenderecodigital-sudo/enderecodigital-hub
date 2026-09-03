"use client";

import { useEffect, useMemo, useState } from "react";
import "@/app/food-cliente.css";
import type { CardapioCategoria, CardapioProduto } from "@/lib/food-types";

// ============================================================================
// Pedido online do cliente final: /c/<slug>/pedir
// Nome e telefone só no fim: pedir dado antes de a pessoa escolher o que quer
// é o jeito mais rápido de perder o pedido.
// ============================================================================

type Loja = {
  nome: string; logo_url: string | null; cor_destaque: string | null;
  tempo_preparo_min: number; whatsapp: string | null; endereco: string | null;
};
type Bairro = { id: string; nome: string; taxa: string; tempo_min: number; pedido_minimo: string };
type Linha = {
  key: string; produtoId: string; variacaoId: string | null;
  nome: string; preco: number; qtd: number;
};

const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function api(payload: Record<string, unknown>) {
  const r = await fetch("/api/food/publico", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  return { ok: r.ok, data: await r.json().catch(() => ({})) };
}

export default function DeliveryCliente({ slug }: { slug: string }) {
  const [loja, setLoja] = useState<Loja | null>(null);
  const [cardapio, setCardapio] = useState<CardapioCategoria[]>([]);
  const [bairros, setBairros] = useState<Bairro[]>([]);
  const [aberta, setAberta] = useState(true);
  const [aceitaEntrega, setAceitaEntrega] = useState(true);
  const [aceitaRetirada, setAceitaRetirada] = useState(true);
  const [pedidoMinimo, setPedidoMinimo] = useState(0);
  const [carrinho, setCarrinho] = useState<Linha[]>([]);
  const [catAtiva, setCatAtiva] = useState<string | null>(null);
  const [etapa, setEtapa] = useState<"cardapio" | "dados" | "pronto">("cardapio");
  const [retirada, setRetirada] = useState(false);
  const [aberto, setAberto] = useState<CardapioProduto | null>(null);
  const [form, setForm] = useState({
    nome: "", telefone: "", bairroId: "", rua: "", numero: "",
    referencia: "", pagamento: "pix", troco: "", obs: "",
  });
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [numero, setNumero] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const { ok, data } = await api({ acao: "cardapio_delivery", slug });
      if (!ok) { setErro("Loja não encontrada"); return; }
      setLoja(data.loja); setCardapio(data.cardapio ?? []); setBairros(data.bairros ?? []);
      setAberta(!!data.aberta); setAceitaEntrega(!!data.aceita_delivery);
      setAceitaRetirada(!!data.aceita_retirada);
      setPedidoMinimo(Number(data.pedido_minimo ?? 0));
      setCatAtiva((data.cardapio ?? [])[0]?.id ?? null);
      if (!data.aceita_delivery) setRetirada(true);
    })();
  }, [slug]);

  const subtotal = useMemo(() => carrinho.reduce((s, l) => s + l.preco * l.qtd, 0), [carrinho]);
  const bairro = bairros.find((b) => b.id === form.bairroId);
  const taxa = retirada ? 0 : Number(bairro?.taxa ?? 0);
  const total = subtotal + taxa;
  const cor = loja?.cor_destaque || "#e8332a";
  const cat = cardapio.find((c) => c.id === catAtiva) ?? cardapio[0];

  function add(p: CardapioProduto, variacaoId: string | null) {
    const v = p.variacoes.find((x) => x.id === variacaoId);
    const preco = v ? Number(v.preco) : Number(p.preco_promo ?? p.preco);
    const nome = v ? `${p.nome} (${v.nome})` : p.nome;
    setCarrinho((c) => {
      const i = c.findIndex((l) => l.produtoId === p.id && l.variacaoId === variacaoId);
      if (i >= 0) { const cp = [...c]; cp[i] = { ...cp[i], qtd: cp[i].qtd + 1 }; return cp; }
      return [...c, { key: crypto.randomUUID(), produtoId: p.id, variacaoId, nome, preco, qtd: 1 }];
    });
    setAberto(null);
  }

  function mudarQtd(key: string, delta: number) {
    setCarrinho((c) => c.map((l) => (l.key === key ? { ...l, qtd: l.qtd + delta } : l)).filter((l) => l.qtd > 0));
  }

  async function enviar() {
    setErro(null);
    if (!form.nome.trim() || form.telefone.replace(/\D/g, "").length < 10) {
      setErro("Precisamos do nome e do WhatsApp para falar do seu pedido");
      return;
    }
    if (!retirada && !form.bairroId) { setErro("Escolha o bairro"); return; }
    if (!retirada && !form.rua.trim()) { setErro("Falta o endereço"); return; }
    if (subtotal < pedidoMinimo) { setErro(`O pedido mínimo é ${money(pedidoMinimo)}`); return; }

    setEnviando(true);
    const { ok, data } = await api({
      acao: "pedido_delivery", slug, retirada,
      nome: form.nome, telefone: form.telefone, bairroId: form.bairroId,
      rua: form.rua, numero: form.numero, referencia: form.referencia,
      pagamento: form.pagamento, troco: form.troco, obs: form.obs,
      itens: carrinho.map((l) => ({ produto_id: l.produtoId, variacao_id: l.variacaoId, qtd: l.qtd })),
    });
    setEnviando(false);
    if (!ok) {
      setErro(
        data?.erro === "fechada" ? "A loja está fechada agora"
        : data?.erro === "bairro" ? "Bairro inválido"
        : typeof data?.erro === "string" ? data.erro : "Não foi possível enviar"
      );
      return;
    }
    setNumero(data.numero);
    setEtapa("pronto");
    setCarrinho([]);
  }

  if (erro && !loja) return <div className="fc"><div className="fc-vazio">{erro}</div></div>;
  if (!loja) return <div className="fc"><div className="fc-vazio">Carregando...</div></div>;

  // ---------- pedido enviado
  if (etapa === "pronto") {
    return (
      <div className="fc" style={{ ["--fc-cor" as string]: cor }}>
        <div className="fc-conteudo" style={{ padding: "60px 16px", textAlign: "center" }}>
          <div style={{
            width: 64, height: 64, borderRadius: 999, background: cor, color: "#fff",
            display: "grid", placeItems: "center", fontSize: 30, margin: "0 auto 16px",
          }}>
            ✓
          </div>
          <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>Pedido enviado</h1>
          <p style={{ color: "var(--fc-muted)", fontSize: 15, margin: "0 0 20px" }}>
            É o pedido número {numero}. A loja vai confirmar em instantes e você recebe aviso no WhatsApp.
            {retirada ? " Fica pronto em cerca de " : " A entrega leva cerca de "}
            {loja.tempo_preparo_min + (retirada ? 0 : 20)} minutos.
          </p>
          {loja.whatsapp && (
            <a className="fc-btn" style={{ textDecoration: "none" }}
               href={`https://wa.me/${loja.whatsapp.replace(/\D/g, "")}`}>
              Falar com a loja no WhatsApp
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fc" style={{ ["--fc-cor" as string]: cor }}>
      <header className="fc-capa">
        <span className="fc-capa-sombra" />
        <div className="fc-topo fc-conteudo">
          {loja.logo_url
            ? <img src={loja.logo_url} alt="" className="fc-logo" />
            : <span className="fc-logo fc-logo-vazia">{loja.nome.slice(0, 1)}</span>}
          <div>
            <div className="fc-nome">{loja.nome}</div>
            <div className="fc-sub">
              <span className="fc-pill">{aberta ? "aberto agora" : "fechado"}</span>
              <span>entrega em cerca de {loja.tempo_preparo_min + 20} min</span>
            </div>
          </div>
        </div>
      </header>

      {!aberta && (
        <div className="fc-aviso" style={{ background: "#c62828" }}>
          A loja está fechada. Você pode montar o pedido, mas só dá para enviar quando abrir.
        </div>
      )}

      {etapa === "cardapio" ? (
        <>
          {cardapio.length > 1 && (
            <div className="fc-chips">
              {cardapio.map((c) => (
                <button key={c.id} className={"fc-chip" + (c.id === cat?.id ? " on" : "")}
                        onClick={() => setCatAtiva(c.id)}>
                  {c.nome}
                </button>
              ))}
            </div>
          )}

          <div className="fc-conteudo">
            {cat && (
              <section className="fc-secao">
                <h2>{cat.nome}</h2>
                {cat.produtos.map((p) => (
                  <button key={p.id} className={"fc-item" + (p.esgotado ? " off" : "")}
                          disabled={p.esgotado}
                          onClick={() => (p.variacoes.length ? setAberto(p) : add(p, null))}>
                    <span className="fc-item-txt">
                      <span className="fc-item-nome">{p.nome}</span>
                      {p.descricao && <span className="fc-item-desc">{p.descricao}</span>}
                      <span className="fc-item-preco">
                        {p.esgotado ? "Esgotado hoje"
                          : p.variacoes.length
                            ? <><small>a partir de </small>{money(Math.min(...p.variacoes.map((v) => Number(v.preco))))}</>
                            : money(Number(p.preco_promo ?? p.preco))}
                      </span>
                    </span>
                    {p.imagem_url && <img src={p.imagem_url} alt="" className="fc-item-foto" />}
                  </button>
                ))}
              </section>
            )}
          </div>
        </>
      ) : (
        <div className="fc-conteudo" style={{ paddingTop: 14 }}>
          {/* ---------- itens ---------- */}
          <div className="fc-bloco">
            <b style={{ fontSize: 15 }}>Seu pedido</b>
            <div className="fc-hr" />
            {carrinho.map((l) => (
              <div key={l.key} className="fc-linha" style={{ alignItems: "center" }}>
                <span style={{ flex: 1 }}>{l.nome}</span>
                <span className="fc-qtd" style={{ padding: "2px 8px" }}>
                  <button onClick={() => mudarQtd(l.key, -1)}>−</button>
                  <span>{l.qtd}</span>
                  <button onClick={() => mudarQtd(l.key, 1)}>+</button>
                </span>
                <b style={{ minWidth: 78, textAlign: "right" }}>{money(l.preco * l.qtd)}</b>
              </div>
            ))}
          </div>

          {/* ---------- entrega ou retirada ---------- */}
          <div className="fc-bloco">
            <b style={{ fontSize: 15 }}>Como você quer receber</b>
            <div className="fc-btn-linha" style={{ marginTop: 10 }}>
              {aceitaEntrega && (
                <button className={"fc-btn " + (retirada ? "fc-btn-3" : "")} onClick={() => setRetirada(false)}>
                  Entrega
                </button>
              )}
              {aceitaRetirada && (
                <button className={"fc-btn " + (retirada ? "" : "fc-btn-3")} onClick={() => setRetirada(true)}>
                  Retirar na loja
                </button>
              )}
            </div>

            <label className="fc-label">Seu nome</label>
            <input className="fc-input" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />

            <label className="fc-label">WhatsApp</label>
            <input className="fc-input" inputMode="tel" value={form.telefone}
                   placeholder="49 99999 0000"
                   onChange={(e) => setForm({ ...form, telefone: e.target.value })} />

            {!retirada && (
              <>
                <label className="fc-label">Bairro</label>
                <select className="fc-input" value={form.bairroId}
                        onChange={(e) => setForm({ ...form, bairroId: e.target.value })}>
                  <option value="">Escolha o bairro</option>
                  {bairros.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.nome} · {money(Number(b.taxa))} · {b.tempo_min} min
                    </option>
                  ))}
                </select>

                <label className="fc-label">Endereço</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input className="fc-input" placeholder="Rua" value={form.rua}
                         onChange={(e) => setForm({ ...form, rua: e.target.value })} />
                  <input className="fc-input" placeholder="Nº" value={form.numero} style={{ maxWidth: 90 }}
                         onChange={(e) => setForm({ ...form, numero: e.target.value })} />
                </div>

                <label className="fc-label">Ponto de referência</label>
                <input className="fc-input" value={form.referencia}
                       placeholder="casa de esquina, portão azul"
                       onChange={(e) => setForm({ ...form, referencia: e.target.value })} />
              </>
            )}

            <label className="fc-label">Como vai pagar</label>
            <select className="fc-input" value={form.pagamento}
                    onChange={(e) => setForm({ ...form, pagamento: e.target.value })}>
              <option value="pix">Pix na entrega</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="debito">Cartão de débito</option>
              <option value="credito">Cartão de crédito</option>
            </select>
            {form.pagamento === "dinheiro" && (
              <>
                <label className="fc-label">Troco para quanto?</label>
                <input className="fc-input" value={form.troco}
                       onChange={(e) => setForm({ ...form, troco: e.target.value })} />
              </>
            )}

            <label className="fc-label">Observação</label>
            <input className="fc-input" value={form.obs} placeholder="sem cebola, campainha quebrada"
                   onChange={(e) => setForm({ ...form, obs: e.target.value })} />
          </div>

          {/* ---------- total ---------- */}
          <div className="fc-bloco">
            <div className="fc-linha"><span>Itens</span><span>{money(subtotal)}</span></div>
            <div className="fc-linha">
              <span>{retirada ? "Retirada" : "Entrega"}</span>
              <span>{taxa > 0 ? money(taxa) : "grátis"}</span>
            </div>
            <div className="fc-hr" />
            <div className="fc-linha" style={{ fontSize: 17 }}><b>Total</b><b>{money(total)}</b></div>
          </div>

          {erro && <div className="fc-aviso" style={{ background: "#c62828" }}>{erro}</div>}
        </div>
      )}

      {carrinho.length > 0 && (
        <div className="fc-barra">
          <div className="fc-btn-linha">
            {etapa === "dados" && (
              <button className="fc-btn fc-btn-3" style={{ maxWidth: 130 }} onClick={() => setEtapa("cardapio")}>
                Voltar
              </button>
            )}
            <button className="fc-btn" disabled={enviando || (etapa === "dados" && !aberta)}
                    onClick={() => (etapa === "cardapio" ? setEtapa("dados") : enviar())}>
              {etapa === "cardapio"
                ? <>Continuar · {money(subtotal)}</>
                : enviando ? "Enviando..." : <>Enviar pedido · {money(total)}</>}
            </button>
          </div>
        </div>
      )}

      {aberto && (
        <div className="fc-modal" onClick={() => setAberto(null)}>
          <div className="fc-modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ position: "relative" }}>
              {aberto.imagem_url && <img src={aberto.imagem_url} alt="" className="fc-modal-foto" />}
              <button className="fc-fechar" onClick={() => setAberto(null)}>×</button>
            </div>
            <div className="fc-modal-corpo">
              <h2 style={{ fontSize: 20, margin: 0 }}>{aberto.nome}</h2>
              {aberto.descricao && (
                <p style={{ color: "var(--fc-muted)", fontSize: 14, margin: "6px 0 0" }}>{aberto.descricao}</p>
              )}
              <div className="fc-grupo-tit">Escolha o tamanho</div>
              {aberto.variacoes.map((v) => (
                <button key={v.id} className="fc-opcao" style={{ width: "100%", background: "none", border: "none", borderBottom: "1px solid var(--fc-line)" }}
                        onClick={() => add(aberto, v.id)}>
                  <span>{v.nome}</span>
                  <b>{money(Number(v.preco))}</b>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
