"use client";

import { useCallback, useEffect, useState } from "react";

// ============================================================================
// Marketing: avaliação, cupom e fidelidade.
//
// Vem da pesquisa de mercado. Cupom e fidelidade a concorrência anuncia e a
// gente não tinha. Avaliação ninguém no Brasil faz bem, e para bar de bairro a
// nota do Google é o ativo de marketing mais importante que existe: é onde o
// vizinho olha antes de escolher onde jantar.
// ============================================================================

type Cupom = {
  id: string; codigo: string; tipo: string; valor: string; teto: string | null;
  minimo: string; limite_pessoa: number; limite_total: number | null; usos: number;
  hora_inicio: string | null; hora_fim: string | null; dias_semana: number[] | null;
  termina_em: string | null; ativo: boolean;
};
type Avaliacao = {
  id?: string; nota: number; comentario: string | null; marcadores: string[] | null;
  criado_em: string; mesa: string | null; respondida_em: string | null;
};
type Loja = {
  id: string; nome: string;
  google_url: string | null; pedir_avaliacao: boolean; nota_para_google: number;
  fidelidade_ativa: boolean; pontos_por_real: string; valor_do_ponto: string; resgate_minimo: number;
};

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const money = (v: number | string) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const quando = (d: string) =>
  new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function MarketingFood({ neg }: { neg: string }) {
  const [loja, setLoja] = useState<Loja | null>(null);
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [notas, setNotas] = useState<{ media: string; total: string; promotores: string; detratores: string; google: string } | null>(null);
  const [queixas, setQueixas] = useState<{ marcador: string; vezes: string }[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);

  // formulário do cupom novo
  const [codigo, setCodigo] = useState("");
  const [tipo, setTipo] = useState("percentual");
  const [valor, setValor] = useState("10");
  const [minimo, setMinimo] = useState("0");
  const [teto, setTeto] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [dias, setDias] = useState<number[]>([]);

  const avisar = (m: string) => { setAviso(m); setTimeout(() => setAviso(null), 3500); };

  const carregar = useCallback(async () => {
    const [a, c] = await Promise.all([
      fetch(`/api/food/painel?neg=${neg}&vista=avaliacoes`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/food/painel?neg=${neg}&vista=cupons`, { cache: "no-store" }).then((r) => r.json()),
    ]);
    setLoja(a.loja ?? c.loja ?? null);
    setNotas(a.totais ?? null);
    setAvaliacoes(a.recentes ?? []);
    setQueixas(a.queixas ?? []);
    setCupons(c.cupons ?? []);
  }, [neg]);

  useEffect(() => { carregar(); }, [carregar]);

  const acao = useCallback(async (payload: Record<string, unknown>) => {
    const r = await fetch("/api/food/painel", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ neg, ...payload }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { avisar(String(d?.mensagem ?? "Não deu para salvar")); return null; }
    await carregar();
    return d;
  }, [neg, carregar]);

  const salvarLoja = (campos: Record<string, unknown>) =>
    acao({ acao: "atualizar_loja", campos });

  async function criarCupom() {
    if (!codigo.trim()) { avisar("Dê um código para o cupom"); return; }
    const r = await acao({
      acao: "cupom", codigo, tipo, valor,
      minimo, teto: teto || null,
      hora_inicio: inicio || null, hora_fim: fim || null,
      dias_semana: dias.length ? dias : null,
    });
    if (r) { setCodigo(""); setTeto(""); avisar("Cupom criado"); }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Restaurante</span>
          <h1>Marketing</h1>
          <p className="muted">
            O que traz o cliente de volta: a nota que ele deixa, o cupom que ele
            usa e os pontos que ele junta.
          </p>
        </div>
      </div>

      {aviso && <div className="card" style={{ marginBottom: 14, borderColor: "rgba(230,180,92,.45)" }}>{aviso}</div>}

      {/* ---------------- AVALIAÇÃO ---------------- */}
      <div className="cols-4" style={{ marginBottom: 18 }}>
        <div className="card">
          <div className="kpi">{notas?.media ?? "0"}</div>
          <div className="kpi-label">Nota média</div>
        </div>
        <div className="card">
          <div className="kpi">{notas?.total ?? "0"}</div>
          <div className="kpi-label">Avaliações</div>
        </div>
        <div className="card">
          <div className="kpi">{notas?.detratores ?? "0"}</div>
          <div className="kpi-label">Notas 3 ou menos</div>
        </div>
        <div className="card">
          <div className="kpi">{notas?.google ?? "0"}</div>
          <div className="kpi-label">Foram para o Google</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <b>Como a casa pede avaliação</b>
        <p className="muted" style={{ fontSize: 12.5, margin: "4px 0 12px" }}>
          A pergunta aparece no celular quando a conta fecha, que é o único
          momento em que o cliente ainda está satisfeito e com o telefone na mão.
          Nota boa vira convite para avaliar no Google. Nota ruim fica aqui
          dentro e chega para você resolver, em vez de virar estrela perdida.
        </p>
        <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ margin: 0, flex: "1 1 320px" }}>
            Link do seu Google (o de avaliar)
            <input value={loja?.google_url ?? ""} placeholder="https://g.page/r/..."
                   onChange={(e) => setLoja((l) => (l ? { ...l, google_url: e.target.value } : l))}
                   onBlur={(e) => salvarLoja({ google_url: e.target.value || null })} />
          </label>
          <label style={{ margin: 0 }}>
            Manda para o Google a partir de
            <select value={loja?.nota_para_google ?? 4}
                    onChange={(e) => { const v = Number(e.target.value); setLoja((l) => (l ? { ...l, nota_para_google: v } : l)); salvarLoja({ nota_para_google: v }); }}>
              <option value={4}>nota 4</option>
              <option value={5}>nota 5</option>
            </select>
          </label>
          <label style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" style={{ width: 16 }} checked={loja?.pedir_avaliacao ?? true}
                   onChange={(e) => { const v = e.target.checked; setLoja((l) => (l ? { ...l, pedir_avaliacao: v } : l)); salvarLoja({ pedir_avaliacao: v }); }} />
            Pedir avaliação ao fechar a conta
          </label>
        </div>
        {!loja?.google_url && (
          <p className="muted" style={{ fontSize: 12.5, marginTop: 10, marginBottom: 0 }}>
            Sem o link do Google, a nota boa fica só aqui dentro. O link sai no
            seu perfil do Google, em Compartilhar, Avaliar.
          </p>
        )}
      </div>

      {queixas.length > 0 && (
        <div className="card" style={{ marginBottom: 18 }}>
          <b>O que reclamam quando a nota é baixa</b>
          <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            {queixas.map((q) => (
              <span key={q.marcador} className="badge warn">{q.marcador} ({q.vezes})</span>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 18 }}>
        <b>Últimas avaliações</b>
        {avaliacoes.length === 0 ? (
          <p className="muted" style={{ fontSize: 13, margin: "8px 0 0" }}>
            Ninguém avaliou ainda. A pergunta aparece quando a conta fecha.
          </p>
        ) : (
          <table className="tabela" style={{ marginTop: 10 }}>
            <thead><tr><th>Nota</th><th>Mesa</th><th>O que disseram</th><th>Quando</th></tr></thead>
            <tbody>
              {avaliacoes.map((a, i) => (
                <tr key={i}>
                  <td>
                    <b style={{ color: a.nota >= 4 ? "#1c6b3c" : a.nota === 3 ? "#8a6d1f" : "#a33" }}>
                      {a.nota}
                    </b>
                  </td>
                  <td className="muted">{a.mesa ?? "-"}</td>
                  <td>
                    {a.comentario ?? <span className="muted">sem comentário</span>}
                    {a.marcadores?.length ? (
                      <div className="muted" style={{ fontSize: 12 }}>{a.marcadores.join(", ")}</div>
                    ) : null}
                  </td>
                  <td className="muted">{quando(a.criado_em)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ---------------- CUPOM ---------------- */}
      <div className="card" style={{ marginBottom: 18 }}>
        <b>Cupons</b>
        <p className="muted" style={{ fontSize: 12.5, margin: "4px 0 12px" }}>
          O cliente digita o código no celular, na mesa. O desconto é calculado
          aqui no servidor, então não adianta o cliente mexer na tela.
        </p>

        <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 14 }}>
          <label style={{ margin: 0 }}>
            Código
            <input value={codigo} placeholder="VOLTA10" style={{ textTransform: "uppercase", maxWidth: 150 }}
                   onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(/\s+/g, ""))} />
          </label>
          <label style={{ margin: 0 }}>
            Tipo
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="percentual">porcentagem</option>
              <option value="valor">valor em reais</option>
              <option value="frete_gratis">frete grátis</option>
            </select>
          </label>
          {tipo !== "frete_gratis" && (
            <label style={{ margin: 0 }}>
              {tipo === "percentual" ? "Quanto por cento" : "Quantos reais"}
              <input value={valor} style={{ maxWidth: 90 }} onChange={(e) => setValor(e.target.value)} />
            </label>
          )}
          {tipo === "percentual" && (
            <label style={{ margin: 0 }}>
              Teto em reais
              <input value={teto} placeholder="opcional" style={{ maxWidth: 110 }}
                     onChange={(e) => setTeto(e.target.value)} />
            </label>
          )}
          <label style={{ margin: 0 }}>
            Vale a partir de
            <input value={minimo} style={{ maxWidth: 90 }} onChange={(e) => setMinimo(e.target.value)} />
          </label>
          <label style={{ margin: 0 }}>
            Das
            <input type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </label>
          <label style={{ margin: 0 }}>
            Até
            <input type="time" value={fim} onChange={(e) => setFim(e.target.value)} />
          </label>
          <button className="btn btn-sm" onClick={criarCupom}>Criar cupom</button>
        </div>

        <div className="row" style={{ gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          <span className="muted" style={{ fontSize: 12.5, marginRight: 4 }}>Só nestes dias:</span>
          {DIAS.map((d, i) => (
            <button key={d} className={"btn btn-sm " + (dias.includes(i) ? "" : "btn-ghost")}
                    onClick={() => setDias((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]))}>
              {d}
            </button>
          ))}
          {dias.length === 0 && <span className="muted" style={{ fontSize: 12.5 }}>(todos)</span>}
        </div>

        {cupons.length === 0 ? (
          <p className="muted" style={{ fontSize: 13 }}>Nenhum cupom ainda.</p>
        ) : (
          <table className="tabela">
            <thead><tr><th>Código</th><th>Desconto</th><th>Regras</th><th>Usos</th><th /></tr></thead>
            <tbody>
              {cupons.map((c) => (
                <tr key={c.id} style={{ opacity: c.ativo ? 1 : 0.5 }}>
                  <td><b>{c.codigo}</b></td>
                  <td>
                    {c.tipo === "percentual" ? `${Number(c.valor)}%`
                      : c.tipo === "valor" ? money(c.valor) : "frete grátis"}
                    {c.teto && <span className="muted"> (teto {money(c.teto)})</span>}
                  </td>
                  <td className="muted" style={{ fontSize: 12.5 }}>
                    {Number(c.minimo) > 0 && <>a partir de {money(c.minimo)}. </>}
                    {c.hora_inicio && c.hora_fim && <>das {c.hora_inicio.slice(0, 5)} às {c.hora_fim.slice(0, 5)}. </>}
                    {c.dias_semana?.length ? <>{c.dias_semana.map((d) => DIAS[d]).join(", ")}. </> : null}
                    {c.limite_pessoa === 1 ? "uma vez por pessoa." : `${c.limite_pessoa}x por pessoa.`}
                  </td>
                  <td>{c.usos}</td>
                  <td>
                    {c.ativo && (
                      <button className="btn btn-ghost btn-sm"
                              onClick={() => acao({ acao: "excluir_cupom", id: c.id })}>
                        Desligar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ---------------- FIDELIDADE ---------------- */}
      <div className="card">
        <b>Programa de pontos</b>
        <p className="muted" style={{ fontSize: 12.5, margin: "4px 0 12px" }}>
          O cliente se identifica pelo telefone na mesa e junta ponto por real
          gasto. É o cartãozinho carimbado que não se perde.
        </p>
        <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" style={{ width: 16 }} checked={loja?.fidelidade_ativa ?? false}
                   onChange={(e) => { const v = e.target.checked; setLoja((l) => (l ? { ...l, fidelidade_ativa: v } : l)); salvarLoja({ fidelidade_ativa: v }); }} />
            Ligar o programa de pontos
          </label>
          <label style={{ margin: 0 }}>
            Pontos por real gasto
            <input value={loja?.pontos_por_real ?? "1"} style={{ maxWidth: 90 }}
                   onChange={(e) => setLoja((l) => (l ? { ...l, pontos_por_real: e.target.value } : l))}
                   onBlur={(e) => salvarLoja({ pontos_por_real: e.target.value })} />
          </label>
          <label style={{ margin: 0 }}>
            Quanto vale cada ponto
            <input value={loja?.valor_do_ponto ?? "0.01"} style={{ maxWidth: 110 }}
                   onChange={(e) => setLoja((l) => (l ? { ...l, valor_do_ponto: e.target.value } : l))}
                   onBlur={(e) => salvarLoja({ valor_do_ponto: e.target.value })} />
          </label>
          <label style={{ margin: 0 }}>
            Resgate a partir de
            <input value={loja?.resgate_minimo ?? 100} style={{ maxWidth: 100 }}
                   onChange={(e) => setLoja((l) => (l ? { ...l, resgate_minimo: Number(e.target.value) } : l))}
                   onBlur={(e) => salvarLoja({ resgate_minimo: Number(e.target.value) })} />
          </label>
        </div>
        {loja?.fidelidade_ativa && (
          <p className="muted" style={{ fontSize: 12.5, marginTop: 12, marginBottom: 0 }}>
            Do jeito que está: quem gasta {money(100)} junta{" "}
            {Math.floor(100 * Number(loja.pontos_por_real ?? 1))} pontos, e{" "}
            {loja.resgate_minimo} pontos viram{" "}
            {money(Number(loja.resgate_minimo) * Number(loja.valor_do_ponto ?? 0.01))} de desconto.
          </p>
        )}
      </div>
    </>
  );
}
