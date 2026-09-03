"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@/app/food-cliente.css";
import { MARCAS, frase } from "@/lib/food-alergenicos";
import type { CardapioCategoria, CardapioProduto, FoodItem, FoodSessao } from "@/lib/food-types";

// ============================================================================
// A tela que abre quando o cliente encosta o celular no cartão da mesa.
// Sem app, sem login: a mesa é o token da URL, e a marca é a do restaurante.
// ============================================================================

type Resumo = {
  sessao: FoodSessao | null;
  pedidos: { id: string; numero_dia: number; status: string; criado_em: string; itens: FoodItem[] }[];
  pagamentos: { id: string; metodo: string; valor: string; status: string }[];
  membros: { id: string; apelido: string | null }[];
};

type Divisao = {
  total: number; subtotal: number; taxa: number; couvert: number; desconto: number;
  pago: number; falta: number; pessoas: number; porCabeca: number;
  porPessoa: {
    membroId: string | null; apelido: string | null; subtotal: number;
    itens: { id: string; nome: string; qtd: string; total: number; pago: boolean }[];
  }[];
};

type Loja = {
  pedir_avaliacao?: boolean;
  fidelidade_ativa?: boolean;
  resgate_minimo?: number;
  id: string; nome: string; logo_url: string | null; cor_destaque: string | null;
  taxa_servico_pct: string; taxa_servico_automatica: boolean; couvert: string;
  pagar_no_app: boolean; gorjeta_sugerida_pct: string; tempo_preparo_min: number;
  exige_aprovacao_garcom: boolean;
};

type Linha = {
  key: string; produto: CardapioProduto; variacaoId: string | null;
  nome: string; qtd: number; opcoes: { id: string; nome: string; preco: number }[];
  obs: string; restricao: string; unit: number;
};

const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function deviceId(): string {
  const K = "ed_food_device";
  try {
    let v = localStorage.getItem(K);
    if (!v) { v = crypto.randomUUID(); localStorage.setItem(K, v); }
    return v;
  } catch {
    return "sem-storage-" + Math.random().toString(36).slice(2);
  }
}

