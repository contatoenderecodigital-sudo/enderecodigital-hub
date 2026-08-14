"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import PeriodSelector, { rangeFromPreset, type PeriodRange } from "./PeriodSelector";

/**
 * Wrapper do PeriodSelector para páginas server-component:
 * atualiza ?preset=&from=&to= na URL e o servidor refaz a query.
 */
export default function PeriodNav({ defaultPreset = "tudo" }: { defaultPreset?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const preset = sp.get("preset") || defaultPreset;
  const from = sp.get("from");
  const to = sp.get("to");

  const value: PeriodRange =
    preset === "custom" && from && to
      ? { preset, from, to, label: `${from} - ${to}` }
      : rangeFromPreset(preset);

  const onChange = (r: PeriodRange) => {
    const params = new URLSearchParams();
    params.set("preset", r.preset);
    if (r.from) params.set("from", r.from);
    if (r.to) params.set("to", r.to);
    router.push(`${pathname}?${params}`);
  };

  return <PeriodSelector value={value} onChange={onChange} />;
}
