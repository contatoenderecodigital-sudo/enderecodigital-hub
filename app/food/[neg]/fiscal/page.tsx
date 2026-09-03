import FiscalFood from "@/components/food/fiscal-food";

export const dynamic = "force-dynamic";

export default async function Pagina({ params }: { params: Promise<{ neg: string }> }) {
  const { neg } = await params;
  return <FiscalFood neg={neg} />;
}
