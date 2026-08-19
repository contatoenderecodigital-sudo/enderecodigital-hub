"use client";

/**
 * Rosca de composição (origem dos leads, formas de pagamento…) com legenda
 * rica ao lado: cada fatia tem nome + valor + % (codificação secundária que
 * torna a cor um reforço, não a única pista). Hover destaca fatia + linha da
 * legenda. Paleta categórica validada em theme.ts.
 */
import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { useChartTheme, num } from "./theme";
import EmptyChart from "./EmptyChart";

export interface Slice {
  label: string;
  value: number;
  /** rótulo do valor; padrão = contagem */
  valueLabel?: string;
}

export default function DonutBreakdown({
  slices,
  centerUnit = "leads",
  emptyLabel = "Sem dados. Os registros precisam de origem.",
}: {
  slices: Slice[];
  centerUnit?: string;
  emptyLabel?: string;
}) {
  const t = useChartTheme();
  const [hover, setHover] = useState<number | null>(null);
  const total = slices.reduce((s, x) => s + x.value, 0);

  if (!slices.length || total === 0) {
    return <EmptyChart height={200}>{emptyLabel}</EmptyChart>;
  }

  const top = slices.reduce((bi, s, i) => (s.value > slices[bi].value ? i : bi), 0);
  const activeIdx = hover ?? top;
  const active = slices[activeIdx];
  const activePct = Math.round((active.value / total) * 100);
  const color = (i: number) => t.categorical[i % t.categorical.length];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
      <div style={{ position: "relative", width: 190, height: 190, flexShrink: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={64}
              outerRadius={90}
              paddingAngle={2}
              stroke={t.surface}
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
            >
              {slices.map((_, i) => (
                <Cell
                  key={i}
                  fill={color(i)}
                  opacity={hover == null || hover === i ? 1 : 0.4}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  style={{ transition: "opacity .2s", cursor: "default" }}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.03em", color: t.ink, fontVariantNumeric: "tabular-nums" }}>{activePct}%</div>
          <div style={{ fontSize: 10.5, color: t.ink2, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600, maxWidth: 110, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {active.label}
          </div>
        </div>
      </div>

      <ul style={{ flex: 1, minWidth: 180, display: "flex", flexDirection: "column", gap: 11, margin: 0, padding: 0, listStyle: "none" }}>
        {slices.map((s, i) => {
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
          const on = hover === i;
          return (
            <li
              key={s.label}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", opacity: hover == null || on ? 1 : 0.55, transition: "opacity .2s", cursor: "default" }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: color(i), flexShrink: 0 }} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 500, color: t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
                  <span style={{ display: "block", fontSize: 11.5, color: t.ink2 }}>{s.valueLabel ?? `${num.format(s.value)} ${centerUnit}`}</span>
                </span>
              </span>
              <span style={{ textAlign: "right", flexShrink: 0 }}>
                <span style={{ display: "block", fontSize: 15, fontWeight: 700, color: t.ink, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.015em" }}>{num.format(s.value)}</span>
                <span style={{ display: "block", fontSize: 11, color: t.ink2, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{pct}%</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
