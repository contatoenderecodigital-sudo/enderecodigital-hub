"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Loader2, Megaphone, Plus, X, Play, Pause, Trash2, Eye, Zap } from "lucide-react";

interface Stats { total: number; pendente: number; enviado: number; entregue: number; lido: number; respondeu: number; falha: number; optout: number }
interface Campanha {
  id: number; nome: string; template_nome: string; template_idioma: string;
  status: "rascunho" | "agendada" | "enviando" | "pausada" | "concluida";
  cap_dia: number; janela_inicio: number; janela_fim: number; pular_domingo: number;
  inicio_agendado: string | null; created_at: string; stats: Stats;
}
interface Template { name: string; language: string; category: string; bodyText: string | null; varCount: number }
interface Destinatario { id: number; whatsapp: string; nome: string | null; status: string; erro: string | null; enviado_em: string | null }

const ST: Record<string, { label: string; bg: string; fg: string }> = {
  rascunho: { label: "Rascunho", bg: "var(--ed2-surface)", fg: "var(--ed2-ink-2)" },
  agendada: { label: "Agendada", bg: "rgba(10,132,255,0.12)", fg: "var(--pill-blue-fg)" },
  enviando: { label: "Enviando", bg: "rgba(52,199,89,0.14)", fg: "var(--pill-green-fg)" },
  pausada: { label: "Pausada", bg: "rgba(255,159,10,0.14)", fg: "var(--pill-orange-fg)" },
  concluida: { label: "Concluída", bg: "rgba(88,86,214,0.14)", fg: "var(--pill-purple-fg)" },
};

const DEST_ST: Record<string, { label: string; fg: string }> = {
  pendente: { label: "Pendente", fg: "var(--ed2-ink-2)" },
  enviado: { label: "Enviado", fg: "var(--pill-blue-fg)" },
  entregue: { label: "Entregue", fg: "var(--pill-cyan-fg)" },
  lido: { label: "Lido", fg: "var(--pill-green-fg)" },
  respondeu: { label: "Respondeu", fg: "var(--pill-gold-fg)" },
  falha: { label: "Falha", fg: "var(--pill-red-fg)" },
  optout: { label: "Opt-out", fg: "var(--pill-red-fg)" },
};

function normalizarZapBR(raw: string): string | null {
  let d = (raw || "").replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("0")) d = d.replace(/^0+/, "");
  if (!d.startsWith("55")) d = `55${d}`;
  if (d.length < 12 || d.length > 13) return null;
  return d;
}

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", background: "var(--ed2-surface)",
  border: "1px solid var(--ed2-hair)", borderRadius: 12, padding: "11px 14px",
  fontSize: 14, color: "var(--ed2-ink)", outline: "none",
};
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--ed2-ink-2)", display: "block", marginBottom: 6 };
const secTitle: React.CSSProperties = { fontSize: 14, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 };
const cardSec: React.CSSProperties = { background: "var(--ed2-card)", borderRadius: 20, padding: "20px 22px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" };
const btnPill: React.CSSProperties = { all: "unset", cursor: "pointer", padding: "7px 14px", borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 6 };

