"use client";

// Barra superior SÓ MOBILE (<1024px): hamburger do drawer + marca + ações globais.
// No desktop ela some - a navegação e as ações vivem na Sidebar.
import Image from "next/image";
import Link from "next/link";
import { Menu } from "lucide-react";
import AdminActions from "@/components/groow/admin/AdminActions";

export default function TopNav() {
  return (
    <header
      className="ed2-topbar ed3-top-mobile"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "var(--ed2-topbar-bg)",
        backdropFilter: "saturate(180%) blur(20px)",
        WebkitBackdropFilter: "saturate(180%) blur(20px)",
        borderBottom: "1px solid var(--ed2-hair)",
      }}
    >
      <div style={{ padding: "0 16px", height: 58, display: "flex", alignItems: "center", gap: 14 }}>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("ed3-nav-toggle"))}
          aria-label="Abrir menu"
          style={{ width: 34, height: 34, borderRadius: 99, background: "var(--ed2-surface)", color: "var(--ed2-ink)", border: "none", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <Menu size={16} strokeWidth={1.5} aria-hidden />
        </button>

        <Link
          href="/operacao"
          aria-label="Endereço Digital · Admin"
          style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700, letterSpacing: "-0.02em", fontSize: 15, color: "var(--ed2-ink)", textDecoration: "none", flexShrink: 0 }}
        >
          <Image src="/logo-mark.png" alt="" width={26} height={26} unoptimized style={{ borderRadius: 8, display: "block" }} aria-hidden />
          <span className="hidden sm:inline">Endereço Digital</span>
        </Link>

        <div style={{ marginLeft: "auto" }}>
          <AdminActions dropdownSide="bottom" />
        </div>
      </div>
    </header>
  );
}
