import PageHead from "@/components/page-head";
import { listNegocios } from "@/lib/data";
import { IcoGlobe } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function SitesPage() {
  const clientes = await listNegocios();
  const comSite = clientes.filter((c) => c.site_url);

  return (
    <>
      <PageHead eyebrow="Plataforma" titulo="Sites" sub="Os sites dos clientes hospedados/vinculados." />
      <div className="cols-3">
        {comSite.map((c) => (
          <div key={c.id} className="card">
            <div className="row" style={{ gap: 10 }}>
              <div className="icon-box"><IcoGlobe width={18} height={18} /></div>
              <div style={{ minWidth: 0 }}>
                <strong>{c.nome_fantasia || c.nome}</strong>
                <div className="muted" style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.site_url}</div>
              </div>
            </div>
            <div className="row" style={{ marginTop: 14, gap: 8 }}>
              <span className="badge ok">no ar</span>
              <a className="btn btn-ghost btn-sm" href={c.site_url || "#"} target="_blank" rel="noreferrer" style={{ marginLeft: "auto" }}>Abrir</a>
            </div>
          </div>
        ))}
        {comSite.length === 0 && (
          <div className="card"><p className="muted" style={{ margin: 0 }}>Nenhum cliente com site cadastrado. Adicione a URL no cadastro do cliente.</p></div>
        )}
      </div>
    </>
  );
}
