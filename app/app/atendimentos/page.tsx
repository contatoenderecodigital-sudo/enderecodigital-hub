import Link from "@/components/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { activeNegocioId } from "@/lib/tenant";
import { getNegocio, listConversas, mensagensDoContato } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AtendimentosPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c } = await searchParams;
  const s = await getSession();
  const neg = activeNegocioId(s);
  if (!neg) redirect("/login");
  const negocio = await getNegocio(neg);
  if (!negocio) redirect("/login");

  const conversas = await listConversas(neg);
  const ativo = c || conversas[0]?.contato || null;
  const mensagens = ativo ? await mensagensDoContato(neg, ativo) : [];

  return (
    <>
      <div className="eyebrow">Módulo</div>
      <h1 style={{ margin: "4px 0 0" }}>Atendimentos</h1>
      <p className="muted">As conversas do WhatsApp — humanas e as respondidas pela IA.</p>

      {conversas.length === 0 ? (
        <div className="card" style={{ marginTop: 16 }}>
          <p className="muted" style={{ margin: 0 }}>
            Nenhuma conversa ainda. Quando o WhatsApp estiver conectado, as mensagens aparecem aqui.
          </p>
        </div>
      ) : (
        <div className="cols-inbox" style={{ marginTop: 16 }}>
          {/* Lista de conversas */}
          <div className="card" style={{ padding: 8 }}>
            {conversas.map((cv) => (
              <Link
                key={cv.contato}
                href={`/app/atendimentos?c=${encodeURIComponent(cv.contato)}`}
                style={{ display: "block" }}
              >
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: cv.contato === ativo ? "rgba(201,169,97,0.14)" : "transparent",
                  }}
                >
                  <div className="spread">
                    <strong style={{ fontSize: 14 }}>{cv.contato}</strong>
                    <span className="badge">{cv.qtd}</span>
                  </div>
                  <div className="muted" style={{ fontSize: 12.5, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {cv.ultimo_texto}
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Mensagens */}
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 420 }}>
            <div className="kpi-label">{ativo}</div>
            {mensagens.map((m) => (
              <div
                key={m.id}
                style={{
                  alignSelf: m.direcao === "saida" ? "flex-end" : "flex-start",
                  maxWidth: "78%",
                  background: m.direcao === "saida" ? "var(--cor-destaque)" : "rgba(255,255,255,0.06)",
                  color: m.direcao === "saida" ? "#10204a" : "var(--cor-texto)",
                  border: m.direcao === "saida" ? "none" : "1px solid var(--cor-borda)",
                  padding: "9px 13px",
                  borderRadius: 12,
                  fontSize: 14.5,
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.45,
                }}
              >
                {m.texto}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
