import PageHead from "@/components/page-head";
import { listRelatorios } from "@/lib/ops";
import { IcoExternal } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function RelatoriosPage() {
  const rels = await listRelatorios();
  return (
    <>
      <PageHead eyebrow="Agência · GROOW OS" titulo="Relatórios" sub="Relatórios white-label por cliente — cada um vira um link público com token pra você mandar." />
      {rels.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 44 }}><p className="muted" style={{ margin: 0 }}>Nenhum relatório ainda.</p></div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ paddingLeft: 20 }}>Cliente</th>
                  <th>Período</th>
                  <th>Atualizado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rels.map((r) => (
                  <tr key={r.id}>
                    <td style={{ paddingLeft: 20 }}><strong>{r.cliente}</strong></td>
                    <td className="muted">{r.periodo}</td>
                    <td className="muted" style={{ fontSize: 12.5 }}>{new Date(r.updated_at).toLocaleDateString("pt-BR")}</td>
                    <td style={{ textAlign: "right", paddingRight: 16 }}>
                      <a className="btn btn-ghost btn-sm" href={`/r/${r.token}`} target="_blank" rel="noreferrer"><IcoExternal width={13} height={13} /> Link público</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
