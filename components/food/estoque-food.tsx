"use client";

import { useCallback, useEffect, useState } from "react";
import { IcoAlert, IcoPlus } from "@/components/icons";
import { IcoEstoque } from "./icones";
import type { CardapioCategoria } from "@/lib/food-types";

// ============================================================================
// Estoque com ficha técnica. A venda não baixa "produto", baixa INSUMO pela
// receita: é o que dá CMV de verdade e é o que nenhum cardápio digital faz.
// ============================================================================

type Insumo = { id: string; nome: string; unidade: string; saldo: string; minimo: string; custo_medio: string };
type Ficha = { insumo_id: string; nome: string; unidade: string; quantidade: string; custo_medio: string };

const money = (v: number | string) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function EstoqueFood({ neg }: { neg: string }) {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [cmv, setCmv] = useState<{ custo: string; receita: string } | null>(null);
  const [cardapio, setCardapio] = useState<CardapioCategoria[]>([]);
  const [produtoId, setProdutoId] = useState("");
  const [ficha, setFicha] = useState<Ficha[]>([]);
  const [novo, setNovo] = useState({ nome: "", unidade: "kg", minimo: "" });
  const [entrada, setEntrada] = useState<Record<string, { qtd: string; custo: string }>>({});
  const [linhaFicha, setLinhaFicha] = useState({ insumoId: "", quantidade: "" });
  const [msg, setMsg] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const q = produtoId ? `&produto=${produtoId}` : "";
    const [a, b] = await Promise.all([
      fetch(`/api/food/painel?neg=${neg}&vista=estoque${q}`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/food/painel?neg=${neg}&vista=cardapio`, { cache: "no-store" }).then((r) => r.json()),
    ]);
    setInsumos(a.insumos ?? []); setCmv(a.cmv ?? null); setFicha(a.ficha ?? []);
    setCardapio(b.cardapio ?? []);
  }, [neg, produtoId]);

  useEffect(() => { carregar(); }, [carregar]);

  async function acao(payload: Record<string, unknown>) {
    await fetch("/api/food/painel", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ neg, ...payload }),
    });
    carregar();
  }
  function avisar(t: string) { setMsg(t); setTimeout(() => setMsg(null), 2500); }

  const custo = Number(cmv?.custo ?? 0);
  const receita = Number(cmv?.receita ?? 0);
  const pct = receita > 0 ? (custo / receita) * 100 : 0;
  const produtos = cardapio.flatMap((c) => c.produtos.map((p) => ({ id: p.id, nome: `${c.nome} · ${p.nome}` })));
  const custoFicha = ficha.reduce((s, f) => s + Number(f.quantidade) * Number(f.custo_medio), 0);
  const emFalta = insumos.filter((i) => Number(i.saldo) <= Number(i.minimo));

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Restaurante</span>
          <h1>Estoque</h1>
          <p className="muted">
            Cadastre o que você compra (insumo) e diga quanto cada prato consome. A venda baixa sozinha.
          </p>
        </div>
        {msg && <span className="badge ok">{msg}</span>}
      </div>

      <div className="cols-4" style={{ marginBottom: 16 }}>
        <div className="card"><div className="kpi">{money(custo)}</div><div className="kpi-label">Custo de insumo hoje</div></div>
        <div className="card"><div className="kpi">{money(receita)}</div><div className="kpi-label">Venda hoje</div></div>
        <div className="card">
          <div className="kpi" style={{ color: pct > 40 ? "var(--fd-primary)" : undefined }}>{pct.toFixed(1)}%</div>
          <div className="kpi-label">CMV do dia</div>
        </div>
        <div className="card">
          <div className="kpi" style={{ color: emFalta.length ? "var(--fd-warn)" : undefined }}>{emFalta.length}</div>
          <div className="kpi-label">Insumos no mínimo</div>
        </div>
      </div>

      {emFalta.length > 0 && (
        <div className="card" style={{ marginBottom: 16, borderColor: "#f2ddb5" }}>
          <div className="row">
            <span className="icon-box sm" style={{ background: "var(--fd-warn-soft)", borderColor: "#f2ddb5", color: "var(--fd-warn)" }}>
              <IcoAlert width={17} height={17} />
            </span>
            <div>
              <b>Precisa comprar</b>
              <div className="muted" style={{ fontSize: 13 }}>
                {emFalta.map((i) => i.nome).join(", ")}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="cols-2">
        {/* ---------- insumos ---------- */}
        <div className="card">
          <h2 style={{ fontSize: 16, margin: "0 0 4px" }}>Insumos</h2>
          <p className="muted" style={{ fontSize: 13, margin: "0 0 14px" }}>
            É o que entra pela porta: carne, batata, chope, embalagem. Ao comprar, lance a entrada para o
            custo médio ficar certo.
          </p>

          {insumos.map((i) => {
            const baixo = Number(i.saldo) <= Number(i.minimo);
            return (
              <div key={i.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--fd-line)" }}>
                <div className="spread">
                  <b>{i.nome}</b>
                  <span style={{ color: baixo ? "var(--fd-primary)" : undefined }}>
                    {Number(i.saldo).toFixed(3)} {i.unidade}
                    <span className="muted" style={{ fontSize: 12.5 }}> · {money(i.custo_medio)}/{i.unidade}</span>
                  </span>
                </div>
                <div className="row" style={{ gap: 6, marginTop: 8 }}>
                  <input placeholder="quantidade" type="number" step="0.001" style={{ maxWidth: 120 }}
                         value={entrada[i.id]?.qtd ?? ""}
                         onChange={(e) => setEntrada((s) => ({ ...s, [i.id]: { qtd: e.target.value, custo: s[i.id]?.custo ?? "" } }))} />
                  <input placeholder="custo por unidade" type="number" step="0.01" style={{ maxWidth: 150 }}
                         value={entrada[i.id]?.custo ?? ""}
                         onChange={(e) => setEntrada((s) => ({ ...s, [i.id]: { qtd: s[i.id]?.qtd ?? "", custo: e.target.value } }))} />
                  <button className="btn btn-ghost btn-sm"
                          onClick={() => {
                            const v = entrada[i.id];
                            if (!v?.qtd) return;
                            acao({ acao: "entrada_estoque", insumoId: i.id, quantidade: Number(v.qtd), custo: Number(v.custo || 0) });
                            setEntrada((s) => ({ ...s, [i.id]: { qtd: "", custo: "" } }));
                            avisar("Entrada lançada");
                          }}>
                    Lançar entrada
                  </button>
                </div>
              </div>
            );
          })}

          {!insumos.length && (
            <div style={{ textAlign: "center", padding: "28px 12px" }}>
              <span className="icon-box" style={{ margin: "0 auto 10px" }}><IcoEstoque /></span>
              <p className="muted" style={{ fontSize: 13.5, margin: 0 }}>
                Nenhum insumo cadastrado. Comece pelos três ou quatro que mais pesam no custo.
              </p>
            </div>
          )}

          <div className="row" style={{ gap: 6, marginTop: 14, flexWrap: "wrap" }}>
            <input placeholder="Novo insumo" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
                   style={{ maxWidth: 200 }} />
            <select value={novo.unidade} onChange={(e) => setNovo({ ...novo, unidade: e.target.value })} style={{ maxWidth: 90 }}>
              {["kg", "g", "l", "ml", "un"].map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <input placeholder="mínimo" type="number" step="0.001" value={novo.minimo}
                   onChange={(e) => setNovo({ ...novo, minimo: e.target.value })} style={{ maxWidth: 110 }} />
            <button className="btn btn-sm"
                    onClick={() => {
                      if (!novo.nome.trim()) return;
                      acao({ acao: "criar_insumo", nome: novo.nome.trim(), unidade: novo.unidade, minimo: Number(novo.minimo || 0) });
                      setNovo({ nome: "", unidade: "kg", minimo: "" });
                    }}>
              <IcoPlus width={15} height={15} /> Criar
            </button>
          </div>
        </div>

        {/* ---------- ficha técnica ---------- */}
        <div className="card">
          <h2 style={{ fontSize: 16, margin: "0 0 4px" }}>Ficha técnica</h2>
          <p className="muted" style={{ fontSize: 13, margin: "0 0 14px" }}>
            Diga quanto de cada insumo o prato usa. Aí toda venda baixa o estoque e você vê o custo real do prato.
          </p>

          <select value={produtoId} onChange={(e) => setProdutoId(e.target.value)}>
            <option value="">Escolha o produto</option>
            {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>

          {produtoId && (
            <div style={{ marginTop: 14 }}>
              {ficha.map((f) => (
                <div key={f.insumo_id} className="spread" style={{ padding: "7px 0", borderBottom: "1px solid var(--fd-line)" }}>
                  <span>{f.nome}</span>
                  <span className="row" style={{ gap: 10 }}>
                    <span className="muted">{Number(f.quantidade).toFixed(3)} {f.unidade}</span>
                    <b>{money(Number(f.quantidade) * Number(f.custo_medio))}</b>
                    <button className="btn btn-ghost btn-sm"
                            onClick={() => acao({ acao: "ficha_tecnica", produtoId, insumoId: f.insumo_id, quantidade: 0 })}>
                      Tirar
                    </button>
                  </span>
                </div>
              ))}

              {!ficha.length && (
                <p className="muted" style={{ fontSize: 13.5 }}>
                  Sem receita ainda. A venda deste item não baixa estoque.
                </p>
              )}

              {ficha.length > 0 && (
                <div className="glass-soft" style={{ padding: 12, borderRadius: 12, marginTop: 10 }}>
                  <div className="spread">
                    <b>Custo do prato</b>
                    <b className="gold">{money(custoFicha)}</b>
                  </div>
                </div>
              )}

              <div className="row" style={{ gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                <select value={linhaFicha.insumoId} style={{ maxWidth: 200 }}
                        onChange={(e) => setLinhaFicha({ ...linhaFicha, insumoId: e.target.value })}>
                  <option value="">Insumo</option>
                  {insumos.map((i) => <option key={i.id} value={i.id}>{i.nome} ({i.unidade})</option>)}
                </select>
                <input placeholder="quanto usa" type="number" step="0.001" value={linhaFicha.quantidade}
                       onChange={(e) => setLinhaFicha({ ...linhaFicha, quantidade: e.target.value })} style={{ maxWidth: 140 }} />
                <button className="btn btn-sm"
                        onClick={() => {
                          if (!linhaFicha.insumoId || !linhaFicha.quantidade) return;
                          acao({ acao: "ficha_tecnica", produtoId, insumoId: linhaFicha.insumoId, quantidade: Number(linhaFicha.quantidade) });
                          setLinhaFicha({ insumoId: "", quantidade: "" });
                        }}>
                  Ligar ao prato
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
