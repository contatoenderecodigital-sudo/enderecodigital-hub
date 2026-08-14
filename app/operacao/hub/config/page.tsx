import { redirect } from "next/navigation";
import { Sparkles, Globe } from "lucide-react";
import { getHubConfig } from "@/lib/platform-config";
import { hubOpId } from "@/lib/hub-ctx";
import PageHeader from "@/components/groow/admin/ed2/PageHeader";
import Card from "@/components/groow/admin/ed2/Card";
import { salvarConfigAction } from "@/app/operacao/hub/actions";
import SubmitButton from "@/components/groow/hub/submit-button";

export const dynamic = "force-dynamic";

const iStyle: React.CSSProperties = { display: "block", width: "100%", borderRadius: 12, border: "1px solid var(--ed2-hair)", background: "var(--ed2-surface-2)", padding: "10px 12px", fontSize: 14, boxSizing: "border-box", color: "var(--ed2-ink)" };
const lStyle: React.CSSProperties = { display: "block", fontSize: 11.5, fontWeight: 600, color: "var(--ed2-ink-2)", marginBottom: 6, letterSpacing: "0.02em" };
const goldBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, background: "#C9A961", color: "#fff", border: "none", padding: "11px 20px", borderRadius: 999, fontWeight: 600, fontSize: 14, cursor: "pointer", boxShadow: "0 4px 12px rgba(201,169,97,0.28)" };

function badge(ok: boolean, on: string, off: string) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: ok ? "rgba(52,199,89,0.14)" : "rgba(255,159,10,0.14)", color: ok ? "#1d8a3a" : "#a85f00" }}>
      {ok ? on : off}
    </span>
  );
}

export default async function HubConfigPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { ok, erro } = await searchParams;
  const hub = await hubOpId();
  const cfg = await getHubConfig();
  const temChaveGlobal = !!process.env.ANTHROPIC_API_KEY;

  const msgErro = erro === "nome" ? "Informe o nome do hub." : erro ? "Dados inválidos, revise os campos." : null;

  return (
    <>
      <PageHeader title="Configurações do hub" sub="Identidade, domínio e IA do hub ativo." />

      {ok && (
        <div style={{ background: "rgba(52,199,89,0.10)", border: "1px solid rgba(52,199,89,0.25)", color: "#1d8a3a", borderRadius: 16, padding: "12px 18px", fontSize: 13.5, fontWeight: 500, marginBottom: 18 }}>
          Configurações salvas.
        </div>
      )}
      {msgErro && (
        <div role="alert" style={{ background: "rgba(255,59,48,0.10)", border: "1px solid rgba(255,59,48,0.28)", color: "#c8261c", borderRadius: 16, padding: "12px 18px", fontSize: 13.5, fontWeight: 500, marginBottom: 18 }}>
          {msgErro}
        </div>
      )}

      {!hub || !cfg ? (
        <Card padding={24}>
          <div style={{ color: "var(--ed2-ink-2)", fontSize: 14 }}>Entre em um hub para editar as configurações dele.</div>
        </Card>
      ) : (
        <>
          <Card style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ed2-ink-2)", marginBottom: 14 }}>Identidade do hub</div>
            <form action={salvarConfigAction}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
                <div><label style={lStyle}>Nome *</label><input name="nome" defaultValue={cfg.nome} required style={iStyle} /></div>
                <div><label style={lStyle}>Domínio</label><input name="dominio" defaultValue={cfg.dominio || ""} placeholder="hub.exemplo.com.br" style={iStyle} /></div>
                <div style={{ gridColumn: "1 / -1" }}><label style={lStyle}>Descrição</label><input name="descricao" defaultValue={cfg.descricao || ""} placeholder="Descrição curta (PWA)" style={iStyle} /></div>
                <div><label style={lStyle}>Cor de destaque</label><input name="cor_destaque" defaultValue={cfg.cor_destaque || "#C9A961"} placeholder="#C9A961" style={iStyle} /></div>
                <div><label style={lStyle}>Teto de IA / mês (US$)</label><input name="ia_limite_mensal_usd" inputMode="decimal" defaultValue={String(cfg.ia_limite_mensal_usd || 0)} style={iStyle} /></div>
                <div><label style={lStyle}>Título da tela de login</label><input name="login_titulo" defaultValue={cfg.login_titulo || ""} style={iStyle} /></div>
                <div><label style={lStyle}>Texto do botão de login</label><input name="login_botao" defaultValue={cfg.login_botao || ""} style={iStyle} /></div>
              </div>
              <div style={{ marginTop: 18 }}><SubmitButton style={goldBtn} pendingLabel="Salvando…">Salvar configurações</SubmitButton></div>
            </form>
          </Card>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18 }}>
            <Card>
              <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 12 }}>
                <span style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(201,169,97,0.14)", color: "#8a712d", display: "flex", alignItems: "center", justifyContent: "center" }}><Sparkles size={18} /></span>
                <div>
                  <h2 style={{ margin: 0, fontSize: 16, color: "var(--ed2-ink)" }}>Integração de IA</h2>
                  <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--ed2-ink-2)" }}>Chave da Anthropic (motor dos assistentes).</p>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {badge(cfg.tem_anthropic, "chave do hub configurada", "hub sem chave")}
                {badge(temChaveGlobal, "API central disponível", "sem API central")}
              </div>
              <p style={{ fontSize: 12.5, marginTop: 12, lineHeight: 1.6, color: "var(--ed2-ink-2)" }}>
                A chave do hub fica no banco (coluna <code>anthropic_api_key</code>); a central vem da env <code>ANTHROPIC_API_KEY</code> no servidor. Sem nenhuma das duas, a geração de conteúdo não roda.
              </p>
            </Card>

            <Card>
              <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 12 }}>
                <span style={{ width: 40, height: 40, borderRadius: 12, background: "var(--ed2-surface)", color: "var(--ed2-ink-2)", display: "flex", alignItems: "center", justifyContent: "center" }}><Globe size={18} /></span>
                <div>
                  <h2 style={{ margin: 0, fontSize: 16, color: "var(--ed2-ink)" }}>Endereço</h2>
                  <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--ed2-ink-2)" }}>Slug interno e domínio do hub.</p>
                </div>
              </div>
              <div style={{ color: "var(--ed2-ink-2)", fontSize: 12 }}>slug</div>
              <div style={{ fontWeight: 600, color: "var(--ed2-ink)" }}>{cfg.slug}</div>
              <div style={{ color: "var(--ed2-ink-2)", fontSize: 12, marginTop: 10 }}>domínio</div>
              <div style={{ fontWeight: 600, color: "var(--ed2-ink)" }}>{cfg.dominio || "— não configurado —"}</div>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
