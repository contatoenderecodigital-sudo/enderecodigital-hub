import PageHead from "@/components/page-head";
import { IcoAlert } from "@/components/icons";

export const dynamic = "force-dynamic";

export default function AlertasPage() {
  return (
    <>
      <PageHead eyebrow="Sistema" titulo="Alertas" sub="Avisos operacionais da plataforma." />
      <div className="card" style={{ display: "grid", placeItems: "center", padding: 48, textAlign: "center" }}>
        <div className="icon-box" style={{ width: 52, height: 52 }}><IcoAlert width={24} height={24} /></div>
        <strong style={{ marginTop: 14 }}>Tudo tranquilo</strong>
        <p className="muted" style={{ margin: "4px 0 0" }}>Nenhum alerta no momento. Aparecem aqui: chave de IA sem saldo, conexão de WhatsApp caída, deploy com erro.</p>
      </div>
    </>
  );
}
