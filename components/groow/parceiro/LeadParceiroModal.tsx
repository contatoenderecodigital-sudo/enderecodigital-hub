"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { ParceiroLead, SituacaoLead } from "@/lib/groow/parceiros";

const campo: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: 12,
  border: "1px solid var(--ed2-hair)",
  background: "var(--ed2-surface)",
  color: "var(--ed2-ink)",
  fontSize: 14.5,
  outline: "none",
};

const rotulo: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--ed2-ink-2)",
  marginBottom: 6,
};

const SITUACOES: { valor: SituacaoLead; label: string; ajuda: string }[] = [
  { valor: "ligou", label: "Liguei", ajuda: "Falei, mas não avançou ainda." },
  { valor: "vai_chamar", label: "Disse que vai chamar", ajuda: "Ficou de entrar em contato." },
  {
    valor: "autorizou",
    label: "Autorizou contato",
    ajuda: "Deixou a gente chamar no WhatsApp dele.",
  },
  { valor: "recusou", label: "Recusou", ajuda: "Não quer ser contatado." },
];

export default function LeadParceiroModal({
  lead,
  onFechar,
  onSalvo,
}: {
  lead: ParceiroLead | null;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const editando = !!lead;
  const [situacao, setSituacao] = useState<SituacaoLead>(lead?.situacao ?? "ligou");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const exigeProva = situacao === "autorizou";

  async function salvar(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setErro(null);
    const fd = new FormData(ev.currentTarget);
    const corpo: Record<string, unknown> = {
      nome: fd.get("nome"),
      empresa: fd.get("empresa"),
      telefone: fd.get("telefone"),
      email: fd.get("email"),
      cidade: fd.get("cidade"),
      setor: fd.get("setor"),
      situacao,
      optin: situacao === "autorizou",
      optin_prova: fd.get("optin_prova"),
      observacao: fd.get("observacao"),
    };
    if (editando) corpo.id = lead!.id;

    setSalvando(true);
    try {
      const r = await fetch("/api/parceiro/leads", {
        method: editando ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErro(d.error || "Não consegui salvar.");
        return;
      }
      onSalvo();
    } catch {
      setErro("Sem conexão. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onFechar();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(11,24,56,0.45)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "48px 20px",
        overflowY: "auto",
        zIndex: 60,
      }}
    >
      <div
        style={{
          background: "var(--ed2-card)",
          borderRadius: 24,
          width: "100%",
          maxWidth: 620,
          padding: "28px 30px 30px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 22,
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: 24,
                fontWeight: 600,
                letterSpacing: "-0.025em",
                color: "var(--ed2-ink)",
              }}
            >
              {editando ? "Editar lead" : "Novo lead da call"}
            </h2>
            <p style={{ margin: "5px 0 0", fontSize: 14, color: "var(--ed2-ink-2)" }}>
              {editando
                ? "Atualize o que mudou depois do último contato."
                : "Cadastre logo depois de desligar, enquanto está fresco."}
            </p>
          </div>
          <button
            onClick={onFechar}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--ed2-ink-2)",
              padding: 4,
            }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={salvar} style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={rotulo} htmlFor="nome">
                Nome
              </label>
              <input
                id="nome"
                name="nome"
                required
                maxLength={160}
                defaultValue={lead?.nome ?? ""}
                style={campo}
              />
            </div>
            <div>
              <label style={rotulo} htmlFor="telefone">
                WhatsApp com DDD
              </label>
              <input
                id="telefone"
                name="telefone"
                required
                maxLength={24}
                placeholder="49 99999 9999"
                defaultValue={lead?.telefone ?? ""}
                readOnly={editando}
                style={{ ...campo, opacity: editando ? 0.6 : 1 }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={rotulo} htmlFor="empresa">
                Empresa
              </label>
              <input
                id="empresa"
                name="empresa"
                maxLength={160}
                defaultValue={lead?.empresa ?? ""}
                style={campo}
              />
            </div>
            <div>
              <label style={rotulo} htmlFor="cidade">
                Cidade
              </label>
              <input
                id="cidade"
                name="cidade"
                maxLength={120}
                defaultValue={lead?.cidade ?? ""}
                style={campo}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={rotulo} htmlFor="setor">
                Ramo
              </label>
              <input
                id="setor"
                name="setor"
                maxLength={120}
                placeholder="pizzaria, clínica, loja..."
                defaultValue={lead?.setor ?? ""}
                style={campo}
              />
            </div>
            <div>
              <label style={rotulo} htmlFor="email">
                E-mail
              </label>
              <input
                id="email"
                name="email"
                type="email"
                maxLength={190}
                defaultValue={lead?.email ?? ""}
                style={campo}
              />
            </div>
          </div>

          <div>
            <label style={rotulo}>Como ficou a ligação</label>
            <div style={{ display: "grid", gap: 8 }}>
              {SITUACOES.map((s) => (
                <label
                  key={s.valor}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 11,
                    padding: "12px 14px",
                    borderRadius: 14,
                    border: `1px solid ${situacao === s.valor ? "#C9A961" : "var(--ed2-hair)"}`,
                    background: situacao === s.valor ? "rgba(201,169,97,0.08)" : "transparent",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="situacao"
                    checked={situacao === s.valor}
                    onChange={() => setSituacao(s.valor)}
                    style={{ marginTop: 3 }}
                  />
                  <span>
                    <span style={{ display: "block", fontSize: 14.5, fontWeight: 600, color: "var(--ed2-ink)" }}>
                      {s.label}
                    </span>
                    <span style={{ display: "block", fontSize: 13, color: "var(--ed2-ink-2)", marginTop: 1 }}>
                      {s.ajuda}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {exigeProva ? (
            <div>
              <label style={rotulo} htmlFor="optin_prova">
                O que ele disse, com as palavras dele
              </label>
              <textarea
                id="optin_prova"
                name="optin_prova"
                rows={3}
                required
                maxLength={2000}
                defaultValue={lead?.optin_prova ?? ""}
                placeholder='Ex.: "Pode mandar no zap sim, esse número mesmo, hoje à tarde."'
                style={{ ...campo, resize: "vertical", fontFamily: "inherit" }}
              />
              <p style={{ margin: "7px 0 0", fontSize: 12.5, color: "var(--ed2-ink-2)", lineHeight: 1.55 }}>
                Isto é a prova da autorização. Sem ela a gente não pode abrir conversa
                no WhatsApp, é regra da Meta e não é negociável.
              </p>
            </div>
          ) : null}

          <div>
            <label style={rotulo} htmlFor="observacao">
              Anotações da ligação
            </label>
            <textarea
              id="observacao"
              name="observacao"
              rows={3}
              maxLength={2000}
              defaultValue={lead?.observacao ?? ""}
              placeholder="Dor que ele citou, plataforma que usa, quanto perde por mês..."
              style={{ ...campo, resize: "vertical", fontFamily: "inherit" }}
            />
          </div>

          {erro ? (
            <div
              style={{
                padding: "11px 14px",
                borderRadius: 12,
                background: "rgba(255,59,48,0.10)",
                color: "#c8261c",
                fontSize: 14,
              }}
            >
              {erro}
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
            <button
              type="button"
              onClick={onFechar}
              style={{
                padding: "12px 22px",
                borderRadius: 999,
                border: "1px solid var(--ed2-hair)",
                background: "transparent",
                color: "var(--ed2-ink)",
                fontSize: 14.5,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              style={{
                padding: "12px 26px",
                borderRadius: 999,
                border: "none",
                background: salvando ? "rgba(201,169,97,0.5)" : "#C9A961",
                color: "#0B1838",
                fontSize: 14.5,
                fontWeight: 700,
                cursor: salvando ? "default" : "pointer",
              }}
            >
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
