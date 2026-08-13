import Link from "@/components/link";
import { listHubs, listNegocios } from "@/lib/data";
import { criarClienteAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const [hubs, clientes] = await Promise.all([listHubs(), listNegocios()]);
  const hubNome = new Map(hubs.map((h) => [h.id, h.nome]));

  return (
    <>
      <div className="kpi-label gold">Plataforma</div>
      <h1 style={{ margin: "4px 0 18px" }}>Clientes</h1>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Hub</th>
              <th>Segmento</th>
              <th>Status</th>
              <th>Saúde</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((c) => (
              <tr key={c.id}>
                <td>
                  <strong>{c.nome_fantasia || c.nome}</strong>
                  <div className="muted" style={{ fontSize: 12 }}>
                    /{c.slug}
                  </div>
                </td>
                <td className="muted">{hubNome.get(c.hub_id) || "—"}</td>
                <td className="muted">{c.segmento || "—"}</td>
                <td>
                  <span className={"badge " + (c.status === "ativo" ? "ok" : "warn")}>
                    {c.status}
                  </span>
                </td>
                <td className="muted">{c.health_score}%</td>
                <td style={{ textAlign: "right" }}>
                  <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                    <Link className="btn btn-ghost btn-sm" href={`/owner/clientes/${c.id}`}>
                      Ver
                    </Link>
                    <form action="/api/impersonar" method="post">
                      <input type="hidden" name="negocio_id" value={c.id} />
                      <button className="btn btn-ghost btn-sm" type="submit">
                        Abrir workspace
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {clientes.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  Nenhum cliente ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h2 style={{ margin: "0 0 6px", fontSize: 17 }}>Novo cliente</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Nasce como um workspace dentro do hub escolhido.
        </p>
        <form action={criarClienteAction}>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div>
              <label htmlFor="hub_id">Hub</label>
              <select id="hub_id" name="hub_id" required defaultValue={hubs[0]?.id || ""}>
                {hubs.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="segmento">Segmento / nicho</label>
              <input id="segmento" name="segmento" placeholder="Ex.: Padaria" />
            </div>
            <div>
              <label htmlFor="nome">Razão social</label>
              <input id="nome" name="nome" required />
            </div>
            <div>
              <label htmlFor="nome_fantasia">Nome fantasia</label>
              <input id="nome_fantasia" name="nome_fantasia" />
            </div>
            <div>
              <label htmlFor="marca_cor">Cor da marca</label>
              <input id="marca_cor" name="marca_cor" placeholder="#C0392B" />
            </div>
            <div>
              <label htmlFor="resp_nome">Responsável</label>
              <input id="resp_nome" name="resp_nome" />
            </div>
            <div>
              <label htmlFor="resp_whatsapp">WhatsApp comercial</label>
              <input id="resp_whatsapp" name="resp_whatsapp" />
            </div>
            <div>
              <label htmlFor="instagram_url">Instagram (URL)</label>
              <input id="instagram_url" name="instagram_url" />
            </div>
            <div>
              <label htmlFor="site_url">Site atual (URL)</label>
              <input id="site_url" name="site_url" />
            </div>
            <div>
              <label htmlFor="resp_email">E-mail de contato</label>
              <input id="resp_email" name="resp_email" type="email" />
            </div>
          </div>

          <div
            style={{
              marginTop: 16,
              paddingTop: 14,
              borderTop: "1px solid var(--cor-borda)",
            }}
          >
            <div className="kpi-label">Acesso do cliente</div>
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 8 }}>
              <div>
                <label htmlFor="email">E-mail de login</label>
                <input id="email" name="email" type="email" />
              </div>
              <div>
                <label htmlFor="senha">Senha inicial</label>
                <input id="senha" name="senha" type="text" placeholder="mín. 8 caracteres" />
              </div>
            </div>
          </div>

          <button className="btn" type="submit" style={{ marginTop: 18 }}>
            Cadastrar cliente
          </button>
        </form>
      </div>
    </>
  );
}
