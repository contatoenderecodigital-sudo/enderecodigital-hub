import PageHead from "@/components/page-head";
import { listCampanhas, optoutTotal } from "@/lib/ops";
import { IcoWhatsapp, IcoAlert } from "@/components/icons";

export const dynamic = "force-dynamic";

const COR: Record<string, string> = { concluida: "ok", enviando: "gold", agendada: "gold", pausada: "warn", rascunho: "" };

export default async function DisparosPage() {
  const [campanhas, optouts] = await Promise.all([listCampanhas(), optoutTotal()]);
  const temToken = !!process.env.WHATSAPP_TOKEN && !!process.env.WHATSAPP_PHONE_NUMBER_ID;

  return (
    <>
      <PageHead
        eyebrow="Agência · GROOW OS"
        titulo="Disparos"
        sub="Campanhas de WhatsApp com template aprovado da Meta — cadência diária, janela e opt-out respeitados."
        acao={<button className="btn" disabled title="Ative o envio antes (veja abaixo)"><IcoWhatsapp width={15} height={15} /> Nova campanha</button>}
      />

      <div className="card glass-soft" style={{ marginBottom: 16, fontSize: 13, lineHeight: 1.6 }}>
        <span className="row" style={{ gap: 8, alignItems: "flex-start" }}>
          <IcoAlert width={16} height={16} style={{ color: "var(--warn)", flexShrink: 0, marginTop: 2 }} />
          <span>
            <strong>Envio em espera de propósito.</strong> A estrutura (campanhas, destinatários, cadência, opt-out, fila) está pronta e o token do WhatsApp {temToken ? "está setado" : "ainda não está setado"}.
            Antes de disparar de verdade, a gente valida junto: número, template aprovado na Meta e o webhook apontando pro hub — pra não arriscar o seu número. Disparo em massa mal feito é o que dá ban.
          </span>
        </span>
      </div>

      <div className="cols-3" style={{ marginBottom: 18 }}>
        <div className="card"><div className="kpi">{campanhas.length}</div><div className="kpi-label">Campanhas</div></div>
        <div className="card"><div className="kpi">{campanhas.reduce((a, c) => a + Number(c.enviados), 0)}</div><div className="kpi-label">Mensagens enviadas</div></div>
        <div className="card"><div className="kpi">{optouts}</div><div className="kpi-label">Opt-outs (lista negra)</div></div>
      </div>

      {campanhas.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 44 }}>
          <div className="icon-box" style={{ width: 50, height: 50, margin: "0 auto 12px" }}><IcoWhatsapp width={22} height={22} /></div>
          <p className="muted" style={{ margin: 0, maxWidth: 440, marginInline: "auto" }}>
            Nenhuma campanha ainda. Da prospecção você já manda os leads pra cá em lote — quando validarmos o envio, é criar a campanha e a fila roda respeitando cap/dia e janela.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="table-wrap">
            <table>
              <thead><tr><th style={{ paddingLeft: 20 }}>Campanha</th><th>Template</th><th>Progresso</th><th>Status</th></tr></thead>
              <tbody>
                {campanhas.map((c) => {
                  const total = Number(c.total); const env = Number(c.enviados);
                  const pct = total > 0 ? Math.round((env / total) * 100) : 0;
                  return (
                    <tr key={c.id}>
                      <td style={{ paddingLeft: 20 }}><strong>{c.nome}</strong></td>
                      <td className="muted" style={{ fontSize: 12.5 }}>{c.template_nome}</td>
                      <td style={{ minWidth: 160 }}>
                        <div className="spread" style={{ fontSize: 12 }}><span className="muted">{env}/{total}</span><span>{pct}%</span></div>
                        <div className="hbar" style={{ marginTop: 5, width: "100%" }}><i style={{ width: `${pct}%`, background: "linear-gradient(90deg,var(--gold),var(--gold-l))" }} /></div>
                      </td>
                      <td><span className={"badge " + (COR[c.status] || "")}>{c.status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
