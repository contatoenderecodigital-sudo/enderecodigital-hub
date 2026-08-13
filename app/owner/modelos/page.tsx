import PageHead from "@/components/page-head";
import { IcoGrid, IcoPlus, IcoServer, IcoSearch } from "@/components/icons";

export const dynamic = "force-dynamic";

export default function ModelosPage() {
  return (
    <>
      <PageHead
        eyebrow="Plataforma"
        titulo="Modelos padrão"
        sub="Modelos universais do hub — o que você subir aqui aparece no gerador de todos os clientes."
        acao={
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-ghost"><IcoServer width={15} height={15} /> Sincronizar</button>
            <button className="btn"><IcoPlus width={15} height={15} /> Adicionar modelo</button>
          </div>
        }
      />

      {/* tabs Post / Carrossel / Story */}
      <div className="row" style={{ gap: 4, background: "rgba(0,0,0,0.22)", border: "1px solid var(--line)", borderRadius: 12, padding: 4, width: "fit-content", marginBottom: 16 }}>
        <span className="wsnav-tab active" style={{ padding: "7px 14px" }}>Post</span>
        <span className="wsnav-tab" style={{ padding: "7px 14px" }}>Carrossel</span>
        <span className="wsnav-tab" style={{ padding: "7px 14px" }}>Story</span>
      </div>

      {/* Canva → modelos do hub */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Canva → modelos do hub</div>
        <div className="spread glass-soft" style={{ borderRadius: 11, padding: "11px 14px" }}>
          <div className="row" style={{ gap: 10 }}>
            <div className="icon-box sm"><IcoGrid width={16} height={16} /></div>
            <span style={{ fontSize: 13.5 }}>Biblioteca: <strong>nenhuma pasta conectada</strong></span>
          </div>
          <button className="btn btn-ghost btn-sm">Conectar pasta</button>
        </div>
        <div className="search-box" style={{ marginTop: 12 }}>
          <IcoSearch width={16} height={16} />
          <input placeholder="Pesquisar por nicho, tema, referência…" />
        </div>
        <p className="muted" style={{ fontSize: 12.5, margin: "12px 0 0", lineHeight: 1.6 }}>
          Conecte uma pasta de modelos (Canva) por nicho. No workspace do cliente ele busca, clica <strong>Implantar</strong> e o
          design vira HTML editável em camadas, sem custo. A mesma pasta serve todos os clientes.
        </p>
      </div>

      {/* grid de modelos (placeholder) */}
      <div className="cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card" style={{ aspectRatio: "4/5", display: "grid", placeItems: "center", padding: 0 }}>
            <div style={{ textAlign: "center", color: "var(--muted)" }}>
              <div className="icon-box" style={{ margin: "0 auto" }}><IcoGrid width={18} height={18} /></div>
              <div style={{ fontSize: 12, marginTop: 8 }}>modelo {i}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
