"use client";

import { useState } from "react";
import {
  IcoInstagram,
  IcoGrid,
  IcoActivity,
  IcoExternal,
  IcoSparkles,
  IcoSend,
  IcoLock,
  IcoBell,
} from "@/components/icons";

type Sub = "perfil" | "gerador" | "metricas";

const POSTS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const VOLUME = [7, 12, 15, 9, 16, 11, 13, 10, 16, 8, 12, 14, 6, 11, 9, 13, 15, 7, 10, 12];
const TOP = [
  { t: "Post que mais engajou no período", data: "há 3 semanas", l: "28.4K", c: 173 },
  { t: "Bastidores da equipe", data: "há 1 mês", l: "2.8K", c: 11 },
  { t: "Prova social de cliente", data: "há 2 meses", l: "235", c: 1 },
];

function Badge({ conectado }: { conectado: boolean }) {
  return (
    <span className={"badge " + (conectado ? "gold" : "warn")} style={{ gap: 6 }}>
      {conectado ? <IcoInstagram width={13} height={13} /> : <IcoLock width={13} height={13} />}
      {conectado ? "API conectada" : "API não conectada"}
    </span>
  );
}

export default function InstagramClient({
  nome,
  cor,
  instagramUrl,
}: {
  nome: string;
  cor: string;
  instagramUrl: string | null;
}) {
  const [sub, setSub] = useState<Sub>("perfil");
  const conectado = false; // liga quando o token da Graph API for salvo em Config. do cliente
  const handle = instagramUrl
    ? instagramUrl.replace(/https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/$/, "")
    : nome.toLowerCase().replace(/\s+/g, "");

  return (
    <>
      <div className="spread" style={{ alignItems: "flex-start" }}>
        <div>
          <div className="eyebrow"><IcoInstagram width={14} height={14} /> Social</div>
          <h1 style={{ margin: "6px 0 0" }}>Instagram</h1>
        </div>
        <Badge conectado={conectado} />
      </div>

      <div className="subtabs" style={{ marginTop: 16 }}>
        <button className={"subtab" + (sub === "perfil" ? " active" : "")} onClick={() => setSub("perfil")}>
          <IcoInstagram width={15} height={15} /> Perfil
        </button>
        <button className={"subtab" + (sub === "gerador" ? " active" : "")} onClick={() => setSub("gerador")}>
          <IcoGrid width={15} height={15} /> Gerador de conteúdo
        </button>
        <button className={"subtab" + (sub === "metricas" ? " active" : "")} onClick={() => setSub("metricas")}>
          <IcoActivity width={15} height={15} /> Métricas
        </button>
      </div>

      {!conectado && (
        <div className="card glass-soft" style={{ marginTop: 14, fontSize: 13, lineHeight: 1.6 }}>
          <strong>Prévia.</strong> Conecte a conta pela <em>Graph API oficial da Meta</em> (token por cliente,
          em Config. do cliente) para puxar perfil, publicações, curtidas e métricas reais. Abaixo, a estrutura da tela.
        </div>
      )}

      {sub === "perfil" && <Perfil nome={nome} cor={cor} handle={handle} instagramUrl={instagramUrl} />}
      {sub === "gerador" && <Gerador />}
      {sub === "metricas" && <Metricas />}
    </>
  );
}

