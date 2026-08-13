import Link from "@/components/link";
import PageHead from "@/components/page-head";
import OpsTarefasList from "@/components/ops-tarefas-list";
import { listOpsTarefas, tarefasResumo } from "@/lib/ops";
import { novaTarefaAction } from "../actions";
import { IcoPlus } from "@/components/icons";

export const dynamic = "force-dynamic";

const goldPill = { color: "#14151a", background: "linear-gradient(135deg,var(--gold),var(--gold-l))", borderColor: "transparent" } as const;

export default async function TarefasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const [tarefas, r] = await Promise.all([listOpsTarefas(sp.status), tarefasResumo()]);

  return (
    <>
      <PageHead eyebrow="Agência · GROOW OS" titulo="Tarefas" sub="O que precisa da sua mão — follow-ups, contratos e lembretes da operação." />

      <div className="cols-4">
        <div className="card"><div className="kpi">{r.pendentes}</div><div className="kpi-label">Pendentes</div></div>
        <div className="card"><div className="kpi" style={{ color: r.atrasadas ? "var(--danger)" : undefined }}>{r.atrasadas}</div><div className="kpi-label">Atrasadas</div></div>
        <div className="card"><div className="kpi">{r.alta}</div><div className="kpi-label">Prioridade alta</div></div>
        <div className="card"><div className="kpi" style={{ color: "var(--ok)" }}>{r.feitas}</div><div className="kpi-label">Concluídas</div></div>
      </div>

      <details className="card" style={{ marginTop: 18 }}>
        <summary style={{ cursor: "pointer", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
          <IcoPlus width={16} height={16} /> Nova tarefa
        </summary>
        <form action={novaTarefaAction} className="cols-3" style={{ gap: 12, marginTop: 14 }}>
          <div style={{ gridColumn: "1 / 2" }}><label>Título *</label><input name="titulo" required /></div>
          <div><label>Prioridade</label>
            <select name="prioridade" className="filter-select" style={{ width: "100%" }}>
              <option value="alta">alta</option><option value="media" selected>média</option><option value="baixa">baixa</option>
            </select>
          </div>
          <div><label>Vence em</label><input name="due_date" type="date" /></div>
          <div style={{ gridColumn: "1 / -1" }}><button className="btn" type="submit"><IcoPlus width={15} height={15} /> Adicionar</button></div>
        </form>
      </details>

      <div className="row" style={{ gap: 6, marginTop: 16 }}>
        <Link href="/owner/ops/tarefas" className={"pill" + (!sp.status ? " gold" : "")} style={!sp.status ? goldPill : undefined}>Todas</Link>
        <Link href="/owner/ops/tarefas?status=pendente" className="pill" style={sp.status === "pendente" ? goldPill : undefined}>Pendentes</Link>
        <Link href="/owner/ops/tarefas?status=feita" className="pill" style={sp.status === "feita" ? goldPill : undefined}>Concluídas</Link>
      </div>

      <div style={{ marginTop: 14 }}>
        <OpsTarefasList tarefas={tarefas} />
      </div>
    </>
  );
}
