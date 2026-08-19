"use client";

import { useEffect, useState } from "react";

/** Alterna o tema claro/escuro do painel (.ed2-dark no <html>) e persiste no localStorage.
 *  onDark: renderiza sobre fundo navy (ícone claro, hover translúcido). */
export default function ThemeToggle({ onDark = false }: { onDark?: boolean } = {}) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("ed2-dark"));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("ed2-dark", next);
    try { localStorage.setItem("ed2-theme", next ? "dark" : "light"); } catch { /* */ }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Mudar para tema claro" : "Mudar para tema escuro"}
      title={dark ? "Tema claro" : "Tema escuro"}
      style={{
        all: "unset",
        cursor: "pointer",
        width: onDark ? 32 : 38,
        height: onDark ? 32 : 38,
        borderRadius: 999,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: onDark ? (dark ? "var(--ed2-gold)" : "rgba(255,255,255,0.72)") : dark ? "var(--ed2-gold)" : "var(--ed2-ink-2)",
        background: onDark ? "rgba(255,255,255,0.08)" : "transparent",
        transition: "color .2s, background .2s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = onDark ? "rgba(255,255,255,0.16)" : "var(--ed2-surface)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = onDark ? "rgba(255,255,255,0.08)" : "transparent"; }}
    >
      {dark ? (
        // sol
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4.5" />
          <path d="M12 1.5v2.5M12 20v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M1.5 12h2.5M20 12h2.5M4.2 19.8l1.8-1.8M18 6l1.8-1.8" />
        </svg>
      ) : (
        // lua
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 14.5A8 8 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5z" />
        </svg>
      )}
    </button>
  );
}
