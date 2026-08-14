"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Sparkles, Loader2 } from "lucide-react";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { TaskItem } from "@/lib/groow/queries";
import { SearchSelect } from "@/components/groow/ui/search-select";

// ─── Paleta de cores ──────────────────────────────────────────────────────────

const TONES = {
  alta:  { bg: "rgba(255,59,48,0.14)",   fg: "#c8261c", dot: "#FF3B30", label: "Alta",      check: "#FF6961" },
  media: { bg: "rgba(255,159,10,0.14)",  fg: "#a85f00", dot: "#FF9F0A", label: "Média",     check: "#FFB84D" },
  baixa: { bg: "rgba(52,199,89,0.14)",   fg: "#1d8a3a", dot: "#34C759", label: "Baixa",     check: "#7BD389" },
  done:  { bg: "rgba(142,142,147,0.12)", fg: "#636366", dot: "var(--ed2-ink-2)", label: "Concluídas", check: "#AEAEB2" },
} as const;

type Prioridade = "alta" | "media" | "baixa";
type ColKey = Prioridade | "done";

const COLUMN_ORDER: ColKey[] = ["alta", "media", "baixa", "done"];

// ─── Utilitários ──────────────────────────────────────────────────────────────

const AV_GRADIENTS = [
  "linear-gradient(135deg,#C9A961,#a8893d)",
  "linear-gradient(135deg,#0B1838,#1d2d56)",
  "linear-gradient(135deg,#34C759,#1d8a3a)",
  "linear-gradient(135deg,#FF9F0A,#c87a00)",
  "linear-gradient(135deg,#FF3B30,#c8261c)",
  "linear-gradient(135deg,#5856D6,#3934a3)",
  "linear-gradient(135deg,#0A84FF,#0858b0)",
  "linear-gradient(135deg,#AF52DE,#7a3a9b)",
];
function gradFor(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AV_GRADIENTS[h % AV_GRADIENTS.length];
}
function initials(s: string) {
  return (s || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ManualTask {
  id: number;
  titulo: string;
  prioridade: Prioridade;
  status: "pendente" | "concluida";
  lead_id: number | null;
  cliente_id: number | null;
  data_vencimento?: string | null;
  created_at: string;
}

interface ClienteLite { id: number; empresa: string; lead_id: number | null }

// ─── Tags para tarefas auto-geradas (follow-ups) ─────────────────────────────

function tagForTitle(title: string): { cls: keyof typeof TAG_STYLES; label: string } {
  const t = title.toLowerCase();
  if (t.includes("cobran")) return { cls: "cobranca", label: "Cobrança" };
  if (t.includes("call") || t.includes("ligar")) return { cls: "call", label: "Call" };
  if (t.includes("proposta")) return { cls: "proposta", label: "Proposta" };
  if (t.includes("contrato") || t.includes("renov")) return { cls: "contrato", label: "Contrato" };
  if (t.includes("demo")) return { cls: "demo", label: "Demo" };
  if (t.includes("follow")) return { cls: "follow", label: "Follow-up" };
  if (t.includes("diagn")) return { cls: "call", label: "Diagnóstico" };
  return { cls: "default", label: "Tarefa" };
}

const TAG_STYLES: Record<string, React.CSSProperties> = {
  follow:   { background: "rgba(10,132,255,0.10)",  color: "var(--pill-blue-fg)" },
  call:     { background: "rgba(52,199,89,0.12)",   color: "#1d8a3a" },
  proposta: { background: "rgba(201,169,97,0.12)",  color: "var(--pill-gold-fg)" },
  cobranca: { background: "rgba(255,59,48,0.10)",   color: "#c8261c" },
  contrato: { background: "rgba(88,86,214,0.12)",   color: "var(--pill-purple-fg)" },
  demo:     { background: "rgba(175,82,222,0.12)",  color: "#7a3a9b" },
  default:  { background: "var(--ed2-surface)",                color: "var(--ed2-ink)" },
};

function timePillFor(detalhe: string | undefined) {
  if (!detalhe) return null;
  const t = detalhe.toLowerCase();
  if (t.includes("vence") && t.includes("há")) return { cls: "overdue", label: detalhe };
  if (t.includes("hoje")) return { cls: "due-today", label: detalhe };
  if (/\d+ dias sem/.test(t)) {
    const m = t.match(/(\d+) dias/);
    const d = m ? Number(m[1]) : 0;
    if (d >= 7) return { cls: "overdue", label: `Atrasada · há ${d}d` };
    return { cls: "due-today", label: `há ${d}d sem contato` };
  }
  return { cls: "default", label: detalhe };
}

const TIME_STYLES: Record<string, React.CSSProperties> = {
  "due-today": { background: "rgba(255,159,10,0.16)", color: "#a85f00" },
  "overdue":   { background: "rgba(255,59,48,0.14)",  color: "#c8261c" },
  "default":   { background: "var(--ed2-surface)",               color: "var(--ed2-ink)" },
};

// ─── Card de tarefa auto-gerada (follow-up) ───────────────────────────────────

function AutoTaskCard({ task, done, onToggle }: { task: TaskItem; done: boolean; onToggle: () => void }) {
  const t = TONES[task.prioridade];
  const tag = tagForTitle(task.titulo);
  const time = timePillFor(task.detalhe);
  const entityMatch = task.titulo.match(/[:·]\s*([^()]+)/);
  const entity = entityMatch?.[1]?.trim() || task.titulo;

  return (
    <div style={{
      background: "var(--ed2-card)",
      borderRadius: 24,
      padding: "18px 18px 16px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
      transition: "all .2s",
      display: "flex",
      gap: 14,
      position: "relative",
      opacity: done ? 0.55 : 1,
    }}>
      <button
        type="button"
        onClick={onToggle}
        aria-label={done ? "Pendente" : "Concluir"}
        style={{
          all: "unset",
          cursor: "pointer",
          width: 22, height: 22, borderRadius: 99,
          border: done ? "none" : `1.7px solid ${t.check}`,
          background: done ? t.dot : "var(--ed2-card)",
          flexShrink: 0, marginTop: 1,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all .15s",
        } as React.CSSProperties}
      >
        {done && (
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="var(--ed2-card)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2.5 6l2.5 2.5L9.5 3.5" />
          </svg>
        )}
      </button>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.3, textDecoration: done ? "line-through" : "none", color: done ? "var(--ed2-ink-2)" : "var(--ed2-ink)" }}>
          {task.titulo}
        </div>
        {task.detalhe ? <div style={{ fontSize: 13, color: "var(--ed2-ink-2)", lineHeight: 1.4 }}>{task.detalhe}</div> : null}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          <span style={{ padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600, ...TAG_STYLES[tag.cls] }}>{tag.label}</span>
          {time ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 99, fontSize: 11, fontWeight: 600, ...TIME_STYLES[time.cls] }}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="5" cy="5" r="3.5" /><path d="M5 3v2l1.4 1" /></svg>
              {time.label}
            </span>
          ) : null}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
          <div style={{ fontSize: 12, color: "var(--ed2-ink-2)", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 18, height: 18, borderRadius: 99, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 600, fontSize: 9, background: gradFor(entity) }}>{initials(entity)}</span>
            {task.href ? (
              <Link href={task.href} style={{ color: "var(--ed2-ink)", textDecoration: "none", borderBottom: "1px solid var(--ed2-hair)", paddingBottom: 1 }}>{entity}</Link>
            ) : <span>{entity}</span>}
          </div>
          <div style={{ width: 24, height: 24, borderRadius: 99, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 600, fontSize: 10, background: "linear-gradient(135deg,#0B1838,#1d2d56)" }}>RA</div>
        </div>
      </div>
    </div>
  );
}

