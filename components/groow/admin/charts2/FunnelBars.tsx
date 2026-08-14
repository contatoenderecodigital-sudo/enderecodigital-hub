"use client";

/**
 * Funil de conversão - barras horizontais SÓLIDAS (nada de hachura, que lia
 * como "estimado/incompleto"). Cada etapa mostra contagem, % do topo e a
 * queda para a etapa seguinte. Barras ancoradas, ponta arredondada, hover
 * com detalhe. Sequência de uma hue (dourado) escurecendo por profundidade -
 * magnitude, não identidade.
 */
import { useState } from "react";
import { useChartTheme, num } from "./theme";
import EmptyChart from "./EmptyChart";

export interface FunnelStage {
  label: string;
  count: number;
}

export default function FunnelBars({
  stages,
  emptyLabel = "Sem leads no período ainda.",
}: {
  stages: FunnelStage[];
  emptyLabel?: string;
}) {
  const t = useChartTheme();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...stages.map((s) => s.count));
  const topo = stages[0]?.count ?? 0;

  if (stages.every((s) => s.count === 0)) {
    return <EmptyChart height={200}>{emptyLabel}</EmptyChart>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {stages.map((s, i) => {
        const prev = i > 0 ? stages[i - 1].count : null;
        const conv = i === 0 ? 100 : prev && prev > 0 ? (s.count / prev) * 100 : 0;
        const drop = i === 0 ? 0 : 100 - conv;
        const pctTopo = topo > 0 ? (s.count / topo) * 100 : 0;
        // profundidade do funil = tom mais escuro do dourado
        const shade = 1 - i / Math.max(1, stages.length);
        const bar = `color-mix(in srgb, ${t.gold} ${Math.round(55 + shade * 45)}%, ${t.dark ? "#0A1428" : "#ffffff"})`;
        const w = s.count > 0 ? Math.max(4, (s.count / max) * 100) : 0;
        const on = hover === i;

        return (
          <div
            key={s.label}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            style={{ display: "flex", flexDirection: "column", gap: 6, cursor: "default" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: t.ink }}>{s.label}</span>
              <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <b style={{ fontSize: 17, fontWeight: 700, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em", color: t.ink }}>
                  {num.format(s.count)}
                </b>
                <span style={{ fontSize: 12, color: t.ink2, fontVariantNumeric: "tabular-nums" }}>{pctTopo.toFixed(0)}%</span>
              </span>
            </div>
            <div style={{ position: "relative", height: 12, borderRadius: 99, background: t.dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.045)" }}>
              <div
                style={{
                  height: "100%",
                  width: `${w}%`,
                  borderRadius: 99,
                  background: bar,
                  boxShadow: on ? `0 0 0 2px ${t.tooltipBg}, 0 0 0 3px ${t.gold}` : "none",
                  transition: "width .5s var(--ease-out, ease), box-shadow .2s",
                }}
              />
            </div>
            {i > 0 && (
              <div style={{ fontSize: 11.5, color: t.ink2, fontVariantNumeric: "tabular-nums" }}>
                {conv.toFixed(0)}% da etapa anterior
                {drop > 0 && <span style={{ color: t.red, fontWeight: 600 }}> · −{drop.toFixed(0)}%</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
