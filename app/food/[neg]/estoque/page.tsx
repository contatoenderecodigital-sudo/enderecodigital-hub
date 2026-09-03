import EstoqueFood from "@/components/food/estoque-food";

export const dynamic = "force-dynamic";

export default async function Pagina({ params }: { params: Promise<{ neg: string }> }) {
  const { neg } = await params;
  return <EstoqueFood neg={neg} />;
}