// ─── Card de tarefa manual (draggable) ───────────────────────────────────────

function ManualTaskCard({
  task,
  leadName,
  onToggle,
  onClick,
}: {
  task: ManualTask;
  leadName?: string;
  onToggle: () => void;
  onClick: () => void;
}) {
  const isDone = task.status === "concluida";
  const t = isDone ? TONES.done : TONES[task.prioridade];

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `manual-${task.id}`,
    data: { taskId: task.id, prioridade: task.prioridade, isManual: true },
    disabled: isDone,
  });

  const style: React.CSSProperties = {
    background: "var(--ed2-card)",
    borderRadius: 20,
    padding: "14px 16px",
    boxShadow: isDragging
      ? "0 12px 32px rgba(0,0,0,0.14)"
      : "0 2px 8px rgba(0,0,0,0.04)",
    opacity: isDone ? 0.6 : isDragging ? 0.5 : 1,
    transform: transform ? `translate3d(${transform.x}px,${transform.y}px,0)` : undefined,
    transition: "box-shadow .15s, opacity .2s",
    cursor: isDone ? "default" : "grab",
    display: "flex",
    gap: 12,
    position: "relative",
    userSelect: "none",
  };

  const vencimento = task.data_vencimento
    ? new Date(task.data_vencimento).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
    : null;

  const isOverdue = task.data_vencimento
    ? new Date(task.data_vencimento) < new Date() && !isDone
    : false;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {/* Checkbox */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        aria-label={isDone ? "Reabrir" : "Concluir"}
        style={{
          all: "unset",
          cursor: "pointer",
          width: 20, height: 20, borderRadius: 99,
          border: isDone ? "none" : `1.7px solid ${t.check}`,
          background: isDone ? t.dot : "var(--ed2-card)",
          flexShrink: 0, marginTop: 2,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all .15s",
        } as React.CSSProperties}
      >
        {isDone && (
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="var(--ed2-card)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2.5 6l2.5 2.5L9.5 3.5" />
          </svg>
        )}
      </button>

      {/* Conteúdo */}
      <div
        style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
      >
        <div style={{
          fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.35,
          textDecoration: isDone ? "line-through" : "none",
          color: isDone ? "var(--ed2-ink-2)" : "var(--ed2-ink)",
          marginBottom: 6,
        }}>
          {task.titulo}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center" }}>
          {/* Badge "Manual" */}
          <span style={{ padding: "2px 9px", borderRadius: 99, fontSize: 10, fontWeight: 700, letterSpacing: "0.03em", background: "rgba(201,169,97,0.12)", color: "var(--pill-gold-fg)" }}>
            Manual
          </span>

          {/* Lead vinculado */}
          {leadName && (
            <span style={{ padding: "2px 9px", borderRadius: 99, fontSize: 10, fontWeight: 600, background: "var(--ed2-surface)", color: "#636366", display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 14, height: 14, borderRadius: 99, display: "inline-flex", alignItems: "center", justifyContent: "center", background: gradFor(leadName), color: "#fff", fontSize: 7, fontWeight: 700 }}>
                {initials(leadName)}
              </span>
              {leadName}
            </span>
          )}

          {/* Data de vencimento */}
          {vencimento && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "2px 9px", borderRadius: 99, fontSize: 10, fontWeight: 600,
              background: isOverdue ? "rgba(255,59,48,0.12)" : "rgba(255,159,10,0.10)",
              color: isOverdue ? "#c8261c" : "#a85f00",
            }}>
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="5" cy="5" r="3.5" /><path d="M5 3v2l1.4 1" />
              </svg>
              {isOverdue ? "Vencida · " : ""}{vencimento}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Coluna Kanban ────────────────────────────────────────────────────────────

