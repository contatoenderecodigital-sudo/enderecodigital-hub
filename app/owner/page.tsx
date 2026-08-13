import Link from "@/components/link";
import PageHead from "@/components/page-head";
import NovoHubModal from "@/components/novo-hub-modal";
import ModulosHubModal from "@/components/modulos-hub-modal";
import { platformTotais } from "@/lib/platform";
import { listHubs } from "@/lib/data";
import { IcoHub, IcoUsers, IcoFunnel, IcoActivity, IcoSparkles, IcoChevronRight, IcoGrid, IcoExternal } from "@/components/icons";

export const dynamic = "force-dynamic";

function brl(n: number) { return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }

function Kpi({ n, label, Icon }: { n: number | string; label: string; Icon: typeof IcoUsers }) {
  return (
    <div className="card">
      <div className="spread" style={{ alignItems: "flex-start" }}>
        <div className="kpi">{n}</div>
        <div className="icon-box sm"><Icon width={16} height={16} /></div>
      </div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}

export default async function PlataformaHome() {
  const [t, hubs] = await Promise.all([platformTotais(), listHubs()]);
  const hubsMin = hubs.map((h) => ({
    id: h.id, nome: h.nome, cor_destaque: h.cor_destaque, cor_apoio: h.cor_apoio,
    cor_fundo: h.cor_fundo, cor_texto: h.cor_texto, tema_modo: h.tema_modo, tipografia: h.tipografia,
  }));
  const fullById = new Map(hubs.map((h) => [h.id, h]));

  return (
    <>
      <PageHead
        eyebrow="Plataforma"
        titulo="Todos os hubs"
        sub="A visão de cima — cada hub é uma marca com sua operação isolada. Entre num hub pra operar, ou crie/configure aqui mesmo."
        acao={<NovoHubModal hubs={hubsMin} />}
      />

      <div className="cols-5">
        <Kpi n={t.hubs} label="Hubs" Icon={IcoHub} />
        <Kpi n={t.workspaces} label="Workspaces (clientes)" Icon={IcoUsers} />
        <Kpi n={t.leads} label="Leads (todos)" Icon={IcoFunnel} />
        <Kpi n={brl(t.mrr)} label="MRR somado" Icon={IcoActivity} />
        <Kpi n={"US$ " + t.custo_ia.toFixed(2)} label="IA no mês" Icon={IcoSparkles} />
      </div>

      <h2 style={{ fontSize: 16, margin: "24px 0 12px" }}>Seus hubs</h2>
      <div className="cols-3">
        {t.lista.map((h) => {
          const full = fullById.get(h.id);
          return (
            <div key={h.id} className="card" style={{ display: "flex", flexDirection: "column" }}>
              <div className="spread">
                <div className="row" style={{ gap: 11 }}>
                  <div className="avatar" style={{ width: 40, height: 40, fontSize: 14, background: h.cor || "var(--gold)" }}>{h.nome.slice(0, 2).toUpperCase()}</div>
                  <div>
                    <strong style={{ fontSize: 15 }}>{h.nome}</strong>
                    <div className="muted" style={{ fontSize: 12 }}>/{h.slug}</div>
                  </div>
                </div>
                <span className={"badge " + (h.ativo ? "ok" : "")}>{h.ativo ? "ativo" : "off"}</span>
              </div>

              <div className="row" style={{ gap: 8, marginTop: 16 }}>
                <div className="glass-soft" style={{ borderRadius: 10, padding: "8px 10px", flex: 1, textAlign: "center" }}>
                  <div style={{ fontWeight: 800 }}>{h.workspaces}</div><div className="muted" style={{ fontSize: 10.5 }}>clientes</div>
                </div>
                <div className="glass-soft" style={{ borderRadius: 10, padding: "8px 10px", flex: 1, textAlign: "center" }}>
                  <div style={{ fontWeight: 800 }}>{h.leads}</div><div className="muted" style={{ fontSize: 10.5 }}>leads</div>
                </div>
                <div className="glass-soft" style={{ borderRadius: 10, padding: "8px 10px", flex: 1, textAlign: "center" }}>
                  <div style={{ fontWeight: 800, color: "var(--gold-l)" }}>{brl(h.mrr)}</div><div className="muted" style={{ fontSize: 10.5 }}>MRR</div>
                </div>
              </div>

              <div className="row" style={{ gap: 8, marginTop: 8 }}>
                <span className="badge" style={{ fontSize: 10 }}>{h.tem_ia ? "IA própria" : "IA da plataforma"}</span>
                <span className="muted" style={{ fontSize: 11 }}>US$ {h.custo_ia.toFixed(2)} IA/mês</span>
              </div>

              <a href={`/api/hub/entrar?id=${h.id}`} className="btn" style={{ marginTop: 16, justifyContent: "center" }}>
                Entrar no hub <IcoChevronRight width={15} height={15} />
              </a>
              {full?.dominio && (
                <a href={`https://${full.dominio}`} target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ marginTop: 8, justifyContent: "center" }}>
                  Abrir painel do cliente <IcoExternal width={14} height={14} />
                </a>
              )}
              {full && (
                <div className="row" style={{ gap: 8, marginTop: 8 }}>
                  <ModulosHubModal hub={full} />
                  <NovoHubModal hubs={hubsMin} base={full} label="Usar como base" variant="ghost" />
                </div>
              )}
            </div>
          );
        })}

        {/* criar hub — abre o wizard */}
        <div className="card" style={{ display: "grid", placeItems: "center", textAlign: "center", minHeight: 220, borderStyle: "dashed" }}>
          <div>
            <div className="icon-box" style={{ width: 50, height: 50, margin: "0 auto 12px" }}><IcoHub width={22} height={22} /></div>
            <strong>Criar novo hub</strong>
            <p className="muted" style={{ fontSize: 12.5, margin: "4px 0 12px", maxWidth: 220 }}>Uma marca nova (ex.: VetHub) com clientes e operação próprios.</p>
            <NovoHubModal hubs={hubsMin} label="Criar hub" />
          </div>
        </div>
      </div>

      {/* infra da plataforma */}
      <h2 style={{ fontSize: 16, margin: "26px 0 12px" }}>Plataforma</h2>
      <div className="cols-4">
        <Link href="/owner/clientes" className="card row" style={{ gap: 11 }}><div className="icon-box sm"><IcoUsers width={15} height={15} /></div> <span>Todos os clientes</span></Link>
        <Link href="/owner/workspaces" className="card row" style={{ gap: 11 }}><div className="icon-box sm"><IcoGrid width={15} height={15} /></div> <span>Workspaces</span></Link>
        <Link href="/owner/contas-claude" className="card row" style={{ gap: 11 }}><div className="icon-box sm"><IcoSparkles width={15} height={15} /></div> <span>Contas Claude / IA</span></Link>
        <Link href="/owner/auditoria" className="card row" style={{ gap: 11 }}><div className="icon-box sm"><IcoActivity width={15} height={15} /></div> <span>Auditoria & segurança</span></Link>
      </div>
    </>
  );
}
