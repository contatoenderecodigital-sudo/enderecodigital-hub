import PageHead from "@/components/page-head";
import NovoHubModal from "@/components/novo-hub-modal";
import ModulosHubModal from "@/components/modulos-hub-modal";
import { listHubs, listNegocios } from "@/lib/data";
import { IcoHub } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function HubsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  const { ok } = await searchParams;
  const [hubs, clientes] = await Promise.all([listHubs(), listNegocios()]);
  const contaPorHub = new Map<string, number>();
  clientes.forEach((c) => contaPorHub.set(c.hub_id, (contaPorHub.get(c.hub_id) || 0) + 1));
  const hubsMin = hubs.map((h) => ({
    id: h.id,
    nome: h.nome,
    cor_destaque: h.cor_destaque,
    cor_apoio: h.cor_apoio,
    cor_fundo: h.cor_fundo,
    cor_texto: h.cor_texto,
    tema_modo: h.tema_modo,
    tipografia: h.tipografia,
  }));

  return (
    <>
      <PageHead
        eyebrow="Plataforma"
        titulo="Hubs"
        sub="Cada hub é uma marca white-label completa. Crie um por nicho ou empresa."
        acao={<NovoHubModal hubs={hubsMin} />}
      />

      {ok && (
        <div className="owner-banner" style={{ borderRadius: 12, marginBottom: 16 }}>
          Hub criado com sucesso.
        </div>
      )}

      <div className="cols-3">
        {hubs.map((h) => {
          const mods = [
            h.mod_site && "Site",
            h.mod_instagram && "Instagram",
            h.mod_crm && "CRM",
            h.mod_financeiro && "Financeiro",
          ].filter(Boolean);
          return (
            <div key={h.id} className="card">
              {/* faixa de cores da marca */}
              <div className="row" style={{ gap: 8, marginBottom: 14 }}>
                <span style={{ width: 26, height: 26, borderRadius: 8, background: h.cor_destaque || "#C9A961", border: "1px solid var(--line)" }} />
                <span style={{ width: 26, height: 26, borderRadius: 8, background: h.cor_fundo || "#0B1838", border: "1px solid var(--line)" }} />
                {h.slug === "endereco-digital" && (
                  <span className="badge gold" style={{ fontSize: 10, padding: "2px 8px" }}>NATIVO</span>
                )}
                <span className="badge" style={{ marginLeft: "auto" }}>{h.tema_modo}</span>
              </div>
              <div className="row" style={{ gap: 10 }}>
                <div className="icon-box"><IcoHub width={18} height={18} /></div>
                <div style={{ minWidth: 0 }}>
                  <strong>{h.nome}</strong>
                  <div className="muted" style={{ fontSize: 12 }}>/{h.slug}</div>
                </div>
              </div>
              {h.descricao && <p className="muted" style={{ fontSize: 13, margin: "12px 0 0" }}>{h.descricao}</p>}
              <div className="row" style={{ gap: 6, marginTop: 14, flexWrap: "wrap" }}>
                {mods.length ? mods.map((m) => <span key={String(m)} className="badge">{m}</span>) : <span className="muted" style={{ fontSize: 13 }}>Sem módulos opcionais</span>}
              </div>
              <div className="spread" style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
                <span className="muted" style={{ fontSize: 12.5 }}>{contaPorHub.get(h.id) || 0} cliente(s)</span>
                {h.dominio && <span className="muted" style={{ fontSize: 12.5 }}>{h.dominio}</span>}
              </div>
              <div className="row" style={{ gap: 8, marginTop: 12 }}>
                <ModulosHubModal hub={h} />
                <NovoHubModal hubs={hubsMin} base={h} label="Usar como base" variant="ghost" />
              </div>
            </div>
          );
        })}
        {hubs.length === 0 && (
          <div className="card"><p className="muted" style={{ margin: 0 }}>Nenhum hub ainda. Clique em Novo hub.</p></div>
        )}
      </div>
    </>
  );
}
