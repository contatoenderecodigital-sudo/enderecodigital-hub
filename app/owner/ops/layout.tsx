import { redirect } from "next/navigation";
import { hubOpId } from "@/lib/hub-ctx";

export const dynamic = "force-dynamic";

// Guard: as telas da operação (GROOW OS) só abrem DENTRO de um hub.
// Sem hub selecionado, volta pra home da plataforma pra escolher um.
export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  const h = await hubOpId();
  if (!h) redirect("/owner");
  return <>{children}</>;
}
