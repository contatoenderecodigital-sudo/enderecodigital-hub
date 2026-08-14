"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Loader2 } from "lucide-react";
import { LEAD_STATUS_LABEL, LEAD_ORIGENS, LEAD_ORIGEM_LABEL, FONTES_TRAFEGO, FONTE_TRAFEGO_LABEL, SETORES, normalizeOrigem, type Lead } from "@/lib/groow/types";
import { formatPhone, isValidPhone, isValidEmail } from "@/lib/groow/format";
import LeadModal from "@/components/groow/admin/LeadModal";

// fg via CSS var: escuro no claro, claro no navy (legível nos dois temas)
const STATUS_TONE: Record<string, { bg: string; fg: string; dot: string }> = {
  novo: { bg: "rgba(10,132,255,0.12)", fg: "var(--pill-blue-fg)", dot: "#0A84FF" },
  contatado: { bg: "rgba(50,173,230,0.12)", fg: "var(--pill-cyan-fg)", dot: "#32ADE6" },
  diagnostico: { bg: "rgba(88,86,214,0.14)", fg: "var(--pill-purple-fg)", dot: "#5856D6" },
  proposta: { bg: "rgba(201,169,97,0.12)", fg: "var(--pill-gold-fg)", dot: "#C9A961" },
  fechado: { bg: "rgba(52,199,89,0.14)", fg: "var(--pill-green-fg)", dot: "#34C759" },
  perdido: { bg: "rgba(255,59,48,0.14)", fg: "var(--pill-red-fg)", dot: "#FF3B30" },
  frio: { bg: "var(--ed2-surface)", fg: "var(--ed2-ink-2)", dot: "var(--ed2-ink-2)" },
  quente: { bg: "rgba(52,199,89,0.14)", fg: "var(--pill-green-fg)", dot: "#34C759" },
  recusado: { bg: "rgba(255,59,48,0.14)", fg: "var(--pill-red-fg)", dot: "#FF3B30" },
};

