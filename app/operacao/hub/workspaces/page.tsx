import { redirect } from "next/navigation";
import { Activity, Settings, TriangleAlert, Server, Shield } from "lucide-react";
import { listWorkspaces } from "@/lib/data";
import { hubOpId } from "@/lib/hub-ctx";
import PageHeader from "@/components/groow/admin/ed2/PageHeader";
import StatCard from "@/components/groow/admin/ed2/StatCard";
import WorkspacesHub from "@/components/groow/hub/workspaces-hub";

export const dynamic = "force-dynamic";

export default async function HubWorkspacesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  const { ok } = await searchParams;
  const hub = await hubOpId();
  if (!hub) redirect("/owner");
  const ws = await listWorkspaces(hub);

  const ativos = ws.filter((w) => w.status === "ativo").length;
  const emConfig = ws.filter((w) => w.status === "em_configuracao").length;
  const integracoes = ws.reduce((a, w) => a + w.integracoes, 0);
  const saude = ws.length ? Math.round(ws.reduce((a, w) => a + w.health_score, 0) / ws.length) : 100;

  return (
    <>
      <PageHeader title="Workspaces" sub="Os ambientes operacionais de cada cliente — módulos, integrações, acessos e status." />

      {ok === "del" && (
        <div style={{ background: "rgba(52,199,89,0.10)", border: "1px solid rgba(52,199,89,0.25)", color: "#1d8a3a", borderRadius: 16, padding: "12px 18px", fontSize: 13.5, fontWeight: 500, marginBottom: 18 }}>
          Workspace excluído.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 22 }}>
        <StatCard label="Ativos" value={String(ativos)} spark={<Activity size={20} />} />
        <StatCard label="Em configuração" value={String(emConfig)} spark={<Settings size={20} />} />
        <StatCard label="Com alertas" value="0" spark={<TriangleAlert size={20} />} />
        <StatCard label="Integrações ativas" value={String(integracoes)} spark={<Server size={20} />} />
        <StatCard label="Saúde média" value={`${saude}%`} spark={<Shield size={20} />} />
      </div>

      <WorkspacesHub
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
    </>
  );
}
