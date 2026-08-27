import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Inter, Inter_Tight, JetBrains_Mono, DM_Sans } from "next/font/google";
import SidebarParceiro from "@/components/groow/parceiro/SidebarParceiro";
import { parceiroDaSessao } from "@/lib/groow/parceiro-sessao";
// Mesmo design system do /operacao (vars --ed2-*). O Next dedupe o CSS entre
// layouts, entao importar aqui nao duplica bundle.
import "../operacao/groow.css";

// As mesmas fontes do /operacao: sem elas as vars --font-sans/--font-display
// ficam indefinidas e o Tailwind cai no system-ui.
const interSans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const interDisplay = Inter_Tight({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });
const fontVars = `${interSans.variable} ${interDisplay.variable} ${dmSans.variable} ${mono.variable}`;

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Painel do parceiro",
  robots: { index: false, follow: false },
};

export default async function ParceiroLayout({ children }: { children: React.ReactNode }) {
  const parceiro = await parceiroDaSessao();
  if (!parceiro) redirect("/login");

  return (
    <div className={`ed2 ${fontVars}`} style={{ minHeight: "100vh" }}>
      {/* aplica o tema salvo antes da pintura (evita flash do tema claro) */}
      <script
        dangerouslySetInnerHTML={{
          __html: `try{if(localStorage.getItem('ed2-theme')==='dark')document.documentElement.classList.add('ed2-dark')}catch(e){}`,
        }}
      />
      <SidebarParceiro nome={parceiro.nome} />
      <div className="parc-conteudo" style={{ marginLeft: 236 }}>
        <main style={{ maxWidth: 1240, margin: "0 auto", padding: "40px 32px 80px" }}>
          {children}
        </main>
      </div>
      {/* Sem soltar a margem, a gaveta fecha e o conteudo continua espremido. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `@media (max-width: 900px) {
            .parc-conteudo { margin-left: 0 !important; }
            .parc-conteudo main { padding: 68px 18px 60px !important; }
          }`,
        }}
      />
    </div>
  );
}
