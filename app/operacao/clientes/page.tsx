"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";

/* ── Toast ── */
interface ToastMsg { id: number; text: string; icon?: string }
let _toastId = 0;
function useToast() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const show = useCallback((text: string, icon = "✓") => {
    const id = ++_toastId;
    setToasts((t) => [...t, { id, text, icon }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  }, []);
  return { toasts, show };
}
function ToastContainer({ toasts }: { toasts: ToastMsg[] }) {
  return (
    <div style={{ position: "fixed", bottom: 28, right: 28, zIndex: 999, display: "flex", flexDirection: "column", gap: 10, pointerEvents: "none" }}>
      {toasts.map((t) => (
        <div key={t.id} style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "#0B1838", color: "#F5F2EA", padding: "12px 18px", borderRadius: 14, fontSize: 13, fontWeight: 500, boxShadow: "0 8px 24px rgba(0,0,0,0.22)", animation: "slideUp .22s ease" }}>
          <span style={{ display: "inline-flex", color: t.icon === "✗" ? "#FF6B61" : "#34C759" }}>
            {t.icon === "✗"
              ? <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l6 6M9 3l-6 6" /></svg>
              : <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6l2.5 2.5L9.5 3.5" /></svg>}
          </span>
          {t.text}
        </div>
      ))}
      <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}
import {
  CLIENTE_STATUSES,
  CLIENTE_STATUS_LABEL,
  type Cliente,
  type ClienteStatus,
} from "@/lib/groow/types";
import { isValidPhone, isValidEmail } from "@/lib/groow/format";

const brl0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

type CardStatus = "ativo" | "pausado" | "risco";

const STATUS_TONE: Record<CardStatus, { bg: string; fg: string; dot: string; label: string }> = {
  ativo: { bg: "rgba(52,199,89,0.14)", fg: "#1d8a3a", dot: "#34C759", label: "Ativo" },
  pausado: { bg: "var(--ed2-surface)", fg: "var(--ed2-ink-2)", dot: "var(--ed2-ink-2)", label: "Pausado" },
  risco: { bg: "rgba(255,59,48,0.14)", fg: "#c8261c", dot: "#FF3B30", label: "Em risco" },
};

const FILTER_PILLS: { key: "" | CardStatus; label: string; dot?: string }[] = [
  { key: "", label: "Todos" },
  { key: "ativo", label: "Ativos", dot: "#34C759" },
  { key: "pausado", label: "Pausados", dot: "var(--ed2-ink-2)" },
  { key: "risco", label: "Em risco", dot: "#FF3B30" },
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

function classifyContract(plano: string | null): { type: "retainer" | "setup" | "avulso"; label: string } {
  const p = (plano || "").toLowerCase();
  if (p.includes("setup")) return { type: "setup", label: "Setup + Retainer" };
  if (p.includes("avulso") || p.includes("pontual")) return { type: "avulso", label: "Avulso" };
  return { type: "retainer", label: "Retainer" };
}

function clientStatus(c: Cliente): CardStatus {
  if (c.status === "pausado") return "pausado";
  // risco se ativo + último contato muito antigo (proxy: progresso < 30 + > 60 dias)
  return "ativo";
}

function mesesDesde(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24 * 30)));
}

