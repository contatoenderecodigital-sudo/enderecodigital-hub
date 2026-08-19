"use client";

// Tabela de WORKSPACES do hub no visual GROOW. Reusa as server actions do hub.
import { useEffect, useRef, useState } from "react";
import { Search, MoreHorizontal, Archive, Trash2, Settings, Globe } from "lucide-react";
import { mudarStatusClienteAction, excluirClienteAction } from "@/app/operacao/hub/actions";

export interface WsRow {
  id: string;
  nome: string;
  nome_fantasia: string | null;
  slug: string;
  marca_cor: string | null;
  status: string;
  health_score: number;
  resp_nome: string | null;
  dominio: string | null;
  site_url: string | null;
  hub_nome: string;
}

const STATUS_TONE: Record<string, { bg: string; fg: string; dot: string; label: string }> = {
  ativo: { bg: "rgba(52,199,89,0.14)", fg: "#1d8a3a", dot: "#34C759", label: "Ativo" },
  em_configuracao: { bg: "rgba(255,159,10,0.14)", fg: "#a85f00", dot: "#FF9F0A", label: "Em configuração" },
  arquivado: { bg: "var(--ed2-surface)", fg: "var(--ed2-ink-2)", dot: "var(--ed2-ink-3)", label: "Arquivado" },
};

function initials(s: string) { return (s || "?").slice(0, 2).toUpperCase(); }

export default function WorkspacesHub({ items }: { items: WsRow[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("todos");

  const filtrados = items.filter((w) => {
    if (status !== "todos" && w.status !== status) return false;
    if (q.trim()) {
      const campos = [w.nome, w.nome_fantasia, w.slug, w.dominio, w.hub_nome].filter(Boolean).join(" ").toLowerCase();
      if (!campos.includes(q.trim().toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--ed2-card)", borderRadius: 999, padding: "11px 18px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", width: 340, maxWidth: "100%", color: "var(--ed2-ink-2)" }}>
          <Search size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, slug, cliente ou domínio…" style={{ all: "unset", flex: 1, fontSize: 14, color: "var(--ed2-ink)" }} />
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
              <button key={p.k} type="button" onClick={() => setStatus(p.k)} style={{ all: "unset", cursor: "pointer", padding: "8px 16px", borderRadius: 999, fontSize: 13, fontWeight: 600, color: on ? "var(--ed2-ink)" : "var(--ed2-ink-2)", background: on ? "var(--ed2-surface)" : "transparent" }}>{p.l}</button>
            );
          })}
        </div>
      </div>

      <div style={{ background: "var(--ed2-card)", borderRadius: 28, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
            <thead>
              <tr><Th first>Workspace</Th><Th>Cliente</Th><Th>Domínio</Th><Th>Status</Th><Th>Saúde</Th><Th last></Th></tr>
            </thead>
            <tbody>
              {filtrados.map((w) => {
                const tone = STATUS_TONE[w.status] ?? STATUS_TONE.arquivado;
                return (
                  <tr key={w.id} className="hub-row">
                    <Td first>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 99, background: w.marca_cor || "#C9A961", color: "#fff", fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{initials(w.nome_fantasia || w.nome)}</div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, letterSpacing: "-0.01em" }}>{w.nome_fantasia || w.nome}</div>
                          <div style={{ color: "var(--ed2-ink-2)", fontSize: 12.5 }}>/{w.slug}</div>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <div>{w.nome}</div>
                      <div style={{ color: "var(--ed2-ink-2)", fontSize: 12.5 }}>{w.resp_nome || w.hub_nome}</div>
                    </Td>
                    <Td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "var(--ed2-ink-2)", fontSize: 13 }}>
                        <Globe size={14} />{w.dominio || w.site_url || "—"}
                      </span>
                    </Td>
                    <Td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: tone.bg, color: tone.fg }}>
                        <span style={{ width: 6, height: 6, borderRadius: 99, background: tone.dot }} />{tone.label}
                      </span>
                    </Td>
                    <Td>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 80, height: 6, background: "var(--ed2-surface)", borderRadius: 99, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${w.health_score}%`, background: w.health_score >= 70 ? "linear-gradient(90deg,#C9A961,#a8893d)" : "#FF9F0A", borderRadius: 99 }} />
                        </div>
                        <span style={{ fontSize: 12.5, color: "var(--ed2-ink-2)", minWidth: 30 }}>{w.health_score}%</span>
                      </div>
                    </Td>
                    <Td last><RowMenu w={w} /></Td>
                  </tr>
                );
              })}
              {filtrados.length === 0 && (
                <tr><Td first last><span style={{ color: "var(--ed2-ink-2)" }}>{items.length === 0 ? "Nenhum workspace ainda — crie um cliente para gerar o workspace." : "Nenhum workspace encontrado."}</span></Td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`.hub-row:hover td { background: var(--ed2-surface-2) !important; }`}</style>
    </div>
  );
}

function RowMenu({ w }: { w: WsRow }) {
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
            <input type="hidden" name="negocio_id" value={w.id} />
            <MenuBtn icon={<Settings size={14} />} label="Editar workspace" />
          </form>
          <div style={{ height: 1, background: "var(--ed2-hair)" }} />
          <form action={mudarStatusClienteAction}>
            <input type="hidden" name="negocio_id" value={w.id} />
            <input type="hidden" name="status" value={w.status === "arquivado" ? "ativo" : "arquivado"} />
            <MenuBtn icon={<Archive size={14} />} label={w.status === "arquivado" ? "Reativar" : "Arquivar"} />
          </form>
          <form action={excluirClienteAction} onSubmit={(e) => { if (!confirm("Excluir permanentemente este workspace e todos os dados? Não dá pra desfazer.")) e.preventDefault(); }}>
            <input type="hidden" name="negocio_id" value={w.id} />
            <input type="hidden" name="voltar" value="/operacao/hub/workspaces" />
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
