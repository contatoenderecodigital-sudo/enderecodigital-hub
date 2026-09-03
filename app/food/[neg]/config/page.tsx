import { redirect } from "next/navigation";
import ConfigLoja from "@/components/food/config-loja";
import { getSession } from "@/lib/auth";
import { negocioPermitido } from "@/lib/food-auth";

export const dynamic = "force-dynamic";

export default async function Pagina({ params }: { params: Promise<{ neg: string }> }) {
  const { neg } = await params;
  if (!(await negocioPermitido(neg))) redirect("/login");
  const s = await getSession();
  return <ConfigLoja neg={neg} ehOwner={s?.papel === "owner_plataforma"} />;
}
