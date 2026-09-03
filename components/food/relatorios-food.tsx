"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { IcoAlert } from "@/components/icons";
import { IcoPanela, IcoRelogio } from "./icones";

// ============================================================================
// Relatórios.
//
// O resumo do dia (faturamento, ticket, top 10) todo sistema tem. O que ninguém
// mostra é o que a cozinha faz com o TEMPO, e é isso que decide se a casa
// precisa de mais gente na chapa ou se o problema é a fila do garçom.
//
// Tudo aqui sai da trilha de auditoria que o KDS grava a cada transição. Por
// isso não é estimativa: é o relógio da própria operação.
// ============================================================================

type Praca = {
  area_nome: string; itens: string; espera_media: string | null;
  preparo_medio: string | null; total_medio: string | null; p90: string | null;
  estourados: string; meta: string;
};
type Hora = { hora: string; pedidos: string; itens: string; total: string };
type Cancelado = { nome: string; vezes: string; valor: string; motivo: string | null; quem: string | null };
type Pessoa = { quem: string; papel: string | null; toques: string; cancelamentos: string; recebido: string; comandas: string };
type Relatorio = {
  periodo: { de: string; ate: string };
  totais: {
    pedidos: string; faturamento: string; ticket: string; itens: string;
    mesas: string; cancelados: string; descontos: string; servico: string;
  };
  canais: { canal: string; qtd: string; total: string }[];
  produtos: { nome: string; qtd: string; total: string }[];
  pracas: Praca[];
  horas: Hora[];
  cancelados: Cancelado[];
  pessoas: Pessoa[];
  retrabalho: { desfeitos: number; total: number; pct: number };
};

const money = (v: number | string) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const min = (v: string | null) => (v === null || v === "" ? "-" : `${Number(v).toFixed(1)} min`);

