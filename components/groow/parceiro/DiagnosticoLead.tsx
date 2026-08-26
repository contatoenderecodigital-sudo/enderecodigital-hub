"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ClipboardList } from "lucide-react";
import {
  CAMPO_PALAVRAS_DELA,
  PERGUNTAS_DIAGNOSTICO,
  type ParceiroLead,
} from "@/lib/groow/parceiros-etapas";

/**
 * As 7 perguntas que o parceiro faz enquanto conversa, mais o campo livre.
 *
 * Salva sozinho ao sair do campo, e nao num botao no fim: quem preenche isto
 * esta com alguem na linha, e vai fechar a aba sem clicar em salvar.
 */
export default function DiagnosticoLead({ lead }: { lead: ParceiroLead }) {
  const [respostas, setRespostas] = useState<Record<string, string>>(lead.diagnostico || {});
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Guarda o que ja foi pro servidor, para nao salvar de novo em cada blur.
  const enviado = useRef<string>(JSON.stringify(lead.diagnostico || {}));

  useEffect(() => {
    setRespostas(lead.diagnostico || {});
    enviado.current = JSON.stringify(lead.diagnostico || {});
  }, [lead.id, lead.diagnostico]);

  async function salvar(proximas: Record<string, string>) {
    const serial = JSON.stringify(proximas);
    if (serial === enviado.current) return;
    enviado.current = serial;
    setErro(null);
    try {
      const r = await fetch("/api/parceiro/leads/diagnostico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: lead.id, respostas: proximas }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setErro(d.error || "Não consegui salvar.");
        return;
      }
      setSalvo(true);
      setTimeout(() => setSalvo(false), 1800);
    } catch {
      setErro("Sem conexão. O que você digitou continua na tela.");
    }
  }

  function mudar(campo: string, valor: string) {
    setRespostas((r) => ({ ...r, [campo]: valor }));
  }

  const respondidas = PERGUNTAS_DIAGNOSTICO.filter((p) =>
    (respostas[p.campo] || "").trim()
  ).length;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ClipboardList size={15} style={{ color: "var(--ed2-ink-2)" }} />
          <strong style={{ fontSize: 14.5, color: "var(--ed2-ink)" }}>Diagnóstico</strong>
          <span style={{ fontSize: 12.5, color: "var(--ed2-ink-2)" }}>
            {respondidas} de {PERGUNTAS_DIAGNOSTICO.length}
          </span>
        </div>
        {salvo ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 12.5,
              color: "#1d8a3a",
            }}
          >
            <Check size={13} />
            salvo
          </span>
        ) : null}
      </div>

      <p style={{ margin: "0 0 16px", fontSize: 12.5, color: "var(--ed2-ink-2)", lineHeight: 1.55 }}>
        Preencha enquanto conversa. Salva sozinho, não precisa clicar em nada. O objetivo
        não é o dado, é ela se ouvir falando do problema.
      </p>

      {erro ? (
        <div
          style={{
            padding: "9px 13px",
            borderRadius: 11,
            background: "rgba(255,59,48,0.10)",
            color: "#c8261c",
            fontSize: 13,
            marginBottom: 12,
          }}
        >
          {erro}
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 14 }}>
        {PERGUNTAS_DIAGNOSTICO.map((p, i) => (
          <div key={p.campo}>
            <label
              htmlFor={`dg-${p.campo}`}
              style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--ed2-ink)" }}
            >
              <span style={{ color: "var(--ed2-ink-2)", fontWeight: 400 }}>{i + 1}. </span>
              {p.texto}
            </label>
            {p.ajuda ? (
              <div style={{ fontSize: 12, color: "var(--ed2-ink-2)", margin: "3px 0 6px" }}>
                {p.ajuda}
              </div>
            ) : (
              <div style={{ height: 6 }} />
            )}
            <input
              id={`dg-${p.campo}`}
              value={respostas[p.campo] ?? ""}
              onChange={(e) => mudar(p.campo, e.target.value)}
              onBlur={() => salvar(respostas)}
              style={campo}
            />
          </div>
        ))}

        <div style={{ paddingTop: 4 }}>
          <label
            htmlFor={`dg-${CAMPO_PALAVRAS_DELA.campo}`}
            style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--ed2-ink)" }}
          >
            {CAMPO_PALAVRAS_DELA.label}
          </label>
          <div style={{ fontSize: 12, color: "var(--ed2-ink-2)", margin: "3px 0 6px" }}>
            {CAMPO_PALAVRAS_DELA.ajuda}
          </div>
          <textarea
            id={`dg-${CAMPO_PALAVRAS_DELA.campo}`}
            rows={4}
            value={respostas[CAMPO_PALAVRAS_DELA.campo] ?? ""}
            onChange={(e) => mudar(CAMPO_PALAVRAS_DELA.campo, e.target.value)}
            onBlur={() => salvar(respostas)}
            style={{ ...campo, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
          />
        </div>
      </div>
    </div>
  );
}

const campo: React.CSSProperties = {
  width: "100%",
  padding: "10px 13px",
  borderRadius: 11,
  border: "1px solid var(--ed2-hair)",
  background: "var(--ed2-surface)",
  color: "var(--ed2-ink)",
  fontSize: 14,
  outline: "none",
};
