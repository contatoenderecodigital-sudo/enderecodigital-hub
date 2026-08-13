import Link from "@/components/link";
import { listWorkspaces } from "@/lib/data";

export const dynamic = "force-dynamic";

function Kpi({ n, label }: { n: number | string; label: string }) {
  return (
    <div className="card">
      <div className="kpi">{n}</div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}
function Mini({ n, l }: { n: number | string; l: string }) {
  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 18 }}>{n}</div>
      <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>{l}</div>
    </div>
  );
}

export default async function WorkspacesPage() {
  const ws = await listWorkspaces();
  const ativos = ws.filter((w) => w.status === "ativo").length;
  const emConfig = ws.filter((w) => w.status === "em_configuracao").length;
  const saude = ws.length ? Math.round(ws.reduce((a, w) => a + w.health_score, 0) / ws.length) : 0;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Usuários</div>
          <h1>Workspaces</h1>
          <p className="muted">Os ambientes dos clientes, num olhar.</p>
        </div>
      </div>

      <div className="cols-4">
        <Kpi n={ws.length} label="Workspaces" />
        <Kpi n={ativos} label="Ativos" />
        <Kpi n={emConfig} label="Em configuração" />
        <Kpi n={`${saude}%`} label="Saúde média" />
      </div>

      <div className="cols-3" style={{ marginTop: 18 }}>
        {ws.map((w) => (
          <div key={w.id} className="card">
            <div className="spread">
              <div className="row" style={{ gap: 10 }}>
                <div className="avatar" style={{ background: w.marca_cor || "#C9A961" }}>
                  {(w.nome_fantasia || w.nome).slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <strong>{w.nome_fantasia || w.nome}</strong>
                  <div className="muted" style={{ fontSize: 12 }}>{w.hub_nome}</div>
                </div>
              </div>
              <span className={"badge " + (w.status === "ativo" ? "ok" : "warn")}>{w.status}</span>
            </div>
            <div className="row" style={{ gap: 20, marginTop: 16 }}>
              <Mini n={w.leads} l="Leads" />
              <Mini n={w.interacoes} l="IA" />
              <Mini n={`${w.health_score}%`} l="Saúde" />
            </div>
            <div className="row" style={{ gap: 8, marginTop: 16 }}>
              <Link className="btn btn-ghost btn-sm" href={`/owner/clientes/${w.id}`}>Ver cliente</Link>
              <form action="/api/impersonar" method="post">
                <input type="hidden" name="negocio_id" value={w.id} />
                <button className="btn btn-sm" type="submit">Abrir</button>
              </form>
            </div>
          </div>
        ))}
        {ws.length === 0 && <p className="muted">Nenhum workspace ainda.</p>}
      </div>
    </>
  );
}
