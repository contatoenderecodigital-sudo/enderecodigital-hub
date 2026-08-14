import type { Config } from "tailwindcss";
import headlessui from "@headlessui/tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  content: [
    "./app/operacao/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/groow/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    transparent: "transparent",
    current: "currentColor",
    extend: {
      colors: {
        // ── shadcn/ui tokens (dirigidos por CSS vars; dark sob .ed2-dark) ──
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        navy: {
          DEFAULT: "#0B1838",
          deep: "#070F26",
          soft: "#152448",
        },
        gold: {
          DEFAULT: "#C9A961",
          soft: "#D9BE7E",
          dim: "#8C7440",
          ink: "#846628", // dourado com contraste AA pra texto pequeno em fundo claro
        },
        cream: {
          DEFAULT: "#F5F2EA",
          dark: "#EDE8DA",
        },
        ink: {
          DEFAULT: "#2A3344",
          soft: "#4A5365",
          mute: "#8A93A4",
        },
        positive: "#10B981",
        negative: "#EF4444",
        fg: {
          1: "rgba(11,24,56,0.4)",
          2: "rgba(11,24,56,0.6)",
          3: "rgba(11,24,56,0.8)",
          4: "rgba(11,24,56,1)",
        },
        "bg-a": {
          1: "rgba(11,24,56,0.03)",
          2: "rgba(11,24,56,0.06)",
          3: "rgba(11,24,56,0.09)",
        },
        // Tremor base palette mapping (light mode)
        tremor: {
          brand: {
            faint: "#F5F2EA",
            muted: "#D9BE7E",
            subtle: "#C9A961",
            DEFAULT: "#C9A961",
            emphasis: "#8C7440",
            inverted: "#FFFFFF",
          },
          background: {
            muted: "#F5F5F0",
            subtle: "#F5F2EA",
            DEFAULT: "#FFFFFF",
            emphasis: "#0B1838",
          },
          border: { DEFAULT: "#E5E5E5" },
          ring: { DEFAULT: "#E5E5E5" },
          content: {
            subtle: "#8A93A4",
            DEFAULT: "#4A5365",
            emphasis: "#2A3344",
            strong: "#0B1838",
            inverted: "#FFFFFF",
          },
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        tightest: "-0.04em",
        snug: "-0.02em",
        body: "-0.02em",
        label: "-0.035em",
      },
      scale: {
        99: "0.99",
      },
      boxShadow: {
        terminal: "0 30px 60px -20px rgba(0,0,0,0.55), 0 0 0 1px rgba(201,169,97,0.18)",
        gold: "0 10px 30px -10px rgba(201,169,97,0.45)",
        xs: "0 1px 2px rgba(11,24,56,0.04), 0 0 0 1px rgba(11,24,56,0.04)",
        "tremor-input": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        "tremor-card": "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
        "tremor-dropdown": "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
      },
      borderRadius: {
        "tremor-small": "0.375rem",
        "tremor-default": "0.5rem",
        "tremor-full": "9999px",
        // shadcn
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontSize: {
        "tremor-label": ["0.75rem", { lineHeight: "1rem" }],
        "tremor-default": ["0.875rem", { lineHeight: "1.25rem" }],
        "tremor-title": ["1.125rem", { lineHeight: "1.75rem" }],
        "tremor-metric": ["1.875rem", { lineHeight: "2.25rem" }],
      },
      keyframes: {
        blink: {
          "0%,49%": { opacity: "1" },
          "50%,100%": { opacity: "0" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        blink: "blink 1s steps(2, start) infinite",
        "fade-up": "fade-up 0.6s ease-out both",
      },
    },
  },
  safelist: [
    {
      pattern:
        /^(bg-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
      variants: ["hover", "ui-selected"],
    },
    {
      pattern:
        /^(text-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
      variants: ["hover", "ui-selected"],
    },
    {
      pattern:
        /^(border-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
      variants: ["hover", "ui-selected"],
    },
    {
      pattern:
        /^(ring-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
    },
    {
      pattern:
        /^(stroke-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
    },
    {
      pattern:
        /^(fill-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950))$/,
    },
  ],
  plugins: [headlessui, tailwindcssAnimate],
};
export default config;