export default function DisparosPage() {
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [view, setView] = useState<"lista" | "nova">("lista");

  // wizard
  const [nome, setNome] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [tplErro, setTplErro] = useState("");
  const [tplNome, setTplNome] = useState("");
  const [tplManual, setTplManual] = useState("");
  const [usarNome, setUsarNome] = useState(false);
  const [csv, setCsv] = useState("");
  const [capDia, setCapDia] = useState(100);
  const [jIni, setJIni] = useState(9);
  const [jFim, setJFim] = useState(19);
  const [pularDom, setPularDom] = useState(true);
  const [agendado, setAgendado] = useState("");
  const [lgpd, setLgpd] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  // detalhe
  const [detalhe, setDetalhe] = useState<{ campanha: Campanha; stats: Stats; destinatarios: Destinatario[] } | null>(null);
  const [loadingDet, setLoadingDet] = useState(false);
  const [processando, setProcessando] = useState(false);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 3200); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/wa-campanhas");
      const d = await res.json();
      if (!d.error) setCampanhas(d.campanhas || []);
    } catch { /* */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Ponte da Prospecção: se veio CSV pré-preenchido, abre o wizard direto
  useEffect(() => {
    const prefill = sessionStorage.getItem("disparo-prefill");
    if (!prefill) return;
    sessionStorage.removeItem("disparo-prefill");
    const nomeSugerido = sessionStorage.getItem("disparo-prefill-nome") ?? "";
    sessionStorage.removeItem("disparo-prefill-nome");
    setCsv(prefill);
    if (nomeSugerido) setNome(`Prospecção ${nomeSugerido}`);
    setView("nova");
  }, []);

  useEffect(() => {
    if (view !== "nova") return;
    fetch("/api/admin/wa-campanhas/templates")
      .then((r) => r.json())
      .then((d) => { if (d.error) setTplErro(d.error); else setTemplates(d.templates || []); })
      .catch(() => setTplErro("Não consegui falar com a Meta agora."));
  }, [view]);

  // parse CSV ao vivo
  const parseCsv = useMemo(() => {
    const linhas = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const vistos = new Set<string>();
    const validos: { whatsapp: string; nome?: string }[] = [];
    let invalidos = 0, duplicados = 0;
    for (const linha of linhas) {
      if (/^whatsapp\b/i.test(linha) || /^telefone\b/i.test(linha)) continue; // header
      const [zapRaw, ...resto] = linha.split(/[,;\t]/);
      const zap = normalizarZapBR(zapRaw);
      if (!zap) { invalidos++; continue; }
      if (vistos.has(zap)) { duplicados++; continue; }
      vistos.add(zap);
      validos.push({ whatsapp: zap, nome: resto.join(" ").trim() || undefined });
    }
    return { validos, invalidos, duplicados };
  }, [csv]);

  const lerArquivo = (f: File | null) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result || ""));
    reader.readAsText(f);
  };

  const templateEscolhido = tplNome || tplManual.trim();
  const tplSelecionado = templates.find((t) => t.name === tplNome);

  const criar = async () => {
    if (salvando) return;
    setErro("");
    setSalvando(true);
    try {
      const res = await fetch("/api/admin/wa-campanhas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome, template_nome: templateEscolhido,
          template_idioma: tplSelecionado?.language || "pt_BR",
          body_params_modo: usarNome ? "nome" : "nenhum",
          cap_dia: capDia, janela_inicio: jIni, janela_fim: jFim,
          pular_domingo: pularDom, inicio_agendado: agendado || null,
          optin_confirmado: lgpd, destinatarios: parseCsv.validos,
        }),
      });
      const d = await res.json();
      if (!res.ok || d.error) { setErro(d.error || "Erro ao criar"); return; }
      flash(`Campanha criada com ${d.aceitos} destinatário${d.aceitos === 1 ? "" : "s"}${agendado ? " · agendada" : " · rascunho (clica em Iniciar)"}`);
      setView("lista");
      setNome(""); setCsv(""); setLgpd(false); setTplNome(""); setTplManual(""); setAgendado("");
      load();
    } catch { setErro("Falha de conexão."); } finally { setSalvando(false); }
  };

  const acao = async (id: number, a: "iniciar" | "pausar" | "retomar") => {
    const res = await fetch(`/api/admin/wa-campanhas/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: a }),
    }).catch(() => null);
    if (!res?.ok) { flash("Erro na ação"); return; }
    flash(a === "pausar" ? "Campanha pausada" : "Campanha ativa: a fila processa no próximo tick");
    load();
    if (detalhe?.campanha.id === id) abrirDetalhe(id);
  };

  const excluir = async (id: number) => {
    if (!confirm("Excluir a campanha e todos os destinatários?")) return;
    const res = await fetch(`/api/admin/wa-campanhas/${id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) { flash("Erro ao excluir"); return; }
    if (detalhe?.campanha.id === id) setDetalhe(null);
    flash("Campanha excluída");
    load();
  };

  const abrirDetalhe = async (id: number) => {
    setLoadingDet(true);
    try {
      const res = await fetch(`/api/admin/wa-campanhas/${id}`);
      const d = await res.json();
      if (!d.error) setDetalhe(d);
    } catch { /* */ } finally { setLoadingDet(false); }
  };

  const processarAgora = async () => {
    if (processando) return;
    setProcessando(true);
    try {
      const res = await fetch("/api/admin/wa-campanhas/tick", { method: "POST" });
      const d = await res.json();
      if (d.error) flash(d.error);
      else flash(`Tick: ${d.enviadas} enviada${d.enviadas === 1 ? "" : "s"}, ${d.falhas} falha${d.falhas === 1 ? "" : "s"}${d.puladas?.length ? ` · ${d.puladas[0]}` : ""}`);
      load();
      if (detalhe) abrirDetalhe(detalhe.campanha.id);
    } catch { flash("Erro no processamento"); } finally { setProcessando(false); }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 42, fontWeight: 700, letterSpacing: "-0.035em", margin: "0 0 6px", lineHeight: 1.05 }}>Disparos</h1>
          <div style={{ color: "var(--ed2-ink-2)", fontSize: 15 }}>Template aprovado Meta + CSV de destinatários + cadência diária</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {view === "lista" && (
            <>
              <button type="button" onClick={processarAgora}
                style={{ ...btnPill, padding: "11px 18px", fontSize: 13, background: "var(--ed2-card)", color: "var(--ed2-ink)", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                {processando ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Zap size={14} aria-hidden="true" />}
                Processar fila agora
              </button>
              <button type="button" onClick={() => setView("nova")}
                style={{ ...btnPill, padding: "11px 20px", fontSize: 13, background: "#C9A961", color: "#fff", boxShadow: "0 4px 12px rgba(201,169,97,0.28)" }}>
                <Plus size={14} strokeWidth={2.5} aria-hidden="true" /> Nova campanha
              </button>
            </>
          )}
          {view === "nova" && (
            <button type="button" onClick={() => setView("lista")} style={{ ...btnPill, padding: "11px 18px", fontSize: 13, background: "var(--ed2-card)", color: "var(--ed2-ink-2)", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <X size={14} aria-hidden="true" /> Cancelar
            </button>
          )}
        </div>
      </div>

      {view === "nova" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 860 }}>
          {/* 1. Identificação + Template */}
          <div style={cardSec}>
            <div style={secTitle}><span style={{ color: "#C9A961" }}>1</span> Identificação + Template</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={labelStyle}>Nome da campanha *</label>
                <input style={inputStyle} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Reativação clientes barbearia · jul/26" />
              </div>
              <div>
                <label style={labelStyle}>Template Meta aprovado *</label>
                {tplErro ? (
                  <div>
                    <div style={{ fontSize: 12.5, color: "var(--pill-orange-fg)", background: "rgba(255,159,10,0.10)", borderRadius: 10, padding: "9px 12px", marginBottom: 8 }}>
                      {tplErro}. Digita o nome exato do template abaixo.
                    </div>
                    <input style={inputStyle} value={tplManual} onChange={(e) => setTplManual(e.target.value)} placeholder="nome_exato_do_template" />
                  </div>
                ) : (
                  <select style={{ ...inputStyle, cursor: "pointer" }} value={tplNome} onChange={(e) => setTplNome(e.target.value)}>
                    <option value="">Escolhe o template…</option>
                    {templates.map((t) => (
                      <option key={`${t.name}-${t.language}`} value={t.name}>{t.name} ({t.category}) · {t.language}</option>
                    ))}
                  </select>
                )}
                {tplSelecionado?.bodyText && (
                  <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--ed2-ink-2)", background: "var(--ed2-surface)", borderRadius: 10, padding: "10px 12px", whiteSpace: "pre-wrap" }}>
                    {tplSelecionado.bodyText}
                  </div>
                )}
                {(tplSelecionado?.varCount ?? 0) > 0 && (
                  <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 13, color: "var(--ed2-ink)", cursor: "pointer" }}>
                    <input type="checkbox" checked={usarNome} onChange={(e) => setUsarNome(e.target.checked)} />
                    Usar o nome do destinatário como variável {"{{1}}"} do template
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* 2. Destinatários */}
          <div style={cardSec}>
            <div style={secTitle}><span style={{ color: "#C9A961" }}>2</span> Destinatários (CSV)</div>
            <div style={{ fontSize: 12.5, color: "var(--ed2-ink-2)", marginBottom: 10 }}>
              Uma linha por contato: <code>whatsapp,nome</code> (nome opcional). Dedup automático por número normalizado E.164 BR.
            </div>
            <input type="file" accept=".csv,.txt" onChange={(e) => lerArquivo(e.target.files?.[0] ?? null)} style={{ marginBottom: 10, fontSize: 13, color: "var(--ed2-ink-2)" }} />
            <textarea style={{ ...inputStyle, minHeight: 120, resize: "vertical", fontFamily: "monospace", fontSize: 12.5 }}
              value={csv} onChange={(e) => setCsv(e.target.value)}
              placeholder={"whatsapp,nome\n5511999999999,João\n5511988887777,Maria"} />
            {csv.trim() && (
              <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 12.5, flexWrap: "wrap" }}>
                <span style={{ color: "var(--pill-green-fg)", fontWeight: 600 }}>{parseCsv.validos.length} válidos</span>
                {parseCsv.duplicados > 0 && <span style={{ color: "var(--pill-orange-fg)" }}>{parseCsv.duplicados} duplicados removidos</span>}
                {parseCsv.invalidos > 0 && <span style={{ color: "var(--pill-red-fg)" }}>{parseCsv.invalidos} inválidos ignorados</span>}
              </div>
            )}
          </div>

          {/* 3. Cadência + Agendamento */}
          <div style={cardSec}>
            <div style={secTitle}><span style={{ color: "#C9A961" }}>3</span> Cadência + Agendamento</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
              <div>
                <label style={labelStyle}>Msgs/dia (cap)</label>
                <input type="number" min={1} max={250} style={inputStyle} value={capDia} onChange={(e) => setCapDia(Number(e.target.value))} />
                <div style={{ fontSize: 11.5, color: "var(--ed2-ink-3)", marginTop: 5 }}>Tier 1 Meta: 250/dia máx</div>
              </div>
              <div>
                <label style={labelStyle}>Janela início (h BRT)</label>
                <input type="number" min={0} max={23} style={inputStyle} value={jIni} onChange={(e) => setJIni(Number(e.target.value))} />
              </div>
              <div>
                <label style={labelStyle}>Janela fim (h BRT)</label>
                <input type="number" min={1} max={24} style={inputStyle} value={jFim} onChange={(e) => setJFim(Number(e.target.value))} />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 24, marginTop: 16, flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={pularDom} onChange={(e) => setPularDom(e.target.checked)} /> Pular domingo
              </label>
              <div style={{ flex: 1, minWidth: 220 }}>
                <label style={labelStyle}>Início agendado (opcional)</label>
                <input type="datetime-local" style={inputStyle} value={agendado} onChange={(e) => setAgendado(e.target.value)} />
                <div style={{ fontSize: 11.5, color: "var(--ed2-ink-3)", marginTop: 5 }}>Vazio = salva como rascunho · preenchido = agendada</div>
              </div>
            </div>
          </div>

          {/* LGPD */}
          <div style={{ ...cardSec, background: "rgba(201,169,97,0.08)", border: "1px solid rgba(201,169,97,0.25)" }}>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, cursor: "pointer", lineHeight: 1.5 }}>
              <input type="checkbox" checked={lgpd} onChange={(e) => setLgpd(e.target.checked)} style={{ marginTop: 3 }} />
              <span>
                <b>Confirmo que os destinatários deste CSV deram opt-in expresso</b> pra receber comunicação WhatsApp da Endereço Digital, conforme LGPD.
                Disparo sem opt-in viola a LGPD e pode derrubar a qualidade do número na Meta (de verde pra vermelho).
              </span>
            </label>
          </div>

          {erro && <div style={{ fontSize: 13, color: "var(--pill-red-fg)", background: "rgba(255,59,48,0.08)", borderRadius: 12, padding: "11px 14px" }}>{erro}</div>}

          <button type="button" onClick={criar}
            disabled={!nome.trim() || !templateEscolhido || !parseCsv.validos.length || !lgpd || salvando}
            style={{
              ...btnPill, justifyContent: "center", padding: "14px 20px", fontSize: 14,
              background: nome.trim() && templateEscolhido && parseCsv.validos.length && lgpd ? "#C9A961" : "var(--ed2-surface)",
              color: nome.trim() && templateEscolhido && parseCsv.validos.length && lgpd ? "#fff" : "var(--ed2-ink-3)",
              cursor: nome.trim() && templateEscolhido && parseCsv.validos.length && lgpd ? "pointer" : "default",
            }}>
            {salvando ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Megaphone size={15} aria-hidden="true" />}
            Criar campanha
          </button>
        </div>
      ) : (
        /* LISTA */
        <div style={{ background: "var(--ed2-card)", borderRadius: 28, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden" }}>
          {loading ? (
            <div style={{ display: "grid", placeItems: "center", padding: "60px 0" }}><Loader2 className="animate-spin" style={{ color: "var(--ed2-ink-3)" }} /></div>
          ) : campanhas.length === 0 ? (
            <div style={{ padding: "60px 24px", textAlign: "center", color: "var(--ed2-ink-2)" }}>
              Nenhuma campanha ainda. Clica em <b>Nova campanha</b> pra criar o primeiro disparo.
            </div>
          ) : (
            campanhas.map((c) => {
              const st = ST[c.status];
              const feitos = c.stats.enviado + c.stats.entregue + c.stats.lido + c.stats.respondeu;
              const pct = c.stats.total ? Math.round((feitos / c.stats.total) * 100) : 0;
              return (
                <div key={c.id} style={{ padding: "16px 24px", borderBottom: "1px solid var(--ed2-hair)", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ fontWeight: 600, fontSize: 14.5, marginBottom: 4 }}>{c.nome}</div>
                    <div style={{ fontSize: 12, color: "var(--ed2-ink-2)", display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <span>{c.template_nome}</span>
                      <span>{c.cap_dia}/dia · {c.janela_inicio}h-{c.janela_fim}h{c.pular_domingo ? " · sem dom" : ""}</span>
                      <span>{c.stats.total} contatos</span>
                    </div>
                    <div style={{ height: 6, background: "var(--ed2-surface)", borderRadius: 99, overflow: "hidden", marginTop: 8, maxWidth: 320 }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: "#34C759", borderRadius: 99 }} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 12, fontSize: 12, fontVariantNumeric: "tabular-nums", flexWrap: "wrap" }}>
                    <span title="Lidos" style={{ color: "var(--pill-green-fg)", fontWeight: 700 }}>{c.stats.lido + c.stats.respondeu} lidos</span>
                    <span title="Respostas" style={{ color: "var(--pill-gold-fg)", fontWeight: 700 }}>{c.stats.respondeu} respostas</span>
                    {c.stats.falha > 0 && <span style={{ color: "var(--pill-red-fg)", fontWeight: 700 }}>{c.stats.falha} falhas</span>}
                  </div>
                  <span style={{ padding: "4px 12px", borderRadius: 99, fontSize: 12, fontWeight: 600, background: st.bg, color: st.fg }}>{st.label}</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button type="button" onClick={() => abrirDetalhe(c.id)} style={{ ...btnPill, background: "var(--ed2-surface)", color: "var(--ed2-ink)" }}>
                      <Eye size={13} aria-hidden="true" /> Detalhes
                    </button>
                    {(c.status === "rascunho" || c.status === "agendada") && (
                      <button type="button" onClick={() => acao(c.id, "iniciar")} style={{ ...btnPill, background: "#34C759", color: "#fff" }}>
                        <Play size={13} aria-hidden="true" /> Iniciar
                      </button>
                    )}
                    {c.status === "enviando" && (
                      <button type="button" onClick={() => acao(c.id, "pausar")} style={{ ...btnPill, background: "rgba(255,159,10,0.14)", color: "var(--pill-orange-fg)" }}>
                        <Pause size={13} aria-hidden="true" /> Pausar
                      </button>
                    )}
                    {c.status === "pausada" && (
                      <button type="button" onClick={() => acao(c.id, "retomar")} style={{ ...btnPill, background: "#34C759", color: "#fff" }}>
                        <Play size={13} aria-hidden="true" /> Retomar
                      </button>
                    )}
                    <button type="button" onClick={() => excluir(c.id)} style={{ ...btnPill, background: "rgba(255,59,48,0.10)", color: "var(--pill-red-fg)", padding: "7px 10px" }}>
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Modal detalhe */}
      {(detalhe || loadingDet) && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(7,15,38,0.55)", display: "grid", placeItems: "center", padding: 20 }} onClick={() => setDetalhe(null)}>
          <div style={{ background: "var(--ed2-card)", borderRadius: 24, width: "100%", maxWidth: 760, maxHeight: "88vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.3)" }} onClick={(e) => e.stopPropagation()}>
            {loadingDet || !detalhe ? (
              <div style={{ display: "grid", placeItems: "center", padding: "80px 0" }}><Loader2 className="animate-spin" style={{ color: "var(--ed2-ink-3)" }} /></div>
            ) : (
              <>
                <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--ed2-hair)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 17 }}>{detalhe.campanha.nome}</div>
                    <div style={{ fontSize: 12, color: "var(--ed2-ink-2)" }}>{detalhe.campanha.template_nome} · {detalhe.stats.total} contatos</div>
                  </div>
                  <button type="button" onClick={() => setDetalhe(null)} style={{ all: "unset", cursor: "pointer", color: "var(--ed2-ink-2)", padding: 6 }} aria-label="Fechar"><X size={18} /></button>
                </div>
                <div style={{ display: "flex", gap: 10, padding: "14px 24px", flexWrap: "wrap", borderBottom: "1px solid var(--ed2-hair)" }}>
                  {(Object.entries(DEST_ST) as [string, { label: string; fg: string }][]).map(([k, v]) => (
                    <span key={k} style={{ fontSize: 12, fontWeight: 600, color: v.fg }}>
                      {v.label}: {(detalhe.stats as unknown as Record<string, number>)[k] ?? 0}
                    </span>
                  ))}
                </div>
                <div style={{ overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <tbody>
                      {detalhe.destinatarios.map((d) => (
                        <tr key={d.id} style={{ borderBottom: "1px solid var(--ed2-hair)" }}>
                          <td style={{ padding: "10px 24px", fontVariantNumeric: "tabular-nums" }}>{d.whatsapp}</td>
                          <td style={{ padding: "10px 12px", color: "var(--ed2-ink-2)" }}>{d.nome || "-"}</td>
                          <td style={{ padding: "10px 12px", fontWeight: 600, color: DEST_ST[d.status]?.fg ?? "var(--ed2-ink-2)" }}>{DEST_ST[d.status]?.label ?? d.status}</td>
                          <td style={{ padding: "10px 24px 10px 12px", color: "var(--ed2-ink-3)", fontSize: 12 }}>{d.erro || d.enviado_em || ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
