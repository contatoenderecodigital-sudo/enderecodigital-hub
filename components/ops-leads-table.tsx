"use client";

import { useTransition } from "react";
import { moverLeadAction, excluirLeadAction } from "@/app/owner/ops/actions";
import { IcoWhatsapp, IcoTrash } from "@/components/icons";
import type { OpsLead } from "@/lib/ops";

const STATUS = ["novo", "contatado", "diagnostico", "proposta", "fechado", "perdido", "frio", "quente"];
const COR: Record<string, string> = {
  novo: "", contatado: "gold", diagnostico: "gold", proposta: "gold",
  fechado: "ok", perdido: "", frio: "", quente: "warn",
};

function tempo(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (d < 1) return "hoje";
  if (d < 2) return "ontem";
  if (d < 30) return `${Math.floor(d)}d`;
  return `${Math.floor(d / 30)}m`;
}

export default function OpsLeadsTable({ leads }: { leads: OpsLead[] }) {
  const [pending, start] = useTransition();

  function mover(id: number, status: string) {
    const fd = new FormData();
    fd.set("id", String(id));
    fd.set("status", status);
    start(() => moverLeadAction(fd));
  }
  function excluir(id: number, nome: string) {
    if (!confirm(`Excluir o lead "${nome}"? Não dá pra desfazer.`)) return;
    const fd = new FormData();
    fd.set("id", String(id));
    start(() => excluirLeadAction(fd));
  }

  if (leads.length === 0) {
    return (
      <div className="card" style={{ textAlign: "center", padding: 44 }}>
        <p className="muted" style={{ margin: 0 }}>Nenhum lead ainda. Crie o primeiro acima ou importe da prospecção.</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden", opacity: pending ? 0.7 : 1 }}>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ paddingLeft: 20 }}>Lead</th>
              <th>Contato</th>
              <th>Origem</th>
              <th>Status</th>
              <th>Quando</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id}>
                <td style={{ paddingLeft: 20 }}>
                  <div className="row" style={{ gap: 10 }}>
                    <div className="avatar" style={{ width: 34, height: 34, fontSize: 12 }}>
                      {(l.empresa || l.nome).slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <strong>{l.nome}</strong>
                      {l.empresa && <div className="muted" style={{ fontSize: 12 }}>{l.empresa}</div>}
                    </div>
                  </div>
                </td>
                <td className="muted" style={{ fontSize: 13 }}>
                  {l.whatsapp ? (
                    <a className="row" style={{ gap: 6, color: "var(--muted-2)" }} href={`https://wa.me/${l.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                      <IcoWhatsapp width={14} height={14} /> {l.whatsapp}
                    </a>
                  ) : l.email || "—"}
                </td>
                <td className="muted" style={{ fontSize: 12.5 }}>
                  {l.origem || "—"}
                  {l.fonte_trafego && <span className="badge" style={{ marginLeft: 6, fontSize: 10 }}>{l.fonte_trafego}</span>}
                </td>
                <td>
                  <select
                    className="filter-select"
                    value={l.status}
                    onChange={(e) => mover(l.id, e.target.value)}
                    style={{ padding: "5px 8px", fontSize: 12.5 }}
                  >
                    {STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="muted" style={{ fontSize: 12.5 }}>{tempo(l.created_at)}</td>
                <td style={{ textAlign: "right", paddingRight: 16 }}>
                  <button className="dots-btn" onClick={() => excluir(l.id, l.nome)} aria-label="Excluir">
                    <IcoTrash width={15} height={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
