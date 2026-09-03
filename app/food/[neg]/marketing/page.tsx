import MarketingFood from "@/components/food/marketing-food";

export const dynamic = "force-dynamic";

export default async function Pagina({ params }: { params: Promise<{ neg: string }> }) {
  const { neg } = await params;
  return <MarketingFood neg={neg} />;
}
