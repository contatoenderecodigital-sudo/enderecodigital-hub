import type { ReactNode, CSSProperties } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  padding?: number | string;
}

export default function Card({ children, className = "", style, padding = 26 }: CardProps) {
  return (
    <div
      className={className}
      style={{
        background: "var(--ed2-card)",
        borderRadius: 28,
        padding,
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function CardHead({
  title,
  sub,
  right,
}: {
  title: string;
  sub?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        marginBottom: 14,
        gap: 16,
      }}
    >
      <div>
        <h3
          style={{
            margin: 0,
            fontSize: 19,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            color: "var(--ed2-ink)",
          }}
        >
          {title}
        </h3>
        {sub ? (
          <div style={{ fontSize: 13, color: "var(--ed2-ink-2)", marginTop: 4 }}>{sub}</div>
        ) : null}
      </div>
      {right ?? null}
    </div>
  );
}
