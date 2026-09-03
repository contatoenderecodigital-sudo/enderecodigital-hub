// Icones do modulo de restaurante, no mesmo estilo dos do hub (stroke, sem emoji).
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...p,
});

export const IcoMesa = (p: P) => (
  <svg {...base(p)}><path d="M3 10h18" /><path d="M5 10v9" /><path d="M19 10v9" /><path d="M7 10V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v4" /></svg>
);
export const IcoCardapio = (p: P) => (
  <svg {...base(p)}><path d="M4 4h16v16H4z" /><path d="M8 8h8" /><path d="M8 12h8" /><path d="M8 16h5" /></svg>
);
export const IcoPanela = (p: P) => (
  <svg {...base(p)}><path d="M4 9h16v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9z" /><path d="M4 9 2 7" /><path d="m20 9 2-2" /><path d="M9 5V3" /><path d="M15 5V3" /><path d="M12 5V3" /></svg>
);
export const IcoMoto = (p: P) => (
  <svg {...base(p)}><circle cx="5.5" cy="17" r="3" /><circle cx="18.5" cy="17" r="3" /><path d="M8.5 17h7l-3-7H9" /><path d="M15 10h3l1.5 4" /><path d="M6 7h4" /></svg>
);
export const IcoCaixa = (p: P) => (
  <svg {...base(p)}><rect x="3" y="8" width="18" height="12" rx="2" /><path d="M7 8V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3" /><path d="M12 12v4" /><path d="M10 14h4" /></svg>
);
export const IcoEstoque = (p: P) => (
  <svg {...base(p)}><path d="M3 7 12 3l9 4-9 4-9-4z" /><path d="M3 12l9 4 9-4" /><path d="M3 17l9 4 9-4" /></svg>
);
export const IcoImpressora = (p: P) => (
  <svg {...base(p)}><path d="M6 9V3h12v6" /><rect x="3" y="9" width="18" height="7" rx="2" /><path d="M6 14h12v7H6z" /></svg>
);
export const IcoNfc = (p: P) => (
  <svg {...base(p)}><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M8 12a4 4 0 0 1 4-4" /><path d="M8 16a8 8 0 0 1 8-8" /><circle cx="8" cy="8" r="1" /></svg>
);
export const IcoSino = (p: P) => (
  <svg {...base(p)}><path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" /><path d="M10.5 20a2 2 0 0 0 3 0" /></svg>
);
export const IcoRelogio = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);
export const IcoFoto = (p: P) => (
  <svg {...base(p)}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m4 17 5-4 4 3 3-2 4 3" /></svg>
);
export const IcoCheck = (p: P) => (
  <svg {...base(p)}><path d="m4 12 5 5L20 6" /></svg>
);
export const IcoCopiar = (p: P) => (
  <svg {...base(p)}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
);
export const IcoSetaCima = (p: P) => (
  <svg {...base(p)}><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></svg>
);
export const IcoSetaBaixo = (p: P) => (
  <svg {...base(p)}><path d="M12 5v14" /><path d="m19 12-7 7-7-7" /></svg>
);
export const IcoPessoas = (p: P) => (
  <svg {...base(p)}><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M16 5.5a3 3 0 0 1 0 5.5" /><path d="M18 20a5 5 0 0 0-3-4.6" /></svg>
);
