"use client";

/**
 * Sparkline REAL (calculado a partir dos dados) para o canto dos stat cards.
 * Substitui os paths hardcoded que desenhavam sempre a mesma curva falsa.
 * Sem eixo, sem tooltip - é um enfeite honesto: se não há série, não desenha.
 */
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { useId } from "react";

export default function MiniSpark({
  data,
  color,
  width = 80,
  height = 30,
}: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  const gid = useId().replace(/:/g, "");
  if (!data || data.length < 2 || data.every((v) => v === 0)) return null;
  const points = data.map((v, i) => ({ i, v }));

  return (
    <div style={{ width, height }} aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`spark-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.75} fill={`url(#spark-${gid})`} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
