"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Network, Trash2, ExternalLink, Copy, Check } from "lucide-react";

interface MapaResumo { id: number; nome: string; token: string; atualizado_em: string }

export default function MapasPage() {
  const router = useRouter();
  const [mapas, setMapas] = useState<MapaResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [criando, setCriando] = useState(false);
  const [copiado, setCopiado] = useState<number | null>(null);
  const [excluindo, setExcluindo] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/mapa");
      const d = await res.json();
      if (!d.error) setMapas(d.mapas || []);
    } catch { /* */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const criar = async () => {
    if (criando) return;
    setCriando(true);
    try {
      const res = await fetch("/api/admin/mapa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome: "Novo mapa" }) });
      const d = await res.json();
      if (d.id) router.push(`/operacao/mapa/${d.id}`);
    } catch { /* */ } finally { setCriando(false); }
  };

  const copiarLink = (m: MapaResumo) => {
    navigator.clipboard.writeText(`${window.location.origin}/mapa/${m.token}`).catch(() => {});
    setCopiado(m.id);
    setTimeout(() => setCopiado(null), 2000);
  };

  const excluir = async (id: number) => {
    if (excluindo) return;
    setExcluindo(id);
    try {
      await fetch(`/api/admin/mapa/${id}`, { method: "DELETE" });
      setMapas((prev) => prev.filter((m) => m.id !== id));
    } catch { /* */ } finally { setExcluindo(null); }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 42, fontWeight: 700, letterSpacing: "-0.035em", margin: "0 0 6px", lineHeight: 1.05 }}>Mapa do Ecossistema</h1>
          <div style={{ color: "var(--ed2-ink-2)", fontSize: 15 }}>Desenhe a operação do cliente e mande o link pra ele VER a máquina funcionando</div>
        </div>
        <button type="button" onClick={criar} disabled={criando}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#C9A961", color: "#fff", border: "none", padding: "12px 22px", borderRadius: 999, fontWeight: 600, fontSize: 14, cursor: "pointer", boxShadow: "0 4px 12px rgba(201,169,97,0.28)" }}>
          {criando ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Novo mapa
        </button>
      </div>

      {loading ? (
        <div style={{ display: "grid", placeItems: "center", padding: "60px 0" }}><Loader2 className="animate-spin" style={{ color: "var(--ed2-ink-3)" }} /></div>
      ) : mapas.length === 0 ? (
        <div style={{ background: "var(--ed2-card)", borderRadius: 28, padding: 56, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: "linear-gradient(135deg,rgba(201,169,97,0.16),rgba(201,169,97,0.06))", margin: "0 auto 16px", display: "grid", placeItems: "center", color: "var(--pill-gold-fg)" }}>
            <Network size={28} strokeWidth={1.5} />
          </div>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Nenhum mapa ainda</h3>
          <p style={{ margin: "8px auto 0", color: "var(--ed2-ink-2)", fontSize: 14, maxWidth: 460 }}>
            Crie o primeiro: ele já nasce com o ecossistema padrão da Endereço Digital (anúncio, site, WhatsApp com IA, pipeline) pronto pra adaptar pro cliente.
          </p>
        </div>
      ) : (
        <div style={{ background: "var(--ed2-card)", borderRadius: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden" }}>
          {mapas.map((m) => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 22px", borderBottom: "1px solid var(--ed2-hair)", flexWrap: "wrap" }}>
              <Network size={18} style={{ color: "var(--pill-gold-fg)", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 200, cursor: "pointer" }} onClick={() => router.push(`/operacao/mapa/${m.id}`)}>
                <div style={{ fontWeight: 600, fontSize: 14.5 }}>{m.nome}</div>
                <div style={{ fontSize: 12.5, color: "var(--ed2-ink-2)", marginTop: 2 }}>atualizado {m.atualizado_em}</div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button type="button" onClick={() => copiarLink(m)} title="Copiar link público (só leitura) pra mandar pro cliente"
                  style={{ all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, background: "var(--ed2-surface)", color: copiado === m.id ? "var(--pill-green-fg)" : "var(--ed2-ink)" }}>
                  {copiado === m.id ? <Check size={13} /> : <Copy size={13} />} {copiado === m.id ? "Copiado" : "Link do cliente"}
                </button>
                <a href={`/mapa/${m.token}`} target="_blank" rel="noopener noreferrer" title="Ver como o cliente vê"
                  style={{ display: "inline-flex", alignItems: "center", padding: 8, borderRadius: 99, color: "var(--ed2-ink-2)" }}>
                  <ExternalLink size={15} />
                </a>
                <button type="button" onClick={() => excluir(m.id)} disabled={excluindo !== null} title="Excluir mapa"
                  style={{ all: "unset", cursor: "pointer", color: "var(--pill-red-fg)", padding: 8, display: "inline-flex" }}>
                  {excluindo === m.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
