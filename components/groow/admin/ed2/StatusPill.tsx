export type PaymentStatus = "pago" | "proximo" | "atrasado";

const STYLES: Record<PaymentStatus, { bg: string; fg: string; dot: string; label: string }> = {
  pago: {
    bg: "rgba(52,199,89,0.14)",
    fg: "#1d8a3a",
    dot: "#34C759",
    label: "Pago",
  },
  proximo: {
    bg: "rgba(255,159,10,0.14)",
    fg: "#a85f00",
    dot: "#FF9F0A",
    label: "Próximo",
  },
  atrasado: {
    bg: "rgba(255,59,48,0.14)",
    fg: "#c8261c",
    dot: "#FF3B30",
    label: "Atrasado",
  },
};

export default function StatusPill({ status }: { status: PaymentStatus }) {
  const s = STYLES[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 9px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        background: s.bg,
        color: s.fg,
      }}
    >
      <span aria-hidden style={{ width: 6, height: 6, borderRadius: 99, background: s.dot }} />
      {s.label}
    </span>
  );
}

export type PlanType = "retainer" | "setup" | "avulso";
const PLAN_STYLES: Record<PlanType, { bg: string; fg: string; label: string }> = {
  retainer: { bg: "rgba(201,169,97,0.12)", fg: "#8a712d", label: "Retainer" },
  setup: { bg: "rgba(10,132,255,0.12)", fg: "#0a5cc4", label: "Setup+Retainer" },
  avulso: { bg: "var(--ed2-surface)", fg: "var(--ed2-ink)", label: "Avulso" },
};

export function PlanPill({ plan }: { plan: PlanType }) {
  const s = PLAN_STYLES[plan];
  return (
    <span
      style={{
        display: "inline-flex",
        padding: "3px 9px",
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 600,
        background: s.bg,
        color: s.fg,
      }}
    >
      {s.label}
    </span>
  );
}
