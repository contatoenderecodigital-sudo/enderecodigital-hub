import PageHead from "@/components/page-head";
import { listCardapios } from "@/lib/ops";
import { IcoGrid } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function CardapiosPage() {
  const itens = await listCardapios();
  return (
    <>
      <PageHead eyebrow="Agência · GROOW OS" titulo="Cardápios" sub="Respostas do formulário de cardápio que os clientes preencheram." />
      {itens.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 44 }}><p className="muted" style={{ margin: 0 }}>Nenhum cardápio preenchido ainda.</p></div>
      ) : (
        <div className="cols-2">
          {itens.map((c) => (
            <div key={c.id} className="card">
              <div className="spread">
                <div className="row" style={{ gap: 10 }}>
                  <div className="icon-box sm"><IcoGrid width={15} height={15} /></div>
                  <strong>{c.cliente || "Cliente"}</strong>
                </div>
                <span className="badge">{c.total_itens} itens</span>
              </div>
              {c.selecionados && <p className="muted" style={{ fontSize: 12.5, margin: "12px 0 0", lineHeight: 1.5 }}>{c.selecionados}</p>}
              {c.observacoes && (
                <div className="glass-soft" style={{ borderRadius: 11, padding: "10px 12px", marginTop: 12 }}>
                  <div className="muted" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.08em" }}>Observação</div>
                  <div style={{ fontSize: 13, marginTop: 3 }}>{c.observacoes}</div>
                </div>
              )}
              <div className="muted" style={{ fontSize: 11, marginTop: 12 }}>{new Date(c.created_at).toLocaleDateString("pt-BR")}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
