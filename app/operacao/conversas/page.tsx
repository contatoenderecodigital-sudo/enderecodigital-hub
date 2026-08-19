"use client";

// Inbox do WhatsApp (Meta Cloud API) - lista de conversas + thread + composer.
// IA (n8n) responde quando status = ai_active; "Assumir" pausa a IA e você
// responde pelo mesmo número daqui.
import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Check, CheckCheck, ChevronLeft, MessageSquare, Send, User, X, Plus, Search, Loader2, Users, Sparkles, Info, Building2, MapPin, Mail, Tag, ExternalLink, Mic } from "lucide-react";

interface Conversa {
  id: number;
  canal: string;
  whatsapp: string;
  nome: string | null;
  status: "ai_active" | "handed_off" | "closed";
  nao_lidas: number;
  ultima_mensagem: string | null;
  ultima_mensagem_em: string | null;
}
interface Mensagem {
  id: number;
  origem: "user" | "ai" | "humano" | "sistema";
  tipo: string;
  texto: string | null;
  status_entrega: "pending" | "sent" | "delivered" | "read" | "failed" | null;
  created_at: string;
}

const STATUS_META: Record<Conversa["status"], { label: string; bg: string; fg: string }> = {
  ai_active: { label: "IA", bg: "var(--ed2-gold-soft)", fg: "var(--ed2-gold-deep)" },
  handed_off: { label: "Você", bg: "var(--ed2-blue-soft)", fg: "var(--ed2-blue)" },
  closed: { label: "Fechada", bg: "var(--ed2-surface)", fg: "var(--ed2-ink-2)" },
};

