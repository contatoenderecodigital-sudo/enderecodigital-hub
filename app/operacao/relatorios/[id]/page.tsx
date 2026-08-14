"use client";

import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft, Copy, Check, ExternalLink, Plus, Trash2, Save } from "lucide-react";
import type { DadosRelatorio, MetricaRelatorio } from "@/lib/groow/relatorios";

interface Relatorio { id: number; cliente: string; periodo: string; token: string; dados: DadosRelatorio }

const inputStyle: React.CSSProperties = { display: "block", width: "100%", borderRadius: 12, border: "1px solid var(--ed2-hair)", background: "var(--ed2-card)", padding: "11px 14px", fontSize: 14, boxSizing: "border-box", color: "var(--ed2-ink)" };
const labelStyle: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 600, color: "var(--ed2-ink-2)", marginBottom: 6, letterSpacing: "0.03em", textTransform: "uppercase" };
const cardStyle: React.CSSProperties = { background: "var(--ed2-card)", borderRadius: 20, padding: "20px 22px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" };

export default function EditorRelatorioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [rel, setRel] = useState<Relatorio | null>(null);
  const [cliente, setCliente] = useState("");
  const [periodo, setPeriodo] = useState("");
  const [resumo, setResumo] = useState("");
  const [metricas, setMetricas] = useState<MetricaRelatorio[]>([]);
  const [trabalhos, setTrabalhos] = useState("");
  const [proximos, setProximos] = useState("");
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [salvoOk, setSalvoOk] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/relatorios/${id}`);
      const d = await res.json();
      if (d.error) { setErro(d.error); return; }
      const r: Relatorio = d.relatorio;
      setRel(r);
      setCliente(r.cliente);
      setPeriodo(r.periodo);
      setResumo(r.dados?.resumo ?? "");
      setMetricas(Array.isArray(r.dados?.metricas) ? r.dados.metricas : []);
      setTrabalhos((r.dados?.trabalhos ?? []).join("\n"));
      setProximos((r.dados?.proximos ?? []).join("\n"));
    } catch { setErro("Falha de conexão"); } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const salvar = async () => {
    if (salvando) return;
    setSalvando(true);
    try {
      const dados: DadosRelatorio = {
        resumo: resumo.trim(),
        metricas: metricas.filter((m) => m.label.trim() || m.valor.trim()),
        trabalhos: trabalhos.split("\n").map((t) => t.trim()).filter(Boolean),
        proximos: proximos.split("\n").map((t) => t.trim()).filter(Boolean),
      };
      const res = await fetch(`/api/admin/relatorios/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cliente, periodo, dados }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && !d.error) { setSalvoOk(true); setTimeout(() => setSalvoOk(false), 2500); }
    } catch { /* */ } finally { setSalvando(false); }
  };

  const copiarLink = () => {
    if (!rel) return;
    navigator.clipboard.writeText(`${window.location.origin}/r/${rel.token}`).catch(() => {});
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const mudarMetrica = (i: number, campo: keyof MetricaRelatorio, valor: string) => {
    setMetricas((prev) => prev.map((m, j) => (j === i ? { ...m, [campo]: valor } : m)));
  };

  if (loading) return <div style={{ display: "grid", placeItems: "center", padding: "80px 0" }}><Loader2 className="animate-spin" style={{ color: "var(--ed2-ink-3)" }} /></div>;
  if (erro || !rel) return (
    <div>
      <p style={{ color: "var(--pill-red-fg)", fontSize: 14 }}>{erro || "Relatório não encontrado"}</p>
      <Link href="/operacao/relatorios" style={{ color: "var(--pill-gold-fg)", fontSize: 14, fontWeight: 600 }}>Voltar</Link>
    </div>
  );

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 22 }}>
        <Link href="/operacao/relatorios" aria-label="Voltar" style={{ display: "inline-flex", padding: 9, borderRadius: 99, background: "var(--ed2-card)", color: "var(--ed2-ink)", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <ArrowLeft size={16} />
        </Link>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", margin: 0, flex: 1 }}>Relatório mensal</h1>
        <button type="button" onClick={copiarLink}
          style={{ all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 999, fontSize: 13, fontWeight: 600, background: "var(--ed2-card)", color: copiado ? "var(--pill-green-fg)" : "var(--ed2-ink)", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          {copiado ? <Check size={14} /> : <Copy size={14} />} {copiado ? "Copiado" : "Link do cliente"}
        </button>
        <a href={`/r/${rel.token}`} target="_blank" rel="noopener noreferrer"
          style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 999, fontSize: 13, fontWeight: 600, background: "var(--ed2-card)", color: "var(--ed2-ink)", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", textDecoration: "none" }}>
          <ExternalLink size={14} /> Ver
        </a>
        <button type="button" onClick={salvar} disabled={salvando}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, background: salvoOk ? "#34C759" : "#0B1838", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 999, fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
          {salvando ? <Loader2 size={14} className="animate-spin" /> : salvoOk ? <Check size={14} /> : <Save size={14} />}
          {salvando ? "Salvando..." : salvoOk ? "Salvo" : "Salvar"}
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ ...cardStyle, display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
          <div>
            <label style={labelStyle}>Cliente</label>
            <input value={cliente} onChange={(e) => setCliente(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Mês</label>
            <input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div style={cardStyle}>
          <label style={labelStyle}>Resumo do mês (abre o relatório; 2-4 frases direto ao ponto)</label>
          <textarea value={resumo} onChange={(e) => setResumo(e.target.value)} rows={3}
            placeholder="Ex: Mês forte de captação: o site trouxe 23 contatos novos e a campanha de..." style={{ ...inputStyle, resize: "vertical", lineHeight: 1.55, fontFamily: "inherit" }} />
        </div>

        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Números do mês</label>
            <button type="button" onClick={() => setMetricas((prev) => [...prev, { label: "", valor: "", variacao: "" }])}
              style={{ all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, color: "var(--pill-gold-fg)" }}>
              <Plus size={13} /> métrica
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {metricas.map((m, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 10, alignItems: "center" }}>
                <input value={m.label} onChange={(e) => mudarMetrica(i, "label", e.target.value)} placeholder="Nome (ex: Leads gerados)" style={inputStyle} />
                <input value={m.valor} onChange={(e) => mudarMetrica(i, "valor", e.target.value)} placeholder="Valor (ex: 23)" style={inputStyle} />
                <input value={m.variacao ?? ""} onChange={(e) => mudarMetrica(i, "variacao", e.target.value)} placeholder="vs mês passado (ex: +40%)" style={inputStyle} />
                <button type="button" onClick={() => setMetricas((prev) => prev.filter((_, j) => j !== i))} aria-label="Remover métrica"
                  style={{ all: "unset", cursor: "pointer", color: "var(--pill-red-fg)", padding: 6, display: "inline-flex" }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div style={cardStyle}>
          <label style={labelStyle}>O que foi feito no mês (um item por linha)</label>
          <textarea value={trabalhos} onChange={(e) => setTrabalhos(e.target.value)} rows={5}
            placeholder={"Campanha de captação no Instagram no ar\nSite atualizado com a página de promoções\n12 artes publicadas no feed"} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6, fontFamily: "inherit" }} />
        </div>

        <div style={cardStyle}>
          <label style={labelStyle}>Próximos passos (um item por linha)</label>
          <textarea value={proximos} onChange={(e) => setProximos(e.target.value)} rows={4}
            placeholder={"Subir campanha de remarketing\nOtimizar o Google Meu Negócio"} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6, fontFamily: "inherit" }} />
        </div>
      </div>
    </div>
  );
}
