import Link from "@/components/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getNegocio, getHub } from "@/lib/data";
import { modulosEfetivos } from "@/lib/types";
import { activeNegocioId } from "@/lib/tenant";
import { emReais } from "@/lib/agenda";
import {
  listarMovimentos, listarProdutos, type MovimentoProduto, type ProdutoAgenda,
} from "@/lib/agenda-produtos";
import {
  acaoArquivarProduto, acaoAtualizarProduto, acaoCriarProduto, acaoMovimentarEstoque,
} from "./acoes";

export const dynamic = "force-dynamic";

export default async function PainelProdutos({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string }>;
}) {
  const { aviso } = await searchParams;
  const sessao = await getSession();
  if (!sessao) redirect("/login");
  const negocioId = activeNegocioId(sessao);
  if (!negocioId) redirect("/owner");
  const negocio = await getNegocio(negocioId);
  if (!negocio) redirect("/login");
  const hub = await getHub(negocio.hub_id);
  if (!hub || !modulosEfetivos(negocio, hub).agenda) redirect("/painel");

  const [produtos, movimentos] = await Promise.all([
    listarProdutos(negocioId),
    listarMovimentos(negocioId, 60),
  ]);
  const estoqueBaixo = produtos.filter((p) => p.estoque <= p.estoque_minimo).length;
  const valorEmEstoque = produtos.reduce((total, p) => total + Math.round(p.estoque * p.custo_cent), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>Produtos e estoque</h1>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: "6px 0 0", maxWidth: 680 }}>
            Catálogo, saldo e histórico de cada entrada ou saída. O saldo nunca é editado diretamente.
          </p>
        </div>
        <Link href="/painel/vendas" style={botaoPrimario}>Nova venda avulsa</Link>
      </header>

      {aviso ? <Aviso texto={aviso} /> : null}

      <section aria-label="Resumo do estoque" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
        <Resumo rotulo="Produtos ativos" valor={String(produtos.length)} />
        <Resumo rotulo="Atenção no saldo" valor={String(estoqueBaixo)} destaque={estoqueBaixo > 0} />
        <Resumo rotulo="Custo em estoque" valor={emReais(valorEmEstoque)} />
      </section>

      <section style={cartao}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Catálogo</h2>
          <span style={{ color: "var(--muted)", fontSize: 12.5 }}>Abra um item para editar ou movimentar</span>
        </div>
        {produtos.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 13.5, margin: "16px 0 2px" }}>
            Nenhum produto cadastrado. Cadastre o primeiro item abaixo para começar o controle.
          </p>
        ) : (
          <div style={{ marginTop: 14 }}>
            {produtos.map((produto) => (
              <LinhaProduto key={produto.id} produto={produto} />
            ))}
          </div>
        )}
      </section>

      <details style={cartao} open={produtos.length === 0}>
        <summary style={sumario}>+ Cadastrar produto</summary>
        <form action={acaoCriarProduto} style={{ marginTop: 18 }}>
          <CamposProduto novo />
          <button type="submit" style={{ ...botaoPrimario, marginTop: 16 }}>Cadastrar produto</button>
        </form>
      </details>

      <section style={cartao}>
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Últimos movimentos</h2>
        <p style={{ color: "var(--muted)", fontSize: 13, margin: "5px 0 0" }}>
          Registro de auditoria. Correções geram um novo lançamento, nunca apagam o anterior.
        </p>
        {movimentos.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 13.5, margin: "16px 0 2px" }}>Ainda não há movimentos.</p>
        ) : (
          <div style={{ overflowX: "auto", marginTop: 14 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
              <thead>
                <tr>{["Quando", "Produto", "Movimento", "Quantidade", "Motivo"].map((titulo) => <th key={titulo} style={th}>{titulo}</th>)}</tr>
              </thead>
              <tbody>{movimentos.map((movimento) => <LinhaMovimento key={movimento.id} movimento={movimento} />)}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
function LinhaProduto({ produto }: { produto: ProdutoAgenda }) {
  const baixo = produto.estoque <= produto.estoque_minimo;
  return (
    <details style={{ borderTop: "1px solid var(--line)" }}>
      <summary style={{ ...sumario, display: "flex", alignItems: "center", gap: 14, padding: "14px 0", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 190 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <strong style={{ fontSize: 14.5 }}>{produto.nome}</strong>
            {!produto.revenda ? <Selo texto="uso interno" /> : null}
            {baixo ? <Selo texto="estoque baixo" atencao /> : null}
          </div>
          <div style={{ color: "var(--muted)", fontSize: 12.5, marginTop: 3 }}>
            {[produto.marca, produto.sku ? `SKU ${produto.sku}` : null, produto.categoria ? categorias[produto.categoria] : null].filter(Boolean).join(" · ") || "Sem marca ou SKU"}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: baixo ? "#efb177" : "var(--text)" }}>{qtd(produto.estoque)} un.</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>{emReais(produto.preco_cent)}</div>
        </div>
      </summary>

      <div style={{ display: "grid", gap: 16, padding: "3px 0 20px" }}>
        <form action={acaoMovimentarEstoque.bind(null, produto.id)} style={blocoInterno}>
          <div>
            <strong style={{ fontSize: 13.5 }}>Lançar movimento</strong>
            <p style={{ margin: "3px 0 0", color: "var(--muted)", fontSize: 12 }}>Saldo atual: {qtd(produto.estoque)}. Saídas acima desse saldo são recusadas.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginTop: 12 }}>
            <Campo rotulo="Operação">
              <select name="operacao" style={entrada} required defaultValue="entrada">
                <option value="entrada">Entrada</option>
                <option value="uso">Uso interno</option>
                <option value="perda">Perda</option>
                <option value="ajuste_mais">Ajuste para mais</option>
                <option value="ajuste_menos">Ajuste para menos</option>
              </select>
            </Campo>
            <Campo rotulo="Quantidade"><input name="quantidade" required inputMode="decimal" style={entrada} placeholder="1" /></Campo>
            <Campo rotulo="Motivo"><input name="motivo" style={entrada} placeholder="Compra, avaria, conferência..." /></Campo>
          </div>
          <button type="submit" style={{ ...botaoSecundario, marginTop: 12 }}>Registrar movimento</button>
        </form>

        <form action={acaoAtualizarProduto.bind(null, produto.id)}>
          <CamposProduto produto={produto} />
          <button type="submit" style={{ ...botaoPrimario, marginTop: 14 }}>Salvar cadastro</button>
        </form>

        <form action={acaoArquivarProduto.bind(null, produto.id)}>
          <button type="submit" style={botaoSecundario}>Arquivar produto</button>
        </form>
      </div>
    </details>
  );
}

function CamposProduto({ produto, novo = false }: { produto?: ProdutoAgenda; novo?: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 14 }}>
      <Campo rotulo="Nome"><input name="nome" required defaultValue={produto?.nome ?? ""} style={entrada} placeholder="Pomada modeladora" /></Campo>
      <Campo rotulo="Marca"><input name="marca" defaultValue={produto?.marca ?? ""} style={entrada} placeholder="Marca" /></Campo>
      <Campo rotulo="SKU"><input name="sku" defaultValue={produto?.sku ?? ""} style={entrada} placeholder="POM-120" /></Campo>
      <Campo rotulo="Categoria">
        <select name="categoria" defaultValue={produto?.categoria ?? ""} style={entrada}>
          <option value="">Sem categoria</option>
          <option value="cosmetico">Cosmético</option>
          <option value="bar">Bar</option>
          <option value="uso_interno">Uso interno</option>
          <option value="outro">Outro</option>
        </select>
      </Campo>
      <Campo rotulo="Preço de venda"><input name="preco" required inputMode="decimal" defaultValue={produto ? dinheiroCampo(produto.preco_cent) : ""} style={entrada} placeholder="39,90" /></Campo>
      <Campo rotulo="Custo interno"><input name="custo" inputMode="decimal" defaultValue={produto ? dinheiroCampo(produto.custo_cent) : ""} style={entrada} placeholder="18,50" /></Campo>
      <Campo rotulo="Estoque mínimo"><input name="estoque_minimo" inputMode="decimal" defaultValue={produto ? qtd(produto.estoque_minimo) : "0"} style={entrada} /></Campo>
      {novo ? <Campo rotulo="Estoque inicial"><input name="estoque_inicial" inputMode="decimal" defaultValue="0" style={entrada} /></Campo> : null}
      <Campo rotulo="Validade"><input name="validade" type="date" defaultValue={produto?.validade ?? ""} style={entrada} /></Campo>
      <label style={{ display: "flex", alignItems: "center", gap: 8, alignSelf: "end", minHeight: 39, color: "var(--muted-2)", fontSize: 13 }}>
        <input type="checkbox" name="revenda" defaultChecked={produto ? produto.revenda : true} /> Disponível para venda
      </label>
    </div>
  );
}

