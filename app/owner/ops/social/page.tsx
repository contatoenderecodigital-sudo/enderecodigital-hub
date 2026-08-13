import PageHead from "@/components/page-head";
import { listSocialIdeias, listSocialConteudos, socialResumo } from "@/lib/ops";
import { descartarIdeiaAction } from "../actions";
import { IcoSparkles, IcoInstagram, IcoX } from "@/components/icons";

export const dynamic = "force-dynamic";

const TIPO: Record<string, string> = { reel: "Reel", carrossel: "Carrossel", story: "Story" };
const PILAR: Record<string, string> = {
  "captacao-local": "Captação local", "prova-autoridade": "Prova / autoridade",
  "vendas-whatsapp": "Vendas WhatsApp", "educacao-trafego": "Educação / tráfego",
};

export default async function SocialPage() {
  const [ideias, conteudos, r] = await Promise.all([listSocialIdeias(), listSocialConteudos(), socialResumo()]);

  return (
    <>
      <PageHead
        eyebrow="Agência · GROOW OS"
        titulo="Conteúdo Social"
        sub="Banco de ideias por pilar e os conteúdos gerados — reel, carrossel e story prontos pra postar."
        acao={<button className="btn" disabled title="Precisa de crédito na Anthropic"><IcoSparkles width={15} height={15} /> Gerar pauta</button>}
      />

      <div className="cols-3">
        <div className="card"><div className="kpi">{r.ideias}</div><div className="kpi-label">Ideias no banco</div></div>
        <div className="card"><div className="kpi">{r.conteudos}</div><div className="kpi-label">Conteúdos gerados</div></div>
        <div className="card"><div className="kpi" style={{ color: "var(--ok)" }}>{r.publicados}</div><div className="kpi-label">Publicados</div></div>
      </div>

      <h2 style={{ fontSize: 16, margin: "22px 0 12px" }}>Banco de ideias</h2>
      {ideias.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 40 }}><p className="muted" style={{ margin: 0 }}>Sem ideias. Gere uma pauta (precisa de crédito na Anthropic).</p></div>
      ) : (
        <div className="cols-3">
          {ideias.map((i) => (
            <div key={i.id} className="card">
              <div className="spread">
                <span className="badge gold" style={{ fontSize: 10 }}>{TIPO[i.tipo] || i.tipo}</span>
                <form action={descartarIdeiaAction}>
                  <input type="hidden" name="id" value={i.id} />
                  <button className="dots-btn" type="submit" aria-label="Descartar"><IcoX width={14} height={14} /></button>
                </form>
              </div>
              <div style={{ fontWeight: 700, fontSize: 14.5, marginTop: 10, lineHeight: 1.4 }}>{i.hook}</div>
              {i.descricao && <p className="muted" style={{ fontSize: 12.5, margin: "6px 0 0", lineHeight: 1.5 }}>{i.descricao}</p>}
              <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <span className="badge" style={{ fontSize: 10 }}>{PILAR[i.pilar] || i.pilar}</span>
                {i.formato && <span className="muted" style={{ fontSize: 11 }}>{i.formato}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {conteudos.length > 0 && (
        <>
          <h2 style={{ fontSize: 16, margin: "26px 0 12px" }}>Conteúdos gerados</h2>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {conteudos.map((c, idx) => (
              <div key={c.id} className="spread" style={{ padding: "13px 18px", borderTop: idx ? "1px solid var(--line)" : "none", gap: 12 }}>
                <div className="row" style={{ gap: 11, minWidth: 0 }}>
                  <div className="icon-box sm"><IcoInstagram width={15} height={15} /></div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{c.titulo}</div>
                    {c.legenda && <div className="muted" style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 460 }}>{c.legenda}</div>}
                  </div>
                </div>
                <div className="row" style={{ gap: 8, flexShrink: 0 }}>
                  <span className="badge" style={{ fontSize: 10 }}>{TIPO[c.tipo] || c.tipo}</span>
                  <span className={"badge " + (c.status === "publicado" ? "ok" : c.status === "aprovado" ? "gold" : "")}>{c.status}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
