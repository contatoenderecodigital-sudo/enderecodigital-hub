"use client";

import { useState, useEffect, useCallback } from "react";
import type { FinanceiroV2Data, CaixaSerie } from "@/lib/groow/queries";
import PeriodSelector, { rangeFromPreset, type PeriodRange } from "@/components/groow/admin/PeriodSelector";
import BarSeries from "@/components/groow/admin/charts2/BarSeries";
import { parseValorBR } from "@/lib/groow/valor";

const brl0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

export default function FinanceiroTabs({ data }: { data: FinanceiroV2Data }) {
  const [view, setView] = useState<"recorrente" | "setup">("recorrente");
  const [tabelaFilter, setTabelaFilter] = useState<"todos" | "pago" | "proximo" | "atrasado">("todos");
  const [period, setPeriod] = useState<PeriodRange>(rangeFromPreset("30dias"));
  const [caixa, setCaixa] = useState<CaixaSerie | null>(null);
  const [novoLancamento, setNovoLancamento] = useState(false);
  const [pagos, setPagos] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState("");

  const isRecorrente = view === "recorrente";
  const tipoCaixa = isRecorrente ? "recorrente" : "setup";

  // Busca o caixa real (transações) do tipo da aba ativa
  const loadCaixa = useCallback(async (range: PeriodRange, tipo: string) => {
    const params = new URLSearchParams();
    if (range.from) params.set("from", range.from);
    if (range.to) params.set("to", range.to);
    params.set("tipo", tipo);
    try {
      const res = await fetch(`/api/admin/financeiro/caixa?${params}`);
      const json = await res.json();
      if (!json.error) setCaixa(json);
    } catch { /* mantém anterior */ }
  }, []);

  useEffect(() => { loadCaixa(period, tipoCaixa); }, [loadCaixa, period, tipoCaixa]);

  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(""), 2800); };

  const marcarPago = async (clienteId: number, empresa: string, valor: number) => {
    try {
      const res = await fetch("/api/admin/transacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cliente_id: clienteId, tipo: tipoCaixa, valor, descricao: `${isRecorrente ? "Mensalidade" : "Setup"} ${empresa}` }),
      });
      if (!res.ok) throw new Error();
      setPagos((p) => new Set(p).add(clienteId));
      showToast(`Pagamento de ${empresa} registrado · R$ ${brl0.format(valor)}`);
      loadCaixa(period, tipoCaixa);
    } catch { showToast("Erro ao registrar pagamento"); }
  };

  // Depois de lançar: leva pra visão onde o dinheiro aparece e, quando ele não
  // aparece em visão nenhuma, diz isso na cara em vez de só festejar "lançado!".
  const aposLancar = ({ tipo, data }: { tipo: string; data: string; valor: number }) => {
    setNovoLancamento(false);
    const alvo = tipo === "setup" ? "setup" : "recorrente";
    setView(alvo);
    // se a aba já era a alvo o effect não redispara, então recarrega na mão (mesmo tipo, sem corrida)
    loadCaixa(period, alvo);

    const foraDoPeriodo = Boolean(data) && ((period.from && data < period.from) || (period.to && data > period.to));
    if (tipo === "setup") {
      showToast("Lançado. A aba Entradas mostra o previsto pelos contratos, então o gráfico não muda.");
    } else if (tipo === "avulso" || tipo === "manual") {
      showToast("Lançado, mas avulso e outros não têm aba própria: só aparecem no relatório.");
    } else if (foraDoPeriodo) {
      showToast("Lançado. A data está fora do período selecionado, ajuste o período pra ver.");
    } else {
      showToast("Recebimento lançado!");
    }
  };

  const accent = "#34C759"; // caixa = verde (dinheiro recebido)
  const kpiAccent = "#0B1838"; // KPIs em navy (sem exagero de verde)
  const [paidClientes, setPaidClientes] = useState<Set<number>>(new Set());

  // Busca quem já foi marcado como pago no mês atual (do tipo da aba)
  useEffect(() => {
    const ini = new Date(); ini.setDate(1);
    const from = ini.toISOString().slice(0, 10);
    fetch(`/api/admin/transacoes?from=${from}`)
      .then((r) => r.json())
      .then((d) => {
        const ids = new Set<number>();
        for (const t of (d.transacoes || [])) {
          if (t.tipo === tipoCaixa && t.cliente_id) ids.add(Number(t.cliente_id));
        }
        setPaidClientes(ids);
      })
      .catch(() => {});
  }, [caixa, tipoCaixa]);

  const granularidade = caixa?.granularidade ?? "mes";
  const series = (caixa?.pontos ?? []).map((s) => ({ mes: s.label, faturamento: s.valor }));

  const isRecebido = (id: number) => pagos.has(id) || paidClientes.has(id);
  const filteredContratos = data.contratos.filter((c) => {
    // Aba Recorrente: só quem tem mensalidade. Aba Setup: só quem tem entrada.
    if (isRecorrente && c.valor <= 0) return false;
    if (!isRecorrente && c.valorSetup <= 0) return false;
    if (tabelaFilter === "todos") return true;
    if (tabelaFilter === "pago") return isRecebido(c.id);
    if (tabelaFilter === "proximo") return !isRecebido(c.id);
    return true;
  });

  return (
    <div>
      {/* VIEW TOGGLE + PERÍODO */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
      <div style={{ display: "inline-flex", background: "var(--ed2-card)", padding: 4, borderRadius: 999, gap: 4, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
        {([
          { key: "recorrente", label: "Recorrente", desc: `R$ ${brl0.format(data.mensal)}/mês` },
          { key: "setup", label: "Entradas (Setup)", desc: `R$ ${brl0.format(data.totalSetup)} total` },
        ] as const).map((tab) => {
          const isOn = view === tab.key;
          const tabAccent = tab.key === "recorrente" ? "#0B1838" : "#C9A961";
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setView(tab.key)}
              style={{
                all: "unset",
                cursor: "pointer",
                padding: "10px 20px",
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 600,
                color: isOn ? "#fff" : "var(--ed2-ink-2)",
                background: isOn ? tabAccent : "transparent",
                letterSpacing: "-0.005em",
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                transition: "all .18s",
              } as React.CSSProperties}
            >
              {tab.label}
              <span style={{
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 99,
                background: isOn ? "rgba(255,255,255,0.2)" : "var(--ed2-surface)",
                color: isOn ? "#fff" : "var(--ed2-ink-2)",
                fontWeight: 600,
              }}>
                {tab.desc}
              </span>
            </button>
          );
        })}
      </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* STATS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 18, marginBottom: 20 }}>
        {isRecorrente ? (
          <>
            <StatCard label="Mensal recorrente" value={`R$ ${brl0.format(data.mensal)}`} accent={kpiAccent} sub={data.maiorContrato ? `Maior: ${data.maiorContrato.empresa}` : `${data.ativos} contratos`} />
            <StatCard label="Trimestre" value={`R$ ${brl0.format(data.trimestral)}`} accent={kpiAccent} sub={`${data.ativos} contratos ativos`} />
            <StatCard label="Ticket médio" value={`R$ ${brl0.format(Math.round(data.ticketMedio))}`} accent={kpiAccent} sub="por contrato ativo" />
            <StatCard label="Acumulado histórico" value={`R$ ${brl0.format(Math.round(data.acumulado))}`} accent={kpiAccent} sub={`${data.totalContratos} contratos no histórico`} />
          </>
        ) : (
          <>
            <StatCard label="Total setup recebido" value={`R$ ${brl0.format(data.totalSetup)}`} accent={kpiAccent} sub="entradas únicas" />
            <StatCard label="Setup este mês" value={`R$ ${brl0.format(data.setupSeries[data.setupSeries.length - 1]?.faturamento ?? 0)}`} accent={kpiAccent} sub="contratos iniciados" />
            <StatCard label="Clientes com setup" value={String(data.contratos.filter(c => c.valorSetup > 0).length)} accent={kpiAccent} sub="planos com entrada" />
            <StatCard label="Receita total mês" value={`R$ ${brl0.format(data.mensal + (data.setupSeries[data.setupSeries.length - 1]?.faturamento ?? 0))}`} accent={kpiAccent} sub="recorrente + setup" />
          </>
        )}
      </div>

      {/* BAR CHART */}
      <div style={{ background: "var(--ed2-card)", borderRadius: 28, padding: 26, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", marginBottom: 18 }}>
        <div style={{ marginBottom: 16, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em" }}>
              Caixa {isRecorrente ? "recorrente" : "de setup"} · recebido · {period.label.toLowerCase()}
            </h3>
            <div style={{ fontSize: 13, color: "var(--ed2-ink-2)" }}>
              Total no período: <b style={{ color: "#1d8a3a" }}>R$ {brl0.format(caixa?.totalPeriodo ?? 0)}</b> · {granularidade === "dia" ? "por dia" : "por mês"}
            </div>
          </div>
          <button type="button" onClick={() => setNovoLancamento(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "var(--ed2-accent)", color: "var(--ed2-accent-ink)", border: "none", padding: "9px 16px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M8 3v10M3 8h10" /></svg>
            Lançar recebimento
          </button>
        </div>
        <BarSeries
          data={series.map((m) => ({ label: m.mes, value: m.faturamento }))}
          height={220}
          hue={accent}
          emptyLabel="Nenhum recebimento registrado neste período. Marque um contrato como pago ou lance um recebimento."
        />
      </div>

      {/* TABLE */}
      <div style={{ background: "var(--ed2-card)", borderRadius: 28, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden" }}>
        <div style={{ padding: "20px 24px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h3 style={{ margin: "0 0 2px", fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em" }}>
              {isRecorrente ? "Contratos recorrentes" : "Clientes com setup"}
            </h3>
            <div style={{ fontSize: 12, color: "var(--ed2-ink-2)" }}>
              {isRecorrente
                ? `${data.ativos} ativo${data.ativos !== 1 ? "s" : ""} · R$ ${brl0.format(data.mensal)}/mês recorrente`
                : `${data.contratos.filter(c => c.valorSetup > 0).length} cliente${data.contratos.filter(c => c.valorSetup > 0).length !== 1 ? "s" : ""} · R$ ${brl0.format(data.totalSetup)} em entradas únicas`}
            </div>
          </div>
          <div style={{ display: "inline-flex", background: "var(--ed2-surface)", padding: 3, borderRadius: 999, gap: 2 }}>
            {(["todos", "pago", "proximo"] as const).map((f) => {
              const labels = { todos: "Todos", pago: "Pago", proximo: "A receber", atrasado: "Atrasado" };
              const isOn = tabelaFilter === f;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setTabelaFilter(f)}
                  style={{ all: "unset", cursor: "pointer", padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: 600, color: isOn ? "var(--ed2-ink)" : "var(--ed2-ink-2)", background: isOn ? "var(--ed2-card)" : "transparent" } as React.CSSProperties}
                >
                  {labels[f]}
                </button>
              );
            })}
          </div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--ed2-surface-2)", borderBottom: "1px solid var(--ed2-hair)" }}>
              {["Empresa", "Plano", isRecorrente ? "Valor mensal" : "Setup", "Status", isRecorrente ? "Próximo vencimento" : "Cobrança", "Ação"].map((h, i) => (
                <th key={h} style={{ padding: "12px 16px", textAlign: i === 5 ? "right" : "left", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ed2-ink-2)", paddingLeft: i === 0 ? 24 : 16, paddingRight: i === 5 ? 24 : 16 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredContratos.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: "48px 24px", textAlign: "center", color: "var(--ed2-ink-2)" }}>Nenhum contrato.</td></tr>
            ) : filteredContratos.map((c) => {
              const dias = c.diasAteVencer;
              // Pago = tem recebimento registrado no mês (real), ou acabou de marcar
              const recebido = pagos.has(c.id) || paidClientes.has(c.id);
              const vencStr = dias < 0
                ? `Venceu há ${Math.abs(dias)} dia${dias === -1 ? "" : "s"}`
                : dias === 0 ? "Hoje"
                : dias === 1 ? "Amanhã"
                : `em ${dias} dias`;
              return (
                <tr key={c.id} style={{ borderBottom: "1px solid var(--ed2-hair)" }}>
                  <td style={{ padding: "14px 24px", fontWeight: 600 }}>{c.empresa}</td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ padding: "3px 10px", borderRadius: 99, background: "rgba(11,24,56,0.08)", color: "var(--ed2-ink)", fontSize: 12, fontWeight: 600 }}>{c.planoNome}</span>
                  </td>
                  <td style={{ padding: "14px 16px", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>R$ {brl0.format(isRecorrente ? c.valor : c.valorSetup)}</td>
                  <td style={{ padding: "14px 16px" }}>
                    {recebido ? (
                      <span style={{ padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 600, background: "rgba(52,199,89,0.12)", color: "#1d8a3a" }}>{isRecorrente ? "Pago este mês" : "Pago"}</span>
                    ) : (
                      <span style={{ padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 600, background: "rgba(255,159,10,0.12)", color: "#a85f00" }}>A receber</span>
                    )}
                  </td>
                  <td style={{ padding: "14px 16px", color: isRecorrente && dias < 0 ? "#c8261c" : "var(--ed2-ink-2)" }}>
                    {isRecorrente
                      ? `${new Date(c.proximoVencimento).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} · ${vencStr}`
                      : "Entrada única"}
                  </td>
                  <td style={{ padding: "14px 24px 14px 16px", textAlign: "right" }}>
                    {recebido ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "#1d8a3a" }}>
                        <svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="#1d8a3a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6l2.5 2.5L9.5 3.5" /></svg>
                        Recebido
                      </span>
                    ) : (
                      <button type="button" onClick={() => marcarPago(c.id, c.empresa, isRecorrente ? c.valor : c.valorSetup)}
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
      </div>

      {novoLancamento && (
        <NovoLancamentoModal
          clientes={data.contratos.map((c) => ({ id: c.id, empresa: c.empresa, valor: c.valor }))}
          onClose={() => setNovoLancamento(false)}
          onSaved={aposLancar}
        />
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 28, right: 28, zIndex: 999, display: "inline-flex", alignItems: "center", gap: 8, background: "#0B1838", color: "#F5F2EA", padding: "12px 18px", borderRadius: 14, fontSize: 13, fontWeight: 500, boxShadow: "0 8px 24px rgba(0,0,0,0.22)" }}>
          <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="#34C759" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6l2.5 2.5L9.5 3.5" /></svg> {toast}
        </div>
      )}
    </div>
  );
}

function NovoLancamentoModal({ clientes, onClose, onSaved }: { clientes: { id: number; empresa: string; valor: number }[]; onClose: () => void; onSaved: (info: { tipo: string; data: string; valor: number }) => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true); setError("");
    const fd = new FormData(e.currentTarget);
    const valor = parseValorBR(fd.get("valor"));
    if (!Number.isFinite(valor) || valor <= 0) { setError("Informe um valor válido."); setSaving(false); return; }
    const tipo = String(fd.get("tipo") || "manual");
    const data = String(fd.get("data") || "");
    try {
      const res = await fetch("/api/admin/transacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_id: fd.get("cliente_id") ? Number(fd.get("cliente_id")) : null,
          tipo,
          valor,
          descricao: String(fd.get("descricao") || "").trim(),
          data,
          forcar: true, // lançamento manual não pode ser engolido pela trava de duplicata
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Erro");
      onSaved({ tipo, data, valor });
    } catch (e) { setError(e instanceof Error ? e.message : "Erro"); }
    finally { setSaving(false); }
  };

  const iStyle: React.CSSProperties = { display: "block", width: "100%", borderRadius: 10, border: "1px solid var(--ed2-hair)", background: "var(--ed2-surface-2)", padding: "10px 12px", fontSize: 13, boxSizing: "border-box" };
  const lStyle: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 600, color: "var(--ed2-ink-2)", marginBottom: 5 };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 200, display: "grid", placeItems: "center", background: "rgba(11,24,56,0.45)", padding: 16 }}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 440, background: "var(--ed2-card)", borderRadius: 20, boxShadow: "0 24px 60px rgba(0,0,0,0.2)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid var(--ed2-hair)" }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Lançar recebimento</h3>
          <button type="button" onClick={onClose} style={{ all: "unset", cursor: "pointer", color: "var(--ed2-ink-2)" }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4l10 10M14 4L4 14" /></svg>
          </button>
        </div>
        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {/* text + inputMode decimal: type="number" devolve string vazia quando
                o valor tem vírgula, e "400,00" era recusado como valor inválido */}
            <div><label style={lStyle}>Valor (R$) *</label><input name="valor" type="text" inputMode="decimal" placeholder="400,00" style={iStyle} autoFocus /></div>
            <div><label style={lStyle}>Data</label><input name="data" type="date" defaultValue={new Date().toISOString().slice(0, 10)} style={iStyle} /></div>
          </div>
          <div>
            <label style={lStyle}>Tipo</label>
            <select name="tipo" style={{ ...iStyle, appearance: "auto" }}>
              <option value="recorrente">Mensalidade (recorrente)</option>
              <option value="setup">Setup / entrada</option>
              <option value="avulso">Avulso / projeto</option>
              <option value="manual">Outro</option>
            </select>
          </div>
          <div>
            <label style={lStyle}>Cliente (opcional)</label>
            <select name="cliente_id" style={{ ...iStyle, appearance: "auto" }}>
              <option value="">Nenhum</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.empresa}</option>)}
            </select>
          </div>
          <div><label style={lStyle}>Descrição</label><input name="descricao" placeholder="Ex: Mensalidade junho" style={iStyle} /></div>
        </div>
        {error ? <p style={{ padding: "0 22px", color: "#c8261c", fontSize: 12 }}>{error}</p> : null}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 22px", borderTop: "1px solid var(--ed2-hair)" }}>
          <button type="button" onClick={onClose} style={{ all: "unset", cursor: "pointer", padding: "9px 14px", color: "var(--ed2-ink-2)", fontSize: 13 }}>Cancelar</button>
          <button type="submit" disabled={saving} style={{ background: "#34C759", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Salvando…" : "Lançar"}
          </button>
        </div>
      </form>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; accent: string; sub: string }) {
  return (
    <div style={{ background: "var(--ed2-card)", borderRadius: 20, padding: "20px 22px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ed2-ink-2)", marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.025em", fontVariantNumeric: "tabular-nums", color: "var(--ed2-ink)" }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--ed2-ink-2)", marginTop: 6 }}>{sub}</div>
    </div>
  );
}
