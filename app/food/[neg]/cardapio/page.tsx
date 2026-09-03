import { redirect } from "next/navigation";
import CardapioAdmin from "@/components/food/cardapio-admin";
import { lojaPrincipal } from "@/lib/food";
import { negocioPermitido } from "@/lib/food-auth";

export const dynamic = "force-dynamic";

export default async function Pagina({ params }: { params: Promise<{ neg: string }> }) {
  const { neg } = await params;
  if (!(await negocioPermitido(neg))) redirect("/login");
  const loja = await lojaPrincipal(neg);
  if (!loja) redirect(`/food/${neg}`);
  return <CardapioAdmin neg={neg} slug={loja.slug} />;
}
