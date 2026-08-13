import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { activeNegocioId } from "@/lib/tenant";
import { getNegocio, getHub, ensureFunil, listLeads, ensureCapturaToken } from "@/lib/data";
import { modulosEfetivos } from "@/lib/types";
import { criarLeadAction, moverLeadAction, excluirLeadAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function CrmPage() {
  const s = await getSession();
  const neg = activeNegocioId(s);
  if (!neg) redirect("/login");
  const negocio = await getNegocio(neg);
  if (!negocio) redirect("/login");
  const hub = await getHub(negocio.hub_id);
  const mods = hub ? modulosEfetivos(negocio, hub) : null;
  if (mods && !mods.crm) redirect("/app");

  const [etapas, leads, token] = await Promise.all([
    ensureFunil(neg),
    listLeads(neg),
    ensureCapturaToken(neg),
  ]);

  const host = (await headers()).get("host") || "seu-dominio";
  const captureUrl = `https://${host}/api/lead-capture?token=${token}`;

  const porEtapa = (etapaId: string) => leads.filter((l) => l.etapa_id === etapaId);

  const snippet = `<form onsubmit="return edLead(this)">
  <input name="nome" placeholder="Nome" required>
  <input name="telefone" placeholder="WhatsApp">
  <input name="email" placeholder="E-mail">
  <button>Enviar</button>
</form>
<script>
function edLead(f){
  fetch("${captureUrl}",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({nome:f.nome.value,telefone:f.telefone.value,email:f.email.value})});
  f.reset(); alert("Recebido! Em breve entramos em contato."); return false;
}
</script>`;

  return (
    <>
      <div className="spread">
        <div>
          <div className="eyebrow">Módulo</div>
          <h1 style={{ margin: "4px 0 0" }}>CRM · Funil</h1>
          <p className="muted" style={{ margin: 0 }}>
            {leads.length} lead{leads.length === 1 ? "" : "s"} no funil.
          </p>
        </div>
      </div>

      {/* Novo lead */}
      <div className="card" style={{ marginTop: 16 }}>
        <form action={criarLeadAction} className="row" style={{ flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 160px" }}>
            <label htmlFor="nome" style={{ marginTop: 0 }}>Nome</label>
            <input id="nome" name="nome" required />
          </div>
          <div style={{ flex: "1 1 140px" }}>
            <label htmlFor="telefone" style={{ marginTop: 0 }}>WhatsApp</label>
            <input id="telefone" name="telefone" />
          </div>
          <div style={{ flex: "1 1 140px" }}>
            <label htmlFor="email" style={{ marginTop: 0 }}>E-mail</label>
            <input id="email" name="email" />
          </div>
          <div style={{ flex: "1 1 140px" }}>
            <label htmlFor="etapa_id" style={{ marginTop: 0 }}>Etapa</label>
            <select id="etapa_id" name="etapa_id" defaultValue={etapas[0]?.id || ""}>
              {etapas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>
          <button className="btn" type="submit">Adicionar lead</button>
        </form>
      </div>

      {/* Funil Kanban */}
      <div style={{ overflowX: "auto", marginTop: 16 }}>
        <div style={{ display: "flex", gap: 14, minWidth: "min-content" }}>
          {etapas.map((etapa) => {
            const doColuna = porEtapa(etapa.id);
            return (
              <div key={etapa.id} style={{ width: 250, flex: "0 0 250px" }}>
                <div className="spread" style={{ marginBottom: 10 }}>
                  <strong style={{ fontSize: 14 }}>{etapa.nome}</strong>
                  <span className="badge">{doColuna.length}</span>
                </div>
                <div className="grid" style={{ gap: 10 }}>
                  {doColuna.map((lead) => (
                    <div key={lead.id} className="card" style={{ padding: 13 }}>
                      <strong style={{ fontSize: 14.5 }}>{lead.nome}</strong>
                      {lead.telefone && (
                        <div className="muted" style={{ fontSize: 12.5 }}>{lead.telefone}</div>
                      )}
                      {lead.email && (
                        <div className="muted" style={{ fontSize: 12.5 }}>{lead.email}</div>
                      )}
                      {lead.origem && (
                        <span className="badge" style={{ marginTop: 6, fontSize: 11 }}>{lead.origem}</span>
                      )}
                      <form action={moverLeadAction} className="row" style={{ gap: 6, marginTop: 10 }}>
                        <input type="hidden" name="lead_id" value={lead.id} />
                        <select name="etapa_id" defaultValue={etapa.id} style={{ fontSize: 12, padding: "6px 8px" }}>
                          {etapas.map((e) => (
                            <option key={e.id} value={e.id}>{e.nome}</option>
                          ))}
                        </select>
                        <button className="btn btn-ghost btn-sm" type="submit">Mover</button>
                      </form>
                      <form action={excluirLeadAction} style={{ marginTop: 6 }}>
                        <input type="hidden" name="lead_id" value={lead.id} />
                        <button className="btn btn-ghost btn-sm" type="submit" style={{ width: "100%", opacity: 0.7 }}>
                          Excluir
                        </button>
                      </form>
                    </div>
                  ))}
                  {doColuna.length === 0 && (
                    <div className="muted" style={{ fontSize: 12.5, padding: "8px 2px" }}>Vazio</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Captura no site */}
      <div className="card" style={{ marginTop: 20 }}>
        <h2 style={{ margin: "0 0 6px", fontSize: 17 }}>Captura de leads no site</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Cole este trecho no site do cliente. Quem preencher vira lead na primeira etapa, automaticamente.
        </p>
        <pre
          style={{
            background: "rgba(0,0,0,0.3)",
            border: "1px solid var(--cor-borda)",
            borderRadius: 10,
            padding: 14,
            overflowX: "auto",
            fontSize: 12.5,
            lineHeight: 1.5,
          }}
        >
          {snippet}
        </pre>
      </div>
    </>
  );
}
