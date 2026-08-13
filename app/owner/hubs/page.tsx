import { listHubs } from "@/lib/data";
import { criarHubAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function HubsPage() {
  const hubs = await listHubs();
  return (
    <>
      <div className="kpi-label gold">Plataforma</div>
      <h1 style={{ margin: "4px 0 18px" }}>Hubs</h1>

      <div className="grid" style={{ gridTemplateColumns: "1.4fr 1fr", alignItems: "start" }}>
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Hub</th>
                <th>Slug</th>
                <th>Tema</th>
                <th>Módulos</th>
              </tr>
            </thead>
            <tbody>
              {hubs.map((h) => (
                <tr key={h.id}>
                  <td>
                    <strong>{h.nome}</strong>
                  </td>
                  <td className="muted">{h.slug}</td>
                  <td>
                    <span className="badge">{h.tema_modo}</span>
                  </td>
                  <td className="muted">
                    {[
                      h.mod_site && "Site",
                      h.mod_instagram && "Instagram",
                      h.mod_crm && "CRM",
                      h.mod_financeiro && "Financeiro",
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </td>
                </tr>
              ))}
              {hubs.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted">
                    Nenhum hub ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2 style={{ margin: "0 0 6px", fontSize: 17 }}>Novo hub</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Uma marca white-label completa.
          </p>
          <form action={criarHubAction}>
            <label htmlFor="nome">Nome do hub</label>
            <input id="nome" name="nome" placeholder="Ex.: ClinicDigital" required />

            <label htmlFor="tema_modo">Tema</label>
            <select id="tema_modo" name="tema_modo" defaultValue="escuro">
              <option value="escuro">Escuro</option>
              <option value="claro">Claro</option>
            </select>

            <label htmlFor="cor_destaque">Cor de destaque</label>
            <input id="cor_destaque" name="cor_destaque" defaultValue="#C9A961" />

            <div style={{ marginTop: 14 }}>
              <label style={{ margin: 0 }}>Módulos padrão</label>
              <div className="row" style={{ flexWrap: "wrap", gap: 16, marginTop: 8 }}>
                <label className="row" style={{ margin: 0 }}>
                  <input type="checkbox" name="mod_site" defaultChecked style={{ width: "auto" }} /> Site
                </label>
                <label className="row" style={{ margin: 0 }}>
                  <input type="checkbox" name="mod_instagram" defaultChecked style={{ width: "auto" }} />{" "}
                  Instagram
                </label>
                <label className="row" style={{ margin: 0 }}>
                  <input type="checkbox" name="mod_crm" style={{ width: "auto" }} /> CRM
                </label>
                <label className="row" style={{ margin: 0 }}>
                  <input type="checkbox" name="mod_financeiro" style={{ width: "auto" }} /> Financeiro
                </label>
              </div>
            </div>

            <button className="btn" type="submit" style={{ width: "100%", marginTop: 18 }}>
              Criar hub
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
