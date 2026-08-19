import Link from "next/link";
import { getFinanceiroV2, type FinanceiroV2Data } from "@/lib/groow/queries";
import FinanceiroTabs from "@/components/groow/admin/FinanceiroTabs";

export const dynamic = "force-dynamic";

const brl0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

export default async function FinanceiroPage() {
  let data: FinanceiroV2Data | null = null;
  let error: string | null = null;
  try {
    data = await getFinanceiroV2();
  } catch (err) {
    error = err instanceof Error ? err.message : "Erro";
  }

  const now = new Date();
  const mesAtualCapital = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }).replace(/^./, (c) => c.toUpperCase());
  const proxVenc = data && data.vencimentos[0]
    ? data.vencimentos[0].diasAteVencer < 0
      ? `há ${Math.abs(data.vencimentos[0].diasAteVencer)} dias`
      : `em ${data.vencimentos[0].diasAteVencer} dia${data.vencimentos[0].diasAteVencer === 1 ? "" : "s"}`
    : "-";

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24, gap: 24, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 42, fontWeight: 700, letterSpacing: "-0.035em", margin: "0 0 6px", lineHeight: 1.05 }}>Financeiro</h1>
          <div style={{ color: "var(--ed2-ink-2)", fontSize: 15 }}>
            {data && data.ativos > 0 ? (
              <>{mesAtualCapital} · <b style={{ color: "var(--ed2-ink)", fontWeight: 600 }}>{data.ativos}</b> clientes ativos · próxima cobrança {proxVenc}</>
            ) : "Faturamento, contratos e cobranças"}
          </div>
        </div>
        <Link
          href="/operacao/clientes"
          style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#C9A961", color: "#fff", padding: "11px 18px", borderRadius: 999, fontWeight: 600, fontSize: 13, textDecoration: "none", boxShadow: "0 4px 12px rgba(201,169,97,0.28)" }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M8 3v10M3 8h10" /></svg>
          Novo cliente
        </Link>
      </div>

      {error && (
        <div style={{ background: "rgba(255,59,48,0.06)", border: "1px solid rgba(255,59,48,0.18)", borderRadius: 18, padding: "14px 18px", color: "#c8261c", fontSize: 13, marginBottom: 18 }}>
          <strong>MySQL indisponível:</strong> {error}
        </div>
      )}

      {data && <FinanceiroTabs data={data} />}
    </div>
  );
}
