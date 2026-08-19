import PageHeader from "@/components/groow/admin/ed2/PageHeader";
import CopilotoCall from "@/components/groow/parceiro/CopilotoCall";
import { FASES, OBJECOES, PRINCIPIOS } from "@/lib/groow/playbook-vendas";

export const dynamic = "force-dynamic";

export default function CopilotoPage() {
  const iaAtiva = process.env.COPILOTO_IA_ATIVO === "1" && !!process.env.ANTHROPIC_API_KEY;

  return (
    <>
      <PageHeader
        title="Copiloto de call"
        sub="Deixe a ligação no viva voz. O roteiro acompanha você fase por fase."
      />
      <CopilotoCall
        iaAtiva={iaAtiva}
        fases={FASES}
        objecoes={OBJECOES}
        principios={PRINCIPIOS}
      />
    </>
  );
}
