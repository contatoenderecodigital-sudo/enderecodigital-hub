"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import PageHeader from "@/components/groow/admin/ed2/PageHeader";
import Card from "@/components/groow/admin/ed2/Card";
import LeadParceiroModal from "@/components/groow/parceiro/LeadParceiroModal";
import type { ParceiroLead } from "@/lib/groow/parceiros";

const SITUACAO_LABEL: Record<string, string> = {
  ligou: "Liguei",
  vai_chamar: "Vai chamar",
  autorizou: "Autorizou contato",
  recusou: "Recusou",
};

const SITUACAO_COR: Record<string, { bg: string; fg: string }> = {
  ligou: { bg: "rgba(11,24,56,0.07)", fg: "var(--ed2-ink-2)" },
  vai_chamar: { bg: "rgba(201,169,97,0.16)", fg: "#8a712d" },
  autorizou: { bg: "rgba(52,199,89,0.16)", fg: "#1d8a3a" },
  recusou: { bg: "rgba(255,59,48,0.12)", fg: "#c8261c" },
};

function Pill({ texto, cor }: { texto: string; cor: { bg: string; fg: string } }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 11px",
        borderRadius: 999,
        fontSize: 12.5,
        fontWeight: 600,
        background: cor.bg,
        color: cor.fg,
        whiteSpace: "nowrap",
      }}
    >
      {texto}
    </span>
  );
}

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

function telefoneLegivel(t: string): string {
  const d = t.replace(/\D/g, "").replace(/^55/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return t;
}

export default function LeadsDoParceiro() {
  const [leads, setLeads] = useState<ParceiroLead[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<ParceiroLead | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await fetch("/api/parceiro/leads");
      const d = await r.json();
      setLeads(Array.isArray(d.leads) ? d.leads : []);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l) =>
      [l.nome, l.empresa, l.telefone, l.cidade].some((v) =>
        String(v || "").toLowerCase().includes(q)
      )
    );
  }, [leads, busca]);

  function flash(msg: string) {
    setAviso(msg);
    setTimeout(() => setAviso(null), 3200);
  }

  return (
    <>
      <PageHeader
        title="Meus leads"
        sub="Registre aqui quem você ligou. Quem autorizou contato entra na fila de disparo."
        right={
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
            Novo lead
          </button>
        }
      />

      {aviso ? (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 14,
            background: "rgba(52,199,89,0.12)",
            color: "#1d8a3a",
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 18,
          }}
        >
          {aviso}
        </div>
      ) : null}

      <Card padding={22}>
        <div style={{ position: "relative", marginBottom: 18, maxWidth: 380 }}>
          <Search
            size={16}
            style={{
              position: "absolute",
              left: 14,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--ed2-ink-2)",
            }}
          />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, empresa ou telefone"
            style={{
              width: "100%",
              padding: "11px 14px 11px 40px",
              borderRadius: 12,
              border: "1px solid var(--ed2-hair)",
              background: "var(--ed2-surface)",
              color: "var(--ed2-ink)",
              fontSize: 14.5,
              outline: "none",
            }}
          />
        </div>

        {carregando ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: "var(--ed2-ink-2)" }}>
            Carregando...
          </div>
        ) : filtrados.length === 0 ? (
          <div style={{ padding: "56px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 17, fontWeight: 600, color: "var(--ed2-ink)", marginBottom: 6 }}>
              {leads.length === 0 ? "Nenhum lead ainda" : "Nada encontrado"}
            </div>
            <div style={{ fontSize: 14.5, color: "var(--ed2-ink-2)" }}>
              {leads.length === 0
                ? "Assim que terminar uma ligação, cadastre o contato aqui."
                : "Tente outro termo de busca."}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 780 }}>
              <thead>
                <tr>
                  <th style={th}>Contato</th>
                  <th style={th}>WhatsApp</th>
                  <th style={th}>Situação</th>
                  <th style={th}>Disparo</th>
                  <th style={th}>Na operação</th>
                  <th style={th} />
                </tr>
              </thead>
              <tbody>
                {filtrados.map((l) => (
                  <tr key={l.id}>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{l.nome}</div>
                      {l.empresa || l.cidade ? (
                        <div style={{ fontSize: 13, color: "var(--ed2-ink-2)", marginTop: 2 }}>
                          {[l.empresa, l.cidade].filter(Boolean).join(" · ")}
                        </div>
                      ) : null}
                    </td>
                    <td style={{ ...td, fontVariantNumeric: "tabular-nums" }}>
                      {telefoneLegivel(l.telefone)}
                    </td>
                    <td style={td}>
                      <Pill
                        texto={SITUACAO_LABEL[l.situacao] || l.situacao}
                        cor={SITUACAO_COR[l.situacao] || SITUACAO_COR.ligou}
                      />
                    </td>
                    <td style={{ ...td, color: "var(--ed2-ink-2)", fontSize: 13.5 }}>
                      {l.disparo_status === "pendente"
                        ? l.optin
                          ? "Na fila"
                          : "Aguardando autorização"
                        : l.disparo_status === "enviado"
                          ? "Enviado"
                          : l.disparo_status === "respondeu"
                            ? "Respondeu"
                            : "Falhou"}
                    </td>
                    <td style={{ ...td, color: "var(--ed2-ink-2)", fontSize: 13.5 }}>
                      {l.lead_id ? l.lead_status || "em atendimento" : "não enviado"}
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>
                      <button
                        onClick={() => {
                          setEditando(l);
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
        <LeadParceiroModal
          lead={editando}
          onFechar={() => setAberto(false)}
          onSalvo={() => {
            setAberto(false);
            flash(editando ? "Lead atualizado." : "Lead cadastrado.");
            carregar();
          }}
        />
      ) : null}
    </>
  );
}