const FILTER_PILLS = [
  { key: "", label: "Todos" },
  { key: "novo", label: "Novo", dot: "#0A84FF" },
  { key: "quente", label: "Quente", dot: "#34C759" },
  { key: "frio", label: "Frio", dot: "var(--ed2-ink-2)" },
  { key: "perdido", label: "Perdido", dot: "#FF3B30" },
  { key: "recusado", label: "Recusado", dot: "#c8261c" },
];

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
function waLink(num: string) {
  const d = (num || "").replace(/\D/g, "");
  return `https://wa.me/${d.startsWith("55") ? d : `55${d}`}`;
}
function relTime(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "ontem";
  if (d < 7) return `${d} dias`;
  if (d < 30) return `${Math.floor(d / 7)} semana${Math.floor(d / 7) === 1 ? "" : "s"}`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_TONE[status] ?? STATUS_TONE.frio;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 11px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: "-0.005em",
        background: s.bg,
        color: s.fg,
      }}
    >
      <span aria-hidden style={{ width: 6, height: 6, borderRadius: 99, background: s.dot, flexShrink: 0 }} />
      {LEAD_STATUS_LABEL[status as keyof typeof LEAD_STATUS_LABEL] ?? status}
    </span>
  );
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState<string>("");
  const [showNewLead, setShowNewLead] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [setorFilter, setSetorFilter] = useState("");
  const [origemFilter, setOrigemFilter] = useState("");
  const [setorOpen, setSetorOpen] = useState(false);
  const [origemOpen, setOrigemOpen] = useState(false);
  const setorRef = useRef<HTMLDivElement>(null);
  const origemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (setorRef.current && !setorRef.current.contains(e.target as Node)) setSetorOpen(false);
      if (origemRef.current && !origemRef.current.contains(e.target as Node)) setOrigemOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const sp = new URLSearchParams();
      if (statusFilter) sp.set("status", statusFilter);
      if (q) sp.set("q", q);
      const res = await fetch(`/api/admin/leads?${sp}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setLeads(data.leads);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, q]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const countsByStatus = leads.reduce((acc: Record<string, number>, l) => {
    acc[l.status] = (acc[l.status] || 0) + 1;
    return acc;
  }, {});
  const totalLeads = leads.length;

  // delta este mês: leads cujo created_at é do mês atual
  const now = new Date();
  const mesMM = now.getMonth();
  const novosMes = leads.filter((l) => {
    const d = new Date(l.created_at);
    return d.getMonth() === mesMM && d.getFullYear() === now.getFullYear();
  }).length;
  const fechados = leads.filter((l) => l.status === "fechado" || l.status === "assinado").length;
  const conversao = totalLeads > 0 ? ((fechados / totalLeads) * 100).toFixed(1).replace(".", ",") : "0";

  // Listas únicas para filtros
  const setoresUnicos = [...new Set(leads.map((l) => l.setor).filter(Boolean))] as string[];
  // Origens normalizadas presentes nos leads (categorias padrão)
  const origensUnicas = [...new Set(leads.map((l) => normalizeOrigem(l.origem)))];

  // Leads filtrados por setor e origem (origem comparada pela categoria normalizada)
  const leadsFiltrados = leads.filter((l) => {
    if (setorFilter && l.setor !== setorFilter) return false;
    if (origemFilter && normalizeOrigem(l.origem) !== origemFilter) return false;
    return true;
  });

  const exportarCSV = () => {
    const header = ["Nome", "Empresa", "WhatsApp", "Email", "Setor", "Faturamento", "Origem", "Status", "Data"];
    const rows = leadsFiltrados.map((l) => [
      l.nome, l.empresa || "", l.whatsapp || "", l.email || "",
      l.setor || "", l.faturamento || "", l.origem || "", l.status,
      new Date(l.created_at).toLocaleDateString("pt-BR"),
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "leads.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* PAGE HEADER */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24, gap: 24, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 42, fontWeight: 700, letterSpacing: "-0.035em", margin: "0 0 6px", lineHeight: 1.05 }}>Leads</h1>
          <div style={{ color: "var(--ed2-ink-2)", fontSize: 15 }}>
            {loading ? "Carregando…" : (
              <>
                <b style={{ color: "var(--ed2-ink)", fontWeight: 600 }}>{totalLeads}</b> leads ·{" "}
                <b style={{ color: "var(--ed2-ink)", fontWeight: 600 }}>{novosMes}</b> novos este mês · taxa de conversão{" "}
                <b style={{ color: "var(--ed2-ink)", fontWeight: 600 }}>{conversao}%</b>
              </>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" onClick={() => setShowImport(true)} style={ghostBtnStyle}>
            Importar lista
          </button>
          <button type="button" onClick={() => setShowNewLead(true)} style={newBtnStyle}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M8 3v10M3 8h10" />
            </svg>
            Novo lead
          </button>
        </div>
      </div>

      {/* TOOLBAR */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--ed2-card)", borderRadius: 999, padding: "11px 18px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", width: 320, color: "var(--ed2-ink-2)", fontSize: 14 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            placeholder="Buscar por nome, empresa, telefone…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ all: "unset", flex: 1, fontSize: 14, color: "var(--ed2-ink)" } as React.CSSProperties}
          />
        </div>

        <div style={{ display: "inline-flex", background: "var(--ed2-card)", padding: 4, borderRadius: 999, gap: 2, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          {FILTER_PILLS.map((pill) => {
            const isOn = statusFilter === pill.key;
            const cnt = pill.key === "" ? totalLeads : (countsByStatus[pill.key] || 0);
            return (
              <button
                key={pill.key}
                type="button"
                onClick={() => setStatusFilter(pill.key)}
                style={{
                  all: "unset",
                  cursor: "pointer",
                  padding: "8px 16px",
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 600,
                  color: isOn ? "var(--ed2-ink)" : "var(--ed2-ink-2)",
                  background: isOn ? "var(--ed2-surface)" : "transparent",
                  letterSpacing: "-0.005em",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                } as React.CSSProperties}
              >
                {pill.dot && <span style={{ width: 6, height: 6, borderRadius: 99, background: pill.dot, flexShrink: 0 }} />}
                {pill.label}
                <span style={{ background: isOn ? "var(--ed2-card)" : "var(--ed2-surface)", color: "var(--ed2-ink-2)", padding: "1px 7px", borderRadius: 99, fontSize: 11, fontWeight: 600 }}>{cnt}</span>
              </button>
            );
          })}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          {/* SETOR FILTER */}
          <div ref={setorRef} style={{ position: "relative" }}>
            <button type="button" onClick={() => setSetorOpen(v => !v)}
              style={{ ...ghostBtnStyle, background: setorFilter ? "rgba(201,169,97,0.12)" : undefined, color: setorFilter ? "var(--pill-gold-fg)" : undefined }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4h12M4 8h8M6 12h4" /></svg>
              {setorFilter || "Setor"}
            </button>
            {setorOpen && (
              <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, background: "var(--ed2-card)", borderRadius: 14, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", border: "1px solid var(--ed2-hair)", minWidth: 180, zIndex: 30, overflow: "hidden" }}>
                <button type="button" onClick={() => { setSetorFilter(""); setSetorOpen(false); }}
                  style={{ display: "block", width: "100%", padding: "9px 14px", background: !setorFilter ? "var(--ed2-surface)" : "none", border: "none", cursor: "pointer", fontSize: 13, textAlign: "left", fontWeight: !setorFilter ? 600 : 400 }}>
                  Todos os setores
                </button>
                {setoresUnicos.map((s) => (
                  <button key={s} type="button" onClick={() => { setSetorFilter(s); setSetorOpen(false); }}
                    style={{ display: "block", width: "100%", padding: "9px 14px", background: setorFilter === s ? "var(--ed2-surface)" : "none", border: "none", cursor: "pointer", fontSize: 13, textAlign: "left", fontWeight: setorFilter === s ? 600 : 400 }}>
                    {s}
                  </button>
                ))}
                {setoresUnicos.length === 0 && <p style={{ padding: "9px 14px", color: "var(--ed2-ink-2)", fontSize: 13, margin: 0 }}>Sem setores</p>}
              </div>
            )}
          </div>

          {/* ORIGEM FILTER */}
          <div ref={origemRef} style={{ position: "relative" }}>
            <button type="button" onClick={() => setOrigemOpen(v => !v)}
              style={{ ...ghostBtnStyle, background: origemFilter ? "rgba(201,169,97,0.12)" : undefined, color: origemFilter ? "var(--pill-gold-fg)" : undefined }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4h12M4 8h8M6 12h4" /></svg>
              {origemFilter ? LEAD_ORIGEM_LABEL[origemFilter as keyof typeof LEAD_ORIGEM_LABEL] ?? origemFilter : "Origem"}
            </button>
            {origemOpen && (
              <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, background: "var(--ed2-card)", borderRadius: 14, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", border: "1px solid var(--ed2-hair)", minWidth: 180, zIndex: 30, overflow: "hidden" }}>
                <button type="button" onClick={() => { setOrigemFilter(""); setOrigemOpen(false); }}
                  style={{ display: "block", width: "100%", padding: "9px 14px", background: !origemFilter ? "var(--ed2-surface)" : "none", border: "none", cursor: "pointer", fontSize: 13, textAlign: "left", fontWeight: !origemFilter ? 600 : 400 }}>
                  Todas as origens
                </button>
                {origensUnicas.map((o) => (
                  <button key={o} type="button" onClick={() => { setOrigemFilter(o); setOrigemOpen(false); }}
                    style={{ display: "block", width: "100%", padding: "9px 14px", background: origemFilter === o ? "var(--ed2-surface)" : "none", border: "none", cursor: "pointer", fontSize: 13, textAlign: "left", fontWeight: origemFilter === o ? 600 : 400 }}>
                    {LEAD_ORIGEM_LABEL[o]}
                  </button>
                ))}
                {origensUnicas.length === 0 && <p style={{ padding: "9px 14px", color: "var(--ed2-ink-2)", fontSize: 13, margin: 0 }}>Sem origens</p>}
              </div>
            )}
          </div>

          {/* EXPORTAR */}
          <button type="button" onClick={exportarCSV} style={ghostBtnStyle}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 8h12M8 2v12" /><path d="M5 11l3 3 3-3" /></svg>
            Exportar CSV
          </button>
        </div>
      </div>

      {error ? (
        <div style={{ background: "rgba(255,59,48,0.06)", border: "1px solid rgba(255,59,48,0.18)", borderRadius: 18, padding: "12px 18px", color: "#c8261c", fontSize: 13, marginBottom: 18 }}>{error}</div>
      ) : null}

      {/* TABLE */}
      <div style={{ background: "var(--ed2-card)", borderRadius: 28, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontVariantNumeric: "tabular-nums" }}>
            <thead>
              <tr>
                <Th first>Nome</Th>
                <Th>Empresa</Th>
                <Th>WhatsApp</Th>
                <Th>Setor</Th>
                <Th>Origem</Th>
                <Th align="right">Faturamento</Th>
                <Th>Status</Th>
                <Th last>Data</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ padding: "48px 28px", textAlign: "center" }}><Loader2 className="animate-spin" style={{ display: "inline-block", color: "var(--ed2-ink-3)" }} /></td></tr>
              ) : leads.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: "60px 28px", textAlign: "center", color: "var(--ed2-ink-2)", fontSize: 14 }}>Nenhum lead encontrado.</td></tr>
              ) : (
                leadsFiltrados.map((l) => (
                  <tr key={l.id} className="lead-row" onClick={() => setSelected(l.id)} style={{ cursor: "pointer", transition: "background .12s" }}>
                    <Td first>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 99, background: gradFor(l.nome), color: "#fff", fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{initials(l.nome)}</div>
                        <div>
                          <div style={{ fontWeight: 600, letterSpacing: "-0.01em" }}>{l.nome}</div>
                          {l.notas ? <div style={{ color: "var(--ed2-ink-2)", fontSize: 13, marginTop: 1 }}>{l.notas.slice(0, 40)}</div> : null}
                        </div>
                      </div>
                    </Td>
                    <Td><div style={{ fontWeight: 500 }}>{l.empresa || "-"}</div></Td>
                    <Td>
                      {l.whatsapp ? (
                        <a
                          href={waLink(l.whatsapp)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--ed2-ink)", fontWeight: 500, fontSize: 13, textDecoration: "none", padding: "5px 10px 5px 8px", borderRadius: 999, background: "rgba(52,199,89,0.08)", whiteSpace: "nowrap" }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="#1d8a3a" style={{ flexShrink: 0 }}><path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.2-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.7-1.7-.9-2.3-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4 0 1.4 1 2.8 1.2 3 .2.2 2 3.1 4.9 4.4.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.2-.6-.4zM12 2C6.5 2 2 6.5 2 12c0 1.7.5 3.4 1.3 4.9L2 22l5.3-1.3c1.4.8 3 1.2 4.7 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2z" /></svg>
                          {l.whatsapp}
                        </a>
                      ) : <span style={{ color: "var(--ed2-ink-2)" }}>-</span>}
                    </Td>
                    <Td><span style={{ fontSize: 13, color: "var(--ed2-ink)" }}>{l.setor || "-"}</span></Td>
                    <Td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 600, background: "rgba(11,24,56,0.06)", color: "var(--ed2-ink)" }}>
                        {LEAD_ORIGEM_LABEL[normalizeOrigem(l.origem)]}
                        {l.fonte_trafego ? ` · ${FONTE_TRAFEGO_LABEL[l.fonte_trafego as keyof typeof FONTE_TRAFEGO_LABEL] ?? l.fonte_trafego}` : ""}
                      </span>
                    </Td>
                    <Td align="right"><span style={{ fontWeight: 600, letterSpacing: "-0.01em" }}>{l.faturamento || "-"}</span></Td>
                    <Td><StatusBadge status={l.status} /></Td>
                    <Td last><span style={{ color: "var(--ed2-ink-2)", fontSize: 13 }}>{relTime(l.created_at)}</span></Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {leads.length > 0 && !loading && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 28px", color: "var(--ed2-ink-2)", fontSize: 13, background: "var(--ed2-surface-2)", borderTop: "1px solid var(--ed2-hair)" }}>
            <div>
              Mostrando <b style={{ color: "var(--ed2-ink)" }}>1-{leadsFiltrados.length}</b> de <b style={{ color: "var(--ed2-ink)" }}>{leadsFiltrados.length}</b>
            </div>
          </div>
        )}
      </div>

      <LeadModal leadId={selected} onClose={() => setSelected(null)} onUpdated={load} />
      {showNewLead && <NovoLeadModal onClose={() => setShowNewLead(false)} onCreated={() => { setShowNewLead(false); load(); }} />}
      {showImport && <ImportarLeadsModal onClose={() => setShowImport(false)} onDone={() => { setShowImport(false); load(); }} />}

      <style>{`.lead-row:hover td { background: var(--ed2-surface-2) !important; }`}</style>
    </div>
  );
}

const newBtnStyle: React.CSSProperties = {
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

const ghostBtnStyle: React.CSSProperties = {
  all: "unset",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "9px 14px",
  borderRadius: 999,
  background: "var(--ed2-card)",
  color: "var(--ed2-ink)",
  fontSize: 13,
  fontWeight: 600,
  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
};

function Th({ children, first, last, align }: { children: React.ReactNode; first?: boolean; last?: boolean; align?: "left" | "right" }) {
  return (
    <th style={{
      textAlign: align ?? (last ? "right" : "left"),
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      color: "var(--ed2-ink-2)",
      padding: "18px 14px",
      paddingLeft: first ? 28 : 14,
      paddingRight: last ? 28 : 14,
      background: "var(--ed2-surface-2)",
      borderBottom: "1px solid var(--ed2-hair)",
      whiteSpace: "nowrap",
    }}>{children}</th>
  );
}

function Td({ children, first, last, align }: { children: React.ReactNode; first?: boolean; last?: boolean; align?: "left" | "right" }) {
  return (
    <td style={{
      padding: "16px 14px",
      paddingLeft: first ? 28 : 14,
      paddingRight: last ? 28 : 14,
      textAlign: align ?? (last ? "right" : "left"),
      borderBottom: "1px solid var(--ed2-hair)",
      fontSize: 14,
      letterSpacing: "-0.005em",
      verticalAlign: "middle",
    }}>{children}</td>
  );
}

function NovoLeadModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [origem, setOrigem] = useState<string>("prospeccao");
  const [whatsapp, setWhatsapp] = useState("");

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") || "").trim();

    // Validações
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
          origem: String(fd.get("origem") || "prospeccao"),
          fonte_trafego: origem === "anuncio" ? String(fd.get("fonte_trafego") || "") : "",
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Erro");
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  };

  const iStyle: React.CSSProperties = { display: "block", width: "100%", borderRadius: 10, border: "1px solid var(--ed2-hair)", background: "var(--ed2-surface-2)", padding: "9px 12px", fontSize: 13, boxSizing: "border-box" };
  const lStyle: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 600, color: "var(--ed2-ink-2)", marginBottom: 5 };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, display: "grid", placeItems: "center", background: "rgba(11,24,56,0.45)", padding: 16 }}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "var(--ed2-card)", borderRadius: 24, boxShadow: "0 24px 60px rgba(0,0,0,0.18)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid var(--ed2-hair)" }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em" }}>Novo lead</h3>
          <button type="button" onClick={onClose} style={{ all: "unset", cursor: "pointer", color: "var(--ed2-ink-2)" } as React.CSSProperties}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4l10 10M14 4L4 14" /></svg>
          </button>
        </div>
        <div style={{ padding: "18px 22px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ gridColumn: "1/-1" }}><label style={lStyle}>Nome *</label><input name="nome" required placeholder="Nome do contato" style={iStyle} autoFocus /></div>
          <div><label style={lStyle}>Empresa</label><input name="empresa" placeholder="Razão social ou fantasia" style={iStyle} /></div>
          <div>
            <label style={lStyle}>Setor</label>
            <select name="setor" style={{ ...iStyle, appearance: "auto" } as React.CSSProperties}>
              <option value="">Selecionar…</option>
              {SETORES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div><label style={lStyle}>WhatsApp</label><input name="whatsapp" type="tel" inputMode="numeric" maxLength={15} value={whatsapp} onChange={(e) => setWhatsapp(formatPhone(e.target.value))} placeholder="(49) 99999-9999" style={iStyle} /></div>
          <div><label style={lStyle}>Email</label><input name="email" type="email" placeholder="email@empresa.com" style={iStyle} /></div>
          <div><label style={lStyle}>Faturamento mensal</label><input name="faturamento" placeholder="Ex: R$ 50k/mês" style={iStyle} /></div>
          <div>
            <label style={lStyle}>Status inicial</label>
            <select name="status" style={{ ...iStyle, appearance: "auto" } as React.CSSProperties}>
              {(["novo", "contatado", "diagnostico", "proposta"] as const).map((s) => (
                <option key={s} value={s}>{LEAD_STATUS_LABEL[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={lStyle}>Origem</label>
            <select name="origem" value={origem} onChange={(e) => setOrigem(e.target.value)} style={{ ...iStyle, appearance: "auto" } as React.CSSProperties}>
              {LEAD_ORIGENS.map((o) => (
                <option key={o} value={o}>{LEAD_ORIGEM_LABEL[o]}</option>
              ))}
            </select>
          </div>
          {origem === "anuncio" && (
            <div style={{ gridColumn: "1/-1" }}>
              <label style={lStyle}>Fonte de tráfego</label>
              <select name="fonte_trafego" style={{ ...iStyle, appearance: "auto" } as React.CSSProperties}>
                {FONTES_TRAFEGO.map((f) => (
                  <option key={f} value={f}>{FONTE_TRAFEGO_LABEL[f]}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        {error ? <p style={{ padding: "0 22px", color: "#c8261c", fontSize: 12, margin: "0 0 4px" }}>{error}</p> : null}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 22px", borderTop: "1px solid var(--ed2-hair)" }}>
          <button type="button" onClick={onClose} style={{ all: "unset", cursor: "pointer", padding: "9px 14px", color: "var(--ed2-ink-2)", fontSize: 13 } as React.CSSProperties}>Cancelar</button>
          <button type="submit" disabled={saving} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#C9A961", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : null}
            Criar lead
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Importar lista de leads (colar) ─────────────────────────────────────────
function ImportarLeadsModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ importados: number; pulados: number } | null>(null);

  const linhas = texto.split(/\r?\n/).filter((l) => l.trim()).length;

  const importar = async () => {
    setErro(null); setEnviando(true);
    try {
      const r = await fetch("/api/admin/leads/importar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texto }) });
      const d = await r.json();
      if (!r.ok || d.error) { setErro(d.error ?? "Falha ao importar."); return; }
      setResultado({ importados: d.importados ?? 0, pulados: d.pulados ?? 0 });
    } catch { setErro("Falha de conexão."); } finally { setEnviando(false); }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(11,24,56,0.45)", display: "grid", placeItems: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(600px,100%)", maxHeight: "92vh", overflowY: "auto", background: "var(--ed2-card)", borderRadius: 22, boxShadow: "0 24px 70px rgba(0,0,0,0.3)" }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--ed2-hair)", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 17, fontWeight: 700, flex: 1 }}>Importar lista de leads</div>
          <button type="button" onClick={onClose} style={{ all: "unset", cursor: "pointer", width: 32, height: 32, borderRadius: 9, display: "grid", placeItems: "center", background: "var(--ed2-surface)", color: "var(--ed2-ink-2)" }}>✕</button>
        </div>
        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
          {resultado ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: 34, fontWeight: 800, color: "var(--pill-green-fg)" }}>{resultado.importados}</div>
              <div style={{ fontSize: 14, color: "var(--ed2-ink-2)", marginTop: 4 }}>
                lead{resultado.importados === 1 ? "" : "s"} importado{resultado.importados === 1 ? "" : "s"}
                {resultado.pulados > 0 ? ` · ${resultado.pulados} já existiam (pulados)` : ""}
              </div>
              <button type="button" onClick={onDone} style={{ marginTop: 18, padding: "11px 22px", borderRadius: 12, border: "none", cursor: "pointer", background: "var(--ed2-navy)", color: "#fff", fontSize: 14, fontWeight: 650 }}>Ver os leads</button>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12.5, color: "var(--ed2-ink-2)", lineHeight: 1.5 }}>
                Uma linha por lead, separando com <b>|</b> (barra vertical):<br />
                <code style={{ fontSize: 12 }}>nome | whatsapp | nicho | cidade | notas</code><br />
                Só o nome é obrigatório. Quem já está no funil (mesmo número) é pulado.
              </div>
              <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={9}
                placeholder={"Padaria Doce Pão | (49) 99139-2535 | Padaria | Xanxerê | lead morno, decide o filho\nJaison Alves Advocacia | (49) 90000-0000 | Advocacia | Xanxerê |"}
                style={{ width: "100%", boxSizing: "border-box", padding: "13px 15px", borderRadius: 12, border: "1px solid var(--ed2-hair)", background: "var(--ed2-surface)", color: "var(--ed2-ink)", fontSize: 13, lineHeight: 1.55, outline: "none", resize: "vertical", minHeight: 150, fontFamily: "ui-monospace, monospace" }} />
              {erro && <div style={{ fontSize: 12.5, color: "#c8261c" }}>{erro}</div>}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button type="button" onClick={importar} disabled={enviando || linhas === 0}
                  style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 20px", borderRadius: 12, border: "none", cursor: enviando || linhas === 0 ? "default" : "pointer", background: "linear-gradient(135deg,#C9A961,#a8893d)", color: "#fff", fontSize: 14, fontWeight: 650, opacity: enviando || linhas === 0 ? 0.5 : 1 }}>
                  {enviando ? <Loader2 size={15} className="animate-spin" /> : null} Importar {linhas > 0 ? `${linhas} linha${linhas === 1 ? "" : "s"}` : ""}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

