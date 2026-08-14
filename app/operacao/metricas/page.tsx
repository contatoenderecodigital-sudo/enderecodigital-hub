"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Users, Filter, Clock, TrendingUp } from "lucide-react";
import type { MetricasData, HeatmapCell } from "@/lib/groow/queries";
import { LEAD_STATUS_LABEL, type LeadStatus } from "@/lib/groow/types";
import PeriodSelector, { rangeFromPreset, type PeriodRange } from "@/components/groow/admin/PeriodSelector";
import AreaTrend from "@/components/groow/admin/charts2/AreaTrend";
import DonutBreakdown, { type Slice } from "@/components/groow/admin/charts2/DonutBreakdown";
import MiniSpark from "@/components/groow/admin/charts2/MiniSpark";
import { useChartTheme } from "@/components/groow/admin/charts2/theme";

const brl0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

const FUNNEL_COLORS: Record<string, string> = {
  novo: "var(--ed2-ink-2)", contatado: "#0A84FF", diagnostico: "#C9A961", proposta: "#FF9F0A", fechado: "#34C759",
};
const FUNNEL_GRADIENTS: Record<string, string> = {
  novo: "linear-gradient(90deg,#C7C7CC,#8E8E93)",
  contatado: "linear-gradient(90deg,#32ADE6,#0A84FF)",
  diagnostico: "linear-gradient(90deg,#e0c587,#C9A961)",
  proposta: "linear-gradient(90deg,#FFB84D,#FF9F0A)",
  fechado: "linear-gradient(90deg,#7BD389,#34C759)",
};

