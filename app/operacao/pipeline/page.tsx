"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Loader2 } from "lucide-react";
import { PIPELINE_COLUMNS, LEAD_STATUS_LABEL, SETORES, type Lead, type LeadStatus } from "@/lib/groow/types";
import { formatPhone, isValidPhone, isValidEmail } from "@/lib/groow/format";
import PeriodSelector, { rangeFromPreset, type PeriodRange } from "@/components/groow/admin/PeriodSelector";
import LeadModal from "@/components/groow/admin/LeadModal";

type PipelineState = Record<LeadStatus, Lead[]>;

const COL_COLOR: Record<LeadStatus, { dot: string; bg?: string }> = {
  novo: { dot: "#0A84FF" },
  contatado: { dot: "#32ADE6" },
  diagnostico: { dot: "#C9A961" },
  proposta: { dot: "#FF9F0A" },
  fechado: { dot: "#34C759", bg: "rgba(52,199,89,0.06)" },
  assinado: { dot: "#0B1838", bg: "rgba(11,24,56,0.04)" },
  perdido: { dot: "#FF3B30" },
  recusado: { dot: "#FF3B30" },
  frio: { dot: "var(--ed2-ink-3)" },
  quente: { dot: "#FF3B30" },
};

const STAGE_PROB: Record<LeadStatus, number> = {
  novo: 18, contatado: 35, diagnostico: 55, proposta: 70, fechado: 100, assinado: 100,
  perdido: 0, recusado: 0, frio: 10, quente: 60,
};

function probColor(p: number) {
  if (p >= 70) return "#34C759";
  if (p >= 40) return "#C9A961";
  if (p >= 20) return "#FF9F0A";
  return "var(--ed2-ink-3)";
}
function daysSince(date: string) {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}
function daysClass(d: number): "fresh" | "warm" | "cold" {
  if (d < 3) return "fresh";
  if (d <= 7) return "warm";
  return "cold";
}
const daysColors = {
  fresh: { bg: "rgba(52,199,89,0.14)", fg: "var(--pill-green-fg)" },
  warm: { bg: "rgba(255,159,10,0.14)", fg: "var(--pill-orange-fg)" },
  cold: { bg: "rgba(255,59,48,0.14)", fg: "var(--pill-red-fg)" },
};
function daysLabel(d: number) {
  if (d === 0) return "hoje";
  if (d === 1) return "há 1 dia";
  return `há ${d} dias`;
}

