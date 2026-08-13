"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "@/components/link";
import {
  IcoDashboard,
  IcoUsers,
  IcoHub,
  IcoLogout,
  IcoSearch,
  IcoBell,
  IcoMenu,
  IcoChevronRight,
} from "@/components/icons";

type NavItem = { href: string; label: string; Icon: typeof IcoDashboard; exact?: boolean };
const NAV: { grupo: string; itens: NavItem[] }[] = [
  {
    grupo: "Operação",
    itens: [{ href: "/owner", label: "Visão geral", Icon: IcoDashboard, exact: true }],
  },
  {
    grupo: "Gestão",
    itens: [
      { href: "/owner/clientes", label: "Clientes", Icon: IcoUsers },
      { href: "/owner/hubs", label: "Hubs", Icon: IcoHub },
    ],
  },
];

const TITULOS: [string, string][] = [
  ["/owner/clientes", "Clientes"],
  ["/owner/hubs", "Hubs"],
  ["/owner", "Visão geral"],
];

export default function OwnerShell({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "/owner";
  const [open, setOpen] = useState(false);
  const titulo = TITULOS.find(([p]) => pathname.startsWith(p))?.[1] || "Console";
  const iniciais = email.slice(0, 2).toUpperCase();

  const ativo = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  return (
    <div className={"shell" + (open ? " open" : "")}>
      <div className="side-backdrop" onClick={() => setOpen(false)} />
      <aside className="side">
        <div className="side-logo">
          <div className="avatar">ED</div>
          <b>Endereço Digital</b>
        </div>
        {NAV.map((g) => (
          <div key={g.grupo}>
            <div className="side-group">{g.grupo}</div>
            {g.itens.map(({ href, label, Icon, exact }) => (
              <Link
                key={href}
                href={href}
                className={"side-link" + (ativo(href, exact) ? " active" : "")}
                onClick={() => setOpen(false)}
              >
                <Icon width={19} height={19} />
                {label}
              </Link>
            ))}
          </div>
        ))}
        <div className="side-foot">
          <div className="side-user">{email}</div>
          <Link href="/logout" className="side-link">
            <IcoLogout width={19} height={19} />
            Sair
          </Link>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <button className="icon-btn hamburger" onClick={() => setOpen(true)} aria-label="Menu">
            <IcoMenu />
          </button>
          <div className="crumb">
            <span>Endereço Digital</span>
            <IcoChevronRight width={14} height={14} />
            <b>{titulo}</b>
          </div>
          <div className="topbar-search">
            <IcoSearch width={16} height={16} />
            <input placeholder="Buscar..." />
          </div>
          <button className="icon-btn" aria-label="Notificações">
            <IcoBell width={18} height={18} />
          </button>
          <div className="avatar" title={email}>
            {iniciais}
          </div>
        </div>
        <div className="content">{children}</div>
        <div className="footer">
          <span>© 2026 Endereço Digital · Plataforma v1.0</span>
          <span className="row" style={{ gap: 8 }}>
            <span className="badge ok">Operacional</span>
          </span>
        </div>
      </div>
    </div>
  );
}
