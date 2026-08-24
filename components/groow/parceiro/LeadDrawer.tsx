"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  X,
  Phone,
  Square,
  Download,
  CalendarClock,
  CircleDot,
  Loader2,
  TriangleAlert,
} from "lucide-react";
import {
  RESULTADOS_CALL,
  ETAPA_POR_VALOR,
  type ParceiroLead,
  type ParceiroCall,
  type ResultadoCall,
} from "@/lib/groow/parceiros-etapas";
import { formatarTelefone } from "@/lib/groow/telefone";

/**
 * O lead aberto: dados, a ligação acontecendo agora e o histórico do que já
 * aconteceu com essa pessoa.
 *
 * A gravação sai do navegador em webm/opus, que é o que o MediaRecorder produz.
 * Não convertemos para MP3 porque o TurboScribe aceita webm e opus direto e o
 * arquivo fica bem menor.
 */

interface Props {
  lead: ParceiroLead;
  onFechar: () => void;
  onMudou: () => void;
}

const MIMES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
];

function mimeSuportado(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  return MIMES.find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
}

function mmss(seg: number): string {
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function tamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function quando(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** ISO para o valor que o input datetime-local espera, no fuso de quem olha. */
function paraInputLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

const rotulo: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--ed2-ink-2)",
  marginBottom: 7,
};

const campo: React.CSSProperties = {
  width: "100%",
  padding: "10px 13px",
  borderRadius: 12,
  border: "1px solid var(--ed2-hair)",
  background: "var(--ed2-surface)",
  color: "var(--ed2-ink)",
  fontSize: 14.5,
  outline: "none",
  fontFamily: "inherit",
};

const secao: React.CSSProperties = {
  padding: "18px 22px",
  borderTop: "1px solid var(--ed2-hair)",
};

