import PageHead from "@/components/page-head";
import { hubOpId } from "@/lib/hub-ctx";
import { listNegocios } from "@/lib/data";
import { listarConexoes, segredoDoNegocio } from "@/lib/wa-conexoes";
import ConectarWhatsApp from "@/components/conectar-whatsapp";

export const dynamic = "force-dynamic";

// Onde os números de WhatsApp dos clientes são conectados.
//
// A conexão nasce AQUI e não no painel de cada cliente porque quem roteia é
// quem precisa saber: a Meta entrega tudo num endereço só (o webhook do hub) e
// ele descobre o dono pelo phone_number_id. Se cada painel cadastrasse sozinho,
// o hub não saberia da existência do número e a mensagem seria descartada.

export default async function WhatsAppPage() {
  const hub = await hubOpId();
  const [negocios, conexoes] = await Promise.all([
    listNegocios(hub ?? undefined),
    listarConexoes(hub),
  ]);
  // Cada cliente com painel próprio tem o SEU segredo de provisionamento —
  // criado sozinho aqui, na primeira vez que a tela é aberta. É o que aparece
  // pra ser colado no painel dele.
  const segredos = new Map<string, string>();
  for (const n of negocios) {
    if ((n.dominio || "").trim()) segredos.set(n.id, await segredoDoNegocio(n.id));
  }
  const porNegocio = new Map(conexoes.filter((c) => c.status === "conectado").map((c) => [c.negocio_id, c]));

  const appId = process.env.META_APP_ID || "";
  const configId = process.env.META_ES_CONFIG_ID || "";
  const configurado = !!appId && !!configId;

  return (
    <>
      <PageHead
        eyebrow="Plataforma"
        titulo="WhatsApp dos clientes"
        sub="Um webhook só na Meta. Cada número conectado aqui passa a ser roteado para o dono automaticamente."
      />

      {!configurado && (
        <div className="err" style={{ borderRadius: 14, padding: 18, lineHeight: 1.7, marginBottom: 18 }}>
          <strong>Faltam as variáveis da Meta no hub.</strong>
          <p style={{ margin: "8px 0 0" }}>
            Para o botão de conectar funcionar, configure no Coolify: <code>META_APP_ID</code>,{" "}
            <code>META_ES_CONFIG_ID</code> (o Configuration ID do Embedded Signup),{" "}
            <code>META_APP_SECRET</code> e <code>PROVISION_SECRET</code> (uma senha inventada, a mesma
            no painel do cliente).
          </p>
        </div>
      )}

      <div className="card" style={{ marginBottom: 18 }}>
        <strong style={{ fontSize: 14.5 }}>Como funciona</strong>
        <p className="muted" style={{ fontSize: 13, margin: "8px 0 0", lineHeight: 1.7 }}>
          Ao conectar, o hub troca o código da Meta por um token do negócio, assina a conta do cliente no
          app (sem esse passo a Meta nunca entrega mensagem, mesmo com o webhook certo) e grava o número
          na tabela de roteamento. Se o cliente tiver painel próprio — o domínio cadastrado nele —, as
          credenciais são repassadas pra lá, porque quem <em>envia</em> é o painel dele; o hub só decide
          para quem vai o que <em>chega</em>.
        </p>
      </div>

      <div className="table-wrap card">
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Número (phone id)</th>
              <th>Destino</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {negocios.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  Nenhum cliente neste hub ainda.
                </td>
              </tr>
            )}
            {negocios.map((n) => {
              const c = porNegocio.get(n.id);
              return (
                <tr key={n.id}>
                  <td style={{ fontWeight: 600 }}>{n.nome_fantasia || n.nome}</td>
                  <td style={{ fontFamily: "ui-monospace, monospace", fontSize: 12.5 }}>
                    {c ? c.phone_number_id : <span className="muted">—</span>}
                  </td>
                  <td className="muted" style={{ fontSize: 12.5 }}>
                    {segredos.has(n.id) ? (
                      <>
                        painel próprio do cliente
                        <div style={{ marginTop: 4 }}>
                          <span style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                            PROVISION_SECRET dele
                          </span>
                          <div
                            style={{
                              fontFamily: "ui-monospace, monospace",
                              fontSize: 11.5,
                              color: "var(--muted-2)",
                              background: "rgba(0,0,0,0.25)",
                              border: "1px solid var(--line)",
                              borderRadius: 8,
                              padding: "4px 8px",
                              marginTop: 3,
                              wordBreak: "break-all",
                              maxWidth: 260,
                            }}
                          >
                            {segredos.get(n.id)}
                          </div>
                        </div>
                      </>
                    ) : (
                      "IA do hub"
                    )}
                  </td>
                  <td>
                    {c ? (
                      <span className="badge ok">conectado</span>
                    ) : (
                      <span className="badge">sem número</span>
                    )}
                  </td>
                  <td>
                    {configurado ? (
                      <ConectarWhatsApp
                        negocioId={n.id}
                        nome={c ? "de novo" : "número"}
                        appId={appId}
                        configId={configId}
                      />
                    ) : (
                      <span className="muted" style={{ fontSize: 12 }}>
                        configure as variáveis
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
