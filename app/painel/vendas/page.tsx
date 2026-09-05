import Link from "@/components/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getNegocio, getHub } from "@/lib/data";
import { modulosEfetivos } from "@/lib/types";
import { activeNegocioId } from "@/lib/tenant";
import { buscarClientes, emReais, listarProfissionais } from "@/lib/agenda";
import {
  listarComandasAvulsas, listarFiliaisAgenda, listarProdutos, type ComandaAvulsa,
} from "@/lib/agenda-produtos";
import { acaoCancelarVenda, acaoVenderProdutos } from "../produtos/acoes";

export const dynamic = "force-dynamic";

export default async function PainelVendas({
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

  const [todosProdutos, comandas, clientes, profissionais, filiais] = await Promise.all([
    listarProdutos(negocioId),
    listarComandasAvulsas(negocioId, 40),
    buscarClientes(negocioId, "", 100),
    listarProfissionais(negocioId),
    listarFiliaisAgenda(negocioId),
  ]);
  const produtos = todosProdutos.filter((produto) => produto.revenda && produto.estoque > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em" }}>Venda avulsa</h1>
          <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 14, maxWidth: 680 }}>
            Para quem passou no balcão sem agendamento. Fechar a venda baixa o estoque no mesmo instante.
          </p>
        </div>
        <Link href="/painel/produtos" style={botaoSecundario}>Ver produtos e estoque</Link>
      </header>

      {aviso ? <div role="status" style={avisoStyle}>{aviso}</div> : null}

      <section style={cartao}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Fechar nova venda</h2>
        <p style={{ margin: "5px 0 0", color: "var(--muted)", fontSize: 13 }}>
          Informe apenas as quantidades vendidas. Preço, custo e saldo vêm do catálogo deste workspace.
        </p>

        {produtos.length === 0 ? (
          <div style={{ marginTop: 18, padding: "14px 0", borderTop: "1px solid var(--line)" }}>
            <p style={{ margin: 0, color: "var(--muted-2)", fontSize: 13.5 }}>Não há produto de revenda com saldo disponível.</p>
            <Link href="/painel/produtos" style={{ display: "inline-block", marginTop: 9, color: "var(--gold)", fontSize: 13 }}>Cadastrar produto ou lançar entrada</Link>
          </div>
        ) : (
          <form action={acaoVenderProdutos} style={{ marginTop: 18, display: "grid", gap: 18 }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 610, borderCollapse: "collapse" }}>
                <thead><tr>{["Produto", "Disponível", "Preço", "Quantidade"].map((titulo) => <th key={titulo} style={th}>{titulo}</th>)}</tr></thead>
                <tbody>
                  {produtos.map((produto) => (
                    <tr key={produto.id}>
                      <td style={{ ...td, color: "var(--text)" }}>
                        <input type="hidden" name="produto_id" value={produto.id} />
                        <strong>{produto.nome}</strong>
                        <span style={{ display: "block", marginTop: 2, color: "var(--muted)", fontSize: 11.5 }}>{[produto.marca, produto.sku].filter(Boolean).join(" · ") || "Produto de revenda"}</span>
                      </td>
                      <td style={td}>{qtd(produto.estoque)}</td>
                      <td style={td}>{emReais(produto.preco_cent)}</td>
                      <td style={td}>
                        <input name="quantidade" inputMode="decimal" defaultValue="0" aria-label={`Quantidade de ${produto.nome}`} style={{ ...entrada, width: 92, marginTop: 0 }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>
              <Campo rotulo="Forma de pagamento">
                <select name="forma_pagamento" required style={entrada} defaultValue="pix">
                  <option value="pix">Pix</option><option value="dinheiro">Dinheiro</option>
                  <option value="debito">Débito</option><option value="credito">Crédito</option>
                  <option value="fiado">Fiado</option><option value="cortesia">Cortesia</option>
                </select>
              </Campo>
              <Campo rotulo="Cliente" dica="Obrigatório apenas para fiado">
                <select name="cliente_id" style={entrada} defaultValue="">
                  <option value="">Consumidor não identificado</option>
                  {clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}{cliente.telefone ? ` · ${cliente.telefone}` : ""}</option>)}
                </select>
              </Campo>
              <Campo rotulo="Profissional" dica="Opcional, registra comissão de produto">
                <select name="profissional_id" style={entrada} defaultValue="">
                  <option value="">Sem comissão</option>
                  {profissionais.map((profissional) => <option key={profissional.id} value={profissional.id}>{profissional.apelido || profissional.nome}</option>)}
                </select>
              </Campo>
              {filiais.length > 0 ? (
                <Campo rotulo="Loja">
                  <select name="filial_id" style={entrada} defaultValue={filiais.length === 1 ? filiais[0].id : ""}>
                    {filiais.length > 1 ? <option value="">Sem loja definida</option> : null}
                    {filiais.map((filial) => <option key={filial.id} value={filial.id}>{filial.nome}</option>)}
                  </select>
                </Campo>
              ) : null}
              <Campo rotulo="Desconto"><input name="desconto" inputMode="decimal" defaultValue="0,00" style={entrada} /></Campo>
              <Campo rotulo="Taxa da maquininha"><input name="taxa" inputMode="decimal" defaultValue="0,00" style={entrada} /></Campo>
              <Campo rotulo="Parcelas"><input name="parcelas" inputMode="numeric" defaultValue="1" style={entrada} /></Campo>
              <Campo rotulo="Observação"><input name="observacao" style={entrada} placeholder="Opcional" /></Campo>
            </div>
            <div>
              <button type="submit" style={botaoPrimario}>Fechar venda e baixar estoque</button>
            </div>
          </form>
        )}
      </section>

      <section style={cartao}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Vendas recentes</h2>
          <span style={{ color: "var(--muted)", fontSize: 12.5 }}>{comandas.length} {comandas.length === 1 ? "comanda" : "comandas"}</span>
        </div>
        {comandas.length === 0 ? (
          <p style={{ margin: "16px 0 2px", color: "var(--muted)", fontSize: 13.5 }}>Nenhuma venda avulsa registrada.</p>
        ) : (
          <div style={{ marginTop: 14 }}>{comandas.map((comanda) => <LinhaComanda key={comanda.id} comanda={comanda} />)}</div>
        )}
      </section>
    </div>
  );
}
function LinhaComanda({ comanda }: { comanda: ComandaAvulsa }) {
  const cancelada = comanda.status === "cancelada";
  return (
    <details style={{ borderTop: "1px solid var(--line)" }}>
      <summary style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0", cursor: "pointer", listStyle: "none", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 190 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <strong style={{ fontSize: 14.5 }}>Comanda {comanda.numero ?? "sem número"}</strong>
            <span style={{ fontSize: 10.5, padding: "2px 7px", borderRadius: 999, border: `1px solid ${cancelada ? "rgba(239,141,141,.45)" : "rgba(111,211,155,.4)"}`, color: cancelada ? "#ef9b9b" : "#82dca7" }}>{cancelada ? "cancelada" : "fechada"}</span>
          </div>
          <div style={{ marginTop: 3, color: "var(--muted)", fontSize: 12.5 }}>{dataHora(comanda.aberta_em)} · {comanda.cliente_nome || "consumidor não identificado"} · {nomesPagamento[comanda.forma_pagamento ?? ""] || "sem forma informada"}</div>
        </div>
        <strong style={{ fontSize: 16, textDecoration: cancelada ? "line-through" : "none", color: cancelada ? "var(--muted)" : "var(--text)" }}>{emReais(comanda.total_cent)}</strong>
      </summary>
      <div style={{ padding: "0 0 18px" }}>
        <div style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
          {comanda.itens.map((item, indice) => (
            <div key={`${item.descricao}-${indice}`} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 12px", borderTop: indice ? "1px solid var(--line)" : "none", color: "var(--muted-2)", fontSize: 12.5 }}>
              <span>{qtd(item.quantidade)} × {item.descricao}</span><span>{emReais(item.total_cent)}</span>
            </div>
          ))}
          {comanda.desconto_cent > 0 ? <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 12px", borderTop: "1px solid var(--line)", color: "var(--muted)", fontSize: 12 }}><span>Desconto</span><span>-{emReais(comanda.desconto_cent)}</span></div> : null}
        </div>
        {!cancelada ? (
          <details style={{ marginTop: 12 }}>
            <summary style={{ cursor: "pointer", color: "#ef9b9b", fontSize: 12.5 }}>Cancelar e estornar estoque</summary>
            <form action={acaoCancelarVenda.bind(null, comanda.id)} style={{ marginTop: 10, display: "grid", gap: 10, maxWidth: 560 }}>
              <input name="motivo" style={entrada} placeholder="Motivo do cancelamento" />
              <label style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--muted-2)", fontSize: 12.5 }}>
                <input type="checkbox" name="confirmar_cancelamento" required /> Confirmo que a venda deve ser cancelada e o estoque devolvido
              </label>
              <div><button type="submit" style={{ ...botaoSecundario, color: "#ef9b9b" }}>Cancelar venda</button></div>
            </form>
          </details>
        ) : null}
      </div>
    </details>
  );
}

