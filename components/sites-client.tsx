"use client";

import { useState } from "react";
import { IcoSearch, IcoGlobe, IcoExternal } from "@/components/icons";

export interface SiteRow {
  id: string;
  nome: string;
  nome_fantasia: string | null;
  marca_cor: string | null;
  status: string;
  dominio: string | null;
  site_url: string | null;
  resp_nome: string | null;
}

const TABS: { k: string; label: string }[] = [
  { k: "todos", label: "Todos" },
  { k: "ativo", label: "Ativos" },
  { k: "em_configuracao", label: "Pausados" },
  { k: "arquivado", label: "Arquivados" },
];

export default function SitesClient({ items }: { items: SiteRow[] }) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("todos");

  const filtrados = items.filter((s) => {
    if (tab !== "todos" && s.status !== tab) return false;
    if (q.trim()) {
      const campos = [s.nome, s.nome_fantasia, s.dominio, s.site_url].filter(Boolean).join(" ").toLowerCase();
      if (!campos.includes(q.trim().toLowerCase())) return false;
    }
    return true;
  });

  return (
    <>
      <div className="toolbar">
        <div className="search-box">
          <IcoSearch width={16} height={16} />
          <input placeholder="Buscar por nome, domínio ou cliente…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="row" style={{ gap: 4, background: "rgba(0,0,0,0.22)", border: "1px solid var(--line)", borderRadius: 12, padding: 4 }}>
          {TABS.map((t) => (
            <button
              key={t.k}
              type="button"
              onClick={() => setTab(t.k)}
              className={"wsnav-tab" + (tab === t.k ? " active" : "")}
              style={{ padding: "7px 12px", fontSize: 13 }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="cols-3">
        {filtrados.map((s) => {
          const ativo = s.status === "ativo";
          const nome = s.nome_fantasia || s.nome;
          return (
            <div key={s.id} className="card">
              <div className="spread">
                <div className="row" style={{ gap: 10 }}>
                  <div className="avatar" style={{ background: s.marca_cor || "#C9A961" }}>{nome.slice(0, 2).toUpperCase()}</div>
                  <div style={{ minWidth: 0 }}>
                    <strong>{nome}</strong>
                    <div className="muted" style={{ fontSize: 12 }}>{s.nome}</div>
                  </div>
                </div>
                <span className={"badge " + (ativo ? "ok" : "warn")}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
                  {s.status}
                </span>
              </div>

              <div className="glass-soft" style={{ borderRadius: 12, padding: "10px 12px", marginTop: 14 }}>
                <div className="row" style={{ gap: 8, fontSize: 13 }}>
                  <IcoGlobe width={15} height={15} />
                  <span className={s.dominio ? "" : "muted"} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.dominio || "Sem domínio configurado"}
                  </span>
                </div>
                {s.site_url && (
                  <div className="row" style={{ gap: 8, fontSize: 12.5, marginTop: 7 }}>
                    <IcoExternal width={14} height={14} />
                    <span className="muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.site_url}</span>
                  </div>
                )}
              </div>

              <div className="row" style={{ gap: 8, marginTop: 14 }}>
                {s.site_url ? (
                  <a className="btn btn-ghost btn-sm" href={s.site_url} target="_blank" rel="noreferrer">
                    <IcoExternal width={14} height={14} /> Visitar
                  </a>
                ) : (
                  <span className="badge">sem site</span>
                )}
                <form action="/api/impersonar" method="post" style={{ marginLeft: "auto" }}>
                  <input type="hidden" name="negocio_id" value={s.id} />
                  <input type="hidden" name="destino" value="/app/site" />
                  <button className="btn btn-sm" type="submit">Abrir site</button>
                </form>
              </div>
            </div>
          );
        })}
        {filtrados.length === 0 && (
          <div className="card"><p className="muted" style={{ margin: 0 }}>Nenhum site encontrado.</p></div>
        )}
      </div>
    </>
  );
}
