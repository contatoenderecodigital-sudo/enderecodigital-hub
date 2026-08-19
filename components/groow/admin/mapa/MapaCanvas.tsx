"use client";

// Canvas do Mapa do Ecossistema - implementação própria, leve, sem lib externa.
// Editor (arrastar, ligar, renomear, salvar) e visualização pública (readOnly)
// no mesmo componente. Dados = JSON simples {nodes, edges} salvo no MySQL.
import { useEffect, useRef, useState } from "react";
import { Plus, Link2, ZoomIn, ZoomOut, Maximize, Trash2, Save, Loader2, Check, Megaphone, Flag, Wrench, StickyNote } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NoMapa { id: string; x: number; y: number; titulo: string; tipo: "canal" | "etapa" | "ferramenta" | "nota" }
export interface LigacaoMapa { de: string; para: string }
export interface DadosMapa { nodes: NoMapa[]; edges: LigacaoMapa[] }

const TIPOS: Record<NoMapa["tipo"], { label: string; bg: string; fg: string; borda: string; Icone: LucideIcon }> = {
  canal:       { label: "Canal",      bg: "#FBF6E9",            fg: "#8f6d2c",  borda: "rgba(201,169,97,0.65)", Icone: Megaphone },
  etapa:       { label: "Etapa",      bg: "#0B1838",            fg: "#F5F2EA",  borda: "#0B1838",               Icone: Flag },
  ferramenta:  { label: "Ferramenta", bg: "#EDF9F0",            fg: "#166534",  borda: "rgba(52,199,89,0.45)",  Icone: Wrench },
  nota:        { label: "Nota",       bg: "#FFFFFF",            fg: "#6a7080",  borda: "var(--ed2-hair)",       Icone: StickyNote },
};

const NO_W = 172;
const NO_H = 58;

let _seq = 0;
function novoId(): string { return `n${Date.now().toString(36)}${(_seq++).toString(36)}`; }

