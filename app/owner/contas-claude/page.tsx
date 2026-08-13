import PageHead from "@/components/page-head";
import { listContasClaude } from "@/lib/data";
import { IcoSparkles } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function ContasClaudePage() {
  const contas = await listContasClaude();
  return (
    <>
      <PageHead eyebrow="Plataforma" titulo="Contas Claude" sub="As contas de IA conectadas que alimentam os assistentes." />

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="row" style={{ gap: 12 }}>
          <div className="icon-box"><IcoSparkles width={18} height={18} /></div>
          <div>
            <strong>Motor da plataforma</strong>
            <p className="muted" style={{ margin: "2px 0 0" }}>
              O caminho oficial do Endereço Digital é a <strong>API Anthropic</strong> com custo medido por cliente
              (aba Tokens) — sem assento revendido, sem risco de ban. "Claude do cliente" só quando o cliente traz a própria assinatura.
            </p>
          </div>
        </div>
      </div>

      <div className="cols-3">
        {contas.map((c) => (
          <div key={c.id} className="card">
            <div className="spread">
              <strong>{c.nome}</strong>
              <span className={"badge " + (c.status === "ativa" ? "ok" : "warn")}>{c.status}</span>
            </div>
            <div className="row" style={{ gap: 8, marginTop: 12 }}>
              <span className="badge">{c.tipo}</span>
              {c.plano && <span className="badge">{c.plano}</span>}
            </div>
          </div>
        ))}
        {contas.length === 0 && (
          <div className="card"><p className="muted" style={{ margin: 0 }}>Nenhuma conta dedicada conectada — a plataforma usa a API Anthropic central.</p></div>
        )}
      </div>
    </>
  );
}