/* ---------- PERFIL ---------- */
function Perfil({
  nome,
  cor,
  handle,
  instagramUrl,
}: {
  nome: string;
  cor: string;
  handle: string;
  instagramUrl: string | null;
}) {
  const [filtro, setFiltro] = useState<"todos" | "fotos" | "carros">("todos");
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="row" style={{ gap: 22, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div
          className="avatar"
          style={{ width: 96, height: 96, fontSize: 30, background: cor, flexShrink: 0, borderRadius: "50%" }}
        >
          {nome.slice(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
            <strong style={{ fontSize: 18 }}>@{handle}</strong>
            {instagramUrl && (
              <a className="btn btn-ghost btn-sm" href={instagramUrl} target="_blank" rel="noreferrer">
                <IcoExternal width={14} height={14} /> Abrir no Instagram
              </a>
            )}
          </div>
          <div className="row" style={{ gap: 22, marginTop: 12, flexWrap: "wrap" }}>
            <span><strong>—</strong> <span className="muted">publicações</span></span>
            <span><strong>—</strong> <span className="muted">seguidores</span></span>
            <span><strong>—</strong> <span className="muted">seguindo</span></span>
          </div>
          <p className="muted" style={{ margin: "12px 0 0", fontSize: 13.5, lineHeight: 1.6 }}>
            {nome}<br />
            Bio e destaques aparecem aqui assim que a API for conectada.
          </p>
        </div>
      </div>

      <div className="spread" style={{ marginTop: 22, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
        <div className="subtabs" style={{ border: "none", background: "none", padding: 0 }}>
          {(["todos", "fotos", "carros"] as const).map((f) => (
            <button key={f} className={"pill" + (filtro === f ? " gold" : "")} style={filtro === f ? { color: "#14151a", background: "linear-gradient(135deg,var(--gold),var(--gold-l))", borderColor: "transparent" } : undefined} onClick={() => setFiltro(f)}>
              {f === "todos" ? "Todos" : f === "fotos" ? "Fotos" : "Carrosséis"}
            </button>
          ))}
        </div>
      </div>

      <div className="ig-grid" style={{ marginTop: 14 }}>
        {POSTS.map((i) => (
          <div key={i} className="ig-post">
            <IcoInstagram width={24} height={24} style={{ opacity: 0.4 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- GERADOR ---------- */
const G_TABS = ["Post", "Carrossel", "Story", "Agendados", "Modelos"];
function Gerador() {
  const [g, setG] = useState("Post");
  return (
    <div style={{ marginTop: 16 }}>
      <div className="subtabs" style={{ marginBottom: 14 }}>
        {G_TABS.map((t) => (
          <button key={t} className={"subtab" + (g === t ? " active" : "")} onClick={() => setG(t)}>{t}</button>
        ))}
      </div>

      <div className="cols-2" style={{ gap: 16, alignItems: "stretch" }}>
        {/* conversa / briefing */}
        <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: 420 }}>
          <div className="eyebrow">Nova conversa</div>
          <div style={{ flex: 1, display: "grid", placeItems: "center", textAlign: "center", padding: "20px 0" }}>
            <div>
              <div className="icon-box" style={{ width: 52, height: 52, margin: "0 auto 12px" }}>
                <IcoGrid width={24} height={24} />
              </div>
              <strong style={{ fontSize: 16 }}>Criar {g.toLowerCase()}</strong>
              <p className="muted" style={{ margin: "6px auto 0", maxWidth: 300, fontSize: 13 }}>
                Descreva o que quer criar. Escolha um modelo da biblioteca ou deixe o Claude decidir o estilo.
              </p>
            </div>
          </div>
          <div className="chat-input" style={{ margin: 0, maxWidth: "none" }}>
            <IcoGrid width={16} height={16} style={{ opacity: 0.7 }} />
            <input placeholder="Selecione um modelo para começar…" readOnly />
            <button className="btn" style={{ padding: "8px 12px" }}><IcoSend width={16} height={16} /></button>
          </div>
        </div>

        {/* preview */}
        <div className="card" style={{ display: "grid", placeItems: "center", textAlign: "center", minHeight: 420, background: "rgba(0,0,0,0.22)" }}>
          <div>
            <div className="icon-box" style={{ width: 52, height: 52, margin: "0 auto 12px" }}>
              <IcoInstagram width={24} height={24} />
            </div>
            <strong style={{ fontSize: 16 }}>Preview do {g.toLowerCase()}</strong>
            <p className="muted" style={{ margin: "6px auto 0", maxWidth: 320, fontSize: 13 }}>
              Descreva no chat o que você quer. Quando o post ficar pronto, ele aparece aqui pra você ver,
              simular no Instagram e finalizar.
            </p>
          </div>
        </div>
      </div>

      <div className="card glass-soft" style={{ marginTop: 14, fontSize: 12.5, lineHeight: 1.6 }}>
        <strong>Como funciona.</strong> Conecte uma pasta de modelos (Canva) por nicho no console. O cliente escolhe,
        clica <em>Implantar</em> e o design vira HTML editável em camadas — sem custo. Edição manual ou com IA
        (consome o token do cliente); postagem direto via API. A mesma biblioteca serve todos os clientes.
      </div>
    </div>
  );
}

/* ---------- MÉTRICAS ---------- */
function K({ n, label, sub }: { n: string; label: string; sub?: string }) {
  return (
    <div className="card">
      <div className="kpi">{n}</div>
      <div className="kpi-label">{label}</div>
      {sub && <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
function Metricas() {
  return (
    <div style={{ marginTop: 16 }}>
      <div className="cols-4">
        <K n="—" label="Seguidores" />
        <K n="—" label="Curtidas (total)" />
        <K n="—" label="Comentários" />
        <K n="—" label="Engajamento" />
      </div>
      <div className="cols-4" style={{ marginTop: 14 }}>
        <K n="—" label="Média curtidas / post" />
        <K n="—" label="Média comentários / post" />
        <K n="—" label="Pico de curtidas" />
        <K n="—" label="Posts analisados" />
      </div>

      <div className="card glass-soft" style={{ marginTop: 14, fontSize: 12.5, lineHeight: 1.6 }}>
        <span className="row" style={{ gap: 8 }}>
          <IcoActivity width={15} height={15} />
          Visualizações e alcance por post ficam disponíveis quando a conta for Business/Creator com permissão de
          insights — dados garantidos pela API. As barras abaixo são ilustrativas.
        </span>
      </div>

      <div className="cols-2" style={{ marginTop: 14, gap: 16 }}>
        <div className="card">
          <div className="eyebrow">Volume de posts</div>
          <div className="bars" style={{ marginTop: 14 }}>
            {VOLUME.map((v, i) => (
              <div key={i} className="bar" style={{ height: `${(v / 16) * 100}%` }} />
            ))}
          </div>
        </div>
        <div className="card">
          <div className="eyebrow">Distribuição por tipo</div>
          <div className="row" style={{ gap: 22, marginTop: 18, alignItems: "center" }}>
            <div
              style={{
                width: 120,
                height: 120,
                borderRadius: "50%",
                background: "conic-gradient(var(--gold) 0 46%, var(--copper-l) 46% 72%, var(--gold-l) 72% 100%)",
                display: "grid",
                placeItems: "center",
              }}
            >
              <div style={{ width: 66, height: 66, borderRadius: "50%", background: "var(--navy-d)" }} />
            </div>
            <div style={{ display: "grid", gap: 8, fontSize: 13 }}>
              <span className="row" style={{ gap: 8 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: "var(--gold)" }} /> Fotos</span>
              <span className="row" style={{ gap: 8 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: "var(--copper-l)" }} /> Carrosséis</span>
              <span className="row" style={{ gap: 8 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: "var(--gold-l)" }} /> Reels</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Top posts por curtidas</div>
        {TOP.map((p, i) => (
          <div key={i} className="list-row">
            <span className="rank">{i + 1}</span>
            <div className="list-thumb"><IcoInstagram width={18} height={18} style={{ opacity: 0.5 }} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{p.t}</div>
              <div className="muted" style={{ fontSize: 12 }}>{p.data}</div>
            </div>
            <div className="row muted" style={{ gap: 14, fontSize: 12.5 }}>
              <span className="row" style={{ gap: 5 }}><IcoSparkles width={13} height={13} /> {p.l}</span>
              <span className="row" style={{ gap: 5 }}><IcoBell width={13} height={13} /> {p.c}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
