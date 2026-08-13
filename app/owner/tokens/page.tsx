import PageHead from "@/components/page-head";
import { usoPorCliente } from "@/lib/data";
import { IcoActivity } from "@/components/icons";

export const dynamic = "force-dynamic";

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

export default async function TokensPage() {
  const uso = await usoPorCliente();
  const totInter = uso.reduce((a, u) => a + u.interacoes, 0);
  const totIn = uso.reduce((a, u) => a + Number(u.tokens_in), 0);
  const totOut = uso.reduce((a, u) => a + Number(u.tokens_out), 0);
  const totCusto = uso.reduce((a, u) => a + u.custo_cent, 0);
  const comUso = uso.filter((u) => u.interacoes > 0);

  return (
    <>
      <PageHead
        eyebrow="Plataforma"
        titulo="Consumo de Tokens"
        sub={`${uso.length} cliente(s) · ${fmt(totIn + totOut)} tokens usados (real, sem cache)`}
      />

      <div className="cols-4">
        <div className="card"><div className="kpi">{fmt(totInter)}</div><div className="kpi-label">Interações</div></div>
        <div className="card"><div className="kpi">{fmt(totIn)}</div><div className="kpi-label">Tokens entrada</div></div>
        <div className="card"><div className="kpi">{fmt(totOut)}</div><div className="kpi-label">Tokens saída</div></div>
        <div className="card"><div className="kpi">R$ {(totCusto / 100).toFixed(2)}</div><div className="kpi-label">Custo (real)</div></div>
      </div>

      <div className="cols-3" style={{ marginTop: 18 }}>
        {uso.map((u) => {
          const total = Number(u.tokens_in) + Number(u.tokens_out);
          return (
            <div key={u.negocio_id} className="card">
              <div className="spread">
                <strong>{u.nome}</strong>
                <span className="badge">{u.interacoes} conversas</span>
              </div>
              <div className="row" style={{ gap: 10, marginTop: 14 }}>
                <div className="glass-soft" style={{ borderRadius: 11, padding: "9px 11px", flex: 1 }}>
                  <div className="muted" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.08em" }}>Entrada</div>
                  <div style={{ fontWeight: 700, marginTop: 2 }}>{fmt(Number(u.tokens_in))}</div>
                </div>
                <div className="glass-soft" style={{ borderRadius: 11, padding: "9px 11px", flex: 1 }}>
                  <div className="muted" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.08em" }}>Saída</div>
                  <div style={{ fontWeight: 700, marginTop: 2 }}>{fmt(Number(u.tokens_out))}</div>
                </div>
              </div>
              <div className="spread" style={{ marginTop: 14, fontSize: 12.5 }}>
                <span className="muted">Total</span>
                <span className="row" style={{ gap: 6 }}><IcoActivity width={13} height={13} /> {fmt(total)} tokens</span>
              </div>
            </div>
          );
        })}
      </div>

      {comUso.length === 0 && (
        <div className="card" style={{ marginTop: 18 }}>
          <p className="muted" style={{ margin: 0 }}>Sem consumo ainda. Assim que a IA responder (com a chave da Anthropic ligada), o uso real por cliente aparece aqui — com limite por cliente e teto do hub.</p>
        </div>
      )}
    </>
  );
}
