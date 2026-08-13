"use client";

import { useState } from "react";
import { criarHubAction } from "@/app/owner/hubs/actions";
import {
  IcoPlus,
  IcoX,
  IcoHub,
  IcoGrid,
  IcoGlobe,
  IcoInstagram,
  IcoActivity,
  IcoFunnel,
} from "@/components/icons";

type Hub = {
  id: string;
  nome: string;
  cor_destaque: string | null;
  cor_apoio: string | null;
  cor_fundo: string | null;
  cor_texto: string | null;
  tema_modo: string;
  tipografia: string;
};

const STEPS = [
  { t: "Identidade", d: "Nome, slug e logo" },
  { t: "Visual", d: "Tema, cores e tipografia" },
  { t: "Módulos", d: "O que os clientes têm" },
  { t: "Domínio", d: "Endereço do hub" },
  { t: "Revisão", d: "Conferir e criar" },
];

function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

const FONTS: Record<string, string> = {
  moderna: "var(--font-jakarta), sans-serif",
  classica: "Georgia, 'Times New Roman', serif",
  mono: "ui-monospace, 'Courier New', monospace",
};

interface F {
  nome: string;
  slug: string;
  versao: string;
  logo_url: string;
  favicon_url: string;
  descricao: string;
  login_titulo: string;
  login_botao: string;
  tema_modo: string;
  cor_destaque: string;
  cor_apoio: string;
  cor_fundo: string;
  cor_texto: string;
  tipografia: string;
  mod_site: boolean;
  mod_instagram: boolean;
  mod_financeiro: boolean;
  mod_crm: boolean;
  dominio: string;
}

const INICIAL: F = {
  nome: "",
  slug: "",
  versao: "1.0.0",
  logo_url: "",
  favicon_url: "",
  descricao: "",
  login_titulo: "",
  login_botao: "Entrar",
  tema_modo: "escuro",
  cor_destaque: "#C9A961",
  cor_apoio: "#1B2A4A",
  cor_fundo: "#0B1838",
  cor_texto: "#F5F3EE",
  tipografia: "moderna",
  mod_site: true,
  mod_instagram: true,
  mod_financeiro: false,
  mod_crm: false,
  dominio: "",
};

function Mock({ f }: { f: F }) {
  const claro = f.tema_modo === "claro";
  const bg = claro ? f.cor_fundo || "#F1F5FB" : "#0b1526";
  const text = f.cor_texto || (claro ? "#132A4E" : "#F5F3EE");
  const cardBg = claro ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.06)";
  const dest = f.cor_destaque || "#C9A961";
  const apoio = f.cor_apoio || "#5B8FD6";
  return (
    <div className="mock" style={{ background: bg, color: text, fontFamily: FONTS[f.tipografia] }}>
      <div className="mock-nav" style={{ borderBottom: `1px solid ${claro ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.1)"}` }}>
        <span className="mock-pill" style={{ background: dest, color: "#fff", fontSize: 10 }}>HB</span>
        <b style={{ fontSize: 12 }}>{f.nome || "Meu Hub"}</b>
        <span className="mock-pill" style={{ background: `${dest}22`, color: dest, marginLeft: 6 }}>Visão Geral</span>
        <span style={{ opacity: 0.5 }}>Meu Site</span>
        <span style={{ opacity: 0.5 }}>Instagram</span>
      </div>
      <div className="mock-body">
        <div style={{ fontWeight: 800, fontSize: 15 }}>Bem-vindo ao seu hub</div>
        <div style={{ opacity: 0.6, fontSize: 11 }}>Tudo do seu negócio digital em um só lugar.</div>
        <div className="mock-card" style={{ background: cardBg }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
            <span style={{ letterSpacing: "0.08em", opacity: 0.7 }}>INSTAGRAM</span>
            <span className="mock-pill" style={{ background: `${apoio}22`, color: apoio }}>ativo</span>
          </div>
          <div style={{ fontWeight: 800, fontSize: 18, marginTop: 3 }}>+128 seguidores</div>
          <div className="mock-bar" style={{ background: `${apoio}33` }}>
            <div style={{ width: "62%", height: "100%", borderRadius: 999, background: apoio }} />
          </div>
        </div>
        <div className="mock-btn" style={{ background: dest, color: "#fff" }}>Gerar conteúdo</div>
        <div style={{ fontSize: 10, opacity: 0.6, marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: apoio, display: "inline-block" }} /> Cor de apoio nos detalhes
        </div>
      </div>
    </div>
  );
}

