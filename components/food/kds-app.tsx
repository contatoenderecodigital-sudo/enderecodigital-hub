"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { siglas } from "@/lib/food-alergenicos";
import "@/app/food-kds.css";

// ============================================================================
// KDS: a tela da cozinha, em Kanban de ITEM.
//
// O que a cozinha não perdoa, e por isso está aqui:
//   1. nunca perder ticket: o canal de tempo real só avisa que mudou; quem
//      manda é o fetch completo, refeito a cada (re)conexão;
//   2. internet caindo: o último estado fica no aparelho, as ações vão para uma
//      fila com chave de idempotência e a faixa diz quantas estão esperando;
//   3. som para ticket novo e para ticket estourado, destravado no primeiro toque;
//   4. dedo com luva: alvo de 64px, fonte grande, contraste alto;
//   5. desfazer de 10 segundos em toda transição, sem senha e sem menu;
//   6. a cor vem do relógio contra a meta da praça, não de prioridade manual.
// ============================================================================

type Item = {
  id: string;
  nome_snapshot: string;
  qtd: string;
  obs: string | null;
  restricao: string | null;
  alergenicos: string[] | null;
  opcoes_json: { nome: string }[] | null;
  status: "pendente" | "em_producao" | "pronto";
  area_id: string | null;
  area_nome: string | null;
  produto_id: string | null;
  produto_esgotado: boolean | null;
  meta_min: number;
  criado_em: string;
  producao_em: string | null;
  pronto_em: string | null;
  pedido_id: string;
  pedido_numero: number;
  canal: string;
  mesa_numero: string | null;
  pedido_criado_em: string;
};
type Chamado = { id: string; tipo: string; mesa_numero: string; criado_em: string };
type Area = { id: string; nome: string; meta_min: number };
type Estado = {
  dispositivo: { nome: string; tipo: string; loja: string; area: string | null; areaId: string | null };
  areas: Area[];
  itens: Item[];
  chamados: Chamado[];
  rev: string;
  agora: string;
};
type Pendente = { chave: string; corpo: Record<string, unknown> };

const COLUNAS = [
  { estado: "pendente", titulo: "Recebido", proximo: "em_producao", rotulo: "Fazendo" },
  { estado: "em_producao", titulo: "Em preparo", proximo: "pronto", rotulo: "Pronto" },
  { estado: "pronto", titulo: "Pronto", proximo: "entregue", rotulo: "Entregue" },
] as const;

const MOTIVOS = ["Acabou o insumo", "Cliente desistiu", "Erro no lançamento", "Demorou demais"];

const relogio = (seg: number) => {
  const m = Math.floor(Math.abs(seg) / 60);
  const s = Math.floor(Math.abs(seg) % 60);
  return `${seg < 0 ? "-" : ""}${m}:${String(s).padStart(2, "0")}`;
};

function guardar(chave: string, valor: unknown) {
  try { localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* modo privado */ }
}
function ler<T>(chave: string, padrao: T): T {
  try {
    const v = localStorage.getItem(chave);
    return v ? (JSON.parse(v) as T) : padrao;
  } catch { return padrao; }
}

// ---------------------------------------------------------------------------
// Som. O navegador só deixa tocar depois do primeiro toque na tela, então o
// contexto de áudio nasce travado e é destravado no primeiro clique de verdade.
// ---------------------------------------------------------------------------
function useSom(mudo: boolean) {
  const ctx = useRef<AudioContext | null>(null);
  const destravar = useCallback(() => {
    if (ctx.current) { void ctx.current.resume(); return; }
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx.current = new AC();
      void ctx.current.resume();
    } catch { /* aparelho sem áudio: segue sem som */ }
  }, []);
  const tocar = useCallback((tipo: "novo" | "estourou") => {
    if (mudo || !ctx.current || ctx.current.state !== "running") return;
    const c = ctx.current;
    const notas = tipo === "novo" ? [880, 1320] : [440, 330, 440];
    notas.forEach((hz, i) => {
      const osc = c.createOscillator();
      const vol = c.createGain();
      osc.type = tipo === "novo" ? "sine" : "square";
      osc.frequency.value = hz;
      vol.gain.setValueAtTime(0.0001, c.currentTime + i * 0.18);
      vol.gain.exponentialRampToValueAtTime(0.22, c.currentTime + i * 0.18 + 0.02);
      vol.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + i * 0.18 + 0.16);
      osc.connect(vol); vol.connect(c.destination);
      osc.start(c.currentTime + i * 0.18);
      osc.stop(c.currentTime + i * 0.18 + 0.2);
    });
  }, [mudo]);
  return { destravar, tocar };
}

