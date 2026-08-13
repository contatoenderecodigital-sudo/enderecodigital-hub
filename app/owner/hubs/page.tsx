import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Unificado: a gestão de hubs (ver, entrar, criar, configurar) vive na home /owner.
export default function HubsRedirect() {
  redirect("/owner");
}
