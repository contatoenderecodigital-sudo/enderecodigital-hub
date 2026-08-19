"use client";

import { useEffect, useState } from "react";
import { X, Loader2, Mail, Save, UserCheck, Trash2, Target } from "lucide-react";

function WhatsAppIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0 0 20.464 3.488" />
    </svg>
  );
}
import { LEAD_STATUSES, LEAD_STATUS_LABEL, LEAD_ORIGEM_LABEL, FONTE_TRAFEGO_LABEL, normalizeOrigem, type Lead, type FollowUp, type LeadStatus } from "@/lib/groow/types";
import StatusBadge from "./StatusBadge";

const PLANOS = [
  "Diagnóstico (avulso)",
  "Operação Completa (recorrente)",
  "Retainer mensal",
  "Setup + Retainer",
  "Avulso / Projeto pontual",
];

function ConverterClienteModal({ lead, onClose, onDone }: { lead: Lead; onClose: () => void; onDone: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const payload = {
      lead_id: lead.id,
      empresa: lead.empresa || lead.nome,
      responsavel: lead.nome,
      email: lead.email || "",
      whatsapp: lead.whatsapp || "",
      plano: String(fd.get("plano") || ""),
      valor_mensal: Number(fd.get("valor_mensal") || 0),
      valor_setup: Number(fd.get("valor_setup") || 0),
      inicio_contrato: String(fd.get("inicio_contrato") || ""),
      fim_contrato: String(fd.get("fim_contrato") || "") || null,
      status: "ativo",
      notas: String(fd.get("notas") || ""),
    };
    try {
      const res = await fetch("/api/admin/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Erro");
      onDone();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  };

  const fieldStyle: React.CSSProperties = { display: "block", width: "100%", borderRadius: 10, border: "1px solid rgba(11,24,56,0.12)", background: "var(--ed2-surface-2)", padding: "9px 12px", fontSize: 13, boxSizing: "border-box" };
  const labelStyle: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 600, color: "var(--ed2-ink-2)", marginBottom: 5, letterSpacing: "0.03em" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 70, display: "grid", placeItems: "center", background: "rgba(11,24,56,0.55)", padding: 16 }}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "var(--ed2-card)", borderRadius: 20, boxShadow: "0 24px 60px rgba(0,0,0,0.2)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid var(--ed2-hair)" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em" }}>Converter em cliente</h3>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--ed2-ink-2)" }}>{lead.empresa || lead.nome}</p>
          </div>
          <button type="button" onClick={onClose} style={{ all: "unset", cursor: "pointer", color: "var(--ed2-ink-2)" }}><X size={18} /></button>
        </div>

        <div style={{ padding: "18px 22px", display: "grid", gap: 14 }}>
          <div>
            <label style={labelStyle}>Plano *</label>
            <select name="plano" required style={{ ...fieldStyle, appearance: "auto" }}>
              <option value="">Selecionar plano…</option>
              {PLANOS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Mensal recorrente (R$)</label>
              <input name="valor_mensal" type="number" min="0" step="0.01" defaultValue="0" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>Setup / entrada única (R$)</label>
              <input name="valor_setup" type="number" min="0" step="0.01" defaultValue="0" style={fieldStyle} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Início do contrato *</label>
              <input name="inicio_contrato" type="date" required min="2020-01-01" max="2030-12-31" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>Fim (opcional)</label>
              <input name="fim_contrato" type="date" min="2020-01-01" max="2035-12-31" style={fieldStyle} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Notas</label>
            <textarea name="notas" rows={2} style={{ ...fieldStyle, resize: "vertical", fontFamily: "inherit" }} />
          </div>
        </div>

        {error ? <p style={{ padding: "0 22px", color: "#c8261c", fontSize: 12 }}>{error}</p> : null}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 22px", borderTop: "1px solid var(--ed2-hair)" }}>
          <button type="button" onClick={onClose} style={{ all: "unset", cursor: "pointer", padding: "9px 14px", color: "var(--ed2-ink-2)", fontSize: 13 }}>Cancelar</button>
          <button type="submit" disabled={saving} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#34C759", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <UserCheck size={13} />}
            Criar cliente
          </button>
        </div>
      </form>
    </div>
  );
}

function waLink(num: string) {
  const digits = (num || "").replace(/\D/g, "");
  return `https://wa.me/${digits.startsWith("55") ? digits : `55${digits}`}`;
}

// respostas do quiz vêm como JSON (string) ou já como array, dependendo do driver
function parseRespostas(raw: unknown): { pergunta: string; resposta: string | string[] }[] {
  if (!raw) return [];
  try {
    const v = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(v)) return [];
    return v.filter((x) => x && x.pergunta);
  } catch { return []; }
}

interface Props {
  leadId: number | null;
  onClose: () => void;
  onUpdated: () => void;
}

