"use client";

import { useMemo, useState } from "react";
import { Phone, Mic, CalendarClock, CheckCircle2, Repeat, Video, Trash2, Undo2 } from "lucide-react";
import { ETAPAS, type ParceiroLead, type SituacaoLead } from "@/lib/groow/parceiros-etapas";
import { formatarTelefone } from "@/lib/groow/telefone";

/**
 * Kanban da call fria. Cada coluna é uma etapa de ETAPAS, que é a mesma lista
 * usada no servidor, então board e banco nunca discordam sobre quais etapas
 * existem.
 *
 * Arrastar funciona no desktop. No celular o card tem um seletor de etapa, que
 * é o mesmo caminho por baixo: uma chamada em /api/parceiro/leads/etapa.
 */

interface Props {
  leads: ParceiroLead[];
  onAbrir: (lead: ParceiroLead) => void;
  onMover: (id: number, situacao: SituacaoLead) => void;
  filtro: string;
  /** tirar do quadro devolve para a base; excluir apaga de vez */
  onSairDoFunil?: (id: number) => void;
  onExcluir?: (id: number) => void;
}

function diasDesde(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

function retornoLegivel(iso: string | null): { texto: string; atrasado: boolean } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const atrasado = d.getTime() < Date.now();
  const hoje = new Date();
  const mesmoDia =
    d.getDate() === hoje.getDate() &&
    d.getMonth() === hoje.getMonth() &&
    d.getFullYear() === hoje.getFullYear();
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (mesmoDia) return { texto: `hoje ${hora}`, atrasado };
  return {
    texto: `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${hora}`,
    atrasado,
  };
}

