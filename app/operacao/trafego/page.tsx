"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Link2, Copy, Check, Trash2, TrendingUp, Coins } from "lucide-react";
import { FONTES_TRAFEGO, FONTE_TRAFEGO_LABEL, type FonteTrafego } from "@/lib/groow/types";

interface CampanhaAds { nome: string; spend: number; impressoes: number; cliques: number; cpc: number | null }
interface IgResumo {
  username: string; seguidores: number; publicacoes: number; alcance28d: number | null;
  posts: { legenda: string; tipo: string; likes: number; comentarios: number; quando: string; link: string }[];
}
interface MetaData {
  status: { metaAds: boolean; instagram: boolean };
  campanhas?: CampanhaAds[];
  campanhasErro?: string;
  instagram?: IgResumo;
  instagramErro?: string;
}

interface Canal {
  canal: string;
  leads: number;
  clientes: number;
  receita: number;
  investimento: number;
  cpl: number | null;
  roas: number | null;
}
interface Investimento { id: number; canal: string; mes: string; valor: string }
interface UtmLink { id: number; nome: string; url_final: string; utm_source: string; utm_medium: string; utm_campaign: string; criado_em: string }

const brl0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

const CANAL_LABEL: Record<string, string> = { ...FONTE_TRAFEGO_LABEL, organico: "Orgânico / não pago" };

function ymAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const btnPill: React.CSSProperties = { all: "unset", cursor: "pointer", padding: "7px 14px", borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 6 };
const inputStyle: React.CSSProperties = { width: "100%", boxSizing: "border-box", background: "var(--ed2-surface)", border: "1px solid var(--ed2-hair)", borderRadius: 12, padding: "10px 13px", fontSize: 13.5, color: "var(--ed2-ink)", outline: "none" };
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--ed2-ink-2)", display: "block", marginBottom: 5 };
const cardSec: React.CSSProperties = { background: "var(--ed2-card)", borderRadius: 20, padding: "20px 22px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" };