export default function LeadModal({ leadId, onClose, onUpdated }: Props) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [notas, setNotas] = useState("");
  const [status, setStatus] = useState<LeadStatus>("novo");
  const [newFollow, setNewFollow] = useState({ tipo: "whatsapp" as FollowUp["tipo"], descricao: "" });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>("");
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    if (leadId == null) return;
    setLoading(true);
    setError("");
    fetch(`/api/admin/leads/${leadId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setLead(data.lead);
        setFollowUps(data.follow_ups || []);
        setNotas(data.lead.notas || "");
        setStatus(data.lead.status);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erro"))
      .finally(() => setLoading(false));
  }, [leadId]);

  const save = async (extra: Record<string, unknown> = {}) => {
    if (!lead) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notas, ...extra }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Erro ao salvar");
      onUpdated();
      if (extra.followUp) {
        const reload = await fetch(`/api/admin/leads/${lead.id}`).then((r) => r.json());
        setFollowUps(reload.follow_ups || []);
        setNewFollow({ tipo: "whatsapp", descricao: "" });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  };

  const excluir = async () => {
    if (!lead) return;
    if (!confirm(`Excluir o lead "${lead.nome}"? Essa ação não pode ser desfeita.`)) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || "Erro ao excluir");
      onUpdated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  };

  if (leadId == null) return null;

  return (
    <>
    {converting && lead && (
      <ConverterClienteModal
        lead={lead}
        onClose={() => setConverting(false)}
        onDone={() => { setConverting(false); onUpdated(); }}
      />
    )}
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-navy/10 sticky top-0 bg-white">
          <h2 className="font-display font-semibold text-navy text-lg">Detalhes do lead</h2>
          <button onClick={onClose} className="text-ink/55 hover:text-navy" aria-label="Fechar">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="px-6 py-5">
          {loading ? (
            <div className="grid place-items-center py-12 text-ink/55">
              <Loader2 className="animate-spin" />
            </div>
          ) : error ? (
            <p className="text-red-700 text-sm">{error}</p>
          ) : lead ? (
            <div className="space-y-6">
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <h3 className="font-display font-bold text-navy text-xl">{lead.nome}</h3>
                    <p className="text-ink/70 text-sm">{lead.empresa}</p>
                  </div>
                  <StatusBadge status={lead.status} />
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {(() => {
                    const num = (lead.whatsapp || "").replace(/\D/g, "");
                    if (!num) return null;
                    return (
                      <>
                        <a
                          href={`/operacao/conversas?para=${num}&nome=${encodeURIComponent(lead.nome || "")}`}
                          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs text-emerald-800 hover:bg-emerald-100 transition-colors"
                          title="Abrir conversa no painel (com IA e CRM)"
                        >
                          <WhatsAppIcon size={14} />
                          Conversar no painel
                        </a>
                        <a
                          href={waLink(lead.whatsapp)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-md bg-white border border-emerald-200 px-3 py-1.5 text-xs text-emerald-700 hover:bg-emerald-50 transition-colors"
                          title="Abrir no WhatsApp Web (externo)"
                        >
                          {lead.whatsapp}
                        </a>
                      </>
                    );
                  })()}
                  <a
                    href={`mailto:${lead.email}`}
                    className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs text-blue-800 hover:bg-blue-100 transition-colors"
                  >
                    <Mail size={14} aria-hidden="true" />
                    {lead.email}
                  </a>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-ink/50 text-xs mb-0.5">Faturamento</p>
                  <p className="text-navy">{lead.faturamento || "-"}</p>
                </div>
                <div>
                  <p className="text-ink/50 text-xs mb-0.5">Setor</p>
                  <p className="text-navy">{lead.setor || "-"}</p>
                </div>
                <div>
                  <p className="text-ink/50 text-xs mb-0.5">Origem</p>
                  <p className="text-navy">
                    {LEAD_ORIGEM_LABEL[normalizeOrigem(lead.origem)]}
                    {lead.fonte_trafego ? ` · ${FONTE_TRAFEGO_LABEL[lead.fonte_trafego as keyof typeof FONTE_TRAFEGO_LABEL] ?? lead.fonte_trafego}` : ""}
                  </p>
                </div>
                {lead.site ? (
                  <div>
                    <p className="text-ink/50 text-xs mb-0.5">Site</p>
                    <a href={lead.site.startsWith("http") ? lead.site : `https://${lead.site}`} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline break-all">
                      {lead.site.replace(/^https?:\/\//, "")}
                    </a>
                  </div>
                ) : null}
                {lead.endereco ? (
                  <div className="col-span-2">
                    <p className="text-ink/50 text-xs mb-0.5">Endereço</p>
                    <p className="text-navy">{lead.endereco}</p>
                  </div>
                ) : null}
                {lead.tem_site_proprio === 0 ? (
                  <div className="col-span-2">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-medium text-amber-800">
                      <Target size={13} /> Oportunidade, não tem site próprio
                    </span>
                  </div>
                ) : null}
                <div>
                  <p className="text-ink/50 text-xs mb-0.5">Recebido</p>
                  <p className="text-navy">
                    {new Date(lead.created_at).toLocaleString("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
              </div>

              {lead.mensagem ? (
                <div>
                  <p className="text-ink/50 text-xs mb-1">Mensagem original</p>
                  <p className="text-sm text-ink/85 bg-cream/50 rounded-md px-3 py-2 whitespace-pre-line border border-navy/10">
                    {lead.mensagem}
                  </p>
                </div>
              ) : null}

              {lead.sonho ? (
                <div>
                  <p className="text-ink/50 text-xs mb-1">Sonho / objetivo</p>
                  <p className="text-sm text-navy italic bg-cream/50 rounded-md px-3 py-2 whitespace-pre-line border border-navy/10">
                    &ldquo;{lead.sonho}&rdquo;
                  </p>
                </div>
              ) : null}

              {(() => {
                const quiz = parseRespostas(lead.respostas);
                if (!quiz.length) return null;
                return (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-navy/60 mb-2">Respostas do diagnóstico</p>
                    <div className="flex flex-col gap-2">
                      {quiz.map((q, i) => (
                        <div key={i} className="bg-cream/60 rounded-lg px-3 py-2 border border-navy/5">
                          <p className="text-ink/50 text-xs mb-0.5">{i + 1}. {q.pergunta}</p>
                          <p className="text-sm font-medium text-navy">{Array.isArray(q.resposta) ? q.resposta.join(", ") : q.resposta}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <div>
                <label className="block text-xs font-medium text-ink/70 mb-1.5">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as LeadStatus)}
                  className="block w-full rounded-md border border-navy/15 bg-cream/40 px-3 py-2 text-sm text-ink focus:border-gold focus:bg-white focus:outline-none"
                >
                  {LEAD_STATUSES.map((s) => (
                    <option key={s} value={s}>{LEAD_STATUS_LABEL[s]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink/70 mb-1.5">Notas internas</label>
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  rows={4}
                  className="block w-full rounded-md border border-navy/15 bg-cream/40 px-3 py-2 text-sm text-ink focus:border-gold focus:bg-white focus:outline-none resize-y"
                />
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => save()}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-md bg-navy px-4 py-2 text-sm font-medium text-cream hover:bg-navy-deep transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Salvar
                </button>
                {status === "assinado" && (
                  <button
                    type="button"
                    onClick={() => setConverting(true)}
                    className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white transition-colors"
                    style={{ background: "#34C759" }}
                  >
                    <UserCheck size={14} />
                    Converter em cliente
                  </button>
                )}
                <button
                  type="button"
                  onClick={excluir}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ml-auto"
                  style={{ background: "rgba(255,59,48,0.1)", color: "#c8261c" }}
                >
                  <Trash2 size={14} />
                  Excluir lead
                </button>
              </div>

              <div className="pt-4 border-t border-navy/10">
                <h4 className="font-medium text-navy mb-3">Histórico de follow-ups</h4>
                <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
                  {followUps.length === 0 ? (
                    <p className="text-xs text-ink/55">Sem follow-ups ainda.</p>
                  ) : (
                    followUps.map((f) => (
                      <div key={f.id} className="text-xs border-l-2 border-gold/40 pl-3 py-1">
                        <p className="text-ink/55">
                          {new Date(f.created_at).toLocaleString("pt-BR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}{" "}
                          · <span className="capitalize">{f.tipo}</span>
                        </p>
                        <p className="text-ink/85">{f.descricao}</p>
                        {f.resultado ? (
                          <p className="text-ink/55">{f.resultado}</p>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[120px_1fr_auto] gap-2 items-start">
                  <select
                    value={newFollow.tipo}
                    onChange={(e) => setNewFollow({ ...newFollow, tipo: e.target.value as FollowUp["tipo"] })}
                    className="rounded-md border border-navy/15 bg-cream/40 px-2 py-2 text-xs"
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">Email</option>
                    <option value="telefone">Telefone</option>
                    <option value="reuniao">Reunião</option>
                    <option value="outro">Outro</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Resumo da interação..."
                    value={newFollow.descricao}
                    onChange={(e) => setNewFollow({ ...newFollow, descricao: e.target.value })}
                    className="rounded-md border border-navy/15 bg-cream/40 px-3 py-2 text-xs"
                  />
                  <button
                    onClick={() => save({ followUp: newFollow })}
                    disabled={saving || !newFollow.descricao}
                    className="rounded-md bg-gold px-3 py-2 text-xs font-medium text-navy-deep hover:bg-gold-soft disabled:opacity-50"
                  >
                    Adicionar
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
    </>
  );
}
