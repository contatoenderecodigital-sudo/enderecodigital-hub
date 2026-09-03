import CaixaFood from "@/components/food/caixa-food";

export const dynamic = "force-dynamic";

export default async function Pagina({ params }: { params: Promise<{ neg: string }> }) {
  const { neg } = await params;
  return <CaixaFood neg={neg} />;
}
