import PageHead from "@/components/page-head";
import { segurancaResumo } from "@/lib/platform-config";
import { hubOpId } from "@/lib/hub-ctx";
import { IcoLock, IcoShield, IcoWhatsapp } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function SegurancaPage() {
  const hub = await hubOpId();
  const r = await segurancaResumo();

  return (
    <>
      <PageHead eyebrow="Sistema" titulo="Segurança" sub="Isolamento, acessos e conexões do hub ativo." />

      {!hub && (
        <div className="err" style={{ marginBottom: 16 }}>
          Sem hub selecionado — os números abaixo ficam zerados. Entre num hub para ver os dados reais.
        </div>
      )}

      <div className="cols-3">
        <div className="card"><div className="kpi">{r.usuarios}</div><div className="kpi-label">Usuários com acesso</div></div>
        <div className="card"><div className="kpi">{r.negocios}</div><div className="kpi-label">Workspaces ativos</div></div>
        <div className="card"><div className="kpi" style={{ color: r.waConectados ? "var(--ok)" : undefined }}>{r.waConectados}</div><div className="kpi-label">WhatsApp conectados</div></div>
      </div>

      <div className="cols-2" style={{ marginTop: 18, gap: 16 }}>
        <div className="card">
          <div className="row" style={{ gap: 12 }}>
            <div className="icon-box"><IcoLock width={18} height={18} /></div>
            <div>
              <strong>Isolamento por design</strong>
              <p className="muted" style={{ margin: "6px 0 0", lineHeight: 1.6 }}>
                Todo dado de cliente é escopado por <code>negocio_id</code>; a operação por <code>hub_id</code>.
                O roteamento do WhatsApp é por <code>phone_number_id</code> único — número desconhecido é descartado.
                Sessões são JWT httpOnly. Isolamento real, não confiança.
              </p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="row" style={{ gap: 12 }}>
            <div className="icon-box"><IcoShield width={18} height={18} /></div>
            <div>
              <strong>Credenciais</strong>
              <p className="muted" style={{ margin: "6px 0 0", lineHeight: 1.6 }}>
                Senhas de usuário com hash forte; o cofre de senhas de clientes usa AES-256-GCM
                (<code>SENHAS_CHAVE</code>). Tokens de WhatsApp e API ficam fora do bundle público.
              </p>
              <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <span className="badge ok"><IcoWhatsapp width={12} height={12} /> roteamento isolado</span>
                <span className="badge ok">JWT httpOnly</span>
                <span className="badge ok">cofre cifrado</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
