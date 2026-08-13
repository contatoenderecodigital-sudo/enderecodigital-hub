import Link from "@/components/link";
import PageHead from "@/components/page-head";
import { listOpsConversas, mensagensDaConversa, conversasResumo } from "@/lib/ops";
import { IcoWhatsapp, IcoSparkles } from "@/components/icons";

export const dynamic = "force-dynamic";

function hora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default async function ConversasPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const sp = await searchParams;
  const [convs, r] = await Promise.all([listOpsConversas(), conversasResumo()]);
  const sel = sp.c ? Number(sp.c) : convs[0]?.id;
  const msgs = sel ? await mensagensDaConversa(sel) : [];
  const atual = convs.find((c) => c.id === sel);

  return (
    <>
      <PageHead eyebrow="Agência · GROOW OS" titulo="Conversas" sub="O inbox do WhatsApp da agência — histórico, quem a IA atende e quem foi pra humano." />

      <div className="cols-3" style={{ marginBottom: 18 }}>
        <div className="card"><div className="kpi">{r.total}</div><div className="kpi-label">Conversas</div></div>
        <div className="card"><div className="kpi">{r.naoLidas}</div><div className="kpi-label">Não lidas</div></div>
        <div className="card"><div className="kpi">{r.ia}</div><div className="kpi-label">Atendidas pela IA</div></div>
      </div>

      {convs.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 44 }}><p className="muted" style={{ margin: 0 }}>Sem conversas ainda. Chegam aqui quando o webhook do WhatsApp apontar pro hub.</p></div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(240px, 320px) 1fr", gap: 16, alignItems: "start" }}>
          {/* lista */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {convs.map((c) => (
              <Link key={c.id} href={`/owner/ops/conversas?c=${c.id}`} style={{ display: "block", textDecoration: "none" }}>
                <div className="spread" style={{ padding: "12px 14px", borderTop: "1px solid var(--line)", background: c.id === sel ? "rgba(201,169,97,0.10)" : "transparent" }}>
                  <div className="row" style={{ gap: 10, minWidth: 0 }}>
                    <div className="avatar" style={{ width: 34, height: 34, fontSize: 12 }}>{(c.nome || c.whatsapp).slice(0, 2).toUpperCase()}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>{c.nome || c.whatsapp}</div>
                      <div className="muted" style={{ fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>{c.ultima_mensagem || "—"}</div>
                    </div>
                  </div>
                  {c.nao_lidas > 0 && <span className="badge gold" style={{ fontSize: 10 }}>{c.nao_lidas}</span>}
                </div>
              </Link>
            ))}
          </div>

          {/* thread */}
          <div className="card" style={{ minHeight: 420, display: "flex", flexDirection: "column" }}>
            {atual && (
              <div className="spread" style={{ borderBottom: "1px solid var(--line)", paddingBottom: 12, marginBottom: 12 }}>
                <div className="row" style={{ gap: 10 }}>
                  <div className="icon-box sm"><IcoWhatsapp width={15} height={15} /></div>
                  <div>
                    <strong>{atual.nome || atual.whatsapp}</strong>
                    <div className="muted" style={{ fontSize: 12 }}>{atual.whatsapp}</div>
                  </div>
                </div>
                <span className={"badge " + (atual.status === "ai_active" ? "gold" : atual.status === "handed_off" ? "warn" : "")}>
                  {atual.status === "ai_active" ? "IA ativa" : atual.status === "handed_off" ? "com humano" : "encerrada"}
                </span>
              </div>
            )}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
              {msgs.length === 0 && <p className="muted">Sem mensagens.</p>}
              {msgs.map((m, i) => {
                const meu = m.origem === "ai" || m.origem === "humano";
                return (
                  <div key={i} style={{ alignSelf: meu ? "flex-end" : "flex-start", maxWidth: "78%" }}>
                    <div style={{
                      background: meu ? "linear-gradient(135deg, rgba(201,169,97,0.22), rgba(201,169,97,0.12))" : "rgba(255,255,255,0.06)",
                      border: "1px solid var(--line)", borderRadius: 13, padding: "8px 12px", fontSize: 13.5, lineHeight: 1.45,
                    }}>
                      {m.origem === "ai" && <span className="row muted" style={{ gap: 4, fontSize: 10.5, marginBottom: 2 }}><IcoSparkles width={10} height={10} /> IA</span>}
                      {m.texto || <span className="muted">[{m.tipo}]</span>}
                    </div>
                    <div className="muted" style={{ fontSize: 10, marginTop: 2, textAlign: meu ? "right" : "left" }}>{hora(m.created_at)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
