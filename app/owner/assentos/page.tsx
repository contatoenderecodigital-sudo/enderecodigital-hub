import PageHead from "@/components/page-head";
import { IcoKey } from "@/components/icons";

export const dynamic = "force-dynamic";

export default function AssentosPage() {
  return (
    <>
      <PageHead eyebrow="Plataforma" titulo="Assentos Claude" sub="Provisionamento de IA por cliente." />

      <div className="card">
        <div className="row" style={{ gap: 12 }}>
          <div className="icon-box"><IcoKey width={18} height={18} /></div>
          <div>
            <strong>Modelo do Endereço Digital</strong>
            <p className="muted" style={{ margin: "6px 0 0", maxWidth: 720 }}>
              O concorrente dá um <em>assento Team</em> por cliente (risco de ban da Anthropic por revenda de assinatura).
              Aqui o padrão é <strong>API Anthropic central</strong> com custo medido por cliente — previsível e sem risco.
              Cada cliente tem limite de tokens e modelo definidos em <strong>Config. do cliente</strong>, e o consumo aparece em <strong>Tokens</strong>.
            </p>
          </div>
        </div>
        <div className="cols-3" style={{ marginTop: 18 }}>
          <div className="card"><div className="kpi-label">Padrão</div><div style={{ fontWeight: 700, marginTop: 6 }}>API da plataforma</div><p className="muted" style={{ fontSize: 13, margin: "4px 0 0" }}>Custo real, sem assento revendido.</p></div>
          <div className="card"><div className="kpi-label">Opcional</div><div style={{ fontWeight: 700, marginTop: 6 }}>Claude do cliente</div><p className="muted" style={{ fontSize: 13, margin: "4px 0 0" }}>O cliente traz a própria assinatura.</p></div>
          <div className="card"><div className="kpi-label">Controle</div><div style={{ fontWeight: 700, marginTop: 6 }}>Limite por cliente</div><p className="muted" style={{ fontSize: 13, margin: "4px 0 0" }}>Modelo e teto de tokens por tenant.</p></div>
        </div>
      </div>
    </>
  );
}
