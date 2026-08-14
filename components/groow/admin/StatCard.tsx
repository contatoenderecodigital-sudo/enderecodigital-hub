import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Props {
  label: string;
  value: string;
  icon: LucideIcon;
  delta?: number;
  deltaLabel?: string;
  deltaFormat?: "absolute" | "currency";
  accentColor?: "gold" | "navy" | "emerald" | "purple";
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const ACCENT_STYLES = {
  gold: "bg-gold/15 text-gold",
  navy: "bg-navy/10 text-navy",
  emerald: "bg-emerald-50 text-emerald-600",
  purple: "bg-purple-50 text-purple-600",
} as const;

export default function StatCard({
  label,
  value,
  icon: Icon,
  delta,
  deltaLabel,
  deltaFormat = "absolute",
  accentColor = "gold",
}: Props) {
  const hasDelta = typeof delta === "number";
  const positive = (delta ?? 0) > 0;
  const negative = (delta ?? 0) < 0;
  const neutral = (delta ?? 0) === 0;
  const deltaText = hasDelta
    ? deltaFormat === "currency"
      ? brl.format(Math.abs(delta!))
      : Math.abs(delta!).toString()
    : "";

  return (
    <div className="group rounded-xl border border-zinc-200/70 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-zinc-200">
      <div className="flex items-start justify-between mb-5">
        <p className="text-[11px] font-semibold tracking-[0.12em] text-zinc-500 uppercase">
          {label}
        </p>
        <span className={`grid place-items-center h-9 w-9 rounded-lg shrink-0 ${ACCENT_STYLES[accentColor]}`}>
          <Icon size={16} strokeWidth={2} aria-hidden="true" />
        </span>
      </div>

      <p className="font-display font-bold text-navy text-[36px] md:text-[40px] tracking-tight leading-none tabular-nums">
        {value}
      </p>

      {hasDelta ? (
        <div className="mt-4 flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums ${
              positive
                ? "bg-emerald-50 text-emerald-700"
                : negative
                ? "bg-red-50 text-red-600"
                : "bg-zinc-100 text-zinc-500"
            }`}
          >
            {positive ? <ArrowUpRight size={11} strokeWidth={2.5} /> : negative ? <ArrowDownRight size={11} strokeWidth={2.5} /> : <Minus size={11} strokeWidth={2.5} />}
            {!neutral ? (positive ? "+" : "-") : ""}{deltaText || "0"}
          </span>
          <span className="text-xs text-zinc-500">
            {deltaLabel || "vs mês passado"}
          </span>
        </div>
      ) : null}
    </div>
  );
}
