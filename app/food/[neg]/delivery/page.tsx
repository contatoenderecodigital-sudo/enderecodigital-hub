import DeliveryFood from "@/components/food/delivery-food";

export const dynamic = "force-dynamic";

export default async function Pagina({ params }: { params: Promise<{ neg: string }> }) {
  const { neg } = await params;
  return <DeliveryFood neg={neg} />;
}