const AV_GRADIENTS = [
  "linear-gradient(135deg,#C9A961,#a8893d)",
  "linear-gradient(135deg,#0B1838,#1d2d56)",
  "linear-gradient(135deg,#34C759,#1d8a3a)",
  "linear-gradient(135deg,#FF9F0A,#c87a00)",
  "linear-gradient(135deg,#FF3B30,#c8261c)",
  "linear-gradient(135deg,#5856D6,#3934a3)",
  "linear-gradient(135deg,#0A84FF,#0858b0)",
  "linear-gradient(135deg,#AF52DE,#7a3a9b)",
];
function gradFor(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AV_GRADIENTS[h % AV_GRADIENTS.length];
}
function initials(s: string) {
  return (s || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

function CardItem({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `lead-${lead.id}`,
    data: { leadId: lead.id, status: lead.status },
  });
  const dias = daysSince(lead.updated_at || lead.created_at);
  const cls = daysClass(dias);
  const dc = daysColors[cls];
  const prob = STAGE_PROB[lead.status] ?? 30;
  const isHot = lead.status === "quente" || (prob >= 60 && dias <= 2);

  const style: React.CSSProperties = {
    background: "var(--ed2-card)",
    borderRadius: 18,
    padding: 14,
    boxShadow: isDragging ? "0 12px 32px rgba(0,0,0,0.16)" : "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04)",
    cursor: isDragging ? "grabbing" : "grab",
    opacity: isDragging ? 0.4 : 1,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition: "box-shadow .15s, opacity .2s",
    userSelect: "none",
    position: "relative",
  };

  return (
    <div ref={setNodeRef} {...attributes} {...listeners} onClick={onClick} style={style}>
      {isHot && (
        <span style={{ position: "absolute", top: 10, right: 10, width: 8, height: 8, borderRadius: 99, background: "#FF3B30", boxShadow: "0 0 0 3px rgba(255,59,48,0.16)" }} />
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 99, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: gradFor(lead.nome), color: "#fff", fontWeight: 600, fontSize: 11 }}>{initials(lead.nome)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lead.nome}</div>
          <div style={{ fontSize: 12, color: "var(--ed2-ink-2)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lead.empresa || "-"}</div>
        </div>
      </div>

      {lead.faturamento ? (
        <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 10, fontVariantNumeric: "tabular-nums" }}>
          {lead.faturamento}<span style={{ fontSize: 11, color: "var(--ed2-ink-2)", fontWeight: 500, marginLeft: 4 }}>/mês</span>
        </div>
      ) : null}

      <div style={{ height: 3, background: "var(--ed2-surface)", borderRadius: 99, overflow: "hidden", marginBottom: 10 }}>
        <div style={{ height: "100%", width: `${prob}%`, background: probColor(prob), borderRadius: 99 }} />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {lead.setor ? <span style={tagStyle}>{lead.setor}</span> : null}
        <span style={prob >= 50 ? { ...tagStyle, background: "rgba(201,169,97,0.12)", color: "var(--pill-gold-fg)" } : tagStyle}>{prob}% prob</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTop: "1px solid var(--ed2-hair)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 99, letterSpacing: "-0.005em", background: dc.bg, color: dc.fg }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="5" cy="5" r="3.5" /><path d="M5 3v2l1.5 1" />
          </svg>
          {daysLabel(dias)}
        </span>
        <div style={{ width: 22, height: 22, borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#0B1838,#1d2d56)", color: "#fff", fontWeight: 600, fontSize: 9, boxShadow: "0 0 0 2px #fff" }}>RA</div>
      </div>
    </div>
  );
}

const tagStyle: React.CSSProperties = {
  padding: "3px 9px",
  borderRadius: 99,
  background: "var(--ed2-surface)",
  color: "var(--ed2-ink)",
  fontSize: 11,
  fontWeight: 500,
};

function Column({ status, leads, onCardClick, onAdd, sortBy, onSortChange }: { status: LeadStatus; leads: Lead[]; onCardClick: (id: number) => void; onAdd: () => void; sortBy: "data" | "nome"; onSortChange: (s: "data" | "nome") => void }) {
  const { isOver, setNodeRef } = useDroppable({ id: `col-${status}`, data: { status } });
  const col = COL_COLOR[status] ?? { dot: "var(--ed2-ink-3)" };
  const [menuOpen, setMenuOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  const totalCount = leads.length;
  const sortedLeads = sortBy === "nome"
    ? [...leads].sort((a, b) => a.nome.localeCompare(b.nome))
    : leads;

  useEffect(() => {
    if (!menuOpen && !sortOpen) return;
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [menuOpen, sortOpen]);

  return (
    <div ref={setNodeRef} style={{
      background: isOver ? "rgba(201,169,97,0.08)" : col.bg || "rgba(242,242,247,0.6)",
      borderRadius: 24,
      padding: "8px 8px 14px",
      minHeight: 520,
      display: "flex",
      flexDirection: "column",
      transition: "background .15s",
      outline: isOver ? "2px dashed #C9A961" : "none",
      outlineOffset: -4,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 12px 8px", gap: 8 }}>
        {/* sem pill de contagem aqui (o "N oportunidades" logo abaixo já informa) -
            assim o nome da etapa nunca corta ("DIAGNÓSTICO", "PROPOSTA ENVIADA"...) */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flex: 1 }}>
          <span style={{ width: 9, height: 9, borderRadius: 99, background: col.dot, flexShrink: 0 }} />
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.02em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{LEAD_STATUS_LABEL[status]}</span>
        </div>
        <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
          <div style={{ position: "relative" }} ref={sortRef}>
            <button type="button" onClick={() => setSortOpen(v => !v)} title="Ordenar" style={{ ...colIcon, background: "transparent" }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h8M5 8h6M7 12h2" /></svg>
            </button>
            {sortOpen && (
              <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, background: "var(--ed2-card)", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", border: "1px solid var(--ed2-hair)", minWidth: 150, zIndex: 20, overflow: "hidden" }}>
                {[{ key: "data" as const, label: "Mais recentes" }, { key: "nome" as const, label: "Nome A-Z" }].map((opt) => (
                  <button key={opt.key} type="button"
                    onClick={() => { onSortChange(opt.key); setSortOpen(false); }}
                    style={{ display: "block", width: "100%", padding: "9px 14px", background: sortBy === opt.key ? "var(--ed2-surface)" : "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: sortBy === opt.key ? 600 : 500, textAlign: "left" }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div style={{ position: "relative" }} ref={menuRef}>
            <button type="button" onClick={() => setMenuOpen(v => !v)} title="Opções" style={{ ...colIcon, background: "transparent" }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><circle cx="4" cy="8" r="1.3" /><circle cx="8" cy="8" r="1.3" /><circle cx="12" cy="8" r="1.3" /></svg>
            </button>
            {menuOpen && (
              <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, background: "var(--ed2-card)", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", border: "1px solid var(--ed2-hair)", minWidth: 160, zIndex: 20, overflow: "hidden" }}>
                <button type="button" onClick={() => { setMenuOpen(false); onAdd(); }}
                  style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500, color: "var(--ed2-ink)", textAlign: "left" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--ed2-surface-2)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 3v10M3 8h10" /></svg>
                  Adicionar deal
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ padding: "0 12px 10px", color: "var(--ed2-ink-2)", fontSize: 12, fontWeight: 500 }}>
        <b style={{ color: "var(--ed2-ink)", fontWeight: 600 }}>{totalCount}</b> oportunidade{totalCount === 1 ? "" : "s"}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 4px", flex: 1, minHeight: 60 }}>
        {sortedLeads.map((l) => <CardItem key={l.id} lead={l} onClick={() => onCardClick(l.id)} />)}
      </div>

      <button type="button" onClick={onAdd} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: 10, borderRadius: 14, color: "var(--ed2-ink-2)", fontSize: 12, fontWeight: 600, cursor: "pointer", margin: "6px 4px 0", background: "none", border: "none", width: "100%" }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 2v8M2 6h8" /></svg>
        Adicionar deal
      </button>
    </div>
  );
}

const colIcon: React.CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 99,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  color: "var(--ed2-ink-2)",
};

export default function PipelinePage() {
  const [pipeline, setPipeline] = useState<PipelineState>({
    novo: [], contatado: [], diagnostico: [], proposta: [], fechado: [], assinado: [], perdido: [], recusado: [], frio: [], quente: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [selected, setSelected] = useState<number | null>(null);
  const [showNewDeal, setShowNewDeal] = useState(false);
  const [viewMode, setViewMode] = useState<"kanban" | "lista">("kanban");
  const [period, setPeriod] = useState<PeriodRange>(rangeFromPreset("tudo"));
  const [sortBy, setSortBy] = useState<"data" | "nome">("data");

  const load = useCallback(async (range: PeriodRange) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (range.from) params.set("from", range.from);
      if (range.to) params.set("to", range.to);
      const res = await fetch(`/api/admin/pipeline?${params}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.pipeline) setPipeline(data.pipeline);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(period); }, [load, period]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const onDragEnd = async (e: DragEndEvent) => {
    if (!e.over) return;
    const leadId = Number(e.active.data.current?.leadId);
    const fromStatus = e.active.data.current?.status as LeadStatus;
    const toStatus = e.over.data.current?.status as LeadStatus;
    if (!leadId || !toStatus || fromStatus === toStatus) return;

    setPipeline((prev) => {
      const moving = prev[fromStatus].find((l) => l.id === leadId);
      if (!moving) return prev;
      return {
        ...prev,
        [fromStatus]: prev[fromStatus].filter((l) => l.id !== leadId),
        [toStatus]: [{ ...moving, status: toStatus }, ...prev[toStatus]],
      };
    });

    try {
      await fetch(`/api/admin/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: toStatus }),
      });
    } catch {
      load(period);
    }
  };

  const totais = PIPELINE_COLUMNS.reduce((s, c) => s + (pipeline[c]?.length ?? 0), 0);
  const emAberto = PIPELINE_COLUMNS.filter((c) => c !== "fechado" && c !== "assinado").reduce((s, c) => s + (pipeline[c]?.length ?? 0), 0);
  const fechados = (pipeline.fechado?.length ?? 0) + (pipeline.assinado?.length ?? 0);

  return (
    <div>
      {/* PAGE HEADER */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 22, gap: 24, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 42, fontWeight: 700, letterSpacing: "-0.035em", margin: "0 0 6px", lineHeight: 1.05 }}>Pipeline</h1>
          <div style={{ color: "var(--ed2-ink-2)", fontSize: 15 }}>
            {loading ? "Carregando…" : (
              <>
                <b style={{ color: "var(--ed2-ink)", fontWeight: 600 }}>{totais}</b> oportunidades ·{" "}
                <b style={{ color: "var(--ed2-ink)", fontWeight: 600 }}>{emAberto}</b> em negociação · arraste para mover etapa
              </>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <PeriodSelector value={period} onChange={setPeriod} />
          <div style={{ display: "inline-flex", background: "var(--ed2-card)", borderRadius: 999, padding: 4, gap: 2, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <button type="button" onClick={() => setViewMode("kanban")} style={viewMode === "kanban" ? vtOn : vtOff}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="3" height="12" rx="1" /><rect x="6.5" y="2" width="3" height="9" rx="1" /><rect x="11" y="2" width="3" height="6" rx="1" /></svg>
              Kanban
            </button>
            <button type="button" onClick={() => setViewMode("lista")} style={viewMode === "lista" ? vtOn : vtOff}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4h12M2 8h12M2 12h12" /></svg>
              Lista
            </button>
          </div>
          <button type="button" onClick={() => setShowNewDeal(true)} style={newBtn}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M8 3v10M3 8h10" /></svg>
            Novo deal
          </button>
        </div>
      </div>

      {/* SUMMARY STRIP */}
      {!loading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--ed2-card)", borderRadius: 22, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", padding: "16px 24px", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
          {[
            { k: "Em aberto", v: `${emAberto}`, sub: "leads ativos" },
            { k: "Novos", v: `${pipeline.novo?.length ?? 0}`, sub: "topo do funil" },
            { k: "Diagnóstico", v: `${pipeline.diagnostico.length}`, sub: "qualificação" },
            { k: "Proposta", v: `${pipeline.proposta.length}`, sub: "enviadas" },
            { k: "Fechados", v: `${fechados}`, sub: "neste período" },
          ].map((cell, i) => (
            <div key={cell.k} style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 100, paddingLeft: i > 0 ? 24 : 0, borderLeft: i > 0 ? "1px solid var(--ed2-hair)" : "none" }}>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ed2-ink-2)" }}>{cell.k}</span>
              <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.025em", fontVariantNumeric: "tabular-nums" }}>{cell.v}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#1d8a3a" }}>↗ {cell.sub}</span>
            </div>
          ))}
        </div>
      )}

      {error ? <div style={{ background: "rgba(255,59,48,0.06)", border: "1px solid rgba(255,59,48,0.18)", borderRadius: 18, padding: "12px 18px", color: "#c8261c", fontSize: 13, marginBottom: 18 }}>{error}</div> : null}

      {loading ? (
        <div style={{ display: "grid", placeItems: "center", padding: "60px 0" }}><Loader2 className="animate-spin" style={{ color: "var(--ed2-ink-3)" }} /></div>
      ) : viewMode === "kanban" ? (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${PIPELINE_COLUMNS.length}, minmax(160px, 1fr))`, gap: 12, overflowX: "auto", paddingBottom: 12 }}>
            {PIPELINE_COLUMNS.map((status) => (
              <Column key={status} status={status} leads={pipeline[status]} onCardClick={setSelected} onAdd={() => setShowNewDeal(true)} sortBy={sortBy} onSortChange={setSortBy} />
            ))}
          </div>
        </DndContext>
      ) : (
        <div style={{ background: "var(--ed2-card)", borderRadius: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "var(--ed2-surface-2)", borderBottom: "1px solid var(--ed2-hair)" }}>
                {["Nome", "Empresa", "Etapa", "Probabilidade", "WhatsApp", "Há"].map((h, i) => (
                  <th key={h} style={{ padding: "14px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ed2-ink-2)", paddingLeft: i === 0 ? 24 : 16 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PIPELINE_COLUMNS.flatMap((st) => pipeline[st]).map((l) => {
                const dias = Math.floor((Date.now() - new Date(l.updated_at || l.created_at).getTime()) / 86400000);
                const prob = STAGE_PROB[l.status] ?? 18;
                return (
                  <tr key={l.id} onClick={() => setSelected(l.id)} style={{ borderBottom: "1px solid var(--ed2-hair)", cursor: "pointer" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ed2-surface-2)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "")}>
                    <td style={{ padding: "12px 16px 12px 24px", fontWeight: 600 }}>{l.nome}</td>
                    <td style={{ padding: "12px 16px", color: "var(--ed2-ink-2)" }}>{l.empresa || "-"}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 99, background: "var(--ed2-surface)", fontSize: 12, fontWeight: 600 }}>
                        <span style={{ width: 6, height: 6, borderRadius: 99, background: COL_COLOR[l.status]?.dot || "#ccc" }} />
                        {LEAD_STATUS_LABEL[l.status]}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: prob >= 70 ? "#1d8a3a" : prob >= 40 ? "#C9A961" : "var(--ed2-ink-2)" }}>{prob}%</td>
                    <td style={{ padding: "12px 16px", color: "var(--ed2-ink-2)", fontSize: 13 }}>{l.whatsapp || "-"}</td>
                    <td style={{ padding: "12px 16px", color: "var(--ed2-ink-2)", fontSize: 13 }}>{dias === 0 ? "hoje" : `${dias}d`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <LeadModal leadId={selected} onClose={() => setSelected(null)} onUpdated={() => load(period)} />
      {showNewDeal && <NovoDealModal onClose={() => setShowNewDeal(false)} onCreated={() => { setShowNewDeal(false); load(period); }} />}
    </div>
  );
}

function NovoDealModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") || "").trim();
    if (whatsapp && !isValidPhone(whatsapp)) {
      setError("WhatsApp inválido, precisa de DDD + número (10 ou 11 dígitos).");
      return;
    }
    if (email && !isValidEmail(email)) {
      setError("Email inválido.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: String(fd.get("nome") || "").trim(),
          empresa: String(fd.get("empresa") || "").trim(),
          whatsapp: whatsapp.trim(),
          email,
          setor: String(fd.get("setor") || "").trim(),
          faturamento: String(fd.get("faturamento") || "").trim(),
          status: String(fd.get("status") || "novo"),
          origem: "prospeccao",
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Erro");
      onCreated();
    } catch (e) { setError(e instanceof Error ? e.message : "Erro"); }
    finally { setSaving(false); }
  };

  const iStyle: React.CSSProperties = { display: "block", width: "100%", borderRadius: 10, border: "1px solid var(--ed2-hair)", background: "var(--ed2-surface-2)", padding: "9px 12px", fontSize: 13, boxSizing: "border-box" };
  const lStyle: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 600, color: "var(--ed2-ink-2)", marginBottom: 5 };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, display: "grid", placeItems: "center", background: "rgba(11,24,56,0.45)", padding: 16 }}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "var(--ed2-card)", borderRadius: 24, boxShadow: "0 24px 60px rgba(0,0,0,0.18)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid var(--ed2-hair)" }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em" }}>Novo deal</h3>
          <button type="button" onClick={onClose} style={{ all: "unset", cursor: "pointer", color: "var(--ed2-ink-2)" }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4l10 10M14 4L4 14" /></svg>
          </button>
        </div>
        <div style={{ padding: "18px 22px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ gridColumn: "1/-1" }}><label style={lStyle}>Nome *</label><input name="nome" required placeholder="Nome do contato" style={iStyle} /></div>
          <div><label style={lStyle}>Empresa</label><input name="empresa" placeholder="Razão social ou fantasia" style={iStyle} /></div>
          <div>
            <label style={lStyle}>Setor</label>
            <select name="setor" style={{ ...iStyle, appearance: "auto" }}>
              <option value="">Selecionar…</option>
              {SETORES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div><label style={lStyle}>WhatsApp</label><input name="whatsapp" type="tel" inputMode="numeric" maxLength={15} value={whatsapp} onChange={(e) => setWhatsapp(formatPhone(e.target.value))} placeholder="(49) 99999-9999" style={iStyle} /></div>
          <div><label style={lStyle}>Email</label><input name="email" type="email" placeholder="email@empresa.com" style={iStyle} /></div>
          <div><label style={lStyle}>Faturamento mensal</label><input name="faturamento" placeholder="Ex: R$ 50k/mês" style={iStyle} /></div>
          <div>
            <label style={lStyle}>Etapa inicial</label>
            <select name="status" style={{ ...iStyle, appearance: "auto" }}>
              {PIPELINE_COLUMNS.map((s) => <option key={s} value={s}>{LEAD_STATUS_LABEL[s]}</option>)}
            </select>
          </div>
        </div>
        {error ? <p style={{ padding: "0 22px", color: "#c8261c", fontSize: 12 }}>{error}</p> : null}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 22px", borderTop: "1px solid var(--ed2-hair)" }}>
          <button type="button" onClick={onClose} style={{ all: "unset", cursor: "pointer", padding: "9px 14px", color: "var(--ed2-ink-2)", fontSize: 13 }}>Cancelar</button>
          <button type="submit" disabled={saving} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#C9A961", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : null}
            Criar deal
          </button>
        </div>
      </form>
    </div>
  );
}

const newBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "#C9A961",
  color: "#fff",
  border: "none",
  padding: "12px 20px",
  borderRadius: 999,
  fontWeight: 600,
  fontSize: 14,
  letterSpacing: "-0.005em",
  cursor: "pointer",
  boxShadow: "0 4px 12px rgba(201,169,97,0.28)",
};

const periodPill: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  background: "var(--ed2-card)",
  borderRadius: 999,
  padding: "9px 16px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const vtOn: React.CSSProperties = { all: "unset", cursor: "pointer", padding: "8px 16px", borderRadius: 999, fontSize: 13, fontWeight: 600, color: "var(--ed2-ink)", background: "var(--ed2-surface)", display: "inline-flex", alignItems: "center", gap: 7 };
const vtOff: React.CSSProperties = { ...vtOn, color: "var(--ed2-ink-2)", background: "transparent" };
