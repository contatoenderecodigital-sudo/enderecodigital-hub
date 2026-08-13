"use client";

import { useState } from "react";
import Link from "@/components/link";
import type { Negocio } from "@/lib/types";
import { mudarStatusClienteAction, excluirClienteAction } from "@/app/owner/clientes/actions";
import { IcoSearch, IcoActivity, IcoUsers, IcoSettings, IcoArchive, IcoTrash, IcoDots } from "@/components/icons";

type Hub = { id: string; nome: string };

export default function ClientesTable({ clientes, hubs }: { clientes: Negocio[]; hubs: Hub[] }) {
  const hubNome = new Map(hubs.map((h) => [h.id, h.nome]));
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("todos");
  const [menu, setMenu] = useState<{ id: string; top: number; left: number } | null>(null);

  const filtrados = clientes.filter((c) => {
    if (status !== "todos" && c.status !== status) return false;
    if (q.trim()) {
      const campos = [c.nome, c.nome_fantasia, c.resp_nome, c.resp_email, c.slug]
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

  const alvo = menu ? clientes.find((c) => c.id === menu.id) : null;

  return (
    <>
      <div className="toolbar">
        <div className="search-box">
          <IcoSearch width={16} height={16} />
          <input
            placeholder="Buscar por empresa, responsável, e-mail…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
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
                <th style={{ paddingLeft: 20 }}>Empresa</th>
                <th>Responsável</th>
                <th>Segmento</th>
                <th>Status</th>
                <th>Workspace</th>
                <th>Saúde</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => (
                <tr key={c.id}>
                  <td style={{ paddingLeft: 20 }}>
                    <div className="row" style={{ gap: 11 }}>
                      <div className="avatar" style={{ background: c.marca_cor || "#C9A961" }}>
                        {(c.nome_fantasia || c.nome).slice(0, 2).toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div className="row" style={{ gap: 6 }}>
                          <strong>{c.nome_fantasia || c.nome}</strong>
                          <span className="badge gold" style={{ fontSize: 10, padding: "2px 8px" }}>
                            {hubNome.get(c.hub_id) || "hub"}
                          </span>
                          {c.experimental && (
                            <span className="badge warn" style={{ fontSize: 10, padding: "2px 8px" }}>experimental</span>
                          )}
                        </div>
                        <div className="muted" style={{ fontSize: 12 }}>{c.nome}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    {c.resp_nome ? (
                      <div>
                        <div>{c.resp_nome}</div>
                        <div className="muted" style={{ fontSize: 12 }}>{c.resp_email || c.resp_whatsapp || ""}</div>
                      </div>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="muted">{c.segmento || "—"}</td>
                  <td>
                    <span className={"badge " + (c.status === "ativo" ? "ok" : "warn")}>{c.status}</span>
                  </td>
                  <td className="muted" style={{ fontSize: 12.5 }}>/{c.slug}</td>
                  <td>
                    <span className="row" style={{ gap: 6 }}>
                      <IcoActivity width={14} height={14} />
                      {c.health_score}%
                    </span>
                  </td>
                  <td style={{ textAlign: "right", paddingRight: 20 }}>
                    <button className="dots-btn" onClick={(e) => abrir(e, c.id)} aria-label="Ações">
                      <IcoDots width={18} height={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted" style={{ paddingLeft: 20 }}>
                    {clientes.length === 0 ? "Nenhum cliente ainda. Clique em Novo cliente." : "Nenhum cliente encontrado."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {menu && alvo && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 25 }} onClick={() => setMenu(null)} />
          <div className="menu" style={{ position: "fixed", top: menu.top, left: menu.left, right: "auto" }}>
            <form action="/api/impersonar" method="post">
              <input type="hidden" name="negocio_id" value={alvo.id} />
              <input type="hidden" name="destino" value="/app/config-hub" />
              <button type="submit"><IcoSettings width={16} height={16} /> Editar Workspace</button>
            </form>
            <Link href={`/owner/clientes/${alvo.id}`}>
              <IcoUsers width={16} height={16} /> Ver Cliente
            </Link>
            <div className="sep" />
            <form action={mudarStatusClienteAction}>
              <input type="hidden" name="negocio_id" value={alvo.id} />
              <input type="hidden" name="status" value={alvo.status === "arquivado" ? "ativo" : "arquivado"} />
              <button type="submit">
                <IcoArchive width={16} height={16} />
                {alvo.status === "arquivado" ? "Reativar" : "Arquivar"}
              </button>
            </form>
            <form action={excluirClienteAction} onSubmit={(e) => { if (!confirm("Excluir permanentemente este cliente e todos os dados? Não dá pra desfazer.")) e.preventDefault(); }}>
              <input type="hidden" name="negocio_id" value={alvo.id} />
              <button type="submit" className="danger"><IcoTrash width={16} height={16} /> Excluir permanentemente</button>
            </form>
          </div>
        </>
      )}
    </>
  );
}
