"use client";

// Receita ao longo do tempo - agora com AreaTrend (Recharts): área dourada com
// gradiente, crosshair no hover e estado vazio de verdade. Antes era uma
// step-line rosa desenhada à mão que virava eletrocardiograma com poucos dados.
import AreaTrend, { type TrendPoint } from "@/components/groow/admin/charts2/AreaTrend";

export interface StepPoint {
  label: string;
  value: number;
}

export default function StepLineCard({
  title,
  points,
  valuePrefix = "",
}: {
  title: string;
  points: StepPoint[];
  valuePrefix?: string;
}) {
  const data: TrendPoint[] = points.map((p) => ({ label: p.label, value: p.value }));
  const kind = valuePrefix.trim().startsWith("R$") ? "brl" : "number";

  return (
    <div className="ed2-card" style={{ padding: "22px 24px 16px", display: "flex", flexDirection: "column" }}>
      <div style={{ fontSize: 15, fontWeight: 650, letterSpacing: "-0.01em", marginBottom: 8 }}>{title}</div>
      <AreaTrend data={data} kind={kind} height={188} emptyLabel="Sem receita registrada no período." />
    </div>
  );
}
