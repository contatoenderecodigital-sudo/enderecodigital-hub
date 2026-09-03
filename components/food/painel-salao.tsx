"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "@/components/link";
import { IcoAlert, IcoChevronRight, IcoPlus } from "@/components/icons";
import { IcoCardapio, IcoCheck, IcoImpressora, IcoMesa, IcoNfc, IcoPanela, IcoPessoas, IcoRelogio, IcoSino } from "./icones";

// ============================================================================
// Salão: a tela que fica aberta no balcão. Mostra, em ordem de urgência:
// quem chamou, o que espera liberação, o mapa de mesas e o dia até agora.
// Quando a casa ainda não está montada, mostra o passo a passo no lugar.
// ============================================================================

type Mesa = {
  id: string; numero: string; apelido: string | null; capacidade: number;
  sessao_id: string | null; sessao_status: string | null; aberta_em: string | null;
  total: string | null; itens_pendentes: number; chamado_aberto: boolean;
};
type Pedido = {
  id: string; numero_dia: number; status: string; canal: string; total: string;
  mesa_numero: string | null; criado_em: string;
  itens: { id: string; nome_snapshot: string; qtd: string; status: string }[];
};
type Chamado = { id: string; tipo: string; mesa_numero: string; criado_em: string };
type Dia = {
  totais: { pedidos: string; faturamento: string; ticket: string; itens: string };
  porCanal: { canal: string; qtd: string; total: string }[];
  topProdutos: { nome: string; qtd: string; total: string }[];
};
type Praca = {
  area_id: string | null; area_nome: string; pendentes: string; producao: string;
  prontos: string; estourados: string; espera_max: string;
};
type Setup = {
  produtos: number; mesas: number; cartoes: number;
  tablets: number; impressoras: number; equipe: number;
};

const money = (v: number | string) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const minutos = (d: string) => Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 60000));

