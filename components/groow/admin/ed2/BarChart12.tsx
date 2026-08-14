"use client";

import { useMemo, useState } from "react";

export interface BarPoint {
  /** ex. "Mai" */
  label: string;
  /** valor numérico */
  value: number;
  /** ex. "Mai/26" pra tooltip */
  fullLabel?: string;
}

interface BarChart12Props {
  data: BarPoint[];
  /** índice do ponto considerado "atual" (recebe pill "Atual"). -1 desliga. */
  currentIndex?: number;
  /** Linha pontilhada de média. Se omitido, calcula. */
  avg?: number;
  height?: number;
  /** Formatador do valor pra tooltip. */
  formatValue?: (v: number) => string;
}

/**
 * Bar chart 12 meses do design Financeiro:
 * eixo de média pontilhado, hover com tooltip navy, "Atual" pill no último.
 * SVG nativo, sem libs.
 */
export default function BarChart12({
  data,
  currentIndex = -1,
  avg,
  height = 240,
  formatValue = (v) => v.toLocaleString("pt-BR"),
}: BarChart12Props) {
  const [hover, setHover] = useState<number | null>(null);

  const { max, min, total, computedAvg } = useMemo(() => {
    const vals = data.map((d) => d.value);
    const max = Math.max(1, ...vals);
    const min = Math.min(...vals);
    const total = vals.reduce((s, v) => s + v, 0);
    const computedAvg = vals.length ? total / vals.length : 0;
    return { max, min, total, computedAvg };
  }, [data]);

  const avgValue = avg ?? computedAvg;
  const CHART_H = height - 24; // padding pra eixo
  const avgPx = max > 0 ? (avgValue / max) * (CHART_H - 16) : 0;

  return (
    <div style={{ position: "relative", height, marginTop: 8 }}>
      {/* linha de média pontilhada - só quando há média relevante (evita "R$ 0k" colado no rodapé) */}
      {avgValue >= 500 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 24 + avgPx,
            borderTop: "1px dashed var(--ed2-ink-3)",
            opacity: 0.7,
          }}
        >
          <span
            style={{
              position: "absolute",
              left: 0,
              top: -18,
              fontSize: 11,
              color: "var(--ed2-ink-2)",
              fontWeight: 500,
              background: "var(--ed2-card)",
              padding: "0 6px",
              zIndex: 2,
            }}
          >
            média · R$ {Math.round(avgValue / 1000)}k
          </span>
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          height: "100%",
          gap: 10,
          paddingBottom: 24,
        }}
      >
        {data.map((d, i) => {
          const h = max > 0 ? Math.round((d.value / max) * (CHART_H - 16)) : 0;
          const isCurrent = i === currentIndex;
          const t = max === min ? 1 : (d.value - min) / (max - min);
          const op = isCurrent ? 1 : Math.max(0.3, 0.3 + t * 0.7);
          return (
            <div
              key={`${d.label}-${i}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover((h) => (h === i ? null : h))}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
                position: "relative",
              }}
            >
              {isCurrent && (
                <span
                  style={{
                    position: "absolute",
                    top: -22,
                    left: "50%",
                    transform: "translateX(-50%)",
                    padding: "2px 8px",
                    borderRadius: 99,
                    background: "rgba(201,169,97,0.16)",
                    color: "#8a712d",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                  }}
                >
                  Atual
                </span>
              )}
              <div
                style={{
                  width: "100%",
                  maxWidth: 46,
                  height: Math.max(2, h),
                  borderRadius: "8px 8px 0 0",
                  background: "linear-gradient(180deg,#C9A961,#a8893d)",
                  opacity: op,
                  transition: "all .2s ease",
                  boxShadow: isCurrent
                    ? "0 0 0 1.5px rgba(201,169,97,0.55), 0 4px 12px rgba(201,169,97,0.25)"
                    : "none",
                }}
              />
              <div
                style={{
                  fontSize: 11,
                  color: isCurrent ? "#8a712d" : "var(--ed2-ink-2)",
                  fontWeight: isCurrent ? 700 : 500,
                  letterSpacing: "0.02em",
                }}
              >
                {d.label}
              </div>

              {hover === i && total > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: -72,
                    left: "50%",
                    transform: "translateX(-50%)",
                    padding: "10px 14px",
                    borderRadius: 14,
                    background: "var(--ed2-accent)",
                    color: "#fff",
                    fontSize: 12,
                    lineHeight: 1.4,
                    boxShadow: "0 6px 18px rgba(11,24,56,0.25)",
                    pointerEvents: "none",
                    whiteSpace: "nowrap",
                    zIndex: 5,
                  }}
                >
                  {d.fullLabel ?? d.label}
                  <b
                    style={{
                      display: "block",
                      fontSize: 14,
                      fontWeight: 600,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    R$ {formatValue(d.value)}
                  </b>
                  <span style={{ color: "#C9A961" }}>
                    {Math.round((d.value / total) * 1000) / 10}% do total
                  </span>
                  <span
                    style={{
                      content: "",
                      position: "absolute",
                      left: "50%",
                      bottom: -5,
                      transform: "translateX(-50%) rotate(45deg)",
                      width: 10,
                      height: 10,
                      background: "var(--ed2-accent)",
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
