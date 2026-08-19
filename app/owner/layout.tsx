import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hubOpId } from "@/lib/hub-ctx";
import { nomeDoHub } from "@/lib/platform";
import OwnerShell from "@/components/owner-shell";

export const dynamic = "force-dynamic";

export default async function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.papel !== "owner_plataforma") redirect("/login");

  const hid = await hubOpId();
  const hubAtivo = hid ? await nomeDoHub(hid) : null;

  return (
    <OwnerShell email={s.email} hubAtivo={hubAtivo}>
      {children}
    </OwnerShell>
  );
}
