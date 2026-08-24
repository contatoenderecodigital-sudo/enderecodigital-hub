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
        sub="Seu link de indicação, seus leads e quanto você já tem a receber."
      />

      <Card style={{ marginBottom: 26 }}>
        <CardHead
          title="Seu link de indicação"
          sub="Quem entrar por aqui e pedir o diagnóstico entra na sua conta automaticamente."
        />
        <CopiarLink link={link} />
        {whats ? (
          <p style={{ margin: "16px 0 0", fontSize: 13.5, color: "var(--ed2-ink-2)", lineHeight: 1.6 }}>
            A página abre com o seu nome no topo e tem um botão que já leva a pessoa
            para o nosso WhatsApp com o seu código na mensagem. Você não precisa
            explicar nada, é só mandar o link depois da ligação.
          </p>
        ) : (
          <p style={{ margin: "16px 0 0", fontSize: 13.5, color: "#b45309", lineHeight: 1.6 }}>
            O botão de WhatsApp da página ainda não está ligado. Avise o time para
            configurar o número.
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
          label="Leads cadastrados"
          value={String(p.leads)}
          desc={`${p.autorizados} autorizaram contato`}
        />
        <StatCard
          label="Já na operação"
          value={String(p.promovidos)}
          desc="entraram no atendimento"
        />
        <StatCard
          label="Viraram cliente"
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
            A comissão nasce quando o contrato é fechado, não quando o lead entra.
            O valor de cada linha é congelado no dia da apuração.
          </div>
        </div>
      </Card>
    </>
  );
}
