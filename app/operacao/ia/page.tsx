"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Bot, Wallet, Activity, AlertTriangle, RefreshCw, X, ArrowDownToLine, ArrowUpFromLine, Globe, Clock, Cpu, MessageSquare, UserCheck, Zap } from "lucide-react";
import { custoEmReais, detalharCusto, brl } from "@/lib/groow/custo-ia";

interface Resumo { chamadas: number; custo: number }
interface Modulo { modulo: string; chamadas: number; custo: number; erros: number }
interface Atendimento {
  conversas: number; comIA: number; handoffs: number; resolvidasSozinha: number;
  taxaResolucao: number; taxaHandoff: number; msgsIA: number; msgsCliente: number;
  tempoRespostaMs: number; custoAtendimentoUsd: number;
}
interface LogIA {
  id: number; modulo: string; acao: string; modelo: string;
  input_tokens: number; output_tokens: number; buscas_web: number;
  custo_usd: string | number; duracao_ms: number; status: "ok" | "erro"; detalhe: string; quando: string;
}

const MODULO_LABEL: Record<string, { label: string; bg: string; fg: string }> = {
  blog: { label: "Blog SEO", bg: "rgba(201,169,97,0.14)", fg: "var(--pill-gold-fg)" },
  social: { label: "Social", bg: "rgba(175,82,222,0.12)", fg: "var(--pill-purple-fg)" },
  "email-prospeccao": { label: "Email", bg: "rgba(10,132,255,0.10)", fg: "var(--pill-blue-fg)" },
};

const cardStyle: React.CSSProperties = { background: "var(--ed2-card)", borderRadius: 22, padding: "18px 20px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" };

function fmtDuracao(ms: number): string {
  if (!ms) return "";
  return ms >= 1000 ? `${(ms / 1000).toFixed(ms >= 10000 ? 0 : 1)}s` : `${ms}ms`;
}

