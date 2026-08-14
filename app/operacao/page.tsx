import Link from "next/link";
import { Plus } from "lucide-react";
import PageHeader from "@/components/groow/admin/ed2/PageHeader";
import Card from "@/components/groow/admin/ed2/Card";
import PeriodNav from "@/components/groow/admin/PeriodNav";
import FunnelCard from "@/components/groow/admin/overview/FunnelCard";
import VolumeCard from "@/components/groow/admin/overview/VolumeCard";
import StepLineCard from "@/components/groow/admin/overview/StepLineCard";
import DotMatrixCard from "@/components/groow/admin/overview/DotMatrixCard";
import InsightCard from "@/components/groow/admin/overview/InsightCard";
import MeuDiaStrip from "@/components/groow/admin/overview/MeuDiaStrip";
import {
  getRevenueByMonth,
  getResumoFaturamento,
  getLeadsByWeek,
  getFunnelBreakdown,
  getPipelineByMonth,
  getMeuDia,
  type RevenuePoint,
  type ResumoFaturamento,
  type WeeklyPoint,
  type FunilStage,
  type PipelineMonth,
  type MeuDia,
} from "@/lib/groow/queries";

export const dynamic = "force-dynamic";

const brl0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const nf = new Intl.NumberFormat("pt-BR");

// rótulo do card de faturamento conforme o preset do PeriodNav
const PRESET_LABEL: Record<string, string> = {
  hoje: "hoje",
  ontem: "ontem",
  "7dias": "últimos 7 dias",
  "15dias": "últimos 15 dias",
  "30dias": "últimos 30 dias",
  este_mes: "este mês",
  mes_passado: "mês passado",
  "3meses": "últimos 3 meses",
  "6meses": "últimos 6 meses",
  ano: "último ano",
  custom: "período selecionado",
};

