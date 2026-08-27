"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Mes navegavel com as reunioes marcadas, para a aba Reunioes.
 *
 * A lista sozinha responde "o que vem depois", mas nao responde "como esta a
 * minha semana", que e a pergunta de quem vai encaixar mais uma call. Aqui o
 * dia com reuniao ganha um ponto e o numero, e clicar filtra a lista de baixo.
 */

export interface ItemAgenda {
  cal_uid: string;
  nome: string;
  empresa: string | null;
  reuniao_em: string;
  parceiro_nome: string | null;
  status: string;
}

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** Chave local do dia. Nao usa toISOString: aquilo converte para UTC e a
 *  reuniao das 21h cai no dia seguinte. */
function chaveDia(d: Date): string {
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
  const [cursor, setCursor] = useState(() => new Date(hoje.getFullYear(), hoje.getMonth(), 1));

  const porDia = useMemo(() => {
    const m = new Map<string, ItemAgenda[]>();
    for (const i of itens) {
      const d = new Date(i.reuniao_em);
      if (Number.isNaN(d.getTime())) continue;
      const k = chaveDia(d);
      const lista = m.get(k);
      if (lista) lista.push(i);
      else m.set(k, [i]);
    }
    return m;
  }, [itens]);

  const celulas = useMemo(() => {
    const primeiro = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const inicio = new Date(primeiro);
    inicio.setDate(1 - primeiro.getDay());
    // 6 semanas fixas: o mes nao muda de altura ao navegar, o que faria a tela
    // inteira pular de tamanho a cada clique na seta.
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(inicio);
      d.setDate(inicio.getDate() + i);
      return d;
    });
  }, [cursor]);

  const chaveHoje = chaveDia(hoje);
  const mesAtual = cursor.getMonth();

  function mover(delta: number) {
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ed2-ink)" }}>
          {MESES[cursor.getMonth()]}{" "}
          <span style={{ color: "var(--ed2-ink-2)", fontWeight: 400 }}>{cursor.getFullYear()}</span>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {diaSelecionado ? (
            <button onClick={() => onSelecionarDia(null)} style={botaoTexto}>
              ver o mês todo
            </button>
          ) : null}
          <button onClick={() => mover(-1)} style={seta} aria-label="Mês anterior">
            <ChevronLeft size={15} />
          </button>
          <button onClick={() => mover(1)} style={seta} aria-label="Próximo mês">
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {DIAS.map((d) => (
          <div
            key={d}
            style={{
              textAlign: "center",
              fontSize: 10.5,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--ed2-ink-2)",
              paddingBottom: 6,
            }}
          >
            {d}
          </div>
        ))}

        {celulas.map((d) => {
          const k = chaveDia(d);
          const doMes = d.getMonth() === mesAtual;
          const lista = porDia.get(k) || [];
          const ehHoje = k === chaveHoje;
          const escolhido = k === diaSelecionado;
          return (
            <button
              key={k}
              onClick={() => onSelecionarDia(escolhido ? null : k)}
              disabled={!lista.length}
              title={lista.length ? `${lista.length} reunião(ões)` : ""}
              style={{
                position: "relative",
                aspectRatio: "1 / 1",
                borderRadius: 11,
                border: ehHoje
                  ? "1px solid rgba(201,169,97,0.65)"
                  : "1px solid transparent",
                background: escolhido
                  ? "#C9A961"
                  : lista.length
                    ? "rgba(201,169,97,0.14)"
                    : "transparent",
                color: escolhido
                  ? "#0B1838"
                  : doMes
                    ? "var(--ed2-ink)"
                    : "var(--ed2-ink-2)",
                opacity: doMes ? 1 : 0.35,
                fontSize: 13.5,
                fontWeight: lista.length ? 700 : 400,
                cursor: lista.length ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {d.getDate()}
              {lista.length ? (
                <span
                  style={{
                    position: "absolute",
                    bottom: 5,
                    width: 4,
                    height: 4,
                    borderRadius: 999,
                    background: escolhido ? "#0B1838" : "#C9A961",
                  }}
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const seta: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 30,
  height: 30,
  borderRadius: 999,
  border: "1px solid var(--ed2-hair)",
  background: "transparent",
  color: "var(--ed2-ink-2)",
  cursor: "pointer",
};

const botaoTexto: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#8a712d",
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
  padding: "6px 8px",
};
