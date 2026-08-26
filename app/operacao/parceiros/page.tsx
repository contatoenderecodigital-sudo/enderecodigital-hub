"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, RefreshCw } from "lucide-react";
import PageHeader from "@/components/groow/admin/ed2/PageHeader";
import Card from "@/components/groow/admin/ed2/Card";
import StatCard from "@/components/groow/admin/ed2/StatCard";
import ParceiroModal, { type ParceiroLinha } from "@/components/groow/admin/ParceiroModal";
import FilaReunioes from "@/components/groow/admin/FilaReunioes";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "0 14px 12px",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--ed2-ink-2)",
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  padding: "14px",
  fontSize: 14.5,
  color: "var(--ed2-ink)",
  borderTop: "1px solid var(--ed2-hair)",
};

export default function ParceirosPage() {
  const [linhas, setLinhas] = useState<ParceiroLinha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<ParceiroLinha | null>(null);
  const [apurando, setApurando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await fetch("/api/admin/parceiros");
      const d = await r.json();
      setLinhas(Array.isArray(d.parceiros) ? d.parceiros : []);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function flash(msg: string) {
    setAviso(msg);
    setTimeout(() => setAviso(null), 4000);
  }

  async function apurar() {
    setApurando(true);
    try {
      const r = await fetch("/api/admin/parceiros/comissoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "apurar" }),
      });
      const d = await r.json();
      if (!r.ok) {
        flash(d.error || "Falha na apuração.");
        return;
      }
      flash(
        `Apuração de ${d.competencia}: ${d.criadas} nova(s), ${d.atualizadas} atualizada(s), ${d.clientesAvaliados} cliente(s) avaliado(s).`
      );
      carregar();
    } finally {
      setApurando(false);
    }
  }

  const totalPrevisto = linhas.reduce((s, l) => s + (l.previsto || 0), 0);
  const totalAprovado = linhas.reduce((s, l) => s + (l.aprovado || 0), 0);
  const totalLeads = linhas.reduce((s, l) => s + (l.leads || 0), 0);
  const totalClientes = linhas.reduce((s, l) => s + (l.clientes || 0), 0);

  return (
    <>
      <PageHeader
        title="Parceiros"
        sub="Quem indica, o que trouxe e quanto tem a receber."
        right={
          <>
            <button
              onClick={apurar}
              disabled={apurando}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 20px",
                borderRadius: 999,
                border: "1px solid var(--ed2-hair)",
                background: "transparent",
                color: "var(--ed2-ink)",
                fontWeight: 600,
                fontSize: 14.5,
                cursor: apurando ? "default" : "pointer",
              }}
            >
              <RefreshCw size={16} />
              {apurando ? "Apurando..." : "Apurar mês"}
            </button>
            <button
              onClick={() => {
                setEditando(null);
                setAberto(true);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 22px",
                borderRadius: 999,
                border: "none",
                background: "#C9A961",
                color: "#0B1838",
                fontWeight: 700,
                fontSize: 14.5,
                cursor: "pointer",
              }}
            >
              <Plus size={17} />
              Novo parceiro
            </button>
          </>
        }
      />

      {aviso ? (
        <div
          style={{
            padding: "13px 17px",
            borderRadius: 14,
            background: "rgba(201,169,97,0.14)",
            color: "#8a712d",
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 20,
          }}
        >
          {aviso}
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <StatCard label="Parceiros ativos" value={String(linhas.filter((l) => l.status === "ativo").length)} />
        <StatCard label="Leads trazidos" value={String(totalLeads)} desc={`${totalClientes} viraram cliente`} />
        <StatCard label="Comissão prevista" value={brl(totalPrevisto)} currency="R$" />
        <StatCard
          label="A pagar"
          value={brl(totalAprovado)}
          currency="R$"
          pill={totalAprovado > 0 ? { text: "aprovado", tone: "up" } : null}
        />
      </div>

      <FilaReunioes />

      <Card padding={22}>
        {carregando ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: "var(--ed2-ink-2)" }}>
            Carregando...
          </div>
        ) : linhas.length === 0 ? (
          <div style={{ padding: "56px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 17, fontWeight: 600, color: "var(--ed2-ink)", marginBottom: 6 }}>
              Nenhum parceiro cadastrado
            </div>
            <div style={{ fontSize: 14.5, color: "var(--ed2-ink-2)" }}>
              Cadastre o primeiro e mande o link de indicação para ele.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
              <thead>
                <tr>
                  <th style={th}>Parceiro</th>
                  <th style={th}>Código</th>
                  <th style={{ ...th, textAlign: "right" }}>Cliques</th>
                  <th style={{ ...th, textAlign: "right" }}>Leads</th>
                  <th style={{ ...th, textAlign: "right" }}>Clientes</th>
                  <th style={{ ...th, textAlign: "right" }}>Previsto</th>
                  <th style={{ ...th, textAlign: "right" }}>A pagar</th>
                  <th style={th} />
                </tr>
              </thead>
              <tbody>
                {linhas.map((p) => (
                  <tr key={p.id}>
                    <td style={td}>
                      <Link
                        href={`/operacao/parceiros/${p.id}`}
                        style={{ fontWeight: 600, color: "var(--ed2-ink)", textDecoration: "none" }}
                      >
                        {p.nome}
                      </Link>
                      <div style={{ fontSize: 13, color: "var(--ed2-ink-2)", marginTop: 2 }}>
                        {p.email}
                        {p.status === "pausado" ? " · pausado" : ""}
                      </div>
                    </td>
                    <td style={{ ...td, fontFamily: "var(--font-mono), monospace", fontSize: 13.5 }}>
                      {p.codigo}
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>{p.cliques ?? 0}</td>
                    <td style={{ ...td, textAlign: "right" }}>
                      {p.leads ?? 0}
                      <span style={{ color: "var(--ed2-ink-2)", fontSize: 13 }}>
                        {" "}
                        ({p.autorizados ?? 0} ok)
                      </span>
                    </td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{p.clientes ?? 0}</td>
                    <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      R$ {brl(p.previsto ?? 0)}
                    </td>
                    <td
                      style={{
                        ...td,
                        textAlign: "right",
                        fontWeight: 700,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      R$ {brl(p.aprovado ?? 0)}
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>
                      <button
                        onClick={() => {
                          setEditando(p);
                          setAberto(true);
                        }}
                        style={{
                          padding: "7px 15px",
                          borderRadius: 999,
                          border: "1px solid var(--ed2-hair)",
                          background: "transparent",
                          color: "var(--ed2-ink)",
                          fontSize: 13.5,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {aberto ? (
        <ParceiroModal
          parceiro={editando}
          onFechar={() => setAberto(false)}
          onSalvo={() => {
            setAberto(false);
            flash(editando ? "Parceiro atualizado." : "Parceiro criado.");
            carregar();
          }}
        />
      ) : null}
    </>
  );
}
