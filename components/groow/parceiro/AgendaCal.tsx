"use client";

import { useEffect, useRef } from "react";

/**
 * Calendario do Cal.com dentro da nossa pagina, ja preenchido.
 *
 * A pessoa acabou de digitar nome, telefone, empresa e cidade no nosso
 * formulario. Nao faz sentido pedir tudo de novo do outro lado: aqui os campos
 * chegam prontos e ela so escolhe o horario.
 *
 * O trecho SNIPPET abaixo e o loader oficial do Cal, colado sem alterar uma
 * virgula. Nao e preguica: o embed.js NAO cria window.Cal sozinho, ele espera a
 * fila ja existir e a consome. Testado: carregar o embed.js e esperar o onload
 * deixa window.Cal undefined e o calendario nunca monta.
 *
 * Tambem evita @calcom/embed-react, que exigiria npm install (neste projeto
 * trava com o ERESOLVE do eslint).
 */

type Prefill = Record<string, string | undefined | null>;

const SNIPPET = `(function (C, A, L) { let p = function (a, ar) { a.q.push(ar); }; let d = C.document; C.Cal = C.Cal || function () { let cal = C.Cal; let ar = arguments; if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; d.head.appendChild(d.createElement("script")).src = A; cal.loaded = true; } if (ar[0] === L) { const api = function () { p(api, arguments); }; const namespace = ar[1]; api.q = api.q || []; if (typeof namespace === "string") { cal.ns[namespace] = cal.ns[namespace] || api; p(cal.ns[namespace], ar); p(cal, ["initNamespace", namespace]); } else p(cal, ar); return; } p(cal, ar); }; })(window, "https://app.cal.com/embed/embed.js", "init");`;

const NS = "ed-agenda";

declare global {
  interface Window {
    Cal?: ((...args: unknown[]) => void) & {
      ns?: Record<string, (...args: unknown[]) => void>;
    };
  }
}

export default function AgendaCal({
  calLink,
  prefill,
  tema = "dark",
  altura = 640,
}: {
  /** "enderecodigital/diagnostico", sem dominio */
  calLink: string;
  prefill?: Prefill;
  tema?: "dark" | "light";
  altura?: number;
}) {
  const alvo = useRef<HTMLDivElement>(null);
  // O embed monta uma vez. Sem isto, cada re-render do pai empilha calendario.
  const montado = useRef(false);

  useEffect(() => {
    if (montado.current || !alvo.current) return;
    montado.current = true;
    const elemento = alvo.current;

    if (!window.Cal) {
      const tag = document.createElement("script");
      tag.textContent = SNIPPET;
      document.head.appendChild(tag);
    }
    const Cal = window.Cal;
    if (!Cal) return;

    // Campo vazio nao pode ir: o Cal trata string vazia como resposta dada, e o
    // campo trava vazio quando esta marcado como "desativar se preenchido".
    const config: Record<string, string> = { layout: "month_view", theme: tema };
    for (const [k, v] of Object.entries(prefill || {})) {
      const s = String(v ?? "").trim();
      if (s) config[k] = s;
    }

    Cal("init", NS, { origin: "https://app.cal.com" });
    const ns = Cal.ns?.[NS];
    if (!ns) return;
    ns("inline", { elementOrSelector: elemento, calLink, config });
    ns("ui", {
      theme: tema,
      hideEventTypeDetails: false,
      cssVarsPerTheme: {
        dark: { "cal-brand": "#C9A961" },
        light: { "cal-brand": "#0B1838" },
      },
    });
  }, [calLink, prefill, tema]);

  return (
    <div
      ref={alvo}
      // O embed cresce sozinho conforme a etapa. A altura minima segura o layout
      // enquanto ele carrega, para a pagina nao dar pulo.
      style={{ width: "100%", minHeight: altura, overflow: "hidden" }}
      aria-label="Escolha um horário"
    />
  );
}
