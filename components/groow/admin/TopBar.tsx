"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Bell, ChevronDown, LogOut, Settings, User } from "lucide-react";

export default function TopBar() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [dropdownOpen]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    router.push(`/operacao/leads?q=${encodeURIComponent(term)}`);
  };

  const onLogout = async () => {
    window.location.href = "/logout";
  };

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";

  return (
    <div className="sticky top-0 z-30 bg-white border-b border-zinc-200/70">
      <div className="flex items-center gap-4 px-6 md:px-8 py-3.5">
        <div className="hidden md:block">
          <p className="text-sm font-medium text-navy leading-tight">
            {saudacao}, Sandro <span className="inline-block ml-0.5">👋</span>
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            {new Date().toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "2-digit",
              month: "long",
            })}
          </p>
        </div>

        <form onSubmit={onSubmit} className="flex-1 max-w-md ml-auto md:ml-8">
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar leads, empresas..."
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50/60 px-10 py-2 text-sm placeholder:text-zinc-400 focus:border-gold focus:bg-white focus:outline-none focus:ring-4 focus:ring-gold/10 transition-all"
            />
            <kbd className="hidden md:inline-flex absolute right-3 top-1/2 -translate-y-1/2 items-center gap-0.5 rounded-md border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] text-zinc-500">
              ⌘K
            </kbd>
          </div>
        </form>

        <button
          type="button"
          aria-label="Notificações"
          className="relative grid place-items-center h-9 w-9 rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:text-navy hover:border-gold/40 transition-colors"
        >
          <Bell size={15} aria-hidden="true" />
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />
        </button>

        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg pl-1.5 pr-2.5 py-1 border border-zinc-200 bg-white hover:border-gold/40 transition-colors"
            aria-label="Menu do usuário"
            aria-expanded={dropdownOpen}
          >
            <span className="grid place-items-center h-7 w-7 rounded-full bg-gradient-to-br from-gold/40 to-gold/15 border border-gold/40 text-gold font-display font-bold text-xs">
              S
            </span>
            <span className="hidden sm:inline text-sm font-medium text-navy">Sandro</span>
            <ChevronDown size={13} className={`text-zinc-500 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>

          {dropdownOpen ? (
            <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-zinc-200 bg-white shadow-lg overflow-hidden">
              <div className="px-3 py-3 border-b border-zinc-100">
                <p className="text-sm font-medium text-navy">Sandro</p>
                <p className="text-xs text-zinc-500 truncate">contato@enderecodigital.com</p>
              </div>
              <div className="py-1">
                <Link
                  href="/operacao"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                >
                  <User size={14} aria-hidden="true" />
                  Meu perfil
                </Link>
                <button
                  type="button"
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 text-left"
                >
                  <Settings size={14} aria-hidden="true" />
                  Configurações
                </button>
              </div>
              <div className="py-1 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={onLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 text-left"
                >
                  <LogOut size={14} aria-hidden="true" />
                  Sair
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
