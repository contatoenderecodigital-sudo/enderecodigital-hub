import Link from "@/components/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { activeNegocioId } from "@/lib/tenant";
import { getNegocio, getHub, leadsResumo, usoResumo, listLeads } from "@/lib/data";
import { modulosEfetivos } from "@/lib/types";
import {
  IcoSparkles,
  IcoWhatsapp,
  IcoFunnel,
  IcoGlobe,
  IcoInstagram,
  IcoActivity,
} from "@/components/icons";

export const dynamic = "force-dynamic";

function Kpi({ n, label }: { n: number | string; label: string }) {
  return (
    <div className="card">
      <div className="kpi">{n}</div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}

function ModCard({
  href,
  Icon,
  label,
  titulo,
  desc,
  status,
  destaque,
}: {
  href: string;
  Icon: typeof IcoWhatsapp;
  label: string;
  titulo: string;
  desc: string;
  status: string;
  destaque?: boolean;
}) {
  return (
    <Link href={href} className="mod-card" style={destaque ? { borderColor: "var(--gold-tint-2)" } : undefined}>
      <div className="spread">
        <div className="icon-box">
          <Icon width={20} height={20} />
        </div>
        <span className={"badge " + (destaque ? "gold" : "")}>{status}</span>
      </div>
      <div className="m-label">{label}</div>
      <div className="m-title">{titulo}</div>
      <div className="m-desc">{desc}</div>
    </Link>
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
  const [leads, uso, recentes] = await Promise.all([
    leadsResumo(negId),
    usoResumo(negId),
    listLeads(negId),
  ]);

  return (
    <>
      <div className="eyebrow">
        <IcoSparkles width={14} height={14} /> {hub?.nome || "Endereço Digital"}
      </div>
      <h1 style={{ marginTop: 8 }}>{negocio.nome_fantasia || negocio.nome}</h1>
      <p className="muted" style={{ marginTop: 4 }}>
        Tudo da sua presença digital, num acesso só.
      </p>

      <div className="cols-4" style={{ marginTop: 20 }}>
        <Kpi n={leads.total} label="Leads" />
        <Kpi n={leads.ganhos} label="Ganhos" />
        <Kpi n={uso.interacoes} label="Conversas IA" />
        <Kpi n={`${negocio.health_score}%`} label="Saúde" />
      </div>

      <div className="cols-3" style={{ marginTop: 18 }}>
        <ModCard
          href="/app/whatsapp"
          Icon={IcoWhatsapp}
          label="Diferencial"
          titulo="WhatsApp oficial"
          desc="Atendimento com IA no seu número, pela API oficial da Meta."
          status="oficial"
          destaque
        />
        <ModCard
          href="/app/assistente"
          Icon={IcoSparkles}
          label="Inteligência"
          titulo="Assistente"
          desc="Converse com a IA que conhece o seu negócio."
          status="pronto"
        />
        {mods.crm && (
          <ModCard
            href="/app/crm"
            Icon={IcoFunnel}
            label="Vendas"
            titulo="CRM · Funil"
            desc="Leads do WhatsApp e do site, num funil visual."
            status="pronto"
          />
        )}
        {mods.site && (
          <ModCard href="/app/site" Icon={IcoGlobe} label="Presença" titulo="Meu site" desc="Seu site e as visitas." status="pronto" />
        )}
        {mods.instagram && (
          <ModCard href="/app/instagram" Icon={IcoInstagram} label="Social" titulo="Instagram" desc="Perfil, métricas e gerador de posts." status="em breve" />
        )}
        {mods.financeiro && (
          <ModCard href="/app/financeiro" Icon={IcoActivity} label="Gestão" titulo="Financeiro" desc="Caixa, contas e metas." status="em breve" />
        )}
      </div>

      {mods.crm && recentes.length > 0 && (
        <div className="card" style={{ marginTop: 18 }}>
          <div className="spread">
            <h2 style={{ margin: 0, fontSize: 17 }}>Últimos leads</h2>
            <Link className="btn btn-ghost btn-sm" href="/app/crm">
              Ver funil
            </Link>
          </div>
          <div className="table-wrap" style={{ marginTop: 8 }}>
            <table>
              <tbody>
                {recentes.slice(0, 5).map((l) => (
                  <tr key={l.id}>
                    <td>
                      <strong>{l.nome}</strong>
                    </td>
                    <td className="muted">{l.telefone || l.email || "—"}</td>
                    <td style={{ textAlign: "right" }}>
                      {l.origem && <span className="badge">{l.origem}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
