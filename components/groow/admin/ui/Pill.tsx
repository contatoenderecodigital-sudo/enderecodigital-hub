// regra #8 - Pills padrão. JAMAIS aumentar font-size.
import type { ReactNode } from "react";

type Variant = "gold" | "success" | "danger" | "info" | "neutral";

interface Props {
  children: ReactNode;
  variant?: Variant;
  /** Bolinha colorida (●) antes do texto. Opcional, dá charme. */
  dot?: boolean;
  icon?: ReactNode;
}

const STYLES: Record<Variant, { bg: string; fg: string }> = {
  gold:    { bg: "var(--warning-soft)", fg: "var(--brand-gold-700)" },
  success: { bg: "var(--success-soft)", fg: "var(--success)" },
  danger:  { bg: "var(--danger-soft)",  fg: "var(--danger)" },
  info:    { bg: "var(--info-soft)",    fg: "var(--info)" },
  neutral: { bg: "var(--bg-2)",         fg: "var(--fg-3-admin)" },
};

export default function Pill({ children, variant = "neutral", dot, icon }: Props) {
  const s = STYLES[variant];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        borderRadius: "var(--r-pill)",
        fontSize: 12,
        fontWeight: 500,
        background: s.bg,
        color: s.fg,
        whiteSpace: "nowrap",
        lineHeight: 1.4,
      }}
    >
      {dot ? (
        <span
          aria-hidden
          style={{
            width: 6,
            height: 6,
            borderRadius: 9999,
            background: s.fg,
            flexShrink: 0,
          }}
        />
      ) : null}
      {icon}
      {children}
    </span>
  );
}
