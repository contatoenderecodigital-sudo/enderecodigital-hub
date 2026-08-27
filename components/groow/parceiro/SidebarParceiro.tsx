"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Search, Users, Wallet, Headphones, Tag, LogOut, Menu, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const W = 236;

const ITENS: { href: string; label: string; icon: LucideIcon; exact?: boolean }[] = [
  { href: "/parceiro", label: "Painel", icon: LayoutDashboard, exact: true },
  { href: "/parceiro/prospeccao", label: "Achar quem ligar", icon: Search },
  { href: "/parceiro/leads", label: "Minhas ligações", icon: Users },
  { href: "/parceiro/comissoes", label: "Comissões", icon: Wallet },
  { href: "/parceiro/oferta", label: "O que você vende", icon: Tag },
  { href: "/parceiro/copiloto", label: "Roteiro da ligação", icon: Headphones },
];

export default function SidebarParceiro({ nome }: { nome: string }) {
  const pathname = usePathname();
  // No celular o menu vira gaveta. Fixo, ele comia 236px de uma tela de 433 e
  // sobrava menos da metade pro conteudo: o link de indicacao aparecia como
  // "http" e o botao de copiar ficava cortado na borda.
  const [aberto, setAberto] = useState(false);

  // Fecha ao navegar, senao a gaveta cobre a tela que acabou de abrir.
  useEffect(() => setAberto(false), [pathname]);

  return (
    <>
      <button
        className="parc-hamb"
        onClick={() => setAberto(true)}
        aria-label="Abrir menu"
        style={{
          position: "fixed",
          top: 12,
          left: 12,
          zIndex: 60,
          width: 42,
          height: 42,
          borderRadius: 13,
          border: "1px solid rgba(201,169,97,0.30)",
          background: "#0B1838",
          color: "#C9A961",
          display: "none",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
      >
        <Menu size={19} />
      </button>

      {aberto ? (
        <div
          className="parc-fundo"
          onClick={() => setAberto(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(6,13,34,0.55)",
            zIndex: 45,
            display: "none",
          }}
        />
      ) : null}

    <aside
      className={`parc-menu${aberto ? " parc-menu-aberto" : ""}`}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        width: W,
        background: "#0B1838",
        borderRight: "1px solid rgba(201,169,97,0.14)",
        display: "flex",
        flexDirection: "column",
        padding: "24px 16px 18px",
        zIndex: 40,
      }}
    >
      <div style={{ padding: "0 8px 26px" }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "#C9A961",
            marginBottom: 6,
          }}
        >
          Endereço Digital
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#F5F2EA", lineHeight: 1.3 }}>
          {nome}
        </div>
        <div style={{ fontSize: 12.5, color: "rgba(245,242,234,0.45)", marginTop: 2 }}>
          Parceiro
        </div>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1 }}>
        {ITENS.map((i) => {
          const ativo = i.exact ? pathname === i.href : pathname.startsWith(i.href);
          const Icone = i.icon;
          return (
            <Link
              key={i.href}
              href={i.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                padding: "10px 12px",
                borderRadius: 12,
                fontSize: 14.5,
                fontWeight: ativo ? 600 : 500,
                textDecoration: "none",
                color: ativo ? "#0B1838" : "rgba(245,242,234,0.72)",
                background: ativo ? "#C9A961" : "transparent",
              }}
            >
              <Icone size={17} strokeWidth={2} />
              {i.label}
            </Link>
          );
        })}
      </nav>

      <a
        href="/logout"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 11,
          padding: "10px 12px",
          borderRadius: 12,
          fontSize: 14,
          textDecoration: "none",
          color: "rgba(245,242,234,0.5)",
        }}
      >
        <LogOut size={16} strokeWidth={2} />
        Sair
      </a>

      <button
        className="parc-fechar"
        onClick={() => setAberto(false)}
        aria-label="Fechar menu"
        style={{
          position: "absolute",
          top: 14,
          right: 14,
          width: 34,
          height: 34,
          borderRadius: 999,
          border: "1px solid rgba(245,242,234,0.16)",
          background: "transparent",
          color: "rgba(245,242,234,0.6)",
          display: "none",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
      >
        <X size={16} />
      </button>
    </aside>

    <style>{`
      @media (max-width: 900px) {
        .parc-hamb { display: flex !important; }
        .parc-fechar { display: flex !important; }
        .parc-fundo { display: block !important; }
        .parc-menu {
          transform: translateX(-100%);
          transition: transform 220ms cubic-bezier(.2,.8,.3,1);
          z-index: 50;
        }
        .parc-menu-aberto { transform: none; }
      }
    `}</style>
    </>
  );
}
