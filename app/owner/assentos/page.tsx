import PageHead from "@/components/page-head";
import { IcoKey, IcoPlus } from "@/components/icons";

export const dynamic = "force-dynamic";

export default function AssentosPage() {
  return (
    <>
      <PageHead
        eyebrow="Plataforma"
        titulo="Assentos Claude"
        sub="Provisionamento de IA por cliente — 0 ativos."
        acao={<button className="btn"><IcoPlus width={15} height={15} /> Novo assento</button>}
      />

      <div className="card glass-soft" style={{ marginBottom: 18, fontSize: 13, lineHeight: 1.6 }}>
        O concorrente dá um <em>assento Team</em> por cliente (risco de ban por revenda de assinatura). Aqui o padrão é a
        <strong> API Anthropic central</strong> com custo medido — previsível e sem risco. Assentos ficam como opção só
        quando o cliente traz a própria conta; o token viveria só na VPS (arquivo root 0600, nunca no banco).
      </div>

      <div className="card" style={{ display: "grid", placeItems: "center", padding: 56, textAlign: "center" }}>
        <div className="icon-box" style={{ width: 56, height: 56 }}><IcoKey width={26} height={26} /></div>
        <strong style={{ marginTop: 16, fontSize: 16 }}>Nenhum assento cadastrado</strong>
        <p className="muted" style={{ margin: "4px 0 16px", maxWidth: 420 }}>
          A plataforma usa a API central. Crie um assento só se um cliente for trazer a própria assinatura Claude.
        </p>
        <button className="btn"><IcoPlus width={15} height={15} /> Criar o primeiro</button>
      </div>
    </>
  );
}
