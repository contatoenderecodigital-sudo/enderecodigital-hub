"use client";

import { usePathname } from "next/navigation";
import Link from "@/components/link";
import {
  IcoDashboard,
  IcoGlobe,
  IcoInstagram,
  IcoFunnel,
  IcoWhatsapp,
  IcoInbox,
  IcoSparkles,
  IcoSettings,
  IcoShield,
  IcoLogout,
  IcoActivity,
} from "@/components/icons";

interface Mods {
  site: boolean;
  instagram: boolean;
  crm: boolean;
  financeiro: boolean;
}

export default function WsShell({
  nome,
  cor,
  mods,
  impersonando,
  children,
}: {
  nome: string;
  cor: string;
  mods: Mods;
  impersonando: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "/app";
  const iniciais = nome.slice(0, 2).toUpperCase();

  const tabs: { href: string; label: string; Icon: typeof IcoDashboard; exact?: boolean }[] = [
    { href: "/app", label: "Visão geral", Icon: IcoDashboard, exact: true },
    { href: "/app/whatsapp", label: "WhatsApp", Icon: IcoWhatsapp },
    { href: "/app/atendimentos", label: "Atendimentos", Icon: IcoInbox },
    { href: "/app/assistente", label: "Assistente", Icon: IcoSparkles },
  ];
  if (mods.crm) tabs.splice(1, 0, { href: "/app/crm", label: "CRM", Icon: IcoFunnel });
  if (mods.site) tabs.push({ href: "/app/site", label: "Meu site", Icon: IcoGlobe });
  if (mods.instagram) tabs.push({ href: "/app/instagram", label: "Instagram", Icon: IcoInstagram });
  if (mods.financeiro) tabs.push({ href: "/app/financeiro", label: "Financeiro", Icon: IcoActivity });
  tabs.push({ href: "/app/config", label: "Configurações", Icon: IcoSettings });
  if (impersonando)
    tabs.push({ href: "/app/config-hub", label: "Config. do cliente", Icon: IcoShield });

  const ativo = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="ws">
      {impersonando && (
        <div className="owner-banner">
          <span className="row" style={{ gap: 8 }}>
            <IcoShield width={16} height={16} />
            <span>
              MODO OWNER · editando o workspace de <strong>{nome}</strong>
            </span>
          </span>
          <Link href="/sair-modo-owner">Voltar ao console</Link>
        </div>
      )}
      <nav className="wsnav">
        <div className="wsnav-logo">
          <div className="avatar" style={{ background: cor }}>
            {iniciais}
          </div>
          <b>{nome}</b>
        </div>
        <div className="wsnav-tabs">
          {tabs.map(({ href, label, Icon, exact }) => (
            <Link
              key={href}
              href={href}
              className={"wsnav-tab" + (ativo(href, exact) ? " active" : "")}
            >
              <Icon width={18} height={18} />
              {label}
            </Link>
          ))}
        </div>
        <div className="wsnav-right">
          <Link
            href={impersonando ? "/sair-modo-owner" : "/logout"}
            className="icon-btn"
            aria-label="Sair"
          >
            <IcoLogout width={18} height={18} />
          </Link>
        </div>
      </nav>
      <div className="ws-content">{children}</div>
    </div>
  );
}
