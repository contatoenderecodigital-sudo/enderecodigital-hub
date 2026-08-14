import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Inter, Inter_Tight, JetBrains_Mono, DM_Sans } from "next/font/google";
import { getSession } from "@/lib/auth";
import TopNav from "@/components/groow/admin/TopNav";
import Sidebar from "@/components/groow/admin/Sidebar";
import GuiaModulo from "@/components/groow/admin/GuiaModulo";
import "./groow.css";

// Mesmas fontes do site antigo (Inter texto, Inter Tight titulos) — define as
// CSS vars que o groow.css/tailwind esperam (--font-sans, --font-display, etc).
const interSans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const interDisplay = Inter_Tight({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });
const fontVars = `${interSans.variable} ${interDisplay.variable} ${dmSans.variable} ${mono.variable}`;

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
    <div className={`ed2 ${fontVars}`} style={{ minHeight: "100vh" }}>
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