export default function NovoHubModal({
  hubs = [],
  base,
  label,
  variant,
}: {
  hubs?: Hub[];
  base?: Hub;
  label?: string;
  variant?: "ghost";
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [manualSlug, setManualSlug] = useState(false);
  const [f, setF] = useState<F>(
    base
      ? {
          ...INICIAL,
          cor_destaque: base.cor_destaque || INICIAL.cor_destaque,
          cor_apoio: base.cor_apoio || INICIAL.cor_apoio,
          cor_fundo: base.cor_fundo || INICIAL.cor_fundo,
          cor_texto: base.cor_texto || INICIAL.cor_texto,
          tema_modo: base.tema_modo || INICIAL.tema_modo,
          tipografia: base.tipografia || INICIAL.tipografia,
        }
      : INICIAL
  );
  const set = <K extends keyof F>(k: K, v: F[K]) => setF((p) => ({ ...p, [k]: v }));

  function setNome(v: string) {
    setF((p) => ({ ...p, nome: v, slug: manualSlug ? p.slug : slugify(v) }));
  }
  function usarBase(h: Hub) {
    set("cor_destaque", h.cor_destaque || f.cor_destaque);
    set("cor_apoio", h.cor_apoio || f.cor_apoio);
    set("cor_fundo", h.cor_fundo || f.cor_fundo);
    set("cor_texto", h.cor_texto || f.cor_texto);
    set("tema_modo", h.tema_modo || f.tema_modo);
    set("tipografia", h.tipografia || f.tipografia);
  }
  function fechar() {
    setOpen(false);
    setStep(1);
  }

  const temaLabel = f.tema_modo === "claro" ? "Claro" : "Escuro";
  const modsLabel = [f.mod_site && "Meu Site", f.mod_instagram && "Instagram", f.mod_financeiro && "Financeiro", f.mod_crm && "CRM"].filter(Boolean).join(", ") || "—";

  return (
    <>
      <button
        className={variant === "ghost" ? "btn btn-ghost btn-sm" : "btn"}
        onClick={() => setOpen(true)}
        type="button"
      >
        {variant === "ghost" ? <IcoGrid width={15} height={15} /> : <IcoPlus width={16} height={16} />}
        {label || "Criar hub"}
      </button>

      {open && (
        <div className="modal-overlay" onClick={fechar}>
          <div className="modal-panel wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="icon-box"><IcoHub width={20} height={20} /></div>
              <div>
                <h2>Criar novo hub</h2>
                <p>Uma marca completa: identidade, tema, módulos e domínio — sem tocar em código.</p>
              </div>
              <button className="modal-close" onClick={fechar} aria-label="Fechar"><IcoX width={18} height={18} /></button>
            </div>

            <form action={criarHubAction} style={{ display: "contents" }}>
              <div className="wiz-grid">
                {/* passos */}
                <div className="wiz-steps">
                  {STEPS.map((s, i) => {
                    const n = i + 1;
                    return (
                      <button
                        type="button"
                        key={s.t}
                        className={"wiz-step" + (step === n ? " active" : step > n ? " done" : "")}
                        onClick={() => setStep(n)}
                      >
                        <span className="num">{step > n ? "✓" : n}</span>
                        <span className="txt">
                          <span className="st">{s.t}</span>
                          <span className="sd" style={{ display: "block" }}>{s.d}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="wiz-main">
                  <div className="wiz-content">
                    {/* STEP 1 */}
                    <div style={{ display: step === 1 ? "block" : "none" }}>
                      <h3>Identidade do hub</h3>
                      <p>Como a marca aparece pros clientes: nome, endereço interno e logo.</p>
                      <label htmlFor="nome">Nome do hub *</label>
                      <input id="nome" name="nome" value={f.nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: ClinicDigital, VetHub..." required />
                      <label htmlFor="slug">Slug (identificador) *</label>
                      <input id="slug" name="slug" value={f.slug} onChange={(e) => { setManualSlug(true); set("slug", slugify(e.target.value)); }} placeholder="meu-hub" />
                      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Minúsculas, números e hífen. Vira a chave interna e o subdomínio sugerido.</div>
                      <div className="cols-2" style={{ marginTop: 4 }}>
                        <div>
                          <label htmlFor="versao">Versão</label>
                          <input id="versao" name="versao" value={f.versao} onChange={(e) => set("versao", e.target.value)} />
                        </div>
                        <div>
                          <label htmlFor="logo_url">Logo (URL)</label>
                          <input id="logo_url" name="logo_url" value={f.logo_url} onChange={(e) => set("logo_url", e.target.value)} placeholder="https://..." />
                        </div>
                      </div>
                      <label htmlFor="descricao">Descrição (compartilhamentos / PWA)</label>
                      <textarea id="descricao" name="descricao" rows={2} value={f.descricao} onChange={(e) => set("descricao", e.target.value)} placeholder="Descrição curta do hub" />
                      <div className="cols-2">
                        <div>
                          <label htmlFor="login_titulo">Título do login</label>
                          <input id="login_titulo" name="login_titulo" value={f.login_titulo} onChange={(e) => set("login_titulo", e.target.value)} placeholder={f.nome || "Nome do hub"} />
                        </div>
                        <div>
                          <label htmlFor="login_botao">Botão do login</label>
                          <input id="login_botao" name="login_botao" value={f.login_botao} onChange={(e) => set("login_botao", e.target.value)} />
                        </div>
                      </div>
                    </div>

                    {/* STEP 2 */}
                    <div style={{ display: step === 2 ? "block" : "none" }}>
                      <h3>Visual e tema</h3>
                      <p>Comece de um hub existente e mude o que precisar — ou monte do zero.</p>
                      {hubs.length > 0 && (
                        <>
                          <label style={{ marginTop: 0 }}>Usar outro hub como predefinição</label>
                          <div className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                            {hubs.map((h) => (
                              <button type="button" key={h.id} className="chip" onClick={() => usarBase(h)}>
                                <span style={{ width: 12, height: 12, borderRadius: "50%", background: h.cor_destaque || "#C9A961" }} />
                                {h.nome}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                      <label>Modo do tema</label>
                      <div className="select-grid" style={{ marginBottom: 8 }}>
                        <label className="select-card">
                          <input type="radio" name="tema_modo" value="escuro" checked={f.tema_modo === "escuro"} onChange={() => set("tema_modo", "escuro")} />
                          <div className="sc"><div className="sc-title">Escuro</div><div className="sc-sub">Fundo profundo, cor de destaque do hub.</div></div>
                        </label>
                        <label className="select-card">
                          <input type="radio" name="tema_modo" value="claro" checked={f.tema_modo === "claro"} onChange={() => set("tema_modo", "claro")} />
                          <div className="sc"><div className="sc-title">Claro</div><div className="sc-sub">Tema claro completo com suas cores.</div></div>
                        </label>
                      </div>
                      <div className="cols-2">
                        <div>
                          <label>Cor de destaque (botões, links)</label>
                          <div className="row" style={{ gap: 8 }}>
                            <span style={{ width: 34, height: 34, borderRadius: 9, background: f.cor_destaque, border: "1px solid var(--line)", flex: "none" }} />
                            <input name="cor_destaque" value={f.cor_destaque} onChange={(e) => set("cor_destaque", e.target.value)} />
                          </div>
                        </div>
                        <div>
                          <label>Cor de apoio (detalhes)</label>
                          <div className="row" style={{ gap: 8 }}>
                            <span style={{ width: 34, height: 34, borderRadius: 9, background: f.cor_apoio, border: "1px solid var(--line)", flex: "none" }} />
                            <input name="cor_apoio" value={f.cor_apoio} onChange={(e) => set("cor_apoio", e.target.value)} />
                          </div>
                        </div>
                        <div>
                          <label>Fundo (canvas)</label>
                          <div className="row" style={{ gap: 8 }}>
                            <span style={{ width: 34, height: 34, borderRadius: 9, background: f.cor_fundo, border: "1px solid var(--line)", flex: "none" }} />
                            <input name="cor_fundo" value={f.cor_fundo} onChange={(e) => set("cor_fundo", e.target.value)} />
                          </div>
                        </div>
                        <div>
                          <label>Tinta do texto</label>
                          <div className="row" style={{ gap: 8 }}>
                            <span style={{ width: 34, height: 34, borderRadius: 9, background: f.cor_texto, border: "1px solid var(--line)", flex: "none" }} />
                            <input name="cor_texto" value={f.cor_texto} onChange={(e) => set("cor_texto", e.target.value)} />
                          </div>
                        </div>
                      </div>
                      <label>Tipografia</label>
                      <div className="select-grid">
                        {[["moderna", "Moderna (padrão)"], ["classica", "Clássica (serifada)"], ["mono", "Técnica (mono)"]].map(([v, t]) => (
                          <label key={v} className="select-card">
                            <input type="radio" name="tipografia" value={v} checked={f.tipografia === v} onChange={() => set("tipografia", v)} />
                            <div className="sc">
                              <div style={{ fontSize: 20, fontFamily: FONTS[v], marginBottom: 4 }}>Aa Bb Cc</div>
                              <div className="sc-title">{t}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* STEP 3 */}
                    <div style={{ display: step === 3 ? "block" : "none" }}>
                      <h3>Módulos do hub</h3>
                      <p>O que os clientes DESTE hub ganham por padrão — dá pra ajustar cliente a cliente depois.</p>
                      {[
                        { k: "mod_site", Icon: IcoGlobe, t: "Meu Site", d: "Site + métricas de visitas." },
                        { k: "mod_instagram", Icon: IcoInstagram, t: "Instagram", d: "Gerador de conteúdo e biblioteca." },
                        { k: "mod_financeiro", Icon: IcoActivity, t: "Financeiro", d: "Painel de caixa e faturas." },
                        { k: "mod_crm", Icon: IcoFunnel, t: "CRM", d: "Funil de vendas + WhatsApp." },
                      ].map(({ k, Icon, t, d }) => (
                        <label key={k} className="toggle-card" style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
                          <div className="icon-box sm"><Icon width={16} height={16} /></div>
                          <div style={{ flex: 1 }}>
                            <div className="tc-title" style={{ marginTop: 0 }}>{t}</div>
                            <div className="tc-desc">{d}</div>
                          </div>
                          <span className="switch">
                            <input type="checkbox" name={k} checked={f[k as keyof F] as boolean} onChange={(e) => set(k as keyof F, e.target.checked as never)} />
                            <span className="track" />
                          </span>
                        </label>
                      ))}
                    </div>

                    {/* STEP 4 */}
                    <div style={{ display: step === 4 ? "block" : "none" }}>
                      <h3>Domínio do hub</h3>
                      <p>O endereço onde os clientes deste hub entram — login e tema já na cara da marca.</p>
                      <label htmlFor="dominio">Domínio</label>
                      <input id="dominio" name="dominio" value={f.dominio} onChange={(e) => set("dominio", e.target.value)} placeholder="meuhub.enderecodigital.com" />
                      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Deixe vazio pra configurar depois — dá pra usar o hub por dentro do console mesmo sem domínio.</div>
                      <div className="card glass-soft" style={{ marginTop: 14, fontSize: 12.5, lineHeight: 1.6 }}>
                        <strong>Como publicar (rápido):</strong>
                        <div className="muted" style={{ marginTop: 6 }}>1. No painel do domínio, crie o subdomínio e aponte pro IP do servidor.</div>
                        <div className="muted">2. O mesmo deploy atende todos os hubs; a marca certa aparece pelo domínio.</div>
                        <div className="muted">3. O SSL sai automático. O login já abre com a cara do hub.</div>
                      </div>
                    </div>

                    {/* STEP 5 */}
                    <div style={{ display: step === 5 ? "block" : "none" }}>
                      <h3>Revisão</h3>
                      <p>Confira tudo — depois de criado, só o slug não muda.</p>
                      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                        <div className="rev-row"><span className="k">Nome</span><span>{f.nome || "—"}</span></div>
                        <div className="rev-row"><span className="k">Slug</span><span>{f.slug || "—"}</span></div>
                        <div className="rev-row"><span className="k">Versão</span><span>{f.versao}</span></div>
                        <div className="rev-row"><span className="k">Domínio</span><span>{f.dominio || "Configurar depois"}</span></div>
                        <div className="rev-row"><span className="k">Tema</span><span>{temaLabel}</span></div>
                        <div className="rev-row"><span className="k">Destaque</span><span>{f.cor_destaque}</span></div>
                        <div className="rev-row"><span className="k">Tipografia</span><span>{f.tipografia}</span></div>
                        <div className="rev-row"><span className="k">Módulos</span><span>{modsLabel}</span></div>
                      </div>
                    </div>
                  </div>

                  <div className="wiz-preview">
                    <div className="wiz-prev-label">Prévia ao vivo</div>
                    <Mock f={f} />
                    <div className="wiz-prev-note">Amostra fiel do workspace do cliente: menu superior, cards e botão com o tema escolhido. O login e o app inteiro seguem a mesma identidade.</div>
                  </div>
                </div>
              </div>

              <div className="modal-foot">
                {step > 1 && (
                  <button type="button" className="btn btn-ghost" onClick={() => setStep(step - 1)}>Voltar</button>
                )}
                <div style={{ marginLeft: "auto" }}>
                  {step < 5 ? (
                    <button type="button" className="btn" onClick={() => setStep(step + 1)}>Avançar</button>
                  ) : (
                    <button type="submit" className="btn">Criar hub</button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
