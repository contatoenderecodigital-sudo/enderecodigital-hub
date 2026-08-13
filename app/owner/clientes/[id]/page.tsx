import Link from "@/components/link";
import { notFound } from "next/navigation";
import {
  getNegocio,
  getHub,
  leadsResumo,
  usoResumo,
  listUsuariosDoNegocio,
} from "@/lib/data";
import { modulosEfetivos } from "@/lib/types";

export const dynamic = "force-dynamic";

function Item({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <div className="muted" style={{ fontSize: 12 }}>
        {label}
      </div>
      <div>{valor || "—"}</div>
    </div>
  );
}

export default async function ClienteDetalhe({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const negocio = await getNegocio(id);
  if (!negocio) notFound();
  const [hub, leads, uso, usuarios] = await Promise.all([
    getHub(negocio.hub_id),
    leadsResumo(id),
    usoResumo(id),
    listUsuariosDoNegocio(id),
  ]);
  const mods = hub
    ? modulosEfetivos(negocio, hub)
    : { site: false, instagram: false, financeiro: false, crm: false };

  return (
    <>
      <div className="spread">
        <div>
          <div className="kpi-label gold">{hub?.nome || "Cliente"}</div>
          <h1 style={{ margin: "4px 0 0" }}>{negocio.nome_fantasia || negocio.nome}</h1>
          <p className="muted" style={{ margin: 0 }}>
            /{negocio.slug} · <span className={"badge " + (negocio.status === "ativo" ? "ok" : "warn")}>{negocio.status}</span>
          </p>
        </div>
        <div className="row">
          <Link className="btn btn-ghost btn-sm" href="/owner/clientes">Voltar</Link>
          <form action="/api/impersonar" method="post">
            <input type="hidden" name="negocio_id" value={negocio.id} />
            <button className="btn btn-sm" type="submit">Abrir workspace</button>
          </form>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(4,1fr)", marginTop: 18 }}>
        <div className="card"><div className="kpi">{leads.total}</div><div className="kpi-label">Leads</div></div>
        <div className="card"><div className="kpi">{leads.ganhos}</div><div className="kpi-label">Ganhos</div></div>
        <div className="card"><div className="kpi">{uso.interacoes}</div><div className="kpi-label">Interações IA</div></div>
        <div className="card"><div className="kpi">{negocio.health_score}%</div><div className="kpi-label">Saúde</div></div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", alignItems: "start", marginTop: 16 }}>
        <div className="card">
          <h2 style={{ margin: "0 0 12px", fontSize: 17 }}>Dados</h2>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Item label="Razão social" valor={negocio.nome} />
            <Item label="Segmento" valor={negocio.segmento || ""} />
            <Item label="Responsável" valor={negocio.resp_nome || ""} />
            <Item label="E-mail" valor={negocio.resp_email || ""} />
            <Item label="WhatsApp" valor={negocio.wpp_comercial || negocio.resp_whatsapp || ""} />
            <Item label="Instagram" valor={negocio.instagram_url || ""} />
            <Item label="Site" valor={negocio.site_url || ""} />
            <Item label="Criado em" valor={new Date(negocio.criado_em).toLocaleDateString("pt-BR")} />
          </div>
        </div>

        <div className="card">
          <h2 style={{ margin: "0 0 12px", fontSize: 17 }}>Módulos & IA</h2>
          <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
            {mods.site && <span className="badge ok">Site</span>}
            {mods.instagram && <span className="badge ok">Instagram</span>}
            {mods.crm && <span className="badge ok">CRM</span>}
            {mods.financeiro && <span className="badge ok">Financeiro</span>}
            <span className="badge ok">WhatsApp</span>
          </div>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
            <Item label="IA" valor={negocio.ia_habilitada ? "habilitada" : "desligada"} />
            <Item label="Modelo do chat" valor={negocio.ia_modelo_chat || "padrão (Haiku)"} />
            <Item label="Tokens (entrada/saída)" valor={`${uso.tokens_in} / ${uso.tokens_out}`} />
            <Item label="Limite de tokens" valor={negocio.ia_limite_tokens ? String(negocio.ia_limite_tokens) : "ilimitado"} />
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ margin: "0 0 12px", fontSize: 17 }}>Acessos</h2>
        <table>
          <thead>
            <tr><th>E-mail</th><th>Papel</th><th>Status</th></tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td className="muted">{u.papel}</td>
                <td><span className={"badge " + (u.ativo ? "ok" : "warn")}>{u.ativo ? "ativo" : "inativo"}</span></td>
              </tr>
            ))}
            {usuarios.length === 0 && (
              <tr><td colSpan={3} className="muted">Sem usuário de login.</td></tr>
            )}
          </tbody>
        </table>
        <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>
          Para redefinir senha, ligar módulos ou editar o cérebro, use <strong>Abrir workspace → Config. do cliente</strong>.
        </p>
      </div>
    </>
  );
}
