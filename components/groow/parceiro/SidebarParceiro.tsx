"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Wallet, Headphones, Tag, LogOut } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const W = 236;

const ITENS: { href: string; label: string; icon: LucideIcon; exact?: boolean }[] = [
  { href: "/parceiro", label: "Painel", icon: LayoutDashboard, exact: true },
  { href: "/parceiro/leads", label: "Minhas ligações", icon: Users },
  { href: "/parceiro/comissoes", label: "Comissões", icon: Wallet },
  { href: "/parceiro/oferta", label: "O que você vende", icon: Tag },
  { href: "/parceiro/copiloto", label: "Roteiro da ligação", icon: Headphones },
];

export default function SidebarParceiro({ nome }: { nome: string }) {
  const pathname = usePathname();

  return (
    <aside
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
    </aside>
  );
}
