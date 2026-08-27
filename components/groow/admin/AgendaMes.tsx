"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Mes compacto com as reunioes marcadas.
 *
 * Largura fixa de proposito. A primeira versao usava aspect-ratio 1/1 numa
 * grade que ocupava o card inteiro: cada dia virava um quadrado de 170px e a
 * tela ficava impossivel de ler. Calendario e um objeto pequeno, ele nao
 * acompanha a largura do container.
 *
 * Todo dia e clicavel, inclusive os vazios. Desabilitar os dias sem reuniao
 * fazia a maior parte da grade parecer quebrada.
 */

export interface ItemAgenda {
  cal_uid: string;
  reuniao_em: string;
  status: string;
}

const DIAS = ["D", "S", "T", "Q", "Q", "S", "S"];
const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** Chave local do dia. toISOString converteria para UTC e a reuniao das 21h
 *  cairia no dia seguinte. */
export function chaveDia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export default function AgendaMes({
  itens,
  diaSelecionado,
  onSelecionarDia,
}: {
  itens: ItemAgenda[];
  diaSelecionado: string | null;
  onSelecionarDia: (dia: string | null) => void;
}) {
  const hoje = new Date();
  // Abre no mes da proxima reuniao, nao no mes de hoje. Com as reunioes em
  // setembro e o calendario aberto em agosto, os unicos dias marcados eram as
  // casinhas apagadas da ultima semana, e a tela parecia vazia.
  const [cursor, setCursor] = useState(() => {
    const futuras = itens
      .map((i) => new Date(i.reuniao_em))
      .filter((d) => !Number.isNaN(d.getTime()) && d.getTime() >= hoje.getTime())
      .sort((a, b) => a.getTime() - b.getTime());
    const alvo = futuras[0] ?? hoje;
    return new Date(alvo.getFullYear(), alvo.getMonth(), 1);
  });

  const contagem = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of itens) {
      const d = new Date(i.reuniao_em);
      if (Number.isNaN(d.getTime())) continue;
      const k = chaveDia(d);
      m.set(k, (m.get(k) || 0) + 1);
    }
    return m;
  }, [itens]);

  const celulas = useMemo(() => {
    const primeiro = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const inicio = new Date(primeiro);
    inicio.setDate(1 - primeiro.getDay());
    // 6 semanas fixas: o calendario nao muda de altura ao trocar de mes, senao
    // a tela inteira pula a cada clique na seta.
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(inicio);
      d.setDate(inicio.getDate() + i);
      return d;
    });
  }, [cursor]);

  const chaveHoje = chaveDia(hoje);
  const mesAtual = cursor.getMonth();

  return (
    <div style={{ width: 296, flexShrink: 0 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--ed2-ink)" }}>
          {MESES[cursor.getMonth()]}{" "}
          <span style={{ color: "var(--ed2-ink-2)", fontWeight: 400 }}>{cursor.getFullYear()}</span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            style={seta}
            aria-label="Mês anterior"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            style={seta}
            aria-label="Próximo mês"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {DIAS.map((d, i) => (
          <div
            key={i}
            style={{
              height: 22,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10.5,
              fontWeight: 700,
              color: "var(--ed2-ink-2)",
            }}
          >
            {d}
          </div>
        ))}

        {celulas.map((d) => {
          const k = chaveDia(d);
          const doMes = d.getMonth() === mesAtual;
          const n = contagem.get(k) || 0;
          const ehHoje = k === chaveHoje;
          const escolhido = k === diaSelecionado;
          return (
            <button
              key={k}
              onClick={() => onSelecionarDia(escolhido ? null : k)}
              title={n ? `${n} reunião${n > 1 ? "ões" : ""}` : "Sem reunião"}
              style={{
                position: "relative",
                height: 36,
                borderRadius: 9,
                border: ehHoje && !escolhido ? "1px solid rgba(201,169,97,0.7)" : "1px solid transparent",
                background: escolhido ? "#0B1838" : n ? "rgba(201,169,97,0.18)" : "transparent",
                color: escolhido ? "#F5F2EA" : doMes ? "var(--ed2-ink)" : "var(--ed2-ink-2)",
                opacity: doMes ? 1 : n ? 0.7 : 0.28,
                fontSize: 13,
                fontWeight: n ? 700 : 400,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontVariantNumeric: "tabular-nums",
                padding: 0,
              }}
            >
              {d.getDate()}
              {n ? (
                <span
                  style={{
                    position: "absolute",
                    bottom: 4,
                    width: 4,
                    height: 4,
                    borderRadius: 999,
                    background: escolhido ? "#C9A961" : "#8a712d",
                  }}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          onClick={() => setCursor(new Date(hoje.getFullYear(), hoje.getMonth(), 1))}
          style={{ ...limpar, marginTop: 0 }}
        >
          hoje
        </button>
        {diaSelecionado ? (
          <button onClick={() => onSelecionarDia(null)} style={{ ...limpar, marginTop: 0 }}>
            ver todas
          </button>
        ) : null}
      </div>
    </div>
  );
}

const seta: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 26,
  height: 26,
  borderRadius: 999,
  border: "1px solid var(--ed2-hair)",
  background: "transparent",
  color: "var(--ed2-ink-2)",
  cursor: "pointer",
  padding: 0,
};

const limpar: React.CSSProperties = {
  marginTop: 12,
  width: "100%",
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid var(--ed2-hair)",
  background: "transparent",
  color: "var(--ed2-ink-2)",
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
};
