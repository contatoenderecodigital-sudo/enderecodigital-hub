"use client";

import { useState, useTransition } from "react";
import { excluirSenhaAction } from "@/app/owner/ops/actions";
import { IcoEye, IcoTrash, IcoLock, IcoExternal } from "@/components/icons";
import type { SenhaMeta } from "@/lib/ops";

export default function OpsSenhasList({ senhas }: { senhas: SenhaMeta[] }) {
  const [aberta, setAberta] = useState<Record<number, string>>({});
  const [carregando, setCarregando] = useState<number | null>(null);
  const [pending, start] = useTransition();

  async function revelar(id: number) {
    if (aberta[id]) { setAberta((p) => { const n = { ...p }; delete n[id]; return n; }); return; }
    setCarregando(id);
    try {
      const r = await fetch("/api/owner/senhas/reveal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const d = await r.json();
      if (r.ok) setAberta((p) => ({ ...p, [id]: d.senha }));
      else alert(d.error || "Erro ao abrir.");
    } catch { alert("Falha de conexão."); }
    finally { setCarregando(null); }
  }
  function excluir(id: number, servico: string) {
    if (!confirm(`Excluir a credencial "${servico}"?`)) return;
    const fd = new FormData(); fd.set("id", String(id));
    start(() => excluirSenhaAction(fd));
  }

  if (senhas.length === 0) {
    return <div className="card" style={{ textAlign: "center", padding: 44 }}><p className="muted" style={{ margin: 0 }}>Cofre vazio. Adicione a primeira credencial acima.</p></div>;
  }

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden", opacity: pending ? 0.7 : 1 }}>
      {senhas.map((s, i) => (
        <div key={s.id} style={{ padding: "14px 18px", borderTop: i ? "1px solid var(--line)" : "none" }}>
          <div className="spread">
            <div className="row" style={{ gap: 11, minWidth: 0 }}>
              <div className="icon-box sm"><IcoLock width={15} height={15} /></div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{s.servico}{s.cliente ? ` · ${s.cliente}` : ""}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {s.usuario || "—"}
                  {s.url && <> · <a href={s.url} target="_blank" rel="noreferrer" style={{ color: "var(--muted-2)" }}><IcoExternal width={11} height={11} /> abrir</a></>}
                </div>
              </div>
            </div>
            <div className="row" style={{ gap: 8, flexShrink: 0 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => revelar(s.id)} disabled={carregando === s.id}>
                <IcoEye width={14} height={14} /> {aberta[s.id] ? "Ocultar" : carregando === s.id ? "…" : "Revelar"}
              </button>
              <button className="dots-btn" onClick={() => excluir(s.id, s.servico)} aria-label="Excluir"><IcoTrash width={15} height={15} /></button>
            </div>
          </div>
          {aberta[s.id] && (
            <div className="glass-soft row spread" style={{ borderRadius: 10, padding: "9px 12px", marginTop: 10 }}>
              <code style={{ fontSize: 13.5, wordBreak: "break-all" }}>{aberta[s.id]}</code>
              <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(aberta[s.id])}>Copiar</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
