import Link from "@/components/link";
import PageHead from "@/components/page-head";
import { pipelinePorEtapa } from "@/lib/ops";
import { IcoWhatsapp } from "@/components/icons";

export const dynamic = "force-dynamic";

const COLS = [
  { key: "novo", label: "Novo" },
  { key: "contatado", label: "Contatado" },
  { key: "diagnostico", label: "Diagnóstico" },
  { key: "proposta", label: "Proposta" },
  { key: "fechado", label: "Fechado" },
];

export default async function PipelinePage() {
  const leads = await pipelinePorEtapa();

  return (
    <>
      <PageHead
        eyebrow="Agência · GROOW OS"
        titulo="Pipeline"
        sub="O funil em formato de quadro — cada card é um negócio. Pra mover, use o status na aba Leads."
        acao={<Link href="/owner/ops/leads" className="btn btn-ghost btn-sm">Ir pra Leads</Link>}
      />

      <div style={{ overflowX: "auto", paddingBottom: 8 }}>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${COLS.length}, minmax(230px, 1fr))`, gap: 12, minWidth: 900 }}>
          {COLS.map((c) => {
            const cards = leads.filter((l) => l.status === c.key);
            return (
              <div key={c.key}>
                <div className="spread" style={{ marginBottom: 10, padding: "0 4px" }}>
                  <strong style={{ fontSize: 13.5 }}>{c.label}</strong>
                  <span className="badge">{cards.length}</span>
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {cards.map((l) => (
                    <div key={l.id} className="card" style={{ padding: 13 }}>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>{l.nome}</div>
                      {l.empresa && l.empresa !== l.nome && <div className="muted" style={{ fontSize: 12 }}>{l.empresa}</div>}
                      <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                        {l.origem && <span className="badge" style={{ fontSize: 10 }}>{l.origem}</span>}
                        {l.whatsapp && (
                          <a className="muted row" style={{ gap: 4, fontSize: 11.5 }} href={`https://wa.me/${l.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                            <IcoWhatsapp width={12} height={12} /> zap
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                  {cards.length === 0 && <div className="muted" style={{ fontSize: 12, padding: "8px 4px" }}>vazio</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