export default function PainelSalao({ neg }: { neg: string }) {
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [dia, setDia] = useState<Dia | null>(null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [cozinha, setCozinha] = useState<Praca[]>([]);
  const [loja, setLoja] = useState<{ id: string; nome: string; slug: string } | null>(null);
  const [sel, setSel] = useState<Mesa | null>(null);
  const [comanda, setComanda] = useState<{
    sessao: { total: string; subtotal: string; taxa_servico: string; pago: string } | null;
    pedidos: Pedido[];
  } | null>(null);

  const carregar = useCallback(async () => {
    const r = await fetch(`/api/food/painel?neg=${neg}&vista=salao`, { cache: "no-store" });
    if (!r.ok) return;
    const d = await r.json();
    setLoja(d.loja); setMesas(d.mesas ?? []); setPedidos(d.pedidos ?? []);
    setChamados(d.chamados ?? []); setDia(d.dia ?? null); setSetup(d.setup ?? null);
    setCozinha(d.cozinha ?? []);
  }, [neg]);

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 8000);
    return () => clearInterval(t);
  }, [carregar]);

  const acao = useCallback(async (payload: Record<string, unknown>) => {
    await fetch("/api/food/painel", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ neg, ...payload }),
    });
    carregar();
  }, [neg, carregar]);

  async function abrirComanda(m: Mesa) {
    setSel(m);
    if (!m.sessao_id) { setComanda(null); return; }
    const r = await fetch(`/api/food/painel?neg=${neg}&vista=sessao&sessao=${m.sessao_id}`, { cache: "no-store" });
    setComanda(await r.json());
  }

  const aguardando = pedidos.filter((p) => p.status === "pendente");
  const ocupadas = mesas.filter((m) => m.sessao_id).length;
  const naCozinha = pedidos.filter((p) => ["aprovado", "em_producao"].includes(p.status)).length;

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Restaurante</span>
          <h1>Salão</h1>
          <p className="muted">
            Esta tela atualiza sozinha. Deixe aberta no balcão durante o serviço.
          </p>
        </div>
        <div className="row">
          <Link className="btn btn-ghost btn-sm" href={`/food/${neg}/cardapio`}>
            <IcoCardapio width={16} height={16} /> Cardápio
          </Link>
          <Link className="btn btn-sm" href={`/food/${neg}/mesas`}>
            <IcoNfc width={16} height={16} /> Mesas e cartões
          </Link>
        </div>
      </div>

      {setup && <PrimeirosPassos neg={neg} setup={setup} slug={loja?.slug ?? ""} />}

      {/* ---------- números do dia ---------- */}
      <div className="cols-4" style={{ marginBottom: 18 }}>
        <div className="card">
          <div className="kpi">{dia?.totais.pedidos ?? "0"}</div>
          <div className="kpi-label">Pedidos hoje</div>
        </div>
        <div className="card">
          <div className="kpi">{money(dia?.totais.faturamento ?? 0)}</div>
          <div className="kpi-label">Vendido hoje</div>
        </div>
        <div className="card">
          <div className="kpi">{money(dia?.totais.ticket ?? 0)}</div>
          <div className="kpi-label">Ticket médio</div>
        </div>
        <div className="card">
          <div className="kpi">{ocupadas}/{mesas.length}</div>
          <div className="kpi-label">Mesas ocupadas</div>
        </div>
      </div>

      {/* ---------- a cozinha, do mesmo estado que o KDS mostra ---------- */}
      {cozinha.some((p) => Number(p.pendentes) + Number(p.producao) + Number(p.prontos) > 0) && (
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="spread" style={{ marginBottom: 12 }}>
            <div className="row">
              <span className="icon-box sm"><IcoPanela width={17} height={17} /></span>
              <div>
                <b>Cozinha agora</b>
                <div className="muted" style={{ fontSize: 12.5 }}>
                  A mesma fila que a tela da cozinha está vendo, por praça.
                </div>
              </div>
            </div>
          </div>
          <div className="cols-3">
            {cozinha.map((p) => {
              const estourados = Number(p.estourados);
              return (
                <div key={p.area_id ?? "sem"} className="card"
                     style={estourados ? { borderColor: "rgba(214,59,48,.45)" } : undefined}>
                  <div className="spread">
                    <b>{p.area_nome}</b>
                    {estourados > 0 && <span className="badge warn">{estourados} atrasado{estourados > 1 ? "s" : ""}</span>}
                  </div>
                  <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                    {p.pendentes} na fila · {p.producao} fazendo · {p.prontos} pronto{Number(p.prontos) === 1 ? "" : "s"}
                  </div>
                  <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                    Espera mais longa: {p.espera_max} min
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---------- chamados ---------- */}
      {chamados.length > 0 && (
        <div className="card" style={{ marginBottom: 18, borderColor: "rgba(230,180,92,.45)" }}>
          <div className="row" style={{ marginBottom: 12 }}>
            <span className="icon-box sm" style={{ background: "rgba(230,180,92,.14)", borderColor: "rgba(230,180,92,.35)", color: "#f0d49c" }}>
              <IcoSino width={17} height={17} />
            </span>
            <b>Estão te chamando</b>
          </div>
          <div className="row" style={{ flexWrap: "wrap", gap: 10 }}>
            {chamados.map((c) => (
              <button key={c.id} className="btn btn-ghost btn-sm"
                      onClick={() => acao({ acao: "atender_chamado", chamadoId: c.id })}>
                <b>Mesa {c.mesa_numero}</b>
                {c.tipo === "conta" ? " pediu a conta" : " chamou o garçom"}
                <span className="muted"> há {minutos(c.criado_em)} min</span>
                <IcoCheck width={15} height={15} />
              </button>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 10, marginBottom: 0 }}>
            Clique quando alguém for atender, para o chamado sair da fila.
          </p>
        </div>
      )}

      {/* ---------- pedidos esperando liberação ---------- */}
      {aguardando.length > 0 && (
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="spread" style={{ marginBottom: 12 }}>
            <div className="row">
              <span className="icon-box sm"><IcoAlert width={17} height={17} /></span>
              <div>
                <b>Esperando você liberar</b>
                <div className="muted" style={{ fontSize: 12.5 }}>
                  A cozinha só recebe depois que você aceita.
                </div>
              </div>
            </div>
            <span className="badge warn">{aguardando.length}</span>
          </div>
          <div className="cols-3">
            {aguardando.map((p) => (
              <div key={p.id} className="glass-soft" style={{ padding: 14, borderRadius: 14 }}>
                <div className="spread">
                  <b>#{p.numero_dia}</b>
                  <span className="badge">{p.canal === "mesa" ? `Mesa ${p.mesa_numero}` : p.canal}</span>
                </div>
                <div style={{ margin: "8px 0", fontSize: 13.5 }}>
                  {p.itens.map((i) => (
                    <div key={i.id}>{Number(i.qtd)}x {i.nome_snapshot}</div>
                  ))}
                </div>
                <div className="row">
                  <button className="btn btn-sm" onClick={() => acao({ acao: "aprovar", pedidoId: p.id })}>
                    Liberar
                  </button>
                  <button className="btn btn-ghost btn-sm"
                          onClick={() => acao({ acao: "status_pedido", pedidoId: p.id, status: "cancelado" })}>
                    Recusar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------- mapa de mesas ---------- */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="spread" style={{ marginBottom: 14 }}>
          <div className="row">
            <span className="icon-box sm"><IcoMesa width={17} height={17} /></span>
            <div>
              <b>Mesas</b>
              <div className="muted" style={{ fontSize: 12.5 }}>
                Clique na mesa para ver a comanda e fechar a conta.
              </div>
            </div>
          </div>
          <span className="row" style={{ gap: 14, fontSize: 12.5 }}>
            <span className="muted"><Bolinha cor="rgba(255,255,255,.18)" /> livre</span>
            <span className="muted"><Bolinha cor="#6fd39b" /> ocupada</span>
            <span className="muted"><Bolinha cor="#e6b45c" /> chamando</span>
          </span>
        </div>

        {mesas.length === 0 ? (
          <Vazio
            titulo="Nenhuma mesa cadastrada"
            texto="As mesas são o coração do sistema: cada uma vira um cartão que o cliente encosta o celular."
            acao={<Link className="btn btn-sm" href={`/food/${neg}/mesas`}><IcoPlus width={16} height={16} /> Criar mesas</Link>}
          />
        ) : (
          <div className="cols-6-mesas">
            {mesas.map((m) => {
              const ocupada = !!m.sessao_id;
              const cor = m.chamado_aberto ? "#e6b45c" : ocupada ? "#6fd39b" : "rgba(255,255,255,.18)";
              return (
                <button key={m.id} onClick={() => abrirComanda(m)} className="mesa-card"
                        style={{ borderColor: sel?.id === m.id ? "var(--gold)" : undefined }}>
                  <span className="spread">
                    <b style={{ fontSize: 17 }}>{m.numero}</b>
                    <Bolinha cor={cor} />
                  </span>
                  <span className="muted" style={{ fontSize: 12, display: "block", marginTop: 2 }}>
                    {m.apelido || `${m.capacidade} lugares`}
                  </span>
                  {ocupada ? (
                    <>
                      <b style={{ display: "block", marginTop: 8, color: "var(--gold-l)" }}>
                        {money(m.total ?? 0)}
                      </b>
                      <span className="muted" style={{ fontSize: 12, display: "inline-flex", gap: 5, alignItems: "center" }}>
                        <IcoRelogio width={12} height={12} /> {minutos(m.aberta_em!)} min
                        {m.itens_pendentes > 0 && (
                          <>
                            <IcoPanela width={12} height={12} style={{ marginLeft: 4 }} /> {m.itens_pendentes}
                          </>
                        )}
                      </span>
                    </>
                  ) : (
                    <span className="muted" style={{ fontSize: 12.5, display: "block", marginTop: 8 }}>livre</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ---------- comanda da mesa escolhida ---------- */}
      {sel && (
        <div className="modal-overlay" onClick={() => { setSel(null); setComanda(null); }}>
          <div className="modal-panel" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <span className="icon-box"><IcoMesa /></span>
              <div>
                <h2>Mesa {sel.numero}</h2>
                <p>{sel.sessao_id ? `aberta há ${minutos(sel.aberta_em!)} minutos` : "mesa livre"}</p>
              </div>
              <button className="modal-close" onClick={() => { setSel(null); setComanda(null); }}>
                <span aria-hidden>×</span>
              </button>
            </div>

            <div className="modal-body">
              {!sel.sessao_id ? (
                <p className="muted" style={{ margin: 0 }}>
                  A mesa abre sozinha quando o primeiro cliente encostar o celular no cartão.
                  Você também pode lançar pelo tablet do garçom.
                </p>
              ) : (
                <>
                  <div>
                    {comanda?.pedidos?.map((p) => (
                      <div key={p.id} style={{ marginBottom: 10 }}>
                        <div className="muted" style={{ fontSize: 11.5, textTransform: "uppercase", letterSpacing: ".08em" }}>
                          Pedido #{p.numero_dia} · {rotulo(p.status)}
                        </div>
                        {p.itens.map((i) => (
                          <div key={i.id} className="spread" style={{ fontSize: 14, padding: "3px 0" }}>
                            <span>{Number(i.qtd)}x {i.nome_snapshot}</span>
                            <span className="muted">{rotulo(i.status)}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                    {!comanda?.pedidos?.length && <p className="muted">Nada pedido ainda.</p>}
                  </div>

                  {comanda?.sessao && (
                    <div className="glass-soft" style={{ padding: 14, borderRadius: 14 }}>
                      <div className="spread"><span className="muted">Consumo</span><b>{money(comanda.sessao.subtotal)}</b></div>
                      <div className="spread"><span className="muted">Serviço</span><b>{money(comanda.sessao.taxa_servico)}</b></div>
                      <div className="spread" style={{ marginTop: 6, fontSize: 18 }}>
                        <b>Total</b><b className="gold">{money(comanda.sessao.total)}</b>
                      </div>
                      {Number(comanda.sessao.pago) > 0 && (
                        <div className="spread" style={{ fontSize: 13 }}>
                          <span className="muted">já pago</span><span className="muted">{money(comanda.sessao.pago)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label style={{ marginTop: 0 }}>Receber e fechar</label>
                    <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                      {(["dinheiro", "debito", "credito", "pix"] as const).map((m) => (
                        <button key={m} className="btn btn-ghost btn-sm"
                                onClick={() => acao({
                                  acao: "pagamento", sessaoId: sel.sessao_id, metodo: m,
                                  valor: Number(comanda?.sessao?.total ?? 0) - Number(comanda?.sessao?.pago ?? 0),
                                })}>
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {sel.sessao_id && (
              <div className="modal-foot">
                <button className="btn btn-ghost" onClick={() => { setSel(null); setComanda(null); }}>Voltar</button>
                <button className="btn"
                        onClick={async () => {
                          await acao({ acao: "fechar_sessao", sessaoId: sel.sessao_id, por: "painel" });
                          setSel(null); setComanda(null);
                        }}>
                  Fechar mesa
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------- o dia ---------- */}
      <div className="cols-2">
        <div className="card">
          <div className="row" style={{ marginBottom: 12 }}>
            <span className="icon-box sm"><IcoPanela width={17} height={17} /></span>
            <div>
              <b>Na cozinha agora</b>
              <div className="muted" style={{ fontSize: 12.5 }}>{naCozinha} pedido(s) em produção</div>
            </div>
          </div>
          {pedidos.filter((p) => p.status !== "pendente").slice(0, 6).map((p) => (
            <div key={p.id} className="spread" style={{ padding: "7px 0", borderBottom: "1px solid var(--line)" }}>
              <span>
                <b>#{p.numero_dia}</b>{" "}
                <span className="muted">{p.canal === "mesa" ? `mesa ${p.mesa_numero}` : p.canal}</span>
              </span>
              <span className={"badge" + (p.status === "pronto" ? " ok" : "")}>{rotulo(p.status)}</span>
            </div>
          ))}
          {!pedidos.filter((p) => p.status !== "pendente").length && (
            <p className="muted" style={{ fontSize: 13.5, margin: 0 }}>Nada em produção.</p>
          )}
        </div>

        <div className="card">
          <div className="row" style={{ marginBottom: 12 }}>
            <span className="icon-box sm"><IcoPessoas width={17} height={17} /></span>
            <b>Mais vendidos hoje</b>
          </div>
          {dia?.topProdutos?.length ? dia.topProdutos.slice(0, 6).map((p) => (
            <div key={p.nome} className="spread" style={{ padding: "7px 0", borderBottom: "1px solid var(--line)" }}>
              <span>{Number(p.qtd)}x {p.nome}</span>
              <b className="gold">{money(p.total)}</b>
            </div>
          )) : <p className="muted" style={{ fontSize: 13.5, margin: 0 }}>Ainda não vendeu nada hoje.</p>}
        </div>
      </div>

      <style>{`
        .cols-6-mesas { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(148px, 1fr)); }
        .mesa-card { text-align: left; padding: 14px; border-radius: 16px; cursor: pointer;
          background: rgba(255,255,255,.05); border: 1px solid var(--line);
          border-top: 1px solid var(--line-top); color: var(--text);
          transition: transform .12s ease, background .12s ease; font-family: inherit; }
        .mesa-card:hover { transform: translateY(-2px); background: rgba(255,255,255,.09); }
      `}</style>
    </>
  );
}

// ---------------------------------------------------------------------------
function PrimeirosPassos({ neg, setup, slug }: { neg: string; setup: Setup; slug: string }) {
  const passos = [
    {
      pronto: setup.produtos > 0,
      titulo: "Montar o cardápio",
      texto: "Cadastre as categorias e os produtos com preço e foto.",
      href: `/food/${neg}/cardapio`,
      botao: "Ir para o cardápio",
      icone: <IcoCardapio width={17} height={17} />,
    },
    {
      pronto: setup.mesas > 0,
      titulo: "Criar as mesas",
      texto: "Crie as mesas do salão. Cada uma vira um cartão.",
      href: `/food/${neg}/mesas`,
      botao: "Criar mesas",
      icone: <IcoMesa width={17} height={17} />,
    },
    {
      pronto: setup.cartoes > 0,
      titulo: "Gravar os cartões NFC",
      texto: "Copie o link de cada mesa e grave no chip do cartão.",
      href: `/food/${neg}/mesas`,
      botao: "Ver os links",
      icone: <IcoNfc width={17} height={17} />,
    },
    {
      pronto: setup.tablets > 0 || setup.impressoras > 0,
      titulo: "Ligar a cozinha",
      texto: "Um tablet com a tela de pedidos, ou uma impressora de comanda.",
      href: `/food/${neg}/config`,
      botao: "Configurar",
      icone: <IcoImpressora width={17} height={17} />,
    },
  ];
  const faltando = passos.filter((p) => !p.pronto);
  if (!faltando.length) return null;

  return (
    <div className="card" style={{ marginBottom: 18, borderColor: "rgba(201,169,97,.35)" }}>
      <div className="spread" style={{ marginBottom: 14 }}>
        <div>
          <span className="eyebrow">Primeiros passos</span>
          <h2 style={{ margin: "6px 0 2px", fontSize: 19 }}>Falta pouco para abrir a casa</h2>
          <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
            {passos.length - faltando.length} de {passos.length} concluídos. Siga na ordem, leva uns minutos.
          </p>
        </div>
        {slug && (
          <a className="btn btn-ghost btn-sm" href={`/c/${slug}`} target="_blank" rel="noreferrer">
            Ver o cardápio publicado
          </a>
        )}
      </div>

      <div className="cols-4">
        {passos.map((p) => (
          <div key={p.titulo} className="glass-soft"
               style={{ padding: 14, borderRadius: 14, opacity: p.pronto ? 0.55 : 1 }}>
            <div className="row" style={{ marginBottom: 8 }}>
              <span className="icon-box sm" style={p.pronto ? { background: "rgba(111,211,155,.14)", borderColor: "rgba(111,211,155,.35)", color: "#b8f0d0" } : undefined}>
                {p.pronto ? <IcoCheck width={17} height={17} /> : p.icone}
              </span>
              <b style={{ fontSize: 14.5 }}>{p.titulo}</b>
            </div>
            <p className="muted" style={{ fontSize: 12.5, margin: "0 0 10px" }}>{p.texto}</p>
            {!p.pronto && (
              <Link className="btn btn-sm" href={p.href}>
                {p.botao} <IcoChevronRight width={15} height={15} />
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Vazio({ titulo, texto, acao }: { titulo: string; texto: string; acao?: React.ReactNode }) {
  return (
    <div style={{ textAlign: "center", padding: "34px 20px" }}>
      <b style={{ fontSize: 15.5 }}>{titulo}</b>
      <p className="muted" style={{ fontSize: 13.5, maxWidth: 460, margin: "6px auto 14px" }}>{texto}</p>
      {acao}
    </div>
  );
}

function Bolinha({ cor }: { cor: string }) {
  return <span style={{ width: 9, height: 9, borderRadius: 999, background: cor, display: "inline-block" }} />;
}

function rotulo(s: string): string {
  return ({
    pendente: "aguardando", aprovado: "na cozinha", em_producao: "preparando",
    pronto: "pronto", em_entrega: "a caminho", entregue: "entregue", cancelado: "cancelado",
  } as Record<string, string>)[s] ?? s;
}
