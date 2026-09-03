"use client";

import { useCallback, useEffect, useState } from "react";
import { IcoCaixa, IcoImpressora, IcoRelogio } from "./icones";

// ============================================================================
// Caixa: abre com o troco, mostra o que entrou por forma de pagamento e fecha
// dizendo quanto deveria ter na gaveta. É a tela do fim da noite.
// ============================================================================

type Caixa = {
  id: string; saldo_inicial: string; aberto_em: string;
  dinheiro: string; cartao: string; pix: string; total: string;
} | null;
type Pagamento = {
  id: string; metodo: string; valor: string; gorjeta: string;
  status: string; criado_em: string; mesa_numero: string | null;
};
type Pedido = {
  id: string; numero_dia: number; canal: string; status: string; total: string;
  mesa_numero: string | null; criado_em: string;
};

const money = (v: number | string) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const hora = (d: string) => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

const METODO: Record<string, string> = {
  dinheiro: "Dinheiro", debito: "Débito", credito: "Crédito",
  pix: "Pix", pix_app: "Pix no celular", vale: "Vale", online: "Online", cortesia: "Cortesia",
};

export default function CaixaFood({ neg }: { neg: string }) {
  const [caixa, setCaixa] = useState<Caixa>(null);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [dia, setDia] = useState<{ totais: { pedidos: string; faturamento: string; ticket: string } } | null>(null);
  const [saldo, setSaldo] = useState("0");
  const [msg, setMsg] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const [a, b] = await Promise.all([
      fetch(`/api/food/painel?neg=${neg}&vista=caixa`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/food/painel?neg=${neg}&vista=pedidos`, { cache: "no-store" }).then((r) => r.json()),
    ]);
    setCaixa(a.caixa ?? null); setPagamentos(a.pagamentos ?? []); setDia(a.dia ?? null);
    setPedidos(b.pedidos ?? []);
  }, [neg]);

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 15000);
    return () => clearInterval(t);
  }, [carregar]);

  async function acao(payload: Record<string, unknown>) {
    await fetch("/api/food/painel", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ neg, ...payload }),
    });
    carregar();
  }

  function avisar(t: string) { setMsg(t); setTimeout(() => setMsg(null), 2500); }

  const esperado = caixa ? Number(caixa.saldo_inicial) + Number(caixa.dinheiro) : 0;

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Restaurante</span>
          <h1>Caixa</h1>
          <p className="muted">
            Abra no começo do turno com o troco e feche no fim conferindo a gaveta.
          </p>
        </div>
        {msg && <span className="badge ok">{msg}</span>}
      </div>

      {!caixa ? (
        <div className="card" style={{ textAlign: "center", padding: "44px 24px", marginBottom: 16 }}>
          <span className="icon-box" style={{ margin: "0 auto 12px" }}><IcoCaixa /></span>
          <h2 style={{ fontSize: 19, margin: "0 0 6px" }}>Nenhum caixa aberto</h2>
          <p className="muted" style={{ fontSize: 13.5, maxWidth: 460, margin: "0 auto 16px" }}>
            Informe quanto tem de troco na gaveta agora. No fim do turno o sistema compara com o que entrou
            em dinheiro e mostra a diferença.
          </p>
          <div className="row" style={{ justifyContent: "center", maxWidth: 340, margin: "0 auto" }}>
            <input value={saldo} onChange={(e) => setSaldo(e.target.value)} type="number" step="0.01" placeholder="troco inicial" />
            <button className="btn" onClick={() => acao({ acao: "abrir_caixa", saldo: Number(saldo) })}>
              Abrir caixa
            </button>
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="spread" style={{ marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
            <div className="row">
              <span className="icon-box"><IcoCaixa /></span>
              <div>
                <b style={{ fontSize: 15.5 }}>Caixa aberto</b>
                <div className="muted" style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 5 }}>
                  <IcoRelogio width={13} height={13} /> desde as {hora(caixa.aberto_em)}
                </div>
              </div>
            </div>
            <div className="row">
              <input value={saldo} onChange={(e) => setSaldo(e.target.value)} type="number" step="0.01"
                     placeholder="contagem final" style={{ maxWidth: 170 }} />
              <button className="btn"
                      onClick={async () => {
                        await acao({ acao: "fechar_caixa", caixaId: caixa.id, saldo: Number(saldo) });
                        avisar("Caixa fechado");
                      }}>
                Fechar caixa
              </button>
            </div>
          </div>

          <div className="cols-5">
            <Kpi rotulo="Troco inicial" valor={money(caixa.saldo_inicial)} />
            <Kpi rotulo="Dinheiro" valor={money(caixa.dinheiro)} />
            <Kpi rotulo="Cartão" valor={money(caixa.cartao)} />
            <Kpi rotulo="Pix" valor={money(caixa.pix)} />
            <Kpi rotulo="Deve ter na gaveta" valor={money(esperado)} destaque />
          </div>
        </div>
      )}

      {dia && (
        <div className="cols-3" style={{ marginBottom: 16 }}>
          <div className="card"><div className="kpi">{dia.totais.pedidos}</div><div className="kpi-label">Pedidos hoje</div></div>
          <div className="card"><div className="kpi">{money(dia.totais.faturamento)}</div><div className="kpi-label">Vendido hoje</div></div>
          <div className="card"><div className="kpi">{money(dia.totais.ticket)}</div><div className="kpi-label">Ticket médio</div></div>
        </div>
      )}

      <div className="cols-2">
        <div className="card">
          <h2 style={{ fontSize: 16, margin: "0 0 12px" }}>Recebimentos de hoje</h2>
          {pagamentos.length ? pagamentos.map((p) => (
            <div key={p.id} className="spread" style={{ padding: "8px 0", borderBottom: "1px solid var(--fd-line)" }}>
              <span>
                <b>{METODO[p.metodo] ?? p.metodo}</b>
                <span className="muted" style={{ fontSize: 12.5, display: "block" }}>
                  {hora(p.criado_em)}{p.mesa_numero ? ` · mesa ${p.mesa_numero}` : ""}
                  {p.status !== "confirmado" ? ` · ${p.status}` : ""}
                </span>
              </span>
              <b>{money(Number(p.valor) + Number(p.gorjeta))}</b>
            </div>
          )) : <p className="muted" style={{ fontSize: 13.5 }}>Nada recebido ainda.</p>}
        </div>

        <div className="card">
          <h2 style={{ fontSize: 16, margin: "0 0 12px" }}>Pedidos de hoje</h2>
          {pedidos.length ? pedidos.slice(0, 20).map((p) => (
            <div key={p.id} className="spread" style={{ padding: "8px 0", borderBottom: "1px solid var(--fd-line)" }}>
              <span>
                <b>#{p.numero_dia}</b>
                <span className="muted" style={{ fontSize: 12.5 }}>
                  {" "}{p.canal === "mesa" ? `mesa ${p.mesa_numero}` : p.canal} · {hora(p.criado_em)}
                </span>
              </span>
              <span className="row" style={{ gap: 8 }}>
                <b>{money(p.total)}</b>
                <button className="btn btn-ghost btn-sm" title="Imprimir de novo"
                        onClick={() => { acao({ acao: "reimprimir", pedidoId: p.id }); avisar("Enviado para a impressora"); }}>
                  <IcoImpressora width={14} height={14} />
                </button>
              </span>
            </div>
          )) : <p className="muted" style={{ fontSize: 13.5 }}>Nenhum pedido hoje.</p>}
        </div>
      </div>
    </>
  );
}

function Kpi({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div>
      <div className="kpi-label" style={{ marginTop: 0 }}>{rotulo}</div>
      <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4, color: destaque ? "var(--fd-primary)" : undefined }}>
        {valor}
      </div>
    </div>
  );
}
