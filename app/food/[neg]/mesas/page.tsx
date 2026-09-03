import { redirect } from "next/navigation";
import MesasCartoes from "@/components/food/mesas-cartoes";
import { negocioPermitido } from "@/lib/food-auth";
import { lojaPrincipal } from "@/lib/food";

export const dynamic = "force-dynamic";

export default async function PaginaMesas({ params }: { params: Promise<{ neg: string }> }) {
  const { neg } = await params;
  if (!(await negocioPermitido(neg))) redirect("/login");
  const loja = await lojaPrincipal(neg);
  if (!loja) redirect(`/food/${neg}`);
  return <MesasCartoes neg={neg} slug={loja.slug} />;
}
