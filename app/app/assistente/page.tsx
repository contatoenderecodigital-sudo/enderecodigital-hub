import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { activeNegocioId } from "@/lib/tenant";
import { getNegocio, getCerebro } from "@/lib/data";
import Chat from "./chat";

export const dynamic = "force-dynamic";

export default async function AssistentePage() {
  const s = await getSession();
  const neg = activeNegocioId(s);
  if (!neg) redirect("/login");
  const negocio = await getNegocio(neg);
  if (!negocio) redirect("/login");
  const cerebro = await getCerebro(neg);

  return (
    <>
      <div className="kpi-label gold">Módulo</div>
      <h1 style={{ margin: "4px 0 0" }}>Assistente</h1>
      <p className="muted">
        A IA que conhece o seu negócio. Motor: API Anthropic, com custo medido por cliente.
      </p>
      {!cerebro?.conteudo && (
        <div className="err" style={{ maxWidth: 720 }}>
          Nenhuma base de conhecimento cadastrada ainda — a IA vai responder de forma genérica.
          Preencha o cérebro em Config. do cliente.
        </div>
      )}
      <Chat nome={negocio.nome_fantasia || negocio.nome} />
    </>
  );
}
