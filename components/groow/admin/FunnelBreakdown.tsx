import { ChevronRight } from "lucide-react";
import type { FunilStage } from "@/lib/groow/queries";

interface Props {
  data: FunilStage[];
  title?: string;
}

export default function FunnelBreakdown({ data, title = "Funil de conversão" }: Props) {
  const total = data.reduce((acc, d) => acc + d.count, 0);
  const top = data[0]?.count ?? 0;

  return (
    <div className="rounded-xl border border-zinc-200/70 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="font-display font-semibold text-navy text-lg">{title}</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            {total} {total === 1 ? "lead" : "leads"} no funil
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-0">
        {data.map((stage, i) => {
          const prev = i > 0 ? data[i - 1].count : top;
          const conversion = prev > 0 ? (stage.count / prev) * 100 : 0;
          const isLast = i === data.length - 1;
          const isFirst = i === 0;

          return (
            <div
              key={stage.status}
              className={`relative ${i > 0 ? "md:pl-5" : ""}`}
            >
              {i > 0 ? (
                <div className="hidden md:flex absolute -left-2 top-7 items-center pointer-events-none">
                  <ChevronRight size={18} className="text-zinc-300" aria-hidden="true" />
                </div>
              ) : null}

              <div className="py-2">
                <p className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500 uppercase mb-2">
                  {stage.label}
                </p>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="font-display font-bold text-navy text-3xl tracking-tight tabular-nums">
                    {stage.count}
                  </span>
                  {!isFirst ? (
                    <span
                      className={`text-xs font-medium tabular-nums ${
                        conversion >= 50
                          ? "text-emerald-600"
                          : conversion >= 25
                          ? "text-amber-600"
                          : "text-red-500"
                      }`}
                    >
                      {conversion.toFixed(0)}%
                    </span>
                  ) : null}
                </div>
                <div className="h-1 rounded-full bg-zinc-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isLast ? "bg-gold" : "bg-navy/70"
                    }`}
                    style={{ width: `${top > 0 ? (stage.count / top) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-[10px] text-zinc-400 mt-2">
                  {isFirst ? "Entrada do funil" : `Conversão da etapa anterior`}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
