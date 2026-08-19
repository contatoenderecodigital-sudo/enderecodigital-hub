import Link from "next/link";
import { ArrowUpRight, MessageCircle, ListChecks, Sparkles } from "lucide-react";
import type { TaskItem } from "@/lib/groow/queries";
import EmptyState from "./EmptyState";

function waLink(num: string) {
  const digits = num.replace(/\D/g, "");
  return `https://wa.me/${digits.startsWith("55") ? digits : `55${digits}`}`;
}

const STYLES: Record<TaskItem["prioridade"], { wrap: string; dot: string; label: string }> = {
  alta: {
    wrap: "border-red-500/25 bg-red-50/60",
    dot: "bg-red-500",
    label: "text-red-700",
  },
  media: {
    wrap: "border-gold/30 bg-gold/5",
    dot: "bg-gold",
    label: "text-navy",
  },
  baixa: {
    wrap: "border-navy/10 bg-cream/40",
    dot: "bg-navy/30",
    label: "text-ink",
  },
};

export default function TaskList({ tasks }: { tasks: TaskItem[] }) {
  return (
    <div className="rounded-xl border border-zinc-200/70 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <span className="grid place-items-center h-8 w-8 rounded-lg bg-gold/15 text-gold">
            <ListChecks size={14} aria-hidden="true" />
          </span>
          <h3 className="font-display font-semibold text-navy text-lg">Tarefas do dia</h3>
        </div>
        <span className="text-xs text-ink/55">
          {tasks.length} pendente{tasks.length === 1 ? "" : "s"}
        </span>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Inbox zero"
          description="Sem tarefas urgentes hoje. Bom dia pra você."
        />
      ) : (
        <ul className="space-y-2.5">
          {tasks.slice(0, 8).map((t) => {
            const s = STYLES[t.prioridade];
            return (
              <li
                key={t.id}
                className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 ${s.wrap}`}
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <span className={`h-2 w-2 mt-1.5 rounded-full shrink-0 ${s.dot}`} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium leading-snug ${s.label}`}>{t.titulo}</p>
                    {t.detalhe ? (
                      <p className="text-xs text-ink/55 mt-0.5">{t.detalhe}</p>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {t.whatsapp ? (
                    <a
                      href={waLink(t.whatsapp)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="grid place-items-center h-8 w-8 rounded-lg bg-white border border-navy/10 text-emerald-700 hover:border-emerald-300 transition-colors"
                      title="Abrir WhatsApp"
                    >
                      <MessageCircle size={13} aria-hidden="true" />
                    </a>
                  ) : null}
                  {t.href ? (
                    <Link
                      href={t.href}
                      className="grid place-items-center h-8 w-8 rounded-lg bg-white border border-navy/10 text-navy hover:border-gold/40 transition-colors"
                      title="Abrir"
                    >
                      <ArrowUpRight size={13} aria-hidden="true" />
                    </Link>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
