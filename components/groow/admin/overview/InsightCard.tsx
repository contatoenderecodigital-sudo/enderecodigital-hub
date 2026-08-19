// Card de insight com gradiente navy→dourado (marca), no espírito do card
// "Authorization rate" do print: número gigante + leitura em uma frase.
import { Lightbulb } from "lucide-react";

export default function InsightCard({
  pct,
  headline,
  body,
  progress,
}: {
  pct: string;
  headline: string;
  body: string;
  progress?: number; // 0..1 - barrinha decorativa inferior
}) {
  return (
    <div
      className="ed2-card"
      style={{
        position: "relative",
        overflow: "hidden",
        padding: "22px 24px",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(150deg, #0B1838 0%, #16264d 52%, #6d5a2b 108%, #C9A961 140%)",
        color: "#fff",
      }}
    >
      {/* brilhos */}
      <div style={{ position: "absolute", right: -70, bottom: -80, width: 260, height: 260, borderRadius: 999, background: "radial-gradient(circle, rgba(201,169,97,0.5), transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", left: -60, top: -70, width: 200, height: 200, borderRadius: 999, background: "radial-gradient(circle, rgba(255,255,255,0.1), transparent 70%)", pointerEvents: "none" }} />

      <div style={{ position: "relative", display: "flex", flexDirection: "column", flex: 1 }}>
        <span
          style={{
            alignSelf: "flex-start",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            fontWeight: 650,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            padding: "5px 10px",
            borderRadius: 99,
            background: "rgba(255,255,255,0.14)",
            border: "1px solid rgba(255,255,255,0.18)",
            backdropFilter: "blur(4px)",
          }}
        >
          <Lightbulb size={12} strokeWidth={2.2} aria-hidden /> Insight
        </span>

        <div className="ed2-tabular" style={{ fontSize: 52, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1, margin: "22px 0 10px" }}>
          {pct}
        </div>
        <div style={{ fontSize: 14.5, fontWeight: 650, letterSpacing: "-0.01em", marginBottom: 6 }}>{headline}</div>
        <p style={{ fontSize: 12.5, lineHeight: 1.55, color: "rgba(255,255,255,0.72)", margin: 0, flex: 1 }}>{body}</p>

        {typeof progress === "number" && (
          <div style={{ marginTop: 18, height: 4, borderRadius: 99, background: "rgba(255,255,255,0.18)" }}>
            <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, progress * 100))}%`, borderRadius: 99, background: "#fff" }} />
          </div>
        )}
      </div>
    </div>
  );
}