export default function MetricasPage() {
  const t = useChartTheme();
  const [period, setPeriod] = useState<PeriodRange>(rangeFromPreset("3meses"));
  const [data, setData] = useState<MetricasData>({ leadsPorSemana: [], funil: [], origens: [], tempoMedioFechar: null, faturamentoMensal: [], heatmap: [], ltvMedio: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (range: PeriodRange) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (range.from) params.set("from", range.from);
      if (range.to) params.set("to", range.to);
      const res = await fetch(`/api/admin/metricas?${params}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(period); }, [load, period]);

  const totalLeads = data.funil.reduce((s, f) => s + f.count, 0);
  const fechados = data.funil.find((f) => f.status === "fechado")?.count ?? 0;
  const topoFunil = data.funil[0]?.count ?? 0;
  const taxa = topoFunil > 0 ? (fechados / topoFunil) * 100 : 0;

  const mesAtualCap = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" }).replace(/^./, (c) => c.toUpperCase());

  const weeks = data.leadsPorSemana;
  const semanaMedia = Math.round(totalLeads / Math.max(1, weeks.length));
  const weekPeak = weeks.reduce((bi, w, i) => (w.leads > (weeks[bi]?.leads ?? 0) ? i : bi), 0);
  const leadSeries = weeks.map((w) => w.leads);
  const trendData = weeks.map((w) => ({ label: w.semana, value: w.leads }));

  // origens → fatias para a rosca
  const origemSlices: Slice[] = data.origens.map((o) => ({ label: o.origem, value: o.count }));

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24, gap: 24, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 42, fontWeight: 700, letterSpacing: "-0.035em", margin: "0 0 6px", lineHeight: 1.05 }}>Métricas</h1>
          <div style={{ color: "var(--ed2-ink-2)", fontSize: 15 }}>
            Visão analítica · {mesAtualCap} · <b style={{ color: "var(--ed2-ink)", fontWeight: 600 }}>{totalLeads}</b> leads no funil
          </div>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {loading && <div style={{ display: "grid", placeItems: "center", padding: "60px 0" }}><Loader2 className="animate-spin" style={{ color: "var(--ed2-ink-3)" }} /></div>}
      {!loading && error && <div style={{ background: "rgba(255,59,48,0.06)", border: "1px solid rgba(255,59,48,0.18)", borderRadius: 18, padding: "12px 18px", color: "#c8261c", fontSize: 13, marginBottom: 18 }}>{error}</div>}
      {!loading && !error && (<div>

      {/* STATS - sem deltas nem sparklines falsos: só o que é real */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 18, marginBottom: 20 }} className="ed2-met-stats">
        <Stat
          icoBg="linear-gradient(135deg,#34C759,#1d8a3a)"
          icon={<Users size={12} strokeWidth={2.2} />}
          label="Leads totais"
          value={String(totalLeads)}
          caption={<>média de <b style={{ color: "var(--ed2-ink)" }}>{semanaMedia}/semana</b></>}
          spark={leadSeries}
          sparkColor={t.green}
        />
        <Stat
          icoBg="linear-gradient(135deg,#C9A961,#a8893d)"
          icon={<Filter size={12} strokeWidth={2.2} />}
          label="Taxa de conversão"
          value={`${taxa.toFixed(1).replace(".", ",")}%`}
          caption={<>{fechados} de {topoFunil} leads · lead ate fechamento</>}
        />
        <Stat
          icoBg="linear-gradient(135deg,#0A84FF,#0858b0)"
          icon={<Clock size={12} strokeWidth={2.2} />}
          label="Tempo médio"
          value={data.tempoMedioFechar != null ? data.tempoMedioFechar.toFixed(0) : "-"}
          valueSuffix={data.tempoMedioFechar != null ? "dias" : undefined}
          caption="ciclo de vendas (contato ate fechamento)"
        />
        <Stat
          icoBg="linear-gradient(135deg,#5856D6,#3934a3)"
          icon={<TrendingUp size={12} strokeWidth={2.2} />}
          label="LTV médio"
          value={data.ltvMedio > 0 ? `R$ ${brl0.format(data.ltvMedio)}` : "-"}
          caption="por cliente · projeção 12 meses"
        />
      </div>

      {/* LINE CHART - AreaTrend real */}
      <div style={cardStyle}>
        <div style={chHead}>
          <div>
            <h3 style={chTitle}>Leads por semana</h3>
            <div style={chSub}>
              {weeks.length >= 2 ? <>Últimas {weeks.length} semanas · pico em <b style={{ color: "var(--ed2-ink)" }}>{weeks[weekPeak]?.semana}</b> ({weeks[weekPeak]?.leads} leads)</> : "Entrada de leads ao longo do tempo"}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{totalLeads}</div>
            <div style={{ fontSize: 12, color: "var(--ed2-ink-2)", marginTop: 2 }}>total · média {semanaMedia}/sem</div>
          </div>
        </div>
        <div style={{ marginTop: 8 }}>
          <AreaTrend data={trendData} height={240} kind="number" emptyLabel="Dados insuficientes. Aguardando mais semanas de leads." />
        </div>
      </div>

      {/* GRID 2 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 18 }} className="ed2-met-grid">

        {/* FUNIL */}
        <div style={cardStyle}>
          <div style={chHead}>
            <div>
              <h3 style={chTitle}>Funil de conversão</h3>
              <div style={chSub}>Lead ate fechamento</div>
            </div>
            {taxa > 0 && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: "var(--ed2-green-soft)", color: t.green }}>
                {taxa.toFixed(1).replace(".", ",")}% global
              </span>
            )}
          </div>
          {data.funil.every((f) => f.count === 0) ? (
            <p style={{ color: "var(--ed2-ink-2)", fontSize: 14, textAlign: "center", padding: "32px 0", margin: 0 }}>Sem leads ainda.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "8px 0 4px" }}>
              {data.funil.map((f, i) => {
                const prev = i > 0 ? data.funil[i - 1] : null;
                const drop = prev && prev.count > 0 ? ((prev.count - f.count) / prev.count) * 100 : 0;
                return (
                  <div key={f.status} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600 }}>
                        <span style={{ width: 9, height: 9, borderRadius: 99, background: FUNNEL_COLORS[f.status] ?? "var(--ed2-ink-3)" }} />
                        {LEAD_STATUS_LABEL[f.status as LeadStatus] ?? f.status}
                      </div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <span style={{ fontSize: 18, fontWeight: 600, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{f.count}</span>
                        <span style={{ fontSize: 12, color: "var(--ed2-ink-2)", fontWeight: 600 }}>{f.pct.toFixed(0)}%</span>
                      </div>
                    </div>
                    <div style={{ height: 10, background: "var(--ed2-surface)", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(100, Math.max(f.count > 0 ? 3 : 0, f.pct))}%`, borderRadius: 99, background: FUNNEL_GRADIENTS[f.status] ?? "linear-gradient(90deg,#C9A961,#a8893d)", transition: "width .5s var(--ease-out, ease)" }} />
                    </div>
                    {i > 0 && drop > 0 && (
                      <div style={{ fontSize: 11, color: "var(--ed2-ink-2)", fontWeight: 500, marginTop: 2 }}>queda de {drop.toFixed(0)}%</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ORIGENS - DonutBreakdown real */}
        <div style={cardStyle}>
          <div style={chHead}>
            <div>
              <h3 style={chTitle}>Origem dos leads</h3>
              <div style={chSub}>{origemSlices.reduce((s, o) => s + o.value, 0)} leads no período</div>
            </div>
          </div>
          <div style={{ paddingTop: 6 }}>
            <DonutBreakdown slices={origemSlices} centerUnit="leads" emptyLabel="Sem dados. Os leads precisam de origem registrada." />
          </div>
        </div>
      </div>

      {/* HEATMAP */}
      <div style={{ marginTop: 18 }}>
        <Heatmap cells={data.heatmap} />
      </div>

      <style>{`
        @media (max-width: 900px) { .ed2-met-grid { grid-template-columns: 1fr !important; } }
        @media (max-width: 720px) { .ed2-met-stats { grid-template-columns: 1fr 1fr !important; } }
      `}</style>
      </div>)}
    </div>
  );
}

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function Heatmap({ cells }: { cells: HeatmapCell[] }) {
  const maxCount = Math.max(1, ...cells.map((c) => c.count));
  const getCount = (dow: number, hour: number) => cells.find((c) => c.dow === dow && c.hour === hour)?.count ?? 0;
  const intensity = (count: number) => count / maxCount;
  const color = (i: number) => {
    if (i === 0) return "#F0FDF4";
    if (i < 0.25) return "#BBF7D0";
    if (i < 0.5) return "#4ADE80";
    if (i < 0.75) return "#16A34A";
    return "#166534";
  };
  const totalInteractions = cells.reduce((s, c) => s + c.count, 0);

  return (
    <div style={{ background: "var(--ed2-card)", borderRadius: 28, padding: 26, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: "-0.02em" }}>Mapa de calor de atividade</h3>
          <div style={{ fontSize: 13, color: "var(--ed2-ink-2)", marginTop: 4 }}>
            Quando seus leads respondem · 90 dias{totalInteractions > 0 ? ` · ${totalInteractions} interações` : " · sem dados ainda"}
          </div>
        </div>
      </div>

      {totalInteractions === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 0", color: "var(--ed2-ink-3)", gap: 10 }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
          <span style={{ fontSize: 13 }}>Dados aparecerão quando o Evolution API estiver ativo</span>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "40px repeat(24, 1fr)", gap: 3, minWidth: 600 }}>
            <div />
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} style={{ fontSize: 10, color: h % 3 === 0 ? "var(--ed2-ink-2)" : "transparent", textAlign: "center", fontWeight: 500, paddingBottom: 4 }}>
                {h % 3 === 0 ? `${h}h` : ""}
              </div>
            ))}
            {[1, 2, 3, 4, 5, 6, 7].map((dow) => (
              <div key={`row-${dow}`} style={{ display: "contents" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ed2-ink-2)", display: "flex", alignItems: "center" }}>{DAYS[dow - 1]}</div>
                {Array.from({ length: 24 }, (_, h) => {
                  const count = getCount(dow, h);
                  const iv = intensity(count);
                  return (
                    <div
                      key={`${dow}-${h}`}
                      title={count > 0 ? `${DAYS[dow - 1]} ${h}h: ${count} mensagens` : undefined}
                      style={{ height: 22, borderRadius: 4, background: count > 0 ? color(iv) : "var(--ed2-surface)" }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 14, justifyContent: "flex-end" }}>
            <span style={{ fontSize: 11, color: "var(--ed2-ink-2)" }}>Menos</span>
            {[0, 0.2, 0.4, 0.65, 1].map((iv, i) => (
              <div key={i} style={{ width: 14, height: 14, borderRadius: 3, background: color(iv) }} />
            ))}
            <span style={{ fontSize: 11, color: "var(--ed2-ink-2)" }}>Mais</span>
          </div>
        </div>
      )}
    </div>
  );
}

const cardStyle: React.CSSProperties = { background: "var(--ed2-card)", borderRadius: 28, padding: 26, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" };
const chHead: React.CSSProperties = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14, gap: 16 };
const chTitle: React.CSSProperties = { margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: "-0.02em" };
const chSub: React.CSSProperties = { fontSize: 13, color: "var(--ed2-ink-2)", marginTop: 4 };

function Stat({ icoBg, icon, label, value, valueSuffix, caption, spark, sparkColor }: { icoBg: string; icon: React.ReactNode; label: string; value: string; valueSuffix?: string; caption?: React.ReactNode; spark?: number[]; sparkColor?: string }) {
  return (
    <div style={{ background: "var(--ed2-card)", borderRadius: 24, padding: "22px 24px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column", gap: 10, position: "relative", overflow: "hidden", minHeight: 132 }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ed2-ink-2)", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 22, height: 22, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", background: icoBg }}>{icon}</span>
        {label}
      </div>
      <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>
        {value}{valueSuffix ? <span style={{ fontSize: 18, fontWeight: 500, color: "var(--ed2-ink-2)", marginLeft: 6 }}>{valueSuffix}</span> : null}
      </div>
      {caption ? <div style={{ fontSize: 12, color: "var(--ed2-ink-2)", marginTop: "auto" }}>{caption}</div> : null}
      {spark && sparkColor ? (
        <div style={{ position: "absolute", right: 16, bottom: 14, opacity: 0.75 }}>
          <MiniSpark data={spark} color={sparkColor} width={72} height={26} />
        </div>
      ) : null}
    </div>
  );
}
