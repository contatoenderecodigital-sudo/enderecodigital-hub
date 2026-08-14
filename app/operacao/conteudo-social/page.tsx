"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Sparkles, X, Trash2, Copy, Check, Clapperboard, Images, MessageSquareText } from "lucide-react";
import CarrosselCanvas, { type Slide } from "@/components/groow/admin/social/CarrosselCanvas";
import { custoEmReais } from "@/lib/groow/custo-ia";

interface Ideia {
  id: number;
  pilar: string;
  tipo: "reel" | "carrossel" | "story";
  hook: string;
  descricao: string | null;
  formato: string;
  status: "nova" | "gerada" | "descartada";
  criada_em: string;
  conteudo_id: number | null;
}

interface Conteudo {
  id: number;
  tipo: "reel" | "carrossel" | "story";
  titulo: string;
  corpo: string;
  legenda: string | null;
  hashtags: string | null;
  status: "rascunho" | "aprovado" | "publicado";
  custo_usd?: string | number | null;
}

interface RoteiroBloco { tempo: string; fala: string; cena: string }

const PILAR_LABEL: Record<string, string> = {
  "captacao-local": "Captação local",
  "prova-autoridade": "Prova e autoridade",
  "vendas-whatsapp": "Vendas no WhatsApp",
  "educacao-trafego": "Tráfego pago",
};

const TIPO_META: Record<string, { label: string; icon: React.ElementType; bg: string; fg: string }> = {
  reel: { label: "Reel", icon: Clapperboard, bg: "rgba(88,86,214,0.14)", fg: "var(--pill-purple-fg)" },
  carrossel: { label: "Carrossel", icon: Images, bg: "rgba(201,169,97,0.14)", fg: "var(--pill-gold-fg)" },
  story: { label: "Story", icon: MessageSquareText, bg: "rgba(10,132,255,0.12)", fg: "var(--pill-blue-fg)" },
};

const btnPill: React.CSSProperties = { all: "unset", cursor: "pointer", padding: "7px 14px", borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 6 };

