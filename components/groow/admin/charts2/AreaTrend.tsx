"use client";

/**
 * Série temporal (área com gradiente + linha) - para Receita/mês, Leads/semana.
 * Uma hue só (magnitude), crosshair + tooltip no hover, eixo Y enxuto, e um
 * estado vazio de verdade quando há menos de 2 pontos (não plota linha morta).
 */
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useId } from "react";
import { useChartTheme, num, brlAxis } from "./theme";
import EmptyChart from "./EmptyChart";

export interface TrendPoint {
  label: string;
  value: number;
}

export default function AreaTrend({
  data,
  height = 240,
  kind = "number",
  hue,
  emptyLabel = "Dados insuficientes. Aguardando mais períodos.",
}: {
  data: TrendPoint[];
  height?: number;
  kind?: "number" | "brl";
  /** cor da série; padrão = dourado da marca */
  hue?: string;
  emptyLabel?: string;
}) {
  const t = useChartTheme();
  const gid = useId().replace(/:/g, "");
  const color = hue ?? t.gold;
  const fmt = (v: number) => (kind === "brl" ? brlAxis(v) : num.format(v));
  const fmtFull = (v: number) =>
    kind === "brl" ? `R$ ${num.format(v)}` : num.format(v);

  const pointsWithData = data.filter((d) => d.value > 0).length;
  if (data.length < 2 || pointsWithData === 0) {
    return <EmptyChart height={height}>{emptyLabel}</EmptyChart>;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id={`area-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={t.grid} strokeDasharray="3 6" />
        <XAxis
          dataKey="label"
          tick={{ fill: t.axis, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          minTickGap={16}
          dy={6}
        />
        <YAxis
          tick={{ fill: t.axis, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={46}
          tickFormatter={fmt}
          tickCount={4}
        />
        <Tooltip
          cursor={{ stroke: t.axis, strokeWidth: 1, strokeDasharray: "3 4" }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <div
                style={{
                  background: t.tooltipBg,
                  border: `1px solid ${t.tooltipBorder}`,
                  boxShadow: t.tooltipShadow,
                  borderRadius: 12,
                  padding: "8px 12px",
                  fontSize: 12.5,
                }}
              >
                <div style={{ color: t.ink2, marginBottom: 2 }}>{label}</div>
                <div style={{ color: t.ink, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                  {fmtFull(Number(payload[0].value))}
                </div>
              </div>
            );
          }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill={`url(#area-${gid})`}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: t.surface, fill: color }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
