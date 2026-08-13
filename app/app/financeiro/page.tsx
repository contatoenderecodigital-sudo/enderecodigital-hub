import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { activeNegocioId } from "@/lib/tenant";
import { getNegocio } from "@/lib/data";
import { IcoActivity, IcoUsers, IcoAlert, IcoSparkles } from "@/components/icons";

export const dynamic = "force-dynamic";

function K({ label, valor, cor }: { label: string; valor: string; cor?: string }) {
  return (
    <div className="card">
      <div className="kpi-label">{label}</div>
      <div className="kpi" style={{ fontSize: 22, color: cor }}>{valor}</div>
    </div>
  );
}

const SAIDAS = [
  { c: "Salários", v: "R$ 257.500", pct: 100 },
  { c: "Aluguel", v: "R$ 173.500", pct: 67 },
  { c: "Marketing", v: "R$ 141.500", pct: 55 },
  { c: "Impostos", v: "R$ 136.000", pct: 53 },
  { c: "Software", v: "R$ 125.500", pct: 49 },
  { c: "Fornecedores", v: "R$ 102.500", pct: 40 },
];

export default async function FinanceiroPage() {
  const s = await getSession();
  const neg = activeNegocioId(s);
  if (!neg) redirect("/login");
  const negocio = await getNegocio(neg);
  if (!negocio) redirect("/login");

  return (
    <>
      <div className="spread" style={{ alignItems: "flex-start" }}>
        <div>
          <div className="eyebrow"><IcoActivity width={14} height={14} /> Gestão</div>
          <h1 style={{ margin: "6px 0 0" }}>Painel financeiro</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>Visão clara do controle e risco do negócio.</p>
        </div>
        <span className="badge warn">demonstração</span>
      </div>

      <div className="card glass-soft" style={{ marginTop: 16, fontSize: 13, lineHeight: 1.6 }}>
        <strong>Módulo opcional (fase posterior).</strong> Os números abaixo são um exemplo de layout. O financeiro
        entra depois do núcleo (WhatsApp + IA + site) validado — os dados reais virão da integração escolhida, medidos
        por cliente, nunca estimados.
      </div>

      <div className="cols-4" style={{ marginTop: 16 }}>
        <K label="Faturamento" valor="R$ 1.420.560" cor="var(--gold-l)" />
        <K label="Saídas" valor="R$ 936.500" />
        <K label="Lucro" valor="R$ 484.060" cor="var(--ok)" />
        <K label="Margem" valor="34,1%" />
      </div>

      <div className="cols-side" style={{ marginTop: 18, gap: 16 }}>
        {/* score de saúde */}
        <div className="card">
          <div className="eyebrow">Saúde financeira</div>
          <div className="row" style={{ gap: 22, marginTop: 16, alignItems: "center", flexWrap: "wrap" }}>
            <div
              style={{
                width: 130,
                height: 130,
                borderRadius: "50%",
                background: "conic-gradient(var(--ok) 0 87%, rgba(255,255,255,0.08) 87% 100%)",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <div style={{ width: 96, height: 96, borderRadius: "50%", background: "var(--navy-d)", display: "grid", placeItems: "center", textAlign: "center" }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 30, lineHeight: 1 }}>87</div>
                  <div className="muted" style={{ fontSize: 11 }}>de 100</div>
                </div>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <span className="badge ok">saudável</span>
              <div className="row" style={{ gap: 18, marginTop: 12, flexWrap: "wrap", fontSize: 13 }}>
                <span><span className="muted">Receita:</span> <strong>R$ 1.420.560</strong></span>
                <span><span className="muted">Despesas:</span> <strong>R$ 936.500</strong></span>
                <span><span className="muted">Lançamentos:</span> <strong>108</strong></span>
              </div>
              <div className="glass-soft" style={{ borderRadius: 12, padding: "12px 14px", marginTop: 14 }}>
                <div className="row" style={{ gap: 8 }}>
                  <div className="icon-box sm"><IcoSparkles width={15} height={15} /></div>
                  <div>
                    <strong style={{ fontSize: 13.5 }}>Diagnóstico da IA</strong>
                    <div className="muted" style={{ fontSize: 12 }}>Análise de cada indicador com dicas práticas</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* alertas */}
        <div className="card">
          <div className="eyebrow">Alertas</div>
          <div style={{ marginTop: 10 }}>
            {[
              { t: "2 contas a receber vencidas", w: true },
              { t: "1 imposto vencido", w: true },
              { t: "3 metas no alvo", w: false },
              { t: "Lucro acumulado de R$ 484.060", w: false },
            ].map((a, i) => (
              <div key={i} className="list-row" style={{ padding: "10px 0" }}>
                <IcoAlert width={16} height={16} style={{ color: a.w ? "var(--warn)" : "var(--ok)" }} />
                <span style={{ fontSize: 13.5 }}>{a.t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="cols-2" style={{ marginTop: 16, gap: 16 }}>
        {/* saídas por categoria */}
        <div className="card">
          <div className="eyebrow">Saídas por categoria</div>
          <div style={{ marginTop: 12 }}>
            {SAIDAS.map((sd) => (
              <div key={sd.c} style={{ padding: "9px 0" }}>
                <div className="spread" style={{ fontSize: 13 }}>
                  <span>{sd.c}</span>
                  <strong>{sd.v}</strong>
                </div>
                <div className="hbar" style={{ marginTop: 6, width: "100%" }}>
                  <i style={{ width: `${sd.pct}%`, background: "linear-gradient(90deg, var(--gold), var(--gold-l))" }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* equipe */}
        <div className="card">
          <div className="spread">
            <div className="eyebrow">Equipe</div>
            <span className="badge">28 pessoas</span>
          </div>
          <div className="row" style={{ gap: 22, marginTop: 16, alignItems: "center", flexWrap: "wrap" }}>
            <div
              style={{
                width: 110,
                height: 110,
                borderRadius: "50%",
                background: "conic-gradient(var(--gold) 0 50%, var(--copper-l) 50% 100%)",
                display: "grid",
                placeItems: "center",
              }}
            >
              <div style={{ width: 60, height: 60, borderRadius: "50%", background: "var(--navy-d)" }} />
            </div>
            <div style={{ display: "grid", gap: 10, fontSize: 13 }}>
              <span className="row" style={{ gap: 8 }}><IcoUsers width={14} height={14} /> Folha total <strong>R$ 410.806</strong></span>
              <span className="row" style={{ gap: 8 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: "var(--gold)" }} /> Custo médio / func. <strong>R$ 14.672</strong></span>
              <span className="row" style={{ gap: 8 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: "var(--copper-l)" }} /> Encargos estimados <strong>R$ 8.100.400</strong></span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