export default function LeadDrawer({ lead, onFechar, onMudou }: Props) {
  const [calls, setCalls] = useState<ParceiroCall[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [emLigacao, setEmLigacao] = useState(false);
  const [audio, setAudio] = useState<Blob | null>(null);
  const [querGravar, setQuerGravar] = useState(true);

  const [resultado, setResultado] = useState<ResultadoCall>("atendeu");
  const [anotacao, setAnotacao] = useState("");
  const [retorno, setRetorno] = useState(paraInputLocal(lead.proximo_retorno));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const recRef = useRef<MediaRecorder | null>(null);
  const pedacosRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const carregarCalls = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await fetch(`/api/parceiro/calls?lead=${lead.id}`);
      if (r.ok) {
        const j = (await r.json()) as { calls: ParceiroCall[] };
        setCalls(j.calls || []);
      }
    } finally {
      setCarregando(false);
    }
  }, [lead.id]);

  useEffect(() => {
    carregarCalls();
  }, [carregarCalls]);

  // Solta microfone e timer se a tela fechar no meio da ligação.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function iniciar() {
    setErro(null);
    setAudio(null);
    setSegundos(0);
    setAnotacao("");
    setResultado("atendeu");
    pedacosRef.current = [];

    if (querGravar) {
      const mime = mimeSuportado();
      if (!mime) {
        setErro("Este navegador não consegue gravar áudio. Dá para registrar a ligação sem gravação.");
        setQuerGravar(false);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        const rec = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 32000 });
        rec.ondataavailable = (e) => {
          if (e.data.size > 0) pedacosRef.current.push(e.data);
        };
        rec.onstop = () => {
          setAudio(new Blob(pedacosRef.current, { type: mime.split(";")[0] }));
        };
        // Fatia de 5s: se o navegador fechar no meio, o que já veio não se perde.
        rec.start(5000);
        recRef.current = rec;
        setGravando(true);
      } catch {
        setErro("Não consegui acessar o microfone. Libere a permissão ou registre sem gravar.");
        return;
      }
    }

    setEmLigacao(true);
    timerRef.current = setInterval(() => setSegundos((s) => s + 1), 1000);
  }

  function encerrar() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recRef.current = null;
    setGravando(false);
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    setAviso(null);
    try {
      const r = await fetch("/api/parceiro/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parceiro_lead_id: lead.id,
          resultado,
          duracao_seg: segundos,
          anotacao: anotacao.trim() || null,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { id?: number; error?: string };
      if (!r.ok || !j.id) {
        setErro(j.error || "Não consegui registrar a ligação.");
        return;
      }

      // O áudio sobe depois, com a call já criada. Se falhar, a ligação e a
      // anotação continuam salvas e o parceiro é avisado.
      if (audio && audio.size > 0) {
        const fd = new FormData();
        fd.append("audio", audio, "ligacao.webm");
        const up = await fetch(`/api/parceiro/calls/${j.id}/audio`, { method: "POST", body: fd });
        if (!up.ok) {
          const ej = (await up.json().catch(() => ({}))) as { error?: string };
          setAviso(ej.error || "A ligação foi salva, mas a gravação não subiu.");
        }
      }

      if (retorno !== paraInputLocal(lead.proximo_retorno)) await salvarRetorno();

      setEmLigacao(false);
      setAudio(null);
      setSegundos(0);
      setAnotacao("");
      await carregarCalls();
      onMudou();
    } finally {
      setSalvando(false);
    }
  }

  async function salvarRetorno() {
    await fetch("/api/parceiro/leads/etapa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: lead.id,
        proximo_retorno: retorno ? new Date(retorno).toISOString() : null,
      }),
    });
    onMudou();
  }

  const etapa = ETAPA_POR_VALOR.get(lead.situacao);

  return (
    <div
      onClick={onFechar}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(11,24,56,0.42)",
        zIndex: 90,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(540px, 100%)",
          height: "100%",
          background: "var(--ed2-surface)",
          overflowY: "auto",
          boxShadow: "-8px 0 32px rgba(11,24,56,0.18)",
        }}
      >
        <header
          style={{
            padding: "20px 22px 18px",
            display: "flex",
            alignItems: "flex-start",
            gap: 14,
            position: "sticky",
            top: 0,
            background: "var(--ed2-surface)",
            zIndex: 2,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--ed2-ink)", lineHeight: 1.25 }}>
              {lead.nome}
            </div>
            <div style={{ fontSize: 13.5, color: "var(--ed2-ink-2)", marginTop: 4, lineHeight: 1.5 }}>
              {[lead.empresa, lead.cidade, lead.setor].filter(Boolean).join(" · ") || "sem detalhes"}
            </div>
            {etapa ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 9,
                  padding: "4px 11px",
                  borderRadius: 999,
                  fontSize: 12.5,
                  fontWeight: 600,
                  background: "rgba(11,24,56,0.06)",
                  color: "var(--ed2-ink-2)",
                }}
              >
                <CircleDot size={12} color={etapa.cor} />
                {etapa.label}
                {lead.tentativas > 0 ? ` · ${lead.tentativas} tentativa${lead.tentativas > 1 ? "s" : ""}` : ""}
              </span>
            ) : null}
          </div>
          <button
            onClick={onFechar}
            aria-label="Fechar"
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "var(--ed2-ink-2)",
              padding: 4,
            }}
          >
            <X size={20} />
          </button>
        </header>

        {/* ------------------------------------------------------ ligação */}
        <section style={{ ...secao, borderTop: "1px solid var(--ed2-hair)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <a
              href={`tel:+${lead.telefone}`}
              style={{
                fontSize: 19,
                fontWeight: 700,
                color: "var(--ed2-ink)",
                textDecoration: "none",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatarTelefone(lead.telefone)}
            </a>
            {lead.optin === 1 ? (
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "#1d8a3a" }}>
                deixou a gente chamar
              </span>
            ) : null}
          </div>

          {!emLigacao ? (
            <>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  fontSize: 14,
                  color: "var(--ed2-ink-2)",
                  marginBottom: 12,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={querGravar}
                  onChange={(e) => setQuerGravar(e.target.checked)}
                  style={{ width: 16, height: 16, flexShrink: 0, margin: 0 }}
                />
                Gravar a ligação (deixe o celular no viva voz)
              </label>

              <button
                onClick={iniciar}
                style={{
                  width: "100%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "13px 18px",
                  borderRadius: 999,
                  border: "none",
                  background: "#C9A961",
                  color: "#0B1838",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <Phone size={17} />
                Iniciar ligação
              </button>
            </>
          ) : (
            <div
              style={{
                border: "1px solid var(--ed2-hair)",
                borderRadius: 16,
                padding: 16,
                background: "rgba(201,169,97,0.06)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 14 }}>
                {gravando ? (
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      background: "#c8261c",
                      animation: "ed-pulse-soft 1.2s ease-in-out infinite",
                    }}
                  />
                ) : null}
                <span
                  style={{
                    fontSize: 24,
                    fontWeight: 700,
                    color: "var(--ed2-ink)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {mmss(segundos)}
                </span>
                <span style={{ fontSize: 13, color: "var(--ed2-ink-2)", marginLeft: "auto" }}>
                  {gravando ? "gravando" : audio ? "gravação pronta" : "sem gravação"}
                </span>
              </div>

              {gravando ? (
                <button
                  onClick={encerrar}
                  style={{
                    width: "100%",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: "11px 18px",
                    borderRadius: 999,
                    border: "1px solid var(--ed2-hair)",
                    background: "var(--ed2-surface)",
                    color: "var(--ed2-ink)",
                    fontSize: 14.5,
                    fontWeight: 700,
                    cursor: "pointer",
                    marginBottom: 14,
                  }}
                >
                  <Square size={15} />
                  Encerrar ligação
                </button>
              ) : null}

              <div style={{ marginBottom: 13 }}>
                <label style={rotulo}>Como terminou</label>
                <select
                  value={resultado}
                  onChange={(e) => setResultado(e.target.value as ResultadoCall)}
                  style={{ ...campo, cursor: "pointer" }}
                >
                  {RESULTADOS_CALL.map((r) => (
                    <option key={r.valor} value={r.valor}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <p style={{ margin: "7px 0 0", fontSize: 12.5, color: "var(--ed2-ink-2)", lineHeight: 1.5 }}>
                  Ela vai para a coluna{" "}
                  <strong style={{ color: "var(--ed2-ink)" }}>
                    {ETAPA_POR_VALOR.get(
                      RESULTADOS_CALL.find((r) => r.valor === resultado)?.etapa ?? "ligou"
                    )?.label}
                  </strong>
                  .
                </p>
              </div>

              <div style={{ marginBottom: 13 }}>
                <label style={rotulo}>O que ficou combinado</label>
                <textarea
                  value={anotacao}
                  onChange={(e) => setAnotacao(e.target.value)}
                  rows={4}
                  placeholder="O que ela falou, o que reclamou, o que ficou combinado."
                  style={{ ...campo, resize: "vertical", lineHeight: 1.55 }}
                />
              </div>

              <div style={{ marginBottom: 15 }}>
                <label style={rotulo}>Ligar de novo em</label>
                <input
                  type="datetime-local"
                  value={retorno}
                  onChange={(e) => setRetorno(e.target.value)}
                  style={campo}
                />
              </div>

              <div style={{ display: "flex", gap: 9 }}>
                <button
                  onClick={() => {
                    encerrar();
                    setEmLigacao(false);
                    setAudio(null);
                    setSegundos(0);
                  }}
                  style={{
                    padding: "11px 18px",
                    borderRadius: 999,
                    border: "1px solid var(--ed2-hair)",
                    background: "transparent",
                    color: "var(--ed2-ink-2)",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Descartar
                </button>
                <button
                  onClick={salvar}
                  disabled={salvando || gravando}
                  title={gravando ? "Encerre a ligação antes de salvar" : ""}
                  style={{
                    flex: 1,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 7,
                    padding: "11px 18px",
                    borderRadius: 999,
                    border: "none",
                    background: "#C9A961",
                    color: "#0B1838",
                    fontSize: 14.5,
                    fontWeight: 700,
                    cursor: salvando || gravando ? "not-allowed" : "pointer",
                    opacity: salvando || gravando ? 0.5 : 1,
                  }}
                >
                  {salvando ? <Loader2 size={15} className="animate-spin" /> : null}
                  Salvar ligação
                </button>
              </div>
            </div>
          )}

          {erro ? (
            <p
              style={{
                margin: "13px 0 0",
                display: "flex",
                gap: 7,
                fontSize: 13.5,
                color: "#c8261c",
                lineHeight: 1.55,
              }}
            >
              <TriangleAlert size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              {erro}
            </p>
          ) : null}
          {aviso ? (
            <p style={{ margin: "13px 0 0", fontSize: 13.5, color: "#b45309", lineHeight: 1.55 }}>
              {aviso}
            </p>
          ) : null}
        </section>

        {/* ------------------------------------------------------ retorno */}
        {!emLigacao ? (
          <section style={secao}>
            <label style={rotulo}>
              <CalendarClock size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
              Retorno agendado
            </label>
            <div style={{ display: "flex", gap: 9 }}>
              <input
                type="datetime-local"
                value={retorno}
                onChange={(e) => setRetorno(e.target.value)}
                style={campo}
              />
              <button
                onClick={salvarRetorno}
                style={{
                  padding: "10px 18px",
                  borderRadius: 12,
                  border: "1px solid var(--ed2-hair)",
                  background: "transparent",
                  color: "var(--ed2-ink)",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Salvar
              </button>
            </div>
          </section>
        ) : null}

        {/* ---------------------------------------------------- histórico */}
        <section style={secao}>
          <label style={rotulo}>Ligações anteriores</label>

          {carregando ? (
            <p style={{ fontSize: 14, color: "var(--ed2-ink-2)" }}>Carregando...</p>
          ) : calls.length === 0 ? (
            <p style={{ fontSize: 14, color: "var(--ed2-ink-2)", lineHeight: 1.6, margin: 0 }}>
              Nenhuma ligação ainda. A primeira aparece aqui assim que você
              encerrar.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {calls.map((c) => {
                const res = RESULTADOS_CALL.find((r) => r.valor === c.resultado);
                return (
                  <article
                    key={c.id}
                    style={{
                      border: "1px solid var(--ed2-hair)",
                      borderRadius: 14,
                      padding: "13px 15px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: 9,
                        flexWrap: "wrap",
                      }}
                    >
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ed2-ink)" }}>
                        {res?.label || c.resultado}
                      </span>
                      <span style={{ fontSize: 12.5, color: "var(--ed2-ink-2)" }}>
                        {quando(c.criado_em)}
                        {c.duracao_seg > 0 ? ` · ${mmss(c.duracao_seg)}` : ""}
                      </span>
                    </div>

                    {c.anotacao ? (
                      <p
                        style={{
                          margin: "9px 0 0",
                          fontSize: 13.5,
                          color: "var(--ed2-ink-2)",
                          lineHeight: 1.6,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {c.anotacao}
                      </p>
                    ) : null}

                    {c.audio_path ? (
                      <div style={{ marginTop: 11 }}>
                        <audio
                          controls
                          preload="none"
                          src={`/api/parceiro/calls/${c.id}/audio`}
                          style={{ width: "100%", height: 36 }}
                        />
                        <a
                          href={`/api/parceiro/calls/${c.id}/audio?download=1`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            marginTop: 8,
                            fontSize: 13,
                            fontWeight: 600,
                            color: "var(--ed2-ink-2)",
                            textDecoration: "none",
                          }}
                        >
                          <Download size={14} />
                          Baixar a gravação
                          <span style={{ opacity: 0.7, fontWeight: 400 }}>
                            ({tamanho(c.audio_bytes)})
                          </span>
                        </a>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* -------------------------------------------------------- opt-in */}
        {lead.optin_prova ? (
          <section style={secao}>
            <label style={rotulo}>O que ela te disse</label>
            <p
              style={{
                margin: 0,
                fontSize: 13.5,
                color: "var(--ed2-ink-2)",
                lineHeight: 1.6,
                fontStyle: "italic",
              }}
            >
              &ldquo;{lead.optin_prova}&rdquo;
            </p>
          </section>
        ) : null}
      </aside>
    </div>
  );
}
