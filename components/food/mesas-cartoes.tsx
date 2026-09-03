"use client";

import { useCallback, useEffect, useState } from "react";
import { IcoPlus, IcoTrash, IcoX } from "@/components/icons";
import { IcoCheck, IcoCopiar, IcoMesa, IcoNfc } from "./icones";

// ============================================================================
// Mesas e cartões. Aqui nasce a peça física do produto: cada mesa tem um
// endereço próprio, e é esse endereço que vai gravado no chip do cartão.
// ============================================================================

type Mesa = {
  id: string; numero: string; apelido: string | null; token: string;
  capacidade: number; setor: string | null; cartao_gravado_em: string | null; ativa: boolean;
};

export default function MesasCartoes({ neg, slug }: { neg: string; slug: string }) {
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [base, setBase] = useState("");
  const [de, setDe] = useState(1);
  const [ate, setAte] = useState(10);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [editando, setEditando] = useState<Mesa | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { setBase(window.location.origin); }, []);

  const carregar = useCallback(async () => {
    const r = await fetch(`/api/food/painel?neg=${neg}&vista=mesas`, { cache: "no-store" });
    if (r.ok) setMesas((await r.json()).mesas ?? []);
  }, [neg]);

  useEffect(() => { carregar(); }, [carregar]);

  async function acao(payload: Record<string, unknown>) {
    const r = await fetch("/api/food/painel", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ neg, ...payload }),
    });
    const d = await r.json().catch(() => ({}));
    await carregar();
    return d as Record<string, unknown>;
  }

  function avisar(t: string) { setMsg(t); setTimeout(() => setMsg(null), 2800); }

  const url = (m: Mesa) => `${base}/c/${slug}/m/${m.token}`;
  const gravados = mesas.filter((m) => m.cartao_gravado_em).length;

  async function copiar(m: Mesa) {
    await navigator.clipboard.writeText(url(m));
    setCopiado(m.id);
    setTimeout(() => setCopiado(null), 1500);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Restaurante</span>
          <h1>Mesas e cartões</h1>
          <p className="muted">
            Cada mesa tem um endereço só dela. É esse endereço que vai gravado no cartão de aproximação.
          </p>
        </div>
        {msg && <span className="badge ok">{msg}</span>}
      </div>

      {/* ---------- como gravar ---------- */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ marginBottom: 14 }}>
          <span className="icon-box"><IcoNfc /></span>
          <div>
            <b style={{ fontSize: 15.5 }}>Como transformar isso num cartão</b>
            <div className="muted" style={{ fontSize: 13 }}>
              {gravados} de {mesas.length} mesas com cartão gravado
            </div>
          </div>
        </div>
        <div className="cols-4">
          {[
            ["1", "Compre os cartões", "Cartão PVC com chip NTAG213 e a arte do restaurante impressa."],
            ["2", "Copie o link da mesa", "O botão Copiar de cada linha aqui embaixo."],
            ["3", "Grave no chip", "No app NFC Tools, escolha Gravar, tipo URL, e cole o link. Depois trave o cartão."],
            ["4", "Teste no celular", "Encoste o celular. Tem que abrir o cardápio já na mesa certa."],
          ].map(([n, t, d]) => (
            <div key={n} className="glass-soft" style={{ padding: 14, borderRadius: 14 }}>
              <span className="icon-box sm">{n}</span>
              <b style={{ display: "block", marginTop: 10, fontSize: 14 }}>{t}</b>
              <p className="muted" style={{ fontSize: 12.5, margin: "4px 0 0" }}>{d}</p>
            </div>
          ))}
        </div>
        <p className="muted" style={{ fontSize: 12.5, marginBottom: 0, marginTop: 12 }}>
          Imprima o mesmo endereço como QR no verso do cartão: iPhone antigo e Android com NFC
          desligado não leem o chip, mas leem o QR.
        </p>
      </div>

      {/* ---------- criar ---------- */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ flexWrap: "wrap", gap: 10 }}>
          <span className="icon-box sm"><IcoPlus width={17} height={17} /></span>
          <b>Criar mesas em lote</b>
          <span className="muted" style={{ fontSize: 13 }}>da</span>
          <input type="number" value={de} onChange={(e) => setDe(Number(e.target.value))} style={{ width: 80 }} />
          <span className="muted" style={{ fontSize: 13 }}>até a</span>
          <input type="number" value={ate} onChange={(e) => setAte(Number(e.target.value))} style={{ width: 80 }} />
          <button className="btn btn-sm"
                  onClick={async () => {
                    const r = await acao({ acao: "criar_mesas", de, ate });
                    avisar(`${r?.criadas ?? 0} mesa(s) criada(s)`);
                  }}>
            Criar
          </button>
          {mesas.length > 0 && (
            <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }}
                    onClick={async () => {
                      await navigator.clipboard.writeText(mesas.map((m) => `Mesa ${m.numero}\t${url(m)}`).join("\n"));
                      avisar("Lista copiada. Cole numa planilha para gravar em lote.");
                    }}>
              <IcoCopiar width={15} height={15} /> Copiar todos os links
            </button>
          )}
        </div>
      </div>

      {/* ---------- lista ---------- */}
      <div className="card">
        {mesas.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <span className="icon-box" style={{ margin: "0 auto 12px" }}><IcoMesa /></span>
            <b style={{ fontSize: 15.5 }}>Nenhuma mesa ainda</b>
            <p className="muted" style={{ fontSize: 13.5, maxWidth: 420, margin: "6px auto 0" }}>
              Crie as mesas aí em cima. Se o salão tem 12 mesas, crie da 1 até a 12.
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Mesa</th>
                  <th>Link do cartão</th>
                  <th>Cartão</th>
                  <th style={{ textAlign: "right" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {mesas.map((m) => (
                  <tr key={m.id} style={{ opacity: m.ativa ? 1 : 0.45 }}>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <b>{m.numero}</b>
                      {m.apelido && <span className="muted"> · {m.apelido}</span>}
                      <span className="muted" style={{ display: "block", fontSize: 12 }}>
                        {m.capacidade} lugares{m.setor ? ` · ${m.setor}` : ""}{!m.ativa && " · desativada"}
                      </span>
                    </td>
                    <td style={{ maxWidth: 340 }}>
                      <code style={{ fontSize: 12, color: "var(--gold-l)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {url(m)}
                      </code>
                    </td>
                    <td>
                      {m.cartao_gravado_em
                        ? <span className="badge ok"><IcoCheck width={12} height={12} /> gravado</span>
                        : <span className="badge">sem cartão</span>}
                    </td>
                    <td>
                      <span className="row" style={{ justifyContent: "flex-end", gap: 6, flexWrap: "wrap" }}>
                        <button className="btn btn-sm" onClick={() => copiar(m)}>
                          {copiado === m.id ? <><IcoCheck width={14} height={14} /> Copiado</> : <><IcoCopiar width={14} height={14} /> Copiar</>}
                        </button>
                        {!m.cartao_gravado_em && (
                          <button className="btn btn-ghost btn-sm" onClick={() => acao({ acao: "cartao_gravado", mesaId: m.id })}>
                            Marcar gravado
                          </button>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditando(m)}>Editar</button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editando && (
        <div className="modal-overlay" onClick={() => setEditando(null)}>
          <div className="modal-panel" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <span className="icon-box"><IcoMesa /></span>
              <div>
                <h2>Mesa {editando.numero}</h2>
                <p>O número é o que aparece para a cozinha e para o garçom</p>
              </div>
              <button className="modal-close" onClick={() => setEditando(null)}><IcoX width={17} height={17} /></button>
            </div>
            <div className="modal-body">
              <div>
                <label style={{ marginTop: 0 }}>Número ou nome</label>
                <input value={editando.numero} onChange={(e) => setEditando({ ...editando, numero: e.target.value })} />
                <label>Apelido</label>
                <input value={editando.apelido ?? ""} placeholder="Varanda, Sinuca, Balcão"
                       onChange={(e) => setEditando({ ...editando, apelido: e.target.value })} />
                <label>Lugares</label>
                <input type="number" value={editando.capacidade}
                       onChange={(e) => setEditando({ ...editando, capacidade: Number(e.target.value) })} />
                <label>Setor do salão</label>
                <input value={editando.setor ?? ""} placeholder="Salão, varanda, mezanino"
                       onChange={(e) => setEditando({ ...editando, setor: e.target.value })} />
              </div>

              <div className="glass-soft" style={{ padding: 14, borderRadius: 14 }}>
                <b style={{ fontSize: 14 }}>Cartão perdido ou copiado?</b>
                <p className="muted" style={{ fontSize: 12.5, margin: "4px 0 10px" }}>
                  Gerar um link novo mata o cartão antigo na hora. Depois é só regravar um cartão em branco.
                </p>
                <button className="btn btn-ghost btn-sm"
                        onClick={async () => {
                          if (!confirm(`Gerar link novo da mesa ${editando.numero}?`)) return;
                          await acao({ acao: "regravar_mesa", mesaId: editando.id });
                          setEditando(null);
                          avisar("Link novo gerado. Regrave o cartão desta mesa.");
                        }}>
                  Gerar link novo
                </button>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" style={{ marginRight: "auto" }}
                      onClick={async () => {
                        if (!confirm(`Apagar a mesa ${editando.numero}?`)) return;
                        const r = await acao({ acao: "excluir_mesa", mesaId: editando.id });
                        setEditando(null);
                        avisar(r?.resultado === "desativada"
                          ? "A mesa já teve comanda, então foi desativada em vez de apagada"
                          : "Mesa apagada");
                      }}>
                <IcoTrash width={15} height={15} /> Apagar
              </button>
              <button className="btn btn-ghost"
                      onClick={() => acao({ acao: "atualizar_mesa", mesaId: editando.id, campos: { ativa: !editando.ativa } }).then(() => setEditando(null))}>
                {editando.ativa ? "Desativar" : "Ativar"}
              </button>
              <button className="btn"
                      onClick={async () => {
                        await acao({
                          acao: "atualizar_mesa", mesaId: editando.id,
                          campos: {
                            numero: editando.numero, apelido: editando.apelido || null,
                            capacidade: editando.capacidade, setor: editando.setor || null,
                          },
                        });
                        setEditando(null);
                        avisar("Mesa salva");
                      }}>
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
