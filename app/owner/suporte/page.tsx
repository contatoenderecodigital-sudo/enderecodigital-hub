import PageHead from "@/components/page-head";
import { listTickets } from "@/lib/platform-config";
import { abrirTicketAction, resolverTicketAction } from "@/app/owner/actions";
import { hubOpId } from "@/lib/hub-ctx";
import { IcoHelp, IcoPlus } from "@/components/icons";

export const dynamic = "force-dynamic";

const PRIO: Record<string, string> = { alta: "warn", normal: "", baixa: "" };

export default async function SuportePage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const { ok } = await searchParams;
  const hub = await hubOpId();
  const tickets = hub ? await listTickets() : [];
  const abertos = tickets.filter((t) => t.status === "aberto").length;

  return (
    <>
      <PageHead eyebrow="Plataforma" titulo="Suporte" sub="Abra um chamado com o time do Endereço Digital e acompanhe o status." />

      {ok && <div className="owner-banner" style={{ borderRadius: 12, marginBottom: 16 }}>Chamado aberto. O time recebe e responde por aqui.</div>}

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="row" style={{ gap: 12, marginBottom: 4 }}>
          <div className="icon-box"><IcoHelp width={18} height={18} /></div>
          <div>
            <strong>Precisa de ajuda?</strong>
            <p className="muted" style={{ margin: "2px 0 0", fontSize: 13 }}>Descreva o que precisa. Também dá pra falar direto no WhatsApp do time.</p>
          </div>
        </div>
      </div>

      {!hub ? (
        <div className="err">Entre em um hub para abrir e acompanhar chamados dele.</div>
      ) : (
        <>
          <form action={abrirTicketAction} className="card" style={{ marginBottom: 18 }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}><IcoPlus width={13} height={13} /> Novo chamado</div>
            <div className="cols-2" style={{ gap: 14 }}>
              <div style={{ gridColumn: "1 / -1" }}><label>Assunto *</label><input name="assunto" required placeholder="Ex.: WhatsApp não conecta" /></div>
              <div style={{ gridColumn: "1 / -1" }}><label>Mensagem</label><textarea name="mensagem" rows={3} style={{ width: "100%", resize: "vertical" }} placeholder="Conte os detalhes…" /></div>
              <div>
                <label>Prioridade</label>
                <select name="prioridade" className="filter-select" style={{ width: "100%" }}>
                  <option value="baixa">baixa</option>
                  <option value="normal">normal</option>
                  <option value="alta">alta</option>
                </select>
              </div>
            </div>
            <div style={{ marginTop: 14 }}><button className="btn" type="submit"><IcoPlus width={15} height={15} /> Abrir chamado</button></div>
          </form>

          <div className="spread" style={{ marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, margin: 0 }}>Chamados</h2>
            <span className="badge">{abertos} aberto(s)</span>
          </div>

          {tickets.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 40 }}><p className="muted" style={{ margin: 0 }}>Nenhum chamado ainda.</p></div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              {tickets.map((t, i) => (
                <div key={t.id} className="spread" style={{ padding: "14px 20px", borderTop: i ? "1px solid var(--line)" : "none", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="row" style={{ gap: 8 }}>
                      <strong>{t.assunto}</strong>
                      <span className={"badge " + (PRIO[t.prioridade] || "")} style={{ fontSize: 10 }}>{t.prioridade}</span>
                    </div>
                    {t.mensagem && <div className="muted" style={{ fontSize: 12.5, marginTop: 3, lineHeight: 1.5 }}>{t.mensagem}</div>}
                    <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>{new Date(t.created_at).toLocaleString("pt-BR")}</div>
                  </div>
                  <div className="row" style={{ gap: 8, flexShrink: 0 }}>
                    <span className={"badge " + (t.status === "aberto" ? "gold" : "ok")}>{t.status}</span>
                    <form action={resolverTicketAction}>
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="reabrir" value={t.status === "aberto" ? "0" : "1"} />
                      <button className="btn btn-ghost btn-sm" type="submit">{t.status === "aberto" ? "Resolver" : "Reabrir"}</button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
