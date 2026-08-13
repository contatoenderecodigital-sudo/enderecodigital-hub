"use client";

import { useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

export default function Chat({ nome }: { nome: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const texto = input.trim();
    if (!texto || loading) return;
    const novo: Msg[] = [...msgs, { role: "user", content: texto }];
    setMsgs(novo);
    setInput("");
    setLoading(true);
    try {
      const r = await fetch("/api/assistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: novo }),
      });
      const d = await r.json();
      setMsgs([...novo, { role: "assistant", content: d.resposta || d.erro || "(erro)" }]);
    } catch {
      setMsgs([...novo, { role: "assistant", content: "Erro de conexao." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 720, marginTop: 16, display: "flex", flexDirection: "column", height: 520 }}>
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, paddingRight: 4 }}>
        {msgs.length === 0 && (
          <p className="muted">Converse com a IA de {nome}. Ela responde com base no cérebro do negócio.</p>
        )}
        {msgs.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "82%",
              background: m.role === "user" ? "var(--cor-destaque)" : "rgba(255,255,255,0.06)",
              color: m.role === "user" ? "#10204a" : "var(--cor-texto)",
              border: m.role === "user" ? "none" : "1px solid var(--cor-borda)",
              padding: "10px 13px",
              borderRadius: 12,
              fontSize: 14.5,
              whiteSpace: "pre-wrap",
              lineHeight: 1.45,
            }}
          >
            {m.content}
          </div>
        ))}
        {loading && <div className="muted" style={{ fontSize: 13 }}>digitando...</div>}
      </div>
      <form onSubmit={enviar} className="row" style={{ marginTop: 12, gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escreva uma mensagem..."
          style={{ flex: 1 }}
        />
        <button className="btn" type="submit" disabled={loading}>
          Enviar
        </button>
      </form>
    </div>
  );
}
