import Link from "@/components/link";
import { contagens, listHubs } from "@/lib/data";

export const dynamic = "force-dynamic";

function Kpi({ n, label }: { n: number; label: string }) {
  return (
    <div className="card">
      <div className="kpi">{n}</div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}

export default async function OwnerHome() {
  const [c, hubs] = await Promise.all([contagens(), listHubs()]);
  return (
    <>
      <div className="kpi-label gold">Console do owner</div>
      <h1 style={{ margin: "4px 0 0" }}>Visão geral</h1>
      <p className="muted">A plataforma inteira num lugar só.</p>

      <div className="grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginTop: 20 }}>
        <Kpi n={c.hubs} label="Hubs" />
        <Kpi n={c.clientes} label="Clientes" />
        <Kpi n={c.ativos} label="Ativos" />
        <Kpi n={c.em_config} label="Em configuração" />
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="spread">
          <h2 style={{ margin: 0, fontSize: 18 }}>Hubs</h2>
          <Link className="btn btn-ghost btn-sm" href="/owner/hubs">
            Gerenciar
          </Link>
        </div>
        <div className="grid" style={{ marginTop: 14 }}>
          {hubs.length === 0 ? (
            <p className="muted">Nenhum hub ainda. Rode o bootstrap ou crie um.</p>
          ) : (
            hubs.map((h) => (
              <div key={h.id} className="spread">
                <div>
                  <strong>{h.nome}</strong>{" "}
                  <span className="muted">/{h.slug}</span>
                </div>
                <span className="badge">{h.tema_modo}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
