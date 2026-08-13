import Link from "@/components/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.papel !== "owner_plataforma") redirect("/app");

  return (
    <div className="shell">
      <nav className="side">
        <div className="brand gold">Endereço Digital</div>
        <Link href="/owner">Visão geral</Link>
        <Link href="/owner/hubs">Hubs</Link>
        <Link href="/owner/clientes">Clientes</Link>
        <div style={{ flex: 1 }} />
        <span className="kpi-label" style={{ padding: "0 12px" }}>
          {s.email}
        </span>
        <Link href="/logout">Sair</Link>
      </nav>
      <main className="content">{children}</main>
    </div>
  );
}
