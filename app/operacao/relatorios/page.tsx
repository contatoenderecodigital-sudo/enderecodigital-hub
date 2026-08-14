"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, ClipboardList, Trash2, ExternalLink, Copy, Check } from "lucide-react";

interface RelResumo { id: number; cliente: string; periodo: string; token: string; atualizado_em: string }

export default function RelatoriosPage() {
  const router = useRouter();
  const [relatorios, setRelatorios] = useState<RelResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [criando, setCriando] = useState(false);
  const [copiado, setCopiado] = useState<number | null>(null);
  const [excluindo, setExcluindo] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/relatorios");
      const d = await res.json();
      if (!d.error) setRelatorios(d.relatorios || []);
    } catch { /* */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const criar = async () => {
    if (criando) return;
    setCriando(true);
    try {
      const res = await fetch("/api/admin/relatorios", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const d = await res.json();
      if (d.id) router.push(`/operacao/relatorios/${d.id}`);
    } catch { /* */ } finally { setCriando(false); }
  };

  const copiarLink = (r: RelResumo) => {
    navigator.clipboard.writeText(`${window.location.origin}/r/${r.token}`).catch(() => {});
    setCopiado(r.id);
    setTimeout(() => setCopiado(null), 2000);
  };

  const excluir = async (id: number) => {
    if (excluindo) return;
    setExcluindo(id);
    try {
      await fetch(`/api/admin/relatorios/${id}`, { method: "DELETE" });
      setRelatorios((prev) => prev.filter((r) => r.id !== id));
    } catch { /* */ } finally { setExcluindo(null); }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 42, fontWeight: 700, letterSpacing: "-0.035em", margin: "0 0 6px", lineHeight: 1.05 }}>Relatórios</h1>
          <div style={{ color: "var(--ed2-ink-2)", fontSize: 15 }}>Relatório mensal white-label por cliente: preenche, copia o link e manda</div>
        </div>
        <button type="button" onClick={criar} disabled={criando}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#C9A961", color: "#fff", border: "none", padding: "12px 22px", borderRadius: 999, fontWeight: 600, fontSize: 14, cursor: "pointer", boxShadow: "0 4px 12px rgba(201,169,97,0.28)" }}>
          {criando ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Novo relatório
        </button>
      </div>

      {loading ? (
        <div style={{ display: "grid", placeItems: "center", padding: "60px 0" }}><Loader2 className="animate-spin" style={{ color: "var(--ed2-ink-3)" }} /></div>
      ) : relatorios.length === 0 ? (
        <div style={{ background: "var(--ed2-card)", borderRadius: 28, padding: 56, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: "linear-gradient(135deg,rgba(201,169,97,0.16),rgba(201,169,97,0.06))", margin: "0 auto 16px", display: "grid", placeItems: "center", color: "var(--pill-gold-fg)" }}>
            <ClipboardList size={28} strokeWidth={1.5} />
          </div>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Nenhum relatório ainda</h3>
          <p style={{ margin: "8px auto 0", color: "var(--ed2-ink-2)", fontSize: 14, maxWidth: 470 }}>
            Cliente que VÊ o que foi feito no mês renova sem choro. Crie o primeiro: números, trabalhos realizados e próximos passos num link com a tua marca.
          </p>
        </div>
      ) : (
        <div style={{ background: "var(--ed2-card)", borderRadius: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden" }}>
          {relatorios.map((r) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 22px", borderBottom: "1px solid var(--ed2-hair)", flexWrap: "wrap" }}>
              <ClipboardList size={18} style={{ color: "var(--pill-gold-fg)", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 200, cursor: "pointer" }} onClick={() => router.push(`/operacao/relatorios/${r.id}`)}>
                <div style={{ fontWeight: 600, fontSize: 14.5 }}>{r.cliente} <span style={{ color: "var(--ed2-ink-3)", fontWeight: 500 }}>· {r.periodo}</span></div>
                <div style={{ fontSize: 12.5, color: "var(--ed2-ink-2)", marginTop: 2 }}>atualizado {r.atualizado_em}</div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button type="button" onClick={() => copiarLink(r)} title="Copiar link do relatório pro cliente"
                  style={{ all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, background: "var(--ed2-surface)", color: copiado === r.id ? "var(--pill-green-fg)" : "var(--ed2-ink)" }}>
                  {copiado === r.id ? <Check size={13} /> : <Copy size={13} />} {copiado === r.id ? "Copiado" : "Link do cliente"}
                </button>
                <a href={`/r/${r.token}`} target="_blank" rel="noopener noreferrer" title="Ver como o cliente vê"
                  style={{ display: "inline-flex", alignItems: "center", padding: 8, borderRadius: 99, color: "var(--ed2-ink-2)" }}>
                  <ExternalLink size={15} />
                </a>
                <button type="button" onClick={() => excluir(r.id)} disabled={excluindo !== null} title="Excluir"
                  style={{ all: "unset", cursor: "pointer", color: "var(--pill-red-fg)", padding: 8, display: "inline-flex" }}>
                  {excluindo === r.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
