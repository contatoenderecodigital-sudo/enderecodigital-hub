import PageHead from "@/components/page-head";
import { IcoGrid } from "@/components/icons";

export const dynamic = "force-dynamic";

const TIPOS = ["Post", "Carrossel", "Story"];

export default function ModelosPage() {
  return (
    <>
      <PageHead
        eyebrow="Plataforma"
        titulo="Modelos"
        sub="Biblioteca compartilhada de modelos de conteúdo (uma pasta serve todos os clientes)."
        acao={<button className="btn">Conectar pasta</button>}
      />

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="row" style={{ gap: 12 }}>
          <div className="icon-box"><IcoGrid width={18} height={18} /></div>
          <div>
            <strong>Como funciona</strong>
            <p className="muted" style={{ margin: "2px 0 0" }}>
              Conecte uma pasta de modelos (Canva) por nicho. No workspace do cliente, ele busca por nicho e clica
              <strong> Implantar</strong> — o design vira HTML editável em camadas, sem custo. A mesma pasta serve todos.
            </p>
          </div>
        </div>
      </div>

      {TIPOS.map((t) => (
        <div key={t} style={{ marginBottom: 18 }}>
          <div className="spread" style={{ marginBottom: 10 }}>
            <h2 style={{ margin: 0, fontSize: 17 }}>{t}</h2>
            <span className="badge">Fase 3</span>
          </div>
          <div className="cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card" style={{ aspectRatio: t === "Story" ? "9/16" : "1/1", display: "grid", placeItems: "center" }}>
                <span className="muted" style={{ fontSize: 12 }}>modelo {i}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
