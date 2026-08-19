"use client";

import { useState } from "react";

const campo: React.CSSProperties = {
  width: "100%",
  padding: "13px 15px",
  borderRadius: 12,
  border: "1px solid rgba(245,242,234,0.16)",
  background: "rgba(255,255,255,0.04)",
  color: "#F5F2EA",
  fontSize: 15,
  outline: "none",
};

const rotulo: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "rgba(245,242,234,0.55)",
  marginBottom: 7,
};

export default function FormIndicacao({
  codigo,
  linkWhats,
}: {
  codigo: string;
  linkWhats: string | null;
}) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);
  const [whatsFinal, setWhatsFinal] = useState<string | null>(linkWhats);

  async function enviar(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setErro(null);
    const fd = new FormData(ev.currentTarget);
    setEnviando(true);
    try {
      const resp = await fetch("/api/indicacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo,
          nome: fd.get("nome"),
          telefone: fd.get("telefone"),
          empresa: fd.get("empresa"),
          cidade: fd.get("cidade"),
        }),
      });
      const dados = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setErro(dados.error || "Não consegui enviar. Tente de novo.");
        return;
      }
      if (dados.whatsapp) setWhatsFinal(dados.whatsapp);
      setPronto(true);
    } catch {
      setErro("Sem conexão. Tente de novo em instantes.");
    } finally {
      setEnviando(false);
    }
  }

  if (pronto) {
    return (
      <div
        style={{
          padding: "28px 26px",
          borderRadius: 20,
          background: "rgba(201,169,97,0.10)",
          border: "1px solid rgba(201,169,97,0.30)",
        }}
      >
        <h3 style={{ margin: "0 0 8px", fontSize: 21, fontWeight: 600, color: "#F5F2EA" }}>
          Recebido. Vamos te chamar.
        </h3>
        <p style={{ margin: "0 0 20px", color: "rgba(245,242,234,0.72)", fontSize: 15, lineHeight: 1.6 }}>
          Seu diagnóstico já entrou na fila. Se quiser adiantar, chame agora no WhatsApp
          e a gente começa pela sua operação hoje mesmo.
        </p>
        {whatsFinal ? (
          <a
            href={whatsFinal}
            style={{
              display: "inline-block",
              padding: "14px 26px",
              borderRadius: 999,
              background: "#C9A961",
              color: "#0B1838",
              fontWeight: 700,
              fontSize: 15,
              textDecoration: "none",
            }}
          >
            Chamar no WhatsApp
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <form onSubmit={enviar} style={{ display: "grid", gap: 16 }}>
      <div>
        <label style={rotulo} htmlFor="nome">
          Seu nome
        </label>
        <input id="nome" name="nome" required maxLength={160} style={campo} autoComplete="name" />
      </div>
      <div>
        <label style={rotulo} htmlFor="telefone">
          WhatsApp com DDD
        </label>
        <input
          id="telefone"
          name="telefone"
          required
          inputMode="tel"
          placeholder="49 99999 9999"
          maxLength={24}
          style={campo}
          autoComplete="tel"
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div>
          <label style={rotulo} htmlFor="empresa">
            Empresa
          </label>
          <input id="empresa" name="empresa" maxLength={160} style={campo} />
        </div>
        <div>
          <label style={rotulo} htmlFor="cidade">
            Cidade
          </label>
          <input id="cidade" name="cidade" maxLength={120} style={campo} />
        </div>
      </div>

      {erro ? (
        <div
          style={{
            padding: "11px 14px",
            borderRadius: 12,
            background: "rgba(239,68,68,0.12)",
            border: "1px solid rgba(239,68,68,0.35)",
            color: "#FCA5A5",
            fontSize: 14,
          }}
        >
          {erro}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={enviando}
        style={{
          padding: "15px 26px",
          borderRadius: 999,
          border: "none",
          background: enviando ? "rgba(201,169,97,0.5)" : "#C9A961",
          color: "#0B1838",
          fontWeight: 700,
          fontSize: 16,
          cursor: enviando ? "default" : "pointer",
        }}
      >
        {enviando ? "Enviando..." : "Quero meu diagnóstico"}
      </button>

      <p style={{ margin: 0, fontSize: 12.5, color: "rgba(245,242,234,0.45)", lineHeight: 1.6 }}>
        Ao enviar, você autoriza a Endereço Digital a entrar em contato pelo WhatsApp
        informado. Sem custo e sem compromisso.
      </p>
    </form>
  );
}
