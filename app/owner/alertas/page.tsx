import Link from "@/components/link";
import PageHead from "@/components/page-head";
import { listAlertas } from "@/lib/platform-config";
import { hubOpId } from "@/lib/hub-ctx";
import { IcoAlert, IcoChevronRight } from "@/components/icons";

export const dynamic = "force-dynamic";

const COR: Record<string, string> = { erro: "var(--danger)", aviso: "var(--warn)", info: "var(--gold-l)" };
const BADGE: Record<string, string> = { erro: "", aviso: "warn", info: "gold" };

export default async function AlertasPage() {
  const hub = await hubOpId();
  const alertas = hub ? await listAlertas() : [];

  return (
    <>
      <PageHead eyebrow="Sistema" titulo="Alertas" sub="Avisos operacionais calculados dos dados do hub em tempo real." />

      {!hub ? (
        <div className="err">Entre em um hub para ver os alertas dele.</div>
      ) : alertas.length === 0 ? (
        <div className="card" style={{ display: "grid", placeItems: "center", padding: 48, textAlign: "center" }}>
          <div className="icon-box" style={{ width: 52, height: 52 }}><IcoAlert width={24} height={24} /></div>
          <strong style={{ marginTop: 14 }}>Tudo tranquilo</strong>
          <p className="muted" style={{ margin: "4px 0 0", maxWidth: 460 }}>
            Nenhum alerta no momento. Aparecem aqui: hub sem chave de IA, WhatsApp desconectado, contratos vencendo, tarefas atrasadas e mensagens não lidas.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {alertas.map((a, i) => {
            const linha = (
              <div className="spread" style={{ padding: "15px 20px", borderTop: i ? "1px solid var(--line)" : "none" }}>
                <div className="row" style={{ gap: 12, minWidth: 0 }}>
                  <div className="icon-box sm" style={{ color: COR[a.nivel] }}><IcoAlert width={16} height={16} /></div>
                  <div style={{ minWidth: 0 }}>
                    <div className="row" style={{ gap: 8 }}>
                      <strong>{a.titulo}</strong>
                      <span className={"badge " + (BADGE[a.nivel] || "")} style={{ fontSize: 10 }}>{a.nivel}</span>
                    </div>
                    <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{a.detalhe}</div>
                  </div>
                </div>
                {a.href && <IcoChevronRight width={16} height={16} style={{ color: "var(--muted)", flexShrink: 0 }} />}
              </div>
            );
            return a.href ? (
              <Link key={i} href={a.href} style={{ display: "block", textDecoration: "none", color: "inherit" }}>{linha}</Link>
            ) : (
              <div key={i}>{linha}</div>
            );
          })}
        </div>
      )}
    </>
  );
}
