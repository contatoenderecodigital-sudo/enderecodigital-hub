import { redirect } from "next/navigation";
import PageHeader from "@/components/groow/admin/ed2/PageHeader";
import Card from "@/components/groow/admin/ed2/Card";
import StatCard from "@/components/groow/admin/ed2/StatCard";
import { parceiroDaSessao } from "@/lib/groow/parceiro-sessao";
import { listarComissoes, resumoComissoes } from "@/lib/groow/parceiros";

export const dynamic = "force-dynamic";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function competenciaLegivel(c: string): string {
  const m = c.match(/^(\d{4})-(\d{2})$/);
  if (!m) return c;
  return `${MESES[Number(m[2]) - 1]} de ${m[1]}`;
}

const TIPO_LABEL: Record<string, string> = {
  fixa: "Por venda fechada",
  setup: "Implantação",
  recorrente: "Mensalidade",
  ajuste: "Ajuste",
};

const STATUS_COR: Record<string, { bg: string; fg: string; label: string }> = {
  previsto: { bg: "rgba(11,24,56,0.07)", fg: "var(--ed2-ink-2)", label: "Previsto" },
  aprovado: { bg: "rgba(201,169,97,0.16)", fg: "#8a712d", label: "Aprovado" },
  pago: { bg: "rgba(52,199,89,0.16)", fg: "#1d8a3a", label: "Pago" },
  cancelado: { bg: "rgba(255,59,48,0.10)", fg: "#c8261c", label: "Cancelado" },
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "0 14px 12px",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--ed2-ink-2)",
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  padding: "14px",
  fontSize: 14.5,
  color: "var(--ed2-ink)",
  borderTop: "1px solid var(--ed2-hair)",
};

export default async function ComissoesDoParceiro() {
  const parceiro = await parceiroDaSessao();
  if (!parceiro) redirect("/login");

  const [linhas, resumo] = await Promise.all([
    listarComissoes(parceiro.id),
    resumoComissoes(parceiro.id),
  ]);

  return (
    <>
      <PageHeader
        title="Comissões"
        sub={
          parceiro.comissao_fixa > 0
            ? `R$ ${brl(parceiro.comissao_fixa)} por cliente que fechar com a gente.`
            : `${parceiro.comissao_setup_pct}% da implantação e ${parceiro.comissao_mensal_pct}% da mensalidade por ${parceiro.comissao_meses} meses.`
        }
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 26,
        }}
      >
        <StatCard label="Previsto" value={brl(resumo.previsto)} currency="R$" />
        <StatCard
          label="Aprovado"
          value={brl(resumo.aprovado)}
          currency="R$"
          pill={resumo.aprovado > 0 ? { text: "a pagar", tone: "up" } : null}
        />
        <StatCard label="Já pago" value={brl(resumo.pago)} currency="R$" />
      </div>

      <Card padding={22}>
        {linhas.length === 0 ? (
          <div style={{ padding: "56px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 17, fontWeight: 600, color: "var(--ed2-ink)", marginBottom: 6 }}>
              Nenhuma comissão ainda
            </div>
            <div style={{ fontSize: 14.5, color: "var(--ed2-ink-2)", lineHeight: 1.6, maxWidth: 460, margin: "0 auto" }}>
              A comissão aparece aqui quando um lead que você trouxe fecha contrato.
              Ela é apurada no fechamento de cada mês.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
              <thead>
                <tr>
                  <th style={th}>Competência</th>
                  <th style={th}>Cliente</th>
                  <th style={th}>Tipo</th>
                  <th style={{ ...th, textAlign: "right" }}>Base</th>
                  <th style={{ ...th, textAlign: "right" }}>%</th>
                  <th style={{ ...th, textAlign: "right" }}>Sua comissão</th>
                  <th style={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((c) => {
                  const cor = STATUS_COR[c.status] || STATUS_COR.previsto;
                  return (
                    <tr key={c.id}>
                      <td style={{ ...td, textTransform: "capitalize" }}>
                        {competenciaLegivel(c.competencia)}
                      </td>
                      <td style={{ ...td, fontWeight: 600 }}>{c.empresa || "sem vínculo"}</td>
                      <td style={{ ...td, color: "var(--ed2-ink-2)" }}>
                        {TIPO_LABEL[c.tipo] || c.tipo}
                      </td>
                      <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        R$ {brl(c.base_valor)}
                      </td>
                      <td style={{ ...td, textAlign: "right", color: "var(--ed2-ink-2)" }}>
                        {c.percentual}%
                      </td>
                      <td
                        style={{
                          ...td,
                          textAlign: "right",
                          fontWeight: 700,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        R$ {brl(c.valor)}
                      </td>
                      <td style={td}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "4px 11px",
                            borderRadius: 999,
                            fontSize: 12.5,
                            fontWeight: 600,
                            background: cor.bg,
                            color: cor.fg,
                          }}
                        >
                          {cor.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
