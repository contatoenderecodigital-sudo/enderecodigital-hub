"use client";

/**
 * Série de barras (caixa por mês/dia). Uma hue (magnitude), última barra
 * destacada como "atual", linha de média tracejada, tooltip por barra e
 * eixo Y em reais curtos. Substitui as barras desenhadas à mão no Financeiro.
 */
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartTheme, num, brlAxis } from "./theme";
import EmptyChart from "./EmptyChart";

export interface BarPoint {
  label: string;
  value: number;
}

export default function BarSeries({
  data,
  height = 220,
  hue,
  showAverage = true,
  emptyLabel = "Sem dados no período.",
}: {
  data: BarPoint[];
  height?: number;
  hue?: string;
  showAverage?: boolean;
  emptyLabel?: string;
}) {
  const t = useChartTheme();
  const color = hue ?? t.green;

  if (!data.length || data.every((d) => d.value === 0)) {
    return (
      <EmptyChart
        height={height}
        icon={
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <path d="M2 10h20M6 15h4" />
          </svg>
        }
      >
        {emptyLabel}
      </EmptyChart>
    );
  }

  const avg = data.reduce((s, d) => s + d.value, 0) / data.length;
  const lastIdx = data.length - 1;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 12, right: 8, left: 4, bottom: 0 }} barCategoryGap="22%">
        <CartesianGrid vertical={false} stroke={t.grid} strokeDasharray="3 6" />
        <XAxis dataKey="label" tick={{ fill: t.axis, fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={12} dy={6} />
        <YAxis tick={{ fill: t.axis, fontSize: 11 }} tickLine={false} axisLine={false} width={52} tickFormatter={brlAxis} tickCount={4} />
        {showAverage && avg > 0 && (
          <ReferenceLine y={avg} stroke={color} strokeDasharray="4 5" strokeOpacity={0.5} />
        )}
        <Tooltip
          cursor={{ fill: t.dark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)" }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <div style={{ background: t.tooltipBg, border: `1px solid ${t.tooltipBorder}`, boxShadow: t.tooltipShadow, borderRadius: 12, padding: "8px 12px", fontSize: 12.5 }}>
                <div style={{ color: t.ink2, marginBottom: 2 }}>{label}</div>
                <div style={{ color: t.ink, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>R$ {num.format(Number(payload[0].value))}</div>
              </div>
            );
          }}
        />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={44} isAnimationActive={false}>
          {data.map((_, i) => (
            <Cell key={i} fill={color} fillOpacity={i === lastIdx ? 1 : 0.55} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
