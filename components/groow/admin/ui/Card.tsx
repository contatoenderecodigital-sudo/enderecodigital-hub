// regra #3 - Card padrão. NUNCA usar border:1px solid (a borda vem da 2ª sombra).
"use client";

import { forwardRef, type HTMLAttributes, type ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Adiciona elevação no hover (Regra #3). Default: true. */
  hoverable?: boolean;
  /** Padding compacto (16px) pra mobile/cards aninhados. Default: false (24px). */
  compact?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { children, hoverable = true, compact = false, className = "", style, ...rest },
  ref
) {
  return (
    <div
      ref={ref}
      {...rest}
      className={className}
      style={{
        background: "var(--surface)",
        borderRadius: "var(--r-lg)",
        padding: compact ? "var(--s-4)" : "var(--s-6)",
        boxShadow: "var(--shadow-card)",
        transition: "box-shadow .3s var(--ease-out), transform .3s var(--ease-out)",
        ...style,
      }}
      onMouseEnter={(e) => {
        if (hoverable) {
          e.currentTarget.style.boxShadow = "var(--shadow-card-hover)";
          e.currentTarget.style.transform = "translateY(-1px)";
        }
        rest.onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        if (hoverable) {
          e.currentTarget.style.boxShadow = "var(--shadow-card)";
          e.currentTarget.style.transform = "translateY(0)";
        }
        rest.onMouseLeave?.(e);
      }}
    >
      {children}
    </div>
  );
});

export default Card;

// Cabeçalho do card: H2 à esquerda + ação opcional à direita (Regra #3)
export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: "var(--s-3)",
        marginBottom: "var(--s-4)",
      }}
    >
      <div>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 16,
            fontWeight: 600,
            color: "var(--fg-4-admin)",
            letterSpacing: "-0.01em",
            margin: 0,
          }}
        >
          {title}
        </h2>
        {subtitle ? (
          <p
            style={{
              marginTop: 4,
              fontSize: 12,
              color: "var(--fg-2-admin)",
              fontWeight: 400,
            }}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
      {action ? <div style={{ flexShrink: 0 }}>{action}</div> : null}
    </div>
  );
}
