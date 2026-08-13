import PageHead from "@/components/page-head";
import { listContasClaude, listNegocios } from "@/lib/data";
import { IcoPlus, IcoSparkles, IcoUsers } from "@/components/icons";

export const dynamic = "force-dynamic";

function Stat({ label, valor, Icon }: { label: string; valor: string; Icon: typeof IcoUsers }) {
  return (
    <div className="glass-soft" style={{ borderRadius: 11, padding: "10px 12px", flex: 1 }}>
      <div className="row muted" style={{ gap: 6, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        <Icon width={13} height={13} /> {label}
      </div>
      <div style={{ fontWeight: 800, fontSize: 18, marginTop: 3 }}>{valor}</div>
    </div>
  );
}

export default async function ContasClaudePage() {
  const [contas, clientes] = await Promise.all([listContasClaude(), listNegocios()]);
  const comIA = clientes.filter((c) => c.ia_habilitada && c.ia_modo === "api_plataforma").length;
  const temChave = !!process.env.ANTHROPIC_API_KEY;

  return (
    <>
      <PageHead
        eyebrow="Plataforma"
        titulo="Contas Claude"
        sub="Contas de IA conectadas — a central da plataforma ou dedicadas a um cliente."
        acao={<button className="btn"><IcoPlus width={15} height={15} /> Conectar conta</button>}
      />

      <div className="card glass-soft" style={{ marginBottom: 18, fontSize: 13, lineHeight: 1.6 }}>
        O caminho oficial do Endereço Digital é a <strong>API Anthropic central</strong> com custo medido por cliente
        (aba Tokens) — sem assento revendido, sem risco de ban. "Claude do cliente" só quando o cliente traz a própria assinatura.
      </div>

      <div className="cols-2">
        {/* Conta central da plataforma */}
        <div className="card">
          <div className="spread">
            <div className="row" style={{ gap: 11 }}>
              <div className="icon-box"><IcoSparkles width={18} height={18} /></div>
              <div>
                <div className="row" style={{ gap: 8 }}>
                  <strong>API da plataforma</strong>
                  <span className="badge gold" style={{ fontSize: 10 }}>CENTRAL</span>
                </div>
                <div className="muted" style={{ fontSize: 12 }}>Anthropic · custo real medido</div>
              </div>
            </div>
            <span className={"badge " + (temChave ? "ok" : "warn")}>{temChave ? "válida" : "sem chave"}</span>
          </div>
          <div className="row" style={{ gap: 10, marginTop: 14 }}>
            <Stat label="Clientes" valor={String(comIA)} Icon={IcoUsers} />
            <Stat label="Modelo" valor="por cliente" Icon={IcoSparkles} />
            <Stat label="Custo" valor="medido" Icon={IcoSparkles} />
          </div>
        </div>

        {contas.map((c) => (
          <div key={c.id} className="card">
            <div className="spread">
              <div className="row" style={{ gap: 11 }}>
                <div className="icon-box"><IcoSparkles width={18} height={18} /></div>
                <div>
                  <div className="row" style={{ gap: 8 }}>
                    <strong>{c.nome}</strong>
                    {c.tipo === "compartilhada" && <span className="badge gold" style={{ fontSize: 10 }}>COMPARTILHADA</span>}
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>{c.plano || "—"}</div>
                </div>
              </div>
              <span className={"badge " + (c.status === "ativa" ? "ok" : "warn")}>{c.status}</span>
            </div>
            <div className="row" style={{ gap: 8, marginTop: 14 }}>
              <button className="btn btn-ghost btn-sm">Gerenciar</button>
              <button className="btn btn-ghost btn-sm">{c.tipo === "compartilhada" ? "Compartilhada" : "Tornar compartilhada"}</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