export default function TrafegoPage() {
  const [aba, setAba] = useState<"atribuicao" | "utm" | "investimento" | "integracoes">("atribuicao");
  const [meta, setMeta] = useState<MetaData | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [canais, setCanais] = useState<Canal[]>([]);
  const [investimentos, setInvestimentos] = useState<Investimento[]>([]);
  const [utms, setUtms] = useState<UtmLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [copiado, setCopiado] = useState<number | "novo" | null>(null);

  // form investimento
  const [invCanal, setInvCanal] = useState<FonteTrafego>("meta_ads");
  const [invMes, setInvMes] = useState(ymAtual());
  const [invValor, setInvValor] = useState("");

  // form utm
  const [uNome, setUNome] = useState("");
  const [uUrl, setUUrl] = useState("https://enderecodigital.com");
  const [uSource, setUSource] = useState("meta");
  const [uMedium, setUMedium] = useState("cpc");
  const [uCampaign, setUCampaign] = useState("");
  const [uContent, setUContent] = useState("");
  const [uFinal, setUFinal] = useState("");

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/trafego");
      const d = await res.json();
      if (!d.error) {
        setCanais(d.canais || []);
        setInvestimentos(d.investimentos || []);
        setUtms(d.utms || []);
      }
    } catch { /* */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (aba !== "integracoes" || meta) return;
    setLoadingMeta(true);
    fetch("/api/admin/trafego/meta")
      .then((r) => r.json())
      .then((d) => { if (!d.error) setMeta(d); })
      .catch(() => { /* */ })
      .finally(() => setLoadingMeta(false));
  }, [aba, meta]);

  const sincronizarCustos = async () => {
    if (sincronizando) return;
    setSincronizando(true);
    try {
      const res = await fetch("/api/admin/trafego/meta", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "sync_spend" }),
      });
      const d = await res.json();
      if (!res.ok || d.error) { flash(d.error || "Erro ao sincronizar"); return; }
      flash(`Custos da Meta sincronizados (${d.meses} ${d.meses === 1 ? "mês" : "meses"})`);
      load();
    } catch { flash("Falha de conexão"); } finally { setSincronizando(false); }
  };

  const salvarInvestimento = async () => {
    const valor = Number(invValor.replace(",", "."));
    if (!valor || valor <= 0) { flash("Informa o valor investido"); return; }
    const res = await fetch("/api/admin/trafego", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: "investimento", canal: invCanal, mes: invMes, valor }),
    }).catch(() => null);
    if (!res?.ok) { flash("Erro ao salvar"); return; }
    flash(`Investimento salvo: ${CANAL_LABEL[invCanal]} · ${invMes}`);
    setInvValor("");
    load();
  };

  const gerarUtm = async () => {
    if (!uCampaign.trim()) { flash("Dá um nome pra campanha (utm_campaign)"); return; }
    const res = await fetch("/api/admin/trafego", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao: "utm", nome: uNome, url: uUrl, source: uSource, medium: uMedium, campaign: uCampaign, content: uContent }),
    }).catch(() => null);
    const d = await res?.json();
    if (!res?.ok || d?.error) { flash(d?.error || "Erro ao gerar"); return; }
    setUFinal(d.url_final);
    try { await navigator.clipboard.writeText(d.url_final); setCopiado("novo"); setTimeout(() => setCopiado(null), 1800); } catch { /* */ }
    flash("Link gerado e copiado");
    load();
  };

  const copiarLink = async (u: UtmLink) => {
    try { await navigator.clipboard.writeText(u.url_final); setCopiado(u.id); setTimeout(() => setCopiado(null), 1600); } catch { flash("Não consegui copiar"); }
  };

  const excluirUtm = async (id: number) => {
    await fetch(`/api/admin/trafego?utm=${id}`, { method: "DELETE" }).catch(() => null);
    load();
  };

  const totalInvest = canais.reduce((a, c) => a + c.investimento, 0);
  const totalReceita = canais.reduce((a, c) => a + c.receita, 0);
  const roasGeral = totalInvest > 0 ? Math.round((totalReceita / totalInvest) * 10) / 10 : null;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 42, fontWeight: 700, letterSpacing: "-0.035em", margin: "0 0 6px", lineHeight: 1.05 }}>Tráfego</h1>
        <div style={{ color: "var(--ed2-ink-2)", fontSize: 15 }}>Atribuição de ponta a ponta: anuncio, lead, cliente, receita, tudo ligado</div>
      </div>

      {/* Abas */}
      <div style={{ display: "inline-flex", background: "var(--ed2-card)", padding: 4, borderRadius: 999, gap: 2, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", marginBottom: 20 }}>
        {([["atribuicao", "Atribuição & ROAS"], ["utm", "UTM Builder"], ["investimento", "Investimentos"], ["integracoes", "Integrações"]] as const).map(([k, lbl]) => (
          <button key={k} type="button" onClick={() => setAba(k)}
            style={{ ...btnPill, padding: "9px 18px", fontSize: 13, color: aba === k ? "var(--ed2-ink)" : "var(--ed2-ink-2)", background: aba === k ? "var(--ed2-surface)" : "transparent" }}>
            {lbl}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: "grid", placeItems: "center", padding: "60px 0" }}><Loader2 className="animate-spin" style={{ color: "var(--ed2-ink-3)" }} /></div>
      ) : aba === "atribuicao" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 16 }}>
            <div style={cardSec}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ed2-ink-2)", marginBottom: 8 }}>Investido (total)</div>
              <div style={{ fontSize: 26, fontWeight: 700 }}>R$ {brl0.format(totalInvest)}</div>
            </div>
            <div style={cardSec}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ed2-ink-2)", marginBottom: 8 }}>Receita atribuída</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: "var(--pill-green-fg)" }}>R$ {brl0.format(totalReceita)}</div>
            </div>
            <div style={cardSec}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ed2-ink-2)", marginBottom: 8 }}>ROAS geral</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: roasGeral != null && roasGeral >= 1 ? "var(--pill-green-fg)" : "var(--ed2-ink)" }}>
                {roasGeral != null ? `${String(roasGeral).replace(".", ",")}x` : "-"}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--ed2-ink-3)", marginTop: 4 }}>{roasGeral == null ? "cadastra investimento pra calcular" : "receita ÷ investimento"}</div>
            </div>
          </div>

          {/* Tabela por canal */}
          <div style={{ background: "var(--ed2-card)", borderRadius: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden" }}>
            {canais.length === 0 ? (
              <div style={{ padding: "50px 24px", textAlign: "center", color: "var(--ed2-ink-2)" }}>
                Sem dados ainda. Marca a fonte de tráfego nos leads e cadastra o investimento na aba ao lado.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 640 }}>
                  <thead>
                    <tr style={{ background: "var(--ed2-surface-2)", borderBottom: "1px solid var(--ed2-hair)" }}>
                      {["Canal", "Leads", "Clientes", "Receita", "Investido", "CPL", "ROAS"].map((h, i) => (
                        <th key={h} style={{ padding: "12px 16px", textAlign: i === 0 ? "left" : "right", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ed2-ink-2)", paddingLeft: i === 0 ? 24 : 16 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {canais.map((c) => (
                      <tr key={c.canal} style={{ borderBottom: "1px solid var(--ed2-hair)" }}>
                        <td style={{ padding: "13px 24px", fontWeight: 600 }}>{CANAL_LABEL[c.canal] ?? c.canal}</td>
                        <td style={{ padding: "13px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{c.leads}</td>
                        <td style={{ padding: "13px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{c.clientes}</td>
                        <td style={{ padding: "13px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: "var(--pill-green-fg)" }}>R$ {brl0.format(c.receita)}</td>
                        <td style={{ padding: "13px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{c.investimento ? `R$ ${brl0.format(c.investimento)}` : "-"}</td>
                        <td style={{ padding: "13px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{c.cpl != null ? `R$ ${brl0.format(c.cpl)}` : "-"}</td>
                        <td style={{ padding: "13px 24px 13px 16px", textAlign: "right" }}>
                          {c.roas != null ? (
                            <span style={{ padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 700, background: c.roas >= 1 ? "rgba(52,199,89,0.14)" : "rgba(255,59,48,0.12)", color: c.roas >= 1 ? "var(--pill-green-fg)" : "var(--pill-red-fg)" }}>
                              {String(c.roas).replace(".", ",")}x
                            </span>
                          ) : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : aba === "utm" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 18, alignItems: "start" }}>
          {/* Builder */}
          <div style={cardSec}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <Link2 size={15} style={{ color: "#C9A961" }} aria-hidden="true" /> Montar link rastreado
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={labelStyle}>Apelido (pra achar depois)</label>
                <input style={inputStyle} value={uNome} onChange={(e) => setUNome(e.target.value)} placeholder="Ex: Anúncio barbearia julho" />
              </div>
              <div>
                <label style={labelStyle}>URL de destino</label>
                <input style={inputStyle} value={uUrl} onChange={(e) => setUUrl(e.target.value)} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={labelStyle}>utm_source</label>
                  <select style={{ ...inputStyle, cursor: "pointer" }} value={uSource} onChange={(e) => setUSource(e.target.value)}>
                    {["meta", "google", "tiktok", "instagram", "whatsapp", "email"].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>utm_medium</label>
                  <select style={{ ...inputStyle, cursor: "pointer" }} value={uMedium} onChange={(e) => setUMedium(e.target.value)}>
                    {["cpc", "paid_social", "organic_social", "email", "referral", "bio"].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>utm_campaign *</label>
                <input style={inputStyle} value={uCampaign} onChange={(e) => setUCampaign(e.target.value)} placeholder="Ex: barbearia-jul26" />
              </div>
              <div>
                <label style={labelStyle}>utm_content (opcional, variação do criativo)</label>
                <input style={inputStyle} value={uContent} onChange={(e) => setUContent(e.target.value)} placeholder="Ex: video-depoimento" />
              </div>
              <button type="button" onClick={gerarUtm}
                style={{ ...btnPill, justifyContent: "center", padding: "12px 18px", fontSize: 13.5, background: "#C9A961", color: "#fff" }}>
                {copiado === "novo" ? <Check size={14} aria-hidden="true" /> : <Link2 size={14} aria-hidden="true" />}
                Gerar e copiar link
              </button>
              {uFinal && (
                <div style={{ background: "var(--ed2-surface)", borderRadius: 10, padding: "10px 12px", fontSize: 12, fontFamily: "monospace", wordBreak: "break-all", color: "var(--ed2-ink-2)" }}>{uFinal}</div>
              )}
            </div>
          </div>

          {/* Histórico */}
          <div style={cardSec}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Links gerados</div>
            {utms.length === 0 ? (
              <div style={{ color: "var(--ed2-ink-2)", fontSize: 13, padding: "20px 0", textAlign: "center" }}>Nenhum link ainda.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {utms.map((u) => (
                  <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--ed2-hair)" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{u.nome}</div>
                      <div style={{ fontSize: 11.5, color: "var(--ed2-ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {u.utm_source} · {u.utm_medium} · {u.utm_campaign} · {u.criado_em}
                      </div>
                    </div>
                    <button type="button" onClick={() => copiarLink(u)} title="Copiar"
                      style={{ ...btnPill, background: "var(--ed2-surface)", color: "var(--ed2-ink)", padding: "7px 10px" }}>
                      {copiado === u.id ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
                    </button>
                    <button type="button" onClick={() => excluirUtm(u.id)} title="Excluir"
                      style={{ ...btnPill, background: "rgba(255,59,48,0.10)", color: "var(--pill-red-fg)", padding: "7px 10px" }}>
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : aba === "investimento" ? (
        /* Investimentos */
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 18, alignItems: "start" }}>
          <div style={cardSec}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
              <Coins size={15} style={{ color: "#C9A961" }} aria-hidden="true" /> Registrar investimento
            </div>
            <div style={{ fontSize: 12.5, color: "var(--ed2-ink-2)", marginBottom: 14 }}>
              Quanto você gastou em anúncio, por canal e mês. É isso que alimenta o CPL e o ROAS da aba Atribuição.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={labelStyle}>Canal</label>
                <select style={{ ...inputStyle, cursor: "pointer" }} value={invCanal} onChange={(e) => setInvCanal(e.target.value as FonteTrafego)}>
                  {FONTES_TRAFEGO.map((f) => <option key={f} value={f}>{FONTE_TRAFEGO_LABEL[f]}</option>)}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={labelStyle}>Mês</label>
                  <input type="month" style={inputStyle} value={invMes} onChange={(e) => setInvMes(e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Valor (R$)</label>
                  <input style={inputStyle} value={invValor} onChange={(e) => setInvValor(e.target.value)} placeholder="Ex: 800" inputMode="decimal" />
                </div>
              </div>
              <button type="button" onClick={salvarInvestimento}
                style={{ ...btnPill, justifyContent: "center", padding: "12px 18px", fontSize: 13.5, background: "#C9A961", color: "#fff" }}>
                <TrendingUp size={14} aria-hidden="true" /> Salvar
              </button>
            </div>
          </div>

          <div style={cardSec}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Histórico</div>
            {investimentos.length === 0 ? (
              <div style={{ color: "var(--ed2-ink-2)", fontSize: 13, padding: "20px 0", textAlign: "center" }}>Nenhum investimento registrado.</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <tbody>
                  {investimentos.map((i) => (
                    <tr key={i.id} style={{ borderBottom: "1px solid var(--ed2-hair)" }}>
                      <td style={{ padding: "10px 4px", fontWeight: 600 }}>{CANAL_LABEL[i.canal] ?? i.canal}</td>
                      <td style={{ padding: "10px 4px", color: "var(--ed2-ink-2)", fontVariantNumeric: "tabular-nums" }}>{i.mes}</td>
                      <td style={{ padding: "10px 4px", textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>R$ {brl0.format(Number(i.valor))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        /* Integrações */
        loadingMeta ? (
          <div style={{ display: "grid", placeItems: "center", padding: "60px 0" }}><Loader2 className="animate-spin" style={{ color: "var(--ed2-ink-3)" }} /></div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Cards de status */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px,1fr))", gap: 16 }}>
              <div style={cardSec}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>Meta Ads</span>
                  <span style={{ padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700, background: meta?.status.metaAds ? "rgba(52,199,89,0.14)" : "var(--ed2-surface)", color: meta?.status.metaAds ? "var(--pill-green-fg)" : "var(--ed2-ink-3)" }}>
                    {meta?.status.metaAds ? "Conectado" : "Não conectado"}
                  </span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--ed2-ink-2)", lineHeight: 1.55 }}>
                  {meta?.status.metaAds
                    ? "Custos e campanhas direto da conta de anúncio."
                    : "Adiciona no .env do servidor: META_AD_ACCOUNT_ID (id da conta de anúncio) e dá o escopo ads_read pro mesmo System User do WhatsApp."}
                </div>
                {meta?.status.metaAds && (
                  <button type="button" onClick={sincronizarCustos}
                    style={{ ...btnPill, marginTop: 12, background: "#C9A961", color: "#fff" }}>
                    {sincronizando ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <TrendingUp size={13} aria-hidden="true" />}
                    Sincronizar custos (3 meses)
                  </button>
                )}
              </div>
              <div style={cardSec}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>Instagram (orgânico)</span>
                  <span style={{ padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700, background: meta?.status.instagram ? "rgba(52,199,89,0.14)" : "var(--ed2-surface)", color: meta?.status.instagram ? "var(--pill-green-fg)" : "var(--ed2-ink-3)" }}>
                    {meta?.status.instagram ? "Conectado" : "Não conectado"}
                  </span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--ed2-ink-2)", lineHeight: 1.55 }}>
                  {meta?.status.instagram
                    ? "Seguidores, alcance e desempenho dos posts."
                    : "Adiciona META_IG_USER_ID no .env (id numérico do IG business, vinculado à página do Facebook) + escopos instagram_basic e instagram_manage_insights."}
                </div>
              </div>
              <div style={cardSec}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>Google (Ads + Search Console)</span>
                  <span style={{ padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700, background: "var(--ed2-surface)", color: "var(--ed2-ink-3)" }}>Em breve</span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--ed2-ink-2)", lineHeight: 1.55 }}>
                  Search Console (orgânico do Google) entra na próxima fase via service account. Google Ads depende de developer token aprovado pela Google. Até lá, registra o custo na aba Investimentos.
                </div>
              </div>
            </div>

            {/* Campanhas Meta */}
            {meta?.campanhasErro && (
              <div style={{ fontSize: 13, color: "var(--pill-orange-fg)", background: "rgba(255,159,10,0.10)", borderRadius: 12, padding: "11px 14px" }}>{meta.campanhasErro}</div>
            )}
            {meta?.campanhas && meta.campanhas.length > 0 && (
              <div style={{ background: "var(--ed2-card)", borderRadius: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden" }}>
                <div style={{ padding: "16px 24px 0", fontWeight: 700, fontSize: 14 }}>Campanhas · últimos 30 dias</div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 560 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--ed2-hair)" }}>
                        {["Campanha", "Gasto", "Impressões", "Cliques", "CPC"].map((h, i) => (
                          <th key={h} style={{ padding: "12px 16px", textAlign: i === 0 ? "left" : "right", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ed2-ink-2)", paddingLeft: i === 0 ? 24 : 16 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {meta.campanhas.map((c) => (
                        <tr key={c.nome} style={{ borderBottom: "1px solid var(--ed2-hair)" }}>
                          <td style={{ padding: "12px 24px", fontWeight: 600 }}>{c.nome}</td>
                          <td style={{ padding: "12px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>R$ {brl0.format(c.spend)}</td>
                          <td style={{ padding: "12px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{brl0.format(c.impressoes)}</td>
                          <td style={{ padding: "12px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{brl0.format(c.cliques)}</td>
                          <td style={{ padding: "12px 24px 12px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{c.cpc != null ? `R$ ${c.cpc.toFixed(2).replace(".", ",")}` : "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Instagram orgânico */}
            {meta?.instagramErro && (
              <div style={{ fontSize: 13, color: "var(--pill-orange-fg)", background: "rgba(255,159,10,0.10)", borderRadius: 12, padding: "11px 14px" }}>{meta.instagramErro}</div>
            )}
            {meta?.instagram && (
              <div style={{ background: "var(--ed2-card)", borderRadius: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", padding: "20px 24px" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>@{meta.instagram.username}</span>
                  <span style={{ fontSize: 13, color: "var(--ed2-ink-2)" }}><b style={{ color: "var(--ed2-ink)" }}>{brl0.format(meta.instagram.seguidores)}</b> seguidores</span>
                  <span style={{ fontSize: 13, color: "var(--ed2-ink-2)" }}><b style={{ color: "var(--ed2-ink)" }}>{brl0.format(meta.instagram.publicacoes)}</b> posts</span>
                  {meta.instagram.alcance28d != null && (
                    <span style={{ fontSize: 13, color: "var(--ed2-ink-2)" }}>alcance 28d: <b style={{ color: "var(--pill-green-fg)" }}>{brl0.format(meta.instagram.alcance28d)}</b></span>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px,1fr))", gap: 10 }}>
                  {meta.instagram.posts.map((p, i) => (
                    <a key={i} href={p.link} target="_blank" rel="noreferrer"
                      style={{ background: "var(--ed2-surface)", borderRadius: 14, padding: "12px 14px", textDecoration: "none", color: "inherit" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--pill-gold-fg)", marginBottom: 4, textTransform: "uppercase" }}>{p.tipo} · {p.quando}</div>
                      <div style={{ fontSize: 12.5, lineHeight: 1.45, marginBottom: 6, minHeight: 34 }}>{p.legenda || "(sem legenda)"}</div>
                      <div style={{ fontSize: 12, color: "var(--ed2-ink-2)", fontVariantNumeric: "tabular-nums" }}>{p.likes} curtidas · {p.comentarios} comentários</div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 28, right: 28, zIndex: 999, display: "inline-flex", alignItems: "center", gap: 8, background: "#0B1838", color: "#F5F2EA", padding: "12px 18px", borderRadius: 14, fontSize: 13, fontWeight: 500, boxShadow: "0 8px 24px rgba(0,0,0,0.22)" }}>
          <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="#34C759" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6l2.5 2.5L9.5 3.5" /></svg> {toast}
        </div>
      )}
    </div>
  );
}