export default function IAPage() {
  const [hoje, setHoje] = useState<Resumo | null>(null);
  const [mes, setMes] = useState<Resumo | null>(null);
  const [porModulo, setPorModulo] = useState<Modulo[]>([]);
  const [logs, setLogs] = useState<LogIA[]>([]);
  const [atendimento, setAtendimento] = useState<Atendimento | null>(null);
  const [loading, setLoading] = useState(true);
  const [detalhe, setDetalhe] = useState<LogIA | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ia");
      const d = await res.json();
      if (!d.error) { setHoje(d.hoje); setMes(d.mes); setPorModulo(d.porModulo || []); setLogs(d.logs || []); setAtendimento(d.atendimento ?? null); }
    } catch { /* */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const erros30d = porModulo.reduce((s, m) => s + Number(m.erros), 0);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 42, fontWeight: 700, letterSpacing: "-0.035em", margin: "0 0 6px", lineHeight: 1.05 }}>IA &amp; Custos</h1>
          <div style={{ color: "var(--ed2-ink-2)", fontSize: 15 }}>Cada chamada da IA registrada: o que ela fez, quanto tempo levou e quanto custou</div>
        </div>
        <button type="button" onClick={load} disabled={loading}
          style={{ all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 999, fontSize: 13, fontWeight: 600, background: "var(--ed2-card)", color: "var(--ed2-ink)", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" } as React.CSSProperties}>
          <RefreshCw size={14} className={loading ? "animate-spin" : undefined} /> Atualizar
        </button>
      </div>

      {loading && !logs.length ? (
        <div style={{ display: "grid", placeItems: "center", padding: "60px 0" }}><Loader2 className="animate-spin" style={{ color: "var(--ed2-ink-3)" }} /></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
            {[
              { icone: Wallet, label: "Gasto hoje", valor: custoEmReais(hoje?.custo) || "R$ 0,00", cor: "var(--pill-gold-fg)", bg: "rgba(201,169,97,0.14)" },
              { icone: Wallet, label: "Últimos 30 dias", valor: custoEmReais(mes?.custo) || "R$ 0,00", cor: "var(--pill-green-fg)", bg: "rgba(52,199,89,0.12)" },
              { icone: Activity, label: "Chamadas em 30 dias", valor: String(mes?.chamadas ?? 0), cor: "var(--pill-blue-fg)", bg: "rgba(10,132,255,0.10)" },
              { icone: AlertTriangle, label: "Erros em 30 dias", valor: String(erros30d), cor: erros30d ? "var(--pill-red-fg)" : "var(--ed2-ink-3)", bg: erros30d ? "rgba(255,59,48,0.10)" : "var(--ed2-surface)" },
            ].map((c) => {
              const Icone = c.icone;
              return (
                <div key={c.label} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 13, background: c.bg, color: c.cor, display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <Icone size={19} strokeWidth={1.8} aria-hidden />
                  </div>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1 }}>{c.valor}</div>
                    <div style={{ fontSize: 12, color: "var(--ed2-ink-2)", marginTop: 4 }}>{c.label}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* atendimento IA no WhatsApp */}
          {atendimento && atendimento.comIA > 0 && (
            <div style={{ ...cardStyle, padding: "20px 22px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 16 }}>
                <MessageSquare size={16} style={{ color: "var(--pill-gold-fg)" }} aria-hidden />
                <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 700 }}>Atendimento no WhatsApp</h2>
                <span style={{ fontSize: 12, color: "var(--ed2-ink-3)" }}>o quanto a IA resolve sozinha</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
                {/* hero: taxa de resolução */}
                <div style={{ gridColumn: "span 1" }}>
                  <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--pill-green-fg)", lineHeight: 1 }}>{atendimento.taxaResolucao}%</div>
                  <div style={{ fontSize: 12.5, color: "var(--ed2-ink-2)", marginTop: 6, display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Zap size={13} style={{ color: "var(--pill-green-fg)" }} /> resolvidas só pela IA
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--ed2-ink-3)", marginTop: 3 }}>{atendimento.resolvidasSozinha} de {atendimento.comIA} conversas, sem precisar de você</div>
                </div>
                {[
                  { Icone: MessageSquare, valor: String(atendimento.comIA), label: "conversas atendidas pela IA", cor: "var(--pill-blue-fg)" },
                  { Icone: UserCheck, valor: `${atendimento.taxaHandoff}%`, label: `passaram pra humano (${atendimento.handoffs})`, cor: "var(--pill-gold-fg)" },
                  { Icone: Clock, valor: atendimento.tempoRespostaMs >= 1000 ? `${(atendimento.tempoRespostaMs / 1000).toFixed(1)}s` : `${atendimento.tempoRespostaMs}ms`, label: "tempo médio de resposta", cor: "var(--pill-blue-fg)" },
                  { Icone: Wallet, valor: custoEmReais(atendimento.custoAtendimentoUsd) || "R$ 0,00", label: "custo total do atendimento", cor: "var(--pill-gold-fg)" },
                ].map((m) => {
                  const Icone = m.Icone;
                  return (
                    <div key={m.label}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1 }}>
                        <Icone size={15} style={{ color: m.cor }} aria-hidden /> {m.valor}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--ed2-ink-2)", marginTop: 6 }}>{m.label}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--ed2-hair)", fontSize: 12.5, color: "var(--ed2-ink-2)", lineHeight: 1.5 }}>
                A IA respondeu <b style={{ color: "var(--ed2-ink)" }}>{Number(atendimento.msgsIA).toLocaleString("pt-BR")}</b> mensagens pra <b style={{ color: "var(--ed2-ink)" }}>{Number(atendimento.msgsCliente).toLocaleString("pt-BR")}</b> do cliente.
                {atendimento.custoAtendimentoUsd > 0 && atendimento.comIA > 0 && (
                  <> Sai a <b style={{ color: "var(--ed2-ink)" }}>{custoEmReais(atendimento.custoAtendimentoUsd / atendimento.comIA) || "menos de R$ 0,01"}</b> por conversa atendida.</>
                )}
              </div>
            </div>
          )}

          {/* cérebro da IA (base de conhecimento) */}
          <BaseConhecimentoCard />

          {/* follow-up automático */}
          <FollowupCard />

          {/* por módulo */}
          {porModulo.length > 0 && (
            <div style={{ ...cardStyle, padding: "18px 22px" }}>
              <h2 style={{ margin: "0 0 12px", fontSize: 15.5, fontWeight: 700 }}>Custo por módulo (30 dias)</h2>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {porModulo.map((m) => {
                  const meta = MODULO_LABEL[m.modulo] ?? { label: m.modulo, bg: "var(--ed2-surface)", fg: "var(--ed2-ink-2)" };
                  return (
                    <span key={m.modulo} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 12, background: meta.bg, color: meta.fg, fontSize: 12.5, fontWeight: 700 }}>
                      {meta.label}
                      <span style={{ fontWeight: 600, opacity: 0.85 }}>{m.chamadas} chamada{Number(m.chamadas) === 1 ? "" : "s"} · {custoEmReais(m.custo) || "R$ 0,00"}{Number(m.erros) > 0 ? ` · ${m.erros} erro${Number(m.erros) === 1 ? "" : "s"}` : ""}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* tabela de chamadas */}
          <div style={{ background: "var(--ed2-card)", borderRadius: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden" }}>
            <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--ed2-hair)", display: "flex", alignItems: "center", gap: 9 }}>
              <Bot size={16} style={{ color: "var(--pill-gold-fg)" }} aria-hidden />
              <span style={{ fontWeight: 700, fontSize: 14.5 }}>Últimas chamadas</span>
              <span style={{ fontSize: 12, color: "var(--ed2-ink-3)", fontWeight: 500 }}>toque numa linha pra ver de onde veio o custo</span>
            </div>
            {logs.length === 0 ? (
              <div style={{ padding: "44px 24px", textAlign: "center", color: "var(--ed2-ink-2)", fontSize: 14 }}>
                Nenhuma chamada registrada ainda. A partir de agora, toda geração (blog, social, email) aparece aqui.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: "left", color: "var(--ed2-ink-2)", fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      <th style={{ padding: "10px 14px 10px 22px", fontWeight: 600 }}>Quando</th>
                      <th style={{ padding: "10px 14px", fontWeight: 600 }}>Módulo</th>
                      <th style={{ padding: "10px 14px", fontWeight: 600 }}>O que fez</th>
                      <th style={{ padding: "10px 14px", fontWeight: 600, textAlign: "right" }}>Tokens (in/out)</th>
                      <th style={{ padding: "10px 14px", fontWeight: 600, textAlign: "right" }}>Buscas</th>
                      <th style={{ padding: "10px 14px", fontWeight: 600, textAlign: "right" }}>Tempo</th>
                      <th style={{ padding: "10px 14px", fontWeight: 600, textAlign: "right" }}>Custo</th>
                      <th style={{ padding: "10px 22px 10px 14px", fontWeight: 600 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((l) => {
                      const meta = MODULO_LABEL[l.modulo] ?? { label: l.modulo, bg: "var(--ed2-surface)", fg: "var(--ed2-ink-2)" };
                      return (
                        <tr key={l.id} onClick={() => setDetalhe(l)} className="ia-linha"
                          style={{ borderTop: "1px solid var(--ed2-hair)", cursor: "pointer" }}>
                          <td style={{ padding: "11px 14px 11px 22px", whiteSpace: "nowrap", color: "var(--ed2-ink-2)" }}>{l.quando}</td>
                          <td style={{ padding: "11px 14px" }}>
                            <span style={{ padding: "3px 10px", borderRadius: 99, fontSize: 11.5, fontWeight: 700, background: meta.bg, color: meta.fg, whiteSpace: "nowrap" }}>{meta.label}</span>
                          </td>
                          <td style={{ padding: "11px 14px", maxWidth: 340 }}>
                            <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.acao || "-"}</div>
                          </td>
                          <td style={{ padding: "11px 14px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--ed2-ink-2)", whiteSpace: "nowrap" }}>
                            {Number(l.input_tokens).toLocaleString("pt-BR")} / {Number(l.output_tokens).toLocaleString("pt-BR")}
                          </td>
                          <td style={{ padding: "11px 14px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--ed2-ink-2)" }}>{l.buscas_web || "-"}</td>
                          <td style={{ padding: "11px 14px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--ed2-ink-2)" }}>{fmtDuracao(Number(l.duracao_ms))}</td>
                          <td style={{ padding: "11px 14px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: "var(--pill-gold-fg)", whiteSpace: "nowrap" }}>{custoEmReais(l.custo_usd) || "R$ 0,00"}</td>
                          <td style={{ padding: "11px 22px 11px 14px" }}>
                            <span style={{ padding: "3px 10px", borderRadius: 99, fontSize: 11.5, fontWeight: 700, background: l.status === "ok" ? "rgba(52,199,89,0.12)" : "rgba(255,59,48,0.10)", color: l.status === "ok" ? "var(--pill-green-fg)" : "var(--pill-red-fg)" }}>
                              {l.status === "ok" ? "ok" : `erro${l.detalhe ? ` (${l.detalhe})` : ""}`}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {detalhe && <ModalDetalhe log={detalhe} onClose={() => setDetalhe(null)} />}

      <style>{`
        .ia-linha:hover { background: var(--ed2-surface); }
      `}</style>
    </div>
  );
}

// ── Follow-up automático: a IA reengaja o lead que parou de responder ─────────
function FollowupCard() {
  const [ativo, setAtivo] = useState(false);
  const [intervalos, setIntervalos] = useState<number[]>([4, 12]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/admin/ia/followup");
        const d = await r.json();
        setAtivo(Boolean(d.ativo));
        if (Array.isArray(d.intervalos) && d.intervalos.length) setIntervalos(d.intervalos);
      } catch { /* */ } finally { setCarregando(false); }
    })();
  }, []);

  const salvar = async (novoAtivo = ativo, novosIntervalos = intervalos) => {
    setSalvando(true); setSalvo(false);
    try {
      const r = await fetch("/api/admin/ia/followup", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ativo: novoAtivo, intervalos: novosIntervalos }) });
      if (r.ok) { setSalvo(true); setTimeout(() => setSalvo(false), 2500); }
    } finally { setSalvando(false); }
  };

  const toggle = () => { const v = !ativo; setAtivo(v); salvar(v, intervalos); };
  const setHora = (i: number, val: number) => { const n = [...intervalos]; n[i] = Math.max(1, Math.min(24, val || 1)); setIntervalos(n); };
  const addToque = () => { if (intervalos.length < 4) setIntervalos([...intervalos, 12]); };
  const removeToque = (i: number) => setIntervalos(intervalos.filter((_, j) => j !== i));

  if (carregando) return null;

  return (
    <div style={{ ...cardStyle, padding: "18px 22px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Zap size={16} style={{ color: "var(--pill-gold-fg)" }} aria-hidden />
        <div style={{ flex: 1, minWidth: 180 }}>
          <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 700 }}>Follow-up automático</h2>
          <div style={{ fontSize: 12.5, color: "var(--ed2-ink-2)", marginTop: 2 }}>
            A IA reengaja sozinha o lead que parou de responder. Para quando ele responde ou vira cliente.
          </div>
        </div>
        <button type="button" onClick={toggle} disabled={salvando}
          aria-label={ativo ? "Desligar" : "Ligar"}
          style={{ position: "relative", width: 48, height: 28, borderRadius: 99, border: "none", cursor: "pointer", background: ativo ? "#34C759" : "var(--ed2-hair)", transition: "background 0.15s", flexShrink: 0 }}>
          <span style={{ position: "absolute", top: 3, left: ativo ? 23 : 3, width: 22, height: 22, borderRadius: 99, background: "#fff", transition: "left 0.15s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
        </button>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: ativo ? "#1d8a3a" : "var(--ed2-ink-3)", minWidth: 58 }}>{ativo ? "Ligado" : "Desligado"}</span>
      </div>

      <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--ed2-hair)" }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ed2-ink-3)", marginBottom: 10 }}>Cadência (horas de silêncio pra cada toque)</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {intervalos.map((h, i) => (
            <div key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 10px 7px 13px", borderRadius: 12, background: "var(--ed2-surface)", border: "1px solid var(--ed2-hair)" }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--pill-gold-fg)" }}>{i + 1}º</span>
              <input type="number" min={1} max={24} value={h} onChange={(e) => setHora(i, parseInt(e.target.value, 10))}
                style={{ width: 42, border: "none", background: "transparent", color: "var(--ed2-ink)", fontSize: 13.5, fontWeight: 600, outline: "none", textAlign: "right" }} />
              <span style={{ fontSize: 12.5, color: "var(--ed2-ink-2)" }}>h</span>
              {intervalos.length > 1 && (
                <button type="button" onClick={() => removeToque(i)} aria-label="Remover" style={{ all: "unset", cursor: "pointer", color: "var(--ed2-ink-3)", marginLeft: 2, display: "inline-flex" }}><X size={13} /></button>
              )}
            </div>
          ))}
          {intervalos.length < 4 && (
            <button type="button" onClick={addToque} style={{ all: "unset", cursor: "pointer", fontSize: 12.5, fontWeight: 650, color: "var(--pill-gold-fg)", padding: "8px 6px" }}>+ toque</button>
          )}
          <button type="button" onClick={() => salvar()} disabled={salvando}
            style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 11, border: "none", cursor: salvando ? "default" : "pointer", background: salvo ? "#34C759" : "var(--ed2-navy)", color: "#fff", fontSize: 13, fontWeight: 650, opacity: salvando ? 0.6 : 1 }}>
            {salvando ? <Loader2 size={13} className="animate-spin" /> : null}{salvo ? "Salvo" : "Salvar cadência"}
          </button>
        </div>
        <div style={{ fontSize: 12, color: "var(--ed2-ink-3)", marginTop: 12, lineHeight: 1.5 }}>
          Ex.: 4h e 12h = a IA cutuca 4h depois do cliente sumir e, se continuar quieto, mais uma vez. Só envia dentro das 24h da última mensagem dele (regra da Meta), e nunca cutuca quem você assumiu.
        </div>
      </div>
    </div>
  );
}

