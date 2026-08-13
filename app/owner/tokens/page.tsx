import PageHead from "@/components/page-head";
import { usoPorCliente } from "@/lib/data";

export const dynamic = "force-dynamic";

function fmt(n: number) {
  return n.toLocaleString("pt-BR");
}

export default async function TokensPage() {
  const uso = await usoPorCliente();
  const totInter = uso.reduce((a, u) => a + u.interacoes, 0);
  const totIn = uso.reduce((a, u) => a + Number(u.tokens_in), 0);
  const totOut = uso.reduce((a, u) => a + Number(u.tokens_out), 0);
  const totCusto = uso.reduce((a, u) => a + u.custo_cent, 0);

  return (
    <>
      <PageHead eyebrow="Plataforma" titulo="Tokens" sub="Consumo de IA por cliente — custo medido, não estimado." />

      <div className="cols-4">
        <div className="card"><div className="kpi">{fmt(totInter)}</div><div className="kpi-label">Interações</div></div>
        <div className="card"><div className="kpi">{fmt(totIn)}</div><div className="kpi-label">Tokens entrada</div></div>
        <div className="card"><div className="kpi">{fmt(totOut)}</div><div className="kpi-label">Tokens saída</div></div>
        <div className="card"><div className="kpi">R$ {(totCusto / 100).toFixed(2)}</div><div className="kpi-label">Custo (real)</div></div>
      </div>

      <div className="card" style={{ marginTop: 18, padding: 0, overflow: "hidden" }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ paddingLeft: 20 }}>Cliente</th>
                <th>Interações</th>
                <th>Entrada</th>
                <th>Saída</th>
                <th>Custo</th>
              </tr>
            </thead>
            <tbody>
              {uso.map((u) => (
                <tr key={u.negocio_id}>
                  <td style={{ paddingLeft: 20 }}><strong>{u.nome}</strong></td>
                  <td>{fmt(u.interacoes)}</td>
                  <td className="muted">{fmt(Number(u.tokens_in))}</td>
                  <td className="muted">{fmt(Number(u.tokens_out))}</td>
                  <td>R$ {(u.custo_cent / 100).toFixed(2)}</td>
                </tr>
              ))}
              {uso.length === 0 && (
                <tr><td colSpan={5} className="muted" style={{ paddingLeft: 20 }}>Sem consumo ainda. Liga a chave da Anthropic e o uso começa a aparecer aqui.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
