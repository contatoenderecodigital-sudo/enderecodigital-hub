import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  sub?: ReactNode;
  right?: ReactNode;
}

export default function PageHeader({ title, sub, right }: PageHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 24,
        flexWrap: "wrap",
        marginBottom: 22,
      }}
    >
      <div>
        <h1
          style={{
            fontSize: 42,
            fontWeight: 700,
            letterSpacing: "-0.035em",
            margin: "0 0 6px",
            lineHeight: 1.05,
            color: "var(--ed2-ink)",
          }}
        >
          {title}
        </h1>
        {sub ? (
          <div style={{ color: "var(--ed2-ink-2)", fontSize: 15, letterSpacing: "-0.005em" }}>{sub}</div>
        ) : null}
      </div>
      {right ? <div style={{ display: "flex", gap: 10, alignItems: "center" }}>{right}</div> : null}
    </div>
  );
}
