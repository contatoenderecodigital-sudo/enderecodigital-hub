import PageHead from "@/components/page-head";
import FlagToggle from "@/components/flag-toggle";
import { listFlags } from "@/lib/platform-config";
import { hubOpId } from "@/lib/hub-ctx";

export const dynamic = "force-dynamic";

export default async function FlagsPage() {
  const hub = await hubOpId();
  const flags = await listFlags();
  const ligadas = flags.filter((f) => f.ligado).length;

  return (
    <>
      <PageHead
        eyebrow="Sistema"
        titulo="Feature Flags"
        sub={hub ? "Liga e desliga funcionalidades deste hub — salvo no banco por hub." : "Entre em um hub para configurar as flags dele."}
      />

      {!hub && (
        <div className="err" style={{ marginBottom: 16 }}>
          Nenhum hub selecionado. As flags são por hub — entre num hub pela tela de <strong>Todos os hubs</strong> primeiro.
        </div>
      )}

      <div className="cols-3" style={{ marginBottom: 18 }}>
        <div className="card"><div className="kpi">{flags.length}</div><div className="kpi-label">Funcionalidades</div></div>
        <div className="card"><div className="kpi" style={{ color: "var(--ok)" }}>{ligadas}</div><div className="kpi-label">Ligadas</div></div>
        <div className="card"><div className="kpi">{flags.length - ligadas}</div><div className="kpi-label">Desligadas</div></div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {flags.map(({ def, ligado }, i) => (
          <div key={def.chave} className="spread" style={{ padding: "14px 20px", borderTop: i ? "1px solid var(--line)" : "none" }}>
            <div>
              <strong>{def.nome}</strong>
              <div className="muted" style={{ fontSize: 13 }}>{def.desc}</div>
            </div>
            {hub ? (
              <FlagToggle chave={def.chave} ligado={ligado} />
            ) : (
              <span className={"badge " + (ligado ? "ok" : "")}>{ligado ? "padrão on" : "padrão off"}</span>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
