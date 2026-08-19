"use client";

import { useEffect, useRef, useState } from "react";

export interface PeriodRange {
  preset: string;
  from: string | null; // ISO date (YYYY-MM-DD) ou null = sem limite
  to: string | null;
  label: string;
}

const PRESETS: { key: string; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "ontem", label: "Ontem" },
  { key: "7dias", label: "Últimos 7 dias" },
  { key: "15dias", label: "Últimos 15 dias" },
  { key: "30dias", label: "Últimos 30 dias" },
  { key: "este_mes", label: "Este mês" },
  { key: "mes_passado", label: "Mês passado" },
  { key: "3meses", label: "Últimos 3 meses" },
  { key: "6meses", label: "Últimos 6 meses" },
  { key: "ano", label: "Último ano" },
  { key: "tudo", label: "Tudo" },
];

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

export function rangeFromPreset(preset: string): PeriodRange {
  const hoje = new Date();
  const t = iso(hoje);
  switch (preset) {
    case "hoje": return { preset, from: t, to: t, label: "Hoje" };
    case "ontem": { const y = iso(daysAgo(1)); return { preset, from: y, to: y, label: "Ontem" }; }
    case "7dias": return { preset, from: iso(daysAgo(7)), to: t, label: "Últimos 7 dias" };
    case "15dias": return { preset, from: iso(daysAgo(15)), to: t, label: "Últimos 15 dias" };
    case "30dias": return { preset, from: iso(daysAgo(30)), to: t, label: "Últimos 30 dias" };
    case "este_mes": return { preset, from: iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), to: t, label: "Este mês" };
    case "mes_passado": {
      const ini = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
      const fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
      return { preset, from: iso(ini), to: iso(fim), label: "Mês passado" };
    }
    case "3meses": return { preset, from: iso(daysAgo(90)), to: t, label: "Últimos 3 meses" };
    case "6meses": return { preset, from: iso(daysAgo(180)), to: t, label: "Últimos 6 meses" };
    case "ano": return { preset, from: iso(daysAgo(365)), to: t, label: "Último ano" };
    case "tudo": return { preset, from: null, to: null, label: "Todo período" };
    default: return { preset: "30dias", from: iso(daysAgo(30)), to: t, label: "Últimos 30 dias" };
  }
}

export default function PeriodSelector({ value, onChange, presets }: { value: PeriodRange; onChange: (r: PeriodRange) => void; presets?: string[] }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [cFrom, setCFrom] = useState(value.from || iso(daysAgo(30)));
  const [cTo, setCTo] = useState(value.to || iso(new Date()));
  const ref = useRef<HTMLDivElement>(null);

  const lista = presets ? PRESETS.filter((p) => presets.includes(p.key)) : PRESETS;

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setCustom(false); } };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const aplicarCustom = () => {
    onChange({
      preset: "custom",
      from: cFrom,
      to: cTo,
      label: `${new Date(cFrom + "T00:00").toLocaleDateString("pt-BR")} - ${new Date(cTo + "T00:00").toLocaleDateString("pt-BR")}`,
    });
    setOpen(false);
    setCustom(false);
  };

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button type="button" onClick={() => setOpen((v) => !v)}
        style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--ed2-card)", border: "1px solid var(--ed2-hair)", borderRadius: 999, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", whiteSpace: "nowrap", color: "var(--ed2-ink)" }}>
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="#1d8a3a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="12" height="11" rx="2" /><path d="M2 6h12M5 1v4M11 1v4" /></svg>
        {value.label}
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6l4 4 4-4" /></svg>
      </button>

      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: "var(--ed2-card)", borderRadius: 14, boxShadow: "0 8px 28px rgba(0,0,0,0.16)", border: "1px solid var(--ed2-hair)", minWidth: 230, zIndex: 100, overflow: "hidden", padding: 6 }}>
          {!custom ? (
            <>
              {lista.map((p) => {
                const isOn = value.preset === p.key;
                return (
                  <button key={p.key} type="button" onClick={() => { onChange(rangeFromPreset(p.key)); setOpen(false); }}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "10px 12px", borderRadius: 9, background: isOn ? "rgba(52,199,89,0.1)" : "none", border: "none", cursor: "pointer", fontSize: 13.5, fontWeight: isOn ? 600 : 500, color: isOn ? "#1d8a3a" : "var(--ed2-ink)", textAlign: "left" }}
                    onMouseEnter={(e) => { if (!isOn) e.currentTarget.style.background = "var(--ed2-surface-2)"; }}
                    onMouseLeave={(e) => { if (!isOn) e.currentTarget.style.background = "none"; }}>
                    {p.label}
                    {isOn && <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="#1d8a3a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6l2.5 2.5L9.5 3.5" /></svg>}
                  </button>
                );
              })}
              <div style={{ height: 1, background: "rgba(0,0,0,0.06)", margin: "5px 0" }} />
              <button type="button" onClick={() => setCustom(true)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "10px 12px", borderRadius: 9, background: value.preset === "custom" ? "rgba(52,199,89,0.1)" : "none", border: "none", cursor: "pointer", fontSize: 13.5, fontWeight: 500, color: "var(--ed2-ink)", textAlign: "left" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ed2-surface-2)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = value.preset === "custom" ? "rgba(52,199,89,0.1)" : "none")}>
                Personalizado
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4l4 4-4 4" /></svg>
              </button>
            </>
          ) : (
            <div style={{ padding: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ed2-ink-2)", marginBottom: 10, letterSpacing: "0.03em" }}>PERÍODO PERSONALIZADO</div>
              <label style={{ display: "block", fontSize: 11, color: "var(--ed2-ink-2)", marginBottom: 4 }}>De</label>
              <input type="date" value={cFrom} max={cTo} onChange={(e) => setCFrom(e.target.value)} style={{ width: "100%", borderRadius: 9, border: "1px solid var(--ed2-hair)", padding: "8px 10px", fontSize: 13, boxSizing: "border-box", marginBottom: 10 }} />
              <label style={{ display: "block", fontSize: 11, color: "var(--ed2-ink-2)", marginBottom: 4 }}>Até</label>
              <input type="date" value={cTo} min={cFrom} max={iso(new Date())} onChange={(e) => setCTo(e.target.value)} style={{ width: "100%", borderRadius: 9, border: "1px solid var(--ed2-hair)", padding: "8px 10px", fontSize: 13, boxSizing: "border-box", marginBottom: 12 }} />
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => setCustom(false)} style={{ flex: 1, background: "var(--ed2-surface)", border: "none", borderRadius: 9, padding: "9px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Voltar</button>
                <button type="button" onClick={aplicarCustom} style={{ flex: 1, background: "#34C759", color: "#fff", border: "none", borderRadius: 9, padding: "9px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Aplicar</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
