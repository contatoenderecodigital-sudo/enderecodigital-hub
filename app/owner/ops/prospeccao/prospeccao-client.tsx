"use client";

import { useState } from "react";
import { IcoSearch, IcoWhatsapp, IcoGlobe, IcoPlus, IcoFunnel } from "@/components/icons";

interface Empresa {
  place_id: string;
  nome: string;
  telefone: string;
  site: string;
  rating: number | null;
  avaliacoes: number;
  endereco: string;
  ativo: boolean;
  semSiteProprio: boolean;
  jaImportado: boolean;
  statusExistente: string | null;
  score: number;
}

function corScore(s: number) {
  if (s >= 70) return "ok";
  if (s >= 45) return "gold";
  return "";
}

export default function ProspeccaoClient() {
  const [f, setF] = useState({ nicho: "", cidade: "", bairro: "", minRating: 0, minReviews: 0, onlyPhone: false, semSite: false, maxPaginas: 1 });
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [importando, setImportando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErro(null); setMsg(null); setEmpresas([]); setSel(new Set());
    try {
      const r = await fetch("/api/owner/prospeccao", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f),
      });
      const d = await r.json();
      if (!r.ok) { setErro(d.error || "Erro na busca."); return; }
      setEmpresas(d.empresas || []);
      if (d.aviso) setMsg(d.aviso);
      else setMsg(`${d.empresas?.length || 0} empresas (de ${d.totalBruto} achadas) — melhores prospects primeiro.`);
    } catch { setErro("Falha de conexão."); }
    finally { setLoading(false); }
  }

  function toggle(id: string) {
    const n = new Set(sel);
    n.has(id) ? n.delete(id) : n.add(id);
    setSel(n);
  }
  function todos() {
    const importaveis = empresas.filter((e) => !e.jaImportado).map((e) => e.place_id);
    setSel(sel.size === importaveis.length ? new Set() : new Set(importaveis));
  }

  async function importar() {
    const escolhidas = empresas.filter((e) => sel.has(e.place_id));
    if (escolhidas.length === 0) return;
    setImportando(true); setErro(null);
    try {
      const r = await fetch("/api/owner/prospeccao/importar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresas: escolhidas, setor: f.nicho, cidade: f.cidade }),
      });
      const d = await r.json();
      if (!r.ok) { setErro(d.error || "Erro ao importar."); return; }
      setMsg(`${d.inseridos} lead(s) importados${d.duplicados ? `, ${d.duplicados} já existiam` : ""}. Veja em Leads.`);
      setEmpresas((prev) => prev.map((e) => sel.has(e.place_id) ? { ...e, jaImportado: true, statusExistente: "novo" } : e));
      setSel(new Set());
    } catch { setErro("Falha ao importar."); }
    finally { setImportando(false); }
  }

  return (
    <>
      {/* busca */}
      <form onSubmit={buscar} className="card">
        <div className="cols-3" style={{ gap: 12 }}>
          <div><label>Nicho *</label><input value={f.nicho} onChange={(e) => setF({ ...f, nicho: e.target.value })} placeholder="Ex.: barbearia, dentista, restaurante" required /></div>
          <div><label>Cidade *</label><input value={f.cidade} onChange={(e) => setF({ ...f, cidade: e.target.value })} placeholder="Ex.: Xanxerê, SC" required /></div>
          <div><label>Bairro (opcional)</label><input value={f.bairro} onChange={(e) => setF({ ...f, bairro: e.target.value })} /></div>
        </div>
        <div className="row" style={{ gap: 16, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
          <label className="row" style={{ gap: 7, fontSize: 13 }}><input type="checkbox" checked={f.onlyPhone} onChange={(e) => setF({ ...f, onlyPhone: e.target.checked })} /> Só com telefone</label>
          <label className="row" style={{ gap: 7, fontSize: 13 }}><input type="checkbox" checked={f.semSite} onChange={(e) => setF({ ...f, semSite: e.target.checked })} /> Só sem site próprio</label>
          <label className="row" style={{ gap: 7, fontSize: 13 }}>Nota mín.
            <select className="filter-select" value={f.minRating} onChange={(e) => setF({ ...f, minRating: Number(e.target.value) })} style={{ padding: "5px 8px" }}>
              <option value={0}>qualquer</option><option value={4}>4.0+</option><option value={4.5}>4.5+</option>
            </select>
          </label>
          <label className="row" style={{ gap: 7, fontSize: 13 }}>Resultados
            <select className="filter-select" value={f.maxPaginas} onChange={(e) => setF({ ...f, maxPaginas: Number(e.target.value) })} style={{ padding: "5px 8px" }}>
              <option value={1}>~20</option><option value={2}>~40</option><option value={3}>~60</option>
            </select>
          </label>
          <button className="btn" type="submit" disabled={loading} style={{ marginLeft: "auto" }}>
            <IcoSearch width={15} height={15} /> {loading ? "Buscando…" : "Buscar no Maps"}
          </button>
        </div>
      </form>

      {erro && <div className="err" style={{ marginTop: 14 }}>{erro}</div>}
      {msg && <div className="card glass-soft" style={{ marginTop: 14, fontSize: 13 }}>{msg}</div>}

      {/* barra de ações */}
      {empresas.length > 0 && (
        <div className="toolbar" style={{ marginTop: 14 }}>
          <button className="btn btn-ghost btn-sm" onClick={todos} type="button">
            {sel.size > 0 ? "Limpar seleção" : "Selecionar todas importáveis"}
          </button>
          <button className="btn btn-sm" onClick={importar} disabled={importando || sel.size === 0} type="button">
            <IcoPlus width={14} height={14} /> {importando ? "Importando…" : `Importar ${sel.size} pro funil`}
          </button>
        </div>
      )}

      {/* resultados */}
      {empresas.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: "hidden", marginTop: 12 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ paddingLeft: 16, width: 30 }}></th>
                  <th>Empresa</th>
                  <th>Score</th>
                  <th>Contato</th>
                  <th>Presença</th>
                  <th>Google</th>
                </tr>
              </thead>
              <tbody>
                {empresas.map((e) => (
                  <tr key={e.place_id} style={e.jaImportado ? { opacity: 0.55 } : undefined}>
                    <td style={{ paddingLeft: 16 }}>
                      <input type="checkbox" disabled={e.jaImportado} checked={sel.has(e.place_id)} onChange={() => toggle(e.place_id)} />
                    </td>
                    <td>
                      <strong>{e.nome}</strong>
                      {e.endereco && <div className="muted" style={{ fontSize: 11.5 }}>{e.endereco}</div>}
                      {e.jaImportado && <span className="badge" style={{ marginTop: 4, fontSize: 10 }}>já no funil · {e.statusExistente}</span>}
                    </td>
                    <td><span className={"badge " + corScore(e.score)} style={{ fontWeight: 800 }}>{e.score}</span></td>
                    <td className="muted" style={{ fontSize: 12.5 }}>
                      {e.telefone ? (
                        <span className="row" style={{ gap: 5 }}><IcoWhatsapp width={13} height={13} /> {e.telefone}</span>
                      ) : "—"}
                    </td>
                    <td>
                      {!e.site ? <span className="badge gold" style={{ fontSize: 10 }}>sem site</span>
                        : e.semSiteProprio ? <span className="badge" style={{ fontSize: 10 }}>só rede social</span>
                        : <span className="row muted" style={{ gap: 5, fontSize: 12 }}><IcoGlobe width={12} height={12} /> site próprio</span>}
                    </td>
                    <td className="muted" style={{ fontSize: 12.5 }}>
                      {e.rating ? `${e.rating}★ · ${e.avaliacoes}` : "—"}
                      {!e.ativo && <span className="badge" style={{ marginLeft: 6, fontSize: 10 }}>fechado</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {empresas.length === 0 && !loading && !erro && (
        <div className="card" style={{ marginTop: 14, textAlign: "center", padding: 44 }}>
          <div className="icon-box" style={{ width: 50, height: 50, margin: "0 auto 12px" }}><IcoFunnel width={22} height={22} /></div>
          <p className="muted" style={{ margin: 0, maxWidth: 420, marginInline: "auto" }}>
            Preencha nicho + cidade e busque. As empresas com maior score (contactáveis e sem site próprio) são os melhores alvos — selecione e mande pro funil.
          </p>
        </div>
      )}
    </>
  );
}
