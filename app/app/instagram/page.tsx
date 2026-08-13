import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { activeNegocioId } from "@/lib/tenant";
import { getNegocio } from "@/lib/data";
import InstagramClient from "./instagram-client";

export const dynamic = "force-dynamic";

export default async function InstagramPage() {
  const s = await getSession();
  const neg = activeNegocioId(s);
  if (!neg) redirect("/login");
  const negocio = await getNegocio(neg);
  if (!negocio) redirect("/login");

  return (
    <InstagramClient
      nome={negocio.nome_fantasia || negocio.nome}
      cor={negocio.marca_cor || "#C9A961"}
      instagramUrl={negocio.instagram_url}
    />
  );
}
