"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Sparkles, Eye, Trash2, ExternalLink, X, Pencil, Check } from "lucide-react";
import { custoEmReais } from "@/lib/groow/custo-ia";

interface PostResumo {
  id: number;
  slug: string;
  titulo: string;
  resumo: string;
  keyword_foco: string;
  categoria: string;
  status: "rascunho" | "aprovado" | "publicado" | "arquivado";
  origem: "ia" | "manual";
  created_at: string;
  published_at: string | null;
  custo_usd?: string | number | null;
}

interface PostFull extends PostResumo {
  corpo: string;
  updated_at: string;
}

const STATUS_TONE: Record<string, { label: string; bg: string; fg: string }> = {
  rascunho: { label: "Rascunho", bg: "rgba(255,159,10,0.14)", fg: "var(--pill-orange-fg)" },
  aprovado: { label: "Aprovado", bg: "rgba(10,132,255,0.12)", fg: "var(--pill-blue-fg)" },
  publicado: { label: "Publicado", bg: "rgba(52,199,89,0.14)", fg: "var(--pill-green-fg)" },
  arquivado: { label: "Arquivado", bg: "var(--ed2-surface)", fg: "var(--ed2-ink-2)" },
};

const FILTROS = [
  ["", "Todos"],
  ["rascunho", "Rascunhos"],
  ["aprovado", "Aprovados"],
  ["publicado", "Publicados"],
  ["arquivado", "Arquivados"],
] as const;

const btnPill: React.CSSProperties = {
  all: "unset",
  cursor: "pointer",
  padding: "7px 14px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
  whiteSpace: "nowrap",
};