function KanbanColumn({
  colKey,
  autoTasks,
  manualTasks,
  doneSet,
  leadMap,
  onToggleAuto,
  onToggleManual,
  onClickManual,
  onAdd,
}: {
  colKey: ColKey;
  autoTasks: TaskItem[];
  manualTasks: ManualTask[];
  doneSet: Set<string | number>;
  leadMap: Map<number, string>;
  onToggleAuto: (task: TaskItem) => void;
  onToggleManual: (task: ManualTask) => void;
  onClickManual: (task: ManualTask) => void;
  onAdd: () => void;
}) {
  const tone = colKey === "done" ? TONES.done : TONES[colKey as Prioridade];
  const isDoneCol = colKey === "done";

  const { isOver, setNodeRef } = useDroppable({
    id: `col-${colKey}`,
    data: { colKey },
  });

  const totalCount = isDoneCol
    ? manualTasks.length
    : autoTasks.length + manualTasks.filter((t) => t.status === "pendente").length;

  return (
    <div
      ref={setNodeRef}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        background: isOver ? "rgba(201,169,97,0.07)" : "var(--ed2-surface-2)",
        borderRadius: 24,
        padding: "10px 10px 14px",
        minHeight: 480,
        transition: "background .15s",
        outline: isOver ? "2px dashed #C9A961" : "none",
        outlineOffset: -4,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 6px 4px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "6px 13px", borderRadius: 999,
            fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase",
            background: tone.bg, color: tone.fg,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: 99, background: tone.dot }} />
            {tone.label}
          </span>
          <span style={{ fontSize: 12, color: "var(--ed2-ink-2)", fontWeight: 600 }}>{totalCount}</span>
        </div>
        {!isDoneCol && (
          <button
            type="button"
            onClick={onAdd}
            style={{
              all: "unset", cursor: "pointer",
              width: 26, height: 26, borderRadius: 99,
              background: "var(--ed2-card)", boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--ed2-ink-2)",
            } as React.CSSProperties}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M6 2v8M2 6h8" />
            </svg>
          </button>
        )}
      </div>

      {/* Cards */}
      {isDoneCol ? (
        /* Coluna concluídas - apenas manuais concluídas */
        manualTasks.length === 0 ? (
          <EmptySlot label="Nenhuma tarefa concluída ainda." />
        ) : (
          manualTasks.map((t) => (
            <ManualTaskCard
              key={`manual-${t.id}`}
              task={t}
              leadName={t.lead_id ? leadMap.get(t.lead_id) : undefined}
              onToggle={() => onToggleManual(t)}
              onClick={() => onClickManual(t)}
            />
          ))
        )
      ) : (
        /* Colunas alta/media/baixa */
        autoTasks.length === 0 && manualTasks.filter((t) => t.status === "pendente").length === 0 ? (
          <EmptySlot label="Tudo limpo por aqui." />
        ) : (
          <>
            {/* Tarefas auto-geradas */}
            {autoTasks.map((tk) => (
              <AutoTaskCard
                key={tk.id}
                task={tk}
                done={doneSet.has(tk.id)}
                onToggle={() => onToggleAuto(tk)}
              />
            ))}
            {/* Tarefas manuais pendentes */}
            {manualTasks
              .filter((t) => t.status === "pendente")
              .map((t) => (
                <ManualTaskCard
                  key={`manual-${t.id}`}
                  task={t}
                  leadName={t.lead_id ? leadMap.get(t.lead_id) : undefined}
                  onToggle={() => onToggleManual(t)}
                  onClick={() => onClickManual(t)}
                />
              ))}
          </>
        )
      )}
    </div>
  );
}

