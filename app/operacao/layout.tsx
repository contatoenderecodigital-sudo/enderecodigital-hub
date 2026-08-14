import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import TopNav from "@/components/groow/admin/TopNav";
import Sidebar from "@/components/groow/admin/Sidebar";
import GuiaModulo from "@/components/groow/admin/GuiaModulo";
import "./groow.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Operação",
  robots: { index: false, follow: false },
};

export default async function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.papel !== "owner_plataforma") redirect("/app");

  return (
    <div className="ed2" style={{ minHeight: "100vh" }}>
      {/* aplica o tema salvo antes da pintura (evita flash do tema claro) */}
      <script
        dangerouslySetInnerHTML={{
          __html: `try{if(localStorage.getItem('ed2-theme')==='dark')document.documentElement.classList.add('ed2-dark')}catch(e){}`,
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "6px 16px",
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "0.02em",
          color: "#C9A961",
          background: "#070F26",
          borderBottom: "1px solid rgba(201,169,97,0.18)",
        }}
      >
        <span>MODO OPERAÇÃO · GROOW OS</span>
        <Link href="/owner" style={{ color: "#D9BE7E", textDecoration: "none" }}>
          Voltar ao console
        </Link>
      </div>
      <Sidebar />
      <div className="ed3-shift">
        <TopNav />
        <main
          style={{
            maxWidth: 1440,
            margin: "0 auto",
            padding: "36px 32px 80px",
          }}
        >
          {children}
        </main>
      </div>
      <GuiaModulo />
    </div>
  );
}
