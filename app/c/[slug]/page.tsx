import { notFound } from "next/navigation";
import { getLojaBySlug, montarCardapio } from "@/lib/food";
import "@/app/food-cliente.css";

// Cardapio de vitrine: /c/<slug>. E o link da bio do Instagram e do Google.
// Sem pedido: pedir e pela mesa (cartao) ou pelo /pedir.

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const loja = await getLojaBySlug(slug);
  return {
    title: loja ? `Cardapio - ${loja.nome}` : "Cardapio",
    description: loja
      ? `Cardapio do ${loja.nome}${loja.cidade ? ` em ${loja.cidade}` : ""}, com precos atualizados.`
      : undefined,
  };
}

const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default async function PaginaCardapio({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const loja = await getLojaBySlug(slug);
  if (!loja) notFound();
  const cardapio = await montarCardapio(loja.id, { canal: "mesa" });
  const cor = loja.cor_destaque || "#e8332a";
  const pedeOnline = loja.aceita_delivery || loja.aceita_retirada;

  return (
    <div className="fc" style={{ ["--fc-cor" as string]: cor, paddingBottom: pedeOnline ? 96 : 32 }}>
      <header className="fc-capa">
        <span className="fc-capa-sombra" />
        <div className="fc-topo fc-conteudo">
          {loja.logo_url
            ? <img src={loja.logo_url} alt="" className="fc-logo" />
            : <span className="fc-logo fc-logo-vazia">{loja.nome.slice(0, 1)}</span>}
          <div>
            <div className="fc-nome">{loja.nome}</div>
            <div className="fc-sub">
              {loja.endereco && <span>{loja.endereco}</span>}
              {loja.cidade && <span className="fc-pill">{loja.cidade}</span>}
            </div>
          </div>
        </div>
      </header>

      <div className="fc-conteudo">
        {cardapio.map((cat) => (
          <section key={cat.id} className="fc-secao">
            <h2>{cat.nome}</h2>
            {cat.descricao && <p>{cat.descricao}</p>}
            {cat.produtos.map((p) => (
              <article key={p.id} className={"fc-item" + (p.esgotado ? " off" : "")}>
                <span className="fc-item-txt">
                  <span className="fc-item-nome">{p.nome}</span>
                  {p.descricao && <span className="fc-item-desc">{p.descricao}</span>}
                  <span className="fc-item-preco">
                    {p.esgotado
                      ? "Esgotado hoje"
                      : p.variacoes.length
                        ? money(Math.min(...p.variacoes.map((v) => Number(v.preco))))
                        : money(Number(p.preco_promo ?? p.preco))}
                  </span>
                </span>
                {p.imagem_url && <img src={p.imagem_url} alt="" className="fc-item-foto" />}
              </article>
            ))}
          </section>
        ))}

        {!cardapio.length && <div className="fc-vazio">Cardapio em montagem.</div>}
      </div>

      {pedeOnline && (
        <div className="fc-barra">
          <a className="fc-btn" href={`/c/${loja.slug}/pedir`} style={{ textDecoration: "none" }}>
            Pedir online
          </a>
        </div>
      )}
    </div>
  );
}
