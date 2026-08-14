"use client";

// Renderiza os slides do carrossel em <canvas> 1080x1350 e exporta PNGs.
// Sistema visual portado do kit-carrossel-premium da casa (Desktop/saas):
// layouts nomeados (CAPA, NUMERO, SOLO, STAT, CTA), ritmo de fundos
// alternados (escuro -> creme -> navy, nunca dois iguais seguidos),
// kicker espacado + titulo com kerning apertado, regua, halo, numeral
// gigante e contador. Fraunces (display) + Inter (body).
import { useEffect, useRef, useState, useCallback } from "react";
import { Download, ImagePlus, Sparkles, Copy, Check, Loader2 } from "lucide-react";

export interface Slide {
  tipo: "capa" | "conteudo" | "cta";
  titulo: string;
  texto?: string;
  destaque?: string;
  foto_prompt?: string; // prompt em inglês gerado pela IA pro slide (Imagen/Labs)
}

const W = 1080;
const H = 1350;
const PAD = 92;

// tokens da marca (preset Endereço Digital sobre o kit)
const BG_DARK = "#14110D";
const BG_LIGHT = "#F7F4EF";
const BG_ACCENT = "#0B1838";
const ACCENT = "#C9A961";
const INK = "#1A1712";
const INK_SOFT = "#5A5346";
const PAPER = "#F4F1E9";
const PAPER_SOFT = "rgba(244,241,233,0.66)";
const DISPLAY = "'Fraunces',Georgia,serif";
const BODY = "'Inter','Archivo',system-ui,sans-serif";

type Fundo = "dark" | "light" | "accent";

/** Ritmo do kit: nunca dois fundos iguais seguidos; capa escura, CTA navy. */
function fundoDoSlide(i: number, total: number): Fundo {
  if (i === 0) return "dark";
  if (i === total - 1) return "accent";
  const ciclo: Fundo[] = ["light", "accent", "dark"];
  let f = ciclo[(i - 1) % 3];
  // evita accent colado no CTA final (que é accent)
  if (i === total - 2 && f === "accent") f = "light";
  return f;
}

function coresDoFundo(f: Fundo) {
  return {
    texto: f === "light" ? INK : PAPER,
    apoio: f === "light" ? INK_SOFT : PAPER_SOFT,
  };
}

