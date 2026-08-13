import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { activeNegocioId } from "@/lib/tenant";
import { getNegocio, getWaConexao } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function WhatsAppPage() {
  const s = await getSession();
  const neg = activeNegocioId(s);
  if (!neg) redirect("/login");
  const negocio = await getNegocio(neg);
  if (!negocio) redirect("/login");
  const wa = await getWaConexao(neg);

  return (
    <>
      <div className="kpi-label gold">Módulo · diferencial</div>
      <h1 style={{ margin: "4px 0 0" }}>WhatsApp oficial</h1>
      <p className="muted" style={{ maxWidth: 620 }}>
        Atendimento com IA no seu número, pela Cloud API oficial da Meta. Sem QR, sem risco de
        bloqueio.
      </p>

      <div className="card" style={{ marginTop: 16, maxWidth: 620 }}>
        {wa ? (
          <>
            <div className="spread">
              <strong>Conectado</strong>
              <span className="badge ok">ativo</span>
            </div>
            <p className="muted">
              As mensagens que chegam no seu número são respondidas pela IA, com base no cérebro do
              seu negócio.
            </p>
            <div className="muted" style={{ fontSize: 12 }}>
              Número (Phone Number ID)
            </div>
            <div>{wa.phone_number_id}</div>
          </>
        ) : (
          <>
            <div className="spread">
              <strong>Ainda não conectado</strong>
              <span className="badge warn">pendente</span>
            </div>
            <p className="muted" style={{ marginBottom: 0 }}>
              A conexão do seu WhatsApp oficial é feita pela nossa equipe. Assim que ativarmos, a IA
              passa a atender no seu número automaticamente.
            </p>
          </>
        )}
      </div>
    </>
  );
}
