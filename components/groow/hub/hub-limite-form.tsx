"use client";

// Slider do limite GLOBAL de tokens do hub ("Ilimitado" / "Aplicar").
import { useState } from "react";
import { Check } from "lucide-react";
import { salvarLimiteHubAction } from "@/app/operacao/hub/actions";

const LIMITES = [0, 500_000, 1_000_000, 2_000_000, 5_000_000, 10_000_000, 20_000_000];

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(0) + "k";
  return String(n);
}

const iStyle: React.CSSProperties = { display: "block", width: "100%", borderRadius: 12, border: "1px solid var(--ed2-hair)", background: "var(--ed2-surface-2)", padding: "9px 11px", fontSize: 13.5, boxSizing: "border-box", color: "var(--ed2-ink)", textAlign: "right", fontVariantNumeric: "tabular-nums" };
const goldBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, background: "#C9A961", color: "#fff", border: "none", padding: "9px 16px", borderRadius: 999, fontWeight: 600, fontSize: 13, cursor: "pointer", boxShadow: "0 4px 12px rgba(201,169,97,0.28)" };

export default function HubLimiteForm({ inicial }: { inicial: number }) {
  const [limite, setLimite] = useState<number>(inicial);
  const idx = Math.max(0, LIMITES.indexOf(LIMITES.reduce((a, b) => (Math.abs(b - limite) < Math.abs(a - limite) ? b : a), LIMITES[0])));

  return (
    <form action={salvarLimiteHubAction} style={{ marginTop: 6 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.02em", color: "var(--ed2-ink-2)" }}>Limite global de tokens</span>
        <strong style={{ fontSize: 15, color: "var(--ed2-ink)", fontVariantNumeric: "tabular-nums" }}>{limite === 0 ? "Ilimitado" : `${fmt(limite)}`}</strong>
      </div>
      <input
        type="range"
        min={0}
        max={LIMITES.length - 1}
        step={1}
        value={idx}
        onChange={(e) => setLimite(LIMITES[Number(e.target.value)])}
        style={{ width: "100%", accentColor: "#C9A961" }}
        aria-label="Limite global de tokens do hub"
      />
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
        <input
          name="limite_tokens"
          value={limite}
          onChange={(e) => setLimite(Math.max(0, parseInt(e.target.value.replace(/[^\d]/g, "") || "0", 10)))}
          inputMode="numeric"
          style={{ ...iStyle, flex: 1 }}
        />
        <button type="submit" style={goldBtn}><Check size={14} /> Aplicar</button>
      </div>
      <div style={{ fontSize: 11, color: "var(--ed2-ink-2)", marginTop: 6 }}>0 = ilimitado. Teto de tokens somados de todos os clientes do hub.</div>
    </form>
  );
}
