import { redirect } from "next/navigation";
import PageHeader from "@/components/groow/admin/ed2/PageHeader";
import Card, { CardHead } from "@/components/groow/admin/ed2/Card";
import StatCard from "@/components/groow/admin/ed2/StatCard";
import CopiarLink from "@/components/groow/parceiro/CopiarLink";
import { parceiroDaSessao } from "@/lib/groow/parceiro-sessao";
import { painelDoParceiro } from "@/lib/groow/parceiros";
import { linkDeIndicacao, linkWhatsApp } from "@/lib/groow/indicacao";

export const dynamic = "force-dynamic";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function PainelParceiro() {
  const parceiro = await parceiroDaSessao();
  if (!parceiro) redirect("/login");

  const p = await painelDoParceiro(parceiro.id);
  const link = linkDeIndicacao(parceiro.codigo);
  const whats = linkWhatsApp(parceiro.codigo, parceiro.nome);

  return (
    <>
      <PageHeader
        title={`Olá, ${parceiro.nome.split(" ")[0]}`}
        sub="Seu link, suas ligações e quanto você já tem a receber."
      />

      <Card style={{ marginBottom: 26 }}>
        <CardHead
          title="Seu link de indicação"
          sub="Quem entrar por aqui e preencher já entra na sua conta, sem você precisar avisar ninguém."
        />
        <CopiarLink link={link} />
        {whats ? (
          <p style={{ margin: "16px 0 0", fontSize: 13.5, color: "var(--ed2-ink-2)", lineHeight: 1.6 }}>
            A página abre com o seu nome no topo e tem um botão que já leva a pessoa
            para o nosso WhatsApp com o seu código na mensagem. Você não precisa
            explicar nada, é só mandar o link depois da ligação.
          </p>
        ) : (
          <p style={{ margin: "16px 0 0", fontSize: 13.5, color: "var(--ed2-ink-2)", lineHeight: 1.6 }}>
            Mande esse link pelo seu WhatsApp logo depois da ligação, com a pessoa
            ainda na linha. A página abre com o seu nome no topo, ela preenche em um
            minuto e escolhe o horário ali mesmo.
          </p>
        )}
      </Card>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: 16,
          marginBottom: 26,
        }}
      >
        <StatCard label="Cliques no link" value={String(p.cliques)} />
        <StatCard
          label="Pessoas anotadas"
          value={String(p.leads)}
          desc={`${p.autorizados} deixaram a gente chamar`}
        />
        <StatCard
          label="Com a nossa equipe"
          value={String(p.promovidos)}
          desc="a gente assumiu daqui"
        />
        <StatCard
          label="Fecharam com a gente"
          value={String(p.clientes)}
          pill={p.clientes > 0 ? { text: "comissão ativa", tone: "gold" } : null}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
        <StatCard
          label="A receber (previsto)"
          value={brl(p.comissao.previsto)}
          currency="R$"
          desc="apurado, ainda não aprovado"
        />
        <StatCard
          label="Aprovado"
          value={brl(p.comissao.aprovado)}
          currency="R$"
          desc="liberado para pagamento"
          pill={p.comissao.aprovado > 0 ? { text: "a pagar", tone: "up" } : null}
        />
        <StatCard
          label="Já pago"
          value={brl(p.comissao.pago)}
          currency="R$"
          desc="histórico total"
        />
      </div>

      <Card style={{ marginTop: 26 }}>
        <CardHead title="Como você ganha" />
        <div style={{ display: "grid", gap: 12, fontSize: 14.5, color: "var(--ed2-ink-2)", lineHeight: 1.65 }}>
          {parceiro.comissao_fixa > 0 ? (
            <div>
              <strong style={{ color: "var(--ed2-ink)" }}>
                R$ {brl(parceiro.comissao_fixa)} por cliente que fechar
              </strong>{" "}
              com a gente, lançado no mês em que o contrato começa.
            </div>
          ) : (
            <>
              <div>
                <strong style={{ color: "var(--ed2-ink)" }}>
                  {parceiro.comissao_setup_pct}% da implantação
                </strong>{" "}
                no mês em que o contrato começa.
              </div>
              <div>
                <strong style={{ color: "var(--ed2-ink)" }}>
                  {parceiro.comissao_mensal_pct}% da mensalidade
                </strong>{" "}
                todo mês, durante {parceiro.comissao_meses} meses, enquanto o cliente
                estiver ativo.
              </div>
            </>
          )}
          <div style={{ fontSize: 13.5, opacity: 0.85 }}>
            A comissão nasce quando o contrato é fechado, não quando a pessoa entra.
            O valor de cada linha é congelado no dia da apuração.
          </div>
        </div>
      </Card>
    </>
  );
}
