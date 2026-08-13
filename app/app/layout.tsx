import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { activeNegocioId, estaImpersonando } from "@/lib/tenant";
import { getNegocio, getHub } from "@/lib/data";
import { modulosEfetivos } from "@/lib/types";
import WsShell from "@/components/ws-shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const s = await getSession();
  if (!s) redirect("/login");

  const negId = activeNegocioId(s);
  if (!negId) {
    if (s.papel === "owner_plataforma") redirect("/owner");
    redirect("/login");
  }

  const negocio = await getNegocio(negId as string);
  if (!negocio) {
    if (s.papel === "owner_plataforma") redirect("/owner/clientes");
    redirect("/login");
  }
  const hub = await getHub(negocio.hub_id);
  const mods = hub
    ? modulosEfetivos(negocio, hub)
    : { site: false, instagram: false, financeiro: false, crm: false };

  return (
    <WsShell
      nome={negocio.nome_fantasia || negocio.nome}
      cor={negocio.marca_cor || "#C9A961"}
      mods={mods}
      impersonando={estaImpersonando(s)}
    >
      {children}
    </WsShell>
  );
}
