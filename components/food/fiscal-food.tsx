"use client";

import { useCallback, useEffect, useState } from "react";

// ============================================================================
// Fiscal: NFC-e.
//
// Em Santa Catarina é NFC-e. Em São Paulo o SAT acabou em 31/12/2025 e virou
// NFC-e também. A nota sai no CNPJ do restaurante, com o certificado dele, e
// quem fala com a SEFAZ é o integrador.
//
// A tela existe para responder três perguntas do dono: saiu? se não saiu, por
// quê? e o que eu faço agora?
// ============================================================================

type Nota = {
  id: string; status: string; erro: string | null; numero: string | null;
  chave: string | null; url_danfe: string | null; criado_em: string;
  tentativas: number; mesa: string | null; total: string | null;
};
type Loja = {
  id: string; nome: string;
  fiscal_ativo: boolean; fiscal_provedor: string | null; fiscal_cnpj: string | null;
  fiscal_ambiente: string; fiscal_automatico: boolean; fiscal_serie: number;
  fiscal_regime: string; fiscal_csosn_padrao: string; fiscal_cfop_padrao: string;
  fiscal_ncm_padrao: string; fiscal_ie: string | null; fiscal_razao: string | null;
  fiscal_uf: string | null; fiscal_token_ref: string | null;
};

const money = (v: number | string) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const quando = (d: string) =>
  new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const ROTULO: Record<string, string> = {
  emitida: "autorizada", pendente: "na fila", processando: "enviando",
  erro: "deu erro", cancelada: "cancelada", desistiu: "desistiu",
};