function limpa(s: string): string {
  return (s || "")
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function setSpacing(ctx: CanvasRenderingContext2D, v: string) {
  try { (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = v; } catch { /* */ }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = limpa(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxWidth && line) { lines.push(line); line = w; }
    else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

function drawLines(ctx: CanvasRenderingContext2D, lines: string[], x: number, y: number, lh: number): number {
  let cy = y;
  for (const l of lines) { ctx.fillText(l, x, cy); cy += lh; }
  return cy;
}

/** Fundo do slide conforme o kit (dark radial, light chapado, accent com brilho). */
function pintaFundo(ctx: CanvasRenderingContext2D, f: Fundo) {
  if (f === "dark") {
    const g = ctx.createRadialGradient(W / 2, -140, 80, W / 2, H * 0.4, H * 1.1);
    g.addColorStop(0, "#1B1814");
    g.addColorStop(0.55, BG_DARK);
    g.addColorStop(1, "#0D0B09");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else if (f === "light") {
    ctx.fillStyle = BG_LIGHT;
    ctx.fillRect(0, 0, W, H);
  } else {
    ctx.fillStyle = BG_ACCENT;
    ctx.fillRect(0, 0, W, H);
    let g = ctx.createRadialGradient(W * 0.8, 0, 60, W * 0.8, 0, W * 1.1);
    g.addColorStop(0, "rgba(255,255,255,0.14)");
    g.addColorStop(0.55, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    g = ctx.createRadialGradient(W * 0.15, H * 1.2, 60, W * 0.15, H * 1.2, W);
    g.addColorStop(0, "rgba(0,0,0,0.30)");
    g.addColorStop(0.55, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
}

/** Halo decorativo do kit: círculo de borda translúcida vazando a beirada. */
function halo(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, cor: string) {
  ctx.save();
  ctx.globalAlpha = 0.10;
  ctx.strokeStyle = cor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Header do kit: logo + wordmark (esq) e contador (dir). Em todos os slides. */
function cabecalho(ctx: CanvasRenderingContext2D, f: Fundo, idx: number, total: number, logo: HTMLImageElement | null) {
  const { texto } = coresDoFundo(f);
  if (logo) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(PAD, PAD - 8, 56, 56, 14);
    ctx.clip();
    ctx.drawImage(logo, PAD, PAD - 8, 56, 56);
    ctx.restore();
  }
  ctx.font = `700 34px ${DISPLAY}`;
  ctx.fillStyle = texto;
  setSpacing(ctx, "-0.5px");
  ctx.fillText("Endereço Digital", PAD + 74, PAD + 28);
  setSpacing(ctx, "5px");
  ctx.font = `700 13px ${BODY}`;
  ctx.globalAlpha = 0.7;
  ctx.fillText("OPERAÇÃO DIGITAL", PAD + 74, PAD + 52);
  ctx.globalAlpha = 1;
  // contador
  ctx.font = `600 17px ${BODY}`;
  setSpacing(ctx, "3.5px");
  ctx.globalAlpha = 0.55;
  const c = `${String(idx).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
  ctx.fillText(c, W - PAD - ctx.measureText(c).width, PAD + 16);
  ctx.globalAlpha = 1;
  setSpacing(ctx, "0px");
}

function kicker(ctx: CanvasRenderingContext2D, txt: string, x: number, y: number) {
  ctx.font = `800 19px ${BODY}`;
  setSpacing(ctx, "5.5px");
  ctx.fillStyle = ACCENT;
  ctx.fillText(txt.toUpperCase(), x, y);
  setSpacing(ctx, "0px");
}

function regua(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const g = ctx.createLinearGradient(x, y, x + 280, y);
  g.addColorStop(0, ACCENT);
  g.addColorStop(1, "rgba(201,169,97,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(x, y, 280, 3, 2);
  ctx.fill();
}

const KICKERS_INTERNOS = ["Na prática", "O ponto", "Preste atenção", "Regra da casa", "Sem enrolação", "Anota isso"];

/** Moldura de foto opcional (modo com foto) nos slides internos. */
function molduraFoto(ctx: CanvasRenderingContext2D, foto: HTMLImageElement | undefined, y: number, h: number, f: Fundo) {
  const x = PAD, w = W - PAD * 2, r = 28;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.clip();
  if (foto) {
    const esc = Math.max(w / foto.width, h / foto.height);
    ctx.drawImage(foto, x + (w - foto.width * esc) / 2, y + (h - foto.height * esc) / 2, foto.width * esc, foto.height * esc);
  } else {
    ctx.fillStyle = f === "light" ? "rgba(26,23,18,0.06)" : "rgba(244,241,233,0.08)";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = f === "light" ? INK_SOFT : PAPER_SOFT;
    ctx.font = `600 26px ${BODY}`;
    const aviso = "clique no slide pra colocar a foto";
    ctx.fillText(aviso, x + (w - ctx.measureText(aviso).width) / 2, y + h / 2 + 9);
  }
  ctx.restore();
  ctx.strokeStyle = "rgba(201,169,97,0.45)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.stroke();
}

function desenharSlide(
  ctx: CanvasRenderingContext2D, slide: Slide, idx: number, total: number,
  logo: HTMLImageElement | null, comFoto: boolean, foto?: HTMLImageElement
) {
  const f = fundoDoSlide(idx - 1, total);
  const { texto, apoio } = coresDoFundo(f);
  pintaFundo(ctx, f);
  ctx.textBaseline = "alphabetic";

  // ── CAPA ────────────────────────────────────────────────────────────
  if (slide.tipo === "capa") {
    halo(ctx, W - PAD - 120, 150, 310, ACCENT);
    cabecalho(ctx, f, idx, total, logo);
    const midY = 470;
    kicker(ctx, "Para donos de negócio", PAD, midY);
    ctx.font = `600 96px ${DISPLAY}`;
    setSpacing(ctx, "-2.8px");
    ctx.fillStyle = texto;
    const tl = wrapText(ctx, slide.titulo, W - PAD * 2).slice(0, 5);
    const fim = drawLines(ctx, tl, PAD, midY + 118, 100);
    setSpacing(ctx, "0px");
    if (slide.texto) {
      ctx.font = `500 31px ${BODY}`;
      ctx.fillStyle = apoio;
      drawLines(ctx, wrapText(ctx, slide.texto, W - PAD * 2 - 60).slice(0, 3), PAD, fim + 34, 47);
    }
    // arraste
    ctx.font = `600 22px ${BODY}`;
    ctx.fillStyle = texto;
    ctx.globalAlpha = 0.85;
    ctx.fillText("Arraste", PAD, H - PAD - 30);
    ctx.globalAlpha = 1;
    ctx.font = `800 26px ${BODY}`;
    ctx.fillStyle = ACCENT;
    ctx.fillText(">>", PAD + 96, H - PAD - 30);
    // handle
    ctx.font = `700 21px ${BODY}`;
    ctx.fillStyle = apoio;
    const h = "@endereco.digital";
    ctx.fillText(h, W - PAD - ctx.measureText(h).width, H - PAD - 30);
    return;
  }

  // ── CTA FINAL ───────────────────────────────────────────────────────
  if (slide.tipo === "cta") {
    halo(ctx, -60, H - 140, 340, PAPER);
    cabecalho(ctx, f, idx, total, logo);
    const baseY = 470;
    kicker(ctx, "Próximo passo", PAD, baseY);
    ctx.font = `600 80px ${DISPLAY}`;
    setSpacing(ctx, "-2.4px");
    ctx.fillStyle = texto;
    const tl = wrapText(ctx, slide.titulo, W - PAD * 2).slice(0, 4);
    let fim = drawLines(ctx, tl, PAD, baseY + 104, 86);
    setSpacing(ctx, "0px");
    if (slide.texto) {
      ctx.font = `500 30px ${BODY}`;
      ctx.fillStyle = apoio;
      fim = drawLines(ctx, wrapText(ctx, slide.texto, W - PAD * 2 - 40).slice(0, 3), PAD, fim + 30, 46);
    }
    // pill
    const label = "Diagnóstico gratuito · link na bio";
    ctx.font = `800 25px ${BODY}`;
    const lw = ctx.measureText(label).width;
    const bh = 88, by = fim + 40;
    ctx.fillStyle = ACCENT;
    ctx.beginPath();
    ctx.roundRect(PAD, by, lw + 100, bh, 999);
    ctx.fill();
    ctx.fillStyle = BG_ACCENT;
    ctx.fillText(label, PAD + 50, by + bh / 2 + 9);
    // handle
    ctx.font = `700 23px ${BODY}`;
    ctx.fillStyle = ACCENT;
    ctx.fillText("@endereco.digital", PAD, by + bh + 64);
    return;
  }

  // ── INTERNOS: alterna NUMERO / SOLO / STAT pra criar ritmo ──────────
  const interno = (idx - 2) % 3; // 0 NUMERO · 1 SOLO · 2 STAT
  const kick = KICKERS_INTERNOS[(idx - 2) % KICKERS_INTERNOS.length];
  cabecalho(ctx, f, idx, total, logo);

  let y = 400;
  if (comFoto) {
    molduraFoto(ctx, foto, 230, 420, f);
    y = 230 + 420 + 96;
  }

  const temDestaque = !!slide.destaque?.trim();
  const destaqueCurto = temDestaque && limpa(slide.destaque!).length <= 14;

  if (!comFoto && interno === 0) {
    // NUMERO: numeral gigante como grafismo
    const num = String(idx - 1);
    ctx.font = `900 520px ${DISPLAY}`;
    setSpacing(ctx, "-14px");
    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = ACCENT;
    ctx.fillText(num, W - PAD - ctx.measureText(num).width + 30, 560);
    ctx.restore();
    setSpacing(ctx, "0px");
  } else if (!comFoto) {
    halo(ctx, interno === 1 ? W + 40 : -80, interno === 1 ? H - 200 : 420, 300, f === "light" ? INK : ACCENT);
  }

  kicker(ctx, kick, PAD, y);

  // STAT: destaque curto vira o dado gigante ANTES do título
  if (!comFoto && interno === 2 && destaqueCurto) {
    ctx.font = `700 190px ${DISPLAY}`;
    setSpacing(ctx, "-5px");
    ctx.fillStyle = ACCENT;
    ctx.fillText(limpa(slide.destaque!), PAD, y + 200);
    setSpacing(ctx, "0px");
    y += 232;
  }

  const tamH2 = comFoto ? 54 : interno === 2 ? 60 : interno === 0 ? 74 : 72;
  ctx.font = `600 ${tamH2}px ${DISPLAY}`;
  setSpacing(ctx, "-2px");
  ctx.fillStyle = texto;
  const tl = wrapText(ctx, slide.titulo, W - PAD * 2 - (interno === 0 && !comFoto ? 60 : 0)).slice(0, comFoto ? 3 : 4);
  let fim = drawLines(ctx, tl, PAD, y + tamH2 + 26, Math.round(tamH2 * 1.08));
  setSpacing(ctx, "0px");

  regua(ctx, PAD, fim + 6);
  fim += 48;

  // destaque longo (ou em slide sem STAT): frase em display na cor de acento
  if (temDestaque && !(interno === 2 && destaqueCurto && !comFoto)) {
    ctx.font = `600 ${comFoto ? 34 : 42}px ${DISPLAY}`;
    ctx.fillStyle = ACCENT;
    fim = drawLines(ctx, wrapText(ctx, slide.destaque!, W - PAD * 2 - 40).slice(0, 3), PAD, fim + 26, comFoto ? 44 : 54);
    fim += 8;
  }

  if (slide.texto) {
    ctx.font = `500 ${comFoto ? 28 : 31}px ${BODY}`;
    ctx.fillStyle = apoio;
    drawLines(ctx, wrapText(ctx, slide.texto, W - PAD * 2 - 30).slice(0, comFoto ? 4 : 6), PAD, fim + 30, comFoto ? 42 : 47);
  }
}

export default function CarrosselCanvas({ slides, nomeBase }: { slides: Slide[]; nomeBase: string }) {
  const refs = useRef<(HTMLCanvasElement | null)[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const slideAlvo = useRef<number | null>(null);
  const [comFoto, setComFoto] = useState(false);
  const [fotos, setFotos] = useState<Record<number, HTMLImageElement>>({});
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const [fontsProntas, setFontsProntas] = useState(false);
  const [imagemIA, setImagemIA] = useState(false);        // GEMINI_API_KEY configurada?
  const [gerandoImg, setGerandoImg] = useState<number | null>(null);
  const [copiado, setCopiado] = useState<number | null>(null);
  const [avisoImg, setAvisoImg] = useState("");

  useEffect(() => {
    // Fraunces não faz parte do site: injeta só no admin, uma vez
    if (!document.getElementById("fonte-fraunces")) {
      const l = document.createElement("link");
      l.id = "fonte-fraunces";
      l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700;9..144,900&family=Inter:wght@500;600;700;800&display=swap";
      document.head.appendChild(l);
    }
    const img = new Image();
    img.onload = () => setLogo(img);
    img.src = "/logo-mark.png";
    fetch("/api/admin/social/imagem").then((r) => r.json()).then((d) => setImagemIA(!!d.disponivel)).catch(() => {});
    Promise.all([
      document.fonts.load(`600 96px 'Fraunces'`),
      document.fonts.load(`900 520px 'Fraunces'`),
      document.fonts.load(`800 19px 'Inter'`),
    ]).then(() => setFontsProntas(true)).catch(() => setFontsProntas(true));
  }, []);

  useEffect(() => {
    slides.forEach((s, i) => {
      const cv = refs.current[i];
      const ctx = cv?.getContext("2d");
      if (!cv || !ctx) return;
      ctx.clearRect(0, 0, W, H);
      desenharSlide(ctx, s, i + 1, slides.length, logo, comFoto && s.tipo === "conteudo", fotos[i]);
    });
  }, [slides, comFoto, fotos, logo, fontsProntas]);

  const escolherFoto = (i: number) => {
    if (slides[i]?.tipo !== "conteudo") return;
    if (!comFoto) setComFoto(true); // clicar no slide já liga a moldura sozinho
    slideAlvo.current = i;
    inputRef.current?.click();
  };

  const carregarFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    const alvo = slideAlvo.current;
    if (!f || alvo == null) return;
    const img = new Image();
    img.onload = () => setFotos((prev) => ({ ...prev, [alvo]: img }));
    img.src = URL.createObjectURL(f);
    e.target.value = "";
  };

  const copiarPrompt = (i: number, prompt: string) => {
    navigator.clipboard.writeText(prompt).catch(() => {});
    setCopiado(i);
    setTimeout(() => setCopiado(null), 1800);
  };

  const gerarImagem = async (i: number, prompt: string) => {
    if (gerandoImg !== null) return;
    setGerandoImg(i);
    setAvisoImg("");
    try {
      const res = await fetch("/api/admin/social/imagem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const d = await res.json();
      if (!res.ok || d.error) { setAvisoImg(d.error || "Erro ao gerar imagem"); return; }
      const img = new Image();
      img.onload = () => setFotos((prev) => ({ ...prev, [i]: img }));
      img.src = d.imagem;
      if (!comFoto) setComFoto(true); // liga a moldura sozinho
    } catch { setAvisoImg("Falha de conexão"); } finally { setGerandoImg(null); }
  };

  const baixarTodos = useCallback(() => {
    slides.forEach((_, i) => {
      const cv = refs.current[i];
      if (!cv) return;
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = cv.toDataURL("image/png");
        a.download = `${nomeBase}-slide-${String(i + 1).padStart(2, "0")}.png`;
        a.click();
      }, i * 350);
    });
  }, [slides, nomeBase]);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
        <button type="button" onClick={() => setComFoto((v) => !v)}
          title="Reserva moldura de foto nos slides internos; clique no slide pra subir a imagem"
          style={{ all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, background: comFoto ? "#0B1838" : "var(--ed2-surface)", color: comFoto ? "#F5F2EA" : "var(--ed2-ink-2)" } as React.CSSProperties}>
          <ImagePlus size={13} aria-hidden="true" /> {comFoto ? "Com foto (clique no slide)" : "Sem foto"}
        </button>
        <span style={{ fontSize: 11.5, color: "var(--ed2-ink-3)" }}>
          Visual do kit premium da casa: fundos alternados, Fraunces + Inter, numeral gigante
        </span>
      </div>

      <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 10 }}>
        {slides.map((s, i) => (
          <div key={i} style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            <canvas
              ref={(el) => { refs.current[i] = el; }}
              width={W}
              height={H}
              onClick={() => escolherFoto(i)}
              title={s.tipo === "conteudo" ? "Clique pra colocar uma foto neste slide" : undefined}
              style={{ width: 232, height: 290, borderRadius: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.15)", cursor: s.tipo === "conteudo" ? "pointer" : "default", background: "#fff" }}
              aria-label={`Slide ${i + 1}: ${s.titulo}`}
            />
            {s.tipo === "conteudo" && s.foto_prompt && (
              <div style={{ display: "flex", gap: 5, width: 232 }}>
                {imagemIA && (
                  <button type="button" onClick={() => gerarImagem(i, s.foto_prompt!)} disabled={gerandoImg !== null}
                    title="Gera a foto deste slide com IA (Imagen) e já encaixa na moldura"
                    style={{ all: "unset", cursor: "pointer", flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "7px 0", borderRadius: 9, fontSize: 11, fontWeight: 700, background: "#C9A961", color: "#0B1838", opacity: gerandoImg !== null && gerandoImg !== i ? 0.5 : 1 } as React.CSSProperties}>
                    {gerandoImg === i ? <Loader2 size={11} className="animate-spin" aria-hidden /> : <Sparkles size={11} aria-hidden />} Gerar foto
                  </button>
                )}
                <button type="button" onClick={() => copiarPrompt(i, s.foto_prompt!)}
                  title="Copiar o prompt pra gerar no Google Labs"
                  style={{ all: "unset", cursor: "pointer", flex: imagemIA ? undefined : 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "7px 10px", borderRadius: 9, fontSize: 11, fontWeight: 700, background: "var(--ed2-surface)", color: copiado === i ? "var(--pill-green-fg)" : "var(--ed2-ink-2)" } as React.CSSProperties}>
                  {copiado === i ? <Check size={11} aria-hidden /> : <Copy size={11} aria-hidden />} {copiado === i ? "Copiado" : "Prompt"}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      {avisoImg && <div style={{ marginTop: 8, fontSize: 12, color: "var(--pill-red-fg)" }}>{avisoImg}</div>}

      <input ref={inputRef} type="file" accept="image/*" onChange={carregarFoto} style={{ display: "none" }} aria-hidden="true" />

      <button
        type="button"
        onClick={baixarTodos}
        style={{ all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, marginTop: 10, background: "#C9A961", color: "#fff", padding: "10px 18px", borderRadius: 999, fontSize: 13, fontWeight: 600 }}
      >
        <Download size={14} aria-hidden="true" />
        Baixar {slides.length} PNGs (1080x1350)
      </button>
    </div>
  );
}
