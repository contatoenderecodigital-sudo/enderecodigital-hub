import PageHead from "@/components/page-head";
import { aprovacoesPendentes } from "@/lib/ops";
import { blogStatusAction, conteudoStatusAction } from "../actions";
import { IcoGlobe, IcoInstagram, IcoWhatsapp, IcoShield } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function AprovacoesPage() {
  const { blog, social, campanhas } = await aprovacoesPendentes();
  const total = blog.length + social.length + campanhas.length;

  return (
    <>
      <PageHead eyebrow="Agência · GROOW OS" titulo="Aprovações" sub="Tudo que espera o seu OK, num lugar só — blog, conteúdo social e campanhas." />

      {total === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <div className="icon-box" style={{ width: 52, height: 52, margin: "0 auto 12px" }}><IcoShield width={24} height={24} /></div>
          <strong style={{ fontSize: 16 }}>Tudo aprovado</strong>
          <p className="muted" style={{ margin: "4px 0 0" }}>Nenhum rascunho ou campanha esperando você.</p>
        </div>
      ) : (
        <>
          {blog.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="eyebrow" style={{ marginBottom: 12 }}><IcoGlobe width={13} height={13} /> Blog — {blog.length} rascunho(s)</div>
              {blog.map((b, i) => (
                <div key={b.id} className="spread" style={{ padding: "11px 0", borderTop: i ? "1px solid var(--line)" : "none" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{b.titulo}</div>
                    {b.keyword_foco && <div className="muted" style={{ fontSize: 12 }}>foco: {b.keyword_foco}</div>}
                  </div>
                  <form action={blogStatusAction}>
                    <input type="hidden" name="id" value={b.id} /><input type="hidden" name="status" value="aprovado" />
                    <button className="btn btn-sm" type="submit">Aprovar</button>
                  </form>
                </div>
              ))}
            </div>
          )}

          {social.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="eyebrow" style={{ marginBottom: 12 }}><IcoInstagram width={13} height={13} /> Conteúdo social — {social.length}</div>
              {social.map((s, i) => (
                <div key={s.id} className="spread" style={{ padding: "11px 0", borderTop: i ? "1px solid var(--line)" : "none" }}>
                  <div className="row" style={{ gap: 10 }}>
                    <span className="badge gold" style={{ fontSize: 10 }}>{s.tipo}</span>
                    <span style={{ fontWeight: 600 }}>{s.titulo}</span>
                  </div>
                  <form action={conteudoStatusAction}>
                    <input type="hidden" name="id" value={s.id} /><input type="hidden" name="status" value="aprovado" />
                    <button className="btn btn-sm" type="submit">Aprovar</button>
                  </form>
                </div>
              ))}
            </div>
          )}

          {campanhas.length > 0 && (
            <div className="card">
              <div className="eyebrow" style={{ marginBottom: 12 }}><IcoWhatsapp width={13} height={13} /> Campanhas WhatsApp — {campanhas.length}</div>
              {campanhas.map((c, i) => (
                <div key={c.id} className="spread" style={{ padding: "11px 0", borderTop: i ? "1px solid var(--line)" : "none" }}>
                  <span style={{ fontWeight: 600 }}>{c.nome}</span>
                  <span className="muted" style={{ fontSize: 12.5 }}>{c.total} destinatários</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