export default function FiscalFood({ neg }: { neg: string }) {
  const [loja, setLoja] = useState<Loja | null>(null);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [totais, setTotais] = useState<{ emitidas: string; pendentes: string; erros: string; canceladas: string; valor: string } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [credencial, setCredencial] = useState("");

  const avisar = (m: string) => { setAviso(m); setTimeout(() => setAviso(null), 5000); };

  const carregar = useCallback(async () => {
    const r = await fetch(`/api/food/painel?neg=${neg}&vista=fiscal`, { cache: "no-store" });
    if (!r.ok) return;
    const d = await r.json();
    setLoja(d.loja ?? null); setNotas(d.notas ?? []); setTotais(d.totais ?? null);
  }, [neg]);

  useEffect(() => { carregar(); }, [carregar]);

  const acao = useCallback(async (payload: Record<string, unknown>) => {
    const r = await fetch("/api/food/painel", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ neg, ...payload }),
    });
    const d = await r.json().catch(() => ({}));
    await carregar();
    return { ok: r.ok, d };
  }, [neg, carregar]);

  const salvar = (campos: Record<string, unknown>) => acao({ acao: "atualizar_loja", campos });

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Restaurante</span>
          <h1>Nota fiscal</h1>
          <p className="muted">
            NFC-e no CNPJ da casa. Se a SEFAZ cair, a venda fecha do mesmo jeito
            e a nota entra na fila, que insiste sozinha.
          </p>
        </div>
      </div>

      {aviso && <div className="card" style={{ marginBottom: 14, borderColor: "rgba(230,180,92,.45)" }}>{aviso}</div>}

      <div className="cols-4" style={{ marginBottom: 18 }}>
        <div className="card">
          <div className="kpi">{totais?.emitidas ?? "0"}</div>
          <div className="kpi-label">Autorizadas (30 dias)</div>
        </div>
        <div className="card">
          <div className="kpi">{totais?.pendentes ?? "0"}</div>
          <div className="kpi-label">Na fila</div>
        </div>
        <div className="card" style={Number(totais?.erros ?? 0) > 0 ? { borderColor: "rgba(214,59,48,.45)" } : undefined}>
          <div className="kpi">{totais?.erros ?? "0"}</div>
          <div className="kpi-label">Com erro</div>
        </div>
        <div className="card">
          <div className="kpi">{money(totais?.valor ?? 0)}</div>
          <div className="kpi-label">Faturado com nota</div>
        </div>
      </div>

      {/* ---------------- configuração ---------------- */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="spread" style={{ marginBottom: 12 }}>
          <b>Como a casa emite</b>
          <label style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" style={{ width: 16 }} checked={loja?.fiscal_ativo ?? false}
                   onChange={(e) => { const v = e.target.checked; setLoja((l) => (l ? { ...l, fiscal_ativo: v } : l)); salvar({ fiscal_ativo: v }); }} />
            Emitir NFC-e
          </label>
        </div>

        <div className="cols-3">
          <label style={{ margin: 0 }}>
            CNPJ da casa
            <input value={loja?.fiscal_cnpj ?? ""} placeholder="só números"
                   onChange={(e) => setLoja((l) => (l ? { ...l, fiscal_cnpj: e.target.value } : l))}
                   onBlur={(e) => salvar({ fiscal_cnpj: e.target.value })} />
          </label>
          <label style={{ margin: 0 }}>
            Razão social
            <input value={loja?.fiscal_razao ?? ""}
                   onChange={(e) => setLoja((l) => (l ? { ...l, fiscal_razao: e.target.value } : l))}
                   onBlur={(e) => salvar({ fiscal_razao: e.target.value })} />
          </label>
          <label style={{ margin: 0 }}>
            Inscrição estadual
            <input value={loja?.fiscal_ie ?? ""}
                   onChange={(e) => setLoja((l) => (l ? { ...l, fiscal_ie: e.target.value } : l))}
                   onBlur={(e) => salvar({ fiscal_ie: e.target.value })} />
          </label>
        </div>

        <div className="cols-3" style={{ marginTop: 12 }}>
          <label style={{ margin: 0 }}>
            Ambiente
            <select value={loja?.fiscal_ambiente ?? "homologacao"}
                    onChange={(e) => { const v = e.target.value; setLoja((l) => (l ? { ...l, fiscal_ambiente: v } : l)); salvar({ fiscal_ambiente: v }); }}>
              <option value="homologacao">homologação (teste)</option>
              <option value="producao">produção (vale de verdade)</option>
            </select>
          </label>
          <label style={{ margin: 0 }}>
            Regime
            <select value={loja?.fiscal_regime ?? "simples"}
                    onChange={(e) => { const v = e.target.value; setLoja((l) => (l ? { ...l, fiscal_regime: v } : l)); salvar({ fiscal_regime: v }); }}>
              <option value="simples">Simples Nacional</option>
              <option value="simples_excesso">Simples, com excesso de sublimite</option>
              <option value="normal">Regime normal</option>
            </select>
          </label>
          <label style={{ margin: 0 }}>
            Série
            <input value={loja?.fiscal_serie ?? 1}
                   onChange={(e) => setLoja((l) => (l ? { ...l, fiscal_serie: Number(e.target.value) } : l))}
                   onBlur={(e) => salvar({ fiscal_serie: Number(e.target.value) })} />
          </label>
        </div>

        <div className="cols-3" style={{ marginTop: 12 }}>
          <label style={{ margin: 0 }}>
            CSOSN padrão
            <input value={loja?.fiscal_csosn_padrao ?? "102"}
                   onChange={(e) => setLoja((l) => (l ? { ...l, fiscal_csosn_padrao: e.target.value } : l))}
                   onBlur={(e) => salvar({ fiscal_csosn_padrao: e.target.value })} />
          </label>
          <label style={{ margin: 0 }}>
            CFOP padrão
            <input value={loja?.fiscal_cfop_padrao ?? "5102"}
                   onChange={(e) => setLoja((l) => (l ? { ...l, fiscal_cfop_padrao: e.target.value } : l))}
                   onBlur={(e) => salvar({ fiscal_cfop_padrao: e.target.value })} />
          </label>
          <label style={{ margin: 0 }}>
            NCM padrão
            <input value={loja?.fiscal_ncm_padrao ?? "21069090"}
                   onChange={(e) => setLoja((l) => (l ? { ...l, fiscal_ncm_padrao: e.target.value } : l))}
                   onBlur={(e) => salvar({ fiscal_ncm_padrao: e.target.value })} />
          </label>
        </div>

        <p className="muted" style={{ fontSize: 12.5, marginTop: 12, marginBottom: 0 }}>
          Esses três valem quando o produto não tem os dele. Bar e restaurante no
          Simples costumam ser CSOSN 102 e CFOP 5102. Quem manda aqui é o
          contador da casa: se ele disser outro, é outro.
        </p>
      </div>

      {/* ---------------- credencial ---------------- */}
      <div className="card" style={{ marginBottom: 18 }}>
        <b>Credencial do integrador</b>
        <p className="muted" style={{ fontSize: 12.5, margin: "4px 0 10px" }}>
          O certificado A1 da casa fica no integrador, no CNPJ dela. Aqui mora só
          o token, cifrado, e ele nunca volta para esta tela depois de salvo.
          {loja?.fiscal_token_ref ? " Já existe um token salvo." : " Nenhum token salvo ainda."}
        </p>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <input value={credencial} type="password" placeholder="token do Focus NFe"
                 style={{ flex: "1 1 320px" }}
                 onChange={(e) => setCredencial(e.target.value)} />
          <button className="btn btn-sm"
                  onClick={async () => {
                    await acao({ acao: "fiscal_credencial", token: credencial });
                    setCredencial("");
                    avisar("Token guardado e cifrado");
                  }}>
            Salvar token
          </button>
        </div>
      </div>

      {/* ---------------- a fila ---------------- */}
      <div className="card">
        <div className="spread" style={{ marginBottom: 12 }}>
          <b>Notas</b>
          <button className="btn btn-ghost btn-sm" onClick={carregar}>Atualizar</button>
        </div>

        {notas.length === 0 ? (
          <p className="muted" style={{ fontSize: 13 }}>
            Nenhuma nota ainda. Elas entram na fila quando a conta é paga.
          </p>
        ) : (
          <table className="tabela">
            <thead>
              <tr><th>Quando</th><th>Mesa</th><th>Valor</th><th>Situação</th><th>Número</th><th /></tr>
            </thead>
            <tbody>
              {notas.map((n) => (
                <tr key={n.id}>
                  <td className="muted">{quando(n.criado_em)}</td>
                  <td>{n.mesa ?? "-"}</td>
                  <td>{n.total ? money(n.total) : "-"}</td>
                  <td>
                    <span className={"badge" + (n.status === "erro" ? " warn" : "")}>
                      {ROTULO[n.status] ?? n.status}
                    </span>
                    {n.erro && (
                      <div className="muted" style={{ fontSize: 12, marginTop: 4, maxWidth: 380 }}>
                        {n.erro}
                        {n.tentativas > 1 && <> ({n.tentativas} tentativas)</>}
                      </div>
                    )}
                  </td>
                  <td className="muted">{n.numero ?? "-"}</td>
                  <td>
                    <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                      {n.url_danfe && (
                        <a className="btn btn-ghost btn-sm" href={n.url_danfe} target="_blank" rel="noreferrer">
                          Ver nota
                        </a>
                      )}
                      {["erro", "pendente"].includes(n.status) && (
                        <button className="btn btn-ghost btn-sm"
                                onClick={async () => {
                                  const r = await acao({ acao: "emitir_nota", id: n.id });
                                  avisar(r.d?.status === "emitida" ? "Nota autorizada" : String(r.d?.mensagem ?? "Ainda não saiu"));
                                }}>
                          Tentar de novo
                        </button>
                      )}
                      {n.status === "emitida" && (
                        <button className="btn btn-ghost btn-sm"
                                onClick={async () => {
                                  const m = window.prompt("Por que está cancelando? A SEFAZ exige pelo menos 15 letras.");
                                  if (!m) return;
                                  const r = await acao({ acao: "cancelar_nota", id: n.id, motivo: m });
                                  avisar(r.d?.ok ? "Nota cancelada" : String(r.d?.mensagem ?? "Não deu"));
                                }}>
                          Cancelar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <p className="muted" style={{ fontSize: 12.5, marginTop: 12, marginBottom: 0 }}>
          A fila roda sozinha de minuto em minuto. Erro de conteúdo (CNPJ,
          CPF, NCM) para de tentar na hora, porque insistir não conserta. Erro de
          conexão insiste com espera crescente até uma hora.
        </p>
      </div>
    </>
  );
}
