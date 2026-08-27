"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, Plus, Check, Star, Globe, PhoneOff } from "lucide-react";
import PageHeader from "@/components/groow/admin/ed2/PageHeader";
import Card, { CardHead } from "@/components/groow/admin/ed2/Card";

/**
 * Achar empresa para ligar. E o topo do funil do parceiro, que antes comecava
 * com ele digitando lead na mao.
 *
 * O contador de buscas fica visivel de proposito: cada busca custa dinheiro do
 * dono, e quem enxerga o limite gasta com mais cuidado do que quem descobre no
 * erro.
 */

interface Empresa {
  place_id: string;
  nome: string;
  telefone: string;
  site: string;
  rating: number | null;
  avaliacoes: number;
  endereco: string;
  semSiteProprio: boolean;
  score: number;
  motivos: string[];
}

export default function ProspeccaoParceiro() {
  const [nicho, setNicho] = useState("");
  const [cidade, setCidade] = useState("");
  const [semSite, setSemSite] = useState(true);
  const [comTelefone, setComTelefone] = useState(true);

  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [restantes, setRestantes] = useState<number | null>(null);
  const [teto, setTeto] = useState<number | null>(null);
  const [importados, setImportados] = useState<Set<string>>(new Set());
  const [importando, setImportando] = useState<string | null>(null);

  const carregarCota = useCallback(async () => {
    try {
      const r = await fetch("/api/parceiro/prospeccao");
      if (!r.ok) return;
      const d = await r.json();
      setRestantes(d.restantes);
      setTeto(d.teto);
    } catch {
      // cota e informativo: falhar aqui nao pode travar a tela
    }
  }, []);

  useEffect(() => {
    carregarCota();
  }, [carregarCota]);

  async function buscar() {
    if (!nicho.trim() || !cidade.trim()) {
      setErro("Preencha o ramo e a cidade.");
      return;
    }
    setBuscando(true);
    setErro(null);
    setAviso(null);
    try {
      const r = await fetch("/api/parceiro/prospeccao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nicho: nicho.trim(),
          cidade: cidade.trim(),
          semSite,
          onlyPhone: comTelefone,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErro(d.error || "Não consegui buscar.");
        if (typeof d.restantes === "number") setRestantes(d.restantes);
        return;
      }
      setEmpresas(Array.isArray(d.empresas) ? d.empresas : []);
      setAviso(d.aviso || null);
      if (typeof d.restantes === "number") setRestantes(d.restantes);
    } catch {
      setErro("Sem conexão. Tente de novo.");
    } finally {
      setBuscando(false);
    }
  }

  async function importar(e: Empresa) {
    setImportando(e.place_id);
    try {
      const r = await fetch("/api/parceiro/prospeccao/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...e, cidade }),
      });
      const d = await r.json();
      if (r.ok && d.criados > 0) {
        setImportados((s) => new Set(s).add(e.place_id));
      } else if (d.semTelefone?.length) {
        setErro(`${e.nome} não tem telefone no Google, então não dá pra ligar.`);
      }
    } finally {
      setImportando(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Achar quem ligar"
        sub="Empresas da sua região que precisam do que a gente vende."
        right={
          restantes !== null ? (
            <span
              style={{
                padding: "7px 14px",
                borderRadius: 999,
                background: restantes > 0 ? "rgba(201,169,97,0.16)" : "rgba(255,59,48,0.12)",
                color: restantes > 0 ? "#8a712d" : "#c8261c",
                fontSize: 12.5,
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              {restantes} de {teto} buscas hoje
            </span>
          ) : null
        }
      />

      <Card style={{ marginBottom: 22 }}>
        <div style={{ display: "grid", gap: 14 }}>
          <div className="prosp-linha" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13 }}>
            <div>
              <label style={rotulo}>Ramo</label>
              <input
                value={nicho}
                onChange={(e) => setNicho(e.target.value)}
                placeholder="padaria, oficina, clínica..."
                style={campo}
              />
            </div>
            <div>
              <label style={rotulo}>Cidade</label>
              <input
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                placeholder="Xanxerê"
                style={campo}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <label style={caixa}>
              <input type="checkbox" checked={semSite} onChange={(e) => setSemSite(e.target.checked)} />
              Só quem não tem site próprio
            </label>
            <label style={caixa}>
              <input
                type="checkbox"
                checked={comTelefone}
                onChange={(e) => setComTelefone(e.target.checked)}
              />
              Só com telefone
            </label>
          </div>

          <button onClick={buscar} disabled={buscando || restantes === 0} style={botao(buscando || restantes === 0)}>
            <Search size={16} />
            {buscando ? "Procurando..." : "Procurar empresas"}
          </button>

          {erro ? <div style={alerta("#c8261c", "rgba(255,59,48,0.10)")}>{erro}</div> : null}
          {aviso ? <div style={alerta("#8a712d", "rgba(201,169,97,0.14)")}>{aviso}</div> : null}
        </div>
      </Card>

      {empresas.length ? (
        <Card>
          <CardHead
            title={`${empresas.length} empresa(s)`}
            sub="Da melhor pra pior. Quem não tem site é quem mais precisa."
          />
          <div style={{ display: "grid", gap: 11 }}>
            {empresas.map((e) => {
              const dentro = importados.has(e.place_id);
              return (
                <div key={e.place_id} style={linha}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 15.5, fontWeight: 600, color: "var(--ed2-ink)" }}>
                        {e.nome}
                      </span>
                      <span style={nota(e.score)}>{e.score}</span>
                    </div>
                    <div style={meta}>
                      {e.telefone ? <span>{e.telefone}</span> : (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <PhoneOff size={12} /> sem telefone
                        </span>
                      )}
                      {e.avaliacoes ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <Star size={12} />
                          {e.rating ?? "-"} · {e.avaliacoes}
                        </span>
                      ) : null}
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <Globe size={12} />
                        {!e.site ? "sem site" : e.semSiteProprio ? "só rede social" : "tem site"}
                      </span>
                    </div>
                    {e.endereco ? (
                      <div style={{ ...meta, marginTop: 3 }}>{e.endereco}</div>
                    ) : null}
                  </div>

                  <button
                    onClick={() => importar(e)}
                    disabled={dentro || importando === e.place_id || !e.telefone}
                    style={botaoAdd(dentro, !e.telefone)}
                  >
                    {dentro ? <Check size={14} /> : <Plus size={14} />}
                    {dentro ? "No funil" : "Ligar pra esse"}
                  </button>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      <style>{`@media (max-width: 640px) {
        .prosp-linha { grid-template-columns: 1fr !important; }
      }`}</style>
    </>
  );
}

const rotulo: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--ed2-ink-2)",
  marginBottom: 6,
};

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

const caixa: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontSize: 13.5,
  color: "var(--ed2-ink)",
  cursor: "pointer",
};

const meta: React.CSSProperties = {
  display: "flex",
  gap: 14,
  flexWrap: "wrap",
  fontSize: 12.5,
  color: "var(--ed2-ink-2)",
  marginTop: 5,
};

const linha: React.CSSProperties = {
  display: "flex",
  gap: 14,
  alignItems: "center",
  flexWrap: "wrap",
  padding: "14px 16px",
  borderRadius: 16,
  background: "var(--ed2-surface)",
  border: "1px solid var(--ed2-hair)",
};

function nota(score: number): React.CSSProperties {
  const cor = score >= 70 ? "#1d8a3a" : score >= 45 ? "#8a712d" : "#7c8698";
  return {
    padding: "2px 9px",
    borderRadius: 999,
    background: `${cor}1f`,
    color: cor,
    fontSize: 11.5,
    fontWeight: 700,
  };
}

function botao(desativado: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "13px 22px",
    borderRadius: 999,
    border: "none",
    background: desativado ? "var(--ed2-hair)" : "#C9A961",
    color: desativado ? "var(--ed2-ink-2)" : "#0B1838",
    fontWeight: 700,
    fontSize: 15,
    cursor: desativado ? "default" : "pointer",
  };
}

function botaoAdd(dentro: boolean, semTel: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    padding: "9px 16px",
    borderRadius: 999,
    border: `1px solid ${dentro ? "#1d8a3a55" : "var(--ed2-hair)"}`,
    background: dentro ? "rgba(52,199,89,0.14)" : "transparent",
    color: dentro ? "#1d8a3a" : semTel ? "var(--ed2-ink-2)" : "var(--ed2-ink)",
    fontWeight: 600,
    fontSize: 13,
    cursor: dentro || semTel ? "default" : "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
  };
}

function alerta(cor: string, fundo: string): React.CSSProperties {
  return {
    padding: "11px 14px",
    borderRadius: 12,
    background: fundo,
    color: cor,
    fontSize: 13.5,
    lineHeight: 1.5,
  };
}
