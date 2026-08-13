import { getSession } from "@/lib/auth";
import { activeNegocioId } from "@/lib/tenant";
import { getNegocio, getHub } from "@/lib/data";
import { modulosEfetivos } from "@/lib/types";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function ModCard({
  titulo,
  desc,
  status,
}: {
  titulo: string;
  desc: string;
  status: string;
}) {
  return (
    <div className="card">
      <div className="spread">
        <strong>{titulo}</strong>
        <span className="badge">{status}</span>
      </div>
      <p className="muted" style={{ marginBottom: 0 }}>
        {desc}
      </p>
    </div>
  );
}

export default async function VisaoGeral() {
  const s = await getSession();
  const negId = activeNegocioId(s);
  if (!negId) redirect("/login");
  const negocio = await getNegocio(negId);
  if (!negocio) redirect("/login");
  const hub = await getHub(negocio.hub_id);
  const mods = hub
    ? modulosEfetivos(negocio, hub)
    : { site: false, instagram: false, financeiro: false, crm: false };

  return (
    <>
      <div className="kpi-label gold">{hub?.nome || "Endereço Digital"}</div>
      <h1 style={{ margin: "4px 0 0" }}>{negocio.nome_fantasia || negocio.nome}</h1>
      <p className="muted">Tudo o que a sua presença digital precisa, num acesso só.</p>

      <div className="grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginTop: 20 }}>
        <ModCard
          titulo="WhatsApp oficial"
          desc="Atendimento com IA no seu número, pela API oficial da Meta. Sem risco de bloqueio."
          status="diferencial"
        />
        {mods.site && (
          <ModCard titulo="Meu site" desc="Seu site e as métricas de visita." status="em breve" />
        )}
        {mods.instagram && (
          <ModCard
            titulo="Instagram"
            desc="Perfil, métricas e gerador de posts e carrosséis."
            status="em breve"
          />
        )}
        {mods.crm && (
          <ModCard titulo="CRM" desc="Funil visual e leads que chegam pelo WhatsApp." status="em breve" />
        )}
        {mods.financeiro && (
          <ModCard titulo="Financeiro" desc="Caixa, contas e metas." status="em breve" />
        )}
        <ModCard
          titulo="Assistente"
          desc="Converse com a IA que conhece o seu negócio."
          status="em breve"
        />
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="kpi-label">Dados da empresa</div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginTop: 10 }}>
          <div>
            <div className="muted" style={{ fontSize: 12 }}>
              Segmento
            </div>
            {negocio.segmento || "—"}
          </div>
          <div>
            <div className="muted" style={{ fontSize: 12 }}>
              Responsável
            </div>
            {negocio.resp_nome || "—"}
          </div>
          <div>
            <div className="muted" style={{ fontSize: 12 }}>
              WhatsApp
            </div>
            {negocio.wpp_comercial || negocio.resp_whatsapp || "—"}
          </div>
        </div>
      </div>
    </>
  );
}
