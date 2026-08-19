import PageHead from "@/components/page-head";
import { listOpsClientes, opsCarteiraResumo } from "@/lib/ops";
import { novoClienteAction, statusClienteAction } from "../actions";
import { IcoPlus, IcoWhatsapp, IcoBuilding } from "@/components/icons";
import CampoTelefone from "@/components/campo-telefone";

export const dynamic = "force-dynamic";

function brl(n: number) {
  return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const COR: Record<string, string> = { ativo: "ok", pausado: "warn", cancelado: "", concluido: "gold" };

export default async function CarteiraPage() {
  const [clientes, r] = await Promise.all([listOpsClientes(), opsCarteiraResumo()]);

  return (
    <>
      <PageHead
        eyebrow="Agência · GROOW OS"
        titulo="Carteira"
        sub="Os contratos fechados — MRR, ticket médio e progresso de implantação de cada cliente."
      />

      <div className="cols-4">
        <div className="card"><div className="kpi">{r.ativos}</div><div className="kpi-label">Clientes ativos</div></div>
        <div className="card"><div className="kpi" style={{ color: "var(--gold-l)" }}>{brl(r.mrr)}</div><div className="kpi-label">MRR (recorrente)</div></div>
        <div className="card"><div className="kpi">{brl(r.ticket)}</div><div className="kpi-label">Ticket médio</div></div>
        <div className="card"><div className="kpi">{r.vencendo}</div><div className="kpi-label">Contratos vencendo (30d)</div></div>
      </div>

      <details className="card" style={{ marginTop: 18 }}>
        <summary style={{ cursor: "pointer", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
          <IcoPlus width={16} height={16} /> Novo cliente
        </summary>
        <form action={novoClienteAction} className="cols-3" style={{ gap: 12, marginTop: 14 }}>
          <div><label>Empresa *</label><input name="empresa" required /></div>
          <div><label>Responsável</label><input name="responsavel" /></div>
          <div><label>WhatsApp</label><CampoTelefone name="whatsapp" /></div>
          <div><label>E-mail</label><input name="email" type="email" /></div>
          <div><label>Plano</label><input name="plano" placeholder="Ex.: Presença + WhatsApp IA" /></div>
          <div><label>Início do contrato</label><input name="inicio_contrato" type="date" /></div>
          <div><label>Mensalidade (R$)</label><input name="valor_mensal" inputMode="decimal" placeholder="0" /></div>
          <div><label>Setup (R$)</label><input name="valor_setup" inputMode="decimal" placeholder="0" /></div>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button className="btn" type="submit"><IcoPlus width={15} height={15} /> Adicionar</button>
          </div>
        </form>
      </details>

      {clientes.length === 0 ? (
        <div className="card" style={{ marginTop: 16, textAlign: "center", padding: 44 }}>
          <p className="muted" style={{ margin: 0 }}>Nenhum cliente na carteira ainda. Converta um lead ou cadastre acima.</p>
        </div>
      ) : (
        <div className="cols-3" style={{ marginTop: 16 }}>
          {clientes.map((c) => {
            const mensal = Number(c.valor_mensal);
            const setup = Number(c.valor_setup);
            return (
              <div key={c.id} className="card">
                <div className="spread">
                  <div className="row" style={{ gap: 10 }}>
                    <div className="avatar" style={{ width: 38, height: 38, fontSize: 13 }}>{c.empresa.slice(0, 2).toUpperCase()}</div>
                    <div>
                      <strong>{c.empresa}</strong>
                      {c.responsavel && <div className="muted" style={{ fontSize: 12 }}>{c.responsavel}</div>}
                    </div>
                  </div>
                  <span className={"badge " + (COR[c.status] || "")}>{c.status}</span>
                </div>

                <div className="row" style={{ gap: 10, marginTop: 14 }}>
                  <div className="glass-soft" style={{ borderRadius: 11, padding: "9px 11px", flex: 1 }}>
                    <div className="muted" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.08em" }}>Mensal</div>
                    <div style={{ fontWeight: 700, marginTop: 2 }}>{brl(mensal)}</div>
                  </div>
                  <div className="glass-soft" style={{ borderRadius: 11, padding: "9px 11px", flex: 1 }}>
                    <div className="muted" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.08em" }}>Setup</div>
                    <div style={{ fontWeight: 700, marginTop: 2 }}>{brl(setup)}</div>
                  </div>
                </div>

                <div style={{ marginTop: 14 }}>
                  <div className="spread" style={{ fontSize: 12 }}>
                    <span className="muted">Implantação</span>
                    <span>{c.progresso}%</span>
                  </div>
                  <div className="hbar" style={{ marginTop: 6, width: "100%" }}>
                    <i style={{ width: `${c.progresso}%`, background: "linear-gradient(90deg,var(--gold),var(--gold-l))" }} />
                  </div>
                </div>

                <div className="row" style={{ gap: 8, marginTop: 14 }}>
                  {c.whatsapp && (
                    <a className="btn btn-ghost btn-sm" href={`https://wa.me/${c.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                      <IcoWhatsapp width={14} height={14} /> WhatsApp
                    </a>
                  )}
                  <form action={statusClienteAction} style={{ marginLeft: "auto" }}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="status" value={c.status === "ativo" ? "pausado" : "ativo"} />
                    <button className="btn btn-ghost btn-sm" type="submit">
                      {c.status === "ativo" ? "Pausar" : "Reativar"}
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
