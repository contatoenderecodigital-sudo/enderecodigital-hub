import Link from "@/components/link";
import PageHead from "@/components/page-head";
import { listModelos, modelosResumo } from "@/lib/platform-config";
import { novoModeloAction, excluirModeloAction } from "@/app/owner/actions";
import { hubOpId } from "@/lib/hub-ctx";
import { IcoGrid, IcoPlus, IcoExternal, IcoTrash } from "@/components/icons";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "post", label: "Post" },
  { key: "carrossel", label: "Carrossel" },
  { key: "story", label: "Story" },
];

export default async function ModelosPage({ searchParams }: { searchParams: Promise<{ t?: string; ok?: string }> }) {
  const sp = await searchParams;
  const tipo = TABS.some((t) => t.key === sp.t) ? sp.t! : "post";
  const hub = await hubOpId();
  const [modelos, resumo] = await Promise.all([
    hub ? listModelos(tipo) : Promise.resolve([]),
    hub ? modelosResumo() : Promise.resolve({ post: 0, carrossel: 0, story: 0, total: 0 }),
  ]);

  return (
    <>
      <PageHead
        eyebrow="Plataforma"
        titulo="Modelos padrão"
        sub="Biblioteca de design do hub — o que você subir aqui aparece no gerador de todos os clientes."
      />

      {sp.ok && <div className="owner-banner" style={{ borderRadius: 12, marginBottom: 16 }}>Modelo adicionado.</div>}

      {!hub ? (
        <div className="err">Entre em um hub para gerenciar a biblioteca de modelos dele.</div>
      ) : (
        <>
          <div className="cols-4" style={{ marginBottom: 18 }}>
            <div className="card"><div className="kpi">{resumo.total}</div><div className="kpi-label">Modelos no total</div></div>
            <div className="card"><div className="kpi">{resumo.post}</div><div className="kpi-label">Post</div></div>
            <div className="card"><div className="kpi">{resumo.carrossel}</div><div className="kpi-label">Carrossel</div></div>
            <div className="card"><div className="kpi">{resumo.story}</div><div className="kpi-label">Story</div></div>
          </div>

          {/* tabs Post / Carrossel / Story */}
          <div className="row" style={{ gap: 4, background: "rgba(0,0,0,0.22)", border: "1px solid var(--line)", borderRadius: 12, padding: 4, width: "fit-content", marginBottom: 16 }}>
            {TABS.map((t) => (
              <Link key={t.key} href={`/owner/modelos?t=${t.key}`}
                className={"wsnav-tab" + (tipo === t.key ? " active" : "")}
                style={{ padding: "7px 14px", textDecoration: "none" }}>
                {t.label}
              </Link>
            ))}
          </div>

          <details className="card" style={{ marginBottom: 18 }}>
            <summary style={{ cursor: "pointer", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              <IcoPlus width={16} height={16} /> Adicionar modelo de {TABS.find((t) => t.key === tipo)?.label}
            </summary>
            <form action={novoModeloAction} className="cols-2" style={{ gap: 12, marginTop: 14 }}>
              <input type="hidden" name="tipo" value={tipo} />
              <div><label>Nome *</label><input name="nome" required placeholder="Ex.: Promoção sexta" /></div>
              <div><label>Nicho</label><input name="nicho" placeholder="Ex.: padaria, estética" /></div>
              <div><label>Link (Canva / referência)</label><input name="link_url" placeholder="https://" /></div>
              <div><label>Thumbnail (URL da imagem)</label><input name="thumb_url" placeholder="https://" /></div>
              <div style={{ gridColumn: "1 / -1" }}><button className="btn" type="submit"><IcoPlus width={15} height={15} /> Adicionar</button></div>
            </form>
            <p className="muted" style={{ fontSize: 12.5, margin: "12px 0 0", lineHeight: 1.6 }}>
              Conecte modelos por nicho. No workspace do cliente ele busca, clica <strong>Implantar</strong> e o design vira base editável. A mesma biblioteca serve todos os clientes do hub.
            </p>
          </details>

          {modelos.length === 0 ? (
            <div className="card" style={{ display: "grid", placeItems: "center", padding: 48, textAlign: "center" }}>
              <div className="icon-box" style={{ width: 52, height: 52 }}><IcoGrid width={24} height={24} /></div>
              <strong style={{ marginTop: 14 }}>Nenhum modelo de {TABS.find((t) => t.key === tipo)?.label} ainda</strong>
              <p className="muted" style={{ margin: "4px 0 0" }}>Adicione o primeiro pelo formulário acima.</p>
            </div>
          ) : (
            <div className="cols-4">
              {modelos.map((m) => (
                <div key={m.id} className="card" style={{ padding: 0, overflow: "hidden" }}>
                  <div style={{ aspectRatio: "4/5", display: "grid", placeItems: "center", background: "rgba(0,0,0,0.22)" }}>
                    {m.thumb_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.thumb_url} alt={m.nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div className="icon-box"><IcoGrid width={18} height={18} /></div>
                    )}
                  </div>
                  <div style={{ padding: 12 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{m.nome}</div>
                    {m.nicho && <div className="muted" style={{ fontSize: 11.5 }}>{m.nicho}</div>}
                    <div className="row" style={{ gap: 8, marginTop: 10 }}>
                      {m.link_url && <a className="btn btn-ghost btn-sm" href={m.link_url} target="_blank" rel="noreferrer"><IcoExternal width={13} height={13} /> Abrir</a>}
                      <form action={excluirModeloAction} style={{ marginLeft: "auto" }}>
                        <input type="hidden" name="id" value={m.id} />
                        <button className="dots-btn" type="submit" aria-label="Excluir"><IcoTrash width={15} height={15} /></button>
                      </form>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
