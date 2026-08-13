import PageHead from "@/components/page-head";
import SitesClient from "@/components/sites-client";
import { listNegocios } from "@/lib/data";
import { IcoGlobe, IcoActivity, IcoSettings, IcoServer } from "@/components/icons";

export const dynamic = "force-dynamic";

function Kpi({ n, label, Icon }: { n: number; label: string; Icon: typeof IcoGlobe }) {
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

export default async function SitesPage() {
  const clientes = await listNegocios();
  const total = clientes.length;
  const ativos = clientes.filter((c) => c.status === "ativo").length;
  const pausados = clientes.filter((c) => c.status === "em_configuracao").length;
  const comDominio = clientes.filter((c) => c.dominio).length;

  return (
    <>
      <PageHead eyebrow="Plataforma" titulo="Sites dos clientes" sub="Todos os sites dos clientes na plataforma." />

      <div className="cols-4">
        <Kpi n={total} label="Total de sites" Icon={IcoGlobe} />
        <Kpi n={ativos} label="Ativos" Icon={IcoActivity} />
        <Kpi n={pausados} label="Pausados" Icon={IcoSettings} />
        <Kpi n={comDominio} label="Com domínio" Icon={IcoServer} />
      </div>

      <div style={{ marginTop: 18 }}>
        <SitesClient
          items={clientes.map((c) => ({
            id: c.id,
            nome: c.nome,
            nome_fantasia: c.nome_fantasia,
            marca_cor: c.marca_cor,
            status: c.status,
            dominio: c.dominio,
            site_url: c.site_url,
            resp_nome: c.resp_nome,
          }))}
        />
      </div>
    </>
  );
}
