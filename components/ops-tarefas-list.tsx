"use client";

import { useTransition } from "react";
import { toggleTarefaAction, excluirTarefaAction } from "@/app/owner/ops/actions";
import { IcoTrash } from "@/components/icons";
import type { OpsTarefa } from "@/lib/ops";

const PRIO: Record<string, { c: string; l: string }> = {
  alta: { c: "warn", l: "alta" },
  media: { c: "gold", l: "média" },
  baixa: { c: "", l: "baixa" },
};

function venc(t: OpsTarefa) {
  if (!t.due_date) return null;
  const d = new Date(t.due_date);
  const dias = Math.ceil((d.getTime() - Date.now()) / 86400000);
  const atrasada = t.status === "pendente" && dias < 0;
  const txt = dias < 0 ? `${Math.abs(dias)}d atrás` : dias === 0 ? "hoje" : `em ${dias}d`;
  return { txt, atrasada };
}

export default function OpsTarefasList({ tarefas }: { tarefas: OpsTarefa[] }) {
  const [pending, start] = useTransition();

  function toggle(id: number) {
    const fd = new FormData(); fd.set("id", String(id));
    start(() => toggleTarefaAction(fd));
  }
  function excluir(id: number, titulo: string) {
    if (!confirm(`Excluir a tarefa "${titulo}"?`)) return;
    const fd = new FormData(); fd.set("id", String(id));
    start(() => excluirTarefaAction(fd));
  }

  if (tarefas.length === 0) {
    return <div className="card" style={{ textAlign: "center", padding: 44 }}><p className="muted" style={{ margin: 0 }}>Inbox zero — nenhuma tarefa aqui.</p></div>;
  }

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden", opacity: pending ? 0.7 : 1 }}>
      {tarefas.map((t, i) => {
        const v = venc(t);
        const feita = t.status === "feita";
        return (
          <div key={t.id} className="spread" style={{ padding: "13px 18px", borderTop: i ? "1px solid var(--line)" : "none", gap: 12 }}>
            <div className="row" style={{ gap: 12, minWidth: 0 }}>
              <input type="checkbox" checked={feita} onChange={() => toggle(t.id)} style={{ width: 18, height: 18, flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, textDecoration: feita ? "line-through" : "none", opacity: feita ? 0.55 : 1 }}>{t.titulo}</div>
                {v && !feita && (
                  <div className={v.atrasada ? "" : "muted"} style={{ fontSize: 11.5, color: v.atrasada ? "var(--danger)" : undefined }}>
                    vence {v.txt}
                  </div>
                )}
              </div>
            </div>
            <div className="row" style={{ gap: 10, flexShrink: 0 }}>
              {!feita && <span className={"badge " + PRIO[t.prioridade]?.c}>{PRIO[t.prioridade]?.l || t.prioridade}</span>}
              <button className="dots-btn" onClick={() => excluir(t.id, t.titulo)} aria-label="Excluir"><IcoTrash width={15} height={15} /></button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
