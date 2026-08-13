import PageHead from "@/components/page-head";
import { IcoHelp } from "@/components/icons";

export const dynamic = "force-dynamic";

export default function SuportePage() {
  return (
    <>
      <PageHead eyebrow="Plataforma" titulo="Suporte" sub="Canal de atendimento da plataforma." />
      <div className="card">
        <div className="row" style={{ gap: 12 }}>
          <div className="icon-box"><IcoHelp width={18} height={18} /></div>
          <div>
            <strong>Precisa de ajuda?</strong>
            <p className="muted" style={{ margin: "4px 0 0" }}>Fale com o time do Endereço Digital. Aqui também vão aparecer os chamados abertos pelos clientes.</p>
          </div>
        </div>
        <a className="btn" href="https://wa.me/" target="_blank" rel="noreferrer" style={{ marginTop: 16 }}>Abrir WhatsApp</a>
      </div>
    </>
  );
}
