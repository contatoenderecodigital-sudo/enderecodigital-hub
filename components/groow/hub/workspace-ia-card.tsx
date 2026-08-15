"use client";

// Card de IA de UM workspace/cliente na tela Tokens & IA.
// - dropdown de PROVEDOR + dropdown de MODELO (filtrado pelo provedor)
// - slider + input de LIMITE de tokens
// - apelido/ref da chave própria do cliente (nunca o token cru)
// - botões: Salvar tudo · Aplicar modelo agora · Travar/Destravar
// - mostra consumo real (uso_ia) e estimativa de custo em R$
import { useMemo, useState } from "react";
import { Lock, Unlock, Zap, Save, KeyRound } from "lucide-react";
import {
  MODELOS_IA,
  PROVEDORES,
  COR_PROVEDOR,
  estimarCustoCentBRL,
  type ProvedorIA,
} from "@/lib/precos-ia";
import {
  salvarWorkspaceIaAction,
  trocarModeloAction,
  travarWorkspaceAction,
} from "@/app/operacao/hub/actions";

interface Props {
  id: string;
  nome: string;
  provedor: ProvedorIA;
  modelo: string;
  limiteTokens: number;
  travado: boolean;
  chaveRef: string | null;
  tokensIn: number;
  tokensOut: number;
  interacoes: number;
  custoCentReal: number;
}

