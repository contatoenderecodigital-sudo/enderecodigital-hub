import Link from "@/components/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { activeNegocioId } from "@/lib/tenant";
import { getNegocio, getHub, leadsResumo, usoResumo, listLeads } from "@/lib/data";
import { modulosEfetivos } from "@/lib/types";

export const dynamic = "force-dynamic";

function Kpi({ n, label }: { n: number | string; label: string }) {
  return (
    <div className="card">
      <div className="kpi">{n}</div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}

function ModCard({ titulo, desc, status, href }: { titulo: string; desc: string; status: string; href?: string }) {
  const inner = (
    <div className="card" style={{ height: "100%" }}>
      <div className="spread">
        <strong>{titulo}</strong>
        <span className="badge">{status}</span>
      </div>
      <p className="muted" style={{ marginBottom: 0 }}>{desc}</p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
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
      <div className="kpi-label gold">{hub?.nome || "Endereço Digital"}</div>
      <h1 style={{ margin: "4px 0 0" }}>{negocio.nome_fantasia || negocio.nome}</h1>
      <p className="muted">Tudo o que a sua presença digital precisa, num acesso só.</p>

      <div className="grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginTop: 18 }}>
        <Kpi n={leads.total} label="Leads" />
        <Kpi n={leads.ganhos} label="Ganhos" />
        <Kpi n={uso.interacoes} label="Conversas IA" />
        <Kpi n={`${negocio.health_score}%`} label="Saúde" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginTop: 18 }}>
        <ModCard
          titulo="WhatsApp oficial"
          desc="Atendimento com IA no seu número, pela API oficial da Meta."
          status="diferencial"
          href="/app/whatsapp"
        />
        <ModCard titulo="Assistente" desc="Converse com a IA que conhece o seu negócio." status="pronto" href="/app/assistente" />
        {mods.crm && <ModCard titulo="CRM" desc="Funil visual e leads que chegam pelo WhatsApp e pelo site." status="pronto" href="/app/crm" />}
        {mods.site && <ModCard titulo="Meu site" desc="Seu site e as métricas de visita." status="pronto" href="/app/site" />}
        {mods.instagram && <ModCard titulo="Instagram" desc="Perfil, métricas e gerador de posts." status="em breve" href="/app/instagram" />}
        {mods.financeiro && <ModCard titulo="Financeiro" desc="Caixa, contas e metas." status="em breve" href="/app/financeiro" />}
      </div>

      {mods.crm && recentes.length > 0 && (
        <div className="card" style={{ marginTop: 18 }}>
          <div className="spread">
            <h2 style={{ margin: 0, fontSize: 17 }}>Últimos leads</h2>
            <Link className="btn btn-ghost btn-sm" href="/app/crm">Ver funil</Link>
          </div>
          <table style={{ marginTop: 10 }}>
            <tbody>
              {recentes.slice(0, 5).map((l) => (
                <tr key={l.id}>
                  <td><strong>{l.nome}</strong></td>
                  <td className="muted">{l.telefone || l.email || "—"}</td>
                  <td>{l.origem && <span className="badge">{l.origem}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
