import Link from "@/components/link";
import PageHead from "@/components/page-head";
import { listWorkspaces, listHubs } from "@/lib/data";
import {
  IcoUsers,
  IcoActivity,
  IcoFunnel,
  IcoSparkles,
  IcoShield,
  IcoHub,
} from "@/components/icons";

export const dynamic = "force-dynamic";

function Kpi({ n, label, Icon }: { n: number | string; label: string; Icon: typeof IcoUsers }) {
  return (
    <div className="card">
      <div className="spread" style={{ alignItems: "flex-start" }}>
        <div className="kpi">{n}</div>
        <div className="icon-box sm"><Icon width={16} height={16} /></div>
      </div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}

export default async function Dashboard() {
  const [ws, hubs] = await Promise.all([listWorkspaces(), listHubs()]);
  const ativos = ws.filter((w) => w.status === "ativo").length;
  const emConfig = ws.filter((w) => w.status === "em_configuracao").length;
  const leads = ws.reduce((a, w) => a + w.leads, 0);
  const interacoes = ws.reduce((a, w) => a + w.interacoes, 0);
  const saude = ws.length ? Math.round(ws.reduce((a, w) => a + w.health_score, 0) / ws.length) : 100;

  return (
    <>
      <PageHead
        eyebrow="Operação"
        titulo="Dashboard"
        sub="A plataforma inteira num olhar."
        acao={<Link className="btn" href="/owner/clientes#novo-cliente">Novo cliente</Link>}
      />

      <div className="cols-4">
        <Kpi n={ws.length} label="Clientes" Icon={IcoUsers} />
        <Kpi n={ativos} label="Workspaces ativos" Icon={IcoActivity} />
        <Kpi n={leads} label="Leads no funil" Icon={IcoFunnel} />
        <Kpi n={interacoes} label="Conversas IA" Icon={IcoSparkles} />
      </div>

      <div className="cols-side" style={{ marginTop: 18 }}>
        {/* Clientes recentes */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="spread" style={{ padding: "16px 20px 6px" }}>
            <h2 style={{ margin: 0, fontSize: 17 }}>Clientes recentes</h2>
            <Link className="btn btn-ghost btn-sm" href="/owner/clientes">Ver todos</Link>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ paddingLeft: 20 }}>Empresa</th>
                  <th>Hub</th>
                  <th>Status</th>
                  <th>Saúde</th>
                </tr>
              </thead>
              <tbody>
                {ws.slice(0, 6).map((w) => (
                  <tr key={w.id}>
                    <td style={{ paddingLeft: 20 }}>
                      <div className="row" style={{ gap: 10 }}>
                        <div className="avatar" style={{ width: 32, height: 32, background: w.marca_cor || "#C9A961" }}>
                          {(w.nome_fantasia || w.nome).slice(0, 2).toUpperCase()}
                        </div>
                        <strong>{w.nome_fantasia || w.nome}</strong>
                      </div>
                    </td>
                    <td className="muted">{w.hub_nome}</td>
                    <td><span className={"badge " + (w.status === "ativo" ? "ok" : "warn")}>{w.status}</span></td>
                    <td className="muted">{w.health_score}%</td>
                  </tr>
                ))}
                {ws.length === 0 && (
                  <tr><td colSpan={4} className="muted" style={{ paddingLeft: 20 }}>Nenhum cliente ainda.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Coluna direita: saúde + hubs */}
        <div className="grid" style={{ gap: 16 }}>
          <div className="card">
            <div className="row" style={{ gap: 12 }}>
              <div className="icon-box"><IcoShield width={18} height={18} /></div>
              <div>
                <div className="kpi" style={{ fontSize: 26 }}>{saude}%</div>
                <div className="kpi-label">Saúde média · {emConfig} em config.</div>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="spread">
              <h2 style={{ margin: 0, fontSize: 16 }}>Hubs</h2>
              <Link className="btn btn-ghost btn-sm" href="/owner/hubs">Gerenciar</Link>
            </div>
            <div className="grid" style={{ gap: 8, marginTop: 12 }}>
              {hubs.map((h) => (
                <div key={h.id} className="row" style={{ gap: 10 }}>
                  <div className="icon-box sm"><IcoHub width={15} height={15} /></div>
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ fontSize: 14 }}>{h.nome}</strong>
                    <div className="muted" style={{ fontSize: 12 }}>/{h.slug}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
