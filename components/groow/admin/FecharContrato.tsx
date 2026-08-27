"use client";

import { useState } from "react";
import { X } from "lucide-react";

/**
 * Cadastro do cliente no momento em que a reuniao vira contrato.
 *
 * Existe para tapar o unico buraco do fluxo: marcar "Fechou" nao cria comissao,
 * quem cria e o cliente com valor e data de inicio. Sem isto o dono marcava numa
 * tela e precisava lembrar de cadastrar noutra, e o painel mostrava R$ 0,00 com
 * venda fechada.
 */
export default function FecharContrato({
  calUid,
  nome,
  empresa,
  parceiroNome,
  onPronto,
  onCancelar,
}: {
  calUid: string;
  nome: string;
  empresa: string | null;
  parceiroNome: string | null;
  onPronto: (msg: string) => void;
  onCancelar: () => void;
}) {
  const hoje = new Date();
  const [form, setForm] = useState({
    empresa: empresa || nome,
    valor_setup: "1200",
    valor_mensal: "247",
    inicio_contrato: `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(
      hoje.getDate()
    ).padStart(2, "0")}`,
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      const r = await fetch("/api/admin/reunioes/cliente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cal_uid: calUid, ...form }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErro(d.error || "Não consegui cadastrar.");
        return;
      }
      const a = d.apuracao || {};
      onPronto(
        `Cliente cadastrado e comissão apurada em ${a.competencia || "—"}: ${
          a.criadas || 0
        } lançamento(s) novo(s).`
      );
    } catch {
      setErro("Sem conexão. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  const campo = (rotulo: string, chave: keyof typeof form, tipo = "text", ajuda?: string) => (
    <div>
      <label style={rotuloEstilo}>{rotulo}</label>
      <input
        type={tipo}
        value={form[chave]}
        onChange={(e) => setForm({ ...form, [chave]: e.target.value })}
        style={input}
      />
      {ajuda ? (
        <div style={{ fontSize: 11.5, color: "var(--ed2-ink-2)", marginTop: 5 }}>{ajuda}</div>
      ) : null}
    </div>
  );

  return (
    <div
      onClick={onCancelar}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(11,24,56,0.45)",
        zIndex: 120,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 470,
          background: "var(--ed2-card)",
          borderRadius: 24,
          padding: "26px 26px 24px",
          boxShadow: "0 30px 80px -30px rgba(0,0,0,0.5)",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 14, marginBottom: 6 }}>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "var(--ed2-ink)" }}>
            Fechou com {nome.split(" ")[0]}
          </h3>
          <button onClick={onCancelar} style={fechar} aria-label="Fechar">
            <X size={16} />
          </button>
        </div>
        <p
          style={{
            margin: "0 0 20px",
            fontSize: 13.5,
            color: "var(--ed2-ink-2)",
            lineHeight: 1.55,
          }}
        >
          {parceiroNome
            ? `Indicação de ${parceiroNome}. A comissão dele nasce aqui, não no card.`
            : "Sem indicação de parceiro, então não gera comissão."}
        </p>

        <div style={{ display: "grid", gap: 15 }}>
          {campo("Empresa", "empresa")}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13 }}>
            {campo("Implantação (R$)", "valor_setup")}
            {campo("Mensalidade (R$)", "valor_mensal")}
          </div>
          {campo(
            "Início do contrato",
            "inicio_contrato",
            "date",
            "A comissão é lançada na competência desta data."
          )}
        </div>

        {erro ? (
          <div
            style={{
              marginTop: 16,
              padding: "11px 14px",
              borderRadius: 12,
              background: "rgba(255,59,48,0.10)",
              color: "#c8261c",
              fontSize: 13.5,
            }}
          >
            {erro}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 22 }}>
          <button onClick={onCancelar} style={secundario}>
            Cancelar
          </button>
          <button onClick={salvar} disabled={salvando} style={primario}>
            {salvando ? "Salvando..." : "Cadastrar e apurar"}
          </button>
        </div>
      </div>
    </div>
  );
}

const rotuloEstilo: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--ed2-ink-2)",
  marginBottom: 6,
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: 12,
  border: "1px solid var(--ed2-hair)",
  background: "var(--ed2-surface)",
  color: "var(--ed2-ink)",
  fontSize: 14.5,
  outline: "none",
};

const fechar: React.CSSProperties = {
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
  flexShrink: 0,
};

const secundario: React.CSSProperties = {
  padding: "11px 20px",
  borderRadius: 999,
  border: "1px solid var(--ed2-hair)",
  background: "transparent",
  color: "var(--ed2-ink-2)",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
};

const primario: React.CSSProperties = {
  padding: "11px 22px",
  borderRadius: 999,
  border: "none",
  background: "#C9A961",
  color: "#0B1838",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
};
