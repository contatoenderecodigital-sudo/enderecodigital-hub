import PageHead from "@/components/page-head";
import { listAuditoria } from "@/lib/data";
import { IcoSearch, IcoEye, IcoExternal } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function AuditoriaPage() {
  const logs = await listAuditoria(100);
  return (
    <>
      <PageHead
        eyebrow="Sistema"
        titulo="Log de Auditoria"
        sub="Histórico detalhado de ações operacionais e eventos de segurança."
        acao={<button className="btn"><IcoExternal width={15} height={15} /> Exportar relatório</button>}
      />

      <div className="toolbar">
        <div className="search-box">
          <IcoSearch width={16} height={16} />
          <input placeholder="Buscar por ator, entidade ou tipo de evento…" />
        </div>
        <button className="btn btn-ghost">Filtrar por data</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ paddingLeft: 20 }}>Evento</th>
                <th>Ator</th>
                <th>Detalhes</th>
                <th>Quando</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td style={{ paddingLeft: 20 }}>
                    <span className="badge" style={{ fontFamily: "ui-monospace, monospace", letterSpacing: "0.04em" }}>{l.acao}</span>
                  </td>
                  <td className="muted" style={{ fontFamily: "ui-monospace, monospace", fontSize: 12.5 }}>{l.ator_usuario_id.slice(0, 10)}</td>
                  <td className="muted">
                    {l.detalhe ? (
                      <code style={{ background: "rgba(0,0,0,0.28)", border: "1px solid var(--line)", borderRadius: 8, padding: "3px 8px", fontSize: 12 }}>{l.detalhe.slice(0, 60)}</code>
                    ) : "—"}
                  </td>
                  <td className="muted" style={{ fontSize: 12.5 }}>{new Date(l.criado_em).toLocaleString("pt-BR")}</td>
                  <td style={{ textAlign: "right", paddingRight: 20 }}>
                    <span className="dots-btn" style={{ display: "inline-grid" }}><IcoEye width={16} height={16} /></span>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={5} className="muted" style={{ paddingLeft: 20, padding: 40, textAlign: "center" }}>Sem eventos registrados ainda. Ações como arquivar, excluir e conectar WhatsApp aparecem aqui.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