export default function BlogAdminPage() {
  const [posts, setPosts] = useState<PostResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("");
  const [toast, setToast] = useState("");

  // gerar com IA
  const [showGerar, setShowGerar] = useState(false);
  const [tema, setTema] = useState("");
  const [keyword, setKeyword] = useState("");
  const [obs, setObs] = useState("");
  const [gerando, setGerando] = useState(false);
  const [erroGerar, setErroGerar] = useState("");

  // preview / edição
  const [preview, setPreview] = useState<PostFull | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [editando, setEditando] = useState(false);
  const [edTitulo, setEdTitulo] = useState("");
  const [edResumo, setEdResumo] = useState("");
  const [edCorpo, setEdCorpo] = useState("");
  const [salvando, setSalvando] = useState(false);

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/blog${filtro ? `?status=${filtro}` : ""}`);
      const d = await res.json();
      if (!d.error) setPosts(d.posts || []);
    } catch { /* */ } finally { setLoading(false); }
  }, [filtro]);

  useEffect(() => { load(); }, [load]);

  const gerar = async () => {
    if (gerando) return;
    setGerando(true);
    setErroGerar("");
    try {
      const res = await fetch("/api/admin/blog/gerar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tema, keyword, observacoes: obs }),
      });
      const d = await res.json();
      if (!res.ok || d.error) { setErroGerar(d.error || "Erro ao gerar"); return; }
      setShowGerar(false);
      setTema(""); setKeyword(""); setObs("");
      flash(`Artigo gerado: "${d.titulo}". Revisa e aprova`);
      setFiltro("");
      load();
      abrirPreview(d.id);
    } catch {
      setErroGerar("Falha de conexão ao gerar o artigo.");
    } finally { setGerando(false); }
  };

  const abrirPreview = async (id: number) => {
    setLoadingPreview(true);
    setEditando(false);
    try {
      const res = await fetch(`/api/admin/blog/${id}`);
      const d = await res.json();
      if (d.post) {
        setPreview(d.post);
        setEdTitulo(d.post.titulo);
        setEdResumo(d.post.resumo);
        setEdCorpo(d.post.corpo);
      }
    } catch { /* */ } finally { setLoadingPreview(false); }
  };

  const mudarStatus = async (id: number, status: string) => {
    const res = await fetch(`/api/admin/blog/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).catch(() => null);
    if (!res?.ok) { flash("Erro ao atualizar status"); return; }
    flash(status === "publicado" ? "Artigo no ar! Já entra no sitemap." : `Status: ${STATUS_TONE[status]?.label ?? status}`);
    load();
    if (preview?.id === id) abrirPreview(id);
  };

  const salvarEdicao = async () => {
    if (!preview || salvando) return;
    setSalvando(true);
    const res = await fetch(`/api/admin/blog/${preview.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo: edTitulo, resumo: edResumo, corpo: edCorpo }),
    }).catch(() => null);
    setSalvando(false);
    if (!res?.ok) { flash("Erro ao salvar edição"); return; }
    flash("Edição salva");
    setEditando(false);
    load();
    abrirPreview(preview.id);
  };

  const excluir = async (id: number) => {
    if (!confirm("Excluir esse artigo de vez?")) return;
    const res = await fetch(`/api/admin/blog/${id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) { flash("Erro ao excluir"); return; }
    flash("Artigo excluído");
    if (preview?.id === id) setPreview(null);
    load();
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    background: "var(--ed2-surface)",
    border: "1px solid var(--ed2-hair)",
    borderRadius: 12,
    padding: "11px 14px",
    fontSize: 14,
    color: "var(--ed2-ink)",
    outline: "none",
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 42, fontWeight: 700, letterSpacing: "-0.035em", margin: "0 0 6px", lineHeight: 1.05 }}>Blog SEO</h1>
          <div style={{ color: "var(--ed2-ink-2)", fontSize: 15 }}>IA escreve · você aprova · o Google indexa</div>
        </div>
        <button
          type="button"
          onClick={() => setShowGerar(true)}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#C9A961", color: "#fff", border: "none", padding: "12px 20px", borderRadius: 999, fontWeight: 600, fontSize: 13, cursor: "pointer", boxShadow: "0 4px 12px rgba(201,169,97,0.28)" }}
        >
          <Sparkles size={15} strokeWidth={2.2} aria-hidden="true" />
          Gerar artigo com IA
        </button>
      </div>

      {/* Filtros */}
      <div style={{ display: "inline-flex", background: "var(--ed2-card)", padding: 4, borderRadius: 999, gap: 2, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", marginBottom: 18, flexWrap: "wrap" }}>
        {FILTROS.map(([k, lbl]) => (
          <button key={k} type="button" onClick={() => setFiltro(k)}
            style={{ ...btnPill, padding: "8px 16px", fontSize: 13, color: filtro === k ? "var(--ed2-ink)" : "var(--ed2-ink-2)", background: filtro === k ? "var(--ed2-surface)" : "transparent" }}>
            {lbl}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div style={{ background: "var(--ed2-card)", borderRadius: 28, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden" }}>
        {loading ? (
          <div style={{ display: "grid", placeItems: "center", padding: "60px 0" }}><Loader2 className="animate-spin" style={{ color: "var(--ed2-ink-3)" }} /></div>
        ) : posts.length === 0 ? (
          <div style={{ padding: "60px 24px", textAlign: "center", color: "var(--ed2-ink-2)" }}>
            Nenhum artigo {filtro ? "nesse filtro" : "ainda"}. Clica em <b>Gerar artigo com IA</b> pra criar o primeiro.
          </div>
        ) : (
          <div>
            {posts.map((p) => {
              const st = STATUS_TONE[p.status];
              return (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 24px", borderBottom: "1px solid var(--ed2-hair)", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ fontWeight: 600, fontSize: 14.5, marginBottom: 3 }}>{p.titulo}</div>
                    <div style={{ fontSize: 12, color: "var(--ed2-ink-2)", display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <span>{p.categoria}</span>
                      {p.keyword_foco && <span>kw: {p.keyword_foco}</span>}
                      <span>{p.origem === "ia" ? "gerado por IA" : "manual"}</span>
                      {custoEmReais(p.custo_usd) && <span style={{ color: "var(--pill-gold-fg)", fontWeight: 600 }}>custo {custoEmReais(p.custo_usd)}</span>}
                      <span>{new Date(p.published_at ?? p.created_at).toLocaleDateString("pt-BR")}</span>
                    </div>
                  </div>
                  <span style={{ padding: "4px 12px", borderRadius: 99, fontSize: 12, fontWeight: 600, background: st.bg, color: st.fg }}>{st.label}</span>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <button type="button" title="Revisar" onClick={() => abrirPreview(p.id)}
                      style={{ ...btnPill, background: "var(--ed2-surface)", color: "var(--ed2-ink)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <Eye size={13} aria-hidden="true" /> Revisar
                    </button>
                    {p.status === "rascunho" && (
                      <button type="button" onClick={() => mudarStatus(p.id, "aprovado")} style={{ ...btnPill, background: "rgba(10,132,255,0.12)", color: "var(--pill-blue-fg)" }}>Aprovar</button>
                    )}
                    {(p.status === "aprovado" || p.status === "arquivado") && (
                      <button type="button" onClick={() => mudarStatus(p.id, "publicado")} style={{ ...btnPill, background: "#34C759", color: "#fff" }}>Publicar</button>
                    )}
                    {p.status === "publicado" && (
                      <>
                        <a href={`/blog/${p.slug}`} target="_blank" rel="noreferrer" title="Ver no site"
                          style={{ ...btnPill, background: "var(--ed2-surface)", color: "var(--ed2-ink)", display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
                          <ExternalLink size={13} aria-hidden="true" /> Ver no site
                        </a>
                        <button type="button" onClick={() => mudarStatus(p.id, "arquivado")} style={{ ...btnPill, background: "var(--ed2-surface)", color: "var(--ed2-ink-2)" }}>Tirar do ar</button>
                      </>
                    )}
                    <button type="button" title="Excluir" onClick={() => excluir(p.id)}
                      style={{ ...btnPill, background: "rgba(255,59,48,0.10)", color: "var(--pill-red-fg)", padding: "7px 10px" }}>
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: gerar com IA */}
      {showGerar && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(7,15,38,0.55)", display: "grid", placeItems: "center", padding: 20 }} onClick={() => !gerando && setShowGerar(false)}>
          <div style={{ background: "var(--ed2-card)", borderRadius: 24, padding: 28, width: "100%", maxWidth: 520, boxShadow: "0 24px 64px rgba(0,0,0,0.3)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: "inline-flex", alignItems: "center", gap: 10 }}>
                <Sparkles size={18} style={{ color: "#C9A961" }} aria-hidden="true" /> Gerar artigo com IA
              </h2>
              {!gerando && (
                <button type="button" onClick={() => setShowGerar(false)} style={{ all: "unset", cursor: "pointer", color: "var(--ed2-ink-2)" }} aria-label="Fechar">
                  <X size={18} />
                </button>
              )}
            </div>

            {gerando ? (
              <div style={{ display: "grid", placeItems: "center", padding: "40px 0", gap: 14, textAlign: "center" }}>
                <Loader2 className="animate-spin" size={28} style={{ color: "#C9A961" }} />
                <div style={{ fontSize: 14, color: "var(--ed2-ink-2)", maxWidth: 340 }}>
                  {tema.trim()
                    ? "A IA está escrevendo o artigo… leva de 30 segundos a 1 minuto. Não fecha essa tela."
                    : "A IA está pesquisando na web o que está em alta, escolhendo o tema e escrevendo… leva 1 a 2 minutos. Não fecha essa tela."}
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Modo automático - o caminho principal */}
                <button type="button" onClick={gerar}
                  style={{ background: "#C9A961", color: "#fff", border: "none", padding: "15px 20px", borderRadius: 16, fontWeight: 700, fontSize: 14.5, cursor: "pointer", boxShadow: "0 4px 14px rgba(201,169,97,0.3)", lineHeight: 1.4 }}>
                  Gerar no automático
                  <span style={{ display: "block", fontWeight: 400, fontSize: 12, opacity: 0.9 }}>
                    a IA pesquisa o que está em alta, escolhe tema e palavra-chave sozinha
                  </span>
                </button>

                <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--ed2-ink-3)", fontSize: 11.5, fontWeight: 600 }}>
                  <span style={{ flex: 1, height: 1, background: "var(--ed2-hair)" }} />
                  OU ESCOLHE VOCÊ
                  <span style={{ flex: 1, height: 1, background: "var(--ed2-hair)" }} />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ed2-ink-2)", display: "block", marginBottom: 6 }}>Tema do artigo (opcional)</label>
                  <input style={inputStyle} value={tema} onChange={(e) => setTema(e.target.value)}
                    placeholder="Ex: Como barbearia atrai cliente pelo Google" />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ed2-ink-2)", display: "block", marginBottom: 6 }}>Palavra-chave foco (opcional)</label>
                  <input style={inputStyle} value={keyword} onChange={(e) => setKeyword(e.target.value)}
                    placeholder="Ex: marketing para barbearia" />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ed2-ink-2)", display: "block", marginBottom: 6 }}>Observações (opcional)</label>
                  <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={obs} onChange={(e) => setObs(e.target.value)}
                    placeholder="Ex: cita WhatsApp como canal principal, foca em cidade pequena..." />
                </div>
                {erroGerar && <div style={{ fontSize: 13, color: "var(--pill-red-fg)", background: "rgba(255,59,48,0.08)", borderRadius: 12, padding: "10px 14px" }}>{erroGerar}</div>}
                {tema.trim() && (
                  <button type="button" onClick={gerar}
                    style={{ background: "var(--ed2-surface)", color: "var(--ed2-ink)", border: "1px solid var(--ed2-hair)", padding: "12px 20px", borderRadius: 999, fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}>
                    Escrever sobre esse tema
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: preview / edição */}
      {(preview || loadingPreview) && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(7,15,38,0.55)", display: "grid", placeItems: "center", padding: 20 }} onClick={() => setPreview(null)}>
          <div style={{ background: "var(--ed2-card)", borderRadius: 24, width: "100%", maxWidth: 860, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(0,0,0,0.3)", overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
            {loadingPreview || !preview ? (
              <div style={{ display: "grid", placeItems: "center", padding: "80px 0" }}><Loader2 className="animate-spin" style={{ color: "var(--ed2-ink-3)" }} /></div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "18px 24px", borderBottom: "1px solid var(--ed2-hair)", flexWrap: "wrap" }}>
                  <span style={{ padding: "4px 12px", borderRadius: 99, fontSize: 12, fontWeight: 600, background: STATUS_TONE[preview.status].bg, color: STATUS_TONE[preview.status].fg }}>
                    {STATUS_TONE[preview.status].label}
                  </span>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {editando ? (
                      <button type="button" onClick={salvarEdicao} disabled={salvando}
                        style={{ ...btnPill, background: "#34C759", color: "#fff", display: "inline-flex", alignItems: "center", gap: 6 }}>
                        {salvando ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Check size={13} aria-hidden="true" />} Salvar
                      </button>
                    ) : (
                      <button type="button" onClick={() => setEditando(true)}
                        style={{ ...btnPill, background: "var(--ed2-surface)", color: "var(--ed2-ink)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <Pencil size={13} aria-hidden="true" /> Editar
                      </button>
                    )}
                    {preview.status === "rascunho" && (
                      <button type="button" onClick={() => mudarStatus(preview.id, "aprovado")} style={{ ...btnPill, background: "rgba(10,132,255,0.12)", color: "var(--pill-blue-fg)" }}>Aprovar</button>
                    )}
                    {preview.status !== "publicado" && (
                      <button type="button" onClick={() => mudarStatus(preview.id, "publicado")} style={{ ...btnPill, background: "#34C759", color: "#fff" }}>Publicar</button>
                    )}
                    <button type="button" onClick={() => setPreview(null)} style={{ all: "unset", cursor: "pointer", color: "var(--ed2-ink-2)", padding: 6 }} aria-label="Fechar">
                      <X size={18} />
                    </button>
                  </div>
                </div>

                <div style={{ overflowY: "auto", padding: "24px 28px 32px" }}>
                  {editando ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ed2-ink-2)", display: "block", marginBottom: 6 }}>Título</label>
                        <input style={inputStyle} value={edTitulo} onChange={(e) => setEdTitulo(e.target.value)} />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ed2-ink-2)", display: "block", marginBottom: 6 }}>Resumo (meta description)</label>
                        <textarea style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} value={edResumo} onChange={(e) => setEdResumo(e.target.value)} />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ed2-ink-2)", display: "block", marginBottom: 6 }}>Corpo (HTML)</label>
                        <textarea style={{ ...inputStyle, minHeight: 320, resize: "vertical", fontFamily: "monospace", fontSize: 12.5 }} value={edCorpo} onChange={(e) => setEdCorpo(e.target.value)} />
                      </div>
                    </div>
                  ) : (
                    <>
                      <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.15, margin: "0 0 10px" }}>{preview.titulo}</h2>
                      {preview.resumo && <p style={{ color: "var(--ed2-ink-2)", fontSize: 14.5, margin: "0 0 6px" }}>{preview.resumo}</p>}
                      <p style={{ fontSize: 12, color: "var(--ed2-ink-3)", margin: "0 0 20px" }}>
                        /blog/{preview.slug}{preview.keyword_foco ? ` · kw: ${preview.keyword_foco}` : ""}
                      </p>
                      <div className="blog-prose" style={{ fontSize: 15 }} dangerouslySetInnerHTML={{ __html: preview.corpo }} />
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 28, right: 28, zIndex: 999, display: "inline-flex", alignItems: "center", gap: 8, background: "#0B1838", color: "#F5F2EA", padding: "12px 18px", borderRadius: 14, fontSize: 13, fontWeight: 500, boxShadow: "0 8px 24px rgba(0,0,0,0.22)" }}>
          <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="#34C759" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6l2.5 2.5L9.5 3.5" /></svg> {toast}
        </div>
      )}
    </div>
  );
}