function diasAtras(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function RelatoriosFood({ neg }: { neg: string }) {
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [r, setR] = useState<Relatorio | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async (d?: string, a?: string) => {
    setCarregando(true);
    const q = new URLSearchParams({ neg, vista: "relatorio" });
    if (d) q.set("de", d);
    if (a) q.set("ate", a);
    const res = await fetch(`/api/food/painel?${q}`, { cache: "no-store" });
    if (res.ok) {
      const dados = await res.json();
      setR(dados.relatorio ?? null);
      if (dados.relatorio?.periodo) {
        setDe(dados.relatorio.periodo.de);
        setAte(dados.relatorio.periodo.ate);
      }
    }
    setCarregando(false);
  }, [neg]);

  useEffect(() => { carregar(); }, [carregar]);

  const picoDaHora = useMemo(() => {
    if (!r?.horas?.length) return 0;
    return Math.max(...r.horas.map((h) => Number(h.total)));
  }, [r]);

  const atalho = (rotulo: string, d: string, a: string) => (
    <button className="btn btn-ghost btn-sm" onClick={() => carregar(d, a)}>{rotulo}</button>
  );

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Restaurante</span>
          <h1>Relatórios</h1>
          <p className="muted">
            O que a casa fez, e quanto tempo levou. Os tempos saem do registro da
            própria cozinha, não de estimativa.
          </p>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          {atalho("Hoje", diasAtras(0), diasAtras(0))}
          {atalho("Ontem", diasAtras(1), diasAtras(1))}
          {atalho("7 dias", diasAtras(6), diasAtras(0))}
          {atalho("30 dias", diasAtras(29), diasAtras(0))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ margin: 0 }}>
            De
            <input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          </label>
          <label style={{ margin: 0 }}>
            Até
            <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          </label>
          <button className="btn btn-sm" onClick={() => carregar(de, ate)}>Ver</button>
          <span className="muted" style={{ fontSize: 12.5 }}>
            O dia vira à meia-noite da casa, no fuso dela.
          </span>
        </div>
      </div>

      {carregando && <div className="card"><span className="muted">Somando...</span></div>}

      {r && !carregando && (
        <>
          {/* ---------- os números do período ---------- */}
          <div className="cols-4" style={{ marginBottom: 18 }}>
            <div className="card">
              <div className="kpi">{money(r.totais.faturamento)}</div>
              <div className="kpi-label">Vendido</div>
            </div>
            <div className="card">
              <div className="kpi">{r.totais.pedidos}</div>
              <div className="kpi-label">Pedidos</div>
            </div>
            <div className="card">
              <div className="kpi">{money(r.totais.ticket)}</div>
              <div className="kpi-label">Ticket médio</div>
            </div>
            <div className="card">
              <div className="kpi">{r.totais.mesas}</div>
              <div className="kpi-label">Comandas</div>
            </div>
          </div>

          {/* ---------- tempo por praça: o coração do relatório ---------- */}
          <div className="card" style={{ marginBottom: 18 }}>
            <div className="row" style={{ marginBottom: 12 }}>
              <span className="icon-box sm"><IcoPanela width={17} height={17} /></span>
              <div>
                <b>Tempo por praça</b>
                <div className="muted" style={{ fontSize: 12.5 }}>
                  Espera é o tempo parado na fila antes de alguém encostar a mão.
                  Preparo é a cozinha de verdade. O cliente sente a soma dos dois.
                </div>
              </div>
            </div>
            {r.pracas.length === 0 ? (
              <span className="muted">Ninguém marcou pronto no período.</span>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="tabela">
                  <thead>
                    <tr>
                      <th>Praça</th><th>Itens</th><th>Espera</th><th>Preparo</th>
                      <th>Total</th><th>Pior 10%</th><th>Meta</th><th>Estourou</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.pracas.map((p) => {
                      const estourou = Number(p.estourados);
                      const ruim = estourou / Math.max(1, Number(p.itens)) > 0.2;
                      return (
                        <tr key={p.area_nome}>
                          <td><b>{p.area_nome}</b></td>
                          <td>{p.itens}</td>
                          <td>{min(p.espera_media)}</td>
                          <td>{min(p.preparo_medio)}</td>
                          <td><b>{min(p.total_medio)}</b></td>
                          <td className="muted">{min(p.p90)}</td>
                          <td className="muted">{p.meta} min</td>
                          <td>
                            {estourou > 0
                              ? <span className={"badge" + (ruim ? " warn" : "")}>{estourou}</span>
                              : <span className="muted">0</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ---------- curva por hora ---------- */}
          <div className="card" style={{ marginBottom: 18 }}>
            <div className="row" style={{ marginBottom: 12 }}>
              <span className="icon-box sm"><IcoRelogio width={17} height={17} /></span>
              <div>
                <b>Curva do dia</b>
                <div className="muted" style={{ fontSize: 12.5 }}>
                  Onde a casa ganha dinheiro e onde tem gente parada.
                </div>
              </div>
            </div>
            {r.horas.length === 0 ? (
              <span className="muted">Sem movimento no período.</span>
            ) : (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 140, overflowX: "auto" }}>
                {r.horas.map((h) => {
                  const alt = picoDaHora ? Math.max(4, (Number(h.total) / picoDaHora) * 120) : 4;
                  return (
                    <div key={h.hora} style={{ textAlign: "center", minWidth: 34 }}>
                      <div title={`${money(h.total)} em ${h.pedidos} pedido(s)`}
                           style={{
                             height: alt, background: "var(--gold)", borderRadius: 6,
                             opacity: 0.85, marginBottom: 4,
                           }} />
                      <div className="muted" style={{ fontSize: 11 }}>{h.hora}h</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="cols-2" style={{ marginBottom: 18 }}>
            {/* ---------- o que mais cancela ---------- */}
            <div className="card">
              <div className="row" style={{ marginBottom: 12 }}>
                <span className="icon-box sm"><IcoAlert width={17} height={17} /></span>
                <div>
                  <b>Mais cancelados</b>
                  <div className="muted" style={{ fontSize: 12.5 }}>
                    Com o motivo e quem cancelou. {r.totais.cancelados} item(ns) no período.
                  </div>
                </div>
              </div>
              {r.cancelados.length === 0 ? (
                <span className="muted">Nenhum cancelamento. Bom sinal.</span>
              ) : (
                <table className="tabela">
                  <thead><tr><th>Item</th><th>Vezes</th><th>Motivo</th><th>Quem</th></tr></thead>
                  <tbody>
                    {r.cancelados.map((c) => (
                      <tr key={c.nome}>
                        <td>{c.nome}</td>
                        <td>{c.vezes}</td>
                        <td className="muted">{c.motivo ?? "sem motivo"}</td>
                        <td className="muted">{c.quem ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* ---------- quem fez o quê ---------- */}
            <div className="card">
              <b>Quem trabalhou</b>
              <div className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>
                Toques na cozinha e dinheiro recebido, por pessoa.
              </div>
              {r.pessoas.length === 0 ? (
                <span className="muted">Ninguém abriu turno no período.</span>
              ) : (
                <table className="tabela">
                  <thead><tr><th>Pessoa</th><th>Toques</th><th>Cancelou</th><th>Recebeu</th></tr></thead>
                  <tbody>
                    {r.pessoas.map((p) => (
                      <tr key={p.quem}>
                        <td>
                          <b>{p.quem}</b>
                          {p.papel && <span className="muted" style={{ fontSize: 12 }}> · {p.papel}</span>}
                        </td>
                        <td>{p.toques}</td>
                        <td>{Number(p.cancelamentos) > 0 ? <span className="badge warn">{p.cancelamentos}</span> : "0"}</td>
                        <td>{money(p.recebido)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="cols-2">
            <div className="card">
              <b>Mais vendidos</b>
              <table className="tabela" style={{ marginTop: 10 }}>
                <thead><tr><th>Item</th><th>Qtd</th><th>Total</th></tr></thead>
                <tbody>
                  {r.produtos.map((p) => (
                    <tr key={p.nome}>
                      <td>{p.nome}</td>
                      <td>{Number(p.qtd)}</td>
                      <td>{money(p.total)}</td>
                    </tr>
                  ))}
                  {!r.produtos.length && <tr><td colSpan={3} className="muted">Nada vendido.</td></tr>}
                </tbody>
              </table>
            </div>

            <div className="card">
              <b>Por canal e sobre a conta</b>
              <table className="tabela" style={{ marginTop: 10 }}>
                <tbody>
                  {r.canais.map((c) => (
                    <tr key={c.canal}>
                      <td style={{ textTransform: "capitalize" }}>{c.canal}</td>
                      <td>{c.qtd}</td>
                      <td>{money(c.total)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="muted">Taxa de serviço</td>
                    <td />
                    <td>{money(r.totais.servico)}</td>
                  </tr>
                  <tr>
                    <td className="muted">Descontos dados</td>
                    <td />
                    <td>{money(r.totais.descontos)}</td>
                  </tr>
                  <tr>
                    <td className="muted">Retrabalho na cozinha</td>
                    <td />
                    <td>
                      {r.retrabalho.desfeitos} de {r.retrabalho.total} toques
                      {r.retrabalho.pct > 0 && <span className="muted"> ({r.retrabalho.pct}%)</span>}
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="muted" style={{ fontSize: 12.5, marginTop: 10, marginBottom: 0 }}>
                Retrabalho alto quer dizer tela sendo tocada errado, e costuma ser
                treinamento, não sistema.
              </p>
            </div>
          </div>
        </>
      )}
    </>
  );
}
