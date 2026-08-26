import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import FormIndicacao from "@/components/groow/parceiro/FormIndicacao";
import { getParceiroPorCodigo, registrarClique, CODIGO_RE } from "@/lib/groow/parceiros";
import { linkWhatsApp, hashIp, ehBot } from "@/lib/groow/indicacao";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Diagnóstico da sua operação | Endereço Digital",
  robots: { index: false, follow: false },
};

const ARGUMENTOS = [
  {
    titulo: "A gente olha antes de vender",
    texto:
      "O diagnóstico mapeia onde sua operação perde tempo e dinheiro hoje. Você recebe o mapa mesmo que não feche nada.",
  },
  {
    titulo: "Sem plataforma cobrando por pedido",
    texto:
      "Nada de comissão por venda. O que é seu continua seu, no seu canal, com o seu cliente.",
  },
  {
    titulo: "Atendimento que responde sozinho",
    texto:
      "WhatsApp oficial da Meta atendendo, qualificando e passando pronto para a sua equipe.",
  },
];

export default async function LandingIndicacao({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;
  if (!CODIGO_RE.test(codigo)) notFound();

  const parceiro = await getParceiroPorCodigo(codigo.toLowerCase());
  if (!parceiro) notFound();

  // Clique: descarta bot e prefetch, e grava só o hash do IP.
  const h = await headers();
  const ua = h.get("user-agent");
  const ehPrefetch =
    h.get("next-router-prefetch") === "1" ||
    (h.get("sec-purpose") || "").includes("prefetch") ||
    h.get("purpose") === "prefetch";
  if (!ehBot(ua) && !ehPrefetch) {
    const ip = (h.get("x-forwarded-for") || "").split(",")[0].trim() || h.get("x-real-ip") || "";
    registrarClique(parceiro.id, "landing", {
      ipHash: ip ? hashIp(ip) : null,
      userAgent: ua,
      referer: h.get("referer"),
    }).catch((err) => console.error("[p] clique:", err));
  }

  const whats = linkWhatsApp(parceiro.codigo, parceiro.nome);
  // O embed do Cal quer "usuario/evento", nao a URL inteira.
  const calLink =
    (process.env.CAL_URL || "").trim().replace(/^https?:\/\/(app\.)?cal\.com\//, "").replace(/\/+$/, "") ||
    null;
  const primeiroNome = parceiro.nome.trim().split(/\s+/)[0];

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(160deg, #070F26 0%, #0B1838 55%, #101F44 100%)",
        color: "#F5F2EA",
        padding: "0 20px 80px",
      }}
    >
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <header style={{ padding: "34px 0 0" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <Image
              src="/logo-mark.png"
              alt=""
              width={30}
              height={30}
              unoptimized
              style={{ borderRadius: 8, display: "block" }}
              aria-hidden
            />
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "#C9A961",
              }}
            >
              Endereço Digital
            </span>
          </div>
        </header>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,1.05fr) minmax(0,0.95fr)",
            gap: 56,
            alignItems: "start",
            paddingTop: 56,
          }}
          className="ind-grid"
        >
          <div className="ind-texto">

            <h1
              style={{
                fontSize: 52,
                lineHeight: 1.04,
                fontWeight: 700,
                letterSpacing: "-0.038em",
                margin: "0 0 20px",
              }}
            >
              Descubra o que está travando a sua operação.
            </h1>

            <p
              className="ind-intro"
              style={{
                fontSize: 18.5,
                lineHeight: 1.62,
                color: "rgba(245,242,234,0.72)",
                margin: "0 0 34px",
                maxWidth: 520,
              }}
            >
              O {primeiroNome} te indicou porque a gente faz uma coisa só: destravar a
              operação de quem já vende e está perdendo pedido, tempo e margem no
              caminho. Comece pelo diagnóstico, é de graça.
            </p>

            <div className="ind-args" style={{ display: "grid", gap: 22, maxWidth: 520 }}>
              {ARGUMENTOS.map((a) => (
                <div key={a.titulo} style={{ display: "flex", gap: 15 }}>
                  <div
                    style={{
                      flexShrink: 0,
                      width: 7,
                      height: 7,
                      borderRadius: 999,
                      background: "#C9A961",
                      marginTop: 9,
                    }}
                  />
                  <div>
                    <div style={{ fontSize: 16.5, fontWeight: 600, marginBottom: 4 }}>
                      {a.titulo}
                    </div>
                    <div
                      style={{
                        fontSize: 15,
                        lineHeight: 1.6,
                        color: "rgba(245,242,234,0.62)",
                      }}
                    >
                      {a.texto}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            className="ind-form"
            style={{
              background: "rgba(255,255,255,0.035)",
              border: "1px solid rgba(245,242,234,0.10)",
              borderRadius: 28,
              padding: "34px 32px",
              backdropFilter: "blur(8px)",
            }}
          >
            <h2
              style={{
                margin: "0 0 6px",
                fontSize: 24,
                fontWeight: 600,
                letterSpacing: "-0.025em",
              }}
            >
              Peça seu diagnóstico
            </h2>
            <p
              style={{
                margin: "0 0 26px",
                fontSize: 14.5,
                color: "rgba(245,242,234,0.58)",
                lineHeight: 1.6,
              }}
            >
              {calLink
                ? "Leva menos de um minuto. Depois você escolhe o horário da conversa."
                : "Leva menos de um minuto. A gente chama no WhatsApp e conduz a partir daí."}
            </p>

            <FormIndicacao codigo={parceiro.codigo} linkWhats={whats} calLink={calLink} />

            {whats ? (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    margin: "26px 0 20px",
                    color: "rgba(245,242,234,0.32)",
                    fontSize: 12.5,
                  }}
                >
                  <span style={{ flex: 1, height: 1, background: "rgba(245,242,234,0.12)" }} />
                  ou
                  <span style={{ flex: 1, height: 1, background: "rgba(245,242,234,0.12)" }} />
                </div>
                <a
                  href={whats}
                  style={{
                    display: "block",
                    textAlign: "center",
                    padding: "14px 24px",
                    borderRadius: 999,
                    border: "1px solid rgba(201,169,97,0.42)",
                    color: "#D9BE7E",
                    fontWeight: 600,
                    fontSize: 15,
                    textDecoration: "none",
                  }}
                >
                  Chamar no WhatsApp agora
                </a>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media (max-width: 880px) {
              .ind-grid { grid-template-columns: 1fr !important; gap: 26px !important; padding-top: 26px !important; }
              .ind-grid h1 { font-size: 31px !important; margin-bottom: 14px !important; }
              .ind-grid p { font-size: 16px !important; }
              /* No celular o formulario tem que vir ANTES dos argumentos. Medido:
                 sem isto ele so comeca a 940px de altura, uma tela inteira de
                 rolagem antes de a pessoa achar onde preencher. */
              .ind-texto { display: contents; }
              .ind-form { order: 2; padding: 24px 20px !important; }
              .ind-args { order: 3; gap: 16px !important; }
              /* O card de "Recebido" empurrava o botao de escolher horario
                 para fora da tela no celular. */
              .ind-recebido { padding: 15px 17px !important; margin-bottom: 14px !important; }
              .ind-recebido h3 { font-size: 18px !important; margin-bottom: 5px !important; }
              .ind-recebido p { font-size: 14px !important; line-height: 1.5 !important; }
              /* No celular a pagina e o formulario. Titulo e texto de abertura
                 saem: eles empurravam o campo pra baixo e quem chega aqui ja
                 veio de uma ligacao, nao precisa ser convencido de novo. */
              .ind-grid h1, .ind-intro { display: none !important; }
              .ind-form { padding-top: 22px !important; }
            }
            input::placeholder { color: rgba(245,242,234,0.3); }
          `,
        }}
      />
    </main>
  );
}
