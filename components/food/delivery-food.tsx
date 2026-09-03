"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "@/components/link";
import { IcoImpressora, IcoMoto, IcoRelogio } from "./icones";

// ============================================================================
// Delivery do dia: quem pediu, para onde vai, e em que pé está.
// Cada pedido anda por botões grandes, um por vez, na ordem da operação.
// ============================================================================

type Pedido = {
  id: string; numero_dia: number; status: string; total: string; taxa_entrega: string;
  criado_em: string; entrega_json: Record<string, unknown> | null;
  cliente_nome: string | null; telefone: string | null;
  bairro: string | null; entregador: string | null;
};
type Entregador = { id: string; nome: string };
type Bairro = { id: string; nome: string; taxa: string; tempo_min: number; ativo: boolean };

const money = (v: number | string) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const hora = (d: string) => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const minutos = (d: string) => Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 60000));

const ROTULO: Record<string, string> = {
  pendente: "esperando você aceitar", aprovado: "aceito", em_producao: "na cozinha",
  pronto: "pronto para sair", em_entrega: "a caminho", entregue: "entregue",
};

export default function DeliveryFood({ neg }: { neg: string }) {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [entregadores, setEntregadores] = useState<Entregador[]>([]);
  const [bairros, setBairros] = useState<Bairro[]>([]);
  const [escolha, setEscolha] = useState<Record<string, string>>({});
  const [loja, setLoja] = useState<{ slug: string } | null>(null);

  const carregar = useCallback(async () => {
    const r = await fetch(`/api/food/painel?neg=${neg}&vista=delivery`, { cache: "no-store" });
    if (!r.ok) return;
    const d = await r.json();
    setPedidos(d.pedidos ?? []); setEntregadores(d.entregadores ?? []);
    setBairros(d.bairros ?? []); setLoja(d.loja ?? null);
  }, [neg]);

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 10000);
    return () => clearInterval(t);
  }, [carregar]);

  async function acao(payload: Record<string, unknown>) {
    await fetch("/api/food/painel", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ neg, ...payload }),
    });
    carregar();
  }

  const emRota = pedidos.filter((p) => p.status === "em_entrega").length;
  const novos = pedidos.filter((p) => p.status === "pendente").length;

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Restaurante</span>
          <h1>Delivery</h1>
          <p className="muted">
            {loja
              ? <>Seu link de pedido: <code>/c/{loja.slug}/pedir</code>. É esse que vai na bio do Instagram.</>
              : "Pedidos que chegaram pelo seu link, sem comissão de aplicativo."}
          </p>
        </div>
        <div className="row">
          <span className="badge">{pedidos.length} hoje</span>
          {novos > 0 && <span className="badge warn">{novos} esperando</span>}
          {emRota > 0 && <span className="badge ok">{emRota} a caminho</span>}
        </div>
      </div>

      {!bairros.length && (
        <div className="card" style={{ marginBottom: 16, borderColor: "#f2ddb5" }}>
          <b>Falta cadastrar os bairros</b>
          <p className="muted" style={{ fontSize: 13.5, margin: "4px 0 10px" }}>
            Sem bairro e taxa, ninguém consegue fechar pedido de entrega, porque o sistema não sabe quanto
            cobrar de frete.
          </p>
          <Link className="btn btn-sm" href={`/food/${neg}/config`}>Cadastrar bairros</Link>
        </div>
      )}

      {!pedidos.length ? (
        <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <span className="icon-box" style={{ margin: "0 auto 12px" }}><IcoMoto /></span>
          <h2 style={{ fontSize: 19, margin: "0 0 6px" }}>Nenhum pedido de entrega hoje</h2>
          <p className="muted" style={{ fontSize: 13.5, maxWidth: 480, margin: "0 auto" }}>
            Divulgue o link do pedido online. Ele funciona no celular, sem instalar nada, e o cliente é seu,
            não do aplicativo.
          </p>
        </div>
      ) : (
        <div className="grid" style={{ gap: 12 }}>
          {pedidos.map((p) => {
            const end = (p.entrega_json ?? {}) as Record<string, string>;
            const atrasado = minutos(p.criado_em) > 45 && p.status !== "entregue";
            return (
              <div key={p.id} className="card" style={atrasado ? { borderColor: "#f2b8b5" } : undefined}>
                <div className="spread" style={{ flexWrap: "wrap", gap: 10 }}>
                  <div className="row">
                    <span className="icon-box sm">#{p.numero_dia}</span>
                    <div>
                      <b style={{ fontSize: 15.5 }}>{p.cliente_nome ?? "sem nome"}</b>
                      <div className="muted" style={{ fontSize: 12.5 }}>
                        {p.telefone ?? "sem telefone"} · {hora(p.criado_em)} · há {minutos(p.criado_em)} min
                      </div>
                    </div>
                  </div>
                  <span className={"badge" + (p.status === "pendente" ? " warn" : p.status === "entregue" ? " ok" : "")}>
                    {ROTULO[p.status] ?? p.status}
                  </span>
                </div>

                <div className="glass-soft" style={{ padding: 12, borderRadius: 12, margin: "12px 0" }}>
                  <div style={{ fontSize: 14 }}>
                    {end.tipo === "retirada"
                      ? <b>Retirada no balcão</b>
                      : <>
                          <b>{end.rua ? `${end.rua}, ${end.numero ?? "s/n"}` : "endereço não informado"}</b>
                          {p.bairro && <span className="muted"> · {p.bairro}</span>}
                          {end.referencia && <div className="muted" style={{ fontSize: 12.5 }}>{end.referencia}</div>}
                        </>}
                  </div>
                  <div className="spread" style={{ marginTop: 8, fontSize: 13.5 }}>
                    <span className="muted">
                      {end.pagamento ? `paga em ${end.pagamento}` : "pagamento não informado"}
                      {end.troco ? ` · troco para ${end.troco}` : ""}
                      {p.entregador ? ` · com ${p.entregador}` : ""}
                    </span>
                    <span>
                      entrega {money(p.taxa_entrega)} · <b>{money(p.total)}</b>
                    </span>
                  </div>
                </div>

                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  {p.status === "pendente" && (
                    <button className="btn" onClick={() => acao({ acao: "aprovar", pedidoId: p.id })}>
                      Aceitar e mandar para a cozinha
                    </button>
                  )}
                  {["aprovado", "em_producao"].includes(p.status) && (
                    <button className="btn" onClick={() => acao({ acao: "status_pedido", pedidoId: p.id, status: "pronto" })}>
                      Marcar pronto
                    </button>
                  )}
                  {p.status === "pronto" && (
                    <>
                      {entregadores.length > 0 && (
                        <select value={escolha[p.id] ?? ""} style={{ maxWidth: 180 }}
                                onChange={(e) => setEscolha((s) => ({ ...s, [p.id]: e.target.value }))}>
                          <option value="">Quem leva</option>
                          {entregadores.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
                        </select>
                      )}
                      <button className="btn"
                              onClick={() => acao({ acao: "despachar", pedidoId: p.id, entregadorId: escolha[p.id] || null })}>
                        <IcoMoto width={16} height={16} /> Saiu para entrega
                      </button>
                    </>
                  )}
                  {p.status === "em_entrega" && (
                    <button className="btn" onClick={() => acao({ acao: "status_pedido", pedidoId: p.id, status: "entregue" })}>
                      Entregue
                    </button>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={() => acao({ acao: "reimprimir", pedidoId: p.id })}>
                    <IcoImpressora width={15} height={15} /> Reimprimir
                  </button>
                  {p.status !== "entregue" && (
                    <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }}
                            onClick={() => { if (confirm(`Cancelar o pedido #${p.numero_dia}?`)) acao({ acao: "status_pedido", pedidoId: p.id, status: "cancelado" }); }}>
                      Cancelar
                    </button>
                  )}
                </div>

                {p.status === "em_entrega" && (
                  <p className="muted" style={{ fontSize: 12.5, margin: "10px 0 0", display: "flex", alignItems: "center", gap: 5 }}>
                    <IcoRelogio width={13} height={13} /> o cliente já foi avisado no WhatsApp que saiu para entrega
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
