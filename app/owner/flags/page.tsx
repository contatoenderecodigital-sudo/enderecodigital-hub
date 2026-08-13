import PageHead from "@/components/page-head";

export const dynamic = "force-dynamic";

const FLAGS = [
  { nome: "WhatsApp oficial", desc: "Módulo de atendimento pela Cloud API.", on: true },
  { nome: "CRM / Funil", desc: "Funil de leads e captura no site.", on: true },
  { nome: "Assistente de IA", desc: "Chat com o cérebro do cliente.", on: true },
  { nome: "Instagram", desc: "Perfil, métricas e gerador de posts.", on: false },
  { nome: "Financeiro", desc: "Caixa, contas e metas.", on: false },
  { nome: "Multi-hub por domínio", desc: "Várias marcas no mesmo deploy.", on: true },
];

export default function FlagsPage() {
  return (
    <>
      <PageHead eyebrow="Sistema" titulo="Feature Flags" sub="Liga e desliga funcionalidades da plataforma." />
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {FLAGS.map((f, i) => (
          <div key={f.nome} className="spread" style={{ padding: "14px 20px", borderTop: i ? "1px solid var(--line)" : "none" }}>
            <div>
              <strong>{f.nome}</strong>
              <div className="muted" style={{ fontSize: 13 }}>{f.desc}</div>
            </div>
            <span className={"badge " + (f.on ? "ok" : "")}>{f.on ? "ligado" : "em breve"}</span>
          </div>
        ))}
      </div>
    </>
  );
}