function ClientCard({ c, onClick, onCopy, onAction }: { c: Cliente; onClick: () => void; onCopy: (text: string, label: string) => void; onAction: (action: string, cliente: Cliente) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);
  const st = clientStatus(c);
  const tone = STATUS_TONE[st];
  const contract = classifyContract(c.plano);
  const meses = mesesDesde(c.inicio_contrato);
  const stage = c.progresso >= 80 ? { key: "otim", label: "Otimizando", color: "#C9A961" } : c.progresso >= 40 ? { key: "rodando", label: "Rodando", color: "#34C759" } : { key: "montando", label: "Montando", color: "#0A84FF" };

  const contractStyle: React.CSSProperties =
    contract.type === "setup" ? { background: "rgba(10,132,255,0.12)", color: "var(--pill-blue-fg)" } :
    contract.type === "retainer" ? { background: "rgba(201,169,97,0.12)", color: "var(--pill-gold-fg)" } :
    { background: "var(--ed2-surface)", color: "var(--ed2-ink)" };

  return (
    <div
      onClick={onClick}
      className="client-card"
      style={{
        background: "var(--ed2-card)",
        borderRadius: 28,
        padding: 24,
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        transition: "transform .2s, box-shadow .2s",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      {/* TOP */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <div style={{ width: 52, height: 52, borderRadius: 99, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: gradFor(c.empresa), color: "#fff", fontWeight: 600, fontSize: 16, letterSpacing: "-0.01em" }}>{initials(c.empresa)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.empresa}</div>
          <div style={{ fontSize: 13, color: "var(--ed2-ink-2)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.responsavel || "-"}</div>
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, letterSpacing: "-0.005em", flexShrink: 0, background: tone.bg, color: tone.fg }}>
          <span style={{ width: 6, height: 6, borderRadius: 99, background: tone.dot }} />
          {tone.label}
        </span>
      </div>

      {/* CONTRACT pill */}
      <span style={{ display: "inline-flex", alignSelf: "flex-start", alignItems: "center", gap: 7, padding: "5px 11px", borderRadius: 999, fontSize: 11, fontWeight: 500, ...contractStyle }}>
        {contract.label}
      </span>

      {/* MRR + SETUP */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            R$ {brl0.format(Number(c.valor_mensal || 0))}<span style={{ fontSize: 13, color: "var(--ed2-ink-2)", fontWeight: 500, marginLeft: 4 }}>/mês</span>
          </div>
          {Number(c.valor_setup) > 0 && (
            <div style={{ fontSize: 12, color: "#0a84ff", fontWeight: 600, marginTop: 4 }}>
              + R$ {brl0.format(Number(c.valor_setup))} setup
            </div>
          )}
        </div>
        <div style={{ fontSize: 12, color: "var(--ed2-ink-2)" }}>cliente há {meses}m</div>
      </div>

      {/* PROGRESS */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12 }}>
          <span style={{ fontWeight: 600, color: stage.color, display: "inline-flex", alignItems: "center", gap: 5 }}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="currentColor"><circle cx="5.5" cy="5.5" r="3.5" /></svg>
            {stage.label}
          </span>
          <span style={{ color: "var(--ed2-ink-2)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{c.progresso}%</span>
        </div>
        <div style={{ height: 5, background: "var(--ed2-surface)", borderRadius: 99, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${c.progresso}%`, borderRadius: 99, background: stage.color }} />
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 14, borderTop: "1px solid var(--ed2-hair)", gap: 10 }}>
        {c.notas ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 999, background: "var(--ed2-surface)", color: "var(--ed2-ink-2)", fontSize: 11, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "65%" }}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="5.5" cy="5.5" r="3.7" /><path d="M5.5 3.3v2.2l1.4 1" /></svg>
            {c.notas.slice(0, 28)}
          </span>
        ) : <span />}
        <div style={{ display: "flex", gap: 4 }}>
          {c.whatsapp ? (
            <a href={`https://wa.me/${(c.whatsapp || "").replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title="WhatsApp" style={{ ...cActionStyle, color: "#1d8a3a", background: "rgba(52,199,89,0.12)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0 0 20.464 3.488" /></svg>
            </a>
          ) : null}
          {c.email ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onCopy(c.email!, "E-mail copiado"); }}
              title={`Copiar email: ${c.email}`}
              style={cActionStyle}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 7 9-7" /></svg>
            </button>
          ) : null}
          <div ref={menuRef} style={{ position: "relative" }}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
              title="Mais opções"
              style={cActionStyle}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><circle cx="4" cy="8" r="1.3" /><circle cx="8" cy="8" r="1.3" /><circle cx="12" cy="8" r="1.3" /></svg>
            </button>
            {menuOpen && (
              <div style={{ position: "absolute", bottom: "calc(100% + 6px)", right: 0, background: "var(--ed2-card)", borderRadius: 14, boxShadow: "0 8px 24px rgba(0,0,0,0.14)", border: "1px solid var(--ed2-hair)", minWidth: 180, zIndex: 10, overflow: "hidden" }}>
                {([
                  { label: "Editar cliente", icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M11 2l3 3-8 8H3v-3z" /></svg>, action: "editar", show: true },
                  { label: "Copiar email", icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="5" width="9" height="9" rx="2" /><path d="M2 11V3a1 1 0 0 1 1-1h8" /></svg>, action: "copiar-email", show: !!c.email },
                  { label: "Copiar WhatsApp", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0 0 20.464 3.488" /></svg>, action: "copiar-whatsapp", show: !!c.whatsapp },
                  { label: c.status === "pausado" ? "Ativar contrato" : "Pausar contrato", icon: c.status === "pausado"
                    ? <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M3 2l11 6-11 6z" /></svg>
                    : <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="2" width="4" height="12" rx="1" /><rect x="9" y="2" width="4" height="12" rx="1" /></svg>, action: "toggle-status", show: true },
                  { label: "Excluir cliente", icon: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4h12M5 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1M6 7v5M10 7v5M3 4l1 9a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-9" /></svg>, action: "excluir", show: true, danger: true },
                ] as { label: string; icon: React.ReactNode; action: string; show: boolean; danger?: boolean }[]).filter(item => item.show).map((item) => (
                  <button
                    key={item.action}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onAction(item.action, c); }}
                    style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500, color: item.danger ? "#c8261c" : "var(--ed2-ink)", textAlign: "left" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = item.danger ? "rgba(255,59,48,0.06)" : "var(--ed2-surface-2)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                  >
                    <span style={{ color: item.danger ? "#c8261c" : "var(--ed2-ink-2)", display: "flex", alignItems: "center" }}>{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const cActionStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 99,
  background: "var(--ed2-surface)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--ed2-ink-2)",
  cursor: "pointer",
  textDecoration: "none",
};

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filterKey, setFilterKey] = useState<"" | CardStatus>("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [busca, setBusca] = useState("");
  const { toasts, show: showToast } = useToast();

  const copyToClipboard = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => showToast(label, "✓")).catch(() => showToast("Erro ao copiar", "✗"));
  }, [showToast]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/clientes");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setClientes(data.clientes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAction = useCallback(async (action: string, cliente: Cliente) => {
    if (action === "editar") { setSelectedId(cliente.id); return; }
    if (action === "copiar-email" && cliente.email) { copyToClipboard(cliente.email, `Email copiado: ${cliente.email}`); return; }
    if (action === "copiar-whatsapp" && cliente.whatsapp) { copyToClipboard(cliente.whatsapp, `WhatsApp copiado: ${cliente.whatsapp}`); return; }
    if (action === "toggle-status") {
      const novoStatus = cliente.status === "pausado" ? "ativo" : "pausado";
      await fetch(`/api/admin/clientes/${cliente.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: novoStatus }) });
      showToast(novoStatus === "ativo" ? "Contrato ativado" : "Contrato pausado", novoStatus === "ativo" ? "▶" : "⏸");
      load();
      return;
    }
    if (action === "excluir") {
      if (!confirm(`Excluir ${cliente.empresa}? Esta ação não pode ser desfeita.`)) return;
      await fetch(`/api/admin/clientes/${cliente.id}`, { method: "DELETE" });
      showToast("Cliente excluído", "🗑");
      load();
    }
  }, [copyToClipboard, load, showToast]);

  const ativos = clientes.filter((c) => c.status === "ativo");
  const mensalAtivo = ativos.reduce((s, c) => s + Number(c.valor_mensal || 0), 0);
  const ticketMedio = ativos.length > 0 ? mensalAtivo / ativos.length : 0;
  const maior = ativos.slice().sort((a, b) => Number(b.valor_mensal) - Number(a.valor_mensal))[0];
  const vencendo = clientes.filter((c) => c.fim_contrato && new Date(c.fim_contrato).getTime() - Date.now() < 30 * 86400000 && c.status === "ativo").length;

  const filtered = clientes.filter((c) => {
    if (filterKey && clientStatus(c) !== filterKey) return false;
    if (busca) {
      const q = busca.toLowerCase();
      return (c.empresa || "").toLowerCase().includes(q) || (c.responsavel || "").toLowerCase().includes(q) || (c.email || "").toLowerCase().includes(q);
    }
    return true;
  });

  const countByCardStatus = (k: CardStatus) => clientes.filter((c) => clientStatus(c) === k).length;

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24, gap: 24, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 42, fontWeight: 700, letterSpacing: "-0.035em", margin: "0 0 6px", lineHeight: 1.05 }}>Clientes</h1>
          <div style={{ color: "var(--ed2-ink-2)", fontSize: 15 }}>
            {loading ? "Carregando carteira…" : (
              <>
                <b style={{ color: "var(--ed2-ink)", fontWeight: 600 }}>{ativos.length}</b> ativo{ativos.length === 1 ? "" : "s"} · <b style={{ color: "var(--ed2-ink)", fontWeight: 600 }}>R$ {brl0.format(mensalAtivo)}</b> MRR{vencendo > 0 ? <> · <b style={{ color: "var(--ed2-ink)", fontWeight: 600 }}>{vencendo}</b> contrato{vencendo === 1 ? "" : "s"} vencendo</> : null}
              </>
            )}
          </div>
        </div>
        <button type="button" onClick={() => setModalOpen(true)} style={newBtnStyle}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M8 3v10M3 8h10" /></svg>
          Novo cliente
        </button>
      </div>

      {/* STATS */}
      {!loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18, marginBottom: 22 }}>
          <StatCard
            label="MRR · Receita recorrente"
            value={`R$ ${brl0.format(mensalAtivo)}`}
            delta={`↗ ${ativos.length} contratos ativos`}
            desc={<>{ativos.length} contratos ativos · próxima cobrança em breve</>}
            iconBg="linear-gradient(135deg,#C9A961,#a8893d)"
            spark="M0,28 L10,26 L20,22 L30,20 L40,15 L50,14 L60,10 L70,7 L80,4"
            sparkColor="#C9A961"
            icon={<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M8 2v12M5 4h5a2 2 0 0 1 0 4H6a2 2 0 0 0 0 4h5" /></svg>}
          />
          <StatCard
            label="Ticket médio"
            value={`R$ ${brl0.format(ticketMedio)}`}
            delta="↗ por cliente ativo"
            desc={maior ? <>Maior contrato: <b style={{ color: "var(--ed2-ink)" }}>{maior.empresa}</b> · R$ {brl0.format(Number(maior.valor_mensal || 0))}</> : "-"}
            iconBg="linear-gradient(135deg,#0B1838,#1d2d56)"
            spark="M0,22 L10,20 L20,18 L30,21 L40,16 L50,14 L60,12 L70,10 L80,8"
            sparkColor="#0B1838"
            icon={<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="12" height="9" rx="1.5" /><path d="M2 7h12" /></svg>}
          />
          <StatCard
            label="Carteira ativa"
            value={`${ativos.length}`}
            delta="↗ saudável"
            desc={<>{clientes.length - ativos.length} pausado{clientes.length - ativos.length === 1 ? "" : "s"} · {vencendo} vencendo</>}
            iconBg="linear-gradient(135deg,#34C759,#1d8a3a)"
            spark="M0,8 L10,9 L20,11 L30,14 L40,12 L50,16 L60,20 L70,22 L80,24"
            sparkColor="#34C759"
            icon={<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 13l4-4 3 3 3-6" /><path d="M13 6h-3" /></svg>}
          />
        </div>
      )}

      {/* TOOLBAR */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--ed2-card)", borderRadius: 999, padding: "11px 18px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", width: 320, color: "var(--ed2-ink-2)", fontSize: 14 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input type="search" placeholder="Buscar por nome, empresa, email…" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ all: "unset", flex: 1, fontSize: 14, color: "var(--ed2-ink)" } as React.CSSProperties} />
        </div>

        <div style={{ display: "inline-flex", background: "var(--ed2-card)", padding: 4, borderRadius: 999, gap: 2, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          {FILTER_PILLS.map((pill) => {
            const isOn = filterKey === pill.key;
            const cnt = pill.key === "" ? clientes.length : countByCardStatus(pill.key);
            return (
              <button key={pill.key} type="button" onClick={() => setFilterKey(pill.key)} style={{
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
              } as React.CSSProperties}>
                {pill.dot && <span style={{ width: 6, height: 6, borderRadius: 99, background: pill.dot }} />}
                {pill.label}
                <span style={{ background: isOn ? "var(--ed2-card)" : "var(--ed2-surface)", color: "var(--ed2-ink-2)", padding: "1px 7px", borderRadius: 99, fontSize: 11, fontWeight: 600 }}>{cnt}</span>
              </button>
            );
          })}
        </div>

        <div style={{ marginLeft: "auto", display: "inline-flex", background: "var(--ed2-card)", borderRadius: 999, padding: 4, gap: 2, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <button type="button" onClick={() => setViewMode("cards")} style={{
            all: "unset",
            cursor: "pointer",
            padding: "8px 14px",
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 600,
            color: viewMode === "cards" ? "var(--ed2-ink)" : "var(--ed2-ink-2)",
            background: viewMode === "cards" ? "var(--ed2-surface)" : "transparent",
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
          } as React.CSSProperties}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="5" height="5" rx="1" /><rect x="9" y="2" width="5" height="5" rx="1" /><rect x="2" y="9" width="5" height="5" rx="1" /><rect x="9" y="9" width="5" height="5" rx="1" /></svg>
            Cards
          </button>
          <button type="button" onClick={() => setViewMode("table")} style={{
            all: "unset",
            cursor: "pointer",
            padding: "8px 14px",
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 600,
            color: viewMode === "table" ? "var(--ed2-ink)" : "var(--ed2-ink-2)",
            background: viewMode === "table" ? "var(--ed2-surface)" : "transparent",
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
          } as React.CSSProperties}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4h12M2 8h12M2 12h12" /></svg>
            Tabela
          </button>
        </div>
      </div>

      {error ? <div style={{ background: "rgba(255,59,48,0.06)", border: "1px solid rgba(255,59,48,0.18)", borderRadius: 18, padding: "12px 18px", color: "#c8261c", fontSize: 13, marginBottom: 18 }}>{error}</div> : null}

      {loading ? (
        <div style={{ display: "grid", placeItems: "center", padding: "60px 0" }}><Loader2 className="animate-spin" style={{ color: "var(--ed2-ink-3)" }} /></div>
      ) : viewMode === "cards" ? (
        filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--ed2-ink-2)", fontSize: 14 }}>Nenhum cliente.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 18 }}>
            {filtered.map((c) => <ClientCard key={c.id} c={c} onClick={() => setSelectedId(c.id)} onCopy={copyToClipboard} onAction={handleAction} />)}
          </div>
        )
      ) : (
        <div style={{ background: "var(--ed2-card)", borderRadius: 28, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontVariantNumeric: "tabular-nums" }}>
              <thead>
                <tr><Th first>Empresa</Th><Th>Plano</Th><Th>Valor</Th><Th>Início</Th><Th>Status</Th><Th last>Progresso</Th></tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const st = clientStatus(c);
                  const tone = STATUS_TONE[st];
                  return (
                    <tr key={c.id} className="client-row">
                      <Td first>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 99, background: gradFor(c.empresa), color: "#fff", fontWeight: 600, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{initials(c.empresa)}</div>
                          <div>
                            <div style={{ fontWeight: 600, letterSpacing: "-0.01em" }}>{c.empresa}</div>
                            {c.responsavel ? <div style={{ color: "var(--ed2-ink-2)", fontSize: 12.5, marginTop: 1 }}>{c.responsavel}</div> : null}
                          </div>
                        </div>
                      </Td>
                      <Td>{c.plano || "-"}</Td>
                      <Td><span style={{ fontWeight: 600 }}>R$ {brl0.format(Number(c.valor_mensal || 0))}</span></Td>
                      <Td><span style={{ color: "var(--ed2-ink-2)", fontSize: 13 }}>{new Date(c.inicio_contrato).toLocaleDateString("pt-BR")}</span></Td>
                      <Td>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: tone.bg, color: tone.fg }}>
                          <span style={{ width: 6, height: 6, borderRadius: 99, background: tone.dot }} />
                          {tone.label}
                        </span>
                      </Td>
                      <Td last>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 80, height: 6, background: "var(--ed2-surface)", borderRadius: 99, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${c.progresso}%`, background: "linear-gradient(90deg,#C9A961,#a8893d)", borderRadius: 99 }} />
                          </div>
                          <span style={{ fontSize: 12, color: "var(--ed2-ink-2)", minWidth: 32, textAlign: "right" }}>{c.progresso}%</span>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalOpen ? <NovoClienteModal onClose={() => setModalOpen(false)} onCreated={load} /> : null}
      {selectedId ? <ClienteDetalheModal id={selectedId} onClose={() => setSelectedId(null)} onUpdated={load} /> : null}
      <ToastContainer toasts={toasts} />

      <style>{`
        .client-card:hover { box-shadow: 0 6px 18px rgba(0,0,0,0.07) !important; transform: scale(1.005) !important; }
        .client-row:hover td { background: var(--ed2-surface-2) !important; }
      `}</style>
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

function StatCard({ label, value, delta, desc, iconBg, icon, spark, sparkColor }: { label: string; value: string; delta?: string; desc?: React.ReactNode; iconBg: string; icon: React.ReactNode; spark: string; sparkColor: string }) {
  return (
    <div style={{ background: "var(--ed2-card)", borderRadius: 24, padding: "24px 28px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column", gap: 8, position: "relative", overflow: "hidden" }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ed2-ink-2)", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 24, height: 24, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", background: iconBg }}>
          <span style={{ width: 13, height: 13, display: "block" }}>{icon}</span>
        </span>
        {label}
      </div>
      <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>{value}</div>
      {delta ? <div style={{ fontSize: 13, fontWeight: 600, color: "#1d8a3a" }}>{delta}</div> : null}
      {desc ? <div style={{ fontSize: 12, color: "var(--ed2-ink-2)" }}>{desc}</div> : null}
      <svg width="80" height="34" viewBox="0 0 80 34" style={{ position: "absolute", right: 20, bottom: 20, opacity: 0.85 }}>
        <path d={spark} fill="none" stroke={sparkColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function Th({ children, first, last }: { children: React.ReactNode; first?: boolean; last?: boolean }) {
  return <th style={{ textAlign: last ? "right" : "left", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ed2-ink-2)", padding: "18px 14px", paddingLeft: first ? 28 : 14, paddingRight: last ? 28 : 14, background: "var(--ed2-surface-2)", borderBottom: "1px solid var(--ed2-hair)" }}>{children}</th>;
}
function Td({ children, first, last }: { children: React.ReactNode; first?: boolean; last?: boolean }) {
  return <td style={{ padding: "16px 14px", paddingLeft: first ? 28 : 14, paddingRight: last ? 28 : 14, textAlign: last ? "right" : "left", borderBottom: "1px solid var(--ed2-hair)", fontSize: 14, letterSpacing: "-0.005em", verticalAlign: "middle" }}>{children}</td>;
}

const PLANOS_OPCOES = [
  "Diagnóstico (avulso)",
  "Operação Completa (recorrente)",
  "Retainer mensal",
  "Setup + Retainer",
  "Avulso / Projeto pontual",
];

interface PagamentoMes { mes: string; label: string; vencimento: string; status: string; valor: number; pagoEm: string | null }

function ClienteDetalheModal({ id, onClose, onUpdated }: { id: number; onClose: () => void; onUpdated: () => void }) {
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [progresso, setProgresso] = useState(0);
  const [pagamentos, setPagamentos] = useState<PagamentoMes[]>([]);

  const loadPagamentos = useCallback(() => {
    fetch(`/api/admin/clientes/${id}/pagamentos`).then((r) => r.json()).then((d) => setPagamentos(d.pagamentos || [])).catch(() => {});
  }, [id]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/clientes/${id}`)
      .then((r) => r.json())
      .then((d) => { setCliente(d.cliente); setProgresso(d.cliente?.progresso ?? 0); })
      .catch(() => setError("Erro ao carregar"))
      .finally(() => setLoading(false));
    loadPagamentos();
  }, [id, loadPagamentos]);

  const marcarMesPago = async (p: PagamentoMes) => {
    if (!cliente) return;
    setError("");
    try {
      const res = await fetch("/api/admin/transacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // vencimento já vem como "YYYY-MM-DD" - usa direto (Date + timezone voltava 1 dia)
        body: JSON.stringify({ cliente_id: id, tipo: "recorrente", valor: cliente.valor_mensal, data: p.vencimento.slice(0, 10), descricao: `Mensalidade ${p.label} ${cliente.empresa}` }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error || "Não consegui marcar como pago. Tenta de novo.");
        return;
      }
      // a API não duplica recorrente no mesmo mês: sem este aviso o clique
      // parecia funcionar e nada mudava na tela
      if (d.jaExistia) setError(`${p.label} já estava registrado como pago. Nada foi lançado de novo.`);
      loadPagamentos();
    } catch {
      setError("Falha de conexão ao marcar pago.");
    }
  };

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!cliente) return;
    setSaving(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") || "").trim();
    const whatsapp = String(fd.get("whatsapp") || "").trim();
    if (whatsapp && !isValidPhone(whatsapp)) { setError("WhatsApp inválido (DDD + número)."); setSaving(false); return; }
    if (email && !isValidEmail(email)) { setError("Email inválido."); setSaving(false); return; }
    const payload = {
      empresa: String(fd.get("empresa") || "").trim(),
      responsavel: String(fd.get("responsavel") || "").trim(),
      email,
      whatsapp,
      plano: String(fd.get("plano") || ""),
      valor_mensal: Number(fd.get("valor_mensal") || 0),
      valor_setup: Number(fd.get("valor_setup") || 0),
      inicio_contrato: String(fd.get("inicio_contrato") || ""),
      fim_contrato: String(fd.get("fim_contrato") || "") || null,
      status: String(fd.get("status") || "ativo") as ClienteStatus,
      progresso,
      notas: String(fd.get("notas") || "").trim(),
    };
    try {
      const res = await fetch(`/api/admin/clientes/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error((await res.json()).error || "Erro");
      onUpdated();
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : "Erro"); }
    finally { setSaving(false); }
  };

  const iStyle: React.CSSProperties = { display: "block", width: "100%", borderRadius: 10, border: "1px solid var(--ed2-hair)", background: "var(--ed2-surface-2)", padding: "9px 12px", fontSize: 13, boxSizing: "border-box" };
  const lStyle: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 600, color: "var(--ed2-ink-2)", marginBottom: 5, letterSpacing: "0.03em" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, display: "grid", placeItems: "center", background: "rgba(11,24,56,0.45)", padding: 16 }}>
      <form onSubmit={save} onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 580, maxHeight: "90vh", overflowY: "auto", background: "var(--ed2-card)", borderRadius: 24, boxShadow: "0 24px 60px rgba(0,0,0,0.18)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: "1px solid var(--ed2-hair)", position: "sticky", top: 0, background: "var(--ed2-card)", zIndex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em" }}>{loading ? "Carregando…" : (cliente?.empresa || "Cliente")}</h2>
          <button type="button" onClick={onClose} style={{ all: "unset", cursor: "pointer", color: "var(--ed2-ink-2)" }}><X size={20} /></button>
        </div>

        {loading ? (
          <div style={{ display: "grid", placeItems: "center", padding: 48 }}><Loader2 className="animate-spin" style={{ color: "var(--ed2-ink-3)" }} /></div>
        ) : cliente ? (
          <div style={{ padding: "20px 24px", display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 }}>
            <div><label style={lStyle}>Empresa *</label><input name="empresa" required defaultValue={cliente.empresa} style={iStyle} /></div>
            <div><label style={lStyle}>Responsável</label><input name="responsavel" defaultValue={cliente.responsavel || ""} style={iStyle} /></div>
            <div><label style={lStyle}>Email</label><input name="email" type="email" defaultValue={cliente.email || ""} style={iStyle} /></div>
            <div><label style={lStyle}>WhatsApp</label><input name="whatsapp" defaultValue={cliente.whatsapp || ""} style={iStyle} /></div>
            <div>
              <label style={lStyle}>Plano</label>
              <select name="plano" defaultValue={cliente.plano || ""} style={{ ...iStyle, appearance: "auto" }}>
                <option value="">Selecionar…</option>
                {PLANOS_OPCOES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label style={lStyle}>Status</label>
              <select name="status" defaultValue={cliente.status} style={{ ...iStyle, appearance: "auto" }}>
                {CLIENTE_STATUSES.map((s) => <option key={s} value={s}>{CLIENTE_STATUS_LABEL[s]}</option>)}
              </select>
            </div>
            <div><label style={lStyle}>Mensal recorrente (R$)</label><input name="valor_mensal" type="number" min="0" step="0.01" defaultValue={Number(cliente.valor_mensal || 0)} style={iStyle} /></div>
            <div><label style={lStyle}>Setup / entrada única (R$)</label><input name="valor_setup" type="number" min="0" step="0.01" defaultValue={Number(cliente.valor_setup || 0)} style={iStyle} /></div>
            <div><label style={lStyle}>Início *</label><input name="inicio_contrato" type="date" required min="2020-01-01" max="2030-12-31" defaultValue={cliente.inicio_contrato?.slice(0, 10) || ""} style={iStyle} /></div>
            <div><label style={lStyle}>Fim (opcional)</label><input name="fim_contrato" type="date" min="2020-01-01" max="2035-12-31" defaultValue={cliente.fim_contrato?.slice(0, 10) || ""} style={iStyle} /></div>
            <div style={{ gridColumn: "1/-1" }}>
              <label style={lStyle}>Progresso da implantação, {progresso}%</label>
              <input type="range" min="0" max="100" value={progresso} onChange={(e) => setProgresso(Number(e.target.value))} style={{ width: "100%", accentColor: "#C9A961" }} />
            </div>
            <div style={{ gridColumn: "1/-1" }}><label style={lStyle}>Notas</label><textarea name="notas" rows={3} defaultValue={cliente.notas || ""} style={{ ...iStyle, resize: "vertical", fontFamily: "inherit" }} /></div>

            {/* HISTÓRICO DE PAGAMENTOS */}
            {pagamentos.length > 0 && (
              <div style={{ gridColumn: "1/-1", marginTop: 4 }}>
                <label style={{ ...lStyle, marginBottom: 8 }}>Histórico de pagamentos (mensalidade)</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" }}>
                  {pagamentos.map((p) => {
                    const cfg = p.status === "pago" ? { bg: "rgba(52,199,89,0.1)", fg: "#1d8a3a", txt: "Pago" }
                      : p.status === "atrasado" ? { bg: "rgba(255,59,48,0.08)", fg: "#c8261c", txt: "Faltou" }
                      : p.status === "a_vencer" ? { bg: "rgba(255,159,10,0.1)", fg: "#a85f00", txt: "A vencer" }
                      : { bg: "#F7F7F9", fg: "var(--ed2-ink-2)", txt: "Futuro" };
                    return (
                      <div key={p.mes} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 12px", borderRadius: 10, background: cfg.bg }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, textTransform: "capitalize", minWidth: 64 }}>{p.label}</span>
                          <span style={{ fontSize: 12, color: cfg.fg, fontWeight: 600 }}>{cfg.txt}</span>
                          {p.pagoEm && <span style={{ fontSize: 11, color: "var(--ed2-ink-2)" }}>em {new Date(p.pagoEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>R$ {brl0.format(p.valor)}</span>
                          {(p.status === "atrasado" || p.status === "a_vencer") && (
                            <button type="button" onClick={() => marcarMesPago(p)}
                              style={{ background: "#34C759", color: "#fff", border: "none", borderRadius: 999, padding: "4px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                              Marcar pago
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : null}

        {error ? <p style={{ padding: "0 24px", color: "#c8261c", fontSize: 13 }}>{error}</p> : null}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 24px", borderTop: "1px solid var(--ed2-hair)" }}>
          <button type="button" onClick={onClose} style={{ all: "unset", cursor: "pointer", padding: "9px 14px", color: "var(--ed2-ink-2)", fontSize: 13 }}>Cancelar</button>
          <button type="submit" disabled={saving || loading} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#C9A961", color: "#fff", border: "none", padding: "10px 18px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            Salvar alterações
          </button>
        </div>
      </form>
    </div>
  );
}

function NovoClienteModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>("");

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") || "").trim();
    const whatsapp = String(fd.get("whatsapp") || "").trim();
    if (whatsapp && !isValidPhone(whatsapp)) { setError("WhatsApp inválido (DDD + número)."); setSaving(false); return; }
    if (email && !isValidEmail(email)) { setError("Email inválido."); setSaving(false); return; }
    const payload = {
      empresa: String(fd.get("empresa") || "").trim(),
      responsavel: String(fd.get("responsavel") || "").trim(),
      email,
      whatsapp,
      plano: String(fd.get("plano") || "").trim(),
      valor_mensal: Number(fd.get("valor_mensal") || 0),
      valor_setup: Number(fd.get("valor_setup") || 0),
      inicio_contrato: String(fd.get("inicio_contrato") || ""),
      fim_contrato: String(fd.get("fim_contrato") || "") || null,
      status: String(fd.get("status") || "ativo") as ClienteStatus,
      notas: String(fd.get("notas") || "").trim(),
    };
    try {
      const res = await fetch("/api/admin/clientes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error((await res.json()).error || "Erro");
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, display: "grid", placeItems: "center", background: "rgba(11,24,56,0.45)", padding: 16 }}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 600, maxHeight: "90vh", overflowY: "auto", background: "var(--ed2-card)", borderRadius: 24, boxShadow: "0 24px 60px rgba(0,0,0,0.18)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid var(--ed2-hair)", position: "sticky", top: 0, background: "var(--ed2-card)", zIndex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: "-0.02em" }}>Novo cliente</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" style={{ all: "unset", cursor: "pointer", padding: 6, borderRadius: 99, color: "var(--ed2-ink-2)" }}><X size={20} /></button>
        </div>
        <div style={{ padding: "20px 24px", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
          <Field name="empresa" label="Empresa *" required />
          <Field name="responsavel" label="Responsável" />
          <Field name="email" type="email" label="Email" />
          <Field name="whatsapp" label="WhatsApp" placeholder="(49) 99999-9999" />
          <div>
            <Label>Plano *</Label>
            <select name="plano" required style={{ display: "block", width: "100%", borderRadius: 12, border: "1px solid var(--ed2-hair)", background: "var(--ed2-surface-2)", padding: "10px 12px", fontSize: 14, boxSizing: "border-box" }}>
              <option value="">Selecionar plano…</option>
              <option value="Diagnóstico">Diagnóstico (avulso)</option>
              <option value="Operação Completa">Operação Completa (recorrente)</option>
              <option value="Retainer">Retainer mensal</option>
              <option value="Setup + Retainer">Setup + Retainer</option>
              <option value="Avulso">Avulso / Projeto pontual</option>
            </select>
          </div>
          <div>
            <Label>Status</Label>
            <select name="status" defaultValue="ativo" style={{ display: "block", width: "100%", borderRadius: 12, border: "1px solid var(--ed2-hair)", background: "var(--ed2-surface-2)", padding: "10px 12px", fontSize: 14, boxSizing: "border-box" }}>
              {CLIENTE_STATUSES.map((s) => <option key={s} value={s}>{CLIENTE_STATUS_LABEL[s]}</option>)}
            </select>
          </div>
          <Field name="valor_mensal" type="number" label="Valor mensal recorrente (R$)" placeholder="0" />
          <Field name="valor_setup" type="number" label="Setup / entrada única (R$)" placeholder="0" />
          <Field name="inicio_contrato" type="date" label="Início *" required min="2020-01-01" max="2030-12-31" />
          <Field name="fim_contrato" type="date" label="Fim (opcional)" min="2020-01-01" max="2035-12-31" />
          <div style={{ gridColumn: "1 / -1" }}>
            <Label>Notas</Label>
            <textarea name="notas" rows={3} style={{ display: "block", width: "100%", borderRadius: 12, border: "1px solid var(--ed2-hair)", background: "var(--ed2-surface-2)", padding: "10px 12px", fontSize: 14, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
          </div>
        </div>
        {error ? <p style={{ padding: "0 24px", color: "#c8261c", fontSize: 13 }}>{error}</p> : null}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "16px 24px", borderTop: "1px solid var(--ed2-hair)" }}>
          <button type="button" onClick={onClose} style={{ all: "unset", cursor: "pointer", padding: "10px 16px", color: "var(--ed2-ink-2)", fontSize: 13 }}>Cancelar</button>
          <button type="submit" disabled={saving} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#C9A961", color: "#fff", border: "none", padding: "10px 18px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            Criar cliente
          </button>
        </div>
      </form>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "var(--ed2-ink-2)", marginBottom: 6, letterSpacing: "0.02em" }}>{children}</label>;
}
function Field({ name, label, type = "text", required, placeholder, min, max }: { name: string; label: string; type?: string; required?: boolean; placeholder?: string; min?: string; max?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <input id={name} name={name} type={type} required={required} placeholder={placeholder} min={min} max={max} step={type === "number" ? "any" : undefined} style={{ display: "block", width: "100%", borderRadius: 12, border: "1px solid var(--ed2-hair)", background: "var(--ed2-surface-2)", padding: "10px 12px", fontSize: 14, boxSizing: "border-box" }} />
    </div>
  );
}
