"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, RefreshCw, Video } from "lucide-react";
import Card, { CardHead } from "@/components/groow/admin/ed2/Card";

/** Espelha lib/groow/reunioes.ts. Tipo local para nao arrastar o `pg` pro bundle. */
interface Reuniao {
  id: number;
  cal_uid: string;
  nome: string;
  empresa: string | null;
  telefone: string | null;
  email: string | null;
  cidade: string | null;
  reuniao_em: string;
  reuniao_link: string | null;
  status: string;
  observacao: string | null;
  parceiro_nome: string | null;
  parceiro_codigo: string | null;
  lead_id: number | null;
  lead_situacao: string | null;
  desfecho_nota: string | null;
}

const DESFECHOS: { valor: string; label: string; cor: string }[] = [
  { valor: "fechou", label: "Fechou", cor: "#1d8a3a" },
  { valor: "nao_fechou", label: "Não fechou", cor: "#7c8698" },
  { valor: "compareceu", label: "Compareceu", cor: "#2f6fb0" },
  { valor: "nao_compareceu", label: "Não veio", cor: "#c2833a" },
];

const LABEL: Record<string, string> = Object.fromEntries(
  DESFECHOS.map((d) => [d.valor, d.label])
);

function quando(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function telefoneLegivel(t: string | null): string {
  if (!t) return "";
  const d = t.replace(/\D/g, "").replace(/^55/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return t;
}

export default function FilaReunioes() {
  const [futuras, setFuturas] = useState<Reuniao[]>([]);
  const [passadas, setPassadas] = useState<Reuniao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await fetch("/api/admin/reunioes");
      const d = await r.json();
      setFuturas(Array.isArray(d.futuras) ? d.futuras : []);
      setPassadas(Array.isArray(d.passadas) ? d.passadas : []);
    } catch {
      setErro("Não consegui carregar a fila.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function marcar(calUid: string, desfecho: string) {
    setSalvando(calUid + desfecho);
    setErro(null);
    try {
      const r = await fetch("/api/admin/reunioes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cal_uid: calUid, desfecho }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setErro(d.error || "Não consegui salvar.");
        return;
      }
      await carregar();
    } finally {
      setSalvando(null);
    }
  }

  // Quem ja aconteceu e ainda esta como "marcada" e o que precisa de anotacao.
  const pendentes = passadas.filter((r) => r.status === "marcada" || r.status === "remarcada");
  const anotadas = passadas.filter((r) => r.status !== "marcada" && r.status !== "remarcada");

  // Os botoes aparecem em qualquer reuniao sem desfecho, inclusive nas que ainda
  // vao acontecer. Presos so ao passado, nao dava para anotar "fechou" no fim da
  // propria call, que e justamente quando a gente sabe.
  const semDesfecho = (r: Reuniao) => r.status === "marcada" || r.status === "remarcada";
  const botoes = (r: Reuniao) => (
    <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 10 }}>
      {DESFECHOS.map((d) => (
        <button
          key={d.valor}
          onClick={() => marcar(r.cal_uid, d.valor)}
          disabled={salvando === r.cal_uid + d.valor}
          style={{
            padding: "7px 14px",
            borderRadius: 999,
            border: `1px solid ${d.cor}55`,
            background: `${d.cor}18`,
            color: d.cor,
            fontWeight: 600,
            fontSize: 12.5,
            cursor: "pointer",
          }}
        >
          {d.label}
        </button>
      ))}
    </div>
  );

  return (
    <Card style={{ marginBottom: 22 }}>
      <CardHead
        title="Reuniões"
        sub={
          carregando
            ? "Carregando..."
            : `${futuras.length} marcada(s) e ${pendentes.length} esperando o desfecho.`
        }
        right={
          <button onClick={carregar} style={botaoIcone} title="Atualizar">
            <RefreshCw size={15} />
          </button>
        }
      />

      {erro ? (
        <div style={aviso}>{erro}</div>
      ) : null}

      {!carregando && !futuras.length && !passadas.length ? (
        <p style={{ margin: 0, fontSize: 14, color: "var(--ed2-ink-2)", lineHeight: 1.6 }}>
          Nenhuma reunião ainda. Elas aparecem aqui sozinhas quando alguém marcar
          pelo link do Cal, com ou sem indicação de parceiro.
        </p>
      ) : null}

      {futuras.length ? (
        <Secao titulo="Vão acontecer">
          {futuras.map((r) => (
            <Linha key={r.cal_uid} r={r} acoes={semDesfecho(r) ? botoes(r) : undefined} />
          ))}
        </Secao>
      ) : null}

      {pendentes.length ? (
        <Secao titulo="Aconteceram, falta anotar">
          {pendentes.map((r) => (
            <Linha key={r.cal_uid} r={r} acoes={botoes(r)} />
          ))}
        </Secao>
      ) : null}

      {anotadas.length ? (
        <Secao titulo="Já anotadas">
          {anotadas.slice(0, 20).map((r) => (
            <Linha key={r.cal_uid} r={r} />
          ))}
        </Secao>
      ) : null}
    </Card>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          color: "var(--ed2-ink-2)",
          marginBottom: 10,
        }}
      >
        {titulo}
      </div>
      <div style={{ display: "grid", gap: 10 }}>{children}</div>
    </div>
  );
}

