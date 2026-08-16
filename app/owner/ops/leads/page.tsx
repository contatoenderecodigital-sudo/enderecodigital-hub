import Link from "@/components/link";
import PageHead from "@/components/page-head";
import OpsLeadsTable from "@/components/ops-leads-table";
import { listOpsLeads, opsLeadsResumo, LEAD_STATUS } from "@/lib/ops";
import { novoLeadAction } from "../actions";
import { IcoPlus, IcoSearch, IcoFunnel } from "@/components/icons";
import CampoTelefone from "@/components/campo-telefone";

export const dynamic = "force-dynamic";

export default async function OpsLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; ok?: string }>;
}) {
  const sp = await searchParams;
  const [leads, resumo] = await Promise.all([
    listOpsLeads({ status: sp.status, q: sp.q }),
    opsLeadsResumo(),
  ]);

  return (
    <>
      <PageHead
        eyebrow="Agência · GROOW OS"
        titulo="Leads"
        sub="O CRM da agência — todo mundo que chegou por prospecção, site, tráfego ou indicação."
      />

      <div className="cols-4">
        <div className="card"><div className="kpi">{resumo.total}</div><div className="kpi-label">Total de leads</div></div>
        <div className="card"><div className="kpi">{resumo.novos_mes}</div><div className="kpi-label">Novos este mês</div></div>
        <div className="card"><div className="kpi">{resumo.fechados}</div><div className="kpi-label">Fechados</div></div>
        <div className="card"><div className="kpi">{resumo.conversao}%</div><div className="kpi-label">Conversão</div></div>
      </div>

      {/* novo lead */}
      <details className="card" style={{ marginTop: 18 }}>
        <summary style={{ cursor: "pointer", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
          <IcoPlus width={16} height={16} /> Novo lead
        </summary>
        <form action={novoLeadAction} className="cols-3" style={{ gap: 12, marginTop: 14 }}>
          <div><label>Nome *</label><input name="nome" required /></div>
          <div><label>Empresa</label><input name="empresa" /></div>
          <div><label>WhatsApp</label><CampoTelefone name="whatsapp" /></div>
          <div><label>E-mail</label><input name="email" type="email" /></div>
          <div><label>Setor / nicho</label><input name="setor" /></div>
          <div>
            <label>Status</label>
            <select name="status" className="filter-select" style={{ width: "100%" }}>
              {LEAD_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <button className="btn" type="submit"><IcoPlus width={15} height={15} /> Adicionar lead</button>
          </div>
        </form>
      </details>

      {/* filtros */}
      <div className="toolbar" style={{ marginTop: 16 }}>
        <form className="search-box" action="/owner/ops/leads">
          <IcoSearch width={16} height={16} />
          <input name="q" defaultValue={sp.q || ""} placeholder="Buscar por nome, empresa ou e-mail…" />
          {sp.status && <input type="hidden" name="status" value={sp.status} />}
        </form>
        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
          <Link href="/owner/ops/leads" className={"pill" + (!sp.status ? " gold" : "")} style={!sp.status ? goldPill : undefined}>
            <IcoFunnel width={13} height={13} /> Todos
          </Link>
          {LEAD_STATUS.map((s) => (
            <Link key={s} href={`/owner/ops/leads?status=${s}`} className={"pill" + (sp.status === s ? " gold" : "")} style={sp.status === s ? goldPill : undefined}>
              {s}
            </Link>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <OpsLeadsTable leads={leads} />
      </div>
    </>
  );
}

const goldPill = {
  color: "#14151a",
  background: "linear-gradient(135deg,var(--gold),var(--gold-l))",
  borderColor: "transparent",
} as const;
