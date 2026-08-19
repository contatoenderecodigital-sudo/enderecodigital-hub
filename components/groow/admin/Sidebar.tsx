"use client";

// Sidebar estilo "OS" (navy fixa nos dois temas, grupos de módulos, ativa em dourado).
// Mobile: vira drawer - abre pelo hamburger do TopNav (evento "ed3-nav-toggle").
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, KanbanSquare, Building2, CheckSquare,
  MessageSquare, Megaphone, Wallet, Receipt, BarChart3, Target,
  FileText, BadgeCheck, Share2, KeyRound, X, TrendingUp, Network, ClipboardList, Filter, Bot, ListChecks,
  Boxes, LayoutGrid, Sparkles, SlidersHorizontal, Cpu, Handshake,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import AdminActions from "@/components/groow/admin/AdminActions";

type Item = { href?: string; label: string; icon: LucideIcon; exact?: boolean; soon?: boolean; badge?: string };

const GRUPOS: { titulo: string; itens: Item[] }[] = [
  {
    titulo: "Endereço Digital",
    itens: [
      { href: "/owner", label: "Todos os hubs", icon: Boxes, exact: true },
      { href: "/operacao/hub/clientes", label: "Clientes", icon: Building2 },
      { href: "/operacao/hub/workspaces", label: "Workspaces", icon: LayoutGrid },
      { href: "/operacao/hub/contas-claude", label: "Contas Claude", icon: Sparkles },
      { href: "/operacao/hub/tokens", label: "Tokens & IA", icon: Cpu, badge: "novo" },
      { href: "/operacao/hub/config", label: "Configurações do hub", icon: SlidersHorizontal },
    ],
  },
  {
    titulo: "Principal",
    itens: [
      { href: "/operacao", label: "Painel", icon: LayoutDashboard, exact: true },
      { href: "/operacao/leads", label: "Leads", icon: Users },
      { href: "/operacao/pipeline", label: "Pipeline", icon: KanbanSquare },
      { href: "/operacao/clientes", label: "Clientes", icon: Building2 },
      { href: "/operacao/parceiros", label: "Parceiros", icon: Handshake, badge: "novo" },
      { href: "/operacao/tarefas", label: "Tarefas", icon: CheckSquare },
    ],
  },
  {
    titulo: "Atendimento",
    itens: [
      { href: "/operacao/conversas", label: "Conversas", icon: MessageSquare, badge: "novo" },
      { href: "/operacao/disparos", label: "Disparos", icon: Megaphone, badge: "novo" },
    ],
  },
  {
    titulo: "Aquisição",
    itens: [
      { href: "/operacao/prospeccao", label: "Prospecção", icon: Target },
      { href: "/operacao/cardapios", label: "Cardápios", icon: ListChecks, badge: "novo" },
      { href: "/operacao/trafego", label: "Tráfego", icon: TrendingUp, badge: "novo" },
      { href: "/operacao/mapa", label: "Ecossistema", icon: Network, badge: "novo" },
      { href: "/operacao/funil", label: "Funil", icon: Filter, badge: "novo" },
      { href: "/operacao/metricas", label: "Métricas", icon: BarChart3 },
    ],
  },
  {
    titulo: "Conteúdo",
    itens: [
      { href: "/operacao/blog", label: "Blog SEO", icon: FileText, badge: "novo" },
      { href: "/operacao/conteudo-social", label: "Conteúdo Social", icon: Share2, badge: "novo" },
      { href: "/operacao/aprovacoes", label: "Aprovações", icon: BadgeCheck, badge: "novo" },
      { href: "/operacao/ia", label: "IA & Custos", icon: Bot, badge: "novo" },
    ],
  },
  {
    titulo: "Gestão",
    itens: [
      { href: "/operacao/financeiro", label: "Financeiro", icon: Wallet },
      { href: "/operacao/cobrancas", label: "Cobranças", icon: Receipt },
      { href: "/operacao/relatorios", label: "Relatórios", icon: ClipboardList, badge: "novo" },
      { href: "/operacao/senhas", label: "Senhas", icon: KeyRound, badge: "novo" },
    ],
  },
];

