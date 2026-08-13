import Link from "@/components/link";
import { contagens, listHubs } from "@/lib/data";
import { IcoHub, IcoUsers, IcoActivity, IcoSettings } from "@/components/icons";

export const dynamic = "force-dynamic";

function Kpi({ n, label, Icon }: { n: number; label: string; Icon: typeof IcoHub }) {
  return (
    <div className="card">
      <div className="spread">
        <div className="icon-box sm">
          <Icon width={17} height={17} />
        </div>
      </div>
      <div className="kpi" style={{ marginTop: 14 }}>
        {n}
      </div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}

export default async function OwnerHome() {
  const [c, hubs] = await Promise.all([contagens(), listHubs()]);
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Console do owner</div>
          <h1>Visão geral</h1>
          <p className="muted">A plataforma inteira num lugar só.</p>
        </div>
      </div>

      <div className="cols-4">
        <Kpi n={c.hubs} label="Hubs" Icon={IcoHub} />
        <Kpi n={c.clientes} label="Clientes" Icon={IcoUsers} />
        <Kpi n={c.ativos} label="Ativos" Icon={IcoActivity} />
        <Kpi n={c.em_config} label="Em configuração" Icon={IcoSettings} />
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="spread">
          <h2 style={{ margin: 0, fontSize: 18 }}>Hubs</h2>
          <Link className="btn btn-ghost btn-sm" href="/owner/hubs">
            Gerenciar
          </Link>
        </div>
        <div className="grid" style={{ marginTop: 14, gap: 10 }}>
          {hubs.length === 0 ? (
            <p className="muted">Nenhum hub ainda.</p>
          ) : (
            hubs.map((h) => (
              <div key={h.id} className="spread" style={{ padding: "10px 0", borderTop: "1px solid var(--line)" }}>
                <div className="row" style={{ gap: 11 }}>
                  <div className="icon-box sm">
                    <IcoHub width={16} height={16} />
                  </div>
                  <div>
                    <strong>{h.nome}</strong>
                    <div className="muted" style={{ fontSize: 12 }}>
                      /{h.slug}
                    </div>
                  </div>
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