export default function KdsApp({ token }: { token: string }) {
  const K = `kds:${token.slice(0, 8)}`;
  const [estado, setEstado] = useState<Estado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [fila, setFila] = useState<Pendente[]>([]);
  const [praca, setPraca] = useState<string | null>(null);
  const [mudo, setMudo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [desfazer, setDesfazer] = useState<{ itemId: string; nome: string; ate: number } | null>(null);
  const [cancelando, setCancelando] = useState<Item | null>(null);
  const [oitentaSeis, setOitentaSeis] = useState<Item | null>(null);
  const [, tique] = useState(0);

  const revRef = useRef("");
  const idsRef = useRef<Set<string>>(new Set());
  const estouradosRef = useRef<Set<string>>(new Set());
  const filaRef = useRef<Pendente[]>([]);
  const enviandoRef = useRef(false);
  const deltaRef = useRef(0); // relógio do servidor menos o do tablet
  const primeiraRef = useRef(true);

  const { destravar, tocar } = useSom(mudo);

  // ---- preferências do aparelho
  useEffect(() => {
    setPraca(ler<string | null>(`${K}:praca`, null));
    setMudo(ler<boolean>(`${K}:mudo`, false));
    setFila(ler<Pendente[]>(`${K}:fila`, []));
    const cache = ler<Estado | null>(`${K}:estado`, null);
    if (cache) setEstado(cache);
  }, [K]);
  useEffect(() => { filaRef.current = fila; guardar(`${K}:fila`, fila); }, [fila, K]);

  // ---- relógio de parede, um tique por segundo
  useEffect(() => {
    const t = setInterval(() => tique((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // ---- o estado completo. Chamado ao abrir, a cada aviso e a cada reconexão.
  const carregar = useCallback(async () => {
    try {
      const r = await fetch(`/api/food/kds?token=${encodeURIComponent(token)}`, { cache: "no-store" });
      if (r.status === 404) {
        const d = await r.json().catch(() => ({}));
        setErro(typeof d?.mensagem === "string"
          ? d.mensagem
          : "Tablet não reconhecido. Peça um link novo na configuração.");
        return;
      }
      if (!r.ok) throw new Error("http");
      const d = (await r.json()) as Estado;
      deltaRef.current = new Date(d.agora).getTime() - Date.now();
      revRef.current = d.rev;
      setEstado(d);
      guardar(`${K}:estado`, d);
      setOnline(true);
      setErro(null);

      // som de ticket novo: item que ainda não estava na tela
      const agora = new Set(d.itens.map((i) => i.id));
      if (!primeiraRef.current) {
        const chegou = d.itens.some((i) => !idsRef.current.has(i.id));
        if (chegou) tocar("novo");
      }
      primeiraRef.current = false;
      idsRef.current = agora;
    } catch {
      setOnline(false);
    }
  }, [token, K, tocar]);

  useEffect(() => { void carregar(); }, [carregar]);

  // ---- canal de tempo real, com backoff exponencial e sorteio
  useEffect(() => {
    let fonte: EventSource | null = null;
    let tentativa = 0;
    let morto = false;
    let religar: ReturnType<typeof setTimeout> | null = null;

    const abrir = () => {
      if (morto) return;
      fonte = new EventSource(`/api/food/kds/stream?token=${encodeURIComponent(token)}`);
      fonte.addEventListener("open", () => {
        tentativa = 0;
        setOnline(true);
        // ao (re)conectar, SEMPRE o estado inteiro: o stream pode ter perdido
        // o que aconteceu enquanto a conexão estava fora.
        void carregar();
      });
      fonte.addEventListener("rev", (e) => {
        try {
          const d = JSON.parse((e as MessageEvent).data) as { rev: string };
          if (d.rev !== revRef.current) void carregar();
        } catch { void carregar(); }
      });
      fonte.addEventListener("fim", () => { fonte?.close(); abrir(); });
      fonte.addEventListener("error", () => {
        fonte?.close();
        setOnline(false);
        tentativa++;
        const espera = Math.min(30000, 1000 * 2 ** Math.min(tentativa, 5));
        const sorteio = Math.floor(Math.random() * 800); // dois tablets não voltam juntos
        religar = setTimeout(abrir, espera + sorteio);
      });
    };
    abrir();
    return () => {
      morto = true;
      if (religar) clearTimeout(religar);
      fonte?.close();
    };
  }, [token, carregar]);

  // ---- polling de reserva: mesmo com o canal vivo, um fetch a cada 20s
  useEffect(() => {
    const t = setInterval(() => { void carregar(); }, 20000);
    return () => clearInterval(t);
  }, [carregar]);

  // ---- a fila de ações pendentes
  const escoar = useCallback(async () => {
    if (enviandoRef.current) return;
    enviandoRef.current = true;
    try {
      while (filaRef.current.length) {
        const p = filaRef.current[0];
        let r: Response;
        try {
          r = await fetch("/api/food/kds", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, chave: p.chave, ...p.corpo }),
          });
        } catch {
          setOnline(false);           // sem rede: a fila espera, nada se perde
          return;
        }
        if (r.status >= 500) { setOnline(false); return; }
        const d = await r.json().catch(() => ({}));
        if (!r.ok && d?.mensagem) setAviso(String(d.mensagem));
        // 4xx e 409 são decisão do servidor: tira da fila para não travar tudo
        filaRef.current = filaRef.current.slice(1);
        setFila(filaRef.current);
        setOnline(true);
      }
      await carregar();
    } finally {
      enviandoRef.current = false;
    }
  }, [token, carregar]);

  useEffect(() => { if (fila.length) void escoar(); }, [fila.length, escoar]);
  useEffect(() => {
    // sem rede, a fila tenta de novo sozinha a cada 5 segundos
    if (!fila.length) return;
    const t = setInterval(() => { void escoar(); }, 5000);
    return () => clearInterval(t);
  }, [fila.length, escoar]);
  useEffect(() => {
    const voltou = () => { setOnline(true); void escoar(); };
    window.addEventListener("online", voltou);
    return () => window.removeEventListener("online", voltou);
  }, [escoar]);

  const agir = useCallback((corpo: Record<string, unknown>, otimista?: (e: Estado) => Estado) => {
    destravar();
    const chave = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    if (otimista) {
      setEstado((e) => {
        if (!e) return e;
        const novo = otimista(e);
        guardar(`${K}:estado`, novo);
        return novo;
      });
    }
    filaRef.current = [...filaRef.current, { chave, corpo }];
    setFila(filaRef.current);
  }, [destravar, K]);

  // ---- transições
  const mover = (item: Item, para: string, motivo?: string) => {
    agir({ acao: "item", itemId: item.id, para, motivo }, (e) => ({
      ...e,
      itens: para === "entregue" || para === "cancelado"
        ? e.itens.filter((i) => i.id !== item.id)
        : e.itens.map((i) => (i.id === item.id
            ? {
                ...i,
                status: para as Item["status"],
                producao_em: para === "em_producao" || para === "pronto" ? (i.producao_em ?? new Date().toISOString()) : i.producao_em,
                pronto_em: para === "pronto" ? new Date().toISOString() : i.pronto_em,
              }
            : i)),
    }));
    setDesfazer({ itemId: item.id, nome: item.nome_snapshot, ate: Date.now() + 10000 });
  };

  const desfazerAgora = () => {
    if (!desfazer) return;
    agir({ acao: "desfazer", itemId: desfazer.itemId });
    setDesfazer(null);
    setAviso("Desfeito");
  };

  const sairTudo = (pedidoId: string, para: string) => {
    agir({ acao: "pedido", pedidoId, para }, (e) => ({
      ...e,
      itens: para === "entregue"
        ? e.itens.filter((i) => i.pedido_id !== pedidoId)
        : e.itens.map((i) => (i.pedido_id === pedidoId ? { ...i, status: para as Item["status"] } : i)),
    }));
  };

  const marcar86 = (item: Item) => {
    if (!item.produto_id) return;
    agir({ acao: "86", produtoId: item.produto_id, esgotado: true });
    setOitentaSeis(null);
    setAviso(`${item.nome_snapshot} saiu do cardápio de todo mundo`);
  };

  // ---- o desfazer some sozinho em 10 segundos
  useEffect(() => {
    if (!desfazer) return;
    const t = setTimeout(() => setDesfazer(null), Math.max(0, desfazer.ate - Date.now()));
    return () => clearTimeout(t);
  }, [desfazer]);
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 4000);
    return () => clearTimeout(t);
  }, [aviso]);

  // ---- filtro por praça, guardado no aparelho
  const itens = useMemo(() => {
    const todos = estado?.itens ?? [];
    return praca ? todos.filter((i) => i.area_id === praca) : todos;
  }, [estado, praca]);

  const agoraMs = Date.now() + deltaRef.current;

  // ---- som de estouro: item que passou da meta desde o último tique
  useEffect(() => {
    for (const i of itens) {
      if (i.status === "pronto") continue;
      const seg = (agoraMs - new Date(i.criado_em).getTime()) / 1000;
      if (seg > i.meta_min * 60 && !estouradosRef.current.has(i.id)) {
        estouradosRef.current.add(i.id);
        tocar("estourou");
      }
    }
  });

  if (erro) return <div className="kds"><div className="kds-erro">{erro}</div></div>;
  if (!estado) return <div className="kds"><div className="kds-erro">Abrindo a cozinha...</div></div>;

  const cor = (i: Item) => {
    if (i.status === "pronto") {
      const parado = (agoraMs - new Date(i.pronto_em ?? i.criado_em).getTime()) / 1000;
      return parado > 300 ? "vermelho" : parado > 180 ? "ambar" : "";
    }
    const pct = (agoraMs - new Date(i.criado_em).getTime()) / 1000 / (i.meta_min * 60);
    return pct >= 1 ? "vermelho" : pct >= 0.7 ? "ambar" : "";
  };

  const cronometro = (i: Item) => {
    if (i.status === "pronto") {
      // na coluna Pronto o que importa é o tempo PARADO na janela: é este
      // número que estraga a experiência do cliente e que ninguém mostra.
      return relogio((agoraMs - new Date(i.pronto_em ?? i.criado_em).getTime()) / 1000);
    }
    return relogio((agoraMs - new Date(i.criado_em).getTime()) / 1000);
  };

  return (
    <div className="kds" onPointerDown={destravar}>
      <header className="kds-topo">
        <div className="kds-marca">
          {estado.dispositivo.loja}{" "}
          <span>{estado.dispositivo.area ?? (praca ? estado.areas.find((a) => a.id === praca)?.nome : "todas as praças")}</span>
        </div>

        {estado.areas.length > 1 && (
          <div className="kds-chips">
            <button className={"kds-chip" + (praca === null ? " on" : "")}
                    onClick={() => { setPraca(null); guardar(`${K}:praca`, null); }}>
              Todas
            </button>
            {estado.areas.map((a) => (
              <button key={a.id} className={"kds-chip" + (praca === a.id ? " on" : "")}
                      onClick={() => { setPraca(a.id); guardar(`${K}:praca`, a.id); }}>
                {a.nome}
              </button>
            ))}
          </div>
        )}

        <button className={"kds-icone" + (mudo ? " alerta" : "")}
                onClick={() => { const m = !mudo; setMudo(m); guardar(`${K}:mudo`, m); destravar(); }}
                title={mudo ? "Som desligado" : "Som ligado"}>
          {mudo ? "sem som" : "som"}
        </button>
        <div className="kds-relogio">
          {new Date(agoraMs).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </header>

      {(!online || fila.length > 0) && (
        <div className={"kds-faixa" + (!online ? " ruim" : "")}>
          {!online
            ? `Sem conexão${fila.length ? ` - ${fila.length} ${fila.length === 1 ? "ação pendente" : "ações pendentes"}` : ""}. A tela continua funcionando e envia quando voltar.`
            : `Enviando ${fila.length} ${fila.length === 1 ? "ação" : "ações"}...`}
        </div>
      )}

      {estado.chamados.length > 0 && (
        <div className="kds-chamados">
          {estado.chamados.map((c) => (
            <button key={c.id} className="kds-chamado"
                    onClick={() => agir({ acao: "chamado", chamadoId: c.id }, (e) => ({
                      ...e, chamados: e.chamados.filter((x) => x.id !== c.id),
                    }))}>
              Mesa {c.mesa_numero} · {c.tipo === "conta" ? "pediu a conta" : c.tipo === "ajuda" ? "precisa de ajuda" : "chamou"}
              {" · "}{Math.floor((agoraMs - new Date(c.criado_em).getTime()) / 60000)} min
            </button>
          ))}
        </div>
      )}

      <div className="kds-colunas">
        {COLUNAS.map((col) => {
          const lista = itens.filter((i) => i.status === col.estado);
          return (
            <section key={col.estado} className="kds-coluna">
              <div className="kds-coluna-topo">
                <span className="kds-coluna-nome">{col.titulo}</span>
                <span className="kds-coluna-qtd">{lista.length}</span>
              </div>
              {lista.length === 0 && <div className="kds-vazio">Nada aqui.</div>}
              {lista.map((i) => (
                <article key={i.id} className={`kds-card ${cor(i)}`}>
                  <div className="kds-card-topo">
                    <span className="kds-onde">
                      {i.canal === "mesa" ? `Mesa ${i.mesa_numero ?? "-"}` : i.canal}
                    </span>
                    <span>#{i.pedido_numero}</span>
                    <span className="kds-tempo">{cronometro(i)}</span>
                  </div>

                  <div className="kds-nome"><b>{Number(i.qtd)}x</b> {i.nome_snapshot}</div>
                  {(i.opcoes_json ?? []).map((o, k) => (
                    <div key={k} className="kds-opcao">+ {o.nome}</div>
                  ))}
                  {i.obs && <div className="kds-obs">{i.obs}</div>}
                  {i.restricao && (
                    <div className="kds-alergia">
                      ALERGIA: {i.restricao.toUpperCase()}
                    </div>
                  )}
                  {siglas(i.alergenicos) && (
                    <div className="kds-praca">contém {siglas(i.alergenicos)}</div>
                  )}
                  {!praca && i.area_nome && <div className="kds-praca">{i.area_nome}</div>}

                  <div className="kds-acoes">
                    <button className={"kds-btn " + (col.estado === "pendente" ? "fazer" : "principal")}
                            onClick={() => mover(i, col.proximo)}>
                      {col.rotulo}
                    </button>
                    {col.estado === "pendente" && (
                      <button className="kds-btn principal" onClick={() => mover(i, "pronto")}>
                        Pronto
                      </button>
                    )}
                    <button className="kds-btn menor" onClick={() => setCancelando(i)}>x</button>
                    {i.produto_id && !i.produto_esgotado && (
                      <button className="kds-btn menor" onClick={() => setOitentaSeis(i)}>86</button>
                    )}
                  </div>

                  {col.estado !== "pronto" &&
                   lista.filter((x) => x.pedido_id === i.pedido_id).length > 1 &&
                   lista.find((x) => x.pedido_id === i.pedido_id)?.id === i.id && (
                    <button className="kds-btn menor" style={{ flex: 1 }}
                            onClick={() => sairTudo(i.pedido_id, col.proximo)}>
                      {col.rotulo} tudo do #{i.pedido_numero}
                    </button>
                  )}
                </article>
              ))}
            </section>
          );
        })}
      </div>

      {desfazer && (
        <div className="kds-desfazer">
          <span>{desfazer.nome}</span>
          <span className="conta">{Math.max(0, Math.ceil((desfazer.ate - Date.now()) / 1000))}s</span>
          <button onClick={desfazerAgora}>Desfazer</button>
        </div>
      )}

      {cancelando && (
        <div className="kds-modal" onClick={() => setCancelando(null)}>
          <div className="kds-modal-card" onClick={(ev) => ev.stopPropagation()}>
            <h3>Cancelar {cancelando.nome_snapshot}</h3>
            <p>Fica registrado quem cancelou e por quê.</p>
            <div className="kds-motivos">
              {MOTIVOS.map((m) => (
                <button key={m} className="kds-motivo"
                        onClick={() => { mover(cancelando, "cancelado", m); setCancelando(null); }}>
                  {m}
                </button>
              ))}
            </div>
            <div className="kds-modal-pe">
              <button className="kds-btn" onClick={() => setCancelando(null)}>Voltar</button>
            </div>
          </div>
        </div>
      )}

      {oitentaSeis && (
        <div className="kds-modal" onClick={() => setOitentaSeis(null)}>
          <div className="kds-modal-card" onClick={(ev) => ev.stopPropagation()}>
            <h3>Acabou {oitentaSeis.nome_snapshot}?</h3>
            <p>Some do cardápio de todos os celulares abertos agora. Volta sozinho amanhã, ou na hora, pelo painel.</p>
            <div className="kds-modal-pe">
              <button className="kds-btn principal" onClick={() => marcar86(oitentaSeis)}>Acabou</button>
              <button className="kds-btn" onClick={() => setOitentaSeis(null)}>Voltar</button>
            </div>
          </div>
        </div>
      )}

      {aviso && <div className="kds-aviso">{aviso}</div>}
    </div>
  );
}
