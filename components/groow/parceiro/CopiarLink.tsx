"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export default function CopiarLink({ link }: { link: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // clipboard bloqueado (http, permissão): o input abaixo continua selecionável
    }
  }

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <input
        readOnly
        value={link}
        onFocus={(e) => e.currentTarget.select()}
        style={{
          flex: "1 1 320px",
          minWidth: 0,
          padding: "13px 16px",
          borderRadius: 14,
          border: "1px solid var(--ed2-hair)",
          background: "var(--ed2-surface)",
          color: "var(--ed2-ink)",
          fontSize: 15,
          fontFamily: "var(--font-mono), monospace",
        }}
      />
      <button
        onClick={copiar}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "13px 22px",
          borderRadius: 999,
          border: "none",
          background: copiado ? "#1d8a3a" : "#C9A961",
          color: copiado ? "#fff" : "#0B1838",
          fontWeight: 700,
          fontSize: 14.5,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {copiado ? <Check size={16} /> : <Copy size={16} />}
        {copiado ? "Copiado" : "Copiar link"}
      </button>
    </div>
  );
}