function LinhaMovimento({ movimento }: { movimento: MovimentoProduto }) {
  const entradaMovimento = movimento.quantidade > 0;
  return (
    <tr>
      <td style={td}>{dataHora(movimento.criado_em)}</td>
      <td style={{ ...td, color: "var(--text)", fontWeight: 600 }}>{movimento.produto_nome}</td>
      <td style={td}>{nomesMovimento[movimento.tipo]}</td>
      <td style={{ ...td, color: entradaMovimento ? "#75d59f" : "#efb177", fontWeight: 700 }}>{entradaMovimento ? "+" : ""}{qtd(movimento.quantidade)}</td>
      <td style={td}>{movimento.motivo || "Sem observação"}</td>
    </tr>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return <label style={{ display: "block" }}><span style={{ color: "var(--muted)", fontSize: 12.5 }}>{rotulo}</span>{children}</label>;
}

function Resumo({ rotulo, valor, destaque = false }: { rotulo: string; valor: string; destaque?: boolean }) {
  return <div style={{ ...cartao, padding: "14px 16px" }}><div style={{ color: "var(--muted)", fontSize: 12 }}>{rotulo}</div><strong style={{ display: "block", marginTop: 4, fontSize: 20, color: destaque ? "#efb177" : "var(--text)" }}>{valor}</strong></div>;
}

function Selo({ texto, atencao = false }: { texto: string; atencao?: boolean }) {
  return <span style={{ fontSize: 10.5, padding: "2px 7px", borderRadius: 999, border: `1px solid ${atencao ? "rgba(239,177,119,.45)" : "var(--line)"}`, color: atencao ? "#efb177" : "var(--muted)" }}>{texto}</span>;
}

function Aviso({ texto }: { texto: string }) {
  return <div role="status" style={{ padding: "11px 14px", borderRadius: "var(--radius-sm)", border: "1px solid rgba(111,211,155,.45)", color: "#8de1ae", fontSize: 13.5 }}>{texto}</div>;
}

const categorias: Record<string, string> = { cosmetico: "Cosmético", bar: "Bar", uso_interno: "Uso interno", outro: "Outro" };
const nomesMovimento: Record<string, string> = { entrada: "Entrada", venda: "Venda", uso: "Uso interno", perda: "Perda", ajuste: "Ajuste / estorno" };
const qtd = (valor: number) => valor.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const dinheiroCampo = (cent: number) => (cent / 100).toFixed(2).replace(".", ",");
const dataHora = (valor: string) => new Date(valor).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

const cartao: React.CSSProperties = { background: "rgba(255,255,255,0.04)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: "18px 20px" };
const blocoInterno: React.CSSProperties = { border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", padding: 14, background: "rgba(0,0,0,.14)" };
const sumario: React.CSSProperties = { cursor: "pointer", fontSize: 15, fontWeight: 600, listStyle: "none" };
const entrada: React.CSSProperties = { width: "100%", marginTop: 5, padding: "9px 11px", borderRadius: "var(--radius-sm)", border: "1px solid var(--line)", background: "rgba(0,0,0,.25)", color: "var(--text)", fontSize: 13.5 };
const botaoPrimario: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "10px 18px", borderRadius: 999, background: "var(--gold)", color: "#1a1204", border: "none", fontSize: 13.5, fontWeight: 700, cursor: "pointer", textDecoration: "none" };
const botaoSecundario: React.CSSProperties = { padding: "8px 14px", borderRadius: 999, background: "transparent", border: "1px solid var(--line)", color: "var(--muted-2)", fontSize: 12.5, cursor: "pointer" };
const th: React.CSSProperties = { padding: "9px 10px", borderBottom: "1px solid var(--line)", color: "var(--muted)", fontSize: 11.5, fontWeight: 600, textAlign: "left" };
const td: React.CSSProperties = { padding: "11px 10px", borderBottom: "1px solid var(--line)", color: "var(--muted-2)", fontSize: 12.5, verticalAlign: "top" };
