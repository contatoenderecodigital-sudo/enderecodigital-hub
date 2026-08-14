interface DonutSlice {
  label: string;
  sub?: string;
  value: number;
  color: string;
}

interface DonutProps {
  slices: DonutSlice[];
  /** label central da porcentagem (ex. "68%") - se omitido, usa maior fatia */
  centerValue?: string;
  centerLabel?: string;
  size?: number;
  formatValue?: (v: number) => string;
}

const R = 78;
const C = 2 * Math.PI * R; // circunferência

export default function Donut({
  slices,
  centerValue,
  centerLabel,
  size = 200,
  formatValue = (v) => `R$ ${v.toLocaleString("pt-BR")}`,
}: DonutProps) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const biggest = slices.reduce((a, b) => (b.value > a.value ? b : a), slices[0]);
  const showCenter = centerValue ?? (total > 0 && biggest ? `${Math.round((biggest.value / total) * 100)}%` : "0%");
  const showCenterLabel = centerLabel ?? (biggest?.label ?? "");

  let offset = 0;
  const segments = slices.map((s) => {
    const len = total > 0 ? (s.value / total) * C : 0;
    const seg = {
      color: s.color,
      dashArray: `${len} ${C - len}`,
      dashOffset: -offset,
    };
    offset += len;
    return seg;
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 28, padding: "10px 0 4px", flexWrap: "wrap" }}>
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        <svg viewBox="0 0 200 200" width={size} height={size}>
          <circle cx="100" cy="100" r={R} fill="none" stroke="var(--ed2-surface)" strokeWidth="20" />
          <g transform="rotate(-90 100 100)">
            {segments.map((seg, i) => (
              <circle
                key={i}
                cx="100"
                cy="100"
                r={R}
                fill="none"
                stroke={seg.color}
                strokeWidth="20"
                strokeDasharray={seg.dashArray}
                strokeDashoffset={seg.dashOffset}
                strokeLinecap="butt"
              />
            ))}
          </g>
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontSize: 30,
              fontWeight: 600,
              letterSpacing: "-0.03em",
              fontVariantNumeric: "tabular-nums",
              color: "var(--ed2-ink)",
            }}
          >
            {showCenter}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--ed2-ink-2)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            {showCenterLabel}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
        {slices.map((s) => {
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
          return (
            <div
              key={s.label}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <span
                  aria-hidden
                  style={{ width: 10, height: 10, borderRadius: 99, background: s.color, flexShrink: 0 }}
                />
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: "var(--ed2-ink)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {s.label}
                  </div>
                  {s.sub ? <div style={{ fontSize: 12, color: "var(--ed2-ink-2)", marginTop: 1 }}>{s.sub}</div> : null}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    fontVariantNumeric: "tabular-nums",
                    letterSpacing: "-0.015em",
                    color: "var(--ed2-ink)",
                  }}
                >
                  {formatValue(s.value)}
                </div>
                <div style={{ fontSize: 11, color: "var(--ed2-ink-2)", fontWeight: 600 }}>{pct}%</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
