import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  /** Valor numérico já formatado (sem prefixo "R$"). */
  value: string;
  /** Prefixo opcional renderizado sobrescrito (ex. "R$"). */
  currency?: string;
  /** Pill: trend de variação. */
  pill?: {
    text: string;
    tone: "up" | "down" | "gold" | "neutral";
  } | null;
  desc?: ReactNode;
  /** SVG decorativo opcional no canto inferior direito. */
  spark?: ReactNode;
}

const TONE_BG: Record<string, string> = {
  up: "rgba(52,199,89,0.14)",
  down: "rgba(255,59,48,0.14)",
  gold: "rgba(201,169,97,0.12)",
  neutral: "var(--ed2-surface)",
};
const TONE_FG: Record<string, string> = {
  up: "#1d8a3a",
  down: "#c8261c",
  gold: "#8a712d",
  neutral: "var(--ed2-ink-2)",
};

export default function StatCard({ label, value, currency, pill, desc, spark }: StatCardProps) {
  return (
    <div
      style={{
        background: "var(--ed2-card)",
        borderRadius: 24,
        padding: "22px 24px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        position: "relative",
        overflow: "hidden",
        minHeight: 138,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--ed2-ink-2)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 30,
          fontWeight: 600,
          letterSpacing: "-0.03em",
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1.1,
          color: "var(--ed2-ink)",
        }}
      >
        {currency ? (
          <span
            style={{
              fontSize: 18,
              color: "var(--ed2-ink-2)",
              fontWeight: 500,
              marginRight: 3,
              verticalAlign: "0.2em",
            }}
          >
            {currency}
          </span>
        ) : null}
        {value}
      </div>
      {pill ? (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "4px 10px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 600,
            alignSelf: "flex-start",
            background: TONE_BG[pill.tone],
            color: TONE_FG[pill.tone],
          }}
        >
          {pill.text}
        </span>
      ) : null}
      {desc ? <div style={{ fontSize: 12, color: "var(--ed2-ink-2)" }}>{desc}</div> : null}
      {spark ? (
        <div style={{ position: "absolute", right: 18, bottom: 16, opacity: 0.5 }}>{spark}</div>
      ) : null}
    </div>
  );
}
