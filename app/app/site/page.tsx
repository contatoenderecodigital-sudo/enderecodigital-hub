import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { activeNegocioId } from "@/lib/tenant";
import { getNegocio } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function SitePage() {
  const s = await getSession();
  const neg = activeNegocioId(s);
  if (!neg) redirect("/login");
  const negocio = await getNegocio(neg);
  if (!negocio) redirect("/login");
  const url = negocio.site_url;

  return (
    <>
      <div className="spread">
        <div>
          <div className="kpi-label gold">Módulo</div>
          <h1 style={{ margin: "4px 0 0" }}>Meu site</h1>
        </div>
        {url && (
          <a className="btn btn-ghost btn-sm" href={url} target="_blank" rel="noreferrer">
            Abrir em nova aba
          </a>
        )}
      </div>

      {url ? (
        <div className="card" style={{ marginTop: 16, padding: 0, overflow: "hidden" }}>
          <iframe
            src={url}
            style={{ width: "100%", height: "70vh", border: "none", background: "#fff" }}
            title="Site do cliente"
          />
        </div>
      ) : (
        <div className="card" style={{ marginTop: 16 }}>
          <p className="muted" style={{ margin: 0 }}>
            Nenhum site cadastrado. Adicione a URL do site no cadastro do cliente.
          </p>
        </div>
      )}
    </>
  );
}
