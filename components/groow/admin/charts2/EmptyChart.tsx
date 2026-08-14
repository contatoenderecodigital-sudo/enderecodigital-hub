"use client";

import type { ReactNode } from "react";

/**
 * Estado vazio / dados insuficientes - padrão único para todos os gráficos.
 * Evita o "eletrocardiograma morto" de plotar 1-2 pontos num eixo de 12.
 */
export default function EmptyChart({
  height = 220,
  icon,
  children,
}: {
  height?: number;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        height,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        color: "var(--ed2-ink-3)",
        textAlign: "center",
        padding: "0 24px",
      }}
    >
      <span style={{ opacity: 0.7 }} aria-hidden>
        {icon ?? (
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18" />
            <path d="M7 15l3-3 3 2 4-6" />
          </svg>
        )}
      </span>
      <span style={{ fontSize: 13, maxWidth: 260, lineHeight: 1.45 }}>{children}</span>
    </div>
  );
}