function EmptySlot({ label }: { label: string }) {
  return (
    <div style={{
      background: "var(--ed2-card)", borderRadius: 20, padding: "32px 20px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.04)", textAlign: "center", color: "var(--ed2-ink-2)",
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 15,
        background: "linear-gradient(135deg,rgba(52,199,89,0.15),rgba(52,199,89,0.04))",
        margin: "0 auto 12px", display: "flex", alignItems: "center", justifyContent: "center", color: "#1d8a3a",
      }}>
        <Sparkles size={20} strokeWidth={1.5} />
      </div>
      <p style={{ margin: 0, fontSize: 13 }}>{label}</p>
    </div>
  );
}

// ─── Modal de edição de tarefa manual ─────────────────────────────────────────

function EditTaskModal({
  task,
  leads,
  clientes,
  onClose,
  onSaved,
  onDeleted,
}: {
  task: ManualTask;
  leads: { id: number; nome: string; empresa: string | null }[];
  clientes: ClienteLite[];
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const iStyle: React.CSSProperties = {
    display: "block", width: "100%", borderRadius: 10,
    border: "1px solid var(--ed2-hair)", background: "var(--ed2-surface-2)",
    padding: "9px 12px", fontSize: 13, boxSizing: "border-box",
  };
  const lStyle: React.CSSProperties = {
    display: "block", fontSize: 11, fontWeight: 600, color: "var(--ed2-ink-2)", marginBottom: 5,
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const titulo = String(fd.get("titulo") || "").trim();
    const prioridade = String(fd.get("prioridade") || "media");
    const lead_id = fd.get("lead_id") ? Number(fd.get("lead_id")) : null;
    const cliente_id = fd.get("cliente_id") ? Number(fd.get("cliente_id")) : null;
    const data_vencimento = String(fd.get("data_vencimento") || "") || null;
    if (!titulo) { setError("Título obrigatório"); setSaving(false); return; }
    try {
      const res = await fetch(`/api/admin/tarefas/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo, prioridade, lead_id, cliente_id, data_vencimento }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Erro ${res.status}`);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Deletar esta tarefa?")) return;
    setDeleting(true);
    try {
      await fetch(`/api/admin/tarefas/${task.id}`, { method: "DELETE" });
      onDeleted();
    } catch {
      setError("Erro ao deletar");
    } finally {
      setDeleting(false);
    }
  };

  const defaultDate = task.data_vencimento
    ? new Date(task.data_vencimento).toISOString().slice(0, 10)
    : "";

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 60, display: "grid", placeItems: "center", background: "rgba(11,24,56,0.45)", padding: 16 }}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 480, background: "var(--ed2-card)", borderRadius: 24, boxShadow: "0 24px 60px rgba(0,0,0,0.18)", overflow: "hidden" }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid var(--ed2-hair)" }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em" }}>Editar tarefa</h3>
          <button type="button" onClick={onClose} style={{ all: "unset", cursor: "pointer", color: "var(--ed2-ink-2)" } as React.CSSProperties}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4l10 10M14 4L4 14" /></svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={lStyle}>Título *</label>
            <input name="titulo" required defaultValue={task.titulo} placeholder="Descreva a tarefa" style={iStyle} autoFocus />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={lStyle}>Prioridade</label>
              <select name="prioridade" defaultValue={task.prioridade} style={{ ...iStyle, appearance: "auto" } as React.CSSProperties}>
                <option value="alta">Alta</option>
                <option value="media">Média</option>
                <option value="baixa">Baixa</option>
              </select>
            </div>
            <div>
              <label style={lStyle}>Data limite</label>
              <input name="data_vencimento" type="date" defaultValue={defaultDate} style={iStyle} />
            </div>
          </div>
          <div>
            <label style={lStyle}>Cliente relacionado (opcional)</label>
            <select name="cliente_id" defaultValue={task.cliente_id ?? ""} style={{ ...iStyle, appearance: "auto" } as React.CSSProperties}>
              <option value="">Nenhum cliente</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.empresa}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={lStyle}>Lead relacionado (opcional)</label>
            <select name="lead_id" defaultValue={task.lead_id ?? ""} style={{ ...iStyle, appearance: "auto" } as React.CSSProperties}>
              <option value="">Nenhum lead</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome}{l.empresa ? ` · ${l.empresa}` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error ? <p style={{ padding: "0 22px", color: "#c8261c", fontSize: 12, margin: "0 0 4px" }}>{error}</p> : null}

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "14px 22px", borderTop: "1px solid var(--ed2-hair)" }}>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            style={{ all: "unset", cursor: deleting ? "wait" : "pointer", padding: "9px 14px", color: "#c8261c", fontSize: 13, fontWeight: 600, opacity: deleting ? 0.6 : 1 } as React.CSSProperties}
          >
            {deleting ? "Deletando…" : "Deletar"}
          </button>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={onClose} style={{ all: "unset", cursor: "pointer", padding: "9px 14px", color: "var(--ed2-ink-2)", fontSize: 13 } as React.CSSProperties}>Cancelar</button>
            <button
              type="submit"
              disabled={saving}
              style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#C9A961", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.6 : 1 }}
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : null}
              Salvar
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function TarefasPage() {
  const [autoTasks, setAutoTasks] = useState<TaskItem[]>([]);
  const [manualTasks, setManualTasks] = useState<ManualTask[]>([]);
  const [leads, setLeads] = useState<{ id: number; nome: string; empresa: string | null }[]>([]);
  const [clientes, setClientes] = useState<ClienteLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [doneSet, setDoneSet] = useState<Set<string | number>>(new Set());
  const [showNewTask, setShowNewTask] = useState(false);
  const [editingTask, setEditingTask] = useState<ManualTask | null>(null);
  // Visão: tarefas gerais (tudo), por lead ou por cliente
  const [taskView, setTaskView] = useState<"gerais" | "lead" | "cliente">("gerais");
  const [selectedCliente, setSelectedCliente] = useState<number | null>(null);
  const [selectedLead, setSelectedLead] = useState<number | null>(null);

  // Build a lead name map for quick lookup
  const leadMap = new Map(leads.map((l) => [l.id, l.nome]));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tarefasRes, leadsRes, clientesRes] = await Promise.all([
        fetch("/api/admin/tarefas"),
        fetch("/api/admin/leads"),
        fetch("/api/admin/clientes"),
      ]);
      const tarefasData = await tarefasRes.json();
      const leadsData = await leadsRes.json();
      const clientesData = await clientesRes.json().catch(() => ({ clientes: [] }));
      if (tarefasData.error) throw new Error(tarefasData.error);
      setAutoTasks(tarefasData.tasks || []);
      const manual = (tarefasData.manual || []) as ManualTask[];
      setManualTasks(manual);
      setLeads((leadsData.leads || []).slice(0, 100));
      setClientes(((clientesData.clientes || []) as { id: number; empresa: string; lead_id?: number | null }[]).map((c) => ({ id: c.id, empresa: c.empresa, lead_id: c.lead_id ?? null })));
    } catch {
      setError("Não foi possível carregar as tarefas.");
      setAutoTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ─── Toggle tarefa auto-gerada (lead follow-up) ───────────────────────────

  const toggleAutoTask = async (task: TaskItem) => {
    const key = String(task.id);
    const isDone = doneSet.has(task.id);

    setDoneSet((prev) => {
      const next = new Set(prev);
      if (next.has(task.id)) next.delete(task.id); else next.add(task.id);
      return next;
    });

    // Ao concluir um follow-up auto-gerado (id formato "lead-42"):
    // 1. cria um registro de tarefa JÁ concluída → aparece na coluna Concluídas
    // 2. atualiza ultimo_contato_em do lead → para de regenerar como pendente
    if (!isDone && key.startsWith("lead-")) {
      const numericId = Number(key.replace("lead-", ""));
      if (!Number.isNaN(numericId) && numericId > 0) {
        await Promise.all([
          fetch("/api/admin/tarefas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              titulo: task.titulo,
              prioridade: task.prioridade,
              lead_id: numericId,
              status: "concluida",
            }),
          }).catch(() => {}),
          fetch(`/api/admin/leads/${numericId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ultimo_contato_em: new Date().toISOString() }),
          }).catch(() => {}),
        ]);
        // Recarrega para mostrar na coluna Concluídas e remover dos pendentes
        setTimeout(() => load(), 500);
      }
    }
  };

  // ─── Toggle tarefa manual ─────────────────────────────────────────────────

  const toggleManualTask = async (task: ManualTask) => {
    const newStatus = task.status === "pendente" ? "concluida" : "pendente";
    // Optimistic update
    setManualTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: newStatus } : t));
    await fetch(`/api/admin/tarefas/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    }).catch(() => load());
  };

  // ─── DnD ─────────────────────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const draggableId = String(active.id);
    const colKey = over.data.current?.colKey as ColKey | undefined;
    if (!colKey) return;

    // Só manuais podem ser arrastadas
    if (!draggableId.startsWith("manual-")) return;
    const taskId = Number(draggableId.replace("manual-", ""));
    const task = manualTasks.find((t) => t.id === taskId);
    if (!task) return;

    if (colKey === "done") {
      // Arrastar para "Concluídas" → marca como concluída
      if (task.status !== "concluida") {
        setManualTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: "concluida" } : t));
        await fetch(`/api/admin/tarefas/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "concluida" }),
        }).catch(() => load());
      }
    } else {
      // Arrastar entre prioridades → muda prioridade
      const newPrio = colKey as Prioridade;
      if (task.prioridade !== newPrio || task.status === "concluida") {
        setManualTasks((prev) =>
          prev.map((t) => t.id === taskId ? { ...t, prioridade: newPrio, status: "pendente" } : t)
        );
        await fetch(`/api/admin/tarefas/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prioridade: newPrio, status: "pendente" }),
        }).catch(() => load());
      }
    }
  }, [manualTasks, load]);

  // ─── Contadores ──────────────────────────────────────────────────────────

  // Regra "lead-é-cliente": um lead que já virou cliente (mesma empresa) não é mais lead.
  // As tarefas desse lead passam a pertencer ao cliente (somem da Gerais e do Por lead).
  const clienteNomesSet = new Set(clientes.map((c) => c.empresa.trim().toLowerCase()));
  const convertedLeadIds = new Set<number>([
    // vínculo real: leads que viraram cliente (clientes.lead_id)
    ...clientes.map((c) => c.lead_id).filter((id): id is number => id != null),
    // fallback por nome de empresa (dados antigos sem vínculo direto)
    ...leads.filter((l) => clienteNomesSet.has((l.empresa || l.nome).trim().toLowerCase())).map((l) => l.id),
  ]);
  // lead_ids que pertencem ao cliente selecionado (vínculo direto + fallback por nome)
  const selCliente = clientes.find((c) => c.id === selectedCliente);
  const selClienteNome = selCliente?.empresa.trim().toLowerCase();
  const leadIdsDoCliente = new Set<number>([
    ...(selCliente?.lead_id != null ? [selCliente.lead_id] : []),
    ...(selClienteNome ? leads.filter((l) => (l.empresa || l.nome).trim().toLowerCase() === selClienteNome).map((l) => l.id) : []),
  ]);

  const visibleManual =
    taskView === "cliente"
      ? manualTasks.filter((t) => t.cliente_id === selectedCliente || (t.lead_id != null && leadIdsDoCliente.has(t.lead_id)))
      : taskView === "lead"
      ? manualTasks.filter((t) => t.lead_id === selectedLead)
      : manualTasks.filter((t) => !t.cliente_id && !(t.lead_id != null && convertedLeadIds.has(t.lead_id)));
  const visibleAuto =
    taskView === "cliente" ? []
    : taskView === "lead" ? autoTasks.filter((t) => String(t.id) === `lead-${selectedLead}`)
    : autoTasks;

  const manualPending = visibleManual.filter((t) => t.status === "pendente");
  const manualDone    = visibleManual.filter((t) => t.status === "concluida");
  const totalPending  = visibleAuto.filter((t) => !doneSet.has(t.id)).length + manualPending.length;
  const totalDone     = (taskView === "gerais" ? doneSet.size : 0) + manualDone.length;
  const atrasadasCount = visibleAuto.filter((t) => t.prioridade === "alta").length
    + manualPending.filter((t) => t.prioridade === "alta").length;

  // Contagem de tarefas pendentes por cliente / por lead (pros seletores)
  const pendingByCliente = new Map<number, number>();
  const pendingByLead = new Map<number, number>();
  for (const t of manualTasks) {
    if (t.status !== "pendente") continue;
    if (t.cliente_id) pendingByCliente.set(t.cliente_id, (pendingByCliente.get(t.cliente_id) || 0) + 1);
    if (t.lead_id) pendingByLead.set(t.lead_id, (pendingByLead.get(t.lead_id) || 0) + 1);
  }
  for (const t of autoTasks) {
    const m = String(t.id).match(/^lead-(\d+)$/);
    if (m) { const lid = Number(m[1]); pendingByLead.set(lid, (pendingByLead.get(lid) || 0) + 1); }
  }

  // Se virou cliente, não é mais lead: o seletor "Por lead" só lista quem ainda NÃO é cliente.
  const leadsNaoClientes = leads.filter((l) => !convertedLeadIds.has(l.id));

  // ─── Distribui tarefas por coluna ────────────────────────────────────────

  function autoForCol(col: Prioridade) {
    return visibleAuto.filter((t) => t.prioridade === col);
  }
  function manualForCol(col: ColKey) {
    // Concluídas: mostra só as 5 últimas (mais recentes). A contagem total continua no cabeçalho.
    if (col === "done") return [...manualDone].sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 5);
    return visibleManual.filter((t) => t.prioridade === col && t.status === "pendente");
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24, gap: 24, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 42, fontWeight: 700, letterSpacing: "-0.035em", margin: "0 0 6px", lineHeight: 1.05 }}>Tarefas</h1>
          <div style={{ color: "var(--ed2-ink-2)", fontSize: 15 }}>
            {loading ? "Carregando…" : (
              <>
                <b style={{ color: "var(--ed2-ink)", fontWeight: 600 }}>{totalPending}</b> pendente{totalPending === 1 ? "" : "s"} ·{" "}
                <span style={{ color: "#c8261c", fontWeight: 600 }}>{atrasadasCount} alta{atrasadasCount === 1 ? "" : "s"}</span> ·{" "}
                <b style={{ color: "var(--ed2-ink)", fontWeight: 600 }}>{totalDone}</b> concluída{totalDone === 1 ? "" : "s"}
              </>
            )}
          </div>
        </div>
        <button type="button" onClick={() => setShowNewTask(true)} style={newBtnStyle}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M8 3v10M3 8h10" /></svg>
          Nova tarefa
        </button>
      </div>

      {/* SUB-NAV: Gerais · Por lead · Por cliente */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ display: "inline-flex", background: "var(--ed2-card)", padding: 4, borderRadius: 999, gap: 2, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          {([["gerais", "Gerais"], ["lead", "Por lead"], ["cliente", "Por cliente"]] as const).map(([k, lbl]) => {
            const on = taskView === k;
            return (
              <button key={k} type="button" onClick={() => setTaskView(k)}
                style={{ all: "unset", cursor: "pointer", padding: "9px 18px", borderRadius: 999, fontSize: 13, fontWeight: 600, lineHeight: 1, color: on ? "var(--ed2-ink)" : "var(--ed2-ink-2)", background: on ? "var(--ed2-surface)" : "transparent" } as React.CSSProperties}>
                {lbl}
              </button>
            );
          })}
        </div>
        {taskView === "cliente" && (
          <SearchSelect
            className="h-10 min-w-[240px] rounded-full shadow-sm"
            placeholder="Selecione um cliente…"
            searchPlaceholder="Buscar cliente…"
            emptyText="Nenhum cliente."
            value={selectedCliente != null ? String(selectedCliente) : null}
            onChange={(v) => setSelectedCliente(v ? Number(v) : null)}
            options={clientes.map((c) => ({
              value: String(c.id),
              label: c.empresa,
              count: pendingByCliente.get(c.id) || 0,
              initials: initials(c.empresa),
            }))}
          />
        )}
        {taskView === "lead" && (
          <SearchSelect
            className="h-10 min-w-[260px] rounded-full shadow-sm"
            placeholder="Selecione um lead…"
            searchPlaceholder="Buscar lead…"
            emptyText="Nenhum lead."
            value={selectedLead != null ? String(selectedLead) : null}
            onChange={(v) => setSelectedLead(v ? Number(v) : null)}
            options={leadsNaoClientes.map((l) => ({
              value: String(l.id),
              label: l.empresa || l.nome,
              count: pendingByLead.get(l.id) || 0,
              initials: initials(l.empresa || l.nome),
            }))}
          />
        )}
      </div>

      {/* INSTRUÇÃO DE DRAG */}
      {!loading && (manualPending.length > 0) && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18, color: "var(--ed2-ink-2)", fontSize: 12 }}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M6 3l-3 3 3 3M10 3l3 3-3 3" /></svg>
          Arraste tarefas manuais entre colunas para mudar prioridade · Arraste para Concluídas para fechar
        </div>
      )}

      {error ? (
        <div style={{ background: "rgba(255,59,48,0.06)", border: "1px solid rgba(255,59,48,0.18)", borderRadius: 18, padding: "12px 18px", color: "#c8261c", fontSize: 13, marginBottom: 18 }}>
          {error}
        </div>
      ) : null}

      {/* MODALS */}
      {showNewTask && (
        <NovaTaskModal
          clientes={clientes}
          defaultClienteId={taskView === "cliente" ? selectedCliente : null}
          defaultLeadId={taskView === "lead" ? selectedLead : null}
          onClose={() => setShowNewTask(false)}
          onCreated={() => { setShowNewTask(false); load(); }}
        />
      )}
      {editingTask && (
        <EditTaskModal
          task={editingTask}
          leads={leads}
          clientes={clientes}
          onClose={() => setEditingTask(null)}
          onSaved={() => { setEditingTask(null); load(); }}
          onDeleted={() => { setEditingTask(null); load(); }}
        />
      )}

      {/* VISÃO POR CLIENTE/LEAD SEM SELEÇÃO */}
      {(taskView === "cliente" && !selectedCliente) || (taskView === "lead" && !selectedLead) ? (
        <div style={{ background: "var(--ed2-card)", borderRadius: 28, padding: 48, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: "linear-gradient(135deg,rgba(201,169,97,0.16),rgba(201,169,97,0.06))", display: "grid", placeItems: "center", color: "var(--pill-gold-fg)" }}>
            <Sparkles size={28} strokeWidth={1.5} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>Selecione um {taskView === "cliente" ? "cliente" : "lead"}</h3>
            <p style={{ margin: "8px 0 0", color: "var(--ed2-ink-2)", fontSize: 14, maxWidth: 420 }}>Escolha um {taskView === "cliente" ? "cliente" : "lead"} no seletor acima para ver e organizar as tarefas {taskView === "cliente" ? "daquela empresa" : "daquele lead"}.</p>
          </div>
        </div>
      ) : !loading && visibleAuto.length === 0 && visibleManual.length === 0 && !error ? (
        <div style={{ background: "var(--ed2-card)", borderRadius: 28, padding: 48, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: "linear-gradient(135deg,rgba(201,169,97,0.16),rgba(201,169,97,0.06))", display: "grid", placeItems: "center", color: "var(--pill-gold-fg)" }}>
            <Sparkles size={28} strokeWidth={1.5} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>Inbox zero</h3>
            <p style={{ margin: "8px 0 0", color: "var(--ed2-ink-2)", fontSize: 14, maxWidth: 420 }}>
              {taskView === "cliente" ? "Nenhuma tarefa pra esse cliente ainda. Clique em “Nova tarefa”."
                : taskView === "lead" ? "Nenhuma tarefa pra esse lead ainda. Clique em “Nova tarefa”."
                : "Sem follow-ups pendentes, agendamentos ou contratos vencendo."}
            </p>
          </div>
        </div>
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          {/* Grid 4 colunas */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 16,
            overflowX: "auto",
            minWidth: 0,
          }}>
            {COLUMN_ORDER.map((col) => (
              <KanbanColumn
                key={col}
                colKey={col}
                autoTasks={col !== "done" ? autoForCol(col as Prioridade) : []}
                manualTasks={manualForCol(col)}
                doneSet={doneSet}
                leadMap={leadMap}
                onToggleAuto={toggleAutoTask}
                onToggleManual={toggleManualTask}
                onClickManual={setEditingTask}
                onAdd={() => setShowNewTask(true)}
              />
            ))}
          </div>
        </DndContext>
      )}
    </div>
  );
}

