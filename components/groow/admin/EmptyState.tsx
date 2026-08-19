import type { LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export default function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="grid place-items-center py-12 px-6 text-center">
      <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-gold/15 to-gold/5 border border-gold/20 text-gold">
        <Icon size={22} strokeWidth={1.8} aria-hidden="true" />
      </div>
      <h3 className="font-display font-semibold text-navy text-base">{title}</h3>
      {description ? (
        <p className="text-sm text-ink/60 mt-2 max-w-sm">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