const iStyle: React.CSSProperties = { display: "block", width: "100%", borderRadius: 12, border: "1px solid var(--ed2-hair)", background: "var(--ed2-surface-2)", padding: "9px 11px", fontSize: 13.5, boxSizing: "border-box", color: "var(--ed2-ink)" };
const lStyle: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 600, color: "var(--ed2-ink-2)", marginBottom: 5, letterSpacing: "0.02em" };
const goldBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, background: "#C9A961", color: "#fff", border: "none", padding: "9px 15px", borderRadius: 999, fontWeight: 600, fontSize: 12.5, cursor: "pointer", boxShadow: "0 4px 12px rgba(201,169,97,0.28)" };
const ghostBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, background: "var(--ed2-surface)", color: "var(--ed2-ink)", border: "1px solid var(--ed2-hair)", padding: "8px 13px", borderRadius: 999, fontWeight: 600, fontSize: 12, cursor: "pointer" };

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}
function brl(cent: number) {
  return "R$ " + (cent / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const LIMITES = [0, 100_000, 250_000, 500_000, 1_000_000, 2_000_000, 5_000_000];

export default function WorkspaceIaCard(p: Props) {
  const [provedor, setProvedor] = useState<ProvedorIA>(p.provedor);
  const [modelo, setModelo] = useState<string>(p.modelo);
  const [limite, setLimite] = useState<number>(p.limiteTokens);
  const [chaveRef, setChaveRef] = useState<string>(p.chaveRef || "");

  const modelosDoProvedor = useMemo(() => MODELOS_IA.filter((m) => m.provedor === provedor), [provedor]);

  function onProvedor(v: ProvedorIA) {
    setProvedor(v);
    const lista = MODELOS_IA.filter((m) => m.provedor === v);
    if (!lista.some((m) => m.id === modelo)) setModelo(lista[0]?.id || "");
  }

  const totalTokens = p.tokensIn + p.tokensOut;
  const cor = COR_PROVEDOR[provedor];
  // estimativa pelo modelo ATUALMENTE selecionado (planejamento)
  const custoEstim = estimarCustoCentBRL(modelo, p.tokensIn, p.tokensOut);
  const pctLimite = limite > 0 ? Math.min(100, Math.round((totalTokens / limite) * 100)) : 0;

  const dirtyModelo = provedor !== p.provedor || modelo !== p.modelo;

  return (
    <div style={{ background: "var(--ed2-card)", borderRadius: 24, padding: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", border: p.travado ? "1px solid rgba(201,169,97,0.5)" : "1px solid transparent" }}>
      {/* cabeçalho */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span aria-hidden style={{ width: 10, height: 10, borderRadius: 99, background: cor, flexShrink: 0 }} />
          <strong style={{ color: "var(--ed2-ink)", fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.nome}</strong>
        </div>
        {p.travado ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 999, fontSize: 10.5, fontWeight: 700, background: "rgba(201,169,97,0.16)", color: "#8a712d" }}>
            <Lock size={11} /> TRAVADO
          </span>
        ) : null}
      </div>

      {/* consumo real */}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <div style={{ flex: 1, background: "var(--ed2-surface-2)", borderRadius: 12, padding: "9px 11px" }}>
          <div style={{ color: "var(--ed2-ink-2)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Entrada</div>
          <div style={{ fontWeight: 700, fontSize: 15, marginTop: 2, color: "var(--ed2-ink)", fontVariantNumeric: "tabular-nums" }}>{fmt(p.tokensIn)}</div>
        </div>
        <div style={{ flex: 1, background: "var(--ed2-surface-2)", borderRadius: 12, padding: "9px 11px" }}>
          <div style={{ color: "var(--ed2-ink-2)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Saída</div>
          <div style={{ fontWeight: 700, fontSize: 15, marginTop: 2, color: "var(--ed2-ink)", fontVariantNumeric: "tabular-nums" }}>{fmt(p.tokensOut)}</div>
        </div>
        <div style={{ flex: 1, background: "var(--ed2-surface-2)", borderRadius: 12, padding: "9px 11px" }}>
          <div style={{ color: "var(--ed2-ink-2)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Conversas</div>
          <div style={{ fontWeight: 700, fontSize: 15, marginTop: 2, color: "var(--ed2-ink)", fontVariantNumeric: "tabular-nums" }}>{p.interacoes}</div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 9, fontSize: 12, color: "var(--ed2-ink-2)" }}>
        <span>{fmt(totalTokens)} tokens no total</span>
        <span>
          {p.custoCentReal > 0 ? <><strong style={{ color: "var(--ed2-ink)" }}>{brl(p.custoCentReal)}</strong> real</> : <>~<strong style={{ color: "var(--ed2-ink)" }}>{brl(custoEstim)}</strong> estimado</>}
        </span>
      </div>

      {/* barra de uso vs limite */}
      {limite > 0 ? (
        <div style={{ marginTop: 10 }}>
          <div style={{ height: 7, borderRadius: 99, background: "var(--ed2-surface)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pctLimite}%`, background: pctLimite >= 90 ? "#FF3B30" : pctLimite >= 70 ? "#FF9F0A" : cor, transition: "width .2s" }} />
          </div>
          <div style={{ fontSize: 11, color: "var(--ed2-ink-2)", marginTop: 4 }}>{fmt(totalTokens)} / {fmt(limite)} tokens ({pctLimite}%)</div>
        </div>
      ) : null}

      {/* ------- form principal ------- */}
      <form action={salvarWorkspaceIaAction} style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <input type="hidden" name="negocio_id" value={p.id} />
        <input type="hidden" name="travado" value={p.travado ? "on" : ""} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={lStyle}>Provedor</label>
            <select name="provedor" value={provedor} onChange={(e) => onProvedor(e.target.value as ProvedorIA)} style={{ ...iStyle, appearance: "auto" }}>
              {PROVEDORES.map((pv) => (
                <option key={pv.id} value={pv.id}>{pv.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={lStyle}>Modelo</label>
            <select name="modelo" value={modelo} onChange={(e) => setModelo(e.target.value)} style={{ ...iStyle, appearance: "auto" }}>
              {modelosDoProvedor.map((m) => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label style={lStyle}>Limite de tokens (0 = ilimitado)</label>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="range"
              min={0}
              max={LIMITES.length - 1}
              step={1}
              value={Math.max(0, LIMITES.indexOf(LIMITES.reduce((a, b) => (Math.abs(b - limite) < Math.abs(a - limite) ? b : a), LIMITES[0])))}
              onChange={(e) => setLimite(LIMITES[Number(e.target.value)])}
              style={{ flex: 1, accentColor: "#C9A961" }}
              aria-label="Limite de tokens"
            />
            <input
              name="limite_tokens"
              value={limite}
              onChange={(e) => setLimite(Math.max(0, parseInt(e.target.value.replace(/[^\d]/g, "") || "0", 10)))}
              inputMode="numeric"
              style={{ ...iStyle, width: 120, textAlign: "right", fontVariantNumeric: "tabular-nums" }}
            />
          </div>
          <div style={{ fontSize: 11, color: "var(--ed2-ink-2)", marginTop: 4 }}>{limite === 0 ? "Ilimitado" : `${fmt(limite)} tokens/período`}</div>
        </div>

        <div>
          <label style={lStyle}><KeyRound size={11} style={{ verticalAlign: "-1px", marginRight: 4 }} />Chave própria do cliente (apelido/ref — nunca o token)</label>
          <input name="chave_ref" value={chaveRef} onChange={(e) => setChaveRef(e.target.value)} placeholder="ex.: chave-openai-cliente-x (referência)" style={iStyle} />
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button type="submit" style={goldBtn}><Save size={14} /> Salvar</button>
          {dirtyModelo ? (
            <button type="submit" formAction={trocarModeloAction} style={{ ...ghostBtn, borderColor: "rgba(201,169,97,0.5)", color: "#8a712d" }} title="Aplica só o provedor+modelo na hora, sem mexer no limite">
              <Zap size={13} /> Aplicar modelo agora
            </button>
          ) : null}
          <button type="submit" formAction={travarWorkspaceAction} style={{ ...ghostBtn, marginLeft: "auto" }}>
            {p.travado ? <><Unlock size={13} /> Destravar</> : <><Lock size={13} /> Travar teto</>}
          </button>
        </div>
      </form>
    </div>
  );
}
