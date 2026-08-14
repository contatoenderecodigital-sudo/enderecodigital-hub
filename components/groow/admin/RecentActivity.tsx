import { UserPlus, CalendarCheck, MessageCircle, Briefcase } from "lucide-react";
import type { ActivityItem } from "@/lib/groow/queries";
import EmptyState from "./EmptyState";

const ICONS = {
  lead: UserPlus,
  agendamento: CalendarCheck,
  follow_up: MessageCircle,
  cliente: Briefcase,
} as const;

const ICON_STYLES = {
  lead: "bg-gold/15 text-gold",
  agendamento: "bg-emerald-50 text-emerald-700",
  follow_up: "bg-blue-50 text-blue-700",
  cliente: "bg-purple-50 text-purple-700",
} as const;

function timeAgo(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}m atrás`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h atrás`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d}d atrás`;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export default function RecentActivity({ items }: { items: ActivityItem[] }) {
  return (
    <div className="rounded-xl border border-zinc-200/70 bg-white shadow-sm flex flex-col h-full">
      <div className="flex items-center justify-between px-6 pt-5 pb-3">
        <h3 className="font-display font-semibold text-navy text-lg">Atividade recente</h3>
        <span className="text-xs text-ink/55">Esta semana</span>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="Nenhuma atividade ainda"
          description="Quando seu primeiro lead chegar, aparece aqui."
        />
      ) : (
        <ul className="flex-1 overflow-y-auto px-6 pb-5">
          {items.map((it) => {
            const Icon = ICONS[it.tipo] || UserPlus;
            const style = ICON_STYLES[it.tipo] || ICON_STYLES.lead;
            return (
              <li key={it.id} className="py-3 flex items-start gap-3 border-b border-navy/5 last:border-0">
                <span className={`grid place-items-center h-9 w-9 rounded-full shrink-0 ${style}`}>
                  <Icon size={14} strokeWidth={2} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-navy truncate">{it.titulo}</p>
                  <p className="text-xs text-ink/60 truncate">{it.descricao}</p>
                </div>
                <span className="text-[10px] text-ink/45 tabular-nums shrink-0 pt-1">
                  {timeAgo(it.timestamp)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
