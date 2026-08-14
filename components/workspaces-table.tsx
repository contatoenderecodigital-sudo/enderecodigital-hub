"use client";

import { useState } from "react";
import Link from "@/components/link";
import { mudarStatusClienteAction, excluirClienteAction } from "@/app/owner/clientes/actions";
import { IcoSearch, IcoGlobe, IcoUsers, IcoSettings, IcoArchive, IcoTrash, IcoDots } from "@/components/icons";

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

export default function WorkspacesTable({ items }: { items: WsRow[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("todos");
  const [menu, setMenu] = useState<{ id: string; top: number; left: number } | null>(null);

  const filtrados = items.filter((w) => {
    if (status !== "todos" && w.status !== status) return false;
    if (q.trim()) {
      const campos = [w.nome, w.nome_fantasia, w.slug, w.dominio, w.hub_nome]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!campos.includes(q.trim().toLowerCase())) return false;
    }
    return true;
  });

  function abrir(e: React.MouseEvent, id: string) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenu(menu?.id === id ? null : { id, top: r.bottom + 6, left: Math.max(12, r.right - 200) });
  }
  const alvo = menu ? items.find((w) => w.id === menu.id) : null;

  return (
    <>
      <div className="toolbar">
        <div className="search-box">
          <IcoSearch width={16} height={16} />
          <input placeholder="Buscar por nome, slug, cliente ou domínio…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="filter-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="todos">Todos os status</option>
          <option value="ativo">Ativos</option>
          <option value="em_configuracao">Em configuração</option>
          <option value="arquivado">Arquivados</option>
        </select>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ paddingLeft: 20 }}>Workspace</th>
                <th>Cliente</th>
                <th>Domínio</th>
                <th>Status</th>
                <th>Saúde</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((w) => {
                const cor = w.health_score >= 70 ? "linear-gradient(90deg, var(--gold-d), var(--gold-l))" : "var(--warn)";
                return (
                  <tr key={w.id}>
                    <td style={{ paddingLeft: 20 }}>
                      <div className="row" style={{ gap: 11 }}>
                        <div className="avatar" style={{ background: w.marca_cor || "#C9A961" }}>
                          {(w.nome_fantasia || w.nome).slice(0, 2).toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <strong>{w.nome_fantasia || w.nome}</strong>
                          <div className="muted" style={{ fontSize: 12 }}>/{w.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>{w.nome}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{w.resp_nome || w.hub_nome}</div>
                    </td>
                    <td className="muted" style={{ fontSize: 13 }}>
                      <span className="row" style={{ gap: 7 }}>
                        <IcoGlobe width={14} height={14} />
                        {w.dominio || w.site_url || "—"}
                      </span>
                    </td>
                    <td><span className={"badge " + (w.status === "ativo" ? "ok" : "warn")}>{w.status}</span></td>
                    <td>
                      <div className="row" style={{ gap: 9 }}>
                        <span className="hbar"><i style={{ width: `${w.health_score}%`, background: cor }} /></span>
                        <span style={{ fontSize: 13 }}>{w.health_score}%</span>
                      </div>
                    </td>
                    <td style={{ textAlign: "right", paddingRight: 20 }}>
                      <button className="dots-btn" onClick={(e) => abrir(e, w.id)} aria-label="Ações">
                        <IcoDots width={18} height={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtrados.length === 0 && (
                <tr><td colSpan={6} className="muted" style={{ paddingLeft: 20 }}>Nenhum workspace encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {menu && alvo && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 25 }} onClick={() => setMenu(null)} />
          <div className="menu" style={{ position: "fixed", top: menu.top, left: menu.left, right: "auto" }}>
            {alvo.dominio && (
              <Link href={`/ws/${alvo.id}`}><IcoSettings width={16} height={16} /> Abrir painel (MODO OWNER)</Link>
            )}
            <form action="/api/impersonar" method="post">
              <input type="hidden" name="negocio_id" value={alvo.id} />
              <input type="hidden" name="destino" value="/app/config-hub" />
              <button type="submit"><IcoSettings width={16} height={16} /> Editar Workspace</button>
            </form>
            <Link href={`/owner/clientes/${alvo.id}`}><IcoUsers width={16} height={16} /> Ver Cliente</Link>
            <div className="sep" />
            <form action={mudarStatusClienteAction}>
              <input type="hidden" name="negocio_id" value={alvo.id} />
              <input type="hidden" name="status" value={alvo.status === "arquivado" ? "ativo" : "arquivado"} />
              <button type="submit">
                <IcoArchive width={16} height={16} />
                {alvo.status === "arquivado" ? "Reativar" : "Arquivar"}
              </button>
            </form>
            <form action={excluirClienteAction} onSubmit={(e) => { if (!confirm("Excluir permanentemente este workspace e todos os dados? Não dá pra desfazer.")) e.preventDefault(); }}>
              <input type="hidden" name="negocio_id" value={alvo.id} />
              <button type="submit" className="danger"><IcoTrash width={16} height={16} /> Excluir permanentemente</button>
            </form>
          </div>
        </>
      )}
    </>
  );
}
