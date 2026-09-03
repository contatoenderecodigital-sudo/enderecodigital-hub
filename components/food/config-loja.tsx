"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IcoPlus, IcoSettings, IcoTrash } from "@/components/icons";
import { IcoCheck, IcoCopiar, IcoImpressora, IcoMoto, IcoPanela, IcoPessoas, IcoRelogio } from "./icones";
import type { FoodArea, FoodImpressora, FoodLoja } from "@/lib/food-types";

// ============================================================================
// Configuração: tudo que o dono muda sozinho. Cada bloco explica em uma linha
// para que serve, porque ninguém lê manual no meio do serviço.
// ============================================================================

type Dispositivo = {
  id: string; nome: string; tipo: string; token: string;
  area_id: string | null; area_nome: string | null; ultimo_uso: string | null; ativo: boolean;
  pareado_em: string | null; parear_ate: string | null; pareado_ip: string | null;
};
type Equipe = { id: string; nome: string; papel: string; ativo: boolean };
type Horario = { id: string; dia_semana: number; abre: string; fecha: string; canal: string };
type Bairro = {
  id: string; nome: string; cidade: string | null; taxa: string;
  tempo_min: number; pedido_minimo: string; ativo: boolean;
};

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

async function prepararFoto(file: File, lado = 600): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const escala = Math.min(1, lado / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * escala);
  const h = Math.round(bitmap.height * escala);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, w, h);
  return canvas.toDataURL("image/webp", 0.85);
}