function hora(dt: string | null) {
  if (!dt) return "";
  const d = new Date(dt);
  const hoje = new Date();
  if (d.toDateString() === hoje.toDateString())
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function iniciais(nome: string | null, whatsapp: string) {
  const base = (nome ?? "").trim() || whatsapp.slice(-2);
  return base.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
}

export default function ConversasPage() {
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [dbError, setDbError] = useState<string | null>(null);
  const [selId, setSelId] = useState<number | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [gerandoIA, setGerandoIA] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [novaAberto, setNovaAberto] = useState(false);
  const [novaInicial, setNovaInicial] = useState<{ numero: string; nome: string } | null>(null);
  const [verContato, setVerContato] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  // veio de outro módulo (ex.: botão WhatsApp de um lead) com ?para=numero&nome=...
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const para = sp.get("para");
    if (para) {
      setNovaInicial({ numero: para, nome: sp.get("nome") || "" });
      setNovaAberto(true);
      window.history.replaceState({}, "", "/operacao/conversas"); // limpa a URL
    }
  }, []);

  const sel = conversas.find((c) => c.id === selId) ?? null;

  const loadConversas = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/conversas");
      const d = await r.json();
      setConversas(d.conversas ?? []);
      setDbError(d.error ?? null);
    } catch { /* mantém estado */ }
  }, []);

  const loadMensagens = useCallback(async (id: number) => {
    try {
      const r = await fetch(`/api/admin/conversas/${id}`);
      const d = await r.json();
      setMensagens(d.mensagens ?? []);
    } catch { /* mantém */ }
  }, []);

  useEffect(() => {
    loadConversas();
    const t = setInterval(loadConversas, 6000);
    return () => clearInterval(t);
  }, [loadConversas]);

  useEffect(() => {
    if (selId == null) return;
    loadMensagens(selId);
    const t = setInterval(() => loadMensagens(selId), 4000);
    return () => clearInterval(t);
  }, [selId, loadMensagens]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [mensagens.length, selId]);

  const enviar = async () => {
    if (!sel || !texto.trim() || enviando) return;
    setEnviando(true);
    setErroEnvio(null);
    try {
      const r = await fetch(`/api/admin/conversas/${sel.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: texto.trim() }),
      });
      const d = await r.json();
      if (!r.ok) { setErroEnvio(d.error ?? "Falha ao enviar."); return; }
      setTexto("");
      await loadMensagens(sel.id);
      await loadConversas();
    } finally {
      setEnviando(false);
    }
  };

  // "Chamar IA": gera a sugestão e joga no campo de texto pra você conferir e mandar.
  // Não envia nada sozinho, o cliente não percebe. Funciona mesmo depois de assumir.
  const chamarIA = async () => {
    if (!sel || gerandoIA) return;
    setGerandoIA(true);
    setErroEnvio(null);
    try {
      const r = await fetch(`/api/admin/conversas/${sel.id}/sugerir`, { method: "POST" });
      const d = await r.json();
      if (!r.ok || d.error) { setErroEnvio(d.error ?? "A IA não conseguiu sugerir agora."); return; }
      if (d.handoff) { setErroEnvio(`A IA acha melhor você responder pessoalmente (${d.handoff}).`); return; }
      if (d.sugestao) setTexto(d.sugestao);
    } catch { setErroEnvio("Falha ao chamar a IA."); } finally { setGerandoIA(false); }
  };

  const mudarStatus = async (status: Conversa["status"]) => {
    if (!sel) return;
    await fetch(`/api/admin/conversas/${sel.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await loadConversas();
  };

  const filtradas = conversas.filter((c) => {
    const q = busca.trim().toLowerCase();
    if (!q) return true;
    return (c.nome ?? "").toLowerCase().includes(q) || c.whatsapp.includes(q);
  });

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 42, fontWeight: 700, letterSpacing: "-0.035em", margin: "0 0 6px", lineHeight: 1.05 }}>Conversas</h1>
        <div style={{ color: "var(--ed2-ink-2)", fontSize: 15 }}>
          WhatsApp oficial · IA responde sozinha; assuma quando quiser falar você.
        </div>
      </div>

      <div
        className="ed2-card"
        style={{ display: "flex", overflow: "hidden", height: "calc(100vh - 230px)", minHeight: 480 }}
      >
        {/* LISTA */}
        <div
          className={sel ? "hidden lg:flex" : "flex"}
          style={{ width: "100%", maxWidth: 330, flexDirection: "column", borderRight: "1px solid var(--ed2-hair)", flexShrink: 0 }}
        >
          <div style={{ padding: 14, borderBottom: "1px solid var(--ed2-hair)", display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              type="button"
              onClick={() => setNovaAberto(true)}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "11px 14px", borderRadius: 12, border: "none", cursor: "pointer", background: "linear-gradient(135deg,#0B1838,#1d2d56)", color: "#fff", fontSize: 13.5, fontWeight: 650 }}
            >
              <Plus size={16} aria-hidden /> Nova conversa
            </button>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar nome ou número…"
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 14px", borderRadius: 12, border: "1px solid var(--ed2-hair)", background: "var(--ed2-surface)", color: "var(--ed2-ink)", fontSize: 13.5, outline: "none" }}
            />
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {filtradas.length === 0 && (
              <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--ed2-ink-2)", fontSize: 13.5, lineHeight: 1.6 }}>
                <MessageSquare size={28} strokeWidth={1.4} style={{ margin: "0 auto 10px", display: "block", color: "var(--ed2-ink-3)" }} aria-hidden />
                {dbError ? (
                  <>Tabelas ainda não criadas no MySQL.<br />Rode <code>sql/whatsapp.sql</code> no servidor.</>
                ) : (
                  <>
                    Nenhuma conversa ainda.<br />
                    Configure o webhook na Meta:<br />
                    <code style={{ fontSize: 11.5 }}>enderecodigital.com/api/whatsapp/webhook</code>
                  </>
                )}
              </div>
            )}
            {filtradas.map((c) => {
              const st = STATUS_META[c.status];
              const on = c.id === selId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelId(c.id)}
                  style={{
                    all: "unset", boxSizing: "border-box", display: "flex", alignItems: "center", gap: 12,
                    width: "100%", padding: "13px 14px", cursor: "pointer",
                    background: on ? "var(--ed2-surface)" : "transparent",
                    borderBottom: "1px solid var(--ed2-hair)",
                  }}
                >
                  <span style={{ width: 40, height: 40, borderRadius: 99, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, color: "#fff", background: "linear-gradient(135deg,#0B1838,#1d2d56)" }}>
                    {iniciais(c.nome, c.whatsapp)}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <b style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nome ?? c.whatsapp}</b>
                      <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--ed2-ink-2)", flexShrink: 0 }}>{hora(c.ultima_mensagem_em)}</span>
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
                      <span style={{ fontSize: 12.5, color: "var(--ed2-ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{c.ultima_mensagem ?? ""}</span>
                      <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: st.bg, color: st.fg, flexShrink: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>{st.label}</span>
                      {c.nao_lidas > 0 && (
                        <span style={{ minWidth: 18, height: 18, borderRadius: 99, background: "#C9A961", color: "#0B1838", fontSize: 10.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px", flexShrink: 0 }}>{c.nao_lidas}</span>
                      )}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* THREAD */}
        <div className={sel ? "flex" : "hidden lg:flex"} style={{ flex: 1, flexDirection: "column", minWidth: 0 }}>
          {!sel ? (
            <div style={{ flex: 1, display: "grid", placeItems: "center", color: "var(--ed2-ink-2)", fontSize: 14 }}>
              Selecione uma conversa ao lado.
            </div>
          ) : (
            <>
              {/* header */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid var(--ed2-hair)" }}>
                <button type="button" className="lg:hidden" onClick={() => setSelId(null)} aria-label="Voltar" style={{ all: "unset", cursor: "pointer", color: "var(--ed2-ink-2)", display: "flex" }}>
                  <ChevronLeft size={20} aria-hidden />
                </button>
                <span style={{ width: 36, height: 36, borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: "#fff", background: "linear-gradient(135deg,#0B1838,#1d2d56)", flexShrink: 0 }}>
                  {iniciais(sel.nome, sel.whatsapp)}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sel.nome ?? sel.whatsapp}</div>
                  <div style={{ fontSize: 11.5, color: "var(--ed2-ink-2)" }}>+{sel.whatsapp}</div>
                </div>
                <button type="button" onClick={() => setVerContato(true)} title="Dados do contato (do seu CRM)" aria-label="Dados do contato" style={btnHeader("var(--ed2-surface)", "var(--ed2-ink-2)")}>
                  <Info size={14} aria-hidden /> Dados
                </button>
                {sel.status === "ai_active" && (
                  <button type="button" onClick={() => mudarStatus("handed_off")} style={btnHeader("var(--ed2-accent)", "var(--ed2-accent-ink)")}>
                    <User size={13} aria-hidden /> Assumir
                  </button>
                )}
                {sel.status === "handed_off" && (
                  <button type="button" onClick={() => mudarStatus("ai_active")} style={btnHeader("var(--ed2-gold-soft)", "var(--ed2-gold-deep)")}>
                    <Bot size={13} aria-hidden /> Devolver pra IA
                  </button>
                )}
                {sel.status !== "closed" ? (
                  <button type="button" onClick={() => mudarStatus("closed")} aria-label="Fechar conversa" style={btnHeader("var(--ed2-surface)", "var(--ed2-ink-2)")}>
                    <X size={13} aria-hidden /> Fechar
                  </button>
                ) : (
                  <button type="button" onClick={() => mudarStatus("ai_active")} style={btnHeader("var(--ed2-green-soft)", "#1d8a3a")}>
                    Reabrir
                  </button>
                )}
              </div>

              {/* mensagens */}
              <div ref={threadRef} style={{ flex: 1, overflowY: "auto", padding: "18px 18px 8px", display: "flex", flexDirection: "column", gap: 8, background: "var(--ed2-surface-2)" }}>
                {mensagens.map((m) => {
                  const out = m.origem !== "user";
                  const isIA = m.origem === "ai";
                  return (
                    <div key={m.id} style={{ alignSelf: out ? "flex-end" : "flex-start", maxWidth: "72%" }}>
                      <div
                        style={{
                          padding: "9px 13px",
                          borderRadius: out ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                          background: out ? (isIA ? "var(--ed2-gold-soft)" : "var(--ed2-navy)") : "var(--ed2-card)",
                          color: out ? (isIA ? "var(--ed2-ink)" : "#fff") : "var(--ed2-ink)",
                          fontSize: 13.5, lineHeight: 1.5,
                          boxShadow: "var(--ed2-shadow)",
                          whiteSpace: "pre-wrap", wordBreak: "break-word",
                        }}
                      >
                        {m.tipo === "audio" && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, opacity: 0.7, marginBottom: 4 }}>
                            <Mic size={12} aria-hidden /> ÁUDIO TRANSCRITO
                          </span>
                        )}
                        {m.tipo === "audio" ? <div>{m.texto}</div> : m.texto}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: out ? "flex-end" : "flex-start", marginTop: 3, fontSize: 10.5, color: "var(--ed2-ink-2)" }}>
                        {out && <span style={{ fontWeight: 600 }}>{isIA ? "IA" : m.origem === "sistema" ? "Sistema" : "Você"}</span>}
                        {hora(m.created_at)}
                        {out && m.status_entrega === "read" && <CheckCheck size={13} style={{ color: "var(--ed2-blue)" }} aria-label="Lida" />}
                        {out && m.status_entrega === "delivered" && <CheckCheck size={13} aria-label="Entregue" />}
                        {out && m.status_entrega === "sent" && <Check size={13} aria-label="Enviada" />}
                        {out && m.status_entrega === "failed" && <span style={{ color: "#c8261c", fontWeight: 600 }}>falhou</span>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* composer */}
              <div style={{ padding: 14, borderTop: "1px solid var(--ed2-hair)" }}>
                {erroEnvio && (
                  <div style={{ marginBottom: 8, fontSize: 12.5, color: "#c8261c" }}>{erroEnvio}</div>
                )}
                {sel.status === "ai_active" && (
                  <div style={{ marginBottom: 8, fontSize: 12, color: "var(--ed2-ink-2)" }}>
                    A IA está ativa nesta conversa: enviar uma mensagem <b>assume</b> o atendimento.
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                  <button
                    type="button"
                    onClick={chamarIA}
                    disabled={gerandoIA}
                    title="A IA escreve a resposta no seu campo pra você conferir e mandar. O cliente não percebe."
                    style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 13px", borderRadius: 99, border: "1px solid var(--ed2-hair)", cursor: gerandoIA ? "default" : "pointer", background: "var(--ed2-gold-soft)", color: "var(--ed2-gold-deep)", fontSize: 12.5, fontWeight: 650, opacity: gerandoIA ? 0.6 : 1 }}
                  >
                    {gerandoIA ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Sparkles size={14} aria-hidden />}
                    {gerandoIA ? "Escrevendo…" : "Chamar IA"}
                  </button>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <input
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (sel.status === "ai_active") mudarStatus("handed_off"); enviar(); } }}
                    placeholder="Escreva sua mensagem…"
                    style={{ flex: 1, padding: "12px 16px", borderRadius: 14, border: "1px solid var(--ed2-hair)", background: "var(--ed2-surface)", color: "var(--ed2-ink)", fontSize: 14, outline: "none" }}
                  />
                  <button
                    type="button"
                    onClick={() => { if (sel.status === "ai_active") mudarStatus("handed_off"); enviar(); }}
                    disabled={enviando || !texto.trim()}
                    aria-label="Enviar"
                    style={{
                      width: 46, height: 46, borderRadius: 14, border: "none", cursor: enviando || !texto.trim() ? "default" : "pointer",
                      background: "linear-gradient(135deg,#C9A961,#a8893d)", color: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      opacity: enviando || !texto.trim() ? 0.5 : 1,
                    }}
                  >
                    <Send size={17} aria-hidden />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {novaAberto && (
        <NovaConversa
          initialNumero={novaInicial?.numero}
          initialNome={novaInicial?.nome}
          onClose={() => { setNovaAberto(false); setNovaInicial(null); }}
          onCriada={async (id) => { setNovaAberto(false); setNovaInicial(null); await loadConversas(); setSelId(id); }}
        />
      )}

      {verContato && sel && (
        <DadosContato conversaId={sel.id} onClose={() => setVerContato(false)} />
      )}
    </div>
  );
}

// ── Drawer: dados do contato vindos do CRM (Leads/Clientes) ──────────────────
interface DadosContatoResp {
  whatsapp: string;
  nomePerfil: string | null;
  statusConversa: string;
  primeiroContato: string;
  lead: { id: number; nome: string | null; empresa: string | null; setor: string | null; cidade: string | null; email: string | null; status: string | null; origem: string | null; notas: string | null } | null;
  cliente: { id: number; empresa: string | null; responsavel: string | null; email: string | null; plano: string | null; status: string | null } | null;
}

function DadosContato({ conversaId, onClose }: { conversaId: number; onClose: () => void }) {
  const [dados, setDados] = useState<DadosContatoResp | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/admin/conversas/${conversaId}/contato`);
        const d = await r.json();
        if (!d.error) setDados(d);
      } catch { /* */ } finally { setCarregando(false); }
    })();
  }, [conversaId]);

  const nome = dados?.cliente?.responsavel || dados?.lead?.nome || dados?.nomePerfil || "Contato";
  const empresa = dados?.cliente?.empresa || dados?.lead?.empresa || "";
  const noCRM = Boolean(dados?.lead || dados?.cliente);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(11,24,56,0.45)" }}>
      <aside onClick={(e) => e.stopPropagation()} style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: "min(400px,94vw)", background: "var(--ed2-card)", boxShadow: "-12px 0 48px rgba(0,0,0,0.25)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--ed2-hair)", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 700, flex: 1 }}>Dados do contato</div>
          <button type="button" onClick={onClose} aria-label="Fechar" style={{ all: "unset", cursor: "pointer", color: "var(--ed2-ink-2)", padding: 6 }}><X size={18} /></button>
        </div>

        {carregando ? (
          <div style={{ display: "grid", placeItems: "center", flex: 1 }}><Loader2 className="animate-spin" style={{ color: "var(--ed2-ink-3)" }} /></div>
        ) : (
          <div style={{ overflowY: "auto", padding: "22px", display: "flex", flexDirection: "column", gap: 18 }}>
            {/* cabeçalho: inicial (a Meta não fornece foto) + nome */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center" }}>
              <span style={{ width: 72, height: 72, borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 700, color: "#fff", background: "linear-gradient(135deg,#0B1838,#1d2d56)" }}>
                {(nome.trim()[0] ?? "?").toUpperCase()}
              </span>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>{nome}</div>
                {empresa && <div style={{ fontSize: 13, color: "var(--ed2-ink-2)", marginTop: 2 }}>{empresa}</div>}
                <div style={{ fontSize: 12.5, color: "var(--ed2-ink-3)", marginTop: 4 }}>+{dados?.whatsapp}</div>
              </div>
            </div>

            {!noCRM ? (
              <div style={{ padding: "14px 16px", borderRadius: 14, background: "var(--ed2-surface)", fontSize: 13, lineHeight: 1.55, color: "var(--ed2-ink-2)" }}>
                Esse número ainda não está no seu CRM. Quando você tratar como Lead, o histórico e os dados aparecem aqui.
                <div style={{ fontSize: 11.5, color: "var(--ed2-ink-3)", marginTop: 8 }}>
                  Obs.: a foto e o cartão de perfil do WhatsApp não são fornecidos pela API oficial da Meta. A riqueza vem do seu CRM.
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {dados?.cliente && (
                  <span style={{ alignSelf: "flex-start", padding: "4px 12px", borderRadius: 99, fontSize: 12, fontWeight: 700, background: "var(--ed2-green-soft)", color: "#1d8a3a" }}>Cliente</span>
                )}
                {dados?.lead && !dados?.cliente && (
                  <span style={{ alignSelf: "flex-start", padding: "4px 12px", borderRadius: 99, fontSize: 12, fontWeight: 700, background: "var(--ed2-gold-soft)", color: "var(--ed2-gold-deep)" }}>Lead</span>
                )}
                {(dados?.lead?.setor) && <LinhaInfo icone={Tag} rotulo="Ramo" valor={dados.lead.setor} />}
                {(dados?.lead?.cidade) && <LinhaInfo icone={MapPin} rotulo="Cidade" valor={dados.lead.cidade} />}
                {(dados?.cliente?.email || dados?.lead?.email) && <LinhaInfo icone={Mail} rotulo="Email" valor={(dados?.cliente?.email || dados?.lead?.email)!} />}
                {(dados?.cliente?.plano) && <LinhaInfo icone={Building2} rotulo="Plano" valor={dados.cliente.plano} />}
                {(dados?.lead?.status || dados?.cliente?.status) && <LinhaInfo icone={Info} rotulo="Situação" valor={(dados?.cliente?.status || dados?.lead?.status)!} />}
                {(dados?.lead?.origem) && <LinhaInfo icone={Info} rotulo="Origem" valor={dados.lead.origem} />}
                {(dados?.lead?.notas) && (
                  <div style={{ padding: "12px 14px", borderRadius: 12, background: "var(--ed2-surface)", fontSize: 13, lineHeight: 1.5 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ed2-ink-3)", marginBottom: 5 }}>Notas da equipe</div>
                    {dados.lead.notas}
                  </div>
                )}
                {dados?.lead && (
                  <a href={`/operacao/leads`} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "var(--pill-gold-fg)", textDecoration: "none", marginTop: 4 }}>
                    <ExternalLink size={14} /> Abrir no CRM
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

function LinhaInfo({ icone: Icone, rotulo, valor }: { icone: typeof Info; rotulo: string; valor: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
      <Icone size={16} style={{ color: "var(--ed2-ink-3)", flexShrink: 0, marginTop: 1 }} aria-hidden />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ed2-ink-3)" }}>{rotulo}</div>
        <div style={{ fontSize: 13.5, wordBreak: "break-word" }}>{valor}</div>
      </div>
    </div>
  );
}

// ── Modal: iniciar uma conversa nova ────────────────────────────────────────
interface Contato { nome: string; whatsapp: string; origem: "lead" | "cliente"; detalhe: string }
interface Template { name: string; status: string; language: string; category: string; bodyText: string | null; varCount: number }

function NovaConversa({ onClose, onCriada, initialNumero, initialNome }: { onClose: () => void; onCriada: (conversaId: number) => void; initialNumero?: string; initialNome?: string }) {
  const [q, setQ] = useState("");
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [contatosErro, setContatosErro] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [numero, setNumero] = useState(initialNumero ? initialNumero.replace(/\D/g, "") : "");
  const [nome, setNome] = useState(initialNome ?? "");
  const [modo, setModo] = useState<"template" | "texto">("template");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [tplErro, setTplErro] = useState<string | null>(null);
  const [tplSel, setTplSel] = useState<Template | null>(null);
  const [params, setParams] = useState<string[]>([]);
  const [texto, setTexto] = useState("");
  const [iaConduz, setIaConduz] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // criar template novo direto do admin
  const [criandoTpl, setCriandoTpl] = useState(false);
  const [tplNome, setTplNome] = useState("");
  const [tplCategoria, setTplCategoria] = useState<"UTILITY" | "MARKETING">("UTILITY");
  const [tplCorpo, setTplCorpo] = useState("");
  const [salvandoTpl, setSalvandoTpl] = useState(false);
  const [tplMsg, setTplMsg] = useState<string | null>(null);

  const carregarTemplates = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/conversas/templates");
      const d = await r.json();
      setTemplates(d.templates ?? []);
      setTplErro(d.error ?? null);
      if ((d.templates ?? []).length) {
        setTplSel((prev) => prev ?? d.templates[0]);
        setParams((prev) => (prev.length ? prev : new Array(d.templates[0].varCount).fill("")));
      }
    } catch { setTplErro("Não consegui listar os templates."); }
  }, []);

  const criarTemplate = async () => {
    setTplMsg(null);
    if (!tplCorpo.trim()) { setTplMsg("Escreva o corpo do template."); return; }
    setSalvandoTpl(true);
    try {
      const exemplos = Array.from(tplCorpo.matchAll(/\{\{(\d+)\}\}/g)).map(() => "exemplo");
      const r = await fetch("/api/admin/conversas/templates", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nomeAmigavel: tplNome || "primeiro contato", categoria: tplCategoria, corpo: tplCorpo.trim(), exemplos }),
      });
      const d = await r.json();
      if (!r.ok || d.error) { setTplMsg(d.error ?? "Falha ao criar."); return; }
      setTplMsg(`Enviado pra aprovação da Meta (${d.name}). Quando aprovar, aparece na lista aqui em cima. Costuma levar de minutos a poucas horas.`);
      setCriandoTpl(false);
      setTplCorpo(""); setTplNome("");
      await carregarTemplates();
    } catch { setTplMsg("Falha de conexão."); } finally { setSalvandoTpl(false); }
  };

  // busca contatos (debounce) em leads + clientes
  useEffect(() => {
    let vivo = true;
    setBuscando(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/admin/conversas/contatos?q=${encodeURIComponent(q)}`);
        const d = await r.json();
        if (vivo) { setContatos(d.contatos ?? []); setContatosErro(d.erro ?? null); }
      } catch { /* */ } finally { if (vivo) setBuscando(false); }
    }, 250);
    return () => { vivo = false; clearTimeout(t); };
  }, [q]);

  // carrega templates aprovados uma vez
  useEffect(() => { carregarTemplates(); }, [carregarTemplates]);

  const escolherContato = (c: Contato) => { setNumero(c.whatsapp); setNome(c.nome); };
  const limparContato = () => { setNumero(""); setNome(""); setQ(""); };
  const escolherTpl = (t: Template) => { setTplSel(t); setParams(new Array(t.varCount).fill("")); };

  // número digitado na mão (quando não é um contato da lista)
  const soDigitos = q.replace(/\D/g, "");
  const numeroManual = soDigitos.length >= 10 ? (soDigitos.startsWith("55") ? soDigitos : "55" + soDigitos) : "";

  const previa = tplSel?.bodyText
    ? tplSel.bodyText.replace(/\{\{(\d+)\}\}/g, (_, n) => params[Number(n) - 1] || `{{${n}}}`)
    : "";

  const enviar = async () => {
    setErro(null);
    if (!numero.trim()) { setErro("Escolha um contato ou digite o número."); return; }
    if (modo === "template" && !tplSel) { setErro("Escolha um template aprovado."); return; }
    if (modo === "texto" && !texto.trim()) { setErro("Escreva a mensagem."); return; }
    setEnviando(true);
    try {
      const r = await fetch("/api/admin/conversas/iniciar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whatsapp: numero,
          nome,
          modo,
          iaConduz,
          ...(modo === "template"
            ? { templateName: tplSel!.name, templateLang: tplSel!.language, templateBody: tplSel!.bodyText, params }
            : { texto: texto.trim() }),
        }),
      });
      const d = await r.json();
      if (!r.ok || d.error) {
        setErro(d.error ?? "Falha ao enviar.");
        if (d.precisaTemplate) setModo("template");
        return;
      }
      onCriada(d.conversaId);
    } catch { setErro("Falha de conexão."); } finally { setEnviando(false); }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(11,24,56,0.45)", backdropFilter: "blur(2px)", display: "grid", placeItems: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(560px,100%)", maxHeight: "92vh", overflowY: "auto", background: "var(--ed2-card)", borderRadius: 22, boxShadow: "0 24px 70px rgba(0,0,0,0.3)" }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--ed2-hair)", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em", flex: 1 }}>Nova conversa</div>
          <button type="button" onClick={onClose} style={{ all: "unset", cursor: "pointer", width: 32, height: 32, borderRadius: 9, display: "grid", placeItems: "center", background: "var(--ed2-surface)", color: "var(--ed2-ink-2)" }}><X size={16} /></button>
        </div>

        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* contato */}
          <div>
            <label style={rotulo}>Pra quem</label>

            {numero ? (
              // contato escolhido: mostra o chip com opção de trocar
              <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 13px", borderRadius: 12, background: "var(--ed2-surface)", border: "1px solid var(--ed2-hair)" }}>
                <span style={{ width: 38, height: 38, borderRadius: 99, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff", background: "linear-gradient(135deg,#0B1838,#1d2d56)" }}>
                  {(nome.trim()[0] ?? "?").toUpperCase()}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nome || "Número digitado"}</div>
                  <div style={{ fontSize: 12, color: "var(--ed2-ink-2)" }}>+{numero.replace(/\D/g, "")}</div>
                </div>
                <button type="button" onClick={limparContato} style={{ all: "unset", cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: "var(--pill-gold-fg)", padding: "6px 8px" }}>Trocar</button>
              </div>
            ) : (
              <>
                <div style={{ position: "relative" }}>
                  <Search size={15} style={{ position: "absolute", left: 12, top: 13, color: "var(--ed2-ink-3)" }} />
                  <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus
                    placeholder="Busca em Leads e Clientes, ou digite o número"
                    style={{ ...campo, paddingLeft: 34 }} />
                </div>

                {/* opção de usar o número digitado na mão */}
                {numeroManual && (
                  <button type="button" onClick={() => { setNumero(numeroManual); setNome(""); }}
                    style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, width: "100%", boxSizing: "border-box", marginTop: 8, padding: "10px 12px", borderRadius: 12, border: "1px dashed var(--ed2-hair)", background: "var(--ed2-surface)" }}>
                    <Plus size={15} style={{ color: "var(--pill-gold-fg)" }} />
                    <span style={{ fontSize: 13 }}>Usar o número <b>+{numeroManual}</b></span>
                  </button>
                )}

                {/* lista de contatos SEMPRE visível (Leads + Clientes) */}
                <div style={{ marginTop: 8, display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ed2-ink-3)" }}>
                    {q.trim() ? "Resultados" : "Seus contatos"}{contatos.length ? ` (${contatos.length})` : ""}
                  </span>
                  {!q.trim() && <span style={{ fontSize: 10.5, color: "var(--ed2-ink-3)" }}>só quem tem número salvo</span>}
                </div>
                <div style={{ marginTop: 6, border: "1px solid var(--ed2-hair)", borderRadius: 12, overflow: "hidden", maxHeight: 210, overflowY: "auto" }}>
                  {buscando && contatos.length === 0 ? (
                    <div style={{ padding: "18px", textAlign: "center", fontSize: 12.5, color: "var(--ed2-ink-3)" }}>buscando…</div>
                  ) : contatos.length === 0 ? (
                    <div style={{ padding: "18px", textAlign: "center", fontSize: 12.5, color: contatosErro ? "#c8261c" : "var(--ed2-ink-3)", lineHeight: 1.5 }}>
                      {contatosErro
                        ? `Erro ao buscar contatos (${contatosErro}). Me manda esse texto.`
                        : q.trim()
                          ? "Nenhum contato com esse nome ou número em Leads ou Clientes (só aparecem os que têm telefone salvo)."
                          : "Nenhum contato com número salvo em Leads ou Clientes ainda."}
                    </div>
                  ) : (
                    contatos.map((c, i) => (
                      <button key={i} type="button" onClick={() => escolherContato(c)}
                        style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, width: "100%", boxSizing: "border-box", padding: "9px 12px", borderBottom: i < contatos.length - 1 ? "1px solid var(--ed2-hair)" : "none" }}>
                        <Users size={14} style={{ color: c.origem === "cliente" ? "var(--pill-green-fg)" : "var(--pill-gold-fg)", flexShrink: 0 }} />
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: "block", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nome}</span>
                          <span style={{ display: "block", fontSize: 11.5, color: "var(--ed2-ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.origem === "cliente" ? "Cliente" : "Lead"}{c.detalhe ? ` · ${c.detalhe}` : ""} · +{c.whatsapp}</span>
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          {/* modo */}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => setModo("template")} style={aba(modo === "template")}>Template aprovado</button>
            <button type="button" onClick={() => setModo("texto")} style={aba(modo === "texto")}>Texto livre</button>
          </div>

          {modo === "template" ? (
            <div>
              {tplErro && templates.length === 0 ? (
                <div style={avisoBox}>
                  Nenhum template aprovado disponível ainda{tplErro ? ` (${tplErro})` : ""}. Crie um template no Gerenciador do WhatsApp (categoria Utilidade costuma aprovar rápido) e ele aparece aqui.
                </div>
              ) : (
                <>
                  <label style={rotulo}>Template</label>
                  <select value={tplSel?.name ?? ""} onChange={(e) => { const t = templates.find((x) => x.name === e.target.value); if (t) escolherTpl(t); }} style={campo}>
                    {templates.map((t) => <option key={t.name} value={t.name}>{t.name} ({t.category.toLowerCase()}, {t.language})</option>)}
                  </select>
                  {tplSel && tplSel.varCount > 0 && (
                    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                      {Array.from({ length: tplSel.varCount }).map((_, i) => (
                        <input key={i} value={params[i] ?? ""} onChange={(e) => setParams((p) => { const n = [...p]; n[i] = e.target.value; return n; })}
                          placeholder={`Variável {{${i + 1}}}`} style={campo} />
                      ))}
                    </div>
                  )}
                  {previa && (
                    <div style={{ marginTop: 10, padding: "10px 13px", borderRadius: 12, background: "var(--ed2-surface)", fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{previa}</div>
                  )}
                  {tplSel?.name === "hello_world" && templates.length <= 1 && (
                    <div style={{ ...avisoBox, marginTop: 10 }}>
                      Esse <b>hello_world</b> é só o modelo de teste da Meta, em inglês. Crie um template seu em português no botão abaixo.
                    </div>
                  )}
                </>
              )}

              {/* criar template novo direto daqui */}
              {!criandoTpl ? (
                <button type="button" onClick={() => { setCriandoTpl(true); setTplMsg(null); }}
                  style={{ all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, marginTop: 12, fontSize: 12.5, fontWeight: 650, color: "var(--pill-gold-fg)" }}>
                  <Plus size={14} /> Criar um template em português
                </button>
              ) : (
                <div style={{ marginTop: 12, padding: "14px 15px", borderRadius: 14, background: "var(--ed2-surface)", display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Novo template</div>
                  <input value={tplNome} onChange={(e) => setTplNome(e.target.value)} placeholder="Nome (ex.: primeiro contato)" style={campo} />
                  <select value={tplCategoria} onChange={(e) => setTplCategoria(e.target.value as "UTILITY" | "MARKETING")} style={campo}>
                    <option value="UTILITY">Utilidade (aviso, atendimento) aprova rápido</option>
                    <option value="MARKETING">Marketing (promoção, oferta)</option>
                  </select>
                  <textarea value={tplCorpo} onChange={(e) => setTplCorpo(e.target.value)} rows={3}
                    placeholder="Ex.: Ola {{1}}, aqui e da Endereco Digital. Vi que voce tem interesse em aparecer no Google. Posso te mandar um diagnostico gratuito?"
                    style={{ ...campo, resize: "vertical", minHeight: 70 }} />
                  <div style={{ fontSize: 11.5, color: "var(--ed2-ink-3)", lineHeight: 1.5 }}>Use {"{{1}}"}, {"{{2}}"} pras partes que mudam (nome, cidade). Sem link encurtado e sem promessa exagerada, senão a Meta reprova.</div>
                  {tplMsg && <div style={{ fontSize: 12.5, color: tplMsg.includes("aprovação") ? "#1d8a3a" : "#c8261c" }}>{tplMsg}</div>}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" onClick={criarTemplate} disabled={salvandoTpl}
                      style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 15px", borderRadius: 10, border: "none", cursor: salvandoTpl ? "default" : "pointer", background: "var(--ed2-navy)", color: "#fff", fontSize: 13, fontWeight: 650, opacity: salvandoTpl ? 0.6 : 1 }}>
                      {salvandoTpl ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Enviar pra aprovação
                    </button>
                    <button type="button" onClick={() => setCriandoTpl(false)} style={{ all: "unset", cursor: "pointer", padding: "9px 12px", fontSize: 13, color: "var(--ed2-ink-2)" }}>Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <label style={rotulo}>Mensagem</label>
              <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} placeholder="Escreva a mensagem…" style={{ ...campo, resize: "vertical", minHeight: 70 }} />
              <div style={{ fontSize: 11.5, color: "var(--ed2-ink-3)", marginTop: 5 }}>Texto livre só entrega se o contato te mandou mensagem nas últimas 24h. Se não, use um template.</div>
            </div>
          )}

          {/* IA conduz */}
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "10px 13px", borderRadius: 12, background: "var(--ed2-surface)" }}>
            <input type="checkbox" checked={iaConduz} onChange={(e) => setIaConduz(e.target.checked)} style={{ width: 16, height: 16 }} />
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <Sparkles size={14} style={{ color: "var(--pill-gold-fg)" }} /> Deixar a IA conduzir quando ele responder
            </span>
          </label>

          {erro && <div style={{ fontSize: 12.5, color: "#c8261c" }}>{erro}</div>}

          <button type="button" onClick={enviar} disabled={enviando}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", borderRadius: 13, border: "none", cursor: enviando ? "default" : "pointer", background: "linear-gradient(135deg,#C9A961,#a8893d)", color: "#fff", fontSize: 14, fontWeight: 650, opacity: enviando ? 0.6 : 1 }}>
            {enviando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Enviar e abrir conversa
          </button>
        </div>
      </div>
    </div>
  );
}

const rotulo: React.CSSProperties = { display: "block", fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ed2-ink-3)", marginBottom: 6 };
const campo: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "11px 13px", borderRadius: 12, border: "1px solid var(--ed2-hair)", background: "var(--ed2-surface)", color: "var(--ed2-ink)", fontSize: 13.5, outline: "none" };
const avisoBox: React.CSSProperties = { padding: "12px 14px", borderRadius: 12, background: "rgba(201,169,97,0.10)", fontSize: 12.5, lineHeight: 1.5, color: "var(--ed2-ink-2)" };
function aba(ativo: boolean): React.CSSProperties {
  return { flex: 1, padding: "9px 12px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 650, background: ativo ? "var(--ed2-navy)" : "var(--ed2-surface)", color: ativo ? "#fff" : "var(--ed2-ink-2)" };
}

function btnHeader(bg: string, fg: string): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "8px 13px", borderRadius: 99, border: "none", cursor: "pointer",
    background: bg, color: fg, fontSize: 12.5, fontWeight: 650, flexShrink: 0,
  };
}
