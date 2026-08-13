import PageHead from "@/components/page-head";
import { IcoLock } from "@/components/icons";

export const dynamic = "force-dynamic";

export default function SegurancaPage() {
  return (
    <>
      <PageHead eyebrow="Sistema" titulo="Segurança" sub="Blindagem e sessões da plataforma." />
      <div className="cols-3">
        <div className="card"><div className="kpi">0</div><div className="kpi-label">IPs bloqueados</div></div>
        <div className="card"><div className="kpi">1</div><div className="kpi-label">Sessões ativas</div></div>
        <div className="card"><div className="kpi">0</div><div className="kpi-label">Ameaças detectadas</div></div>
      </div>
      <div className="card" style={{ marginTop: 18 }}>
        <div className="row" style={{ gap: 12 }}>
          <div className="icon-box"><IcoLock width={18} height={18} /></div>
          <div>
            <strong>Isolamento por design</strong>
            <p className="muted" style={{ margin: "6px 0 0", maxWidth: 720 }}>
              Todo dado de cliente é escopado por <code>negocio_id</code> no código (cofre <code>scopedDb</code>);
              o roteamento do WhatsApp é por <code>phone_number_id</code> único (número desconhecido é descartado);
              sessões são JWT httpOnly. Isso é isolamento real — não "segurança por confiança".
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