export default async function AdminPainelPage({ searchParams }: { searchParams: Promise<{ preset?: string; from?: string; to?: string }> }) {
  const sp = await searchParams;
  const range = { from: sp.from ?? null, to: sp.to ?? null };
  const hasRange = Boolean(range.from && range.to);

  let revenue: RevenuePoint[] = [];
  let resumo: ResumoFaturamento = { total: 0, retainer: 0, setup: 0, deltaPct: null };
  let weekly: WeeklyPoint[] = [];
  let funnel: FunilStage[] = [];
  let pipeline: PipelineMonth[] = [];
  let meuDia: MeuDia = { conversasEsperando: 0, leadsNovos: 0, cobrancasVencidas: 0, totalAtrasado: 0, aprovacoesPendentes: 0, tarefasVencidas: 0 };
  let dbError: string | null = null;

  try {
    [revenue, resumo, weekly, funnel, pipeline, meuDia] = await Promise.all([
      getRevenueByMonth(12),
      getResumoFaturamento(range),
      getLeadsByWeek(8),
      getFunnelBreakdown(range),
      getPipelineByMonth(6),
      getMeuDia(),
    ]);
  } catch (err) {
    dbError = err instanceof Error ? err.message : "Erro ao conectar no MySQL";
  }

  // ── Faturamento do período selecionado (PeriodNav) ──────────────────────
  const mesAtual = new Date().toLocaleDateString("pt-BR", { month: "long" });
  const periodoLabel = hasRange ? (PRESET_LABEL[sp.preset ?? "custom"] ?? "período selecionado") : mesAtual;

  // ── Leads semanais (dots verdes) ────────────────────────────────────────
  const leads8s = weekly.reduce((acc, w) => acc + w.leads, 0);
  const weekPeak = weekly.reduce((bi, w, i) => (w.leads > (weekly[bi]?.leads ?? 0) ? i : bi), 0);
  const wLast = weekly[weekly.length - 1]?.leads ?? 0;
  const wPrev = weekly[weekly.length - 2]?.leads ?? 0;

  // ── Pipeline mensal (dots azuis) ────────────────────────────────────────
  const pipeTotals = pipeline.map((m) => ({
    label: m.mes,
    value: m.novo + m.contatado + m.diagnostico + m.proposta + m.fechado,
  }));
  const pipeLast = pipeTotals[pipeTotals.length - 1]?.value ?? 0;
  const pipePrev = pipeTotals[pipeTotals.length - 2]?.value ?? 0;
  const pipePeak = pipeTotals.reduce((bi, m, i) => (m.value > (pipeTotals[bi]?.value ?? 0) ? i : bi), 0);

  // ── Insight: conversão do funil + maior drop-off ────────────────────────
  const topo = funnel[0]?.count ?? 0;
  const fechados = funnel[funnel.length - 1]?.count ?? 0;
  const totalLeads = funnel.reduce((acc, s) => acc + s.count, 0);
  const conv = topo > 0 ? fechados / topo : 0;
  let worstDrop: { de: string; para: string; pct: number } | null = null;
  for (let i = 1; i < funnel.length; i++) {
    const a = funnel[i - 1].count;
    if (a <= 0) continue;
    const drop = 1 - funnel[i].count / a;
    if (!worstDrop || drop > worstDrop.pct) worstDrop = { de: funnel[i - 1].label, para: funnel[i].label, pct: drop };
  }
  const insightBody =
    topo === 0
      ? "Cadastre leads para acompanhar a conversão do funil em tempo real."
      : `${nf.format(fechados)} dos ${nf.format(topo)} leads do período viraram cliente.` +
        (worstDrop && worstDrop.pct > 0
          ? ` Maior drop-off: ${worstDrop.de} pra ${worstDrop.para} (−${Math.round(worstDrop.pct * 100)}%). É aqui que mora o próximo salto de receita.`
          : "");

  return (
    <div>
      <PageHeader
        title="Painel"
        sub={
          <>
            Visão geral da operação · <b style={{ color: "var(--ed2-ink)", fontWeight: 600 }}>{nf.format(totalLeads)}</b> leads
            totais · <b style={{ color: "var(--ed2-ink)", fontWeight: 600 }}>R$ {brl0.format(resumo.total)}</b> {hasRange ? "no período" : "no mês"}
          </>
        }
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <PeriodNav defaultPreset="tudo" />
            <Link
              href="/operacao/leads"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "#C9A961",
                color: "#fff",
                border: "none",
                padding: "11px 18px",
                borderRadius: 999,
                fontWeight: 600,
                fontSize: 13,
                textDecoration: "none",
                boxShadow: "0 4px 12px rgba(201,169,97,0.28)",
              }}
            >
              <Plus size={14} strokeWidth={2.5} aria-hidden="true" />
              Novo lead
            </Link>
          </div>
        }
      />

      {dbError ? (
        <div style={{ marginBottom: 18 }}>
          <Card padding={18}>
            <p style={{ color: "#c8261c", fontSize: 13, margin: 0 }}>
              <strong>MySQL offline ou schema desatualizado:</strong> {dbError}
            </p>
          </Card>
        </div>
      ) : null}

      {!dbError && <MeuDiaStrip data={meuDia} />}

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Linha 1: funil largo + faturamento */}
        <div className="ed3-grid-a">
          <FunnelCard stages={funnel.map((s) => ({ label: s.label, count: s.count }))} title="Funil de leads" />
          <VolumeCard
            title={`Faturamento · ${periodoLabel}`}
            total={resumo.total}
            deltaPct={resumo.deltaPct}
            footnote={hasRange ? "Recorrência dos meses no período + setups fechados nele" : "Recorrência + setups do mês"}
            rows={[
              { label: "Recorrente", valor: resumo.retainer, tone: "green" },
              { label: "Setup", valor: resumo.setup, tone: "blue" },
            ]}
          />
        </div>

        {/* Linha 2: receita 12m + dots + insight */}
        <div className="ed3-grid-b">
          <StepLineCard
            title="Receita · 12 meses"
            points={revenue.map((r) => ({ label: r.mes, value: r.total }))}
            valuePrefix="R$ "
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <DotMatrixCard
              title="Leads · 8 semanas"
              bigValue={nf.format(leads8s)}
              peakLabel={weekly[weekPeak]?.semana ?? "-"}
              delta={wLast - wPrev !== 0 ? { text: `${wLast - wPrev > 0 ? "+" : ""}${nf.format(wLast - wPrev)}`, up: wLast >= wPrev } : null}
              columns={weekly.map((w) => ({ label: w.semana, value: w.leads }))}
              color="#16A34A"
              href="/operacao/leads"
            />
            <DotMatrixCard
              title="Pipeline · mês"
              bigValue={nf.format(pipeLast)}
              peakLabel={pipeTotals[pipePeak]?.label ?? "-"}
              delta={pipeLast - pipePrev !== 0 ? { text: `${pipeLast - pipePrev > 0 ? "+" : ""}${nf.format(pipeLast - pipePrev)}`, up: pipeLast >= pipePrev } : null}
              columns={pipeTotals}
              color="#0A84FF"
              href="/operacao/pipeline"
            />
          </div>
          <InsightCard
            pct={topo > 0 ? `${Math.round(conv * 100)}%` : "-"}
            headline={topo > 0 ? "Conversão do funil (lead a cliente)" : "Sem leads no período"}
            body={insightBody}
            progress={conv}
          />
        </div>
      </div>
    </div>
  );
}