export default function ConteudoSocialPage() {
  const [ideias, setIdeias] = useState<Ideia[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<"todas" | "nova" | "gerada">("todas");
  const [filtroTipo, setFiltroTipo] = useState<"" | "reel" | "carrossel" | "story">("");
  const [toast, setToast] = useState("");
  const [gerandoPauta, setGerandoPauta] = useState(false);
  const [gerandoIdeia, setGerandoIdeia] = useState<number | null>(null);
  const [lote, setLote] = useState<{ atual: number; total: number; hook: string } | null>(null);
  const [seg, setSeg] = useState(0); // cronômetro vivo: prova de que não congelou

  // modal de conteúdo
  const [aberto, setAberto] = useState<{ ideia: Ideia; conteudo: Conteudo } | null>(null);
  const [loadingConteudo, setLoadingConteudo] = useState(false);
  const [copiado, setCopiado] = useState("");

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 3200); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/social");
      const d = await res.json();
      if (!d.error) setIdeias(d.ideias || []);
    } catch { /* */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const gerarPauta = async () => {
    if (gerandoPauta) return;
    setGerandoPauta(true);
    try {
      const res = await fetch("/api/admin/social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "pauta", qtd: 24 }),
      });
      const d = await res.json();
      if (!res.ok || d.error) { flash(d.error || "Erro ao gerar pauta"); return; }
      flash(`${d.geradas} ideias novas na pauta`);
      load();
    } catch { flash("Falha de conexão"); } finally { setGerandoPauta(false); }
  };

  const abrirConteudo = async (ideia: Ideia) => {
    setLoadingConteudo(true);
    try {
      const res = await fetch(`/api/admin/social/${ideia.id}`);
      const d = await res.json();
      if (d.conteudo) setAberto({ ideia, conteudo: d.conteudo });
      else flash("Conteúdo não encontrado. Gera de novo");
    } catch { flash("Erro ao abrir"); } finally { setLoadingConteudo(false); }
  };

  const gerarConteudo = async (ideia: Ideia) => {
    if (gerandoIdeia) return;
    setGerandoIdeia(ideia.id);
    try {
      const res = await fetch(`/api/admin/social/${ideia.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "gerar" }),
      });
      const d = await res.json();
      if (!res.ok || d.error) { flash(d.error || "Erro ao gerar"); return; }
      flash("Conteúdo pronto");
      await load();
      abrirConteudo({ ...ideia, conteudo_id: d.conteudo_id });
    } catch { flash("Falha de conexão"); } finally { setGerandoIdeia(null); }
  };

  // cronômetro enquanto qualquer geração roda (lote ou individual)
  useEffect(() => {
    if (!lote && gerandoIdeia === null) { setSeg(0); return; }
    const t = setInterval(() => setSeg((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [lote, gerandoIdeia]);

  // gera as próximas N ideias novas em sequência, sem precisar clicar uma a uma
  const gerarLote = async (qtd = 3) => {
    if (lote || gerandoIdeia) return;
    const fila = ideias.filter((i) => i.status === "nova").slice(0, qtd);
    if (!fila.length) { flash("Nenhuma ideia nova na pauta. Gera a pauta primeiro"); return; }
    let ok = 0;
    for (let i = 0; i < fila.length; i++) {
      setSeg(0);
      setLote({ atual: i + 1, total: fila.length, hook: fila[i].hook });
      try {
        const res = await fetch(`/api/admin/social/${fila[i].id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ acao: "gerar" }),
        });
        const d = await res.json().catch(() => ({}));
        if (res.ok && !d.error) ok++;
      } catch { /* segue pro próximo */ }
    }
    setLote(null);
    flash(`Lote pronto: ${ok} de ${fila.length} conteúdos gerados`);
    load();
  };

  const descartar = async (id: number) => {
    const res = await fetch(`/api/admin/social/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: "descartar" }),
    }).catch(() => null);
    if (!res?.ok) { flash("Erro ao descartar"); return; }
    load();
  };

  const copiar = async (texto: string, chave: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(chave);
      setTimeout(() => setCopiado(""), 1600);
    } catch { flash("Não consegui copiar"); }
  };

  const filtradas = ideias.filter((i) =>
    (filtro === "todas" || i.status === filtro) && (!filtroTipo || i.tipo === filtroTipo)
  );

  const slugBase = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9\s]/g, "").trim().replace(/\s+/g, "-").slice(0, 40);

  const corpoParse = (c: Conteudo): { slides?: Slide[]; gancho?: string; roteiro?: RoteiroBloco[]; cta?: string } => {
    try { return JSON.parse(c.corpo); } catch { return {}; }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 42, fontWeight: 700, letterSpacing: "-0.035em", margin: "0 0 6px", lineHeight: 1.05 }}>Conteúdo Social</h1>
          <div style={{ color: "var(--ed2-ink-2)", fontSize: 15 }}>Ideias e pacotes prontos (reel, carrossel, story) pro Instagram da Endereço Digital</div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" onClick={() => gerarLote(3)} disabled={lote !== null || gerandoIdeia !== null}
            title="Pega as 3 próximas ideias com status Nova e gera o conteúdo completo de cada uma, em fila (cada uma leva 30 a 60 segundos)"
            style={{ ...btnPill, padding: "11px 20px", fontSize: 13, background: "#0B1838", color: "#F5F2EA", opacity: lote ? 0.85 : 1 }}>
            {lote ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Sparkles size={14} strokeWidth={2.2} aria-hidden="true" />}
            {lote ? `Gerando ${lote.atual} de ${lote.total} · ${seg}s` : "Gerar 3 em lote"}
          </button>
          <button type="button" onClick={gerarPauta} disabled={gerandoPauta}
            style={{ ...btnPill, padding: "11px 20px", fontSize: 13, background: "#C9A961", color: "#fff", boxShadow: "0 4px 12px rgba(201,169,97,0.28)" }}>
            {gerandoPauta ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Sparkles size={14} strokeWidth={2.2} aria-hidden="true" />}
            {gerandoPauta ? "Gerando pauta..." : "Gerar pauta (24 ideias)"}
          </button>
        </div>
      </div>

      {/* Status vivo da geração: prova de movimento enquanto a IA trabalha */}
      {lote && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(201,169,97,0.10)", border: "1px solid rgba(201,169,97,0.25)", borderRadius: 14, padding: "11px 16px", marginBottom: 16, fontSize: 13 }}>
          <Loader2 size={14} className="animate-spin" style={{ color: "var(--pill-gold-fg)", flexShrink: 0 }} aria-hidden="true" />
          <span style={{ minWidth: 0 }}>
            <b>Criando {lote.atual} de {lote.total}</b> ({seg}s): &ldquo;{lote.hook.slice(0, 90)}&rdquo;
            <span style={{ color: "var(--ed2-ink-2)" }}> · cada conteúdo leva de 30 a 60 segundos, pode navegar em outra aba que eu continuo aqui</span>
          </span>
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ display: "inline-flex", background: "var(--ed2-card)", padding: 4, borderRadius: 999, gap: 2, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          {([["todas", "Todas"], ["nova", "Novas"], ["gerada", "Geradas"]] as const).map(([k, lbl]) => (
            <button key={k} type="button" onClick={() => setFiltro(k)}
              style={{ ...btnPill, padding: "8px 16px", fontSize: 13, color: filtro === k ? "var(--ed2-ink)" : "var(--ed2-ink-2)", background: filtro === k ? "var(--ed2-surface)" : "transparent" }}>
              {lbl}
            </button>
          ))}
        </div>
        <div style={{ display: "inline-flex", background: "var(--ed2-card)", padding: 4, borderRadius: 999, gap: 2, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          {([["", "Todos os tipos"], ["reel", "Reels"], ["carrossel", "Carrosséis"], ["story", "Stories"]] as const).map(([k, lbl]) => (
            <button key={k || "todos"} type="button" onClick={() => setFiltroTipo(k)}
              style={{ ...btnPill, padding: "8px 16px", fontSize: 13, color: filtroTipo === k ? "var(--ed2-ink)" : "var(--ed2-ink-2)", background: filtroTipo === k ? "var(--ed2-surface)" : "transparent" }}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de ideias */}
      {loading ? (
        <div style={{ display: "grid", placeItems: "center", padding: "60px 0" }}><Loader2 className="animate-spin" style={{ color: "var(--ed2-ink-3)" }} /></div>
      ) : filtradas.length === 0 ? (
        <div style={{ background: "var(--ed2-card)", borderRadius: 28, padding: "60px 24px", textAlign: "center", color: "var(--ed2-ink-2)", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          Nenhuma ideia {filtro !== "todas" || filtroTipo ? "nesse filtro" : "ainda"}. Clica em <b>Gerar pauta</b> que a IA cria 24 de uma vez.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
          {filtradas.map((i) => {
            const tm = TIPO_META[i.tipo];
            const Icon = tm.icon;
            return (
              <div key={i.id} style={{ background: "var(--ed2-card)", borderRadius: 20, padding: "18px 20px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 11px", borderRadius: 99, fontSize: 11.5, fontWeight: 700, background: tm.bg, color: tm.fg }}>
                    <Icon size={12} aria-hidden="true" /> {tm.label}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ed2-ink-3)" }}>
                    {PILAR_LABEL[i.pilar] ?? i.pilar}
                  </span>
                </div>
                <div style={{ fontWeight: 650, fontSize: 14.5, lineHeight: 1.35 }}>{i.hook}</div>
                {i.descricao && <div style={{ fontSize: 12.5, color: "var(--ed2-ink-2)", lineHeight: 1.5 }}>{i.descricao}</div>}
                <div style={{ fontSize: 11.5, color: "var(--ed2-ink-3)", fontWeight: 600 }}>{i.formato}</div>
                <div style={{ display: "flex", gap: 8, marginTop: "auto", alignItems: "center" }}>
                  {i.status === "gerada" && i.conteudo_id ? (
                    <button type="button" onClick={() => abrirConteudo(i)}
                      style={{ ...btnPill, background: "rgba(52,199,89,0.14)", color: "var(--pill-green-fg)" }}>
                      <Check size={13} aria-hidden="true" /> Ver pacote
                    </button>
                  ) : (
                    <button type="button" onClick={() => gerarConteudo(i)} disabled={gerandoIdeia !== null}
                      style={{ ...btnPill, background: gerandoIdeia === i.id ? "var(--ed2-surface)" : "#C9A961", color: gerandoIdeia === i.id ? "var(--ed2-ink-2)" : "#fff" }}>
                      {gerandoIdeia === i.id ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Sparkles size={13} aria-hidden="true" />}
                      {gerandoIdeia === i.id ? `Gerando... ${seg}s` : "Gerar conteúdo"}
                    </button>
                  )}
                  <button type="button" title="Descartar ideia" onClick={() => descartar(i.id)}
                    style={{ ...btnPill, background: "var(--ed2-surface)", color: "var(--ed2-ink-3)", padding: "7px 10px", marginLeft: "auto" }}>
                    <Trash2 size={13} aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal do pacote gerado */}
      {(aberto || loadingConteudo) && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(7,15,38,0.55)", display: "grid", placeItems: "center", padding: 20 }} onClick={() => setAberto(null)}>
          <div style={{ background: "var(--ed2-card)", borderRadius: 24, width: "100%", maxWidth: 900, maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.3)" }} onClick={(e) => e.stopPropagation()}>
            {loadingConteudo || !aberto ? (
              <div style={{ display: "grid", placeItems: "center", padding: "80px 0" }}><Loader2 className="animate-spin" style={{ color: "var(--ed2-ink-3)" }} /></div>
            ) : (() => {
              const c = aberto.conteudo;
              const corpo = corpoParse(c);
              const tm = TIPO_META[c.tipo];
              return (
                <>
                  <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--ed2-hair)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <span style={{ display: "inline-flex", padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700, background: tm.bg, color: tm.fg, marginBottom: 6 }}>{tm.label}</span>
                      <div style={{ fontWeight: 700, fontSize: 17 }}>{c.titulo}</div>
                      {custoEmReais(c.custo_usd) && (
                        <div style={{ fontSize: 12, color: "var(--pill-gold-fg)", fontWeight: 600, marginTop: 3 }}>custo de geração: {custoEmReais(c.custo_usd)}</div>
                      )}
                    </div>
                    <button type="button" onClick={() => setAberto(null)} style={{ all: "unset", cursor: "pointer", color: "var(--ed2-ink-2)", padding: 6 }} aria-label="Fechar"><X size={18} /></button>
                  </div>

                  <div style={{ overflowY: "auto", padding: "20px 24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
                    {c.tipo === "carrossel" && corpo.slides ? (
                      <CarrosselCanvas slides={corpo.slides} nomeBase={slugBase(c.titulo)} />
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {corpo.gancho && (
                          <div style={{ background: "rgba(201,169,97,0.10)", borderRadius: 14, padding: "14px 16px" }}>
                            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--pill-gold-fg)", marginBottom: 4 }}>Gancho (0-3s)</div>
                            <div style={{ fontSize: 14.5, fontWeight: 600 }}>{corpo.gancho}</div>
                          </div>
                        )}
                        {(corpo.roteiro ?? []).map((b, idx) => (
                          <div key={idx} style={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: 12, borderBottom: "1px solid var(--ed2-hair)", paddingBottom: 12 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--pill-gold-fg)", fontVariantNumeric: "tabular-nums" }}>{b.tempo}</div>
                            <div>
                              <div style={{ fontSize: 14, marginBottom: 3 }}>{b.fala}</div>
                              <div style={{ fontSize: 12, color: "var(--ed2-ink-3)" }}>Cena: {b.cena}</div>
                            </div>
                          </div>
                        ))}
                        {corpo.cta && (
                          <div style={{ fontSize: 13.5 }}><b style={{ color: "var(--pill-green-fg)" }}>CTA:</b> {corpo.cta}</div>
                        )}
                      </div>
                    )}

                    {c.legenda && (
                      <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ed2-ink-2)" }}>Legenda</span>
                          <button type="button" onClick={() => copiar(`${c.legenda}\n\n${c.hashtags ?? ""}`, "legenda")}
                            style={{ ...btnPill, background: "var(--ed2-surface)", color: "var(--ed2-ink)" }}>
                            {copiado === "legenda" ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
                            {copiado === "legenda" ? "Copiado" : "Copiar legenda + tags"}
                          </button>
                        </div>
                        <div style={{ background: "var(--ed2-surface)", borderRadius: 12, padding: "12px 14px", fontSize: 13, whiteSpace: "pre-wrap", lineHeight: 1.55 }}>
                          {c.legenda}
                          {c.hashtags && <div style={{ marginTop: 8, color: "var(--pill-blue-fg)" }}>{c.hashtags}</div>}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
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
