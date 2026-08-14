"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";

interface Cobranca {
  id: number;
  empresa: string;
  valor: number;
  diaCobranca: number;
  vencimento: string;
  status: "pago" | "atrasado" | "a_vencer";
  diasAteVencer: number;
}

interface AtrasoGlobal {
  clienteId: number;
  empresa: string;
  valor: number;
  mes: string;
  mesLabel: string;
  vencimento: string;
  diasAtraso: number;
}

const brl0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

const STATUS = {
  pago: { label: "Pago", bg: "rgba(52,199,89,0.12)", fg: "var(--pill-green-fg)" },
  atrasado: { label: "Atrasado", bg: "rgba(255,59,48,0.12)", fg: "var(--pill-red-fg)" },
  a_vencer: { label: "A vencer", bg: "rgba(255,159,10,0.12)", fg: "var(--pill-orange-fg)" },
};

function ymAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function shiftYm(ym: string, delta: number): string {
  const [a, m] = ym.split("-").map(Number);
  const d = new Date(a, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function CobrancasPage() {
  const [cobrancas, setCobrancas] = useState<Cobranca[]>([]);
  const [totalPrevisto, setTotalPrevisto] = useState(0);
  const [totalRecebido, setTotalRecebido] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<"todos" | "pago" | "atrasado" | "a_vencer">("todos");
  const [toast, setToast] = useState("");
  const [ym, setYm] = useState(ymAtual);
  const [label, setLabel] = useState("");
  // modo "geral": pendências vencidas de TODOS os meses, não só o mês navegado
  const [modo, setModo] = useState<"mes" | "geral">("mes");
  const [atrasados, setAtrasados] = useState<AtrasoGlobal[]>([]);
  const [totalAtrasado, setTotalAtrasado] = useState(0);

  const ehMesAtual = ym === ymAtual();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/cobrancas?ym=${ym}`);
      const d = await res.json();
      if (!d.error) {
        setCobrancas(d.cobrancas || []);
        setTotalPrevisto(d.totalPrevisto || 0);
        setTotalRecebido(d.totalRecebido || 0);
        setLabel(d.label || "");
      }
    } catch { /* */ } finally { setLoading(false); }
  }, [ym]);

  const loadAtrasados = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/cobrancas?atrasados=1");
      const d = await res.json();
      if (!d.error) {
        setAtrasados(d.atrasados || []);
        setTotalAtrasado(d.totalAtrasado || 0);
      }
    } catch { /* */ } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (modo === "geral") loadAtrasados();
    else load();
  }, [modo, load, loadAtrasados]);

  const registrarPagamento = async (clienteId: number, empresa: string, valor: number, dataVenc: string, refLabel: string) => {
    try {
      const res = await fetch("/api/admin/transacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cliente_id: clienteId, tipo: "recorrente", valor, descricao: `Mensalidade ${empresa} · ${refLabel}`, data: dataVenc }),
      });
      if (!res.ok) throw new Error();
      const d = await res.json().catch(() => ({}));
      // jaExistia = a API recusou duplicar a recorrente do mês; avisar em vez de fingir
      setToast(d.jaExistia
        ? `${empresa} já constava paga neste mês. Nada foi lançado de novo.`
        : `Pagamento de ${empresa} registrado · R$ ${brl0.format(valor)}`);
      setTimeout(() => setToast(""), 2800);
      if (modo === "geral") loadAtrasados(); else load();
    } catch { setToast("Erro ao registrar"); setTimeout(() => setToast(""), 2800); }
  };

  const marcarPago = (c: Cobranca) => registrarPagamento(c.id, c.empresa, c.valor, c.vencimento, label);

  const filtradas = cobrancas.filter((c) => filtro === "todos" || c.status === filtro);
  const pendente = totalPrevisto - totalRecebido;
  const pct = totalPrevisto > 0 ? Math.round((totalRecebido / totalPrevisto) * 100) : 0;

  const navBtn: React.CSSProperties = { all: "unset", cursor: "pointer", width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 999, background: "var(--ed2-card)", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", color: "var(--ed2-ink)" };

  return (
    <div>
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 42, fontWeight: 700, letterSpacing: "-0.035em", margin: "0 0 6px", lineHeight: 1.05 }}>Cobranças</h1>
          <div style={{ color: "var(--ed2-ink-2)", fontSize: 15 }}>
            {modo === "geral" ? "Pendências vencidas de todos os meses" : `${label || "-"} · controle de mensalidades recorrentes`}
          </div>
        </div>
        {/* Navegador de mês (só no modo mês) */}
        <div style={{ display: modo === "geral" ? "none" : "inline-flex", alignItems: "center", gap: 10 }}>
          <button type="button" aria-label="Mês anterior" onClick={() => setYm((v) => shiftYm(v, -1))} style={navBtn}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 4l-4 4 4 4" /></svg>
          </button>
          <div style={{ minWidth: 130, textAlign: "center", fontSize: 14, fontWeight: 600, color: "var(--ed2-ink)" }}>{label || "-"}</div>
          <button type="button" aria-label="Próximo mês" onClick={() => setYm((v) => shiftYm(v, 1))} style={navBtn}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4l4 4-4 4" /></svg>
          </button>
          {!ehMesAtual && (
            <button type="button" onClick={() => setYm(ymAtual())} style={{ all: "unset", cursor: "pointer", padding: "7px 14px", borderRadius: 999, background: "var(--ed2-accent)", color: "var(--ed2-accent-ink)", fontSize: 12, fontWeight: 600 }}>Hoje</button>
          )}
        </div>
      </div>

      {/* KPIs */}
      {modo === "geral" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 18, marginBottom: 22 }}>
          <div style={{ background: "var(--ed2-card)", borderRadius: 20, padding: "20px 22px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ed2-ink-2)", marginBottom: 10 }}>Total em atraso</div>
            <div style={{ fontSize: 28, fontWeight: 600, color: totalAtrasado > 0 ? "#c8261c" : "#1d8a3a" }}>R$ {brl0.format(totalAtrasado)}</div>
            <div style={{ fontSize: 12, color: "var(--ed2-ink-2)", marginTop: 6 }}>{atrasados.length} mensalidade{atrasados.length === 1 ? "" : "s"} vencida{atrasados.length === 1 ? "" : "s"}</div>
          </div>
          <div style={{ background: "var(--ed2-card)", borderRadius: 20, padding: "20px 22px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ed2-ink-2)", marginBottom: 10 }}>Clientes com pendência</div>
            <div style={{ fontSize: 28, fontWeight: 600, color: "var(--ed2-ink)" }}>{new Set(atrasados.map((a) => a.clienteId)).size}</div>
            <div style={{ fontSize: 12, color: "var(--ed2-ink-2)", marginTop: 6 }}>desde o início dos contratos</div>
          </div>
        </div>
      ) : (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18, marginBottom: 22 }}>
        <div style={{ background: "var(--ed2-card)", borderRadius: 20, padding: "20px 22px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ed2-ink-2)", marginBottom: 10 }}>Previsto no mês</div>
          <div style={{ fontSize: 28, fontWeight: 600, color: "var(--ed2-ink)" }}>R$ {brl0.format(totalPrevisto)}</div>
          <div style={{ fontSize: 12, color: "var(--ed2-ink-2)", marginTop: 6 }}>{cobrancas.length} contratos ativos</div>
        </div>
        <div style={{ background: "var(--ed2-card)", borderRadius: 20, padding: "20px 22px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ed2-ink-2)", marginBottom: 10 }}>Recebido</div>
          <div style={{ fontSize: 28, fontWeight: 600, color: "#1d8a3a" }}>R$ {brl0.format(totalRecebido)}</div>
          <div style={{ height: 6, background: "var(--ed2-surface)", borderRadius: 99, overflow: "hidden", marginTop: 10 }}>
            <div style={{ height: "100%", width: `${pct}%`, background: "#34C759", borderRadius: 99 }} />
          </div>
          <div style={{ fontSize: 12, color: "var(--ed2-ink-2)", marginTop: 6 }}>{pct}% do previsto</div>
        </div>
        <div style={{ background: "var(--ed2-card)", borderRadius: 20, padding: "20px 22px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ed2-ink-2)", marginBottom: 10 }}>A receber</div>
          <div style={{ fontSize: 28, fontWeight: 600, color: pendente > 0 ? "#a85f00" : "#0B1838" }}>R$ {brl0.format(pendente)}</div>
          <div style={{ fontSize: 12, color: "var(--ed2-ink-2)", marginTop: 6 }}>{cobrancas.filter((c) => c.status !== "pago").length} pendentes</div>
        </div>
      </div>
      )}

      {/* Filtro + modo */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        {modo === "mes" && (
          <div style={{ display: "inline-flex", background: "var(--ed2-card)", padding: 4, borderRadius: 999, gap: 2, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            {([["todos", "Todos"], ["atrasado", "Atrasados"], ["a_vencer", "A vencer"], ["pago", "Pagos"]] as const).map(([k, lbl]) => (
              <button key={k} type="button" onClick={() => setFiltro(k)}
                style={{ all: "unset", cursor: "pointer", padding: "8px 16px", borderRadius: 999, fontSize: 13, fontWeight: 600, color: filtro === k ? "var(--ed2-ink)" : "var(--ed2-ink-2)", background: filtro === k ? "var(--ed2-surface)" : "transparent" } as React.CSSProperties}>
                {lbl}
              </button>
            ))}
          </div>
        )}
        <button type="button" onClick={() => setModo((m) => (m === "geral" ? "mes" : "geral"))}
          style={{ all: "unset", cursor: "pointer", padding: "9px 18px", borderRadius: 999, fontSize: 13, fontWeight: 600, background: modo === "geral" ? "#c8261c" : "var(--ed2-card)", color: modo === "geral" ? "#fff" : "var(--ed2-ink-2)", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" } as React.CSSProperties}>
          {modo === "geral" ? "Voltar pro mês" : "Atrasados de todos os meses"}
        </button>
      </div>

      {/* Tabela */}
      <div style={{ background: "var(--ed2-card)", borderRadius: 28, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden" }}>
        {loading ? (
          <div style={{ display: "grid", placeItems: "center", padding: "60px 0" }}><Loader2 className="animate-spin" style={{ color: "var(--ed2-ink-3)" }} /></div>
        ) : modo === "geral" ? (
          atrasados.length === 0 ? (
            <div style={{ padding: "60px 24px", textAlign: "center", color: "var(--ed2-ink-2)" }}>Nenhuma mensalidade em atraso. Tudo em dia.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--ed2-surface-2)", borderBottom: "1px solid var(--ed2-hair)" }}>
                  {["Empresa", "Mês", "Valor", "Vencimento", "Atraso", "Ação"].map((h, i) => (
                    <th key={h} style={{ padding: "12px 16px", textAlign: i === 5 ? "right" : "left", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ed2-ink-2)", paddingLeft: i === 0 ? 24 : 16, paddingRight: i === 5 ? 24 : 16 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {atrasados.map((a) => (
                  <tr key={`${a.clienteId}-${a.mes}`} style={{ borderBottom: "1px solid var(--ed2-hair)" }}>
                    <td style={{ padding: "14px 24px", fontWeight: 600 }}>{a.empresa}</td>
                    <td style={{ padding: "14px 16px", color: "var(--ed2-ink-2)", textTransform: "capitalize" }}>{a.mesLabel}</td>
                    <td style={{ padding: "14px 16px", fontWeight: 600 }}>R$ {brl0.format(a.valor)}</td>
                    <td style={{ padding: "14px 16px", color: "var(--ed2-ink-2)" }}>{new Date(`${a.vencimento}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" })}</td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 600, background: "rgba(255,59,48,0.12)", color: "var(--pill-red-fg)" }}>há {a.diasAtraso}d</span>
                    </td>
                    <td style={{ padding: "14px 24px 14px 16px", textAlign: "right" }}>
                      <button type="button" onClick={() => registrarPagamento(a.clienteId, a.empresa, a.valor, a.vencimento, a.mesLabel)}
                        style={{ background: "#34C759", color: "#fff", border: "none", borderRadius: 999, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                        Marcar pago
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : filtradas.length === 0 ? (
          <div style={{ padding: "60px 24px", textAlign: "center", color: "var(--ed2-ink-2)" }}>Nenhuma cobrança {filtro !== "todos" ? "nesse filtro" : "- cadastre clientes ativos"}.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--ed2-surface-2)", borderBottom: "1px solid var(--ed2-hair)" }}>
                {["Empresa", "Valor", "Dia cobrança", "Vencimento", "Status", "Ação"].map((h, i) => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: i === 5 ? "right" : "left", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ed2-ink-2)", paddingLeft: i === 0 ? 24 : 16, paddingRight: i === 5 ? 24 : 16 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.map((c) => {
                const st = STATUS[c.status];
                const vencStr = c.diasAteVencer < 0 ? `há ${Math.abs(c.diasAteVencer)}d` : c.diasAteVencer === 0 ? "hoje" : `em ${c.diasAteVencer}d`;
                return (
                  <tr key={c.id} style={{ borderBottom: "1px solid var(--ed2-hair)" }}>
                    <td style={{ padding: "14px 24px", fontWeight: 600 }}>{c.empresa}</td>
                    <td style={{ padding: "14px 16px", fontWeight: 600 }}>R$ {brl0.format(c.valor)}</td>
                    <td style={{ padding: "14px 16px", color: "var(--ed2-ink-2)" }}>todo dia {c.diaCobranca}</td>
                    <td style={{ padding: "14px 16px", color: c.status === "atrasado" ? "#c8261c" : "var(--ed2-ink-2)" }}>
                      {new Date(c.vencimento).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} · {vencStr}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 600, background: st.bg, color: st.fg }}>{st.label}</span>
                    </td>
                    <td style={{ padding: "14px 24px 14px 16px", textAlign: "right" }}>
                      {c.status === "pago" ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "#1d8a3a" }}>
                          <svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="#1d8a3a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6l2.5 2.5L9.5 3.5" /></svg>
                          Recebido
                        </span>
                      ) : (
                        <button type="button" onClick={() => marcarPago(c)}
                          style={{ background: "#34C759", color: "#fff", border: "none", borderRadius: 999, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                          Marcar pago
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: 28, right: 28, zIndex: 999, display: "inline-flex", alignItems: "center", gap: 8, background: "#0B1838", color: "#F5F2EA", padding: "12px 18px", borderRadius: 14, fontSize: 13, fontWeight: 500, boxShadow: "0 8px 24px rgba(0,0,0,0.22)" }}>
          <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="#34C759" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6l2.5 2.5L9.5 3.5" /></svg> {toast}
        </div>
      )}
    </div>
  );
}
