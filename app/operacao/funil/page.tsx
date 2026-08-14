"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Filter, TrendingUp, Users, XCircle, Trophy } from "lucide-react";

interface Etapa { chave: string; label: string; n: number }
interface Origem { origem: string; n: number; fechados: number }
interface Mes { mes: string; n: number; fechados: number }
interface Dados { total: number; fechados: number; perdidos: number; etapas: Etapa[]; porOrigem: Origem[]; porMes: Mes[] }

const MESES_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function mesLabel(m: string): string {
  const p = m.split("-");
  return `${MESES_ABREV[Number(p[1]) - 1] ?? p[1]}/${p[0]?.slice(2)}`;
}
function pct(parte: number, todo: number): string {
  if (!todo) return "0%";
  return `${Math.round((parte / todo) * 100)}%`;
}

const cardStyle: React.CSSProperties = { background: "var(--ed2-card)", borderRadius: 24, padding: "24px 26px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" };

export default function FunilPage() {
  const [dados, setDados] = useState<Dados | null>(null);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<"30d" | "90d" | "tudo">("90d");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/funil?periodo=${periodo}`);
      const d = await res.json();
      if (!d.error) setDados(d);
    } catch { /* */ } finally { setLoading(false); }
  }, [periodo]);

  useEffect(() => { load(); }, [load]);

  const maiorMes = Math.max(1, ...(dados?.porMes ?? []).map((m) => Number(m.n)));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 42, fontWeight: 700, letterSpacing: "-0.035em", margin: "0 0 6px", lineHeight: 1.05 }}>Funil &amp; Performance</h1>
          <div style={{ color: "var(--ed2-ink-2)", fontSize: 15 }}>Onde os leads travam e qual origem realmente fecha</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {(["30d", "90d", "tudo"] as const).map((p) => (
            <button key={p} type="button" onClick={() => setPeriodo(p)}
              style={{ all: "unset", cursor: "pointer", padding: "8px 16px", borderRadius: 999, fontSize: 13, fontWeight: 600, background: periodo === p ? "#0B1838" : "var(--ed2-card)", color: periodo === p ? "#F5F2EA" : "var(--ed2-ink-2)", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" } as React.CSSProperties}>
              {p === "tudo" ? "Tudo" : `Últimos ${p.replace("d", " dias")}`}
            </button>
          ))}
        </div>
      </div>

      {loading || !dados ? (
        <div style={{ display: "grid", placeItems: "center", padding: "60px 0" }}><Loader2 className="animate-spin" style={{ color: "var(--ed2-ink-3)" }} /></div>
      ) : dados.total === 0 ? (
        <div style={{ ...cardStyle, padding: 56, textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: "linear-gradient(135deg,rgba(201,169,97,0.16),rgba(201,169,97,0.06))", margin: "0 auto 16px", display: "grid", placeItems: "center", color: "var(--pill-gold-fg)" }}>
            <Filter size={28} strokeWidth={1.5} />
          </div>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Sem leads no período</h3>
          <p style={{ margin: "8px auto 0", color: "var(--ed2-ink-2)", fontSize: 14, maxWidth: 420 }}>
            Quando os leads entrarem (site, quiz, prospecção), o funil desenha sozinho aqui.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* cards resumo */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14 }}>
            {[
              { icone: Users, label: "Leads no período", valor: String(dados.total), cor: "var(--pill-blue-fg)", bg: "rgba(10,132,255,0.10)" },
              { icone: Trophy, label: "Fechados", valor: String(dados.fechados), cor: "var(--pill-green-fg)", bg: "rgba(52,199,89,0.12)" },
              { icone: TrendingUp, label: "Taxa de fechamento", valor: pct(dados.fechados, dados.total), cor: "var(--pill-gold-fg)", bg: "rgba(201,169,97,0.14)" },
              { icone: XCircle, label: "Perdidos / recusados", valor: String(dados.perdidos), cor: "var(--pill-red-fg)", bg: "rgba(255,59,48,0.10)" },
            ].map((c) => {
              const Icone = c.icone;
              return (
                <div key={c.label} style={{ ...cardStyle, padding: "18px 20px", display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 13, background: c.bg, color: c.cor, display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <Icone size={19} strokeWidth={1.8} aria-hidden />
                  </div>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1 }}>{c.valor}</div>
                    <div style={{ fontSize: 12, color: "var(--ed2-ink-2)", marginTop: 4 }}>{c.label}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* funil */}
          <div style={cardStyle}>
            <h2 style={{ margin: "0 0 18px", fontSize: 17, fontWeight: 700 }}>O funil, etapa por etapa</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {dados.etapas.map((e, i) => {
                const anterior = i > 0 ? dados.etapas[i - 1].n : e.n;
                const larg = dados.etapas[0].n ? Math.max(6, (e.n / dados.etapas[0].n) * 100) : 6;
                return (
                  <div key={e.chave}>
                    {i > 0 && (
                      <div style={{ fontSize: 11.5, color: "var(--ed2-ink-3)", fontWeight: 600, padding: "2px 0 6px 4px" }}>
                        {pct(e.n, anterior)} avançam desta etapa
                      </div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{
                        width: `${larg}%`, minWidth: 120, height: 44, borderRadius: 12,
                        background: e.chave === "fechado" ? "#34C759" : `rgba(11,24,56,${0.9 - i * 0.16})`,
                        color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "0 16px", fontSize: 13, fontWeight: 600, transition: "width .3s ease",
                      }}>
                        <span>{e.label}</span>
                        <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 800 }}>{e.n}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18 }}>
            {/* por origem */}
            <div style={cardStyle}>
              <h2 style={{ margin: "0 0 14px", fontSize: 17, fontWeight: 700 }}>Quem fecha, por origem</h2>
              {dados.porOrigem.length === 0 ? (
                <p style={{ fontSize: 13.5, color: "var(--ed2-ink-2)" }}>Sem dados de origem no período.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {dados.porOrigem.map((o) => (
                    <div key={o.origem} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--ed2-hair)", fontSize: 13.5 }}>
                      <span style={{ flex: 1, fontWeight: 600, textTransform: "capitalize" }}>{o.origem}</span>
                      <span style={{ color: "var(--ed2-ink-2)", fontVariantNumeric: "tabular-nums" }}>{o.n} leads</span>
                      <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", padding: "3px 10px", borderRadius: 99, fontSize: 12, background: Number(o.fechados) > 0 ? "rgba(52,199,89,0.12)" : "var(--ed2-surface)", color: Number(o.fechados) > 0 ? "var(--pill-green-fg)" : "var(--ed2-ink-3)" }}>
                        {o.fechados} fechado{Number(o.fechados) === 1 ? "" : "s"} ({pct(Number(o.fechados), Number(o.n))})
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* por mês */}
            <div style={cardStyle}>
              <h2 style={{ margin: "0 0 14px", fontSize: 17, fontWeight: 700 }}>Últimos 6 meses</h2>
              {dados.porMes.length === 0 ? (
                <p style={{ fontSize: 13.5, color: "var(--ed2-ink-2)" }}>Sem histórico ainda.</p>
              ) : (
                <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 180, padding: "0 4px" }}>
                  {dados.porMes.map((m) => (
                    <div key={m.mes} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{m.n}</span>
                      <div style={{ width: "100%", maxWidth: 44, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 2, height: "70%" }}>
                        <div title={`${m.fechados} fechados`} style={{ height: `${(Number(m.fechados) / maiorMes) * 100}%`, minHeight: Number(m.fechados) > 0 ? 5 : 0, background: "#34C759", borderRadius: 6 }} />
                        <div title={`${m.n} leads`} style={{ height: `${(Number(m.n) / maiorMes) * 100}%`, minHeight: 5, background: "rgba(11,24,56,0.75)", borderRadius: 6 }} />
                      </div>
                      <span style={{ fontSize: 11, color: "var(--ed2-ink-3)" }}>{mesLabel(m.mes)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 14, marginTop: 12, fontSize: 11.5, color: "var(--ed2-ink-2)" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: "rgba(11,24,56,0.75)" }} /> leads</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: "#34C759" }} /> fechados</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
