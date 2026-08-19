"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Loader2, Plus, KeyRound, Eye, EyeOff, Copy, Check, Trash2, X, ExternalLink, ShieldAlert } from "lucide-react";

interface Item { id: number; cliente: string; servico: string; url: string; usuario: string; notas: string; atualizado_em: string }

const inputStyle: React.CSSProperties = { display: "block", width: "100%", borderRadius: 12, border: "1px solid var(--ed2-hair)", background: "var(--ed2-surface)", padding: "11px 14px", fontSize: 14, boxSizing: "border-box", color: "var(--ed2-ink)" };

export default function SenhasPage() {
  const [itens, setItens] = useState<Item[]>([]);
  const [temChave, setTemChave] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState({ cliente: "", servico: "", url: "", usuario: "", senha: "", notas: "" });
  const [reveladas, setReveladas] = useState<Record<number, string>>({});
  const [revelando, setRevelando] = useState<number | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 3200); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/senhas");
      const d = await res.json();
      if (!d.error) { setItens(d.itens || []); setTemChave(!!d.temChave); }
    } catch { /* */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return itens;
    return itens.filter((i) => `${i.cliente} ${i.servico} ${i.usuario} ${i.url}`.toLowerCase().includes(q));
  }, [itens, busca]);

  const grupos = useMemo(() => {
    const g = new Map<string, Item[]>();
    for (const i of filtrados) {
      const k = i.cliente || "Agência (interno)";
      g.set(k, [...(g.get(k) ?? []), i]);
    }
    return [...g.entries()];
  }, [filtrados]);

  const salvar = async () => {
    if (!form.servico.trim() || !form.senha) { flash("Serviço e senha são obrigatórios"); return; }
    setSalvando(true);
    try {
      const res = await fetch("/api/admin/senhas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const d = await res.json();
      if (!res.ok || d.error) { flash(d.error || "Erro ao salvar"); return; }
      flash("Credencial guardada no cofre");
      setModal(false);
      setForm({ cliente: "", servico: "", url: "", usuario: "", senha: "", notas: "" });
      load();
    } catch { flash("Falha de conexão"); } finally { setSalvando(false); }
  };

  const revelar = async (id: number) => {
    if (reveladas[id] !== undefined) {
      setReveladas((prev) => { const n = { ...prev }; delete n[id]; return n; });
      return;
    }
    setRevelando(id);
    try {
      const res = await fetch(`/api/admin/senhas/${id}`);
      const d = await res.json();
      if (!res.ok || d.error) { flash(d.error || "Erro ao revelar"); return; }
      setReveladas((prev) => ({ ...prev, [id]: d.senha }));
      // esconde sozinha depois de 30s (ninguém esquece senha aberta na tela)
      setTimeout(() => setReveladas((prev) => { const n = { ...prev }; delete n[id]; return n; }), 30000);
    } catch { flash("Falha de conexão"); } finally { setRevelando(null); }
  };

  const copiar = async (id: number, chave: string) => {
    let senha = reveladas[id];
    if (senha === undefined) {
      try {
        const res = await fetch(`/api/admin/senhas/${id}`);
        const d = await res.json();
        if (!res.ok || d.error) { flash(d.error || "Erro"); return; }
        senha = d.senha;
      } catch { flash("Falha de conexão"); return; }
    }
    navigator.clipboard.writeText(senha).catch(() => {});
    setCopiado(chave);
    setTimeout(() => setCopiado(null), 2000);
  };

  const excluir = async (id: number) => {
    try {
      await fetch(`/api/admin/senhas/${id}`, { method: "DELETE" });
      setItens((prev) => prev.filter((i) => i.id !== id));
      flash("Removida do cofre");
    } catch { flash("Falha de conexão"); }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 42, fontWeight: 700, letterSpacing: "-0.035em", margin: "0 0 6px", lineHeight: 1.05 }}>Senhas</h1>
          <div style={{ color: "var(--ed2-ink-2)", fontSize: 15 }}>Cofre criptografado (AES-256) das credenciais da agência e dos clientes</div>
        </div>
        <button type="button" onClick={() => setModal(true)}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#C9A961", color: "#fff", border: "none", padding: "12px 22px", borderRadius: 999, fontWeight: 600, fontSize: 14, cursor: "pointer", boxShadow: "0 4px 12px rgba(201,169,97,0.28)" }}>
          <Plus size={16} /> Nova credencial
        </button>
      </div>

      {!temChave && !loading && (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "rgba(255,159,10,0.10)", border: "1px solid rgba(255,159,10,0.3)", borderRadius: 16, padding: "14px 18px", marginBottom: 18, fontSize: 13.5, lineHeight: 1.55 }}>
          <ShieldAlert size={17} style={{ color: "#a85f00", flexShrink: 0, marginTop: 1 }} />
          <span>
            <strong>Falta a chave do cofre no servidor.</strong> Adiciona no .env.local uma linha
            {" "}<code style={{ background: "var(--ed2-surface)", padding: "2px 7px", borderRadius: 6 }}>SENHAS_CHAVE=uma-frase-longa-e-secreta</code>{" "}
            e roda <code style={{ background: "var(--ed2-surface)", padding: "2px 7px", borderRadius: 6 }}>pm2 restart all --update-env</code>. Importante: se essa frase mudar depois, as senhas já salvas não abrem mais.
          </span>
        </div>
      )}

      <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por cliente, serviço ou login..."
        style={{ ...inputStyle, background: "var(--ed2-card)", maxWidth: 420, marginBottom: 18, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", border: "1px solid var(--ed2-hair)" }} />

      {loading ? (
        <div style={{ display: "grid", placeItems: "center", padding: "60px 0" }}><Loader2 className="animate-spin" style={{ color: "var(--ed2-ink-3)" }} /></div>
      ) : grupos.length === 0 ? (
        <div style={{ background: "var(--ed2-card)", borderRadius: 28, padding: 56, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: "linear-gradient(135deg,rgba(201,169,97,0.16),rgba(201,169,97,0.06))", margin: "0 auto 16px", display: "grid", placeItems: "center", color: "var(--pill-gold-fg)" }}>
            <KeyRound size={28} strokeWidth={1.5} />
          </div>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Cofre vazio</h3>
          <p style={{ margin: "8px auto 0", color: "var(--ed2-ink-2)", fontSize: 14, maxWidth: 440 }}>
            Guarde aqui acessos de hosting, Meta, Google, redes dos clientes... A senha é criptografada antes de tocar o banco.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {grupos.map(([cliente, lista]) => (
            <div key={cliente} style={{ background: "var(--ed2-card)", borderRadius: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden" }}>
              <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--ed2-hair)", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                <KeyRound size={15} style={{ color: "var(--pill-gold-fg)" }} /> {cliente}
                <span style={{ color: "var(--ed2-ink-3)", fontWeight: 500 }}>({lista.length})</span>
              </div>
              {lista.map((i) => (
                <div key={i.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 22px", borderBottom: "1px solid var(--ed2-hair)", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {i.servico}
                      {i.url && (
                        <a href={i.url.startsWith("http") ? i.url : `https://${i.url}`} target="_blank" rel="noopener noreferrer"
                          style={{ display: "inline-flex", color: "var(--ed2-ink-3)" }} aria-label="Abrir o serviço">
                          <ExternalLink size={12.5} />
                        </a>
                      )}
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--ed2-ink-2)", marginTop: 2, display: "flex", gap: 12, flexWrap: "wrap" }}>
                      {i.usuario && <span>{i.usuario}</span>}
                      <span style={{ fontFamily: "monospace", letterSpacing: reveladas[i.id] !== undefined ? 0 : "0.15em" }}>
                        {reveladas[i.id] !== undefined ? reveladas[i.id] : "········"}
                      </span>
                      {i.notas && <span style={{ color: "var(--ed2-ink-3)" }}>{i.notas.slice(0, 60)}</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button type="button" onClick={() => revelar(i.id)} title={reveladas[i.id] !== undefined ? "Esconder" : "Revelar (esconde sozinha em 30s)"}
                      style={{ all: "unset", cursor: "pointer", padding: 8, color: "var(--ed2-ink-2)", display: "inline-flex" }}>
                      {revelando === i.id ? <Loader2 size={15} className="animate-spin" /> : reveladas[i.id] !== undefined ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                    <button type="button" onClick={() => copiar(i.id, `c${i.id}`)} title="Copiar senha"
                      style={{ all: "unset", cursor: "pointer", padding: 8, color: copiado === `c${i.id}` ? "var(--pill-green-fg)" : "var(--ed2-ink-2)", display: "inline-flex" }}>
                      {copiado === `c${i.id}` ? <Check size={15} /> : <Copy size={15} />}
                    </button>
                    <button type="button" onClick={() => excluir(i.id)} title="Excluir do cofre"
                      style={{ all: "unset", cursor: "pointer", padding: 8, color: "var(--pill-red-fg)", display: "inline-flex" }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* MODAL NOVA CREDENCIAL */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(7,15,38,0.55)", display: "grid", placeItems: "center", padding: 20 }} onClick={() => !salvando && setModal(false)}>
          <div style={{ background: "var(--ed2-card)", borderRadius: 24, width: "100%", maxWidth: 520, boxShadow: "0 24px 64px rgba(0,0,0,0.3)", overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--ed2-hair)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontWeight: 700, fontSize: 17 }}>Nova credencial</div>
              <button type="button" onClick={() => setModal(false)} style={{ all: "unset", cursor: "pointer", color: "var(--ed2-ink-2)", padding: 6 }} aria-label="Fechar"><X size={18} /></button>
            </div>
            <div style={{ padding: "18px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <input value={form.cliente} onChange={(e) => setForm((f) => ({ ...f, cliente: e.target.value }))} placeholder="Cliente (vazio = interno)" style={inputStyle} />
                <input value={form.servico} onChange={(e) => setForm((f) => ({ ...f, servico: e.target.value }))} placeholder="Serviço (ex: Instagram, aaPanel)" style={inputStyle} />
              </div>
              <input value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="URL de acesso (opcional)" style={inputStyle} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <input value={form.usuario} onChange={(e) => setForm((f) => ({ ...f, usuario: e.target.value }))} placeholder="Login / email" style={inputStyle} />
                <input value={form.senha} onChange={(e) => setForm((f) => ({ ...f, senha: e.target.value }))} placeholder="Senha" type="password" style={inputStyle} />
              </div>
              <input value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} placeholder="Notas (opcional)" style={inputStyle} />
            </div>
            <div style={{ padding: "0 24px 20px", display: "flex", justifyContent: "flex-end" }}>
              <button type="button" onClick={salvar} disabled={salvando}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#34C759", color: "#fff", border: "none", padding: "11px 22px", borderRadius: 999, fontWeight: 600, fontSize: 14, cursor: salvando ? "wait" : "pointer" }}>
                {salvando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Guardar no cofre
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 28, right: 28, zIndex: 999, background: "#0B1838", color: "#F5F2EA", padding: "12px 18px", borderRadius: 14, fontSize: 13, fontWeight: 500, boxShadow: "0 8px 24px rgba(0,0,0,0.22)" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
