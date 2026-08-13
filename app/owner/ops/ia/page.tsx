import PageHead from "@/components/page-head";
import { iaResumo } from "@/lib/ops";
import { IcoSparkles } from "@/components/icons";

export const dynamic = "force-dynamic";

function usd(n: number) { return "US$ " + n.toFixed(2); }
function fmt(n: number) {
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return String(n);
}

export default async function IaPage() {
  const r = await iaResumo();
  const maxCusto = Math.max(0.0001, ...r.porModulo.map((m) => m.custo));

  return (
    <>
      <PageHead
        eyebrow="Agência · GROOW OS"
        titulo="IA & Custos"
        sub="Diário de bordo de cada chamada de IA — tokens, custo real e por onde o gasto vai."
      />

      <div className="cols-4">
        <div className="card"><div className="kpi" style={{ color: "var(--gold-l)" }}>{usd(r.custoHoje)}</div><div className="kpi-label">Custo hoje</div></div>
        <div className="card"><div className="kpi" style={{ color: "var(--gold-l)" }}>{usd(r.custoMes)}</div><div className="kpi-label">Custo no mês</div></div>
        <div className="card"><div className="kpi">{r.chamadas}</div><div className="kpi-label">Chamadas (total)</div></div>
        <div className="card"><div className="kpi">{fmt(r.tokens)}</div><div className="kpi-label">Tokens (total)</div></div>
      </div>

      <div className="cols-2" style={{ marginTop: 18, gap: 16 }}>
        <div className="card">
          <div className="eyebrow" style={{ marginBottom: 14 }}>Custo por módulo (30 dias)</div>
          {r.porModulo.length === 0 ? <p className="muted" style={{ margin: 0 }}>Sem chamadas no período.</p> : r.porModulo.map((m) => (
            <div key={m.modulo} style={{ padding: "8px 0" }}>
              <div className="spread" style={{ fontSize: 13 }}>
                <span className="row" style={{ gap: 7 }}><IcoSparkles width={13} height={13} /> {m.modulo}</span>
                <span><strong>{usd(m.custo)}</strong> <span className="muted" style={{ fontSize: 11 }}>· {m.chamadas}x</span></span>
              </div>
              <div className="hbar" style={{ marginTop: 6, width: "100%", height: 7 }}>
                <i style={{ width: `${(m.custo / maxCusto) * 100}%`, background: "linear-gradient(90deg,var(--gold),var(--gold-l))" }} />
              </div>
            </div>
          ))}
        </div>

        <div className="card glass-soft" style={{ fontSize: 13, lineHeight: 1.6 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Como o custo é medido</div>
          Cada chamada (chat, gerador de post, blog, agente do WhatsApp) grava modelo, tokens de entrada/saída, buscas web e o <strong>custo real em US$</strong> — nada estimado por tabela. É o mesmo padrão de "custo medido por cliente" da plataforma, aqui aplicado à operação da própria agência.
        </div>
      </div>

      <div className="card" style={{ marginTop: 16, padding: 0, overflow: "hidden" }}>
        <div className="eyebrow" style={{ padding: "16px 20px 0" }}>Últimas chamadas</div>
        <div className="table-wrap" style={{ marginTop: 10 }}>
          <table>
            <thead>
              <tr>
                <th style={{ paddingLeft: 20 }}>Módulo</th>
                <th>Ação</th>
                <th>Modelo</th>
                <th>Tokens</th>
                <th>Custo</th>
                <th>Quando</th>
              </tr>
            </thead>
            <tbody>
              {r.ultimas.map((l, i) => (
                <tr key={i}>
                  <td style={{ paddingLeft: 20 }}><span className="badge" style={{ fontSize: 10 }}>{l.modulo || "—"}</span></td>
                  <td className="muted" style={{ fontSize: 12.5 }}>{l.acao || "—"}</td>
                  <td className="muted" style={{ fontSize: 12 }}>{l.modelo || "—"}</td>
                  <td className="muted" style={{ fontSize: 12.5 }}>{fmt((l.input_tokens || 0) + (l.output_tokens || 0))}</td>
                  <td style={{ fontSize: 12.5 }}>{usd(Number(l.custo_usd) || 0)}</td>
                  <td className="muted" style={{ fontSize: 12 }}>{new Date(l.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                </tr>
              ))}
              {r.ultimas.length === 0 && <tr><td colSpan={6} className="muted" style={{ padding: 40, textAlign: "center", paddingLeft: 20 }}>Sem chamadas ainda.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
