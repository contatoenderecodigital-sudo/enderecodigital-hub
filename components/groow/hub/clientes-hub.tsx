"use client";

// Tabela de CLIENTES do hub (tenants do Postgres) no visual GROOW.
// Reusa as server actions de app/operacao/hub/actions.ts.
import { useEffect, useRef, useState } from "react";
import { Search, Plus, MoreHorizontal, Archive, Trash2, Settings, X } from "lucide-react";
import type { Negocio } from "@/lib/types";
import {
  criarClienteAction,
  mudarStatusClienteAction,
  excluirClienteAction,
} from "@/app/operacao/hub/actions";
import SubmitButton from "@/components/groow/hub/submit-button";

type HubMin = { id: string; nome: string; slug: string };

const AV_GRADIENTS = [
  "linear-gradient(135deg,#C9A961,#a8893d)",
  "linear-gradient(135deg,#0B1838,#1d2d56)",
  "linear-gradient(135deg,#34C759,#1d8a3a)",
  "linear-gradient(135deg,#FF9F0A,#c87a00)",
  "linear-gradient(135deg,#5856D6,#3934a3)",
  "linear-gradient(135deg,#0A84FF,#0858b0)",
];
function gradFor(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AV_GRADIENTS[h % AV_GRADIENTS.length];
}
function initials(s: string) {
  return (s || "?").slice(0, 2).toUpperCase();
}

const STATUS_TONE: Record<string, { bg: string; fg: string; dot: string; label: string }> = {
  ativo: { bg: "rgba(52,199,89,0.14)", fg: "#1d8a3a", dot: "#34C759", label: "Ativo" },
  em_configuracao: { bg: "rgba(255,159,10,0.14)", fg: "#a85f00", dot: "#FF9F0A", label: "Em configuração" },
  arquivado: { bg: "var(--ed2-surface)", fg: "var(--ed2-ink-2)", dot: "var(--ed2-ink-3)", label: "Arquivado" },
};

const goldBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 8, background: "#C9A961", color: "#fff",
  border: "none", padding: "12px 20px", borderRadius: 999, fontWeight: 600, fontSize: 14,
  letterSpacing: "-0.005em", cursor: "pointer", boxShadow: "0 4px 12px rgba(201,169,97,0.28)",
};

