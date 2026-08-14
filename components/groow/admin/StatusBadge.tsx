import { LEAD_STATUS_LABEL, type LeadStatus } from "@/lib/groow/types";

const STYLE: Record<LeadStatus, string> = {
  novo: "bg-blue-50 text-blue-700 ring-blue-200",
  contatado: "bg-purple-50 text-purple-700 ring-purple-200",
  diagnostico: "bg-amber-50 text-amber-700 ring-amber-200",
  proposta: "bg-orange-50 text-orange-700 ring-orange-200",
  fechado: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  assinado: "bg-navy/10 text-navy ring-navy/20",
  perdido: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  recusado: "bg-red-50 text-red-700 ring-red-200",
  frio: "bg-sky-50 text-sky-700 ring-sky-200",
  quente: "bg-red-50 text-red-700 ring-red-200",
};

const DOT: Record<LeadStatus, string> = {
  novo: "bg-blue-500",
  contatado: "bg-purple-500",
  diagnostico: "bg-amber-500",
  proposta: "bg-orange-500",
  fechado: "bg-emerald-500",
  assinado: "bg-navy",
  perdido: "bg-zinc-400",
  recusado: "bg-red-500",
  frio: "bg-sky-500",
  quente: "bg-red-500",
};

export default function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLE[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[status]}`} />
      {LEAD_STATUS_LABEL[status]}
    </span>
  );
}
