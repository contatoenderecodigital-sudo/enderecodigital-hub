"use client";

import { useEffect, useState, useCallback, useRef, use } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft, Copy, Check, ExternalLink } from "lucide-react";
import MapaCanvas, { type DadosMapa } from "@/components/groow/admin/mapa/MapaCanvas";

interface Mapa { id: number; nome: string; token: string; dados: DadosMapa }

export default function EditorMapaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [mapa, setMapa] = useState<Mapa | null>(null);
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [copiado, setCopiado] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/mapa/${id}`);
      const d = await res.json();
      if (d.error) { setErro(d.error); return; }
      setMapa(d.mapa);
      setNome(d.mapa.nome);
    } catch { setErro("Falha de conexão"); } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Autosave do nome do mapa: grava 1s depois de parar de digitar no título.
  // (os blocos e ligações têm o próprio autosave dentro do canvas.)
  const nomeMontou = useRef(false);
  useEffect(() => {
    if (!mapa) return;
    if (!nomeMontou.current) { nomeMontou.current = true; return; }
    const t = setTimeout(() => {
      fetch(`/api/admin/mapa/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: nome.trim() || "Mapa" }),
      }).catch(() => {});
    }, 1000);
    return () => clearTimeout(t);
  }, [nome, mapa, id]);

  const salvar = async (dados: DadosMapa): Promise<boolean> => {
    try {
      const res = await fetch(`/api/admin/mapa/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: nome.trim() || "Mapa", dados }),
      });
      const d = await res.json().catch(() => ({}));
      return res.ok && !d.error;
    } catch { return false; }
  };

  const copiarLink = () => {
    if (!mapa) return;
    navigator.clipboard.writeText(`${window.location.origin}/mapa/${mapa.token}`).catch(() => {});
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  if (loading) return <div style={{ display: "grid", placeItems: "center", padding: "80px 0" }}><Loader2 className="animate-spin" style={{ color: "var(--ed2-ink-3)" }} /></div>;
  if (erro || !mapa) return (
    <div>
      <p style={{ color: "var(--pill-red-fg)", fontSize: 14 }}>{erro || "Mapa não encontrado"}</p>
      <Link href="/operacao/mapa" style={{ color: "var(--pill-gold-fg)", fontSize: 14, fontWeight: 600 }}>Voltar pros mapas</Link>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <Link href="/operacao/mapa" aria-label="Voltar" style={{ display: "inline-flex", padding: 9, borderRadius: 99, background: "var(--ed2-card)", color: "var(--ed2-ink)", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <ArrowLeft size={16} />
        </Link>
        <input value={nome} onChange={(e) => setNome(e.target.value)} aria-label="Nome do mapa"
          style={{ flex: 1, minWidth: 220, maxWidth: 440, border: "none", background: "transparent", fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--ed2-ink)", outline: "none" }} />
        <button type="button" onClick={copiarLink}
          style={{ all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 999, fontSize: 13, fontWeight: 600, background: "var(--ed2-card)", color: copiado ? "var(--pill-green-fg)" : "var(--ed2-ink)", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          {copiado ? <Check size={14} /> : <Copy size={14} />} {copiado ? "Link copiado" : "Link do cliente"}
        </button>
        <a href={`/mapa/${mapa.token}`} target="_blank" rel="noopener noreferrer"
          style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 999, fontSize: 13, fontWeight: 600, background: "var(--ed2-card)", color: "var(--ed2-ink)", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", textDecoration: "none" }}>
          <ExternalLink size={14} /> Ver como cliente
        </a>
      </div>

      <div style={{ height: "calc(100vh - 240px)", minHeight: 500 }}>
        <MapaCanvas inicial={mapa.dados} onSalvar={salvar} />
      </div>
      <p style={{ margin: "12px 4px 0", fontSize: 12.5, color: "var(--ed2-ink-3)" }}>
        Salva sozinho a cada mudança · duplo clique num bloco pra renomear · tecla Delete exclui o selecionado · Ctrl + scroll dá zoom (scroll puro navega) · Ligar conecta origem e destino · clique no meio de uma linha pra removê-la
      </p>
    </div>
  );
}
