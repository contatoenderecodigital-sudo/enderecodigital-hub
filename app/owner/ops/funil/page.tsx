import PageHead from "@/components/page-head";
import { funilResumo } from "@/lib/ops";

export const dynamic = "force-dynamic";

const LABEL: Record<string, string> = {
  novo: "Novo", contatado: "Contatado", diagnostico: "Diagnóstico", proposta: "Proposta", fechado: "Fechado",
};

export default async function FunilPage() {
  const f = await funilResumo();
  const maxEtapa = Math.max(1, ...f.etapas.map((e) => e.n));
  const maxOrigem = Math.max(1, ...f.porOrigem.map((o) => o.n));

  return (
    <>
      <PageHead eyebrow="Agência · GROOW OS" titulo="Funil" sub="O raio-X da operação — quantos leads em cada etapa e quem fecha, por origem." />

      <div className="cols-4">
        <div className="card"><div className="kpi">{f.total}</div><div className="kpi-label">Leads no funil</div></div>
        <div className="card"><div className="kpi" style={{ color: "var(--ok)" }}>{f.fechados}</div><div className="kpi-label">Fechados</div></div>
        <div className="card"><div className="kpi">{f.perdidos}</div><div className="kpi-label">Perdidos</div></div>
        <div className="card"><div className="kpi">{f.conversao}%</div><div className="kpi-label">Conversão</div></div>
      </div>

      <div className="cols-2" style={{ marginTop: 18, gap: 16 }}>
        <div className="card">
          <div className="eyebrow" style={{ marginBottom: 14 }}>Etapa por etapa</div>
          {f.etapas.map((e) => (
            <div key={e.status} style={{ padding: "8px 0" }}>
              <div className="spread" style={{ fontSize: 13 }}>
                <span>{LABEL[e.status] || e.status}</span>
                <strong>{e.n}</strong>
              </div>
              <div className="hbar" style={{ marginTop: 6, width: "100%", height: 8 }}>
                <i style={{ width: `${(e.n / maxEtapa) * 100}%`, background: e.status === "fechado" ? "linear-gradient(90deg,var(--ok),#9ee7bf)" : "linear-gradient(90deg,var(--gold),var(--gold-l))" }} />
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="eyebrow" style={{ marginBottom: 14 }}>Quem fecha, por origem</div>
          {f.porOrigem.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>Sem leads ainda.</p>
          ) : f.porOrigem.map((o) => (
            <div key={o.origem} style={{ padding: "8px 0" }}>
              <div className="spread" style={{ fontSize: 13 }}>
                <span style={{ textTransform: "capitalize" }}>{o.origem}</span>
                <span className="muted">{o.n} leads · <strong style={{ color: "var(--ok)" }}>{o.fechados} fechados</strong></span>
              </div>
              <div className="hbar" style={{ marginTop: 6, width: "100%", height: 8 }}>
                <i style={{ width: `${(o.n / maxOrigem) * 100}%`, background: "linear-gradient(90deg,var(--gold),var(--gold-l))" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
