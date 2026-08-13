"use client";

import { useState } from "react";
import { IcoGlobe, IcoExternal, IcoActivity, IcoShield, IcoLock } from "@/components/icons";

type Sub = "site" | "info" | "saude";

export default function SiteClient({
  nome,
  url,
  dominio,
}: {
  nome: string;
  url: string | null;
  dominio: string | null;
}) {
  const [sub, setSub] = useState<Sub>("site");
  const host = url ? url.replace(/https?:\/\//, "").replace(/\/$/, "") : dominio || "—";
  const https = !!url && url.startsWith("https://");

  return (
    <>
      <div className="spread" style={{ alignItems: "flex-start" }}>
        <div>
          <div className="eyebrow"><IcoGlobe width={14} height={14} /> Presença</div>
          <h1 style={{ margin: "6px 0 0" }}>Meu site</h1>
        </div>
        {url && (
          <a className="btn btn-ghost btn-sm" href={url} target="_blank" rel="noreferrer">
            <IcoExternal width={14} height={14} /> Abrir em nova aba
          </a>
        )}
      </div>

      <div className="subtabs" style={{ marginTop: 16 }}>
        <button className={"subtab" + (sub === "site" ? " active" : "")} onClick={() => setSub("site")}>
          <IcoGlobe width={15} height={15} /> Site
        </button>
        <button className={"subtab" + (sub === "info" ? " active" : "")} onClick={() => setSub("info")}>
          <IcoActivity width={15} height={15} /> Informações do site
        </button>
        <button className={"subtab" + (sub === "saude" ? " active" : "")} onClick={() => setSub("saude")}>
          <IcoShield width={15} height={15} /> Saúde &amp; Segurança
        </button>
      </div>

      {sub === "site" && (
        url ? (
          <div className="card" style={{ marginTop: 16, padding: 0, overflow: "hidden" }}>
            <div className="browser-chrome">
              <div className="browser-dots">
                <i style={{ background: "#f0605c" }} />
                <i style={{ background: "#f5bd4f" }} />
                <i style={{ background: "#61c554" }} />
              </div>
              <div className="browser-url">
                <IcoLock width={13} height={13} style={{ color: https ? "var(--ok)" : "var(--muted)" }} />
                <span>{host}</span>
              </div>
              <span className="badge gold" style={{ fontSize: 10 }}>produção em tempo real</span>
            </div>
            <iframe
              src={url}
              style={{ width: "100%", height: "68vh", border: "none", background: "#fff", display: "block" }}
              title={`Site de ${nome}`}
            />
          </div>
        ) : (
          <div className="card" style={{ marginTop: 16 }}>
            <p className="muted" style={{ margin: 0 }}>
              Nenhum site cadastrado. Adicione a URL do site no cadastro do cliente (ou em Config. do cliente).
            </p>
          </div>
        )
      )}

      {sub === "info" && (
        <div className="cols-2" style={{ marginTop: 16, gap: 16 }}>
          <div className="card">
            <div className="eyebrow">Endereço</div>
            <div style={{ fontWeight: 700, marginTop: 6 }}>{host}</div>
            <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
              {dominio ? `Domínio: ${dominio}` : "Domínio principal não definido"}
            </div>
          </div>
          <div className="card">
            <div className="eyebrow">Métricas de visita</div>
            <p className="muted" style={{ fontSize: 13, margin: "6px 0 0", lineHeight: 1.6 }}>
              Gere uma <strong>tag de acompanhamento própria</strong> (sem Google) em Config. do cliente e cole no
              &lt;head&gt; do site para ver visitas em tempo real aqui.
            </p>
          </div>
        </div>
      )}

      {sub === "saude" && (
        <div className="cols-3" style={{ marginTop: 16 }}>
          <div className="card">
            <div className="row" style={{ gap: 10 }}>
              <div className="icon-box sm"><IcoLock width={15} height={15} /></div>
              <strong>HTTPS</strong>
            </div>
            <div className={"badge " + (https ? "ok" : "warn")} style={{ marginTop: 12 }}>
              {https ? "certificado ativo" : url ? "sem https" : "sem site"}
            </div>
          </div>
          <div className="card">
            <div className="row" style={{ gap: 10 }}>
              <div className="icon-box sm"><IcoActivity width={15} height={15} /></div>
              <strong>Disponibilidade</strong>
            </div>
            <div className={"badge " + (url ? "ok" : "")} style={{ marginTop: 12 }}>
              {url ? "no ar" : "não publicado"}
            </div>
          </div>
          <div className="card">
            <div className="row" style={{ gap: 10 }}>
              <div className="icon-box sm"><IcoShield width={15} height={15} /></div>
              <strong>Monitoramento</strong>
            </div>
            <p className="muted" style={{ fontSize: 12.5, marginTop: 10, margin: "10px 0 0" }}>
              Checagem periódica de status e SSL — ativa junto com a tag de acompanhamento.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
