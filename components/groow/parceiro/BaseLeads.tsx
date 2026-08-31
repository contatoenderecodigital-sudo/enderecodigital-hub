"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Trash2, Search } from "lucide-react";
import type { ParceiroLead } from "@/lib/groow/parceiros-etapas";
import { formatarTelefone } from "@/lib/groow/telefone";

/**
 * Base: tudo que veio da prospeccao e ainda nao foi para o funil.
 *
 * Lista e nao kanban de proposito. Kanban serve para acompanhar quem voce esta
 * trabalhando; base e um monte de nome que voce ainda vai triar, e para triar
 * lista e melhor: da para marcar varios e mandar de uma vez.
 */
export default function BaseLeads({
  leads,
  onMudou,
}: {
  leads: ParceiroLead[];
  onMudou: () => void;
}) {
  const [busca, setBusca] = useState("");
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  const [ocupado, setOcupado] = useState(false);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l) =>
      [l.nome, l.empresa, l.cidade, l.telefone, l.observacao]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [leads, busca]);

  async function agir(acao: "funil" | "excluir", ids: number[]) {
    if (!ids.length) return;
    if (acao === "excluir") {
      const quantos = ids.length;
      if (
        !confirm(
          quantos === 1
            ? "Apagar essa empresa da sua base? Não dá para desfazer."
            : `Apagar ${quantos} empresas da sua base? Não dá para desfazer.`
        )
      )
        return;
    }
    setOcupado(true);
    try {
      await fetch("/api/parceiro/leads/funil", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, acao }),
      });
      setMarcados(new Set());
      onMudou();
    } finally {
      setOcupado(false);
    }
  }

  function alternar(id: number) {
    setMarcados((s) => {
      const p = new Set(s);
      if (p.has(id)) p.delete(id);
      else p.add(id);
      return p;
    });
  }

  if (!leads.length) {
    return (
      <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--ed2-ink-2)" }}>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6 }}>
          Sua base está vazia. Use <strong style={{ color: "var(--ed2-ink)" }}>Achar quem ligar</strong>{" "}
          para trazer empresas do Google, e escolha aqui quais vão para o funil.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <div style={{ position: "relative", flex: "1 1 260px" }}>
          <Search
            size={15}
            style={{
              position: "absolute",
              left: 13,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--ed2-ink-2)",
            }}
          />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar na base"
            style={{
              width: "100%",
              padding: "10px 14px 10px 36px",
              borderRadius: 999,
              border: "1px solid var(--ed2-hair)",
              background: "var(--ed2-surface)",
              color: "var(--ed2-ink)",
              fontSize: 14,
              outline: "none",
            }}
          />
        </div>

        {marcados.size > 0 ? (
          <>
            <button
              onClick={() => agir("funil", [...marcados])}
              disabled={ocupado}
              style={botao("#C9A961", "#0B1838")}
            >
              <ArrowRight size={15} />
              Mandar {marcados.size} pro funil
            </button>
            <button
              onClick={() => agir("excluir", [...marcados])}
              disabled={ocupado}
              style={botao("rgba(255,59,48,0.10)", "#c8261c")}
            >
              <Trash2 size={15} />
              Apagar
            </button>
          </>
        ) : (
          <span style={{ fontSize: 13, color: "var(--ed2-ink-2)" }}>
            {filtrados.length} empresa(s). Marque para mandar pro funil.
          </span>
        )}
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {filtrados.map((l) => {
          const on = marcados.has(l.id);
          return (
            <div
              key={l.id}
              onClick={() => alternar(l.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 13,
                padding: "13px 15px",
                borderRadius: 14,
                cursor: "pointer",
                background: on ? "rgba(201,169,97,0.10)" : "var(--ed2-surface)",
                border: `1px solid ${on ? "rgba(201,169,97,0.45)" : "var(--ed2-hair)"}`,
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 6,
                  flexShrink: 0,
                  border: on ? "none" : "1.7px solid #C7C7CC",
                  background: on ? "#C9A961" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {on ? (
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="#0B1838" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2.5 6l2.5 2.5L9.5 3.5" />
                  </svg>
                ) : null}
              </div>

              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--ed2-ink)" }}>
                  {l.nome}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    flexWrap: "wrap",
                    fontSize: 12.5,
                    color: "var(--ed2-ink-2)",
                    marginTop: 3,
                  }}
                >
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    {formatarTelefone(l.telefone)}
                  </span>
                  {l.cidade ? <span>{l.cidade}</span> : null}
                </div>
                {l.observacao ? (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--ed2-ink-2)",
                      marginTop: 4,
                      lineHeight: 1.45,
                    }}
                  >
                    {l.observacao}
                  </div>
                ) : null}
              </div>

              <div style={{ display: "flex", gap: 7, flexShrink: 0 }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    agir("funil", [l.id]);
                  }}
                  disabled={ocupado}
                  title="Mandar pro funil"
                  style={iconeBotao("var(--ed2-ink)")}
                >
                  <ArrowRight size={15} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    agir("excluir", [l.id]);
                  }}
                  disabled={ocupado}
                  title="Apagar da base"
                  style={iconeBotao("#c8261c")}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function botao(fundo: string, cor: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    padding: "10px 18px",
    borderRadius: 999,
    border: "none",
    background: fundo,
    color: cor,
    fontSize: 13.5,
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

function iconeBotao(cor: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
    borderRadius: 999,
    border: "1px solid var(--ed2-hair)",
    background: "transparent",
    color: cor,
    cursor: "pointer",
  };
}
