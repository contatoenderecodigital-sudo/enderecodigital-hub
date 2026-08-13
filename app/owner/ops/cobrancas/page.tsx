import Link from "@/components/link";
import PageHead from "@/components/page-head";
import { cobrancasMes } from "@/lib/ops";
import { marcarPagoAction } from "../actions";
import { IcoChevronRight } from "@/components/icons";

export const dynamic = "force-dynamic";

function brl(n: number) {
  return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function shiftYm(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function labelYm(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export default async function CobrancasPage({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string }>;
}) {
  const sp = await searchParams;
  const hoje = new Date();
  const ym = sp.ym && /^\d{4}-\d{2}$/.test(sp.ym)
    ? sp.ym
    : `${hoje.getUTCFullYear()}-${String(hoje.getUTCMonth() + 1).padStart(2, "0")}`;

  const { linhas, previsto, recebido } = await cobrancasMes(ym);
  const aReceber = previsto - recebido;
  const pct = previsto > 0 ? Math.round((recebido / previsto) * 100) : 0;

  return (
    <>
      <PageHead
        eyebrow="Agência · GROOW OS"
        titulo="Cobranças"
        sub="As mensalidades recorrentes da carteira — previsto, recebido e o que falta entrar no mês."
        acao={
          <div className="row" style={{ gap: 6 }}>
            <Link href={`/owner/ops/cobrancas?ym=${shiftYm(ym, -1)}`} className="btn btn-ghost btn-sm" style={{ transform: "scaleX(-1)" }}>
              <IcoChevronRight width={15} height={15} />
            </Link>
            <span className="badge" style={{ textTransform: "capitalize", minWidth: 130, justifyContent: "center" }}>{labelYm(ym)}</span>
            <Link href={`/owner/ops/cobrancas?ym=${shiftYm(ym, 1)}`} className="btn btn-ghost btn-sm">
              <IcoChevronRight width={15} height={15} />
            </Link>
          </div>
        }
      />

      <div className="cols-3">
        <div className="card"><div className="kpi-label">Previsto no mês</div><div className="kpi" style={{ fontSize: 22 }}>{brl(previsto)}</div></div>
        <div className="card">
          <div className="kpi-label">Recebido</div>
          <div className="kpi" style={{ fontSize: 22, color: "var(--ok)" }}>{brl(recebido)}</div>
          <div className="hbar" style={{ marginTop: 8, width: "100%" }}>
            <i style={{ width: `${pct}%`, background: "linear-gradient(90deg,var(--ok),#9ee7bf)" }} />
          </div>
        </div>
        <div className="card"><div className="kpi-label">A receber</div><div className="kpi" style={{ fontSize: 22, color: aReceber > 0 ? "var(--warn)" : "var(--muted)" }}>{brl(aReceber)}</div></div>
      </div>

      {linhas.length === 0 ? (
        <div className="card" style={{ marginTop: 16, textAlign: "center", padding: 44 }}>
          <p className="muted" style={{ margin: 0 }}>Nenhum cliente ativo com mensalidade. Cadastre na Carteira.</p>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 16, padding: 0, overflow: "hidden" }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ paddingLeft: 20 }}>Cliente</th>
                  <th>Valor</th>
                  <th>Vencimento</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.cliente_id}>
                    <td style={{ paddingLeft: 20 }}><strong>{l.empresa}</strong></td>
                    <td>{brl(l.valor)}</td>
                    <td className="muted">dia {l.dia_cobranca}</td>
                    <td><span className={"badge " + (l.pago ? "ok" : "warn")}>{l.pago ? "pago" : "a receber"}</span></td>
                    <td style={{ textAlign: "right", paddingRight: 16 }}>
                      {!l.pago && (
                        <form action={marcarPagoAction}>
                          <input type="hidden" name="cliente_id" value={l.cliente_id} />
                          <input type="hidden" name="ym" value={ym} />
                          <input type="hidden" name="valor" value={l.valor} />
                          <button className="btn btn-sm" type="submit">Marcar pago</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
