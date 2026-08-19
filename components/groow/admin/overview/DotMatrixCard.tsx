"use client";

// Volume por período (Leads/semana, Pipeline/mês): número grande + delta vs
// período anterior + sparkline REAL da série. Antes era uma matriz de bolinhas
// que quase não mostrava nada com poucos dados.
import Link from "next/link";
import { ArrowUpRight, ArrowDownRight, ChevronRight } from "lucide-react";
import MiniSpark from "@/components/groow/admin/charts2/MiniSpark";
import { useChartTheme } from "@/components/groow/admin/charts2/theme";

export interface DotColumn {
  label: string;
  value: number;
}

export default function DotMatrixCard({
  title,
  bigValue,
  peakLabel,
  delta,
  columns,
  color,
  href,
}: {
  title: string;
  bigValue: string;
  peakLabel: string;
  delta: { text: string; up: boolean } | null;
  columns: DotColumn[];
  color: string;
  href?: string;
}) {
  const t = useChartTheme();
  const series = columns.map((c) => c.value);
  const hasData = series.some((v) => v > 0);

  const inner = (
    <div className="ed2-card" style={{ padding: "18px 22px 16px", flex: 1, ...(href ? { cursor: "pointer", transition: "transform .15s ease, box-shadow .15s ease" } : {}) }}>
      <div style={{ fontSize: 15, fontWeight: 650, letterSpacing: "-0.01em", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span>{title}</span>
        {href && <ChevronRight size={15} strokeWidth={2.2} style={{ color: t.ink2, flexShrink: 0 }} aria-hidden />}
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1, fontVariantNumeric: "tabular-nums", color: t.ink }}>
            {bigValue}
          </div>
          <div style={{ fontSize: 11.5, color: t.ink2, marginTop: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {hasData && <span>Pico: <b style={{ color: t.ink, fontWeight: 650 }}>{peakLabel}</b></span>}
            {delta && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontWeight: 700, color: delta.up ? t.green : t.red, fontVariantNumeric: "tabular-nums" }}>
                {delta.up ? <ArrowUpRight size={12} strokeWidth={2.5} aria-hidden /> : <ArrowDownRight size={12} strokeWidth={2.5} aria-hidden />}
                {delta.text}
              </span>
            )}
          </div>
        </div>
        <div style={{ flexShrink: 0 }}>
          <MiniSpark data={series} color={color} width={110} height={40} />
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} style={{ textDecoration: "none", color: "inherit", display: "flex", flex: 1 }}>
        {inner}
      </Link>
    );
  }
  return inner;
}
