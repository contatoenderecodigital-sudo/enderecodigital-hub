"use client";

// Faturamento do mês: número grande + delta + composição (recorrente/setup)
// em barras SÓLIDAS com bolinha de legenda. Antes eram barras hachuradas
// (verde 45° / azul tracejado) que pareciam rascunho.
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useChartTheme, brl0 } from "@/components/groow/admin/charts2/theme";

export interface VolumeRow {
  label: string;
  valor: number;
  tone: "green" | "blue";
}

export default function VolumeCard({
  title,
  total,
  deltaPct,
  rows,
  footnote,
}: {
  title: string;
  total: number;
  deltaPct: number | null;
  rows: VolumeRow[];
  footnote?: string;
}) {
  const t = useChartTheme();
  const up = (deltaPct ?? 0) >= 0;
  const denom = Math.max(1, ...rows.map((r) => r.valor), total);
  const toneColor = (tone: VolumeRow["tone"]) => (tone === "green" ? t.green : t.blue);

  return (
    <div className="ed2-card" style={{ padding: "22px 24px", display: "flex", flexDirection: "column" }}>
      <div style={{ fontSize: 15, fontWeight: 650, letterSpacing: "-0.01em" }}>{title}</div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0 4px", flexWrap: "wrap" }}>
        <span style={{ fontSize: 40, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1, fontVariantNumeric: "tabular-nums", color: t.ink }}>
          {brl0.format(total)}
        </span>
        {deltaPct != null && deltaPct !== 0 && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              fontSize: 12.5,
              fontWeight: 700,
              padding: "4px 9px",
              borderRadius: 99,
              background: up ? "var(--ed2-green-soft)" : "var(--ed2-red-soft)",
              color: up ? t.green : t.red,
            }}
          >
            {up ? <ArrowUpRight size={13} strokeWidth={2.5} aria-hidden /> : <ArrowDownRight size={13} strokeWidth={2.5} aria-hidden />}
            {Math.abs(deltaPct).toFixed(0)}%
          </span>
        )}
      </div>
      {footnote && <div style={{ fontSize: 12.5, color: t.ink2 }}>{footnote}</div>}

      <div style={{ height: 1, background: "var(--ed2-hair)", margin: "18px 0 6px" }} />

      <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", gap: 16, paddingTop: 8 }}>
        {rows.map((r) => {
          const pct = Math.max(0, Math.min(1, r.valor / denom));
          const c = toneColor(r.tone);
          return (
            <div key={r.label}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13.5, color: t.ink2 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 3, background: c }} />
                  {r.label}
                </span>
                <span style={{ fontSize: 13.5, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: t.ink }}>{brl0.format(r.valor)}</span>
              </div>
              <div style={{ height: 10, borderRadius: 99, background: t.dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.045)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.max(r.valor > 0 ? 4 : 0, pct * 100)}%`, borderRadius: 99, background: c, transition: "width .5s var(--ease-out, ease)" }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
