"use client";

import { useCallback, useEffect, useState } from "react";
import "@/app/food-cliente.css";
import type { CardapioCategoria, CardapioProduto } from "@/lib/food-types";

// ============================================================================
// App do garçom no tablet. Entra com PIN, toca na mesa, lança o pedido e fecha
// a conta. Botão grande, porque é usado em pé e com uma mão só.
// ============================================================================

type Mesa = {
  id: string; numero: string; sessao_id: string | null; total: string | null;
  aberta_em: string | null; itens_pendentes: number; chamado_aberto: boolean;
};
type Equipe = { id: string; nome: string; papel: string };
type Chamado = { id: string; tipo: string; mesa_numero: string; criado_em: string };
type Linha = { produtoId: string; variacaoId: string | null; nome: string; preco: number; qtd: number };

const money = (v: number | string) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const minutos = (d: string) => Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 60000));

export default function GarcomApp({ token }: { token: string }) {
  // Quem esta no turno vem do SERVIDOR a cada carregamento. Antes vinha do
  // localStorage do tablet, e por isso o PIN nao valia nada: quem pegasse o
  // aparelho destravado ja estava "logado" como o ultimo que entrou.
  const [garcom, setGarcom] = useState<{ id: string; nome: string; papel: string } | null>(null);
  const [equipe, setEquipe] = useState<Equipe[]>([]);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [cardapio, setCardapio] = useState<CardapioCategoria[]>([]);
  const [cab, setCab] = useState<{ loja: string; nome: string } | null>(null);
  const [mesa, setMesa] = useState<Mesa | null>(null);
  const [comanda, setComanda] = useState<{
    sessao: {
      total: string; subtotal: string; taxa_servico: string; pago: string;
      desconto: string; servico_recusado: boolean;
    } | null;
    pedidos: { id: string; numero_dia: number; itens: { id: string; nome_snapshot: string; qtd: string }[] }[];
  } | null>(null);
  const [carrinho, setCarrinho] = useState<Linha[]>([]);
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const r = await fetch(`/api/food/garcom?token=${encodeURIComponent(token)}`, { cache: "no-store" });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      setErro(typeof e?.mensagem === "string" ? e.mensagem : "Tablet não reconhecido");
      return;
    }
    const d = await r.json();
    setMesas(d.mesas ?? []); setEquipe(d.equipe ?? []); setCardapio(d.cardapio ?? []);
    setChamados(d.chamados ?? []); setCab({ loja: d.dispositivo?.loja, nome: d.dispositivo?.nome });
    // o turno pode ter vencido ou sido fechado no painel: a tela acompanha
    setGarcom(d.turno ? { id: d.turno.id, nome: d.turno.nome, papel: d.turno.papel } : null);
  }, [token]);

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 10000);
    return () => clearInterval(t);
  }, [carregar]);

  const acao = useCallback(async (payload: Record<string, unknown>) => {
    const r = await fetch("/api/food/garcom", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, ...payload }),
    });
    const data = await r.json().catch(() => ({}));
    if (r.status === 401) {        // turno vencido: volta para a tela do PIN
      setGarcom(null);
      setErro(typeof data?.mensagem === "string" ? data.mensagem : "Entre com o seu PIN.");
    } else if (r.status === 403) { // papel nao alcanca: diz quem resolve
      setErro(typeof data?.mensagem === "string" ? data.mensagem : "Chame o gerente.");
    }
    return { ok: r.ok, data };
  }, [token]);

  async function entrarComPin(e: Equipe) {
    const { ok, data } = await acao({ acao: "pin", equipeId: e.id, pin });
    setPin("");
    if (!ok) {
      setErro(typeof data?.mensagem === "string" ? data.mensagem
        : data?.erro === "sem_pin" ? "Esta pessoa não tem PIN cadastrado" : "PIN errado");
      return;
    }
    setErro(null);
    // o passe do turno veio em cookie httpOnly: nada de guardar quem sou eu aqui
    setGarcom(data.garcom);
    carregar();
  }

  async function abrirMesa(m: Mesa) {
    setMesa(m); setCarrinho([]);
    const { data } = await acao({ acao: "sessao", mesaId: m.id });
    setComanda(data);
  }

  function add(p: CardapioProduto, variacaoId: string | null) {
    const v = p.variacoes.find((x) => x.id === variacaoId);
    const preco = v ? Number(v.preco) : Number(p.preco_promo ?? p.preco);
    const nome = v ? `${p.nome} (${v.nome})` : p.nome;
    setCarrinho((c) => {
      const i = c.findIndex((l) => l.produtoId === p.id && l.variacaoId === variacaoId);
      if (i >= 0) { const cp = [...c]; cp[i] = { ...cp[i], qtd: cp[i].qtd + 1 }; return cp; }
      return [...c, { produtoId: p.id, variacaoId, nome, preco, qtd: 1 }];
    });
  }

  async function enviar() {
    if (!mesa || !carrinho.length) return;
    const { ok, data } = await acao({
      acao: "pedido", mesaId: mesa.id,
      chave: `${mesa.id}-${Date.now()}`,
      itens: carrinho.map((l) => ({ produto_id: l.produtoId, variacao_id: l.variacaoId, qtd: l.qtd })),
    });
    if (!ok) {
      setErro(typeof data?.mensagem === "string" ? data.mensagem
        : typeof data?.erro === "string" ? data.erro : "Não enviou");
      return;
    }
    setCarrinho([]);
    await abrirMesa(mesa);
    await carregar();
  }

  if (erro && !mesas.length) return <div className="fg"><div className="fc-vazio">{erro}</div></div>;

  // ---------- quem está atendendo
  if (!garcom) {
    return (
      <div className="fg">
        <div className="fg-topo">
          <div>
            <div className="fg-nome">{cab?.loja}</div>
            <div className="fg-quem">{cab?.nome}</div>
          </div>
        </div>
        <div style={{ padding: 16 }}>
          <label className="fc-label" style={{ marginTop: 0 }}>Digite seu PIN e toque no seu nome</label>
          <input className="fc-input" inputMode="numeric" value={pin} placeholder="4 dígitos"
                 style={{ fontSize: 24, letterSpacing: 8, textAlign: "center", maxWidth: 240 }}
                 onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} />
          {erro && <div className="fc-aviso" style={{ margin: "12px 0", background: "#c62828" }}>{erro}</div>}
          <div className="fg-pin" style={{ marginTop: 16 }}>
            {equipe.map((e) => (
              <button key={e.id} className="fg-pessoa" disabled={pin.length !== 4}
                      style={{ opacity: pin.length === 4 ? 1 : 0.5 }}
                      onClick={() => entrarComPin(e)}>
                {e.nome}
              </button>
            ))}
          </div>
          {!equipe.length && (
            <p style={{ color: "#71757e", marginTop: 16 }}>
              Ninguém cadastrado ainda. O dono cadastra a equipe com PIN na configuração.
            </p>
          )}
        </div>
      </div>
    );
  }

  // ---------- dentro de uma mesa
  if (mesa) {
    const totalCarrinho = carrinho.reduce((s, l) => s + l.preco * l.qtd, 0);
    return (
      <div className="fg">
        <div className="fg-topo">
          <div>
            <div className="fg-nome">Mesa {mesa.numero}</div>
            <div className="fg-quem">
              {comanda?.sessao ? `consumo ${money(comanda.sessao.subtotal)}` : "mesa livre"}
            </div>
          </div>
          <button className="fc-btn fc-btn-3" style={{ width: "auto", padding: "10px 16px" }}
                  onClick={() => { setMesa(null); setComanda(null); setCarrinho([]); }}>
            Voltar
          </button>
        </div>

        {comanda?.sessao && (
          <div className="fg-conta">
            <div className="fc-linha"><span>Consumo</span><span>{money(comanda.sessao.subtotal)}</span></div>
            <div className="fc-linha">
              <span>
                Serviço
                <button
                  onClick={async () => {
                    await acao({ acao: "servico", mesaId: mesa.id, recusar: !comanda.sessao!.servico_recusado });
                    abrirMesa(mesa);
                  }}
                  style={{
                    marginLeft: 8, border: "none", background: "none", padding: 0, font: "inherit",
                    fontSize: 12.5, textDecoration: "underline", color: "#71757e", cursor: "pointer",
                  }}>
                  {comanda.sessao.servico_recusado ? "incluir de volta" : "cliente recusou"}
                </button>
              </span>
              <span>
                {comanda.sessao.servico_recusado ? "não incluída" : money(comanda.sessao.taxa_servico)}
              </span>
            </div>
            {Number(comanda.sessao.desconto) > 0 && (
              <div className="fc-linha">
                <span>Desconto</span><span>- {money(comanda.sessao.desconto)}</span>
              </div>
            )}
            <div className="fc-linha" style={{ fontSize: 17 }}>
              <b>Total</b><b>{money(comanda.sessao.total)}</b>
            </div>
            {Number(comanda.sessao.pago) > 0 && (
              <div className="fc-linha" style={{ color: "#71757e" }}>
                <span>Já recebido</span><span>- {money(comanda.sessao.pago)}</span>
              </div>
            )}
            <button className="fc-btn fc-btn-2" style={{ marginTop: 8 }}
                    onClick={async () => {
                      const r = await acao({ acao: "imprimir_conta", mesaId: mesa.id });
                      if (r.ok) setErro(null);
                    }}>
              Imprimir a conta
            </button>

            {garcom.papel === "gerente" && (
              <button className="fc-btn fc-btn-3" style={{ marginTop: 8 }}
                      onClick={async () => {
                        const v = window.prompt("Desconto de quanto? (em reais)");
                        if (!v) return;
                        const motivo = window.prompt("Por quê? Fica registrado no seu nome.");
                        if (!motivo) return;
                        const r = await acao({
                          acao: "desconto", mesaId: mesa.id,
                          valor: Number(v.replace(",", ".")), motivo,
                        });
                        if (r.ok) abrirMesa(mesa);
                      }}>
                Dar desconto
              </button>
            )}
            <div className="fc-btn-linha" style={{ marginTop: 10, flexWrap: "wrap" }}>
              {(["dinheiro", "debito", "credito", "pix"] as const).map((m) => (
                <button key={m} className="fc-btn fc-btn-3" style={{ flex: "1 1 40%" }}
                        onClick={async () => {
                          await acao({
                            acao: "pagamento", mesaId: mesa.id, metodo: m,
                            valor: Number(comanda.sessao!.total) - Number(comanda.sessao!.pago),
                          });
                          abrirMesa(mesa);
                        }}>
                  {m}
                </button>
              ))}
              <button className="fc-btn" style={{ flex: "1 1 100%" }}
                      onClick={async () => {
                        await acao({ acao: "fechar", mesaId: mesa.id, garcomNome: garcom.nome });
                        setMesa(null); setComanda(null); carregar();
                      }}>
                Fechar mesa
              </button>
            </div>
          </div>
        )}

        <div className="fg-secao">
          {cardapio.map((cat) => (
            <div key={cat.id}>
              <h3>{cat.nome}</h3>
              <div className="fg-prods">
                {cat.produtos.map((p) =>
                  p.variacoes.length ? (
                    p.variacoes.map((v) => (
                      <button key={v.id} className="fg-prod" disabled={p.esgotado} onClick={() => add(p, v.id)}>
                        {p.nome} · {v.nome}
                        <span>{money(v.preco)}</span>
                      </button>
                    ))
                  ) : (
                    <button key={p.id} className="fg-prod" disabled={p.esgotado} onClick={() => add(p, null)}>
                      {p.nome}
                      <span>{p.esgotado ? "esgotado" : money(p.preco_promo ?? p.preco)}</span>
                    </button>
                  )
                )}
              </div>
            </div>
          ))}
        </div>

        {carrinho.length > 0 && (
          <div className="fc-barra">
            <div style={{ fontSize: 13, color: "#71757e", marginBottom: 8 }}>
              {carrinho.map((l) => `${l.qtd}x ${l.nome}`).join(" · ")}
            </div>
            <div className="fc-btn-linha">
              <button className="fc-btn fc-btn-3" style={{ maxWidth: 120 }} onClick={() => setCarrinho([])}>
                Limpar
              </button>
              <button className="fc-btn" onClick={enviar}>
                Enviar para a cozinha · {money(totalCarrinho)}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------- mapa de mesas
  return (
    <div className="fg">
      <div className="fg-topo">
        <div>
          <div className="fg-nome">{cab?.loja}</div>
          <div className="fg-quem">atendendo: {garcom.nome}</div>
        </div>
        <button className="fc-btn fc-btn-3" style={{ width: "auto", padding: "10px 16px" }}
                onClick={() => { setGarcom(null); try { localStorage.removeItem("ed_food_garcom"); } catch { /* ok */ } }}>
          Trocar
        </button>
      </div>

      {chamados.length > 0 && (
        <div style={{ padding: "12px 16px 0", display: "flex", gap: 8, flexWrap: "wrap" }}>
          {chamados.map((c) => (
            <button key={c.id} className="fk-chamado"
                    onClick={async () => { await acao({ acao: "chamado", chamadoId: c.id }); carregar(); }}>
              Mesa {c.mesa_numero} · {c.tipo === "conta" ? "conta" : "chamou"} ({minutos(c.criado_em)} min)
            </button>
          ))}
        </div>
      )}

      <div className="fg-mesas">
        {mesas.map((m) => (
          <button key={m.id}
                  className={"fg-mesa" + (m.chamado_aberto ? " chamando" : m.sessao_id ? " ocupada" : "")}
                  onClick={() => abrirMesa(m)}>
            <b>{m.numero}</b>
            <span>
              {m.sessao_id
                ? <>{money(m.total ?? 0)}<br />{minutos(m.aberta_em!)} min</>
                : "livre"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
