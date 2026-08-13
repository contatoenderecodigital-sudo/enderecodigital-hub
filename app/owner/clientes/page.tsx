import Link from "@/components/link";
import PageHead from "@/components/page-head";
import NovoClienteModal from "@/components/novo-cliente-modal";
import { listHubs, listNegocios } from "@/lib/data";
import { IcoActivity } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  const { ok } = await searchParams;
  const [hubs, clientes] = await Promise.all([listHubs(), listNegocios()]);
  const hubNome = new Map(hubs.map((h) => [h.id, h.nome]));

  return (
    <>
      <PageHead
        eyebrow="Usuários"
        titulo="Clientes"
        sub="Gestão de CRM operacional e ecossistema de organizações."
        acao={<NovoClienteModal hubs={hubs} />}
      />

      {ok && (
        <div className="owner-banner" style={{ borderRadius: 12, marginBottom: 16 }}>
          Cliente cadastrado com sucesso.
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ paddingLeft: 20 }}>Empresa</th>
                <th>Responsável</th>
                <th>Segmento</th>
                <th>Status</th>
                <th>Workspace</th>
                <th>Saúde</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id}>
                  <td style={{ paddingLeft: 20 }}>
                    <div className="row" style={{ gap: 11 }}>
                      <div className="avatar" style={{ background: c.marca_cor || "#C9A961" }}>
                        {(c.nome_fantasia || c.nome).slice(0, 2).toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div className="row" style={{ gap: 6 }}>
                          <strong>{c.nome_fantasia || c.nome}</strong>
                          <span className="badge gold" style={{ fontSize: 10, padding: "2px 8px" }}>
                            {hubNome.get(c.hub_id) || "hub"}
                          </span>
                          {c.experimental && (
                            <span className="badge warn" style={{ fontSize: 10, padding: "2px 8px" }}>experimental</span>
                          )}
                        </div>
                        <div className="muted" style={{ fontSize: 12 }}>{c.nome}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    {c.resp_nome ? (
                      <div>
                        <div>{c.resp_nome}</div>
                        <div className="muted" style={{ fontSize: 12 }}>{c.resp_email || c.resp_whatsapp || ""}</div>
                      </div>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="muted">{c.segmento || "—"}</td>
                  <td>
                    <span className={"badge " + (c.status === "ativo" ? "ok" : "warn")}>{c.status}</span>
                  </td>
                  <td className="muted" style={{ fontSize: 12.5 }}>/{c.slug}</td>
                  <td>
                    <span className="row" style={{ gap: 6 }}>
                      <IcoActivity width={14} height={14} />
                      {c.health_score}%
                    </span>
                  </td>
                  <td style={{ textAlign: "right", paddingRight: 20 }}>
                    <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                      <Link className="btn btn-ghost btn-sm" href={`/owner/clientes/${c.id}`}>Ver</Link>
                      <form action="/api/impersonar" method="post">
                        <input type="hidden" name="negocio_id" value={c.id} />
                        <button className="btn btn-ghost btn-sm" type="submit">Abrir</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {clientes.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted" style={{ paddingLeft: 20 }}>Nenhum cliente ainda. Clique em Novo cliente.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