function Selo({
  children,
  cor = "var(--ed2-ink-2)",
  fundo = "rgba(11,24,56,0.06)",
}: {
  children: React.ReactNode;
  cor?: string;
  fundo?: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 8px",
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 600,
        background: fundo,
        color: cor,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

export default function KanbanParceiro({ leads, onAbrir, onMover, filtro, onSairDoFunil, onExcluir }: Props) {
  const [arrastando, setArrastando] = useState<number | null>(null);
  const [alvo, setAlvo] = useState<SituacaoLead | null>(null);

  const visiveis = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l) =>
      [l.nome, l.empresa, l.cidade, l.telefone, l.setor]
        .filter(Boolean)
        .some((c) => String(c).toLowerCase().includes(q))
    );
  }, [leads, filtro]);

  const porEtapa = useMemo(() => {
    const mapa = new Map<SituacaoLead, ParceiroLead[]>();
    for (const e of ETAPAS) mapa.set(e.valor, []);
    for (const l of visiveis) {
      const lista = mapa.get(l.situacao);
      if (lista) lista.push(l);
      else mapa.get("a_ligar")?.push(l);
    }
    return mapa;
  }, [visiveis]);

  function soltar(situacao: SituacaoLead) {
    setAlvo(null);
    if (arrastando == null) return;
    const lead = leads.find((l) => l.id === arrastando);
    setArrastando(null);
    if (!lead || lead.situacao === situacao) return;
    onMover(lead.id, situacao);
  }

  return (
    <div
      style={{
        display: "flex",
        gap: 14,
        overflowX: "auto",
        paddingBottom: 12,
        alignItems: "flex-start",
      }}
    >
      {ETAPAS.map((etapa) => {
        const lista = porEtapa.get(etapa.valor) ?? [];
        const destacado = alvo === etapa.valor;
        return (
          <section
            key={etapa.valor}
            onDragOver={(e) => {
              e.preventDefault();
              if (alvo !== etapa.valor) setAlvo(etapa.valor);
            }}
            onDragLeave={() => setAlvo((a) => (a === etapa.valor ? null : a))}
            onDrop={() => soltar(etapa.valor)}
            style={{
              flex: "0 0 282px",
              minWidth: 282,
              borderRadius: 18,
              background: destacado ? "rgba(201,169,97,0.10)" : "var(--ed2-surface-2, rgba(11,24,56,0.03))",
              border: `1px solid ${destacado ? "#C9A961" : "transparent"}`,
              padding: 12,
              transition: "background 120ms, border-color 120ms",
            }}
          >
            <header style={{ padding: "2px 4px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: etapa.cor,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ed2-ink)" }}>
                  {etapa.label}
                </span>
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: "var(--ed2-ink-2)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {lista.length}
                </span>
              </div>
              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: 12,
                  lineHeight: 1.45,
                  color: "var(--ed2-ink-2)",
                }}
              >
                {etapa.ajuda}
              </p>
            </header>

            <div style={{ display: "grid", gap: 9 }}>
              {lista.length === 0 ? (
                <div
                  style={{
                    padding: "22px 10px",
                    textAlign: "center",
                    fontSize: 12.5,
                    color: "var(--ed2-ink-2)",
                    opacity: 0.7,
                    border: "1px dashed var(--ed2-hair)",
                    borderRadius: 13,
                  }}
                >
                  Vazio
                </div>
              ) : (
                lista.map((l) => {
                  const retorno = retornoLegivel(l.proximo_retorno);
                  const dias = diasDesde(l.ultima_tentativa);
                  // A reuniao marcada e a informacao mais importante do card:
                  // e o unico estado em que o parceiro ja fez o trabalho dele.
                  const reuniao = retornoLegivel(l.reuniao_em);
                  return (
                    <article
                      key={l.id}
                      draggable
                      onDragStart={() => setArrastando(l.id)}
                      onDragEnd={() => {
                        setArrastando(null);
                        setAlvo(null);
                      }}
                      onClick={() => onAbrir(l)}
                      style={{
                        background: "var(--ed2-surface)",
                        border: "1px solid var(--ed2-hair)",
                        borderRadius: 14,
                        padding: "12px 13px",
                        cursor: "pointer",
                        opacity: arrastando === l.id ? 0.45 : 1,
                        boxShadow: "0 1px 2px rgba(11,24,56,0.05)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 14.5,
                          fontWeight: 700,
                          color: "var(--ed2-ink)",
                          lineHeight: 1.3,
                        }}
                      >
                        {l.nome}
                      </div>

                      {l.empresa || l.cidade ? (
                        <div
                          style={{
                            fontSize: 12.5,
                            color: "var(--ed2-ink-2)",
                            marginTop: 3,
                            lineHeight: 1.4,
                          }}
                        >
                          {[l.empresa, l.cidade].filter(Boolean).join(" · ")}
                        </div>
                      ) : null}

                      <div
                        style={{
                          fontSize: 12.5,
                          color: "var(--ed2-ink-2)",
                          marginTop: 5,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {formatarTelefone(l.telefone)}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 5,
                          marginTop: 10,
                        }}
                      >
                        {l.tentativas > 0 ? (
                          <Selo>
                            <Repeat size={11} />
                            {l.tentativas}
                            {dias != null ? ` · ${dias === 0 ? "hoje" : `${dias}d`}` : ""}
                          </Selo>
                        ) : null}

                        {(l.gravacoes ?? 0) > 0 ? (
                          <Selo cor="#2f6fb0" fundo="rgba(47,111,176,0.12)">
                            <Mic size={11} />
                            {l.gravacoes}
                          </Selo>
                        ) : null}

                        {retorno ? (
                          <Selo
                            cor={retorno.atrasado ? "#c8261c" : "#8a712d"}
                            fundo={
                              retorno.atrasado ? "rgba(255,59,48,0.12)" : "rgba(201,169,97,0.16)"
                            }
                          >
                            <CalendarClock size={11} />
                            {retorno.texto}
                          </Selo>
                        ) : null}

                        {reuniao ? (
                          <Selo cor="#1d8a3a" fundo="rgba(52,199,89,0.14)">
                            <Video size={11} />
                            {reuniao.texto}
                          </Selo>
                        ) : null}

                        {l.lead_id ? (
                          <Selo cor="#1d8a3a" fundo="rgba(52,199,89,0.14)">
                            <CheckCircle2 size={11} />
                            na operação
                          </Selo>
                        ) : null}
                      </div>

                      {/* No celular não dá para arrastar, então a etapa também
                          muda por aqui. */}
                      <select
                        value={l.situacao}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => onMover(l.id, e.target.value as SituacaoLead)}
                        style={{
                          marginTop: 10,
                          width: "100%",
                          padding: "6px 9px",
                          borderRadius: 9,
                          border: "1px solid var(--ed2-hair)",
                          background: "transparent",
                          color: "var(--ed2-ink-2)",
                          fontSize: 12,
                          outline: "none",
                          cursor: "pointer",
                        }}
                      >
                        {ETAPAS.map((e) => (
                          <option key={e.valor} value={e.valor}>
                            {e.label}
                          </option>
                        ))}
                      </select>

                      {onSairDoFunil || onExcluir ? (
                        <div style={{ display: "flex", gap: 6, marginTop: 7 }}>
                          {onSairDoFunil ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSairDoFunil(l.id);
                              }}
                              title="Tirar do quadro e devolver para a base"
                              style={acaoCard("var(--ed2-ink-2)")}
                            >
                              <Undo2 size={12} />
                              Tirar
                            </button>
                          ) : null}
                          {onExcluir ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onExcluir(l.id);
                              }}
                              title="Apagar de vez"
                              style={acaoCard("#c8261c")}
                            >
                              <Trash2 size={12} />
                              Apagar
                            </button>
                          ) : null}
                        </div>
                      ) : null}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAbrir(l);
                        }}
                        style={{
                          marginTop: 7,
                          width: "100%",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          padding: "7px 10px",
                          borderRadius: 999,
                          border: "none",
                          background: "#C9A961",
                          color: "#0B1838",
                          fontSize: 12.5,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        <Phone size={13} />
                        Abrir
                      </button>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function acaoCard(cor: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    flex: 1,
    justifyContent: "center",
    padding: "6px 8px",
    borderRadius: 9,
    border: "1px solid var(--ed2-hair)",
    background: "transparent",
    color: cor,
    fontSize: 11.5,
    fontWeight: 600,
    cursor: "pointer",
  };
}