function Campo({ rotulo, dica, children }: { rotulo: string; dica?: string; children: React.ReactNode }) {
  return <label style={{ display: "block" }}><span style={{ color: "var(--muted)", fontSize: 12.5 }}>{rotulo}</span>{children}{dica ? <span style={{ display: "block", color: "var(--muted)", fontSize: 11.5, marginTop: 4 }}>{dica}</span> : null}</label>;
}

const nomesPagamento: Record<string, string> = { dinheiro: "dinheiro", pix: "Pix", debito: "débito", credito: "crédito", fiado: "fiado", cortesia: "cortesia" };
const qtd = (valor: number) => valor.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const dataHora = (valor: string) => new Date(valor).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
const cartao: React.CSSProperties = { background: "rgba(255,255,255,.04)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: "18px 20px" };
const entrada: React.CSSProperties = { width: "100%", marginTop: 5, padding: "9px 11px", borderRadius: "var(--radius-sm)", border: "1px solid var(--line)", background: "rgba(0,0,0,.25)", color: "var(--text)", fontSize: 13.5 };
const botaoPrimario: React.CSSProperties = { padding: "10px 19px", borderRadius: 999, background: "var(--gold)", color: "#1a1204", border: "none", fontSize: 13.5, fontWeight: 700, cursor: "pointer" };
const botaoSecundario: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "9px 15px", borderRadius: 999, background: "transparent", border: "1px solid var(--line)", color: "var(--muted-2)", fontSize: 12.5, cursor: "pointer", textDecoration: "none" };
const avisoStyle: React.CSSProperties = { padding: "11px 14px", borderRadius: "var(--radius-sm)", border: "1px solid rgba(111,211,155,.45)", color: "#8de1ae", fontSize: 13.5 };
const th: React.CSSProperties = { padding: "9px 10px", borderBottom: "1px solid var(--line)", color: "var(--muted)", fontSize: 11.5, fontWeight: 600, textAlign: "left" };
const td: React.CSSProperties = { padding: "11px 10px", borderBottom: "1px solid var(--line)", color: "var(--muted-2)", fontSize: 12.5, verticalAlign: "middle" };