export default function ConfigLoja({ neg, ehOwner = false }: { neg: string; ehOwner?: boolean }) {
  const [loja, setLoja] = useState<FoodLoja | null>(null);
  const [areas, setAreas] = useState<FoodArea[]>([]);
  const [impressoras, setImpressoras] = useState<FoodImpressora[]>([]);
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([]);
  const [equipe, setEquipe] = useState<Equipe[]>([]);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [bairros, setBairros] = useState<Bairro[]>([]);
  const [aberta, setAberta] = useState<boolean | null>(null);
  const [base, setBase] = useState("");
  const [psp, setPsp] = useState("");
  const [slug, setSlug] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [secao, setSecao] = useState<"loja" | "mesa" | "cozinha" | "equipe" | "entrega" | "pagamento">("loja");
  const logoRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setBase(window.location.origin); }, []);

  const carregar = useCallback(async () => {
    const r = await fetch(`/api/food/painel?neg=${neg}&vista=config`, { cache: "no-store" });
    if (!r.ok) return;
    const d = await r.json();
    setLoja(d.loja); setAreas(d.areas ?? []); setImpressoras(d.impressoras ?? []);
    setDispositivos(d.dispositivos ?? []); setEquipe(d.equipe ?? []);
    setHorarios(d.horarios ?? []); setBairros(d.bairros ?? []); setAberta(d.aberta ?? null);
  }, [neg]);

  useEffect(() => { carregar(); }, [carregar]);

  const acao = useCallback(async (payload: Record<string, unknown>) => {
    const r = await fetch("/api/food/painel", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ neg, ...payload }),
    });
    const d = await r.json().catch(() => ({}));
    await carregar();
    return d as Record<string, unknown>;
  }, [neg, carregar]);

  function avisar(t: string) { setMsg(t); setTimeout(() => setMsg(null), 2500); }
  function campo(k: keyof FoodLoja, v: unknown) {
    setLoja((l) => (l ? ({ ...l, [k]: v } as FoodLoja) : l));
  }

  async function salvar() {
    if (!loja) return;
    await acao({
      acao: "atualizar_loja",
      campos: {
        nome: loja.nome, tipo: loja.tipo, telefone: loja.telefone, whatsapp: loja.whatsapp,
        endereco: loja.endereco, cidade: loja.cidade, uf: loja.uf,
        cor_destaque: loja.cor_destaque, logo_url: loja.logo_url,
        aceita_mesa: loja.aceita_mesa, aceita_balcao: loja.aceita_balcao,
        aceita_delivery: loja.aceita_delivery, aceita_retirada: loja.aceita_retirada,
        exige_aprovacao_garcom: loja.exige_aprovacao_garcom,
        limite_sessao_sem_aprov: Number(loja.limite_sessao_sem_aprov),
        taxa_servico_pct: Number(loja.taxa_servico_pct),
        taxa_servico_automatica: loja.taxa_servico_automatica,
        couvert: Number(loja.couvert),
        tempo_preparo_min: Number(loja.tempo_preparo_min),
        entrega_pedido_minimo: Number(loja.entrega_pedido_minimo),
        pagar_no_app: loja.pagar_no_app,
        pix_provedor: loja.pix_provedor, pix_chave: loja.pix_chave,
        gorjeta_sugerida_pct: Number(loja.gorjeta_sugerida_pct),
        aberto_manual: loja.aberto_manual,
      },
    });
    avisar("Salvo");
  }

  if (!loja) return <p className="muted">Carregando...</p>;

  const secoes: [typeof secao, string, React.ReactNode][] = [
    ["loja", "A loja", <IcoSettings key="1" width={16} height={16} />],
    ["mesa", "Regras da mesa", <IcoRelogio key="2" width={16} height={16} />],
    ["cozinha", "Cozinha e impressão", <IcoPanela key="3" width={16} height={16} />],
    ["equipe", "Equipe", <IcoPessoas key="4" width={16} height={16} />],
    ["entrega", "Entrega", <IcoMoto key="5" width={16} height={16} />],
    ["pagamento", "Pagamento", <IcoCopiar key="6" width={16} height={16} />],
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Restaurante</span>
          <h1>Configuração</h1>
          <p className="muted">
            Cardápio público: <code className="gold">{base}/c/{loja.slug}</code>
            {aberta !== null && (
              <span className={"badge " + (aberta ? "ok" : "warn")} style={{ marginLeft: 10 }}>
                {aberta ? "aberta agora" : "fechada agora"}
              </span>
            )}
          </p>
        </div>
        <div className="row">
          {msg && <span className="badge ok">{msg}</span>}
          <button className="btn" onClick={salvar}>Salvar alterações</button>
        </div>
      </div>

      <div className="row" style={{ gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
        {secoes.map(([k, r, i]) => (
          <button key={k} className={"wsnav-tab" + (secao === k ? " active" : "")} onClick={() => setSecao(k)}>
            {i} {r}
          </button>
        ))}
      </div>

      {/* ================= A LOJA ================= */}
      {secao === "loja" && (
        <>
          <Bloco titulo="Identidade" texto="É o que o cliente vê no topo do cardápio quando encosta o celular.">
            <div className="cols-2">
              <div>
                <label style={{ marginTop: 0 }}>Nome da casa</label>
                <input value={loja.nome} onChange={(e) => campo("nome", e.target.value)} />
                <label>Tipo</label>
                <select value={loja.tipo} onChange={(e) => campo("tipo", e.target.value)}>
                  {["restaurante", "bar", "pizzaria", "lanchonete", "cafe", "sorveteria", "outro"].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <label>Endereço</label>
                <input value={loja.endereco ?? ""} onChange={(e) => campo("endereco", e.target.value)} />
                <div className="cols-2">
                  <div>
                    <label>Cidade</label>
                    <input value={loja.cidade ?? ""} onChange={(e) => campo("cidade", e.target.value)} />
                  </div>
                  <div>
                    <label>WhatsApp</label>
                    <input value={loja.whatsapp ?? ""} onChange={(e) => campo("whatsapp", e.target.value)}
                           placeholder="49 99999 0000" />
                  </div>
                </div>
              </div>

              <div>
                <label style={{ marginTop: 0 }}>Logo</label>
                <div className="row">
                  {loja.logo_url
                    ? <img src={loja.logo_url} alt="" style={{ width: 64, height: 64, borderRadius: 14, objectFit: "cover" }} />
                    : <span className="icon-box" style={{ width: 64, height: 64, borderRadius: 14 }}>—</span>}
                  <input ref={logoRef} type="file" accept="image/*" style={{ display: "none" }}
                         onChange={async (e) => {
                           const f = e.target.files?.[0];
                           if (!f) return;
                           const dataUrl = await prepararFoto(f);
                           await acao({ acao: "foto", dataUrl, origem: "logo" });
                           avisar("Logo trocada");
                         }} />
                  <button className="btn btn-ghost btn-sm" onClick={() => logoRef.current?.click()}>Trocar logo</button>
                </div>

                <label>Cor da marca</label>
                <div className="row">
                  <input type="color" value={loja.cor_destaque || "#b45309"} style={{ width: 58, padding: 3 }}
                         onChange={(e) => campo("cor_destaque", e.target.value)} />
                  <input value={loja.cor_destaque ?? ""} placeholder="#b45309"
                         onChange={(e) => campo("cor_destaque", e.target.value)} />
                </div>
                <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  É a cor do cabeçalho e dos botões no celular do cliente. Use a cor da fachada.
                </p>
              </div>
            </div>
          </Bloco>

          <Bloco titulo="Endereço do cardápio"
                 texto={ehOwner
                   ? "Este é o link que vai gravado no cartão NFC e na bio do cliente. Trocar depois de imprimir cartão obriga a regravar tudo."
                   : "Este é o endereço do seu cardápio, montado e mantido pela Endereço Digital. Ele fica travado de propósito: os cartões NFC das mesas apontam para ele, e mudar o endereço faria todos os cartões pararem de funcionar."}>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <span className="muted" style={{ fontSize: 13.5 }}>{base}/c/</span>
              {ehOwner ? (
                <>
                  <input value={slug || loja.slug} style={{ maxWidth: 260 }}
                         onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} />
                  <button className="btn btn-sm"
                          onClick={async () => {
                            const novo = (slug || loja.slug).trim();
                            if (!novo || novo === loja.slug) return;
                            if (!confirm(`Trocar o endereço para ${novo}? Todos os cartões NFC já gravados param de funcionar.`)) return;
                            await acao({ acao: "atualizar_loja", campos: { slug: novo } });
                            setSlug(""); avisar("Endereço trocado. Regrave os cartões.");
                          }}>
                    Trocar endereço
                  </button>
                  <span className="badge warn">só o owner vê isto</span>
                </>
              ) : (
                <>
                  <b>{loja.slug}</b>
                  <span className="badge">travado</span>
                </>
              )}
              <a className="btn btn-ghost btn-sm" href={`/c/${loja.slug}`} target="_blank" rel="noreferrer"
                 style={{ marginLeft: "auto" }}>
                Abrir cardápio
              </a>
              <button className="btn btn-ghost btn-sm"
                      onClick={() => { navigator.clipboard.writeText(`${base}/c/${loja.slug}`); avisar("Link copiado"); }}>
                <IcoCopiar width={14} height={14} /> Copiar
              </button>
            </div>
          </Bloco>

          <Bloco titulo="Horário de funcionamento"
                 texto="Fora do horário, o pedido online é bloqueado. Deixe vazio o dia que não abre.">
            <Horarios horarios={horarios}
                      onSalvar={async (faixas) => { await acao({ acao: "horarios", faixas }); avisar("Horário salvo"); }} />
            <label>Abrir e fechar na mão</label>
            <select value={loja.aberto_manual === null ? "auto" : loja.aberto_manual ? "aberta" : "fechada"}
                    onChange={(e) => campo("aberto_manual", e.target.value === "auto" ? null : e.target.value === "aberta")}
                    style={{ maxWidth: 320 }}>
              <option value="auto">Seguir o horário</option>
              <option value="aberta">Forçar aberta agora</option>
              <option value="fechada">Forçar fechada agora</option>
            </select>
          </Bloco>
        </>
      )}

      {/* ================= REGRAS DA MESA ================= */}
      {secao === "mesa" && (
        <>
          <Bloco titulo="Como o cliente pede" texto="Vale para quem encosta o celular no cartão da mesa.">
            <div className="cols-2">
              <div>
                <Check rotulo="Aceita pedido pela mesa" v={loja.aceita_mesa} on={(v) => campo("aceita_mesa", v)}
                       ajuda="Desligue se quiser que só o garçom lance pedido." />
                <Check rotulo="Pedido da mesa espera o garçom liberar" v={loja.exige_aprovacao_garcom}
                       on={(v) => campo("exige_aprovacao_garcom", v)}
                       ajuda="Ligado, nada vai para a cozinha sem alguém conferir. Bar cheio costuma deixar desligado." />
                <label>Limite por mesa sem aprovação</label>
                <input type="number" step="1" value={String(loja.limite_sessao_sem_aprov)}
                       onChange={(e) => campo("limite_sessao_sem_aprov", e.target.value)} />
                <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  Passou desse valor, o pedido para e chama o garçom. Zero significa sem limite.
                </p>
              </div>
              <div>
                <Check rotulo="Aceita balcão" v={loja.aceita_balcao} on={(v) => campo("aceita_balcao", v)} />
                <label>Tempo médio de preparo (minutos)</label>
                <input type="number" value={String(loja.tempo_preparo_min)}
                       onChange={(e) => campo("tempo_preparo_min", e.target.value)} />
                <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  É o que o cliente vê como previsão. Chute alto é melhor que chute baixo.
                </p>
              </div>
            </div>
          </Bloco>

          <Bloco titulo="Conta" texto="Como a conta fecha no fim.">
            <div className="cols-3">
              <div>
                <label style={{ marginTop: 0 }}>Taxa de serviço (%)</label>
                <input type="number" step="0.5" value={String(loja.taxa_servico_pct)}
                       onChange={(e) => campo("taxa_servico_pct", e.target.value)} />
              </div>
              <div>
                <label style={{ marginTop: 0 }}>Couvert por pessoa</label>
                <input type="number" step="0.5" value={String(loja.couvert)}
                       onChange={(e) => campo("couvert", e.target.value)} />
              </div>
              <div>
                <label style={{ marginTop: 0 }}>Gorjeta sugerida (%)</label>
                <input type="number" step="1" value={String(loja.gorjeta_sugerida_pct)}
                       onChange={(e) => campo("gorjeta_sugerida_pct", e.target.value)} />
              </div>
            </div>
            <Check rotulo="Somar o serviço automaticamente na conta" v={loja.taxa_servico_automatica}
                   on={(v) => campo("taxa_servico_automatica", v)} />
          </Bloco>
        </>
      )}

      {/* ================= COZINHA ================= */}
      {secao === "cozinha" && (
        <>
          <Bloco titulo="Áreas de produção"
                 texto="Cozinha, chapa, bar. Cada produto aponta para uma área, e é ela que decide em qual tela o pedido aparece e em qual impressora sai.">
            {areas.map((a) => (
              <LinhaEditavel key={a.id} nome={a.nome} info={a.ativa ? "" : "desligada"}
                             onRenomear={(nome) => acao({ acao: "atualizar_area", id: a.id, campos: { nome } })}
                             onAlternar={() => acao({ acao: "atualizar_area", id: a.id, campos: { ativa: !a.ativa } })}
                             rotuloAlternar={a.ativa ? "Desligar" : "Ligar"}
                             onExcluir={() => acao({ acao: "excluir_area", id: a.id })} />
            ))}
            <NovoItem placeholder="Nova área (Chapa, Bar, Sobremesa)" onCriar={(nome) => acao({ acao: "area", nome })} />
          </Bloco>

          <Bloco titulo="Telas da cozinha e do garçom"
                 texto="Abra o link UMA vez no tablet. Ele casa com o aparelho e o link morre na hora: dali em diante quem entra é o tablet, não o endereço. Ninguém precisa de login, e a chave não fica escrita na tela.">
            {dispositivos.map((d) => (
              <div key={d.id} style={{ padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
                <LinhaEditavel
                  nome={d.nome}
                  info={`${d.tipo === "garcom" ? "garçom" : "cozinha"}${d.area_nome ? ` · ${d.area_nome}` : ""}${d.ultimo_uso ? " · em uso" : " · nunca abriu"}`}
                  onRenomear={(nome) => acao({ acao: "atualizar_dispositivo", id: d.id, campos: { nome } })}
                  onAlternar={() => acao({ acao: "atualizar_dispositivo", id: d.id, campos: { ativo: !d.ativo } })}
                  rotuloAlternar={d.ativo ? "Desligar" : "Ligar"}
                  onExcluir={() => acao({ acao: "excluir_dispositivo", id: d.id })}
                />
                {d.pareado_em ? (
                  <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
                    Aparelho pareado{d.pareado_ip ? ` (${d.pareado_ip})` : ""}. O link não abre mais em
                    outro tablet. Para trocar de aparelho, despareie e gere um link novo.
                  </div>
                ) : (
                  <div className="row" style={{ gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                    <code style={{ fontSize: 12, color: "var(--gold-l)", maxWidth: 420, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {base}/{d.tipo === "garcom" ? "g" : "k"}/{d.token}
                    </code>
                    <button className="btn btn-ghost btn-sm"
                            onClick={() => { navigator.clipboard.writeText(`${base}/${d.tipo === "garcom" ? "g" : "k"}/${d.token}`); avisar("Link copiado"); }}>
                      <IcoCopiar width={14} height={14} /> Copiar
                    </button>
                    <span className="muted" style={{ fontSize: 12.5 }}>
                      {d.parear_ate && new Date(d.parear_ate) > new Date()
                        ? "vale até o primeiro tablet abrir"
                        : "janela fechada: clique em Parear aparelho"}
                    </span>
                  </div>
                )}

                <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <button className="btn btn-ghost btn-sm"
                          onClick={async () => {
                            const r = await acao({ acao: "parear_dispositivo", id: d.id, horas: 48 });
                            if (r) avisar("Link liberado por 48 horas. Abra no tablet certo.");
                          }}>
                    Parear aparelho
                  </button>
                  {d.pareado_em && (
                    <button className="btn btn-ghost btn-sm"
                            onClick={async () => {
                              if (!confirm("Desparear? O tablet atual para de funcionar na hora. Serve para tablet perdido ou levado embora.")) return;
                              await acao({ acao: "desparear_dispositivo", id: d.id });
                              avisar("Aparelho desapareado");
                            }}>
                      Desparear
                    </button>
                  )}
                  <button className="btn btn-ghost btn-sm"
                          onClick={async () => {
                            if (!confirm("Gerar link novo? O link antigo morre.")) return;
                            await acao({ acao: "regravar_dispositivo", id: d.id });
                            avisar("Link novo gerado");
                          }}>
                    Link novo
                  </button>
                </div>
              </div>
            ))}
            <NovoItem placeholder="Nome do tablet (Cozinha, Bar, Garçom)"
                      tipos={[{ valor: "kds", rotulo: "Tela da cozinha" }, { valor: "garcom", rotulo: "App do garçom" }]}
                      select={areas.map((a) => ({ valor: a.id, rotulo: a.nome }))}
                      onCriar={(nome, areaId, tipo) => acao({ acao: "criar_dispositivo", nome, areaId, tipo })} />
          </Bloco>

          <Bloco titulo="Impressoras de comanda"
                 texto="Impressora Star CloudPRNT ou Epson Server Direct Print: copie a URL abaixo e cole na configuração dela. Não precisa de computador na loja.">
            {impressoras.map((i) => (
              <div key={i.id} style={{ padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
                <LinhaEditavel
                  nome={i.nome}
                  info={`${i.colunas} colunas${i.ultimo_ping ? " · respondendo" : " · nunca falou com o servidor"}`}
                  onRenomear={(nome) => acao({ acao: "atualizar_impressora", id: i.id, campos: { nome } })}
                  onAlternar={() => acao({ acao: "atualizar_impressora", id: i.id, campos: { ativa: !i.ativa } })}
                  rotuloAlternar={i.ativa ? "Desligar" : "Ligar"}
                  onExcluir={() => acao({ acao: "excluir_impressora", id: i.id })}
                />
                <div className="row" style={{ gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                  <code style={{ fontSize: 12, color: "var(--gold-l)", maxWidth: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {base}/api/food/print/{i.chave}
                  </code>
                  <button className="btn btn-ghost btn-sm"
                          onClick={() => { navigator.clipboard.writeText(`${base}/api/food/print/${i.chave}`); avisar("URL copiada"); }}>
                    <IcoCopiar width={14} height={14} /> Copiar URL
                  </button>
                  <select value={i.area_id ?? ""} style={{ maxWidth: 200 }}
                          onChange={(e) => acao({ acao: "atualizar_impressora", id: i.id, campos: { areaId: e.target.value || null } })}>
                    <option value="">Imprime a comanda inteira</option>
                    {areas.map((a) => <option key={a.id} value={a.id}>Só o que é da {a.nome}</option>)}
                  </select>
                </div>
              </div>
            ))}
            <NovoItem placeholder="Nome da impressora"
                      select={areas.map((a) => ({ valor: a.id, rotulo: a.nome }))}
                      onCriar={(nome, areaId) => acao({ acao: "criar_impressora", nome, areaId })} />
          </Bloco>
        </>
      )}

      {/* ================= EQUIPE ================= */}
      {secao === "equipe" && (
        <Bloco titulo="Quem trabalha na casa"
               texto="O garçom entra no tablet com um PIN de 4 dígitos. Sem email e sem senha, porque no meio do salão ninguém digita senha.">
          {equipe.map((e) => (
            <LinhaEquipe key={e.id} membro={e} onAcao={acao} onAviso={avisar} />
          ))}
          {!equipe.length && <p className="muted" style={{ fontSize: 13.5 }}>Nenhuma pessoa cadastrada ainda.</p>}
          <NovoItemComPin onCriar={(nome, papel, pin) => acao({ acao: "criar_equipe", nome, papel, pin })} />
        </Bloco>
      )}

      {/* ================= ENTREGA ================= */}
      {secao === "entrega" && (
        <>
          <Bloco titulo="Canais" texto="O pedido online usa o link /c/{slug}/pedir, que você põe na bio do Instagram.">
            <div className="cols-2">
              <div>
                <Check rotulo="Aceita delivery" v={loja.aceita_delivery} on={(v) => campo("aceita_delivery", v)} />
                <Check rotulo="Aceita retirada no balcão" v={loja.aceita_retirada} on={(v) => campo("aceita_retirada", v)} />
              </div>
              <div>
                <label style={{ marginTop: 0 }}>Pedido mínimo para entregar</label>
                <input type="number" step="0.5" value={String(loja.entrega_pedido_minimo)}
                       onChange={(e) => campo("entrega_pedido_minimo", e.target.value)} />
              </div>
            </div>
          </Bloco>

          <Bloco titulo="Bairros e taxa"
                 texto="A taxa que o cliente paga vem daqui, não do chute do atendente. Bairro que não está na lista não consegue pedir.">
            {bairros.map((b) => (
              <LinhaBairro key={b.id} bairro={b} onAcao={acao} onAviso={avisar} />
            ))}
            {!bairros.length && (
              <p className="muted" style={{ fontSize: 13.5 }}>
                Nenhum bairro cadastrado. Sem isso o delivery não aceita pedido.
              </p>
            )}
            <NovoBairro onCriar={(nome, taxa, tempo) => acao({ acao: "bairro", nome, taxa, tempo_min: tempo })} />
          </Bloco>
        </>
      )}

      {/* ================= PAGAMENTO ================= */}
      {secao === "pagamento" && (
        <Bloco titulo="Pagar pelo celular"
               texto="Com isto ligado, o cliente paga a conta no Pix pelo próprio celular e a mesa fecha sozinha. O dinheiro cai na conta do restaurante, não na nossa.">
          <div className="cols-2">
            <div>
              <Check rotulo="Deixar o cliente pagar pelo celular" v={loja.pagar_no_app}
                     on={(v) => campo("pagar_no_app", v)} />
              <label>Provedor do Pix</label>
              <select value={loja.pix_provedor ?? ""} onChange={(e) => campo("pix_provedor", e.target.value || null)}>
                <option value="">Sem provedor (o caixa confirma na mão)</option>
                <option value="mercadopago">Mercado Pago</option>
              </select>
              <label>Chave Pix (só para exibir)</label>
              <input value={loja.pix_chave ?? ""} onChange={(e) => campo("pix_chave", e.target.value)} />
            </div>
            <div>
              <label style={{ marginTop: 0 }}>Credencial do provedor</label>
              <div className="row">
                <input value={psp} onChange={(e) => setPsp(e.target.value)} type="password"
                       placeholder="access token do Mercado Pago" />
                <button className="btn btn-sm"
                        onClick={async () => { await acao({ acao: "psp_credencial", token: psp }); setPsp(""); avisar("Credencial guardada"); }}>
                  Guardar
                </button>
              </div>
              <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                A credencial é guardada cifrada e nunca mais aparece na tela. Se precisar trocar, é só colar outra.
              </p>
              <div className="glass-soft" style={{ padding: 12, borderRadius: 12, marginTop: 12 }}>
                <b style={{ fontSize: 13.5 }}>Webhook para colar no Mercado Pago</b>
                <code style={{ display: "block", fontSize: 12, color: "var(--gold-l)", marginTop: 6, wordBreak: "break-all" }}>
                  {base}/api/food/webhook/mercadopago
                </code>
              </div>
            </div>
          </div>
        </Bloco>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
function Bloco({ titulo, texto, children }: { titulo: string; texto?: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 17 }}>{titulo}</h2>
      {texto && <p className="muted" style={{ margin: "0 0 16px", fontSize: 13.5, maxWidth: 760 }}>{texto}</p>}
      {children}
    </div>
  );
}

function Check({ rotulo, v, on, ajuda }: { rotulo: string; v: boolean; on: (v: boolean) => void; ajuda?: string }) {
  return (
    <div style={{ margin: "12px 0" }}>
      <label style={{ margin: 0, display: "flex", alignItems: "center", gap: 9, color: "var(--text)", fontSize: 14 }}>
        <input type="checkbox" checked={!!v} onChange={(e) => on(e.target.checked)} style={{ width: 17 }} />
        {rotulo}
      </label>
      {ajuda && <p className="muted" style={{ fontSize: 12, margin: "4px 0 0 26px" }}>{ajuda}</p>}
    </div>
  );
}

function Horarios({
  horarios, onSalvar,
}: {
  horarios: Horario[];
  onSalvar: (faixas: { dia_semana: number; abre: string; fecha: string }[]) => Promise<void>;
}) {
  const [linhas, setLinhas] = useState<{ dia_semana: number; abre: string; fecha: string }[]>([]);
  useEffect(() => {
    setLinhas(DIAS.map((_, dia) => {
      const h = horarios.find((x) => x.dia_semana === dia);
      return { dia_semana: dia, abre: h?.abre?.slice(0, 5) ?? "", fecha: h?.fecha?.slice(0, 5) ?? "" };
    }));
  }, [horarios]);

  return (
    <div>
      {linhas.map((l, i) => (
        <div key={l.dia_semana} className="row" style={{ gap: 10, padding: "5px 0" }}>
          <span style={{ width: 92, fontSize: 14 }}>{DIAS[l.dia_semana]}</span>
          <input type="time" value={l.abre} style={{ maxWidth: 130 }}
                 onChange={(e) => setLinhas((s) => s.map((x, k) => (k === i ? { ...x, abre: e.target.value } : x)))} />
          <span className="muted">até</span>
          <input type="time" value={l.fecha} style={{ maxWidth: 130 }}
                 onChange={(e) => setLinhas((s) => s.map((x, k) => (k === i ? { ...x, fecha: e.target.value } : x)))} />
          {!l.abre && !l.fecha && <span className="muted" style={{ fontSize: 12.5 }}>fechado</span>}
        </div>
      ))}
      <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }}
              onClick={() => onSalvar(linhas.filter((l) => l.abre && l.fecha))}>
        Salvar horário
      </button>
    </div>
  );
}

function LinhaEditavel({
  nome, info, onRenomear, onAlternar, rotuloAlternar, onExcluir,
}: {
  nome: string; info?: string;
  onRenomear: (nome: string) => void;
  onAlternar?: () => void;
  rotuloAlternar?: string;
  onExcluir?: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(nome);
  useEffect(() => setValor(nome), [nome]);

  return (
    <div className="row" style={{ gap: 10, flexWrap: "wrap", padding: "6px 0" }}>
      {editando ? (
        <>
          <input value={valor} autoFocus onChange={(e) => setValor(e.target.value)} style={{ maxWidth: 260 }}
                 onKeyDown={(e) => { if (e.key === "Enter") { onRenomear(valor); setEditando(false); } }} />
          <button className="btn btn-sm" onClick={() => { onRenomear(valor); setEditando(false); }}>Salvar</button>
          <button className="btn btn-ghost btn-sm" onClick={() => { setValor(nome); setEditando(false); }}>Cancelar</button>
        </>
      ) : (
        <>
          <b style={{ minWidth: 150 }}>{nome}</b>
          {info && <span className="muted" style={{ fontSize: 12.5 }}>{info}</span>}
          <span className="row" style={{ gap: 6, marginLeft: "auto" }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditando(true)}>Renomear</button>
            {onAlternar && <button className="btn btn-ghost btn-sm" onClick={onAlternar}>{rotuloAlternar}</button>}
            {onExcluir && (
              <button className="btn btn-ghost btn-sm" onClick={() => { if (confirm(`Remover ${nome}?`)) onExcluir(); }}>
                <IcoTrash width={14} height={14} />
              </button>
            )}
          </span>
        </>
      )}
    </div>
  );
}

function LinhaEquipe({
  membro, onAcao, onAviso,
}: {
  membro: Equipe;
  onAcao: (p: Record<string, unknown>) => Promise<Record<string, unknown>>;
  onAviso: (t: string) => void;
}) {
  const [pin, setPin] = useState("");
  return (
    <div style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
      <LinhaEditavel
        nome={membro.nome}
        info={membro.ativo ? "" : "inativo"}
        onRenomear={(nome) => onAcao({ acao: "atualizar_equipe", id: membro.id, campos: { nome } })}
        onAlternar={() => onAcao({ acao: "atualizar_equipe", id: membro.id, campos: { ativo: !membro.ativo } })}
        rotuloAlternar={membro.ativo ? "Desligar" : "Ligar"}
        onExcluir={() => onAcao({ acao: "excluir_equipe", id: membro.id })}
      />
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <select value={membro.papel} style={{ maxWidth: 170 }}
                onChange={(e) => onAcao({ acao: "atualizar_equipe", id: membro.id, campos: { papel: e.target.value } })}>
          {["garcom", "cozinha", "caixa", "gerente", "entregador"].map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <input value={pin} placeholder="novo PIN" style={{ maxWidth: 130 }}
               onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} />
        <button className="btn btn-ghost btn-sm"
                onClick={async () => {
                  if (pin.length !== 4) return;
                  await onAcao({ acao: "atualizar_equipe", id: membro.id, campos: { pin } });
                  setPin(""); onAviso("PIN trocado");
                }}>
          Trocar PIN
        </button>
      </div>
    </div>
  );
}

function LinhaBairro({
  bairro, onAcao, onAviso,
}: {
  bairro: Bairro;
  onAcao: (p: Record<string, unknown>) => Promise<Record<string, unknown>>;
  onAviso: (t: string) => void;
}) {
  const [taxa, setTaxa] = useState(String(Number(bairro.taxa)));
  const [tempo, setTempo] = useState(String(bairro.tempo_min));
  return (
    <div className="row" style={{ gap: 10, flexWrap: "wrap", padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
      <b style={{ minWidth: 150 }}>{bairro.nome}</b>
      <span className="muted" style={{ fontSize: 12.5 }}>taxa</span>
      <input type="number" step="0.5" value={taxa} onChange={(e) => setTaxa(e.target.value)} style={{ maxWidth: 110 }} />
      <span className="muted" style={{ fontSize: 12.5 }}>minutos</span>
      <input type="number" value={tempo} onChange={(e) => setTempo(e.target.value)} style={{ maxWidth: 100 }} />
      <span className="row" style={{ gap: 6, marginLeft: "auto" }}>
        <button className="btn btn-ghost btn-sm"
                onClick={async () => {
                  await onAcao({ acao: "bairro", id: bairro.id, nome: bairro.nome, taxa: Number(taxa), tempo_min: Number(tempo) });
                  onAviso("Bairro salvo");
                }}>
          Salvar
        </button>
        <button className="btn btn-ghost btn-sm"
                onClick={() => { if (confirm(`Remover ${bairro.nome}?`)) onAcao({ acao: "excluir_bairro", id: bairro.id }); }}>
          <IcoTrash width={14} height={14} />
        </button>
      </span>
    </div>
  );
}

function NovoBairro({ onCriar }: { onCriar: (nome: string, taxa: number, tempo: number) => void }) {
  const [nome, setNome] = useState("");
  const [taxa, setTaxa] = useState("");
  const [tempo, setTempo] = useState("40");
  return (
    <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: "wrap" }}>
      <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Bairro" style={{ maxWidth: 220 }} />
      <input value={taxa} onChange={(e) => setTaxa(e.target.value)} type="number" step="0.5" placeholder="taxa" style={{ maxWidth: 110 }} />
      <input value={tempo} onChange={(e) => setTempo(e.target.value)} type="number" placeholder="min" style={{ maxWidth: 100 }} />
      <button className="btn btn-sm"
              onClick={() => { if (nome.trim()) { onCriar(nome.trim(), Number(taxa || 0), Number(tempo || 40)); setNome(""); setTaxa(""); } }}>
        <IcoPlus width={15} height={15} /> Adicionar
      </button>
    </div>
  );
}

function NovoItem({
  placeholder, select, tipos, onCriar,
}: {
  placeholder: string;
  select?: { valor: string; rotulo: string }[];
  tipos?: { valor: string; rotulo: string }[];
  onCriar: (nome: string, areaId?: string | null, tipo?: string) => void;
}) {
  const [nome, setNome] = useState("");
  const [area, setArea] = useState("");
  const [tipo, setTipo] = useState(tipos?.[0]?.valor ?? "");
  return (
    <div className="row" style={{ gap: 8, marginTop: 14, flexWrap: "wrap" }}>
      <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder={placeholder} style={{ maxWidth: 260 }} />
      {tipos && (
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={{ maxWidth: 190 }}>
          {tipos.map((t) => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
        </select>
      )}
      {select && (
        <select value={area} onChange={(e) => setArea(e.target.value)} style={{ maxWidth: 190 }}>
          <option value="">Sem área</option>
          {select.map((s) => <option key={s.valor} value={s.valor}>{s.rotulo}</option>)}
        </select>
      )}
      <button className="btn btn-sm" onClick={() => { if (nome.trim()) { onCriar(nome.trim(), area || null, tipo); setNome(""); } }}>
        <IcoPlus width={15} height={15} /> Criar
      </button>
    </div>
  );
}

function NovoItemComPin({ onCriar }: { onCriar: (nome: string, papel: string, pin: string) => void }) {
  const [nome, setNome] = useState("");
  const [papel, setPapel] = useState("garcom");
  const [pin, setPin] = useState("");
  return (
    <div className="row" style={{ gap: 8, marginTop: 14, flexWrap: "wrap" }}>
      <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" style={{ maxWidth: 220 }} />
      <select value={papel} onChange={(e) => setPapel(e.target.value)} style={{ maxWidth: 170 }}>
        {["garcom", "cozinha", "caixa", "gerente", "entregador"].map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      <input value={pin} placeholder="PIN de 4 dígitos" style={{ maxWidth: 160 }}
             onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} />
      <button className="btn btn-sm"
              onClick={() => { if (nome.trim() && pin.length === 4) { onCriar(nome.trim(), papel, pin); setNome(""); setPin(""); } }}>
        <IcoCheck width={15} height={15} /> Criar
      </button>
    </div>
  );
}