export default function ClientesHub({ clientes, hubs }: { clientes: Negocio[]; hubs: HubMin[] }) {
  const hubNome = new Map(hubs.map((h) => [h.id, h.nome]));
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("todos");
  const [modalOpen, setModalOpen] = useState(false);
  const openBtnRef = useRef<HTMLButtonElement>(null);
  // Fecha o modal e devolve o foco ao botão que o abriu (acessibilidade).
  const closeModal = () => { setModalOpen(false); openBtnRef.current?.focus(); };

  const filtrados = clientes.filter((c) => {
    if (status !== "todos" && c.status !== status) return false;
    if (q.trim()) {
      const campos = [c.nome, c.nome_fantasia, c.resp_nome, c.resp_email, c.slug]
        .filter(Boolean).join(" ").toLowerCase();
      if (!campos.includes(q.trim().toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24, gap: 24, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 42, fontWeight: 700, letterSpacing: "-0.035em", margin: "0 0 6px", lineHeight: 1.05, color: "var(--ed2-ink)" }}>Clientes</h1>
          <div style={{ color: "var(--ed2-ink-2)", fontSize: 15 }}>
            Tenants deste hub — cada um com seu workspace, integrações e IA.
          </div>
        </div>
        <button ref={openBtnRef} type="button" onClick={() => setModalOpen(true)} style={goldBtn}>
          <Plus size={16} /> Novo cliente
        </button>
      </div>

      {/* TOOLBAR */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--ed2-card)", borderRadius: 999, padding: "11px 18px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", width: 340, maxWidth: "100%", color: "var(--ed2-ink-2)" }}>
          <Search size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por empresa, responsável, e-mail…" style={{ all: "unset", flex: 1, fontSize: 14, color: "var(--ed2-ink)" }} />
        </div>
        <div style={{ display: "inline-flex", background: "var(--ed2-card)", padding: 4, borderRadius: 999, gap: 2, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          {[
            { k: "todos", l: "Todos" },
            { k: "ativo", l: "Ativos" },
            { k: "em_configuracao", l: "Em config." },
            { k: "arquivado", l: "Arquivados" },
          ].map((p) => {
            const on = status === p.k;
            return (
              <button key={p.k} type="button" onClick={() => setStatus(p.k)} style={{ all: "unset", cursor: "pointer", padding: "8px 16px", borderRadius: 999, fontSize: 13, fontWeight: 600, color: on ? "var(--ed2-ink)" : "var(--ed2-ink-2)", background: on ? "var(--ed2-surface)" : "transparent" }}>
                {p.l}
              </button>
            );
          })}
        </div>
      </div>

      {/* TABLE */}
      <div style={{ background: "var(--ed2-card)", borderRadius: 28, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
            <thead>
              <tr>
                <Th first>Empresa</Th><Th>Responsável</Th><Th>Segmento</Th><Th>Status</Th><Th>Workspace</Th><Th>Saúde</Th><Th last></Th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => {
                const tone = STATUS_TONE[c.status] ?? STATUS_TONE.arquivado;
                return (
                  <tr key={c.id} className="hub-row">
                    <Td first>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 99, background: c.marca_cor || gradFor(c.nome), color: "#fff", fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{initials(c.nome_fantasia || c.nome)}</div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontWeight: 600, letterSpacing: "-0.01em" }}>{c.nome_fantasia || c.nome}</span>
                            <span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: "rgba(201,169,97,0.14)", color: "#8a712d" }}>{hubNome.get(c.hub_id) || "hub"}</span>
                            {c.experimental && <span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: "rgba(255,159,10,0.14)", color: "#a85f00" }}>experimental</span>}
                          </div>
                          <div style={{ color: "var(--ed2-ink-2)", fontSize: 12.5, marginTop: 1 }}>{c.nome}</div>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      {c.resp_nome ? (
                        <div>
                          <div>{c.resp_nome}</div>
                          <div style={{ color: "var(--ed2-ink-2)", fontSize: 12.5 }}>{c.resp_email || c.resp_whatsapp || ""}</div>
                        </div>
                      ) : <span style={{ color: "var(--ed2-ink-2)" }}>—</span>}
                    </Td>
                    <Td><span style={{ color: "var(--ed2-ink-2)" }}>{c.segmento || "—"}</span></Td>
                    <Td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: tone.bg, color: tone.fg }}>
                        <span style={{ width: 6, height: 6, borderRadius: 99, background: tone.dot }} />{tone.label}
                      </span>
                    </Td>
                    <Td><span style={{ color: "var(--ed2-ink-2)", fontSize: 13 }}>/{c.slug}</span></Td>
                    <Td>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 70, height: 6, background: "var(--ed2-surface)", borderRadius: 99, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${c.health_score}%`, background: c.health_score >= 70 ? "linear-gradient(90deg,#C9A961,#a8893d)" : "#FF9F0A", borderRadius: 99 }} />
                        </div>
                        <span style={{ fontSize: 12.5, color: "var(--ed2-ink-2)", minWidth: 30 }}>{c.health_score}%</span>
                      </div>
                    </Td>
                    <Td last><RowMenu c={c} /></Td>
                  </tr>
                );
              })}
              {filtrados.length === 0 && (
                <tr><Td first last>
                  <span style={{ color: "var(--ed2-ink-2)" }}>
                    {clientes.length === 0 ? "Nenhum cliente ainda. Clique em Novo cliente." : "Nenhum cliente encontrado."}
                  </span>
                </Td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && <NovoClienteModal hubs={hubs} onClose={closeModal} />}

      <style>{`.hub-row:hover td { background: var(--ed2-surface-2) !important; }`}</style>
    </div>
  );
}

function RowMenu({ c }: { c: Negocio }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-label="Ações" style={{ all: "unset", cursor: "pointer", width: 30, height: 30, borderRadius: 99, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--ed2-ink-2)", background: "var(--ed2-surface)" }}>
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: "var(--ed2-card)", borderRadius: 14, boxShadow: "0 8px 24px rgba(0,0,0,0.14)", border: "1px solid var(--ed2-hair)", minWidth: 210, zIndex: 20, overflow: "hidden", textAlign: "left" }}>
          <form action="/api/impersonar" method="post">
            <input type="hidden" name="negocio_id" value={c.id} />
            <MenuBtn icon={<Settings size={14} />} label="Editar workspace" />
          </form>
          <div style={{ height: 1, background: "var(--ed2-hair)" }} />
          <form action={mudarStatusClienteAction}>
            <input type="hidden" name="negocio_id" value={c.id} />
            <input type="hidden" name="status" value={c.status === "arquivado" ? "ativo" : "arquivado"} />
            <MenuBtn icon={<Archive size={14} />} label={c.status === "arquivado" ? "Reativar" : "Arquivar"} />
          </form>
          <form action={excluirClienteAction} onSubmit={(e) => { if (!confirm("Excluir permanentemente este cliente e todos os dados? Não dá pra desfazer.")) e.preventDefault(); }}>
            <input type="hidden" name="negocio_id" value={c.id} />
            <input type="hidden" name="voltar" value="/operacao/hub/clientes" />
            <MenuBtn icon={<Trash2 size={14} />} label="Excluir permanentemente" danger />
          </form>
        </div>
      )}
    </div>
  );
}

function MenuBtn({ icon, label, danger }: { icon: React.ReactNode; label: string; danger?: boolean }) {
  return (
    <button type="submit" style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500, color: danger ? "#c8261c" : "var(--ed2-ink)", textAlign: "left" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = danger ? "rgba(255,59,48,0.06)" : "var(--ed2-surface-2)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>
      <span style={{ color: danger ? "#c8261c" : "var(--ed2-ink-2)", display: "flex" }}>{icon}</span>{label}
    </button>
  );
}

function Th({ children, first, last }: { children?: React.ReactNode; first?: boolean; last?: boolean }) {
  return <th style={{ textAlign: last ? "right" : "left", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ed2-ink-2)", padding: "16px 14px", paddingLeft: first ? 28 : 14, paddingRight: last ? 28 : 14, background: "var(--ed2-surface-2)", borderBottom: "1px solid var(--ed2-hair)" }}>{children}</th>;
}
function Td({ children, first, last }: { children?: React.ReactNode; first?: boolean; last?: boolean }) {
  return <td style={{ padding: "14px", paddingLeft: first ? 28 : 14, paddingRight: last ? 28 : 14, textAlign: last ? "right" : "left", borderBottom: "1px solid var(--ed2-hair)", fontSize: 14, verticalAlign: "middle" }}>{children}</td>;
}

// ---------------- MODAL: novo cliente ----------------
const iStyle: React.CSSProperties = { display: "block", width: "100%", borderRadius: 12, border: "1px solid var(--ed2-hair)", background: "var(--ed2-surface-2)", padding: "10px 12px", fontSize: 14, boxSizing: "border-box", color: "var(--ed2-ink)" };
const lStyle: React.CSSProperties = { display: "block", fontSize: 11.5, fontWeight: 600, color: "var(--ed2-ink-2)", marginBottom: 6, letterSpacing: "0.02em" };

function NovoClienteModal({ hubs, onClose }: { hubs: HubMin[]; onClose: () => void }) {
  const [exp, setExp] = useState(false);
  // Esc fecha o modal enquanto ele está aberto.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, display: "grid", placeItems: "center", background: "rgba(11,24,56,0.45)", padding: 16 }}>
      <form action={criarClienteAction} onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 640, maxHeight: "90vh", overflowY: "auto", background: "var(--ed2-card)", borderRadius: 24, boxShadow: "0 24px 60px rgba(0,0,0,0.18)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid var(--ed2-hair)", position: "sticky", top: 0, background: "var(--ed2-card)", zIndex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--ed2-ink)" }}>Novo cliente</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" style={{ all: "unset", cursor: "pointer", color: "var(--ed2-ink-2)" }}><X size={20} /></button>
        </div>

        <div style={{ padding: "20px 24px", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={lStyle}>Hub *</label>
            <select name="hub_id" required defaultValue={hubs[0]?.id || ""} style={{ ...iStyle, appearance: "auto" }}>
              {hubs.map((h) => <option key={h.id} value={h.id}>{h.nome} (/{h.slug})</option>)}
            </select>
          </div>

          <div><label style={lStyle}>Nome da empresa *</label><input name="nome" required style={iStyle} /></div>
          <div><label style={lStyle}>Nome comercial</label><input name="nome_fantasia" style={iStyle} /></div>
          <div><label style={lStyle}>Segmento / nicho</label><input name="segmento" placeholder="Ex.: Padaria" style={iStyle} /></div>
          <div><label style={lStyle}>Cor da marca</label><input name="marca_cor" placeholder="#C0392B" style={iStyle} /></div>

          <div><label style={lStyle}>Responsável</label><input name="resp_nome" style={iStyle} /></div>
          <div><label style={lStyle}>Cargo</label><input name="resp_cargo" style={iStyle} /></div>
          <div><label style={lStyle}>E-mail de contato</label><input name="resp_email" type="email" style={iStyle} /></div>
          <div><label style={lStyle}>WhatsApp</label><input name="resp_whatsapp" placeholder="+55 49 99999-9999" style={iStyle} /></div>

          <div><label style={lStyle}>Domínio</label><input name="dominio" placeholder="empresa.com.br" style={iStyle} /></div>
          <div><label style={lStyle}>Site atual (URL)</label><input name="site_url" placeholder="https://..." style={iStyle} /></div>

          <div>
            <label style={lStyle}>Status inicial</label>
            <select name="status" defaultValue="ativo" style={{ ...iStyle, appearance: "auto" }}>
              <option value="ativo">Ativo</option>
              <option value="em_configuracao">Em configuração</option>
              <option value="arquivado">Arquivado</option>
            </select>
          </div>
          <div>
            <label style={lStyle}>Assistente de IA</label>
            <select name="ia_modo" defaultValue="api_plataforma" style={{ ...iStyle, appearance: "auto" }}>
              <option value="api_plataforma">IA da plataforma (recomendado)</option>
              <option value="claude_cliente">Claude do cliente</option>
              <option value="sem_ia">Sem IA</option>
            </select>
          </div>

          <div><label style={lStyle}>Health Score (0-100)</label><input name="health_score" type="number" min={0} max={100} defaultValue={100} style={iStyle} /></div>

          <label style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 14, background: "var(--ed2-surface-2)", cursor: "pointer" }}>
            <input type="checkbox" name="experimental" checked={exp} onChange={(e) => setExp(e.target.checked)} style={{ accentColor: "#C9A961", width: 16, height: 16 }} />
            <span>
              <span style={{ fontWeight: 600, fontSize: 13, color: "var(--ed2-ink)" }}>Cliente experimental</span>
              <span style={{ display: "block", fontSize: 12, color: "var(--ed2-ink-2)" }}>Sem login — só você acessa pelo painel.</span>
            </span>
          </label>

          {!exp && (
            <>
              <div><label style={lStyle}>E-mail de login</label><input name="email" type="email" placeholder="cliente@empresa.com" style={iStyle} /></div>
              <div><label style={lStyle}>Senha inicial</label><input name="senha" type="text" placeholder="mín. 8 caracteres" style={iStyle} /></div>
            </>
          )}

          <div style={{ gridColumn: "1 / -1" }}><label style={lStyle}>Observações internas</label><textarea name="observacoes" rows={3} style={{ ...iStyle, resize: "vertical", fontFamily: "inherit" }} /></div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "16px 24px", borderTop: "1px solid var(--ed2-hair)" }}>
          <button type="button" onClick={onClose} style={{ all: "unset", cursor: "pointer", padding: "10px 16px", color: "var(--ed2-ink-2)", fontSize: 13 }}>Cancelar</button>
          <SubmitButton style={{ ...goldBtn, padding: "10px 18px", fontSize: 13 }} pendingLabel="Criando…">Criar cadastro</SubmitButton>
        </div>
      </form>
    </div>
  );
}
