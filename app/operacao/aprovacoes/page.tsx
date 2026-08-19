"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Loader2, Check, X, Eye, FileText, Share2, Megaphone, Play, PartyPopper } from "lucide-react";
import { custoEmReais } from "@/lib/groow/custo-ia";

interface PostPend { id: number; titulo: string; resumo: string; criado_em: string; custo_usd?: string | number | null }
interface SocialPend { id: number; tipo: string; titulo: string; criado_em: string; custo_usd?: string | number | null }
interface CampPend { id: number; nome: string; template_nome: string; total: number }

const btnPill: React.CSSProperties = { all: "unset", cursor: "pointer", padding: "7px 14px", borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 6 };
const secStyle: React.CSSProperties = { background: "var(--ed2-card)", borderRadius: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden" };
const secHead: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "16px 22px", borderBottom: "1px solid var(--ed2-hair)", fontWeight: 700, fontSize: 14.5 };

export default function AprovacoesPage() {
  const [blog, setBlog] = useState<PostPend[]>([]);
  const [social, setSocial] = useState<SocialPend[]>([]);
  const [campanhas, setCampanhas] = useState<CampPend[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [agindo, setAgindo] = useState<string | null>(null);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/aprovacoes");
      const d = await res.json();
      if (!d.error) {
        setBlog(d.blog || []);
        setSocial(d.social || []);
        setCampanhas(d.campanhas || []);
      }
    } catch { /* */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const agir = async (chave: string, url: string, body: unknown, okMsg: string) => {
    if (agindo) return;
    setAgindo(chave);
    try {
      const res = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.error) { flash(d.error || "Erro na ação"); return; }
      flash(okMsg);
      load();
    } catch { flash("Falha de conexão"); } finally { setAgindo(null); }
  };

  const totalPendente = blog.length + social.length + campanhas.length;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 42, fontWeight: 700, letterSpacing: "-0.035em", margin: "0 0 6px", lineHeight: 1.05 }}>Aprovações</h1>
        <div style={{ color: "var(--ed2-ink-2)", fontSize: 15 }}>
          {loading ? "Carregando..." : totalPendente === 0 ? "Nada esperando você. Caixa limpa." : `${totalPendente} ite${totalPendente === 1 ? "m espera" : "ns esperam"} teu OK`}
        </div>
      </div>

      {loading ? (
        <div style={{ display: "grid", placeItems: "center", padding: "60px 0" }}><Loader2 className="animate-spin" style={{ color: "var(--ed2-ink-3)" }} /></div>
      ) : totalPendente === 0 ? (
        <div style={{ ...secStyle, padding: "64px 24px", textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: "rgba(52,199,89,0.12)", margin: "0 auto 16px", display: "grid", placeItems: "center", color: "var(--pill-green-fg)" }}>
            <PartyPopper size={28} strokeWidth={1.6} aria-hidden="true" />
          </div>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Tudo aprovado</h3>
          <p style={{ margin: "8px auto 0", color: "var(--ed2-ink-2)", fontSize: 14, maxWidth: 420 }}>
            Quando o agente gerar artigo novo (6h30) ou você criar conteúdo e campanhas, eles aparecem aqui esperando teu OK.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Blog */}
          {blog.length > 0 && (
            <div style={secStyle}>
              <div style={secHead}><FileText size={16} style={{ color: "var(--pill-gold-fg)" }} aria-hidden="true" /> Artigos do blog <span style={{ color: "var(--ed2-ink-3)", fontWeight: 500 }}>({blog.length})</span></div>
              {blog.map((p) => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 22px", borderBottom: "1px solid var(--ed2-hair)", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{p.titulo}</div>
                    <div style={{ fontSize: 12.5, color: "var(--ed2-ink-2)", marginTop: 2 }}>
                      {p.resumo?.slice(0, 110)} · {p.criado_em}
                      {custoEmReais(p.custo_usd) && <span style={{ color: "var(--pill-gold-fg)", fontWeight: 600 }}> · custo {custoEmReais(p.custo_usd)}</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <Link href="/operacao/blog" style={{ ...btnPill, background: "var(--ed2-surface)", color: "var(--ed2-ink)", textDecoration: "none" }}>
                      <Eye size={13} aria-hidden="true" /> Revisar
                    </Link>
                    <button type="button" disabled={agindo !== null}
                      onClick={() => agir(`blog-${p.id}`, `/api/admin/blog/${p.id}`, { status: "publicado" }, "Artigo no ar! Já entrou no sitemap.")}
                      style={{ ...btnPill, background: "#34C759", color: "#fff" }}>
                      {agindo === `blog-${p.id}` ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Check size={13} aria-hidden="true" />} Publicar
                    </button>
                    <button type="button" disabled={agindo !== null}
                      onClick={() => agir(`blogx-${p.id}`, `/api/admin/blog/${p.id}`, { status: "arquivado" }, "Artigo descartado")}
                      style={{ ...btnPill, background: "rgba(255,59,48,0.10)", color: "var(--pill-red-fg)", padding: "7px 10px" }}>
                      <X size={13} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Social */}
          {social.length > 0 && (
            <div style={secStyle}>
              <div style={secHead}><Share2 size={16} style={{ color: "var(--pill-purple-fg)" }} aria-hidden="true" /> Conteúdo social <span style={{ color: "var(--ed2-ink-3)", fontWeight: 500 }}>({social.length})</span></div>
              {social.map((s) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 22px", borderBottom: "1px solid var(--ed2-hair)", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{s.titulo}</div>
                    <div style={{ fontSize: 12.5, color: "var(--ed2-ink-2)", marginTop: 2 }}>
                      <span style={{ textTransform: "capitalize" }}>{s.tipo}</span> · {s.criado_em}
                      {custoEmReais(s.custo_usd) && <span style={{ color: "var(--pill-gold-fg)", fontWeight: 600 }}> · custo {custoEmReais(s.custo_usd)}</span>}
                    </div>
                  </div>
                  <Link href="/operacao/conteudo-social" style={{ ...btnPill, background: "var(--ed2-surface)", color: "var(--ed2-ink)", textDecoration: "none" }}>
                    <Eye size={13} aria-hidden="true" /> Abrir pacote (baixar PNGs / roteiro)
                  </Link>
                </div>
              ))}
            </div>
          )}

          {/* Campanhas WA */}
          {campanhas.length > 0 && (
            <div style={secStyle}>
              <div style={secHead}><Megaphone size={16} style={{ color: "var(--pill-blue-fg)" }} aria-hidden="true" /> Campanhas de disparo paradas <span style={{ color: "var(--ed2-ink-3)", fontWeight: 500 }}>({campanhas.length})</span></div>
              {campanhas.map((c) => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 22px", borderBottom: "1px solid var(--ed2-hair)", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{c.nome}</div>
                    <div style={{ fontSize: 12.5, color: "var(--ed2-ink-2)", marginTop: 2 }}>{c.template_nome} · {c.total} contatos</div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <Link href="/operacao/disparos" style={{ ...btnPill, background: "var(--ed2-surface)", color: "var(--ed2-ink)", textDecoration: "none" }}>
                      <Eye size={13} aria-hidden="true" /> Detalhes
                    </Link>
                    <button type="button" disabled={agindo !== null}
                      onClick={() => agir(`camp-${c.id}`, `/api/admin/wa-campanhas/${c.id}`, { acao: "iniciar" }, "Campanha ativa: entra na fila do próximo tick")}
                      style={{ ...btnPill, background: "#34C759", color: "#fff" }}>
                      {agindo === `camp-${c.id}` ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Play size={13} aria-hidden="true" />} Iniciar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
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
