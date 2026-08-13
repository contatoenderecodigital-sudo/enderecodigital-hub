import PageHead from "@/components/page-head";
import { listAuditoria } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AuditoriaPage() {
  const logs = await listAuditoria(80);
  return (
    <>
      <PageHead eyebrow="Sistema" titulo="Auditoria" sub="Trilha de quem fez o que na plataforma." />
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ paddingLeft: 20 }}>Ação</th>
                <th>Ator</th>
                <th>Detalhe</th>
                <th>Quando</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td style={{ paddingLeft: 20 }}><span className="badge">{l.acao}</span></td>
                  <td className="muted">{l.ator_usuario_id}</td>
                  <td className="muted">{l.detalhe || "—"}</td>
                  <td className="muted">{new Date(l.criado_em).toLocaleString("pt-BR")}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={4} className="muted" style={{ paddingLeft: 20 }}>Sem eventos registrados ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
