"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "@/components/link";
import {
  IcoDashboard,
  IcoUsers,
  IcoHub,
  IcoBuilding,
  IcoGlobe,
  IcoGrid,
  IcoSparkles,
  IcoKey,
  IcoActivity,
  IcoFunnel,
  IcoInstagram,
  IcoHelp,
  IcoShield,
  IcoLock,
  IcoAlert,
  IcoFlag,
  IcoSettings,
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
    itens: [{ href: "/owner", label: "Dashboard", Icon: IcoDashboard, exact: true }],
  },
  {
    grupo: "Agência · GROOW OS",
    itens: [
      { href: "/owner/ops/prospeccao", label: "Prospecção", Icon: IcoSearch },
      { href: "/owner/ops/leads", label: "Leads", Icon: IcoFunnel },
      { href: "/owner/ops/funil", label: "Funil", Icon: IcoGrid },
      { href: "/owner/ops/carteira", label: "Carteira", Icon: IcoBuilding },
      { href: "/owner/ops/cobrancas", label: "Cobranças", Icon: IcoActivity },
      { href: "/owner/ops/trafego", label: "Tráfego & ROAS", Icon: IcoActivity },
      { href: "/owner/ops/social", label: "Conteúdo Social", Icon: IcoInstagram },
      { href: "/owner/ops/blog", label: "Blog SEO", Icon: IcoGlobe },
      { href: "/owner/ops/tarefas", label: "Tarefas", Icon: IcoFlag },
    ],
  },
  {
    grupo: "Usuários",
    itens: [
      { href: "/owner/clientes", label: "Clientes", Icon: IcoUsers },
      { href: "/owner/workspaces", label: "Workspaces", Icon: IcoBuilding },
    ],
  },
  {
    grupo: "Plataforma",
    itens: [
      { href: "/owner/hubs", label: "Hubs", Icon: IcoHub },
      { href: "/owner/sites", label: "Sites", Icon: IcoGlobe },
      { href: "/owner/modelos", label: "Modelos", Icon: IcoGrid },
      { href: "/owner/contas-claude", label: "Contas Claude", Icon: IcoSparkles },
      { href: "/owner/assentos", label: "Assentos Claude", Icon: IcoKey },
      { href: "/owner/tokens", label: "Tokens", Icon: IcoActivity },
      { href: "/owner/suporte", label: "Suporte", Icon: IcoHelp },
    ],
  },
  {
    grupo: "Sistema",
    itens: [
      { href: "/owner/auditoria", label: "Auditoria", Icon: IcoShield },
      { href: "/owner/seguranca", label: "Segurança", Icon: IcoLock },
      { href: "/owner/alertas", label: "Alertas", Icon: IcoAlert },
      { href: "/owner/flags", label: "Feature Flags", Icon: IcoFlag },
      { href: "/owner/config", label: "Configurações", Icon: IcoSettings },
    ],
  },
];

const TITULOS: [string, string][] = [
  ["/owner/clientes", "Clientes"],
  ["/owner/workspaces", "Workspaces"],
  ["/owner/hubs", "Hubs"],
  ["/owner/sites", "Sites"],
  ["/owner/modelos", "Modelos"],
  ["/owner/contas-claude", "Contas Claude"],
  ["/owner/assentos", "Assentos Claude"],
  ["/owner/tokens", "Tokens"],
  ["/owner/suporte", "Suporte"],
  ["/owner/auditoria", "Auditoria"],
  ["/owner/seguranca", "Segurança"],
  ["/owner/alertas", "Alertas"],
  ["/owner/flags", "Feature Flags"],
  ["/owner/config", "Configurações"],
  ["/owner", "Dashboard"],
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
          <b>EnderecoDigital Hub</b>
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
            <span>EnderecoDigital Hub</span>
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
          <span>© 2026 EnderecoDigital Hub · v1.0</span>
          <span className="row" style={{ gap: 8 }}>
            <span className="badge ok">Operacional</span>
          </span>
        </div>
      </div>
    </div>
  );
}