// ─── Estilos compartilhados ───────────────────────────────────────────────────

const newBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "#C9A961",
  color: "#fff",
  border: "none",
  padding: "11px 18px",
  borderRadius: 999,
  fontWeight: 600,
  fontSize: 13,
  letterSpacing: "-0.005em",
  cursor: "pointer",
  boxShadow: "0 4px 12px rgba(201,169,97,0.28)",
};

// ─── Modal Nova Tarefa (mantido igual ao original) ────────────────────────────

function NovaTaskModal({ clientes, defaultClienteId, defaultLeadId, onClose, onCreated }: { clientes: ClienteLite[]; defaultClienteId: number | null; defaultLeadId: number | null; onClose: () => void; onCreated: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [leads, setLeads] = useState<{ id: number; nome: string; empresa: string | null }[]>([]);

  useEffect(() => {
    fetch("/api/admin/leads")
      .then((r) => r.json())
      .then((d) => setLeads((d.leads || []).slice(0, 50)))
      .catch(() => {});
  }, []);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const titulo = String(fd.get("titulo") || "").trim();
    const prioridade = String(fd.get("prioridade") || "media");
    const lead_id = fd.get("lead_id") ? Number(fd.get("lead_id")) : undefined;
    const cliente_id = fd.get("cliente_id") ? Number(fd.get("cliente_id")) : undefined;
    const data_vencimento = String(fd.get("data_vencimento") || "") || undefined;
    if (!titulo) { setError("Título obrigatório"); setSaving(false); return; }
    try {
      const res = await fetch("/api/admin/tarefas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo, prioridade, lead_id, cliente_id, data_vencimento }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Erro ${res.status}`);
      }
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar tarefa");
    } finally {
      setSaving(false);
    }
  };

  const iStyle: React.CSSProperties = { display: "block", width: "100%", borderRadius: 10, border: "1px solid var(--ed2-hair)", background: "var(--ed2-surface-2)", padding: "9px 12px", fontSize: 13, boxSizing: "border-box" };
  const lStyle: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 600, color: "var(--ed2-ink-2)", marginBottom: 5 };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, display: "grid", placeItems: "center", background: "rgba(11,24,56,0.45)", padding: 16 }}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "var(--ed2-card)", borderRadius: 24, boxShadow: "0 24px 60px rgba(0,0,0,0.18)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid var(--ed2-hair)" }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em" }}>Nova tarefa</h3>
          <button type="button" onClick={onClose} style={{ all: "unset", cursor: "pointer", color: "var(--ed2-ink-2)" } as React.CSSProperties}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4l10 10M14 4L4 14" /></svg>
          </button>
        </div>
        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={lStyle}>Título *</label>
            <input name="titulo" required placeholder="Descreva a tarefa" style={iStyle} autoFocus />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={lStyle}>Prioridade</label>
              <select name="prioridade" style={{ ...iStyle, appearance: "auto" } as React.CSSProperties}>
                <option value="alta">Alta</option>
                <option value="media">Média</option>
                <option value="baixa">Baixa</option>
              </select>
            </div>
            <div>
              <label style={lStyle}>Data limite</label>
              <input name="data_vencimento" type="date" min={new Date().toISOString().slice(0, 10)} style={iStyle} />
            </div>
          </div>
          <div>
            <label style={lStyle}>Cliente relacionado (opcional)</label>
            <select name="cliente_id" defaultValue={defaultClienteId ?? ""} style={{ ...iStyle, appearance: "auto" } as React.CSSProperties}>
              <option value="">Nenhum cliente</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.empresa}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={lStyle}>Lead relacionado (opcional)</label>
            <select name="lead_id" defaultValue={defaultLeadId ?? ""} style={{ ...iStyle, appearance: "auto" } as React.CSSProperties}>
              <option value="">Nenhum lead</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome}{l.empresa ? ` · ${l.empresa}` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
        {error ? <p style={{ padding: "0 22px", color: "#c8261c", fontSize: 12, margin: "0 0 4px" }}>{error}</p> : null}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 22px", borderTop: "1px solid var(--ed2-hair)" }}>
          <button type="button" onClick={onClose} style={{ all: "unset", cursor: "pointer", padding: "9px 14px", color: "var(--ed2-ink-2)", fontSize: 13 } as React.CSSProperties}>Cancelar</button>
          <button type="submit" disabled={saving} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#C9A961", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : null}
            Criar tarefa
          </button>
        </div>
      </form>
    </div>
  );
}
