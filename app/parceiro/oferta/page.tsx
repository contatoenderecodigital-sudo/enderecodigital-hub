import { redirect } from "next/navigation";
import PageHeader from "@/components/groow/admin/ed2/PageHeader";
import Card, { CardHead } from "@/components/groow/admin/ed2/Card";
import ChecagemPerfil from "@/components/groow/parceiro/ChecagemPerfil";
import CopiarLink from "@/components/groow/parceiro/CopiarLink";
import { parceiroDaSessao } from "@/lib/groow/parceiro-sessao";
import {
  A_LINHA_QUE_AMARRA,
  FRASE_DE_UMA_LINHA,
  IMPLANTACAO,
  MENSAIS,
  NOTA_PRECO,
  NUNCA_PROMETER,
  QUANTO_CUSTA,
  RESPOSTA_PADRAO,
  SEQUENCIA,
} from "@/lib/groow/oferta-local";

export const dynamic = "force-dynamic";

export default async function OfertaDoParceiro() {
  const parceiro = await parceiroDaSessao();
  if (!parceiro) redirect("/login");

  const primeiroNome = parceiro.nome.trim().split(/\s+/)[0] || parceiro.nome;
  // O parceiro não precisa traduzir o placeholder na hora da ligação.
  const comNome = (s: string) => s.replaceAll("{seu nome}", primeiroNome);

  // Link do Cal.com. O codigo do parceiro viaja na URL para a atribuicao nao se
  // perder entre a ligacao e o agendamento. Sem a env, a tela avisa em vez de
  // mostrar um botao quebrado.
  const baseCal = (process.env.CAL_URL || "").trim().replace(/\/+$/, "");
  const linkCal = baseCal
    ? `${baseCal}?codigo=${encodeURIComponent(parceiro.codigo)}`
    : null;

  return (
    <>
      <PageHeader
        title="O que você está vendendo"
        sub="A oferta, a sequência da ligação e o que responder quando ele perguntar o preço."
      />

      <Card style={{ marginBottom: 22 }}>
        <div
          style={{
            fontSize: 27,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            color: "var(--ed2-ink)",
            marginBottom: 12,
            lineHeight: 1.2,
          }}
        >
          {A_LINHA_QUE_AMARRA}
        </div>
        <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.65, color: "var(--ed2-ink-2)", maxWidth: 720 }}>
          {FRASE_DE_UMA_LINHA}
        </p>
      </Card>

      <Card style={{ marginBottom: 22 }}>
        <CardHead
          title="Antes de discar: olhe o perfil dele no Google"
          sub="Quarenta segundos aqui valem mais que o roteiro inteiro. É o que faz a ligação ser sobre ele e não sobre você."
        />
        <ChecagemPerfil />
      </Card>

      <Card style={{ marginBottom: 22 }}>
        <CardHead
          title="A sequência da ligação"
          sub="Sete passos. Preço não aparece em nenhum deles, só entra se ele perguntar."
        />
        <div style={{ display: "grid", gap: 22 }}>
          {SEQUENCIA.map((p) => (
            <div
              key={p.n}
              style={{
                display: "flex",
                gap: 16,
                paddingTop: p.n === 1 ? 0 : 20,
                borderTop: p.n === 1 ? "none" : "1px solid var(--ed2-hair)",
              }}
            >
              <div
                style={{
                  flexShrink: 0,
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  background: "rgba(201,169,97,0.16)",
                  color: "#8a712d",
                  fontWeight: 700,
                  fontSize: 14.5,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {p.n}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 600, color: "var(--ed2-ink)", marginBottom: 4 }}>
                  {p.titulo}
                </div>
                <div
                  style={{
                    fontSize: 13.5,
                    color: "var(--ed2-ink-2)",
                    lineHeight: 1.55,
                    marginBottom: 12,
                  }}
                >
                  {p.objetivo}
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {p.falas.map((f) => (
                    <div
                      key={f}
                      style={{
                        padding: "11px 15px",
                        borderRadius: 13,
                        background: "var(--ed2-surface)",
                        borderLeft: "3px solid rgba(201,169,97,0.55)",
                        fontSize: 14.5,
                        lineHeight: 1.55,
                        color: "var(--ed2-ink)",
                      }}
                    >
                      {comNome(f)}
                    </div>
                  ))}
                </div>
                {p.dica ? (
                  <div style={{ marginTop: 11, fontSize: 13, color: "var(--ed2-ink-2)", lineHeight: 1.55 }}>
                    <strong style={{ color: "var(--ed2-ink)" }}>Dica.</strong> {p.dica}
                  </div>
                ) : null}
                {p.n === 7 ? (
                  <div style={{ marginTop: 14 }}>
                    {linkCal ? (
                      <CopiarLink link={linkCal} />
                    ) : (
                      <div style={{ fontSize: 13.5, color: "#b45309", lineHeight: 1.6 }}>
                        O link de agendamento ainda não está ligado. Avise o time para
                        configurar.
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ marginBottom: 22 }}>
        <CardHead title="A tabela" sub={NOTA_PRECO} />

        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          <BlocoPreco linha={IMPLANTACAO} rotulo="Implantação" />
          {MENSAIS.map((m) => (
            <BlocoPreco key={m.nome} linha={m} rotulo="Por mês" />
          ))}
        </div>

      </Card>

      <Card style={{ marginBottom: 22 }}>
        <CardHead
          title="Quando ele perguntar quanto custa"
          sub="Responda limpo e volte pro próximo passo. Fugir da pergunta num produto de tabela soa a enrolação."
        />
        <div style={{ display: "grid", gap: 16 }}>
          {QUANTO_CUSTA.map((q) => (
            <div key={q.quando}>
              <div
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--ed2-ink-2)",
                  marginBottom: 6,
                }}
              >
                {q.quando}
              </div>
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: 13,
                  background: "var(--ed2-surface)",
                  fontSize: 14.5,
                  lineHeight: 1.6,
                  color: "var(--ed2-ink)",
                }}
              >
                {q.fala}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHead
          title="O que você nunca promete"
          sub="Promessa sua vira dívida do time. Se insistirem, devolve com a frase padrão."
        />
        <div style={{ display: "grid", gap: 9, marginBottom: 18 }}>
          {NUNCA_PROMETER.map((n) => (
            <div key={n} style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
              <div
                style={{
                  flexShrink: 0,
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: "#c8261c",
                  marginTop: 8,
                }}
              />
              <span style={{ fontSize: 14.5, color: "var(--ed2-ink)", lineHeight: 1.55 }}>{n}</span>
            </div>
          ))}
        </div>
        <div
          style={{
            padding: "13px 17px",
            borderRadius: 13,
            background: "rgba(201,169,97,0.10)",
            border: "1px solid rgba(201,169,97,0.28)",
            fontSize: 14.5,
            lineHeight: 1.6,
            color: "var(--ed2-ink)",
          }}
        >
          {RESPOSTA_PADRAO}
        </div>
      </Card>
    </>
  );
}

function BlocoPreco({
  linha,
  rotulo,
}: {
  linha: (typeof MENSAIS)[number];
  rotulo: string;
}) {
  return (
    <div
      style={{
        padding: "20px 20px 22px",
        borderRadius: 20,
        background: linha.destaque ? "rgba(201,169,97,0.10)" : "var(--ed2-surface)",
        border: linha.destaque ? "1px solid rgba(201,169,97,0.38)" : "1px solid var(--ed2-hair)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          color: "var(--ed2-ink-2)",
          marginBottom: 8,
        }}
      >
        {rotulo}
        {linha.destaque ? " · ofereça este" : ""}
      </div>
      <div style={{ fontSize: 16.5, fontWeight: 600, color: "var(--ed2-ink)" }}>{linha.nome}</div>
      <div
        style={{
          fontSize: 30,
          fontWeight: 700,
          letterSpacing: "-0.03em",
          color: "var(--ed2-ink)",
          margin: "6px 0 2px",
        }}
      >
        {linha.valor}
      </div>
      <div style={{ fontSize: 13, color: "var(--ed2-ink-2)", marginBottom: 14 }}>{linha.quando}</div>
      <div style={{ display: "grid", gap: 7 }}>
        {linha.entrega.map((e) => (
          <div key={e} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
            <div
              style={{
                flexShrink: 0,
                width: 5,
                height: 5,
                borderRadius: 999,
                background: "#C9A961",
                marginTop: 8,
              }}
            />
            <span style={{ fontSize: 13.5, color: "var(--ed2-ink-2)", lineHeight: 1.5 }}>{e}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
