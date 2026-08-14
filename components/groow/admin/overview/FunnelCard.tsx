"use client";

// Funil de leads - agora com FunnelBars (barras horizontais sólidas, conversão
// e drop-off por etapa). Antes eram barras verticais hachuradas 45°, que liam
// como "estimado/incompleto".
import FunnelBars, { type FunnelStage } from "@/components/groow/admin/charts2/FunnelBars";

export interface FunnelCardStage {
  label: string;
  count: number;
}

export default function FunnelCard({ stages, title = "Funil de leads" }: { stages: FunnelCardStage[]; title?: string }) {
  const data: FunnelStage[] = stages.map((s) => ({ label: s.label, count: s.count }));
  return (
    <div className="ed2-card" style={{ padding: "22px 24px 20px", display: "flex", flexDirection: "column" }}>
      <div style={{ fontSize: 15, fontWeight: 650, letterSpacing: "-0.01em", marginBottom: 18 }}>{title}</div>
      <FunnelBars stages={data} />
    </div>
  );
}
