"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mic, Square, ChevronLeft, ChevronRight, Sparkles, PhoneCall } from "lucide-react";
import Card, { CardHead } from "@/components/groow/admin/ed2/Card";
import type { FaseCall, Objecao } from "@/lib/groow/playbook-vendas";
import type { ParceiroLead } from "@/lib/groow/parceiros-etapas";

/** Fatia de áudio mandada ao copiloto. Curta o bastante para acompanhar a fala. */
const BLOCO_MS = 15000;

function mmss(seg: number): string {
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function CopilotoCall({
  iaAtiva,
  fases,
  objecoes,
  principios,
}: {
  iaAtiva: boolean;
  fases: FaseCall[];
  objecoes: Objecao[];
  principios: string[];
}) {
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [faseIdx, setFaseIdx] = useState(0);
  const [objecaoAberta, setObjecaoAberta] = useState<string | null>(null);
  const [anotacao, setAnotacao] = useState("");
  const [leads, setLeads] = useState<ParceiroLead[]>([]);
  const [leadId, setLeadId] = useState<string>("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [sugestoes, setSugestoes] = useState<string[]>([]);
  const [alerta, setAlerta] = useState<string | null>(null);
  const [erroMic, setErroMic] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Em ref e não em state: o ondataavailable do MediaRecorder é um closure
  // criado uma vez, então leria sempre o valor velho de um useState.
  const transcricaoRef = useRef("");

  useEffect(() => {
    fetch("/api/parceiro/leads")
      .then((r) => r.json())
      .then((d) => setLeads(Array.isArray(d.leads) ? d.leads : []))
      .catch(() => {});
  }, []);

  const pararTudo = useCallback(() => {
    recorderRef.current?.state === "recording" && recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    recorderRef.current = null;
    streamRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  // Desligar o microfone ao sair da tela não é opcional: sem isto o indicador
  // de gravação do navegador fica aceso depois que o parceiro navega.
  useEffect(() => pararTudo, [pararTudo]);

  async function iniciar() {
    setErroMic(null);

    // Com a IA desligada o audio nao serve pra nada: era pedido, gravado na
    // memoria a cada 15s e jogado fora. Pedir microfone a toa numa tela que o
    // parceiro abre na frente do cliente e ruim, entao so liga o cronometro.
    if (!iaAtiva) {
      setGravando(true);
      setSegundos(0);
      setSugestoes([]);
      setAlerta(null);
      transcricaoRef.current = "";
      timerRef.current = setInterval(() => setSegundos((s) => s + 1), 1000);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream);
      recorderRef.current = rec;

      rec.ondataavailable = async (ev) => {
        if (!iaAtiva || ev.data.size === 0) return;
        // Com a IA ligada, cada bloco vira transcrição e sugestão. Com ela
        // desligada nem chegamos aqui, e a tela segue nos cards do playbook.
        try {
          const fd = new FormData();
          fd.append("audio", ev.data);
          fd.append("transcricao", transcricaoRef.current);
          const r = await fetch("/api/parceiro/copiloto/insight", {
            method: "POST",
            body: fd,
          });
          if (!r.ok) return;
          const d = await r.json();
          if (typeof d.transcricao === "string") transcricaoRef.current = d.transcricao;
          if (Array.isArray(d.sugestoes) && d.sugestoes.length) setSugestoes(d.sugestoes);
          setAlerta(d.alerta || null);
          if (d.fase) {
            const i = fases.findIndex((f) => f.id === d.fase);
            if (i >= 0) setFaseIdx(i);
          }
        } catch {
          // rede instável no meio da call não pode quebrar a gravação
        }
      };

      rec.start(BLOCO_MS);
      setGravando(true);
      setSegundos(0);
      setSugestoes([]);
      setAlerta(null);
      transcricaoRef.current = "";
      timerRef.current = setInterval(() => setSegundos((s) => s + 1), 1000);
    } catch {
      setErroMic(
        "Não consegui acessar o microfone. Libere a permissão no navegador e tente de novo."
      );
    }
  }

  async function encerrar() {
    const duracao = segundos;
    pararTudo();
    setGravando(false);

    // A ligação só vira registro se estiver amarrada a um lead: sem isso a
    // anotação ficaria solta, sem ninguém para ler depois. Quem quer gravar a
    // ligação usa "Minhas ligações", que salva o áudio dentro do card.
    if (!anotacao.trim() && duracao === 0) return;

    if (!leadId) {
      setAviso("Escolha para quem é a ligação para eu conseguir salvar a anotação.");
      return;
    }

    try {
      const r = await fetch("/api/parceiro/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parceiro_lead_id: Number(leadId),
          resultado: "atendeu",
          anotacao: anotacao.trim() || null,
          duracao_seg: duracao,
        }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        setAviso(j.error || "Não consegui salvar a anotação.");
        return;
      }
      setAviso("Ligação registrada.");
      setAnotacao("");
      setTimeout(() => setAviso(null), 3000);
    } catch {
      setAviso("Não consegui salvar a anotação.");
    }
  }

  const fase = fases[faseIdx];
  const objecoesFiltradas = useMemo(() => objecoes, [objecoes]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 340px", gap: 22, alignItems: "start" }} className="cop-grid">
      <div style={{ display: "grid", gap: 18 }}>
        {/* controle da ligação */}
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <button
              onClick={gravando ? encerrar : iniciar}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "14px 26px",
                borderRadius: 999,
                border: "none",
                background: gravando ? "#c8261c" : "#C9A961",
                color: gravando ? "#fff" : "#0B1838",
                fontWeight: 700,
                fontSize: 15,
                cursor: "pointer",
              }}
            >
              {/* microfone so quando o microfone e realmente usado, senao engana */}
              {gravando ? <Square size={16} fill="currentColor" /> : iaAtiva ? <Mic size={17} /> : <PhoneCall size={17} />}
              {gravando ? "Encerrar ligação" : iaAtiva ? "Iniciar ligação" : "Começar a ligação"}
            </button>

            {gravando ? (
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 999,
                    background: "#c8261c",
                    display: "inline-block",
                  }}
                />
                <span
                  style={{
                    fontSize: 20,
                    fontWeight: 600,
                    fontVariantNumeric: "tabular-nums",
                    color: "var(--ed2-ink)",
                  }}
                >
                  {mmss(segundos)}
                </span>
              </div>
            ) : null}

            <select
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
              style={{
                marginLeft: "auto",
                padding: "11px 14px",
                borderRadius: 12,
                border: "1px solid var(--ed2-hair)",
                background: "var(--ed2-surface)",
                color: "var(--ed2-ink)",
                fontSize: 14,
                minWidth: 210,
              }}
            >
              <option value="">Escolha para quem você vai ligar</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome}
                  {l.empresa ? ` · ${l.empresa}` : ""}
                </option>
              ))}
            </select>
          </div>

          {erroMic ? (
            <div
              style={{
                marginTop: 16,
                padding: "11px 14px",
                borderRadius: 12,
                background: "rgba(255,59,48,0.10)",
                color: "#c8261c",
                fontSize: 14,
              }}
            >
              {erroMic}
            </div>
          ) : null}

          {aviso ? (
            <div
              style={{
                marginTop: 16,
                padding: "11px 14px",
                borderRadius: 12,
                background: "rgba(52,199,89,0.12)",
                color: "#1d8a3a",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {aviso}
            </div>
          ) : null}

          <p style={{ margin: "16px 0 0", fontSize: 12.5, color: "var(--ed2-ink-2)", lineHeight: 1.6 }}>
            {iaAtiva
              ? "O áudio é ouvido em trechos e vira texto na hora. A gravação NÃO é guardada em lugar nenhum: fica salva só a transcrição e a sua anotação."
              : "Sugestões automáticas desligadas, então nem pedimos o seu microfone. O cronômetro e o roteiro funcionam normal, e a sua anotação fica guardada ao encerrar."}
          </p>
        </Card>

        {/* roteiro por fase */}
        <Card>
          <CardHead
            title={`${faseIdx + 1}. ${fase.titulo}`}
            sub={fase.objetivo}
            right={
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => setFaseIdx((i) => Math.max(0, i - 1))}
                  disabled={faseIdx === 0}
                  style={navBtn(faseIdx === 0)}
                >
                  <ChevronLeft size={17} />
                </button>
                <button
                  onClick={() => setFaseIdx((i) => Math.min(fases.length - 1, i + 1))}
                  disabled={faseIdx === fases.length - 1}
                  style={navBtn(faseIdx === fases.length - 1)}
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            }
          />

          <div style={{ display: "grid", gap: 10 }}>
            {fase.falas.map((f) => (
              <div
                key={f}
                style={{
                  padding: "14px 16px",
                  borderRadius: 16,
                  background: "var(--ed2-surface)",
                  fontSize: 15.5,
                  lineHeight: 1.55,
                  color: "var(--ed2-ink)",
                }}
              >
                {f}
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 16,
              paddingTop: 14,
              borderTop: "1px solid var(--ed2-hair)",
              fontSize: 13.5,
              color: "var(--ed2-ink-2)",
              lineHeight: 1.6,
            }}
          >
            <strong style={{ color: "var(--ed2-ink)" }}>Pode avançar quando:</strong>{" "}
            {fase.sinalDeAvanco}
          </div>

          <div style={{ display: "flex", gap: 6, marginTop: 18, flexWrap: "wrap" }}>
            {fases.map((f, i) => (
              <button
                key={f.id}
                onClick={() => setFaseIdx(i)}
                style={{
                  padding: "6px 13px",
                  borderRadius: 999,
                  border: "none",
                  background: i === faseIdx ? "#C9A961" : "var(--ed2-surface)",
                  color: i === faseIdx ? "#0B1838" : "var(--ed2-ink-2)",
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {f.titulo}
              </button>
            ))}
          </div>
        </Card>

        {/* anotação */}
        <Card>
          <CardHead
            title="Anotação da ligação"
            sub="Fica guardado quando você encerrar. Escreva com as palavras dela."
          />
          <textarea
            value={anotacao}
            onChange={(e) => setAnotacao(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Usa iFood e paga 27%. Perde pedido no sábado à noite. Sócio decide junto."
            style={{
              width: "100%",
              padding: "13px 15px",
              borderRadius: 14,
              border: "1px solid var(--ed2-hair)",
              background: "var(--ed2-surface)",
              color: "var(--ed2-ink)",
              fontSize: 15,
              fontFamily: "inherit",
              resize: "vertical",
              outline: "none",
            }}
          />
        </Card>
      </div>

      {/* coluna lateral */}
      <div style={{ display: "grid", gap: 18, position: "sticky", top: 24 }}>
        {iaAtiva && alerta ? (
          <Card padding={18} style={{ background: "rgba(255,59,48,0.08)" }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "#c8261c",
                marginBottom: 7,
              }}
            >
              Atenção
            </div>
            <div style={{ fontSize: 14.5, lineHeight: 1.5, color: "var(--ed2-ink)" }}>{alerta}</div>
          </Card>
        ) : null}

        {iaAtiva && sugestoes.length ? (
          <Card style={{ background: "rgba(201,169,97,0.10)" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "#8a712d",
                marginBottom: 12,
              }}
            >
              <Sparkles size={14} />
              Agora
            </div>
            <div style={{ display: "grid", gap: 9 }}>
              {sugestoes.map((s) => (
                <div key={s} style={{ fontSize: 15, lineHeight: 1.5, color: "var(--ed2-ink)" }}>
                  {s}
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        <Card padding={20}>
          <CardHead title="Quebra de objeção" />
          <div style={{ display: "grid", gap: 7 }}>
            {objecoesFiltradas.map((o) => {
              const aberta = objecaoAberta === o.gatilho;
              return (
                <div key={o.gatilho}>
                  <button
                    onClick={() => setObjecaoAberta(aberta ? null : o.gatilho)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "11px 13px",
                      borderRadius: 12,
                      border: "none",
                      background: aberta ? "var(--ed2-surface)" : "transparent",
                      color: "var(--ed2-ink)",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {o.gatilho}
                  </button>
                  {aberta ? (
                    <div
                      style={{
                        padding: "12px 13px 14px",
                        display: "grid",
                        gap: 10,
                        fontSize: 14,
                        lineHeight: 1.55,
                      }}
                    >
                      <div style={{ color: "var(--ed2-ink-2)", fontStyle: "italic" }}>
                        {o.rotulo}
                      </div>
                      <div style={{ color: "var(--ed2-ink)" }}>{o.resposta}</div>
                      <div
                        style={{
                          padding: "10px 12px",
                          borderRadius: 10,
                          background: "rgba(201,169,97,0.12)",
                          color: "#8a712d",
                          fontWeight: 600,
                        }}
                      >
                        {o.pergunta}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </Card>

        <Card padding={20}>
          <CardHead title="Não esqueça" />
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 9 }}>
            {principios.map((p) => (
              <li
                key={p}
                style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--ed2-ink-2)" }}
              >
                {p}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `@media (max-width: 1080px) { .cop-grid { grid-template-columns: 1fr !important; } }`,
        }}
      />
    </div>
  );
}

function navBtn(desabilitado: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 34,
    height: 34,
    borderRadius: 999,
    border: "1px solid var(--ed2-hair)",
    background: "transparent",
    color: "var(--ed2-ink)",
    cursor: desabilitado ? "default" : "pointer",
    opacity: desabilitado ? 0.4 : 1,
  };
}
