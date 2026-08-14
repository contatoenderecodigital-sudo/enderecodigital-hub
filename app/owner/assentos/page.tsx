import PageHead from "@/components/page-head";
import { listAssentos } from "@/lib/platform-config";
import { novoAssentoAction, statusAssentoAction, excluirAssentoAction } from "@/app/owner/actions";
import { hubOpId } from "@/lib/hub-ctx";
import { IcoKey, IcoPlus, IcoTrash } from "@/components/icons";

export const dynamic = "force-dynamic";

const COR: Record<string, string> = { ativo: "ok", reautenticar: "warn", inativo: "" };

export default async function AssentosPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const { ok } = await searchParams;
  const hub = await hubOpId();
  const assentos = hub ? await listAssentos() : [];
  const ativos = assentos.filter((a) => a.status === "ativo").length;

  return (
    <>
      <PageHead
        eyebrow="Plataforma"
        titulo="Assentos Claude"
        sub={`Provisionamento de IA por cliente — ${ativos} ativo(s).`}
      />

      {ok && <div className="owner-banner" style={{ borderRadius: 12, marginBottom: 16 }}>Assento cadastrado.</div>}

      <div className="card glass-soft" style={{ marginBottom: 18, fontSize: 13, lineHeight: 1.6 }}>
        O padrão da plataforma é a <strong>API Anthropic central</strong> com custo medido — previsível e sem risco de ban.
        Assento é a exceção: só quando o cliente traz a própria assinatura Claude. Aqui guardamos apenas a
        <strong> referência</strong> do token (apelido/arquivo) — o token cru vive só na VPS (root 0600), nunca no banco.
      </div>

      {!hub ? (
        <div className="err">Entre em um hub para gerenciar os assentos dele.</div>
      ) : (
        <>
          <details className="card" style={{ marginBottom: 18 }}>
            <summary style={{ cursor: "pointer", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              <IcoPlus width={16} height={16} /> Novo assento
            </summary>
            <form action={novoAssentoAction} className="cols-3" style={{ gap: 12, marginTop: 14 }}>
              <div><label>Cliente *</label><input name="cliente" required /></div>
              <div>
                <label>Plano</label>
                <select name="plano" className="filter-select" style={{ width: "100%" }}>
                  <option>Pro</option><option>Max</option><option>Max20x</option><option>Team</option>
                </select>
              </div>
              <div><label>Referência do token</label><input name="token_ref" placeholder="apelido do arquivo na VPS" /></div>
              <div style={{ gridColumn: "1 / -1" }}><label>Notas</label><input name="notas" /></div>
              <div style={{ gridColumn: "1 / -1" }}><button className="btn" type="submit"><IcoPlus width={15} height={15} /> Cadastrar assento</button></div>
            </form>
          </details>

          {assentos.length === 0 ? (
            <div className="card" style={{ display: "grid", placeItems: "center", padding: 56, textAlign: "center" }}>
              <div className="icon-box" style={{ width: 56, height: 56 }}><IcoKey width={26} height={26} /></div>
              <strong style={{ marginTop: 16, fontSize: 16 }}>Nenhum assento cadastrado</strong>
              <p className="muted" style={{ margin: "4px 0 0", maxWidth: 420 }}>
                A plataforma usa a API central. Crie um assento só se um cliente for trazer a própria assinatura Claude.
              </p>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div className="table-wrap">
                <table>
                  <thead><tr><th style={{ paddingLeft: 20 }}>Cliente</th><th>Plano</th><th>Referência</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {assentos.map((a) => (
                      <tr key={a.id}>
                        <td style={{ paddingLeft: 20 }}><strong>{a.cliente}</strong>{a.notas && <div className="muted" style={{ fontSize: 12 }}>{a.notas}</div>}</td>
                        <td><span className="badge" style={{ fontSize: 10 }}>{a.plano}</span></td>
                        <td className="muted" style={{ fontSize: 12.5, fontFamily: "ui-monospace, monospace" }}>{a.token_ref || "—"}</td>
                        <td>
                          <form action={statusAssentoAction} className="row" style={{ gap: 6 }}>
                            <input type="hidden" name="id" value={a.id} />
                            <select name="status" defaultValue={a.status} className="filter-select" style={{ fontSize: 12 }}>
                              <option value="ativo">ativo</option>
                              <option value="reautenticar">reautenticar</option>
                              <option value="inativo">inativo</option>
                            </select>
                            <button className="btn btn-ghost btn-sm" type="submit">Salvar</button>
                            <span className={"badge " + (COR[a.status] || "")} style={{ fontSize: 10 }}>{a.status}</span>
                          </form>
                        </td>
                        <td style={{ textAlign: "right", paddingRight: 16 }}>
                          <form action={excluirAssentoAction}>
                            <input type="hidden" name="id" value={a.id} />
                            <button className="dots-btn" type="submit" aria-label="Excluir"><IcoTrash width={15} height={15} /></button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
