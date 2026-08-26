"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Eraser } from "lucide-react";
import { CHECAGEM } from "@/lib/groow/oferta-local";

const CHAVE = "ed-checagem-perfil";

/**
 * Rascunho que o parceiro preenche olhando o perfil do Google, antes de discar.
 *
 * Fica só no navegador dele de propósito: as colunas para isso não existem em
 * parceiro_leads, e inventar tabela agora era atrasar a tela. Quando o lead for
 * registrado, ele cola essas anotações no campo de observação.
 */
export default function ChecagemPerfil() {
  const [empresa, setEmpresa] = useState("");
  const [valores, setValores] = useState<Record<string, string>>({});
  const [copiado, setCopiado] = useState(false);

  // Só depois da montagem: no servidor não existe localStorage e ler no render
  // daria hidratação divergente.
  useEffect(() => {
    try {
      const cru = localStorage.getItem(CHAVE);
      if (!cru) return;
      const d = JSON.parse(cru) as { empresa?: string; valores?: Record<string, string> };
      setEmpresa(d.empresa ?? "");
      setValores(d.valores ?? {});
    } catch {
      // navegador com storage bloqueado: a tela funciona igual, só não lembra
    }
  }, []);

  function salvar(proxEmpresa: string, proxValores: Record<string, string>) {
    try {
      localStorage.setItem(CHAVE, JSON.stringify({ empresa: proxEmpresa, valores: proxValores }));
    } catch {
      // idem
    }
  }

  function mudar(id: string, v: string) {
    const prox = { ...valores, [id]: v };
    setValores(prox);
    salvar(empresa, prox);
  }

  function mudarEmpresa(v: string) {
    setEmpresa(v);
    salvar(v, valores);
  }

  function limpar() {
    setEmpresa("");
    setValores({});
    salvar("", {});
  }

  function texto(): string {
    const linhas = CHECAGEM.filter((c) => (valores[c.id] || "").trim()).map(
      (c) => `${c.pergunta} ${valores[c.id].trim()}`
    );
    if (!linhas.length) return "";
    return [empresa.trim() ? `Perfil do Google, ${empresa.trim()}` : "Perfil do Google", ...linhas].join(
      "\n"
    );
  }

  async function copiar() {
    const t = texto();
    if (!t) return;
    try {
      await navigator.clipboard.writeText(t);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // clipboard bloqueado
    }
  }

  const preenchidos = CHECAGEM.filter((c) => (valores[c.id] || "").trim()).length;

  return (
    <div>
      <input
        value={empresa}
        onChange={(e) => mudarEmpresa(e.target.value)}
        placeholder="Nome da empresa"
        style={{ ...campo, marginBottom: 18, fontWeight: 600 }}
      />

      <div style={{ display: "grid", gap: 16 }}>
        {CHECAGEM.map((c) => (
          <div key={c.id}>
            <label
              htmlFor={`chk-${c.id}`}
              style={{
                display: "block",
                fontSize: 14.5,
                fontWeight: 600,
                color: "var(--ed2-ink)",
                marginBottom: 5,
              }}
            >
              {c.pergunta}
            </label>
            <div style={{ fontSize: 12.5, color: "var(--ed2-ink-2)", marginBottom: 7, lineHeight: 1.5 }}>
              {c.ajuda}
            </div>
            <input
              id={`chk-${c.id}`}
              value={valores[c.id] ?? ""}
              onChange={(e) => mudar(c.id, e.target.value)}
              style={campo}
            />
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
          marginTop: 20,
          paddingTop: 18,
          borderTop: "1px solid var(--ed2-hair)",
        }}
      >
        <button onClick={copiar} disabled={!preenchidos} style={botaoPrimario(!preenchidos)}>
          {copiado ? <Check size={16} /> : <Copy size={16} />}
          {copiado ? "Copiado" : "Copiar anotação"}
        </button>
        <button onClick={limpar} style={botaoSecundario}>
          <Eraser size={15} />
          Limpar
        </button>
        <span style={{ fontSize: 12.5, color: "var(--ed2-ink-2)" }}>
          {preenchidos} de {CHECAGEM.length} anotados. Fica salvo neste navegador até você limpar.
        </span>
      </div>
    </div>
  );
}

const campo: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: 12,
  border: "1px solid var(--ed2-hair)",
  background: "var(--ed2-surface)",
  color: "var(--ed2-ink)",
  fontSize: 14.5,
};

function botaoPrimario(desativado: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "11px 20px",
    borderRadius: 999,
    border: "none",
    background: desativado ? "var(--ed2-hair)" : "#C9A961",
    color: desativado ? "var(--ed2-ink-2)" : "#0B1838",
    fontWeight: 700,
    fontSize: 14,
    cursor: desativado ? "default" : "pointer",
  };
}

const botaoSecundario: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  padding: "11px 18px",
  borderRadius: 999,
  border: "1px solid var(--ed2-hair)",
  background: "transparent",
  color: "var(--ed2-ink-2)",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
};
