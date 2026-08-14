"use client";

/**
 * Tema dos gráficos do admin (Recharts) - coerente com o design system ed2
 * e com o modo escuro (classe .ed2-dark no <html>).
 *
 * As paletas categóricas foram VALIDADAS (contraste, faixa de luminosidade,
 * separação para daltonismo) com o validador do skill de dataviz - não são
 * escolhidas no olho. Ordem por entidade: blue, gold, purple, green, red.
 * Verde e vermelho não são adjacentes; a única aproximação (red↔green) é
 * aceitável porque todo gráfico categórico aqui traz rótulo + valor ao lado
 * de cada cor (codificação secundária).
 */
import { useEffect, useState } from "react";

export const CATEGORICAL_LIGHT = ["#0A84FF", "#B8954A", "#AF52DE", "#1d8a3a", "#c8261c"];
export const CATEGORICAL_DARK = ["#3E93EC", "#B0862F", "#A870DE", "#2BA24C", "#E05548"];

export interface ChartTheme {
  dark: boolean;
  /** paleta categórica na ordem por entidade */
  categorical: string[];
  /** hue única para séries de magnitude (área/linha) */
  gold: string;
  goldSoft: string;
  green: string;
  red: string;
  blue: string;
  /** cores de chrome do gráfico */
  axis: string;
  grid: string;
  ink: string;
  ink2: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipShadow: string;
  surface: string;
}

function build(dark: boolean): ChartTheme {
  return dark
    ? {
        dark,
        categorical: CATEGORICAL_DARK,
        gold: "#D4B36A",
        goldSoft: "rgba(212,179,106,0.16)",
        green: "#3FBF63",
        red: "#F2665A",
        blue: "#4DA3FF",
        axis: "#5E6F92",
        grid: "rgba(255,255,255,0.08)",
        ink: "#F5F2EA",
        ink2: "#9DAFCE",
        tooltipBg: "#14264F",
        tooltipBorder: "rgba(255,255,255,0.12)",
        tooltipShadow: "0 8px 22px rgba(0,0,0,0.55)",
        surface: "#0A1428",
      }
    : {
        dark,
        categorical: CATEGORICAL_LIGHT,
        gold: "#B8954A",
        goldSoft: "rgba(201,169,97,0.14)",
        green: "#1d8a3a",
        red: "#c8261c",
        blue: "#0A84FF",
        axis: "#8E8E93",
        grid: "rgba(0,0,0,0.06)",
        ink: "#0B1838",
        ink2: "#6B6557",
        tooltipBg: "#FFFFFF",
        tooltipBorder: "rgba(0,0,0,0.08)",
        tooltipShadow: "0 8px 22px rgba(0,0,0,0.12)",
        surface: "#FFFFFF",
      };
}

/** Detecta o modo (claro/escuro) e reage ao toggle em tempo real. */
export function useChartTheme(): ChartTheme {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const el = document.documentElement;
    const read = () => setDark(el.classList.contains("ed2-dark"));
    read();
    const obs = new MutationObserver(read);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  return build(dark);
}

// Formatadores pt-BR reutilizáveis
export const brl0 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
export const num = new Intl.NumberFormat("pt-BR");

/** "R$ 12.500" curto para eixos (12,5 mil / 1,2 mi). */
export function brlAxis(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}mi`;
  if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}mil`;
  return `R$ ${num.format(v)}`;
}
