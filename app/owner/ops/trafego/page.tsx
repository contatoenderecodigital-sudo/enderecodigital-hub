import PageHead from "@/components/page-head";
import { trafegoResumo } from "@/lib/ops";
import { investimentoAction } from "../actions";
import { IcoActivity, IcoPlus } from "@/components/icons";

export const dynamic = "force-dynamic";

function brl(n: number) {
  return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default async function TrafegoPage() {
  const t = await trafegoResumo();
  const mesAtual = new Date().toISOString().slice(0, 7);

  return (
    <>
      <PageHead
        eyebrow="Agência · GROOW OS"
        titulo="Tráfego & ROAS"
        sub="De onde vêm os leads e o que cada canal custa — atribuição por fonte, do anúncio ao fechamento."
      />

      <div className="cols-3">
        <div className="card"><div className="kpi">{t.totalLeads}</div><div className="kpi-label">Leads atribuídos</div></div>
        <div className="card"><div className="kpi" style={{ color: "var(--gold-l)" }}>{brl(t.totalInvest)}</div><div className="kpi-label">Investido (registrado)</div></div>
        <div className="card"><div className="kpi">{t.totalLeads > 0 ? brl(t.totalInvest / t.totalLeads) : "—"}</div><div className="kpi-label">CPL médio</div></div>
      </div>

      <div className="card" style={{ marginTop: 18, padding: 0, overflow: "hidden" }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ paddingLeft: 20 }}>Canal</th>
                <th>Investido</th>
                <th>Leads</th>
                <th>Fechados</th>
                <th>CPL</th>
              </tr>
            </thead>
            <tbody>
              {t.linhas.map((l) => (
                <tr key={l.canal}>
                  <td style={{ paddingLeft: 20, textTransform: "capitalize" }}>
                    <span className="row" style={{ gap: 8 }}><IcoActivity width={14} height={14} /> {l.canal}</span>
                  </td>
                  <td>{l.investido > 0 ? brl(l.investido) : <span className="muted">—</span>}</td>
                  <td><strong>{l.leads}</strong></td>
                  <td style={{ color: l.fechados ? "var(--ok)" : undefined }}>{l.fechados}</td>
                  <td>{l.cpl > 0 ? brl(l.cpl) : <span className="muted">—</span>}</td>
                </tr>
              ))}
              {t.linhas.length === 0 && (
                <tr><td colSpan={5} className="muted" style={{ padding: 40, textAlign: "center", paddingLeft: 20 }}>Sem leads com fonte de tráfego ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <details className="card" style={{ marginTop: 16 }}>
        <summary style={{ cursor: "pointer", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
          <IcoPlus width={16} height={16} /> Registrar investimento do mês
        </summary>
        <form action={investimentoAction} className="cols-3" style={{ gap: 12, marginTop: 14 }}>
          <div><label>Canal</label>
            <select name="canal" className="filter-select" style={{ width: "100%" }}>
              <option value="google">google</option><option value="meta">meta</option>
              <option value="tiktok">tiktok</option><option value="outro">outro</option>
            </select>
          </div>
          <div><label>Mês</label><input name="mes" defaultValue={mesAtual} placeholder="YYYY-MM" /></div>
          <div><label>Valor (R$)</label><input name="valor" inputMode="decimal" placeholder="0" /></div>
          <div style={{ gridColumn: "1 / -1" }}><button className="btn" type="submit">Salvar investimento</button></div>
        </form>
        <p className="muted" style={{ fontSize: 12, margin: "12px 0 0" }}>
          Com o investimento por canal + os leads por fonte de tráfego, o CPL e o ROAS por canal saem sozinhos.
        </p>
      </details>
    </>
  );
}