// ── Cérebro da IA: base de conhecimento que a atendente usa pra responder ──────
function BaseConhecimentoCard() {
  const [conteudo, setConteudo] = useState("");
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/admin/ia/base");
        const d = await r.json();
        setConteudo(d.conteudo ?? "");
      } catch { /* */ } finally { setCarregando(false); }
    })();
  }, []);

  const salvar = async () => {
    setSalvando(true); setSalvo(false);
    try {
      const r = await fetch("/api/admin/ia/base", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conteudo }) });
      if (r.ok) { setSalvo(true); setTimeout(() => setSalvo(false), 2500); }
    } finally { setSalvando(false); }
  };

  const preenchido = conteudo.trim().length > 0;

  return (
    <div style={{ ...cardStyle, padding: "18px 22px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Cpu size={16} style={{ color: "var(--pill-gold-fg)" }} aria-hidden />
        <div style={{ flex: 1, minWidth: 180 }}>
          <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 700 }}>Cérebro da IA</h2>
          <div style={{ fontSize: 12.5, color: "var(--ed2-ink-2)", marginTop: 2 }}>
            O que a IA sabe do negócio pra responder o cliente: serviços, preços, horário, formas de pagamento, regras.
          </div>
        </div>
        {!carregando && (
          <span style={{ fontSize: 11.5, fontWeight: 700, padding: "4px 11px", borderRadius: 99, background: preenchido ? "var(--ed2-green-soft)" : "var(--ed2-surface)", color: preenchido ? "#1d8a3a" : "var(--ed2-ink-3)" }}>
            {preenchido ? "configurado" : "vazio"}
          </span>
        )}
        <button type="button" onClick={() => setAberto((v) => !v)}
          style={{ all: "unset", cursor: "pointer", fontSize: 12.5, fontWeight: 650, color: "var(--pill-gold-fg)", padding: "6px 8px" }}>
          {aberto ? "Fechar" : preenchido ? "Editar" : "Preencher"}
        </button>
      </div>

      {aberto && (
        <div style={{ marginTop: 14 }}>
          <textarea
            value={conteudo}
            onChange={(e) => setConteudo(e.target.value)}
            rows={10}
            placeholder={"Ex.:\nSomos a Padaria Doce Pão. Horário: seg a sáb, 6h às 20h.\nEncomenda de bolo: pedir com 24h de antecedência.\nPagamento: Pix, débito, crédito e dinheiro.\nBolo no pote R$ 12, bolo aniversário a partir de R$ 80.\nEntrega: bairro centro grátis acima de R$ 50."}
            style={{ width: "100%", boxSizing: "border-box", padding: "13px 15px", borderRadius: 14, border: "1px solid var(--ed2-hair)", background: "var(--ed2-surface)", color: "var(--ed2-ink)", fontSize: 13.5, lineHeight: 1.55, outline: "none", resize: "vertical", minHeight: 160, fontFamily: "inherit" }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={salvar} disabled={salvando}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 12, border: "none", cursor: salvando ? "default" : "pointer", background: salvo ? "#34C759" : "var(--ed2-navy)", color: "#fff", fontSize: 13.5, fontWeight: 650, opacity: salvando ? 0.6 : 1 }}>
              {salvando ? <Loader2 size={14} className="animate-spin" /> : salvo ? <Bot size={14} /> : null}
              {salvando ? "Salvando..." : salvo ? "IA atualizada" : "Salvar cérebro"}
            </button>
            <span style={{ fontSize: 12, color: "var(--ed2-ink-3)", lineHeight: 1.5 }}>
              A IA passa a usar isso na hora, em toda conversa. Quanto mais enxuto e direto, menos token gasta.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Detalhe de uma chamada: mostra de ONDE veio o custo (entrada x saída x busca) ──
function ModalDetalhe({ log, onClose }: { log: LogIA; onClose: () => void }) {
  const modelo = log.modelo || "claude-sonnet-5";
  const inTok = Number(log.input_tokens) || 0;
  const outTok = Number(log.output_tokens) || 0;
  const buscas = Number(log.buscas_web) || 0;
  const d = detalharCusto(inTok, outTok, buscas, modelo);
  const totalBrl = d.inputBrl + d.outputBrl + d.buscaBrl;
  const pct = (v: number) => (totalBrl > 0 ? Math.round((v / totalBrl) * 100) : 0);
  const meta = MODULO_LABEL[log.modulo] ?? { label: log.modulo, bg: "var(--ed2-surface)", fg: "var(--ed2-ink-2)" };

  const linhas = [
    { icone: ArrowDownToLine, cor: "var(--pill-blue-fg)", bg: "rgba(10,132,255,0.10)", nome: "Entrada (o que a IA leu)",
      detalhe: `${inTok.toLocaleString("pt-BR")} tokens x US$ ${d.precoInputMtok}/milhão`, brl: d.inputBrl },
    { icone: ArrowUpFromLine, cor: "var(--pill-gold-fg)", bg: "rgba(201,169,97,0.14)", nome: "Saída (o que a IA escreveu)",
      detalhe: `${outTok.toLocaleString("pt-BR")} tokens x US$ ${d.precoOutputMtok}/milhão`, brl: d.outputBrl },
    ...(buscas > 0 ? [{ icone: Globe, cor: "var(--pill-purple-fg)", bg: "rgba(175,82,222,0.12)", nome: "Busca na web",
      detalhe: `${buscas} busca${buscas === 1 ? "" : "s"} x US$ 0,01 cada`, brl: d.buscaBrl }] : []),
  ];
  // maior ofensor primeiro, pra saltar aos olhos onde foi o dinheiro
  const ordenadas = [...linhas].sort((a, b) => b.brl - a.brl);

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(11,24,56,0.42)", backdropFilter: "blur(2px)", display: "grid", placeItems: "center", padding: 18 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "min(560px, 100%)", maxHeight: "90vh", overflowY: "auto", background: "var(--ed2-card)", borderRadius: 24, boxShadow: "0 24px 70px rgba(0,0,0,0.28)" }}>
        {/* cabeçalho */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--ed2-hair)", display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
              <span style={{ padding: "3px 10px", borderRadius: 99, fontSize: 11.5, fontWeight: 700, background: meta.bg, color: meta.fg }}>{meta.label}</span>
              <span style={{ fontSize: 12.5, color: "var(--ed2-ink-3)" }}>{log.quando}</span>
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.25 }}>{log.acao || "Chamada de IA"}</div>
          </div>
          <button type="button" onClick={onClose}
            style={{ all: "unset", cursor: "pointer", width: 32, height: 32, borderRadius: 10, display: "grid", placeItems: "center", background: "var(--ed2-surface)", color: "var(--ed2-ink-2)", flexShrink: 0 }}>
            <X size={16} />
          </button>
        </div>

        {/* total + modelo/tempo */}
        <div style={{ padding: "20px 24px 6px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--pill-gold-fg)" }}>{brl(totalBrl)}</div>
            <div style={{ fontSize: 13, color: "var(--ed2-ink-2)" }}>custo total desta chamada</div>
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 12 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--ed2-ink-2)" }}>
              <Cpu size={13} /> Modelo: <b style={{ color: "var(--ed2-ink)" }}>{modelo}</b>
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--ed2-ink-2)" }}>
              <Clock size={13} /> Levou <b style={{ color: "var(--ed2-ink)" }}>{fmtDuracao(Number(log.duracao_ms))}</b>
            </span>
          </div>
        </div>

        {/* quebra do custo */}
        <div style={{ padding: "16px 24px 8px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ed2-ink-3)", fontWeight: 700 }}>De onde veio o custo</div>
          {ordenadas.map((li) => {
            const Icone = li.icone;
            return (
              <div key={li.nome} style={{ display: "flex", alignItems: "center", gap: 13 }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: li.bg, color: li.cor, display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <Icone size={17} strokeWidth={1.9} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{li.nome}</div>
                  <div style={{ fontSize: 12, color: "var(--ed2-ink-2)", marginTop: 1 }}>{li.detalhe}</div>
                  {/* barra proporcional */}
                  <div style={{ height: 5, borderRadius: 99, background: "var(--ed2-surface)", marginTop: 6, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct(li.brl)}%`, background: li.cor, borderRadius: 99 }} />
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{brl(li.brl)}</div>
                  <div style={{ fontSize: 11.5, color: "var(--ed2-ink-3)" }}>{pct(li.brl)}%</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* rodapé: erro ou explicação */}
        <div style={{ padding: "12px 24px 22px" }}>
          {log.status === "erro" ? (
            <div style={{ padding: "12px 14px", borderRadius: 13, background: "rgba(255,59,48,0.08)", color: "var(--pill-red-fg)", fontSize: 12.5, display: "flex", gap: 8, alignItems: "flex-start" }}>
              <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>Esta chamada deu erro{log.detalhe ? `: ${log.detalhe}` : ""}. Normalmente não gera custo, mas fica registrada pra você saber que a IA tentou e falhou.</span>
            </div>
          ) : buscas > 0 ? (
            <div style={{ padding: "12px 14px", borderRadius: 13, background: "rgba(175,82,222,0.07)", color: "var(--ed2-ink-2)", fontSize: 12.5 }}>
              O que pesa aqui é a <b>busca na web</b>: cada resultado que a IA lê vira token de entrada e é recontado a cada rodada. É por isso que artigo com pesquisa web custa muito mais que artigo sem.
            </div>
          ) : (
            <div style={{ padding: "12px 14px", borderRadius: 13, background: "var(--ed2-surface)", color: "var(--ed2-ink-2)", fontSize: 12.5 }}>
              Regra simples: <b>entrada</b> é tudo que a IA leu (instruções, histórico, contexto do cliente), <b>saída</b> é o texto que ela escreveu. Saída custa mais caro por token, mas costuma ser bem menor que a entrada.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
