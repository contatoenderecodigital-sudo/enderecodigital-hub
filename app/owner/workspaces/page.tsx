import PageHead from "@/components/page-head";
import NovoClienteModal from "@/components/novo-cliente-modal";
import WorkspacesTable from "@/components/workspaces-table";
import { listWorkspaces, listHubs } from "@/lib/data";
import { IcoActivity, IcoSettings, IcoAlert, IcoServer, IcoShield } from "@/components/icons";

export const dynamic = "force-dynamic";

function Kpi({ n, label, Icon }: { n: number | string; label: string; Icon: typeof IcoActivity }) {
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

export default async function WorkspacesPage() {
  const [ws, hubs] = await Promise.all([listWorkspaces(), listHubs()]);
  const ativos = ws.filter((w) => w.status === "ativo").length;
  const emConfig = ws.filter((w) => w.status === "em_configuracao").length;
  const integracoes = ws.reduce((a, w) => a + w.integracoes, 0);
  const saude = ws.length ? Math.round(ws.reduce((a, w) => a + w.health_score, 0) / ws.length) : 100;

  return (
    <>
      <PageHead
        eyebrow="Usuários"
        titulo="Workspaces"
        sub="Os ambientes operacionais de cada cliente — módulos, integrações, acessos e status."
        acao={<NovoClienteModal hubs={hubs} />}
      />

      <div className="cols-5">
        <Kpi n={ativos} label="Ativos" Icon={IcoActivity} />
        <Kpi n={emConfig} label="Em configuração" Icon={IcoSettings} />
        <Kpi n={0} label="Com alertas" Icon={IcoAlert} />
        <Kpi n={integracoes} label="Integrações ativas" Icon={IcoServer} />
        <Kpi n={`${saude}%`} label="Saúde média" Icon={IcoShield} />
      </div>

      <div style={{ marginTop: 18 }}>
        <WorkspacesTable
          items={ws.map((w) => ({
            id: w.id,
            nome: w.nome,
            nome_fantasia: w.nome_fantasia,
            slug: w.slug,
            marca_cor: w.marca_cor,
            status: w.status,
            health_score: w.health_score,
            resp_nome: w.resp_nome,
            dominio: w.dominio,
            site_url: w.site_url,
            hub_nome: w.hub_nome,
          }))}
        />
      </div>
    </>
  );
}
