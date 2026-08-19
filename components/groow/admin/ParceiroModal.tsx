"use client";

import { useState } from "react";
import { X } from "lucide-react";

export interface ParceiroLinha {
  id: number;
  nome: string;
  email: string;
  telefone: string | null;
  codigo: string;
  comissao_setup_pct: number;
  comissao_mensal_pct: number;
  comissao_meses: number;
  status: string;
  cliques?: number;
  leads?: number;
  autorizados?: number;
  promovidos?: number;
  clientes?: number;
  previsto?: number;
  aprovado?: number;
  pago?: number;
}

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

export default function ParceiroModal({
  parceiro,
  onFechar,
  onSalvo,
}: {
  parceiro: ParceiroLinha | null;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const editando = !!parceiro;
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setErro(null);
    const fd = new FormData(ev.currentTarget);
    const corpo: Record<string, unknown> = {
      nome: fd.get("nome"),
      email: fd.get("email"),
      telefone: fd.get("telefone"),
      codigo: fd.get("codigo"),
      senha: fd.get("senha"),
      comissao_setup_pct: Number(fd.get("comissao_setup_pct") || 0),
      comissao_mensal_pct: Number(fd.get("comissao_mensal_pct") || 0),
      comissao_meses: Number(fd.get("comissao_meses") || 12),
      status: fd.get("status"),
      observacao: fd.get("observacao"),
    };
    if (editando) corpo.id = parceiro!.id;

    setSalvando(true);
    try {
      const r = await fetch("/api/admin/parceiros", {
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
          <h2
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: "-0.025em",
              color: "var(--ed2-ink)",
            }}
          >
            {editando ? "Editar parceiro" : "Novo parceiro"}
          </h2>
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
              <input id="nome" name="nome" required maxLength={160} defaultValue={parceiro?.nome ?? ""} style={campo} />
            </div>
            <div>
              <label style={rotulo} htmlFor="telefone">
                WhatsApp
              </label>
              <input id="telefone" name="telefone" maxLength={32} defaultValue={parceiro?.telefone ?? ""} style={campo} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={rotulo} htmlFor="email">
                E-mail de acesso
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                maxLength={190}
                defaultValue={parceiro?.email ?? ""}
                readOnly={editando}
                style={{ ...campo, opacity: editando ? 0.6 : 1 }}
              />
            </div>
            <div>
              <label style={rotulo} htmlFor="senha">
                {editando ? "Nova senha (deixe vazio para manter)" : "Senha inicial"}
              </label>
              <input
                id="senha"
                name="senha"
                type="text"
                minLength={8}
                maxLength={64}
                required={!editando}
                placeholder="mínimo 8 caracteres"
                style={campo}
              />
            </div>
          </div>

          <div>
            <label style={rotulo} htmlFor="codigo">
              Código do link
            </label>
            <input
              id="codigo"
              name="codigo"
              maxLength={32}
              placeholder="deixe vazio para gerar a partir do nome"
              defaultValue={parceiro?.codigo ?? ""}
              style={{ ...campo, fontFamily: "var(--font-mono), monospace" }}
            />
            <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "var(--ed2-ink-2)" }}>
              Vira o link público: /p/codigo. Trocar o código quebra os links já
              distribuídos.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            <div>
              <label style={rotulo} htmlFor="comissao_setup_pct">
                % implantação
              </label>
              <input
                id="comissao_setup_pct"
                name="comissao_setup_pct"
                type="number"
                min={0}
                max={100}
                step="0.5"
                defaultValue={parceiro?.comissao_setup_pct ?? 20}
                style={campo}
              />
            </div>
            <div>
              <label style={rotulo} htmlFor="comissao_mensal_pct">
                % mensalidade
              </label>
              <input
                id="comissao_mensal_pct"
                name="comissao_mensal_pct"
                type="number"
                min={0}
                max={100}
                step="0.5"
                defaultValue={parceiro?.comissao_mensal_pct ?? 10}
                style={campo}
              />
            </div>
            <div>
              <label style={rotulo} htmlFor="comissao_meses">
                Por quantos meses
              </label>
              <input
                id="comissao_meses"
                name="comissao_meses"
                type="number"
                min={1}
                max={120}
                defaultValue={parceiro?.comissao_meses ?? 12}
                style={campo}
              />
            </div>
          </div>

          <div>
            <label style={rotulo} htmlFor="status">
              Status
            </label>
            <select id="status" name="status" defaultValue={parceiro?.status ?? "ativo"} style={campo}>
              <option value="ativo">Ativo</option>
              <option value="pausado">Pausado (não entra, link para de funcionar)</option>
            </select>
          </div>

          <div>
            <label style={rotulo} htmlFor="observacao">
              Observação interna
            </label>
            <textarea
              id="observacao"
              name="observacao"
              rows={2}
              maxLength={2000}
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
