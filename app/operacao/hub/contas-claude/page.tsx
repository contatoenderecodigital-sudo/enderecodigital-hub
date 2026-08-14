import { redirect } from "next/navigation";
import { Sparkles, Users, Plus, Trash2 } from "lucide-react";
import { listContasClaude, listNegocios } from "@/lib/data";
import { hubOpId } from "@/lib/hub-ctx";
import PageHeader from "@/components/groow/admin/ed2/PageHeader";
import Card from "@/components/groow/admin/ed2/Card";
import {
  conectarContaAction,
  toggleCompartilhadaAction,
  statusContaAction,
  excluirContaAction,
} from "@/app/operacao/hub/actions";

export const dynamic = "force-dynamic";

const iStyle: React.CSSProperties = { display: "block", width: "100%", borderRadius: 12, border: "1px solid var(--ed2-hair)", background: "var(--ed2-surface-2)", padding: "10px 12px", fontSize: 14, boxSizing: "border-box", color: "var(--ed2-ink)" };
const lStyle: React.CSSProperties = { display: "block", fontSize: 11.5, fontWeight: 600, color: "var(--ed2-ink-2)", marginBottom: 6, letterSpacing: "0.02em" };
const goldBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, background: "#C9A961", color: "#fff", border: "none", padding: "10px 18px", borderRadius: 999, fontWeight: 600, fontSize: 13, cursor: "pointer", boxShadow: "0 4px 12px rgba(201,169,97,0.28)" };
const ghostBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, background: "var(--ed2-surface)", color: "var(--ed2-ink)", border: "1px solid var(--ed2-hair)", padding: "8px 14px", borderRadius: 999, fontWeight: 600, fontSize: 12.5, cursor: "pointer" };

function badge(ok: boolean, on: string, off: string) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: ok ? "rgba(52,199,89,0.14)" : "rgba(255,159,10,0.14)", color: ok ? "#1d8a3a" : "#a85f00" }}>
      {ok ? on : off}
    </span>
  );
}