async function api(payload: Record<string, unknown>) {
  const r = await fetch("/api/food/publico", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  return { ok: r.ok, data: await r.json().catch(() => ({})) };
}

export default function MesaApp({ token }: { token: string }) {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [loja, setLoja] = useState<Loja | null>(null);
  const [mesa, setMesa] = useState<{ numero: string } | null>(null);
  const [cardapio, setCardapio] = useState<CardapioCategoria[]>([]);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  // quem eu sou nesta comanda. O servidor nao aceita este id vindo do
  // navegador: ele usa o que esta dentro do passe. Aqui e so para a tela.
  const [membroId, setMembroId] = useState<string | null>(null);
  const [fechada, setFechada] = useState(false);
  // avaliacao, cupom e pontos
  const [avaliando, setAvaliando] = useState(false);
  const [nota, setNota] = useState(0);
  const [marcadores, setMarcadores] = useState<string[]>([]);
  const [comentario, setComentario] = useState("");
  const [googleUrl, setGoogleUrl] = useState<string | null>(null);
  const [cupom, setCupom] = useState("");
  const [eu, setEu] = useState<{ nome: string | null; pontos: number } | null>(null);
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState("");
  const [cpfOk, setCpfOk] = useState(false);
  const [divisao, setDivisao] = useState<Divisao | null>(null);
  const [dividindo, setDividindo] = useState(false);
  const cardapioRev = useRef<number>(0);
  // uma chave por carrinho: reenvio na rede ruim não vira pedido em dobro
  const chaveCarrinho = useRef<string>("");
  const [carrinho, setCarrinho] = useState<Linha[]>([]);
  const [aberto, setAberto] = useState<CardapioProduto | null>(null);
  const [aba, setAba] = useState<"cardapio" | "comanda">("cardapio");
  const [catAtiva, setCatAtiva] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pix, setPix] = useState<{ copiaCola: string | null; valor: number } | null>(null);
  const dev = useRef<string>("");

  // Encostar o cartão é o que ENTRA. O servidor devolve um passe em cookie
  // httpOnly, amarrado a esta mesa, a esta comanda e a este celular, e é ele
  // que autoriza pedir, chamar e pagar. Quando a conta fecha, o passe morre e
  // esta função roda de novo sozinha.
  const entrar = useCallback(async (): Promise<boolean> => {
    if (!dev.current) dev.current = deviceId();
    const { ok, data } = await api({ acao: "entrar", token, deviceId: dev.current });

    if (!ok && data?.erro === "fechada") {
      // casa fechada: o cardápio continua visível, sem comanda
      cardapioRev.current = Number(data.cardapio_rev ?? 0);
      setLoja(data.loja); setMesa(data.mesa); setCardapio(data.cardapio ?? []);
      setCatAtiva((data.cardapio ?? [])[0]?.id ?? null);
      setFechada(true); setResumo(null); setMembroId(null);
      setCarregando(false);
      return false;
    }
    if (!ok) {
      setErro(
        data?.erro === "mesa" ? "Cartão inválido"
        : data?.erro === "mesa_desligada" ? "Esta casa não está recebendo pedido pela mesa"
        : data?.erro === "muitas_tentativas" ? "Muita gente pedindo ao mesmo tempo. Tente de novo em instantes."
        : "Não foi possível abrir a mesa"
      );
      setCarregando(false);
      return false;
    }
    cardapioRev.current = Number(data.cardapio_rev ?? 0);
    setFechada(false); setErro(null);
    setLoja(data.loja); setMesa(data.mesa); setCardapio(data.cardapio ?? []);
    setResumo(data.resumo); setMembroId(data.membroId);
    setCatAtiva((c) => c ?? (data.cardapio ?? [])[0]?.id ?? null);
    setCarregando(false);
    return true;
  }, [token]);

  useEffect(() => { void entrar(); }, [entrar]);

  const recarregar = useCallback(async () => {
    const { ok, data } = await api({ acao: "resumo", token });
    if (!ok) {
      // o garçom fechou a conta, ou o passe venceu: entra de novo, e se a casa
      // estiver fechada a tela mostra o cardápio e para por aí
      if (data?.erro === "sessao_encerrada" || data?.erro === "sem_passe") {
        setCarrinho([]);
        // A conta fechou. Este e o unico momento em que o cliente ainda esta
        // satisfeito e com o celular na mao: e agora que se pergunta a nota.
        if (data?.erro === "sessao_encerrada" && loja?.pedir_avaliacao && consumido > 0 && !avaliando) {
          setAvaliando(true);
          return;
        }
        await entrar();
      }
      return;
    }
    setResumo(data);
    // acabou a picanha na cozinha: o contador sobe e o cardapio se refaz aqui,
    // sem o cliente precisar recarregar a pagina
    const rev = Number(data?.cardapio_rev ?? 0);
    if (rev && rev !== cardapioRev.current) {
      cardapioRev.current = rev;
      const novo = await api({ acao: "cardapio", token });
      if (novo.ok) {
        setCardapio(novo.data.cardapio ?? []);
        setCarrinho((c) => c.filter((l) => !(novo.data.cardapio ?? [])
          .every((cat: CardapioCategoria) => !cat.produtos.some((p) => p.id === l.produto.id && !p.esgotado))));
      }
    }
  }, [token, entrar]);

  useEffect(() => {
    // com a casa fechada nao existe comanda para acompanhar: para de bater
    if (fechada) return;
    const t = setInterval(recarregar, 10000);
    return () => clearInterval(t);
  }, [recarregar, fechada]);

  const totalCarrinho = useMemo(() => carrinho.reduce((s, c) => s + c.unit * c.qtd, 0), [carrinho]);
  const qtdCarrinho = useMemo(() => carrinho.reduce((s, c) => s + c.qtd, 0), [carrinho]);
  const consumido = useMemo(() => {
    if (!resumo?.pedidos) return 0;
    return resumo.pedidos.reduce((s, p) => s + p.itens.reduce((si, i) => si + Number(i.preco_total), 0), 0);
  }, [resumo]);

  // Os totais vem do SERVIDOR: e ele que aplica desconto, couvert e a recusa da
  // taxa de servico. A conta do navegador so vale enquanto a comanda nao existe.
  const s = resumo?.sessao ?? null;
  const servico = s ? Number(s.taxa_servico)
    : (loja?.taxa_servico_automatica ? consumido * Number(loja.taxa_servico_pct) / 100 : 0);
  const couvert = s ? Number(s.couvert_total) : 0;
  const desconto = s ? Number(s.desconto) : 0;
  const servicoRecusado = !!s?.servico_recusado;
  const totalConta = s ? Number(s.total) : consumido + servico;
  const jaPago = s ? Number(s.pago) : 0;
  const cor = loja?.cor_destaque || "#e8332a";

  async function enviarPedido() {
    if (!carrinho.length || enviando) return;
    setEnviando(true);
    if (!chaveCarrinho.current) {
      chaveCarrinho.current = `${dev.current}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }
    const corpo = {
      acao: "pedir", token, deviceId: dev.current,
      chave: chaveCarrinho.current,
      itens: carrinho.map((c) => ({
        produto_id: c.produto.id, variacao_id: c.variacaoId, qtd: c.qtd,
        opcoes: c.opcoes.map((o) => o.id), obs: c.obs || null,
        restricao: c.restricao || null,
      })),
    };
    let { ok, data } = await api(corpo);
    // passe vencido no meio da noite: entra de novo e manda o MESMO pedido, com
    // a mesma chave. Se o primeiro envio tinha chegado, volta o mesmo pedido.
    if (!ok && data?.erro === "sem_passe" && (await entrar())) {
      ({ ok, data } = await api(corpo));
    }
    setEnviando(false);
    if (!ok) {
      setAviso(
        data?.erro === "LIMITE_SESSAO" ? "Chame o garçom para liberar este pedido"
        : data?.erro === "conta_fechada" ? "A conta desta mesa já foi pedida"
        : data?.erro === "sessao_encerrada" ? "Esta conta foi fechada. Encoste o celular no cartão de novo."
        : data?.erro === "muitas_tentativas" ? "Espere um instante antes de mandar de novo."
        : typeof data?.mensagem === "string" ? data.mensagem
        : typeof data?.erro === "string" ? data.erro : "Não foi possível enviar"
      );
      return;
    }
    chaveCarrinho.current = "";
    setCarrinho([]);
    setAba("comanda");
    setAviso(data.aguardando_garcom ? "Pedido enviado. O garçom vai confirmar." : "Pedido enviado para a cozinha");
    recarregar();
  }

  async function pagar(valor: number, gorjeta: number) {
    const { ok, data } = await api({ acao: "pagar", token, valor, gorjeta });
    if (!ok) {
      setAviso(data?.erro === "pagamento_desligado" ? "Esta casa recebe no caixa" : "Não foi possível gerar o Pix");
      return;
    }
    if (data.copia_cola) setPix({ copiaCola: data.copia_cola, valor: valor + gorjeta });
    else setAviso("Pedido de pagamento enviado. O caixa vai confirmar.");
    recarregar();
  }

  // A gorjeta e voluntaria: a Lei 13.419/2017 diz isso e o artigo 39 do CDC
  // proibe pressionar. O botao existe porque o certo e o cliente poder tirar.
  async function mexerNoServico(recusar: boolean) {
    const { ok, data } = await api({ acao: "servico", token, recusar });
    if (!ok) { setAviso(String(data?.mensagem ?? "Nao deu para mudar a taxa")); return; }
    setAviso(recusar ? "Taxa de servico retirada da conta" : "Taxa de servico de volta na conta");
    recarregar();
  }

  const abrirDivisao = useCallback(async () => {
    const { ok, data } = await api({ acao: "divisao", token });
    if (ok && data) { setDivisao(data as Divisao); setDividindo(true); }
  }, [token]);

  async function pagarItens(ids: string[]) {
    const { ok, data } = await api({ acao: "pagar", token, itens: ids });
    if (!ok) { setAviso(String(data?.mensagem ?? "Nao deu para gerar o Pix")); return; }
    if (data.copia_cola) setPix({ copiaCola: data.copia_cola, valor: Number(data.valor ?? 0) });
    else setAviso("Pedido de pagamento enviado. O caixa vai confirmar.");
    setDividindo(false);
    recarregar();
  }

  async function aplicarCupom() {
    if (!cupom.trim()) return;
    const { ok, data } = await api({ acao: "cupom", token, codigo: cupom });
    if (!ok) { setAviso(String(data?.mensagem ?? "Cupom nao vale")); return; }
    setCupom("");
    setAviso(`${data.descricao} aplicado`);
    recarregar();
  }

  async function souEu() {
    const { ok, data } = await api({ acao: "sou_eu", token, telefone });
    if (!ok) { setAviso(String(data?.mensagem ?? "Nao deu para achar seu cadastro")); return; }
    setEu({ nome: data.nome ?? null, pontos: data.pontos ?? 0 });
    setTelefone("");
    setAviso(data.pontos > 0 ? `Voce tem ${data.pontos} pontos` : "Pronto, a partir de hoje voce junta pontos aqui");
  }

  async function mandarNota() {
    if (!nota) return;
    const { ok, data } = await api({
      acao: "avaliar", token, nota, marcadores, comentario: comentario || null,
    });
    if (!ok) { setAviso("Nao deu para enviar"); setAvaliando(false); await entrar(); return; }
    if (data.googleUrl) {
      setGoogleUrl(data.googleUrl);
    } else {
      setAvaliando(false);
      setAviso(nota >= 4 ? "Obrigado!" : "Obrigado. O dono vai ficar sabendo.");
      await entrar();
    }
  }

  async function pedirCpfNaNota() {
    const { ok, data } = await api({ acao: "cpf_na_nota", token, cpf });
    if (!ok) { setAviso(String(data?.mensagem ?? "CPF nao confere")); return; }
    setCpfOk(true);
    setAviso("CPF vai na nota");
  }

  async function chamar(tipo: "garcom" | "conta") {
    await api({ acao: "chamar", token, tipo });
    setAviso(tipo === "conta" ? "A conta foi pedida. Já vem." : "Garçom chamado");
    recarregar();
  }

  if (carregando) return <div className="fc"><div className="fc-vazio">Abrindo a mesa...</div></div>;
  if (erro) return <div className="fc"><div className="fc-vazio">{erro}</div></div>;

  const cat = cardapio.find((c) => c.id === catAtiva) ?? cardapio[0];

  return (
    <div className="fc" style={{ ["--fc-cor" as string]: cor }}>
      {/* ---------- topo ---------- */}
      <header className="fc-capa">
        <span className="fc-capa-sombra" />
        <div className="fc-topo fc-conteudo">
          {loja?.logo_url
            ? <img src={loja.logo_url} alt="" className="fc-logo" />
            : <span className="fc-logo fc-logo-vazia">{loja?.nome?.slice(0, 1)}</span>}
          <div>
            <div className="fc-nome">{loja?.nome}</div>
            <div className="fc-sub">
              <span className="fc-pill">Mesa {mesa?.numero}</span>
              {(resumo?.membros?.length ?? 0) > 1 && (
                <span className="fc-pill">{resumo!.membros.length} pessoas na comanda</span>
              )}
              <span>entrega em cerca de {loja?.tempo_preparo_min} min</span>
            </div>
          </div>
        </div>
      </header>

      {/* ---------- abas ---------- */}
      <div className="fc-abas">
        <button className={"fc-aba" + (aba === "cardapio" ? " on" : "")} onClick={() => setAba("cardapio")}>
          Cardápio
        </button>
        <button className={"fc-aba" + (aba === "comanda" ? " on" : "")} onClick={() => setAba("comanda")}>
          Comanda{consumido > 0 ? ` · ${money(consumido)}` : ""}
        </button>
      </div>

      {aviso && <div className="fc-aviso" onClick={() => setAviso(null)}>{aviso}</div>}

      {fechada && (
        <div className="fc-bloco" style={{ margin: "12px 16px", borderColor: "#e6b45c" }}>
          <b>A casa está fechada agora.</b>
          <div className="fc-grupo-sub" style={{ marginTop: 4 }}>
            Você pode ver o cardápio à vontade. Para pedir, encoste o celular no
            cartão quando a casa abrir.
          </div>
        </div>
      )}

      {aba === "cardapio" ? (
        <>
          {cardapio.length > 1 && (
            <div className="fc-chips">
              {cardapio.map((c) => (
                <button key={c.id} className={"fc-chip" + (c.id === (cat?.id) ? " on" : "")}
                        onClick={() => setCatAtiva(c.id)}>
                  {c.nome}
                </button>
              ))}
            </div>
          )}

          <div className="fc-conteudo">
            {cat ? (
              <section className="fc-secao">
                <h2>{cat.nome}</h2>
                {cat.descricao && <p>{cat.descricao}</p>}
                {cat.produtos.map((p) => (
                  <button key={p.id} className={"fc-item" + (p.esgotado ? " off" : "")}
                          disabled={p.esgotado} onClick={() => setAberto(p)}>
                    <span className="fc-item-txt">
                      <span className="fc-item-nome">{p.nome}</span>
                      {p.descricao && <span className="fc-item-desc">{p.descricao}</span>}
                      {(p.alergenicos?.length || p.sem_gluten || p.sem_lactose || p.vegano || p.vegetariano) && (
                        <span className="fc-tags">
                          {MARCAS.filter((m) => (p as unknown as Record<string, unknown>)[m.chave]).map((m) => (
                            <span key={m.chave} className="fc-tag boa">{m.nome}</span>
                          ))}
                          {(p.alergenicos ?? []).length > 0 && (
                            <span className="fc-tag">contém alergênicos</span>
                          )}
                        </span>
                      )}
                      <span className="fc-item-preco">
                        {p.esgotado ? "Esgotado hoje"
                          : p.variacoes.length
                            ? <><small>a partir de </small>{money(Math.min(...p.variacoes.map((v) => Number(v.preco))))}</>
                            : money(Number(p.preco_promo ?? p.preco))}
                      </span>
                    </span>
                    {p.imagem_url && <img src={p.imagem_url} alt="" className="fc-item-foto" />}
                  </button>
                ))}
                {!cat.produtos.length && <p style={{ color: "var(--fc-muted)" }}>Nada nesta categoria ainda.</p>}
              </section>
            ) : (
              <div className="fc-vazio">Cardápio em montagem.</div>
            )}
          </div>
        </>
      ) : (
        <div className="fc-conteudo" style={{ paddingTop: 14 }}>
          <div className="fc-bloco">
            <b style={{ fontSize: 15 }}>O que já veio para a mesa</b>
            <div className="fc-hr" />
            {resumo?.pedidos?.length ? resumo.pedidos.map((p) => (
              <div key={p.id} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12.5, color: "var(--fc-muted)" }}>Pedido {p.numero_dia}</span>
                  <span className={"fc-status" + (p.status === "pronto" || p.status === "entregue" ? " ok" : p.status === "em_producao" ? " fazendo" : "")}>
                    {rotulo(p.status)}
                  </span>
                </div>
                {p.itens.map((i) => (
                  <div key={i.id} className="fc-linha">
                    <span>{Number(i.qtd)}x {i.nome_snapshot}</span>
                    <span>{money(Number(i.preco_total))}</span>
                  </div>
                ))}
              </div>
            )) : (
              <p style={{ color: "var(--fc-muted)", fontSize: 14, margin: "6px 0 0" }}>
                Ninguém pediu nada ainda. Toque em Cardápio para começar.
              </p>
            )}

            {consumido > 0 && (
              <>
                <div className="fc-hr" />
                <div className="fc-linha"><span>Consumo</span><span>{money(consumido)}</span></div>
                {couvert > 0 && (
                  <div className="fc-linha"><span>Couvert</span><span>{money(couvert)}</span></div>
                )}
                {(servico > 0 || servicoRecusado) && (
                  <div className="fc-linha">
                    <span>
                      Serviço {Number(loja?.taxa_servico_pct ?? 10)}%
                      <button
                        onClick={() => mexerNoServico(!servicoRecusado)}
                        style={{
                          marginLeft: 8, border: "none", background: "none", padding: 0,
                          font: "inherit", fontSize: 12.5, textDecoration: "underline",
                          color: "var(--fc-muted)", cursor: "pointer",
                        }}>
                        {servicoRecusado ? "incluir de volta" : "não quero"}
                      </button>
                    </span>
                    <span>{servicoRecusado ? "não incluída" : money(servico)}</span>
                  </div>
                )}
                {desconto > 0 && (
                  <div className="fc-linha">
                    <span>Desconto{s?.desconto_motivo ? ` (${s.desconto_motivo})` : ""}</span>
                    <span>- {money(desconto)}</span>
                  </div>
                )}
                <div className="fc-linha" style={{ fontSize: 17, marginTop: 4 }}>
                  <b>Total</b><b>{money(totalConta)}</b>
                </div>
                {jaPago > 0 && (
                  <div className="fc-linha" style={{ color: "var(--fc-muted)" }}>
                    <span>Já pago</span><span>- {money(jaPago)}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {pix && (
            <div className="fc-bloco">
              <b style={{ fontSize: 15 }}>Pix de {money(pix.valor)}</b>
              <p style={{ fontSize: 13, color: "var(--fc-muted)", margin: "6px 0 10px" }}>
                Copie o código e pague no app do seu banco. A conta baixa sozinha aqui.
              </p>
              <textarea readOnly value={pix.copiaCola ?? ""} className="fc-input" style={{ height: 86, fontSize: 12 }} />
              <button className="fc-btn" style={{ marginTop: 10 }}
                      onClick={() => { navigator.clipboard.writeText(pix.copiaCola ?? ""); setAviso("Código copiado"); }}>
                Copiar código Pix
              </button>
            </div>
          )}

          <div style={{ padding: "0 16px" }}>
            <div className="fc-btn-linha" style={{ marginBottom: 8 }}>
              <button className="fc-btn fc-btn-2" onClick={() => chamar("garcom")}>Chamar garçom</button>
              <button className="fc-btn fc-btn-2" onClick={() => chamar("conta")}>Pedir a conta</button>
            </div>
            {consumido > 0 && (
              <button className="fc-btn fc-btn-2" style={{ marginBottom: 8 }} onClick={abrirDivisao}>
                Dividir a conta
              </button>
            )}

            {consumido > 0 && (
              cpfOk ? (
                <div className="fc-bloco" style={{ marginBottom: 8 }}>
                  <b>CPF na nota</b>
                  <div className="fc-grupo-sub">Vai sair na nota fiscal desta conta.</div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <input className="fc-input" value={cpf} placeholder="CPF na nota (se quiser)"
                         inputMode="numeric" style={{ flex: 1 }}
                         onChange={(e) => setCpf(e.target.value)} />
                  <button className="fc-btn fc-btn-3" style={{ width: "auto", padding: "0 18px" }}
                          onClick={pedirCpfNaNota}>
                    Por
                  </button>
                </div>
              )
            )}

            {consumido > 0 && (
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input className="fc-input" value={cupom} placeholder="tem cupom? digite aqui"
                       style={{ flex: 1, textTransform: "uppercase" }}
                       onChange={(e) => setCupom(e.target.value.toUpperCase().replace(/\s+/g, ""))} />
                <button className="fc-btn fc-btn-3" style={{ width: "auto", padding: "0 18px" }}
                        onClick={aplicarCupom}>
                  Usar
                </button>
              </div>
            )}

            {loja?.fidelidade_ativa && (
              eu ? (
                <div className="fc-bloco" style={{ marginBottom: 8 }}>
                  <b>{eu.nome ? `Oi, ${eu.nome.split(" ")[0]}` : "Voce esta na casa"}</b>
                  <div className="fc-grupo-sub">
                    {eu.pontos} ponto{eu.pontos === 1 ? "" : "s"} ate agora. Os pontos desta
                    conta entram quando o caixa fechar.
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <input className="fc-input" value={telefone} placeholder="seu telefone, para juntar pontos"
                         inputMode="numeric" style={{ flex: 1 }}
                         onChange={(e) => setTelefone(e.target.value)} />
                  <button className="fc-btn fc-btn-3" style={{ width: "auto", padding: "0 18px" }}
                          onClick={souEu}>
                    Sou eu
                  </button>
                </div>
              )
            )}
            {loja?.pagar_no_app && consumido > 0 && (
              <button className="fc-btn" onClick={() => pagar(totalConta - jaPago, 0)}>
                Pagar tudo pelo celular · {money(Math.max(0, totalConta - jaPago))}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ---------- barra do carrinho ---------- */}
      {aba === "cardapio" && carrinho.length > 0 && (
        <div className="fc-barra">
          <button className="fc-btn" onClick={enviarPedido} disabled={enviando || fechada}>
            {enviando ? "Enviando..." : <>Enviar {qtdCarrinho} {qtdCarrinho === 1 ? "item" : "itens"} · {money(totalCarrinho)}</>}
          </button>
        </div>
      )}

      {avaliando && (
        <div className="fc-modal">
          <div className="fc-modal-card" onClick={(ev) => ev.stopPropagation()}>
            <div className="fc-modal-corpo" style={{ textAlign: "center" }}>
              {googleUrl ? (
                <>
                  <h2 style={{ fontSize: 20, margin: "0 0 8px" }}>Obrigado!</h2>
                  <p style={{ color: "var(--fc-muted)", fontSize: 14, margin: "0 0 18px" }}>
                    Se sobrou um minuto, deixa essa nota no Google tambem. Ajuda
                    muito quem esta procurando onde comer por aqui.
                  </p>
                  <a className="fc-btn" href={googleUrl} target="_blank" rel="noreferrer"
                     style={{ display: "block", textAlign: "center", textDecoration: "none" }}
                     onClick={() => { void api({ acao: "foi_pro_google", token }); }}>
                    Avaliar no Google
                  </a>
                  <button className="fc-btn fc-btn-3" style={{ marginTop: 8 }}
                          onClick={async () => { setGoogleUrl(null); setAvaliando(false); await entrar(); }}>
                    Agora nao
                  </button>
                </>
              ) : (
                <>
                  <h2 style={{ fontSize: 20, margin: "0 0 4px" }}>Como foi?</h2>
                  <p style={{ color: "var(--fc-muted)", fontSize: 13.5, margin: "0 0 16px" }}>
                    Leva dez segundos e o dono le todas.
                  </p>
                  <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 16 }}>
                    {[1, 2, 3, 4, 5].map((v) => (
                      <button key={v} onClick={() => setNota(v)}
                              style={{
                                width: 52, height: 52, borderRadius: 14, fontSize: 20, fontWeight: 800,
                                border: "1px solid " + (nota === v ? "var(--fc-cor)" : "#d9dade"),
                                background: nota === v ? "var(--fc-cor)" : "#fff",
                                color: nota === v ? "#fff" : "var(--fc-ink)",
                                fontFamily: "inherit", cursor: "pointer",
                              }}>
                        {v}
                      </button>
                    ))}
                  </div>
                  {nota > 0 && nota <= 3 && (
                    <>
                      <div className="fc-grupo-sub" style={{ marginBottom: 8 }}>O que nao foi bem?</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginBottom: 12 }}>
                        {["comida", "atendimento", "tempo de espera", "ambiente", "preco", "limpeza"].map((m) => (
                          <button key={m} className={"fc-chip" + (marcadores.includes(m) ? " on" : "")}
                                  onClick={() => setMarcadores((x) => (x.includes(m) ? x.filter((y) => y !== m) : [...x, m]))}>
                            {m}
                          </button>
                        ))}
                      </div>
                      <input className="fc-input" value={comentario} placeholder="quer contar o que houve?"
                             onChange={(e) => setComentario(e.target.value)} />
                    </>
                  )}
                  <button className="fc-btn" style={{ marginTop: 14 }} disabled={!nota} onClick={mandarNota}>
                    {nota ? "Enviar" : "Toque numa nota"}
                  </button>
                  <button className="fc-btn fc-btn-3" style={{ marginTop: 8 }}
                          onClick={async () => { setAvaliando(false); await entrar(); }}>
                    Deixa pra la
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {dividindo && divisao && (
        <div className="fc-modal" onClick={() => setDividindo(false)}>
          <div className="fc-modal-card" onClick={(ev) => ev.stopPropagation()}>
            <div className="fc-modal-topo">
              <b>Dividir a conta</b>
              <button onClick={() => setDividindo(false)}>fechar</button>
            </div>
            <div style={{ padding: "0 16px 20px" }}>
              <div className="fc-linha" style={{ fontSize: 17 }}>
                <b>Falta pagar</b><b>{money(divisao.falta)}</b>
              </div>
              <div className="fc-hr" />

              <b style={{ fontSize: 14 }}>Igual entre {divisao.pessoas}</b>
              <div className="fc-grupo-sub">Cada um paga {money(divisao.porCabeca)}.</div>
              {loja?.pagar_no_app && (
                <button className="fc-btn" style={{ marginTop: 8 }}
                        onClick={() => pagar(divisao.porCabeca, 0)}>
                  Pagar {money(divisao.porCabeca)}
                </button>
              )}

              <div className="fc-hr" />
              <b style={{ fontSize: 14 }}>Por pessoa</b>
              {divisao.porPessoa.map((p) => (
                <div key={p.membroId ?? "mesa"} style={{ marginTop: 10 }}>
                  <div className="fc-linha">
                    <b>{p.apelido ?? "Sem nome"}</b><b>{money(p.subtotal)}</b>
                  </div>
                  {p.itens.map((i) => (
                    <div key={i.id} className="fc-linha" style={{ fontSize: 13, color: "var(--fc-muted)" }}>
                      <span>{Number(i.qtd)}x {i.nome}{i.pago ? " (pago)" : ""}</span>
                      <span>{money(i.total)}</span>
                    </div>
                  ))}
                  {loja?.pagar_no_app && p.itens.some((i) => !i.pago) && (
                    <button className="fc-btn fc-btn-3" style={{ marginTop: 6 }}
                            onClick={() => pagarItens(p.itens.filter((i) => !i.pago).map((i) => i.id))}>
                      Pagar estes itens
                    </button>
                  )}
                </div>
              ))}
              <p className="fc-grupo-sub" style={{ marginTop: 14 }}>
                A taxa de serviço e o couvert entram no total da mesa, não na
                divisão por item. Quem fecha a conta é o caixa.
              </p>
            </div>
          </div>
        </div>
      )}

      {aberto && (
        <JanelaProduto
          produto={aberto}
          onFechar={() => setAberto(null)}
          onAdicionar={(l) => { setCarrinho((c) => [...c, l]); setAberto(null); }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
function JanelaProduto({
  produto, onFechar, onAdicionar,
}: {
  produto: CardapioProduto;
  onFechar: () => void;
  onAdicionar: (l: Linha) => void;
}) {
  const [variacaoId, setVariacaoId] = useState<string | null>(produto.variacoes[0]?.id ?? null);
  const [qtd, setQtd] = useState(1);
  const [obs, setObs] = useState("");
  const [restricao, setRestricao] = useState("");
  const [sel, setSel] = useState<Record<string, string[]>>({});

  const base = variacaoId
    ? Number(produto.variacoes.find((v) => v.id === variacaoId)?.preco ?? 0)
    : Number(produto.preco_promo ?? produto.preco);

  const escolhidas = produto.grupos.flatMap((g) =>
    (sel[g.id] ?? []).map((oid) => {
      const o = g.opcoes.find((x) => x.id === oid)!;
      return { id: o.id, nome: o.nome, preco: Number(o.preco_extra) };
    })
  );
  const unit = base + escolhidas.reduce((s, o) => s + o.preco, 0);
  const falta = produto.grupos.find((g) => g.obrigatorio && !(sel[g.id]?.length));

  function toggle(grupoId: string, opcaoId: string, maximo: number) {
    setSel((s) => {
      const atual = s[grupoId] ?? [];
      if (atual.includes(opcaoId)) return { ...s, [grupoId]: atual.filter((x) => x !== opcaoId) };
      if (maximo === 1) return { ...s, [grupoId]: [opcaoId] };
      if (atual.length >= maximo) return s;
      return { ...s, [grupoId]: [...atual, opcaoId] };
    });
  }

  return (
    <div className="fc-modal" onClick={onFechar}>
      <div className="fc-modal-card" onClick={(e) => e.stopPropagation()}>
        <div style={{ position: "relative" }}>
          {produto.imagem_url && <img src={produto.imagem_url} alt="" className="fc-modal-foto" />}
          <button className="fc-fechar" onClick={onFechar} aria-label="Fechar">×</button>
        </div>

        <div className="fc-modal-corpo">
          <h2 style={{ fontSize: 20, margin: 0, letterSpacing: "-0.02em" }}>{produto.nome}</h2>
          {produto.descricao && (
            <p style={{ color: "var(--fc-muted)", fontSize: 14, margin: "6px 0 0", lineHeight: 1.4 }}>
              {produto.descricao}
            </p>
          )}

          {(produto.alergenicos?.length || produto.tracos?.length
            || produto.sem_gluten || produto.sem_lactose || produto.vegano || produto.vegetariano) && (
            <div className="fc-alergenico">
              {MARCAS.filter((m) => (produto as unknown as Record<string, unknown>)[m.chave]).length > 0 && (
                <div className="fc-tags" style={{ marginBottom: 6 }}>
                  {MARCAS.filter((m) => (produto as unknown as Record<string, unknown>)[m.chave]).map((m) => (
                    <span key={m.chave} className="fc-tag boa">{m.nome}</span>
                  ))}
                </div>
              )}
              {frase(produto.alergenicos) && <div><b>{frase(produto.alergenicos)}</b></div>}
              {frase(produto.tracos, "Pode conter traços de") && (
                <div style={{ marginTop: 2 }}>{frase(produto.tracos, "Pode conter traços de")}</div>
              )}
              <div style={{ marginTop: 6, fontSize: 12, color: "var(--fc-muted)" }}>
                Em caso de alergia, escreva abaixo. A cozinha recebe o aviso em destaque.
              </div>
            </div>
          )}

          {produto.variacoes.length > 0 && (
            <>
              <div className="fc-grupo-tit">Escolha o tamanho <span className="fc-obrig">obrigatório</span></div>
              {produto.variacoes.map((v) => (
                <label key={v.id} className="fc-opcao">
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input type="radio" checked={variacaoId === v.id} onChange={() => setVariacaoId(v.id)} />
                    {v.nome}
                  </span>
                  <b>{money(Number(v.preco))}</b>
                </label>
              ))}
            </>
          )}

          {produto.grupos.map((g) => (
            <div key={g.id}>
              <div className="fc-grupo-tit">
                {g.nome}
                {g.obrigatorio && <span className="fc-obrig">obrigatório</span>}
              </div>
              <div className="fc-grupo-sub">
                {g.obrigatorio ? "Escolha 1 opção" : `Escolha até ${g.maximo}, se quiser`}
              </div>
              {g.opcoes.map((o) => (
                <label key={o.id} className="fc-opcao">
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input type={g.maximo === 1 ? "radio" : "checkbox"}
                           checked={(sel[g.id] ?? []).includes(o.id)}
                           onChange={() => toggle(g.id, o.id, g.maximo)} />
                    {o.nome}
                  </span>
                  {Number(o.preco_extra) > 0 && <b>+ {money(Number(o.preco_extra))}</b>}
                </label>
              ))}
            </div>
          ))}

          <label className="fc-label">Alguma observação?</label>
          <input className="fc-input" value={obs} onChange={(e) => setObs(e.target.value)}
                 placeholder="sem cebola, ponto da carne, ..." />

          <label className="fc-label">Alergia ou restrição?</label>
          <input className="fc-input" value={restricao} maxLength={120}
                 onChange={(e) => setRestricao(e.target.value)}
                 placeholder="alérgico a camarão, intolerante a lactose, ..." />
          <div className="fc-grupo-sub" style={{ marginTop: 4 }}>
            Isto não é observação: sai destacado no cartão da cozinha.
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 18 }}>
            <div className="fc-qtd">
              <button onClick={() => setQtd((q) => Math.max(1, q - 1))}>−</button>
              <span>{qtd}</span>
              <button onClick={() => setQtd((q) => Math.min(20, q + 1))}>+</button>
            </div>
            <button className="fc-btn" disabled={!!falta}
                    onClick={() => onAdicionar({
                      key: crypto.randomUUID(), produto, variacaoId,
                      nome: produto.nome, qtd, opcoes: escolhidas, obs, restricao, unit,
                    })}>
              {falta ? `Escolha ${falta.nome.toLowerCase()}` : <>Adicionar · {money(unit * qtd)}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function rotulo(s: string): string {
  return ({
    pendente: "aguardando o garçom", aprovado: "na cozinha", em_producao: "preparando",
    pronto: "pronto", entregue: "entregue", cancelado: "cancelado",
  } as Record<string, string>)[s] ?? s;
}
