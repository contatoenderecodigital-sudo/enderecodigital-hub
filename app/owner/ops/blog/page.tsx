import Link from "@/components/link";
import PageHead from "@/components/page-head";
import { listBlogPosts, blogResumo } from "@/lib/ops";
import { blogStatusAction } from "../actions";
import { IcoGlobe, IcoSparkles } from "@/components/icons";

export const dynamic = "force-dynamic";

const goldPill = { color: "#14151a", background: "linear-gradient(135deg,var(--gold),var(--gold-l))", borderColor: "transparent" } as const;
const COR: Record<string, string> = { publicado: "ok", aprovado: "gold", rascunho: "", arquivado: "" };

function proximo(status: string) {
  if (status === "rascunho") return { to: "aprovado", label: "Aprovar" };
  if (status === "aprovado") return { to: "publicado", label: "Publicar" };
  if (status === "publicado") return { to: "arquivado", label: "Tirar do ar" };
  return { to: "rascunho", label: "Reabrir" };
}

export default async function BlogPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const [posts, r] = await Promise.all([listBlogPosts(sp.status), blogResumo()]);

  return (
    <>
      <PageHead
        eyebrow="Agência · GROOW OS"
        titulo="Blog SEO"
        sub="A IA escreve, você aprova, o Google indexa. Conteúdo local que traz busca orgânica."
        acao={<button className="btn" disabled title="Precisa de crédito na Anthropic"><IcoSparkles width={15} height={15} /> Gerar artigo</button>}
      />

      <div className="cols-3">
        <div className="card"><div className="kpi">{r.total}</div><div className="kpi-label">Artigos</div></div>
        <div className="card"><div className="kpi" style={{ color: "var(--ok)" }}>{r.publicados}</div><div className="kpi-label">Publicados</div></div>
        <div className="card"><div className="kpi">{r.rascunhos}</div><div className="kpi-label">Rascunhos</div></div>
      </div>

      <div className="row" style={{ gap: 6, marginTop: 16, flexWrap: "wrap" }}>
        <Link href="/owner/ops/blog" className="pill" style={!sp.status ? goldPill : undefined}>Todos</Link>
        {["rascunho", "aprovado", "publicado", "arquivado"].map((s) => (
          <Link key={s} href={`/owner/ops/blog?status=${s}`} className="pill" style={sp.status === s ? goldPill : undefined}>{s}</Link>
        ))}
      </div>

      {posts.length === 0 ? (
        <div className="card" style={{ marginTop: 14, textAlign: "center", padding: 44 }}><p className="muted" style={{ margin: 0 }}>Nenhum artigo aqui.</p></div>
      ) : (
        <div className="cols-2" style={{ marginTop: 14 }}>
          {posts.map((p) => {
            const nxt = proximo(p.status);
            return (
              <div key={p.id} className="card">
                <div className="spread">
                  <span className={"badge " + (COR[p.status] || "")}>{p.status}</span>
                  <span className="muted" style={{ fontSize: 11.5 }}>{p.origem === "ia" ? "gerado por IA" : "manual"} · {p.categoria}</span>
                </div>
                <h2 style={{ fontSize: 16, margin: "10px 0 4px" }}>{p.titulo}</h2>
                <p className="muted" style={{ fontSize: 13, margin: 0, lineHeight: 1.55 }}>{p.resumo}</p>
                {p.keyword_foco && <div style={{ marginTop: 10 }}><span className="badge" style={{ fontSize: 10 }}>foco: {p.keyword_foco}</span></div>}
                <div className="row" style={{ gap: 8, marginTop: 14 }}>
                  <form action={blogStatusAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="status" value={nxt.to} />
                    <button className="btn btn-sm" type="submit">{nxt.label}</button>
                  </form>
                  {p.status === "publicado" && (
                    <a className="btn btn-ghost btn-sm" href={`/blog/${p.slug}`} target="_blank" rel="noreferrer"><IcoGlobe width={13} height={13} /> Ver</a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
