import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import OwnerShell from "@/components/owner-shell";

export const dynamic = "force-dynamic";

export default async function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.papel !== "owner_plataforma") redirect("/app");

  return <OwnerShell email={s.email}>{children}</OwnerShell>;
}