function Linha({ r, acoes }: { r: Reuniao; acoes?: React.ReactNode }) {
  const desfecho = r.lead_situacao && LABEL[r.lead_situacao] ? LABEL[r.lead_situacao] : null;
  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: 16,
        background: "var(--ed2-surface)",
        border: "1px solid var(--ed2-hair)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15.5, fontWeight: 600, color: "var(--ed2-ink)" }}>
            {r.nome}
            {r.empresa ? (
              <span style={{ color: "var(--ed2-ink-2)", fontWeight: 400 }}> · {r.empresa}</span>
            ) : null}
          </div>
          <div
            style={{
              display: "flex",
              gap: 14,
              flexWrap: "wrap",
              fontSize: 13,
              color: "var(--ed2-ink-2)",
              marginTop: 5,
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <CalendarClock size={13} />
              {quando(r.reuniao_em)}
            </span>
            {r.telefone ? <span>{telefoneLegivel(r.telefone)}</span> : null}
            {r.cidade ? <span>{r.cidade}</span> : null}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flexShrink: 0 }}>
          {r.parceiro_nome ? (
            <span
              style={{
                padding: "5px 12px",
                borderRadius: 999,
                background: "rgba(201,169,97,0.16)",
                color: "#8a712d",
                fontSize: 12,
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
              title={`Indicação de ${r.parceiro_nome}`}
            >
              {r.parceiro_nome}
            </span>
          ) : (
            <span
              style={{
                padding: "5px 12px",
                borderRadius: 999,
                background: "rgba(11,24,56,0.07)",
                color: "var(--ed2-ink-2)",
                fontSize: 12,
                whiteSpace: "nowrap",
              }}
              title="Marcou direto, sem indicação de parceiro"
            >
              Sem parceiro
            </span>
          )}
          {desfecho ? (
            <span
              style={{
                padding: "5px 12px",
                borderRadius: 999,
                background: "rgba(11,24,56,0.07)",
                color: "var(--ed2-ink)",
                fontSize: 12,
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              {desfecho}
            </span>
          ) : null}
          {r.reuniao_link ? (
            <a
              href={r.reuniao_link}
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...botaoIcone, textDecoration: "none" }}
              title="Abrir a chamada"
            >
              <Video size={15} />
            </a>
          ) : null}
        </div>
      </div>

      {r.observacao ? (
        <div
          style={{
            marginTop: 11,
            padding: "10px 13px",
            borderRadius: 12,
            background: "rgba(11,24,56,0.05)",
            fontSize: 13.5,
            lineHeight: 1.55,
            color: "var(--ed2-ink)",
          }}
        >
          <strong style={{ fontWeight: 600 }}>Nas palavras dela.</strong> {r.observacao}
        </div>
      ) : null}

      {acoes}
    </div>
  );
}

const botaoIcone: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 32,
  height: 32,
  borderRadius: 999,
  border: "1px solid var(--ed2-hair)",
  background: "transparent",
  color: "var(--ed2-ink-2)",
  cursor: "pointer",
};

const aviso: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  background: "rgba(255,59,48,0.10)",
  color: "#c8261c",
  fontSize: 13.5,
  marginBottom: 12,
};
