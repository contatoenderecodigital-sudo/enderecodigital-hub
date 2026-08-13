import PageHead from "@/components/page-head";

export const dynamic = "force-dynamic";

export default function ConfigOwnerPage() {
  return (
    <>
      <PageHead eyebrow="Sistema" titulo="Configurações" sub="Ajustes da plataforma." />
      <div className="cols-2">
        <div className="card">
          <h2 style={{ margin: "0 0 4px", fontSize: 17 }}>Integrações de IA</h2>
          <p className="muted" style={{ marginTop: 0 }}>Chave da Anthropic (motor dos assistentes).</p>
          <span className="badge warn">chave não configurada</span>
          <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>Definida por variável de ambiente no servidor (ANTHROPIC_API_KEY).</p>
        </div>
        <div className="card">
          <h2 style={{ margin: "0 0 4px", fontSize: 17 }}>Domínio</h2>
          <p className="muted" style={{ marginTop: 0 }}>Onde a plataforma responde.</p>
          <div style={{ fontWeight: 600 }}>hub.179.198.126.197.sslip.io</div>
          <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>Troca para enderecodigital.tech quando o DNS apontar pro servidor.</p>
        </div>
      </div>
    </>
  );
}
