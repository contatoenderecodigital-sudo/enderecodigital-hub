import { redirect } from "next/navigation";
import { Cpu, Info, TrendingUp } from "lucide-react";
import { hubOpId } from "@/lib/hub-ctx";
import { listWorkspacesIA, usoPorModeloHub, getHubLimiteTokens } from "@/lib/tokens-ia";
import { acharModelo, estimarCustoCentBRL, nomeProvedor, COR_PROVEDOR, type ProvedorIA } from "@/lib/precos-ia";
import PageHeader from "@/components/groow/admin/ed2/PageHeader";
import Card from "@/components/groow/admin/ed2/Card";
import StatCard from "@/components/groow/admin/ed2/StatCard";
import Donut from "@/components/groow/admin/ed2/Donut";
import WorkspaceIaCard from "@/components/groow/hub/workspace-ia-card";
import HubLimiteForm from "@/components/groow/hub/hub-limite-form";

export const dynamic = "force-dynamic";

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}
function brl(cent: number) {
  return (cent / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function HubTokensPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { ok, erro } = await searchParams;
  const hub = await hubOpId();
  if (!hub) redirect("/owner");

  const [workspaces, porModelo, limiteHub] = await Promise.all([
    listWorkspacesIA(),
    usoPorModeloHub(),
    getHubLimiteTokens(),
  ]);

  const totIn = workspaces.reduce((a, w) => a + w.tokens_in, 0);
  const totOut = workspaces.reduce((a, w) => a + w.tokens_out, 0);
  const totTokens = totIn + totOut;
  const totInter = workspaces.reduce((a, w) => a + w.interacoes, 0);
  const totCustoReal = workspaces.reduce((a, w) => a + w.custo_cent_real, 0);
  const totCustoEstim = porModelo.reduce((a, m) => a + estimarCustoCentBRL(m.modelo, m.tokens_in, m.tokens_out), 0);
  const comUso = workspaces.filter((w) => w.tokens_in + w.tokens_out > 0).length;

  // breakdown por PROVEDOR p/ o donut
  const porProvedor = new Map<ProvedorIA, number>();
  for (const m of porModelo) porProvedor.set(m.provedor, (porProvedor.get(m.provedor) || 0) + m.tokens_in + m.tokens_out);
  const donutSlices = [...porProvedor.entries()]
    .filter(([, v]) => v > 0)
    .map(([prov, v]) => ({ label: nomeProvedor(prov), value: v, color: COR_PROVEDOR[prov] }));

  const semDados = totTokens === 0;
  const pctLimiteHub = limiteHub > 0 ? Math.min(100, Math.round((totTokens / limiteHub) * 100)) : 0;

  const msg = ok === "salvo" ? "Config do cliente salva." : ok === "modelo" ? "Modelo trocado e aplicado." : ok === "hub" ? "Limite do hub atualizado." : null;

  return (
    <>
      <PageHeader
        title="Tokens & IA"
        sub={`${workspaces.length} cliente(s) · ${fmt(totTokens)} tokens · provedor e modelo por cliente`}
      />

      {msg && (
        <div style={{ background: "rgba(52,199,89,0.10)", border: "1px solid rgba(52,199,89,0.25)", color: "#1d8a3a", borderRadius: 16, padding: "12px 18px", fontSize: 13.5, fontWeight: 500, marginBottom: 18 }}>
          {msg}
        </div>
      )}
      {erro && (
        <div role="alert" style={{ background: "rgba(255,59,48,0.10)", border: "1px solid rgba(255,59,48,0.28)", color: "#c8261c", borderRadius: 16, padding: "12px 18px", fontSize: 13.5, fontWeight: 500, marginBottom: 18 }}>
          Dados inválidos, revise os campos.
        </div>
      )}

      {/* KPIs do hub */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 20 }}>
        <StatCard label="Tokens no total" value={fmt(totTokens)} desc={`${fmt(totIn)} entrada · ${fmt(totOut)} saída`} />
        <StatCard label="Custo real (medido)" value={brl(totCustoReal)} currency="R$" desc="fonte: uso_ia (faturamento)" pill={totCustoReal === 0 ? { text: "sem custo lançado", tone: "neutral" } : null} />
        <StatCard label="Custo estimado" value={brl(totCustoEstim)} currency="R$" desc="tabela de preços · ajustar" pill={{ text: "estimativa", tone: "gold" }} />
        <StatCard label="Clientes com uso" value={String(comUso)} desc={`${totInter} conversas medidas`} />
      </div>

      {semDados && (
        <Card style={{ marginBottom: 20, display: "flex", gap: 12, alignItems: "flex-start" }} padding={18}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(10,132,255,0.12)", color: "#0a5cc4", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Info size={17} /></span>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--ed2-ink-2)" }}>
            <strong style={{ color: "var(--ed2-ink)" }}>Sem dados de consumo ainda.</strong> A configuração de provedor, modelo e limite já funciona e vale a partir de agora. Os números de tokens aparecem quando o pipeline de log (uso_ia) começa a registrar as chamadas de IA deste hub.
          </div>
        </Card>
      )}

      {/* layout: clientes (esq) + assinatura do hub (dir) */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", gap: 20, alignItems: "start" }} className="ed-tokens-grid">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16, minWidth: 0 }}>
          {workspaces.length === 0 ? (
            <Card padding={24}>
              <div style={{ color: "var(--ed2-ink-2)", fontSize: 14 }}>Nenhum cliente neste hub ainda.</div>
            </Card>
          ) : (
            workspaces.map((w) => (
              <WorkspaceIaCard
                key={w.id}
                id={w.id}
                nome={w.nome}
                provedor={w.provedor}
                modelo={w.modelo}
                limiteTokens={w.limite_tokens}
                travado={w.travado}
                chaveRef={w.chave_ref}
                tokensIn={w.tokens_in}
                tokensOut={w.tokens_out}
                interacoes={w.interacoes}
                custoCentReal={w.custo_cent_real}
              />
            ))
          )}
        </div>

        {/* Assinatura do hub */}
        <Card padding={22} style={{ position: "sticky", top: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{ width: 36, height: 36, borderRadius: 11, background: "rgba(201,169,97,0.14)", color: "#8a712d", display: "flex", alignItems: "center", justifyContent: "center" }}><Cpu size={17} /></span>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, color: "var(--ed2-ink)" }}>Assinatura do hub</h2>
              <div style={{ fontSize: 12, color: "var(--ed2-ink-2)" }}>Consumo somado de todos os clientes</div>
            </div>
          </div>

          <div style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-0.03em", color: "var(--ed2-ink)", fontVariantNumeric: "tabular-nums", marginTop: 12 }}>
            {fmt(totTokens)} <span style={{ fontSize: 14, fontWeight: 500, color: "var(--ed2-ink-2)" }}>tokens</span>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--ed2-ink-2)", marginTop: 2 }}>
            R$ {brl(totCustoReal)} real · ~R$ {brl(totCustoEstim)} estimado
          </div>

          {/* breakdown por provedor */}
          {donutSlices.length > 0 ? (
            <div style={{ marginTop: 8 }}>
              <Donut slices={donutSlices} centerLabel="tokens" centerValue={fmt(totTokens)} size={168} formatValue={(v) => fmt(v)} />
            </div>
          ) : (
            <div style={{ marginTop: 14, fontSize: 12.5, color: "var(--ed2-ink-2)" }}>Breakdown por provedor aparece quando houver consumo.</div>
          )}

          {/* breakdown por modelo */}
          {porModelo.length > 0 && (
            <div style={{ marginTop: 16, borderTop: "1px solid var(--ed2-hair)", paddingTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ed2-ink-2)", marginBottom: 10 }}>Por modelo</div>
              {porModelo.map((m) => {
                const mm = acharModelo(m.modelo);
                const est = estimarCustoCentBRL(m.modelo, m.tokens_in, m.tokens_out);
                return (
                  <div key={m.modelo} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "5px 0" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <span aria-hidden style={{ width: 8, height: 8, borderRadius: 99, background: COR_PROVEDOR[m.provedor], flexShrink: 0 }} />
                      <span style={{ fontSize: 12.5, color: "var(--ed2-ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{mm?.nome || m.modelo}</span>
                    </span>
                    <span style={{ fontSize: 12, color: "var(--ed2-ink-2)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{fmt(m.tokens_in + m.tokens_out)} · ~R${brl(est)}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* limite global */}
          <div style={{ marginTop: 16, borderTop: "1px solid var(--ed2-hair)", paddingTop: 14 }}>
            {limiteHub > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ height: 7, borderRadius: 99, background: "var(--ed2-surface)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pctLimiteHub}%`, background: pctLimiteHub >= 90 ? "#FF3B30" : pctLimiteHub >= 70 ? "#FF9F0A" : "#C9A961" }} />
                </div>
                <div style={{ fontSize: 11, color: "var(--ed2-ink-2)", marginTop: 4 }}>{fmt(totTokens)} / {fmt(limiteHub)} ({pctLimiteHub}%)</div>
              </div>
            )}
            <HubLimiteForm inicial={limiteHub} />
          </div>

          {/* guias expansíveis */}
          <div style={{ marginTop: 16, borderTop: "1px solid var(--ed2-hair)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
            <details>
              <summary style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: "var(--ed2-ink)", display: "flex", alignItems: "center", gap: 6 }}>
                <Info size={13} /> Guia de limites por cliente
              </summary>
              <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--ed2-ink-2)", marginTop: 8 }}>
                O limite é o teto de tokens somados (entrada + saída) daquele cliente. <strong style={{ color: "var(--ed2-ink)" }}>Travar</strong> congela o teto para o cliente não estourar durante testes. 0 = ilimitado. A troca de provedor/modelo vale a partir da próxima chamada.
              </div>
            </details>
            <details>
              <summary style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: "var(--ed2-ink)", display: "flex", alignItems: "center", gap: 6 }}>
                <TrendingUp size={13} /> Como o custo é calculado
              </summary>
              <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--ed2-ink-2)", marginTop: 8 }}>
                O <strong style={{ color: "var(--ed2-ink)" }}>custo real</strong> vem de uso_ia (medido por chamada, fonte de faturamento). A <strong style={{ color: "var(--ed2-ink)" }}>estimativa</strong> é tokens × preço por modelo (tabela em lib/precos-ia.ts, valores aproximados a ajustar).
              </div>
            </details>
          </div>
        </Card>
      </div>

      <style>{`@media (max-width: 900px){ .ed-tokens-grid{ grid-template-columns: 1fr !important; } .ed-tokens-grid > div:last-child, .ed-tokens-grid > :last-child{ position: static !important; } }`}</style>
    </>
  );
}
