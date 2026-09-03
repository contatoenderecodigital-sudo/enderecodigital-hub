import { notFound } from "next/navigation";
import DeliveryCliente from "@/components/food/delivery-cliente";
import { getLojaBySlug } from "@/lib/food";

// Pedido online: /c/<slug>/pedir. Este e o link que o dono poe na bio do
// Instagram e no Google, e o que substitui o aplicativo de entrega.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const loja = await getLojaBySlug(slug);
  return {
    title: loja ? `Pedir · ${loja.nome}` : "Pedido online",
    description: loja ? `Peca online no ${loja.nome}${loja.cidade ? ` em ${loja.cidade}` : ""}, sem taxa de aplicativo.` : undefined,
  };
}

export default async function PaginaPedir({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const loja = await getLojaBySlug(slug);
  if (!loja) notFound();
  return <DeliveryCliente slug={slug} />;
}
