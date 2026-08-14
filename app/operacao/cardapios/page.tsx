"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, ListChecks, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

interface SecaoSel { titulo: string; itens: string[] }
interface Resposta {
  id: number; cliente: string; slug: string | null; total_itens: number;
  selecionados: SecaoSel[] | string; observacoes: string | null; lida: number; quando: string;
}

const card: React.CSSProperties = { background: "var(--ed2-card)", borderRadius: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" };

function parseSel(s: SecaoSel[] | string): SecaoSel[] {
  if (Array.isArray(s)) return s;
  try { const p = JSON.parse(s); return Array.isArray(p) ? p : []; } catch { return []; }
}

export default function CardapiosPage() {
  const [respostas, setRespostas] = useState<Resposta[]>([]);
  const [loading, setLoading] = useState(true);
  const [aberto, setAberto] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/cardapios");
      const d = await r.json();
      setRespostas(d.respostas || []);
    } catch { /* */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 42, fontWeight: 700, letterSpacing: "-0.035em", margin: "0 0 6px", lineHeight: 1.05 }}>Cardápios</h1>
          <div style={{ color: "var(--ed2-ink-2)", fontSize: 15 }}>O que cada cliente marcou que precisa, pronto pra montar a proposta</div>
        </div>
        <button type="button" onClick={load} disabled={loading}
          style={{ all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 999, fontSize: 13, fontWeight: 600, background: "var(--ed2-card)", color: "var(--ed2-ink)", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" } as React.CSSProperties}>
          <RefreshCw size={14} className={loading ? "animate-spin" : undefined} /> Atualizar
        </button>
      </div>

      {loading && !respostas.length ? (
        <div style={{ display: "grid", placeItems: "center", padding: "60px 0" }}><Loader2 className="animate-spin" style={{ color: "var(--ed2-ink-3)" }} /></div>
      ) : respostas.length === 0 ? (
        <div style={{ ...card, padding: 56, textAlign: "center" }}>
          <div style={{ width: 60, height: 60, borderRadius: 18, background: "rgba(201,169,97,0.14)", color: "var(--pill-gold-fg)", margin: "0 auto 14px", display: "grid", placeItems: "center" }}>
            <ListChecks size={26} strokeWidth={1.6} />
          </div>
          <h3 style={{ margin: 0, fontSize: 19, fontWeight: 600 }}>Nenhum cardápio preenchido ainda</h3>
          <p style={{ margin: "8px auto 0", color: "var(--ed2-ink-2)", fontSize: 14, maxWidth: 440, lineHeight: 1.55 }}>
            Mande o link da página do cliente (ex.: enderecodigital.com/leticia-nespolo). Quando ele marcar o que quer e enviar, aparece aqui.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {respostas.map((r) => {
            const secoes = parseSel(r.selecionados);
            const on = aberto === r.id;
            return (
              <div key={r.id} style={{ ...card, overflow: "hidden" }}>
                <button type="button" onClick={() => setAberto(on ? null : r.id)}
                  style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, width: "100%", boxSizing: "border-box", padding: "18px 22px" }}>
                  <span style={{ width: 44, height: 44, borderRadius: 13, background: "rgba(201,169,97,0.14)", color: "var(--pill-gold-fg)", display: "grid", placeItems: "center", flexShrink: 0, fontWeight: 800, fontSize: 16 }}>
                    {r.total_itens}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em" }}>{r.cliente}</span>
                    <span style={{ display: "block", fontSize: 12.5, color: "var(--ed2-ink-2)", marginTop: 2 }}>
                      {r.total_itens} {r.total_itens === 1 ? "item marcado" : "itens marcados"} · {r.quando}
                    </span>
                  </span>
                  {on ? <ChevronUp size={18} style={{ color: "var(--ed2-ink-3)" }} /> : <ChevronDown size={18} style={{ color: "var(--ed2-ink-3)" }} />}
                </button>

                {on && (
                  <div style={{ padding: "4px 22px 22px", borderTop: "1px solid var(--ed2-hair)" }}>
                    {secoes.length === 0 ? (
                      <p style={{ fontSize: 13.5, color: "var(--ed2-ink-2)", marginTop: 14 }}>Não marcou itens específicos. Vale chamar pra entender o que precisa.</p>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 18, marginTop: 16 }}>
                        {secoes.map((s) => (
                          <div key={s.titulo}>
                            <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--pill-gold-fg)", marginBottom: 8 }}>{s.titulo}</div>
                            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                              {s.itens.map((i) => (
                                <li key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13.5, lineHeight: 1.45 }}>
                                  <span style={{ color: "#34C759", flexShrink: 0, fontWeight: 800 }}>✓</span> {i}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}
                    {r.observacoes && (
                      <div style={{ marginTop: 18, padding: "13px 16px", borderRadius: 13, background: "var(--ed2-surface)" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ed2-ink-3)", marginBottom: 5 }}>Observação da cliente</div>
                        <div style={{ fontSize: 13.5, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{r.observacoes}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