export default function MapaCanvas({ inicial, readOnly = false, onSalvar }: {
  inicial: DadosMapa;
  readOnly?: boolean;
  onSalvar?: (d: DadosMapa) => Promise<boolean>;
}) {
  const [nodes, setNodes] = useState<NoMapa[]>(inicial.nodes ?? []);
  const [edges, setEdges] = useState<LigacaoMapa[]>(inicial.edges ?? []);
  const [pan, setPan] = useState({ x: 40, y: 30 });
  const [zoom, setZoom] = useState(1);
  const [sel, setSel] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null); // id do card em renomeação inline
  const [ligando, setLigando] = useState(false);
  const [origem, setOrigem] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [salvoOk, setSalvoOk] = useState(false);
  const drag = useRef<{ tipo: "node" | "pan"; id?: string; sx: number; sy: number; ox: number; oy: number; moveu: boolean } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selNode = nodes.find((n) => n.id === sel) ?? null;

  const onDownFundo = (e: React.PointerEvent) => {
    drag.current = { tipo: "pan", sx: e.clientX, sy: e.clientY, ox: pan.x, oy: pan.y, moveu: false };
    setSel(null);
  };

  const onDownNode = (e: React.PointerEvent, n: NoMapa) => {
    e.stopPropagation();
    if (readOnly) return;
    if (editando === n.id) return; // deixa clicar dentro do campo sem arrastar
    if (ligando) {
      if (!origem) { setOrigem(n.id); return; }
      if (origem !== n.id && !edges.some((l) => l.de === origem && l.para === n.id)) {
        setEdges((prev) => [...prev, { de: origem, para: n.id }]);
      }
      setOrigem(null);
      setLigando(false);
      return;
    }
    setSel(n.id);
    drag.current = { tipo: "node", id: n.id, sx: e.clientX, sy: e.clientY, ox: n.x, oy: n.y, moveu: false };
  };

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moveu = true;
    if (d.tipo === "pan") setPan({ x: d.ox + dx, y: d.oy + dy });
    else if (d.id && !readOnly) {
      setNodes((prev) => prev.map((n) => (n.id === d.id ? { ...n, x: d.ox + dx / zoom, y: d.oy + dy / zoom } : n)));
    }
  };

  const onUp = () => { drag.current = null; };

  const resetVista = () => { setZoom(1); setPan({ x: 40, y: 30 }); };

  // Scroll do mouse: Ctrl (ou Cmd) + scroll dá zoom; scroll puro navega o canvas.
  // Listener nativo com passive:false pra conseguir barrar o zoom do navegador.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setZoom((z) => Math.min(2, Math.max(0.35, z * (e.deltaY < 0 ? 1.08 : 0.93))));
      } else {
        setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
      }
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  // Atalhos de teclado do editor: Delete/Backspace exclui o card selecionado,
  // Ctrl +/- dá zoom e Ctrl 0 volta a vista pro começo.
  useEffect(() => {
    if (readOnly) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const digitando = tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA";
      if ((e.ctrlKey || e.metaKey) && (e.key === "=" || e.key === "+")) { e.preventDefault(); setZoom((z) => Math.min(2, z * 1.15)); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === "-") { e.preventDefault(); setZoom((z) => Math.max(0.35, z * 0.87)); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === "0") { e.preventDefault(); resetVista(); return; }
      if (digitando) return;
      if ((e.key === "Delete" || e.key === "Backspace") && sel) {
        e.preventDefault();
        setNodes((prev) => prev.filter((n) => n.id !== sel));
        setEdges((prev) => prev.filter((l) => l.de !== sel && l.para !== sel));
        setSel(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [readOnly, sel]);

  const addNode = (tipo: NoMapa["tipo"]) => {
    const id = novoId();
    // nasce perto do centro visível do canvas
    const x = (320 - pan.x) / zoom + Math.random() * 60;
    const y = (200 - pan.y) / zoom + Math.random() * 60;
    setNodes((prev) => [...prev, { id, x, y, titulo: TIPOS[tipo].label + " nova", tipo }]);
    setSel(id);
  };

  const excluirSel = () => {
    if (!sel) return;
    setNodes((prev) => prev.filter((n) => n.id !== sel));
    setEdges((prev) => prev.filter((l) => l.de !== sel && l.para !== sel));
    setSel(null);
  };

  const salvar = async () => {
    if (!onSalvar || salvando) return;
    setSalvando(true);
    const ok = await onSalvar({ nodes, edges });
    setSalvando(false);
    if (ok) { setSalvoOk(true); setTimeout(() => setSalvoOk(false), 2500); }
  };

  // Autosave: grava sozinho 1,2s depois da última mudança (parou de mexer, salvou).
  // Enquanto arrasta/digita o debounce reinicia, então salva uma vez só no fim.
  // O botão Salvar continua ali como reforço, mas o normal é nem precisar clicar.
  const jaMontou = useRef(false);
  useEffect(() => {
    if (readOnly || !onSalvar) return;
    if (!jaMontou.current) { jaMontou.current = true; return; } // não salva no carregamento
    const t = setTimeout(() => { void salvar(); }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  const centro = (id: string) => {
    const n = nodes.find((x) => x.id === id);
    return n ? { cx: n.x + NO_W / 2, cy: n.y + NO_H / 2 } : null;
  };

  // Curva estilo fluxograma: sai da BORDA do bloco de origem e chega na BORDA
  // do destino (nada de linha atravessando bloco), com bezier suave.
  const caminhoCurva = (deId: string, paraId: string): { d: string; mx: number; my: number } | null => {
    const a = nodes.find((n) => n.id === deId);
    const b = nodes.find((n) => n.id === paraId);
    if (!a || !b) return null;
    const acx = a.x + NO_W / 2, acy = a.y + NO_H / 2;
    const bcx = b.x + NO_W / 2, bcy = b.y + NO_H / 2;
    const vertical = Math.abs(bcx - acx) < NO_W * 0.9 && Math.abs(bcy - acy) > NO_H;
    let ax: number, ay: number, bx: number, by: number, d: string;
    if (vertical) {
      const desce = bcy >= acy;
      ax = acx; ay = a.y + (desce ? NO_H : 0);
      bx = bcx; by = b.y + (desce ? 0 : NO_H);
      const dy = Math.max(36, Math.abs(by - ay) / 2) * (desce ? 1 : -1);
      d = `M ${ax} ${ay} C ${ax} ${ay + dy}, ${bx} ${by - dy}, ${bx} ${by}`;
    } else {
      const direita = bcx >= acx;
      ax = a.x + (direita ? NO_W : 0); ay = acy;
      bx = b.x + (direita ? 0 : NO_W); by = bcy;
      const dx = Math.max(48, Math.abs(bx - ax) / 2) * (direita ? 1 : -1);
      d = `M ${ax} ${ay} C ${ax + dx} ${ay}, ${bx - dx} ${by}, ${bx} ${by}`;
    }
    return { d, mx: (ax + bx) / 2, my: (ay + by) / 2 };
  };

  const pillBtn: React.CSSProperties = { all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, background: "var(--ed2-card)", color: "var(--ed2-ink)", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" };

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", height: "100%", minHeight: 480, overflow: "hidden", borderRadius: readOnly ? 0 : 24, background: "var(--ed2-surface)", touchAction: "none" }}
      onPointerDown={onDownFundo} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>

      {/* grade de fundo sutil */}
      <div aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, rgba(11,24,56,0.09) 1px, transparent 1px)", backgroundSize: `${24 * zoom}px ${24 * zoom}px`, backgroundPosition: `${pan.x}px ${pan.y}px` }} />

      {/* mundo transformado: edges + nodes */}
      <div style={{ position: "absolute", left: 0, top: 0, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0" }}>
        <svg width={4000} height={3000} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}>
          <defs>
            <marker id="seta-mapa" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
              <path d="M1,1.5 L9,5 L1,8.5 Z" fill="#C9A961" />
            </marker>
          </defs>
          {edges.map((l, i) => {
            const c = caminhoCurva(l.de, l.para);
            if (!c) return null;
            return (
              <g key={i}>
                {/* halo: descola a linha da grade de fundo */}
                <path d={c.d} fill="none" stroke="var(--ed2-surface)" strokeWidth={8} strokeLinecap="round" />
                <path d={c.d} fill="none" stroke="#C9A961" strokeWidth={2.6} strokeOpacity={0.95}
                  strokeLinecap="round" markerEnd="url(#seta-mapa)" />
                {!readOnly && (
                  <circle cx={c.mx} cy={c.my} r={9} fill="transparent" stroke="transparent" strokeWidth={16}
                    style={{ pointerEvents: "auto", cursor: "pointer" }}
                    onPointerDown={(e) => { e.stopPropagation(); }}
                    onClick={(e) => { e.stopPropagation(); setEdges((prev) => prev.filter((_, j) => j !== i)); }}>
                    <title>Clique pra remover esta ligação</title>
                  </circle>
                )}
              </g>
            );
          })}
        </svg>

        {nodes.map((n) => {
          const t = TIPOS[n.tipo];
          const Icone = t.Icone;
          const ativo = sel === n.id || origem === n.id;
          return (
            <div key={n.id} onPointerDown={(e) => onDownNode(e, n)}
              onDoubleClick={(e) => { e.stopPropagation(); if (!readOnly && !ligando) { setSel(n.id); setEditando(n.id); } }}
              style={{
                position: "absolute", left: n.x, top: n.y, width: NO_W, minHeight: NO_H, boxSizing: "border-box",
                background: t.bg, color: t.fg, border: `1.6px solid ${ativo ? "#C9A961" : t.borda}`,
                borderRadius: 16, padding: "11px 15px", cursor: readOnly ? "default" : ligando ? "crosshair" : editando === n.id ? "text" : "grab",
                boxShadow: ativo ? "0 10px 28px rgba(201,169,97,0.4)" : "0 6px 18px rgba(7,15,38,0.12)",
                display: "flex", flexDirection: "column", justifyContent: "center", gap: 3, userSelect: "none",
              }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 9.5, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.75 }}>
                <Icone size={11} strokeWidth={2.4} aria-hidden /> {t.label}
              </span>
              {editando === n.id ? (
                <input
                  autoFocus
                  value={n.titulo}
                  onPointerDown={(e) => e.stopPropagation()}
                  onChange={(e) => setNodes((prev) => prev.map((m) => (m.id === n.id ? { ...m, titulo: e.target.value } : m)))}
                  onBlur={() => setEditando(null)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "Escape") { e.preventDefault(); setEditando(null); }
                    e.stopPropagation();
                  }}
                  style={{ width: "100%", border: "none", background: "transparent", color: t.fg, fontSize: 13.5, fontWeight: 700, lineHeight: 1.25, letterSpacing: "-0.01em", outline: "none", padding: 0 }}
                />
              ) : (
                <span style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.25, letterSpacing: "-0.01em" }}>{n.titulo}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* toolbar do editor */}
      {!readOnly && (
        <div style={{ position: "absolute", top: 14, left: 14, right: 14, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", pointerEvents: "none" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", pointerEvents: "auto" }} onPointerDown={(e) => e.stopPropagation()}>
            {(Object.keys(TIPOS) as NoMapa["tipo"][]).map((tp) => (
              <button key={tp} type="button" onClick={() => addNode(tp)} style={pillBtn} title={`Adicionar ${TIPOS[tp].label}`}>
                <Plus size={13} style={{ color: "var(--pill-gold-fg)" }} /> {TIPOS[tp].label}
              </button>
            ))}
            <button type="button" onClick={() => { setLigando((v) => !v); setOrigem(null); }}
              style={{ ...pillBtn, background: ligando ? "#C9A961" : "var(--ed2-card)", color: ligando ? "#0B1838" : "var(--ed2-ink)" }}
              title="Ligar: clique no nó de origem e depois no de destino">
              <Link2 size={13} /> {ligando ? (origem ? "clica no destino..." : "clica na origem...") : "Ligar"}
            </button>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, pointerEvents: "auto" }} onPointerDown={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setZoom((z) => Math.min(2, z * 1.15))} style={pillBtn} aria-label="Aproximar" title="Aproximar (Ctrl +, ou Ctrl + scroll)"><ZoomIn size={14} /></button>
            <button type="button" onClick={() => setZoom((z) => Math.max(0.35, z * 0.87))} style={pillBtn} aria-label="Afastar" title="Afastar (Ctrl -, ou Ctrl + scroll)"><ZoomOut size={14} /></button>
            <button type="button" onClick={resetVista} style={pillBtn} aria-label="Centralizar" title="Centralizar a vista (Ctrl 0)"><Maximize size={14} /></button>
            {onSalvar && (
              <button type="button" onClick={salvar} disabled={salvando}
                style={{ ...pillBtn, background: salvoOk ? "#34C759" : "#0B1838", color: "#fff" }}>
                {salvando ? <Loader2 size={13} className="animate-spin" /> : salvoOk ? <Check size={13} /> : <Save size={13} />}
                {salvando ? "Salvando..." : salvoOk ? "Salvo" : "Salvar"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* painel do nó selecionado */}
      {!readOnly && selNode && (
        <div onPointerDown={(e) => e.stopPropagation()}
          style={{ position: "absolute", bottom: 14, left: 14, display: "flex", gap: 8, alignItems: "center", background: "var(--ed2-card)", borderRadius: 16, padding: "10px 12px", boxShadow: "0 8px 28px rgba(7,15,38,0.18)", flexWrap: "wrap" }}>
          <input value={selNode.titulo} autoFocus
            onChange={(e) => setNodes((prev) => prev.map((n) => (n.id === sel ? { ...n, titulo: e.target.value } : n)))}
            style={{ border: "1px solid var(--ed2-hair)", borderRadius: 10, padding: "8px 12px", fontSize: 13, width: 220, background: "var(--ed2-surface)", color: "var(--ed2-ink)" }} />
          <select value={selNode.tipo}
            onChange={(e) => setNodes((prev) => prev.map((n) => (n.id === sel ? { ...n, tipo: e.target.value as NoMapa["tipo"] } : n)))}
            style={{ border: "1px solid var(--ed2-hair)", borderRadius: 10, padding: "8px 10px", fontSize: 13, background: "var(--ed2-surface)", color: "var(--ed2-ink)", cursor: "pointer" }}>
            {(Object.keys(TIPOS) as NoMapa["tipo"][]).map((tp) => <option key={tp} value={tp}>{TIPOS[tp].label}</option>)}
          </select>
          <button type="button" onClick={excluirSel} title="Excluir card (ou tecla Delete)"
            style={{ all: "unset", cursor: "pointer", color: "var(--pill-red-fg)", padding: 8, display: "inline-flex" }}>
            <Trash2 size={16} />
          </button>
        </div>
      )}

      {/* legenda no modo leitura */}
      {readOnly && (
        <div style={{ position: "absolute", bottom: 14, left: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
          {(Object.keys(TIPOS) as NoMapa["tipo"][]).map((tp) => (
            <span key={tp} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: "var(--ed2-ink-2)" }}>
              <span style={{ width: 11, height: 11, borderRadius: 4, background: TIPOS[tp].bg, border: `1.4px solid ${TIPOS[tp].borda}`, display: "inline-block" }} />
              {TIPOS[tp].label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
