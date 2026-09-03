import RelatoriosFood from "@/components/food/relatorios-food";

export const dynamic = "force-dynamic";

export default async function Pagina({ params }: { params: Promise<{ neg: string }> }) {
  const { neg } = await params;
  return <RelatoriosFood neg={neg} />;
}