export default async function HubContasClaudePage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { ok, erro } = await searchParams;
  const hub = await hubOpId();
  if (!hub) redirect("/owner");
  const [contas, clientes] = await Promise.all([listContasClaude(), listNegocios(hub)]);
  const comIA = clientes.filter((c) => c.ia_habilitada && c.ia_modo === "api_plataforma").length;
  const temChave = !!process.env.ANTHROPIC_API_KEY;

  const msgErro = erro === "nome" ? "Informe o nome da conta." : erro ? "Dados inválidos, revise os campos." : null;

  return (
    <>
      <PageHeader title="Contas Claude" sub="Contas de IA conectadas — a central da plataforma ou dedicadas a um cliente." />

      {ok && (
        <div style={{ background: "rgba(52,199,89,0.10)", border: "1px solid rgba(52,199,89,0.25)", color: "#1d8a3a", borderRadius: 16, padding: "12px 18px", fontSize: 13.5, fontWeight: 500, marginBottom: 18 }}>
          Conta conectada.
        </div>
      )}
      {msgErro && (
        <div role="alert" style={{ background: "rgba(255,59,48,0.10)", border: "1px solid rgba(255,59,48,0.28)", color: "#c8261c", borderRadius: 16, padding: "12px 18px", fontSize: 13.5, fontWeight: 500, marginBottom: 18 }}>
          {msgErro}
        </div>
      )}

      <Card style={{ marginBottom: 18, fontSize: 13.5, lineHeight: 1.6, color: "var(--ed2-ink-2)" }} padding={20}>
        O caminho oficial do Endereço Digital é a <strong style={{ color: "var(--ed2-ink)" }}>API Anthropic central</strong> com custo medido por cliente — sem assento revendido, sem risco de ban. &quot;Claude do cliente&quot; só quando o cliente traz a própria assinatura.
      </Card>

      {/* Conectar conta */}
      <Card style={{ marginBottom: 18 }} padding={20}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, fontWeight: 600, color: "var(--ed2-ink)" }}>
          <Plus size={16} /> Conectar conta
        </div>
        <form action={conectarContaAction} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, alignItems: "end" }}>
          <div><label style={lStyle}>Nome / apelido *</label><input name="nome" required placeholder="Ex.: Conta do cliente X" style={iStyle} /></div>
          <div>
            <label style={lStyle}>Plano</label>
            <select name="plano" style={{ ...iStyle, appearance: "auto" }}><option>Pro</option><option>Max</option><option>Max20x</option><option>Team</option></select>
          </div>
          <div>
            <label style={lStyle}>Tipo</label>
            <select name="tipo" style={{ ...iStyle, appearance: "auto" }}><option value="dedicada">dedicada</option><option value="compartilhada">compartilhada</option></select>
          </div>
          <div><button type="submit" style={goldBtn}><Plus size={15} /> Conectar</button></div>
        </form>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 18 }}>
        {/* Conta central */}
        <Card padding={22}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <span style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(201,169,97,0.14)", color: "#8a712d", display: "flex", alignItems: "center", justifyContent: "center" }}><Sparkles size={18} /></span>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <strong style={{ color: "var(--ed2-ink)" }}>API da plataforma</strong>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: "rgba(201,169,97,0.14)", color: "#8a712d" }}>CENTRAL</span>
                </div>
                <div style={{ color: "var(--ed2-ink-2)", fontSize: 12.5 }}>Anthropic · custo real medido</div>
              </div>
            </div>
            {badge(temChave, "válida", "sem chave")}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <div style={{ flex: 1, background: "var(--ed2-surface-2)", borderRadius: 12, padding: "10px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ed2-ink-2)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em" }}><Users size={13} /> Clientes</div>
              <div style={{ fontWeight: 700, fontSize: 18, marginTop: 3, color: "var(--ed2-ink)" }}>{comIA}</div>
            </div>
            <div style={{ flex: 1, background: "var(--ed2-surface-2)", borderRadius: 12, padding: "10px 12px" }}>
              <div style={{ color: "var(--ed2-ink-2)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Custo</div>
              <div style={{ fontWeight: 700, fontSize: 18, marginTop: 3, color: "var(--ed2-ink)" }}>medido</div>
            </div>
          </div>
        </Card>

        {contas.map((c) => (
          <Card key={c.id} padding={22}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <span style={{ width: 40, height: 40, borderRadius: 12, background: "var(--ed2-surface)", color: "var(--ed2-ink-2)", display: "flex", alignItems: "center", justifyContent: "center" }}><Sparkles size={18} /></span>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <strong style={{ color: "var(--ed2-ink)" }}>{c.nome}</strong>
                    {c.tipo === "compartilhada" && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: "rgba(201,169,97,0.14)", color: "#8a712d" }}>COMPARTILHADA</span>}
                  </div>
                  <div style={{ color: "var(--ed2-ink-2)", fontSize: 12.5 }}>{c.plano || "—"}</div>
                </div>
              </div>
              {badge(c.status === "ativa", c.status, c.status)}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap", alignItems: "center" }}>
              <form action={statusContaAction}>
                <input type="hidden" name="id" value={c.id} />
                <input type="hidden" name="status" value={c.status === "ativa" ? "inativa" : "ativa"} />
                <button type="submit" style={ghostBtn}>{c.status === "ativa" ? "Desativar" : "Ativar"}</button>
              </form>
              <form action={toggleCompartilhadaAction}>
                <input type="hidden" name="id" value={c.id} />
                <button type="submit" style={ghostBtn}>{c.tipo === "compartilhada" ? "Tornar dedicada" : "Tornar compartilhada"}</button>
              </form>
              <form action={excluirContaAction} style={{ marginLeft: "auto" }}>
                <input type="hidden" name="id" value={c.id} />
                <button type="submit" aria-label="Excluir" style={{ ...ghostBtn, color: "#c8261c", padding: "8px 10px" }}><Trash2 size={15} /></button>
              </form>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
