import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const MODULOS: Record<string, { titulo: string; desc: string; proximo: string }> = {
  site: {
    titulo: "Meu site",
    desc: "Seu site exibido aqui dentro, com métricas de visita em tempo real.",
    proximo: "Fase 3 — conexão do site + tag de acompanhamento própria.",
  },
  instagram: {
    titulo: "Instagram",
    desc: "Perfil real (via API oficial da Meta), métricas e o gerador de posts e carrosséis com biblioteca de modelos.",
    proximo: "Fase 3 — conexão Graph API + gerador de conteúdo.",
  },
  crm: {
    titulo: "CRM",
    desc: "Funil visual, leads que chegam automaticamente pelo WhatsApp e agentes de IA por etapa.",
    proximo: "Fase 2 — funil próprio + captura de leads.",
  },
  whatsapp: {
    titulo: "WhatsApp oficial",
    desc: "Atendimento com IA no seu número, pela Cloud API oficial da Meta. Conexão pelo Embedded Signup, isolada por cliente. É o diferencial da plataforma.",
    proximo: "Fase 1 — conexão + agente de IA por tenant.",
  },
  financeiro: {
    titulo: "Financeiro",
    desc: "Caixa, contas a pagar e receber, metas e relatórios.",
    proximo: "Fase 5 — módulo financeiro.",
  },
  assistente: {
    titulo: "Assistente",
    desc: "Converse com a IA que conhece os dados e os arquivos do seu negócio.",
    proximo: "Fase 1 — motor de IA por tenant (API Anthropic, custo medido).",
  },
  config: {
    titulo: "Configurações",
    desc: "Perfil, senha e preferências da sua conta.",
    proximo: "Fase 1 — perfil e segurança.",
  },
};

export default async function ModuloPage({
  params,
}: {
  params: Promise<{ modulo: string }>;
}) {
  const { modulo } = await params;
  const m = MODULOS[modulo];
  if (!m) notFound();

  return (
    <>
      <div className="eyebrow">Módulo</div>
      <h1 style={{ margin: "4px 0 0" }}>{m.titulo}</h1>
      <p className="muted" style={{ maxWidth: 620 }}>
        {m.desc}
      </p>

      <div className="card" style={{ marginTop: 18, maxWidth: 620 }}>
        <div className="kpi-label">Em construção</div>
        <p style={{ margin: "8px 0 0" }}>{m.proximo}</p>
      </div>
    </>
  );
}