const W = 236;

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false); // drawer mobile

  useEffect(() => {
    const toggle = () => setOpen((v) => !v);
    window.addEventListener("ed3-nav-toggle", toggle);
    return () => window.removeEventListener("ed3-nav-toggle", toggle);
  }, []);

  // fecha o drawer ao navegar
  useEffect(() => { setOpen(false); }, [pathname]);

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  const nav = (
    <nav aria-label="Módulos do admin" style={{ display: "flex", flexDirection: "column", gap: 22, padding: "18px 12px 24px", overflowY: "auto", flex: 1 }}>
      {GRUPOS.map((g) => (
        <div key={g.titulo}>
          <div style={{ padding: "0 10px 8px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>
            {g.titulo}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {g.itens.map((it) => {
              const Icon = it.icon;
              const active = it.href ? isActive(it.href, it.exact) : false;
              const inner = (
                <>
                  <Icon size={16} strokeWidth={1.8} aria-hidden style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{it.label}</span>
                  {it.badge && (
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "2.5px 7px", borderRadius: 99, background: "#C9A961", color: "#0B1838" }}>
                      {it.badge}
                    </span>
                  )}
                  {it.soon && (
                    <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", padding: "2.5px 7px", borderRadius: 99, background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)" }}>
                      em breve
                    </span>
                  )}
                </>
              );
              const baseStyle: React.CSSProperties = {
                display: "flex",
                alignItems: "center",
                gap: 11,
                padding: "9px 10px",
                borderRadius: 12,
                fontSize: 13.5,
                fontWeight: 500,
                letterSpacing: "-0.005em",
                textDecoration: "none",
                position: "relative",
                transition: "background .15s ease, color .15s ease",
              };
              if (!it.href) {
                return (
                  <div key={it.label} aria-disabled style={{ ...baseStyle, color: "rgba(255,255,255,0.38)", cursor: "default" }}>
                    {inner}
                  </div>
                );
              }
              return (
                <Link
                  key={it.label}
                  href={it.href}
                  aria-current={active ? "page" : undefined}
                  style={{
                    ...baseStyle,
                    color: active ? "#EBD9AC" : "rgba(255,255,255,0.62)",
                    background: active ? "rgba(201,169,97,0.14)" : "transparent",
                  }}
                  onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.92)"; } }}
                  onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.62)"; } }}
                >
                  {active && (
                    <span aria-hidden style={{ position: "absolute", left: 0, top: 8, bottom: 8, width: 3, borderRadius: 99, background: "#C9A961" }} />
                  )}
                  {inner}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  const brand = (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 20px 14px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
      <Image src="/logo-mark.png" alt="" width={28} height={28} unoptimized style={{ borderRadius: 8 }} aria-hidden />
      <div style={{ lineHeight: 1.15 }}>
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.02em", color: "#fff" }}>Endereço Digital</div>
        <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.4)", letterSpacing: "0.06em" }}>OPERAÇÃO · OS</div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop: fixa */}
      <aside
        className="ed3-aside-desktop"
        aria-label="Navegação do admin"
        style={{
          position: "fixed", top: 0, left: 0, bottom: 0, width: W, zIndex: 60,
          background: "#0B1838",
          borderRight: "1px solid rgba(255,255,255,0.07)",
          // display via CSS (.ed3-aside-desktop): none no mobile, flex-col no desktop
        }}
      >
        {brand}
        {/* ações globais (tema · notificações · perfil) - menus abrem pra direita */}
        <div style={{ padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <AdminActions dropdownSide="right" onDark />
        </div>
        {nav}
      </aside>

      {/* Mobile: drawer */}
      {open && (
        <div className="ed3-aside-mobile" style={{ position: "fixed", inset: 0, zIndex: 90 }}>
          <div onClick={() => setOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }} aria-hidden />
          <aside
            aria-label="Navegação do admin"
            style={{
              position: "absolute", top: 0, left: 0, bottom: 0, width: Math.min(W + 24, 300),
              background: "#0B1838", display: "flex", flexDirection: "column",
              boxShadow: "0 0 60px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center" }}>
              <div style={{ flex: 1 }}>{brand}</div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar menu" style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", padding: 14, cursor: "pointer" }}>
                <X size={18} aria-hidden />
              </button>
            </div>
            {nav}
          </aside>
        </div>
      )}
    </>
  );
}
