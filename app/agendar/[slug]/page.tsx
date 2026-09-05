import { notFound } from "next/navigation";
import AgendamentoPublico from "@/components/agendamento-publico";
import { catalogoPublico } from "@/lib/agendamento-publico";

export const dynamic = "force-dynamic";

export default async function PaginaAgendamento({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const catalogo = await catalogoPublico(slug);
  if (!catalogo) notFound();
  // `negocioId` e uma chave interna: a pagina publica so recebe a selecao
  // necessaria para montar a interface. As APIs resolvem o tenant pelo slug.
  const { negocioId: _negocioId, ...publico } = catalogo;
  return <AgendamentoPublico slug={slug} catalogo={publico} />;
}
