import PageHead from "@/components/page-head";
import { listAuditoriaFiltrada } from "@/lib/platform-config";
import { IcoSearch, IcoExternal } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; desde?: string; ate?: string }>;
}) {
  const sp = await searchParams;
  const logs = await listAuditoriaFiltrada({ q: sp.q, desde: sp.desde, ate: sp.ate });
  const exportUrl = "/api/owner/auditoria/export?" + new URLSearchParams(
    Object.entries({ q: sp.q, desde: sp.desde, ate: sp.ate }).filter(([, v]) => v) as [string, string][]
  ).toString();

  return (
    <>
      <PageHead
        eyebrow="Sistema"
        titulo="Log de Auditoria"
        sub="Histórico detalhado de ações operacionais e eventos de segurança."
        acao={<a className="btn" href={exportUrl}><IcoExternal width={15} height={15} /> Exportar CSV</a>}
      />

      <form className="toolbar" action="/owner/auditoria">
        <div className="search-box">
          <IcoSearch width={16} height={16} />
          <input name="q" defaultValue={sp.q || ""} placeholder="Buscar por ator, entidade ou tipo de evento…" />
        </div>
        <div className="row" style={{ gap: 8 }}>
          <input name="desde" type="date" defaultValue={sp.desde || ""} className="filter-select" title="De" />
          <input name="ate" type="date" defaultValue={sp.ate || ""} className="filter-select" title="Até" />
          <button className="btn btn-ghost" type="submit">Filtrar</button>
        </div>
      </form>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ paddingLeft: 20 }}>Evento</th>
                <th>Ator</th>
                <th>Detalhes</th>
                <th>Quando</th>
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
                      <code style={{ background: "rgba(0,0,0,0.28)", border: "1px solid var(--line)", borderRadius: 8, padding: "3px 8px", fontSize: 12 }}>{l.detalhe.slice(0, 80)}</code>
                    ) : "—"}
                  </td>
                  <td className="muted" style={{ fontSize: 12.5 }}>{new Date(l.criado_em).toLocaleString("pt-BR")}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={4} className="muted" style={{ paddingLeft: 20, padding: 40, textAlign: "center" }}>
                  {sp.q || sp.desde || sp.ate ? "Nenhum evento com esses filtros." : "Sem eventos registrados ainda. Ações como arquivar, excluir e conectar WhatsApp aparecem aqui."}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
