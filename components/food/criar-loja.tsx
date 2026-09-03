"use client";

import { useState } from "react";
import { IcoCardapio } from "./icones";

// Primeira tela do modulo quando o cliente ainda nao tem loja. O proprio dono
// resolve em 20 segundos, sem depender da agencia.

function paraSlug(t: string): string {
  return t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

export default function CriarLoja({ neg }: { neg: string }) {
  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
  const [tipo, setTipo] = useState("restaurante");
  const [cidade, setCidade] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const slugFinal = slug || paraSlug(nome);

  async function criar() {
    if (!nome.trim() || !slugFinal) { setErro("Falta o nome da casa"); return; }
    setSalvando(true);
    const r = await fetch("/api/food/painel", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ neg, acao: "criar_loja", nome: nome.trim(), slug: slugFinal, tipo, cidade }),
    });
    setSalvando(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setErro(String(d?.erro ?? "").includes("duplicate")
        ? "Ja existe uma loja com esse endereco. Mude o final do link."
        : "Nao foi possivel criar");
      return;
    }
    location.reload();
  }

  return (
    <div style={{ maxWidth: 560, margin: "40px auto" }}>
      <div className="card">
        <span className="icon-box" style={{ marginBottom: 12 }}><IcoCardapio /></span>
        <h1 style={{ fontSize: 22, margin: "0 0 6px" }}>Vamos criar a sua loja</h1>
        <p className="muted" style={{ margin: "0 0 20px", fontSize: 14 }}>
          E o primeiro passo. Depois vem o cardapio, as mesas e os cartoes.
        </p>

        <label style={{ marginTop: 0 }}>Nome da casa</label>
        <input value={nome} autoFocus onChange={(e) => setNome(e.target.value)} placeholder="Boteco do Ze" />

        <label>Endereco do cardapio</label>
        <div className="row" style={{ gap: 6 }}>
          <span className="muted" style={{ fontSize: 13 }}>/c/</span>
          <input value={slugFinal} onChange={(e) => setSlug(paraSlug(e.target.value))} />
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          E o link que vai no cartao da mesa e na bio do Instagram. Curto e melhor.
        </p>

        <div className="cols-2">
          <div>
            <label>Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {["restaurante", "bar", "pizzaria", "lanchonete", "cafe", "sorveteria", "outro"].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Cidade</label>
            <input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Xanxere" />
          </div>
        </div>

        {erro && <div className="err">{erro}</div>}

        <button className="btn" style={{ marginTop: 18, width: "100%", padding: 13 }}
                onClick={criar} disabled={salvando}>
          {salvando ? "Criando..." : "Criar loja"}
        </button>
      </div>
    </div>
  );
}
