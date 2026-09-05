import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getHub, getNegocio } from "@/lib/data";
import { emReais, listarProfissionais } from "@/lib/agenda";
import {
  extratoComissao,
  hojeComissao,
  periodoMensal,
  type MovimentoComissao,
} from "@/lib/agenda-comissoes";
import { activeNegocioId } from "@/lib/tenant";
import { modulosEfetivos } from "@/lib/types";
import { acaoFecharMes, acaoLancarAjuste } from "./acoes";

export const dynamic = "force-dynamic";

type Busca = {
  profissional?: string;
  mes?: string;
  aviso?: string;
  erro?: string;
};

const nomesCategoria: Record<MovimentoComissao["categoria"], string> = {
  servico: "Serviço",
  produto: "Produto",
  pacote: "Pacote",
  vale: "Vale",
  adiantamento: "Adiantamento",
  consumo: "Consumo",
  bonus: "Bônus",
  desconto: "Desconto",
};

export default async function PainelComissoes({
  searchParams,
}: {
  searchParams: Promise<Busca>;
}) {
  const busca = await searchParams;
  const sessao = await getSession();
  if (!sessao) redirect("/login");
  if (sessao.papel !== "dono" && sessao.papel !== "owner_plataforma") redirect("/painel");

  const negocioId = activeNegocioId(sessao);
  if (!negocioId) redirect(sessao.papel === "owner_plataforma" ? "/owner" : "/login");
  const negocio = await getNegocio(negocioId);
  if (!negocio) redirect("/login");
  const hub = await getHub(negocio.hub_id);
  if (!hub || !modulosEfetivos(negocio, hub).agenda) redirect("/painel");

  const equipe = await listarProfissionais(negocioId, true);
  const profissional = equipe.find((item) => item.id === busca.profissional) ?? equipe[0] ?? null;
  const periodo = periodoMensal(busca.mes);
  const extrato = profissional
    ? await extratoComissao(negocioId, profissional.id, periodo)
    : null;
  const fechado = !!extrato?.fechamento && extrato.fechamento.status !== "aberto";
  const dataPadrao = hojeComissao().startsWith(periodo.mes) ? hojeComissao() : periodo.inicio;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 1240, margin: "0 auto" }}>
      <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
        <div>
          <div style={{ color: "var(--gold)", fontSize: 11, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 7 }}>
            Equipe · acerto mensal
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 750, letterSpacing: "-0.035em", margin: 0 }}>
            Comissões
          </h1>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: "7px 0 0", maxWidth: 620, lineHeight: 1.55 }}>
            Confira o que cada profissional produziu, desconte vales e consumos e congele o valor combinado no fechamento.
          </p>
        </div>
        <span style={{ ...selo, color: fechado ? "#8fe0ae" : "#f3cf74", borderColor: fechado ? "rgba(111,211,155,.38)" : "rgba(201,162,39,.45)" }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: fechado ? "#6fd39b" : "var(--gold)" }} />
          {fechado ? (extrato?.fechamento?.status === "pago" ? "Pago" : "Mês fechado") : "Em conferência"}
        </span>
      </header>

      {busca.aviso ? (
        <div role="status" style={{
          padding: "12px 15px", borderRadius: 12, fontSize: 13.5,
          border: `1px solid ${busca.erro ? "rgba(238,117,117,.5)" : "rgba(111,211,155,.45)"}`,
          background: busca.erro ? "rgba(154,45,45,.12)" : "rgba(36,126,75,.12)",
          color: busca.erro ? "#ffb0b0" : "#9ae7b8",
        }}>
          {busca.aviso}
        </div>
      ) : null}

      <form method="get" style={{ ...cartao, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,220px),1fr))", gap: 14, alignItems: "end" }}>
        <Campo rotulo="Profissional">
          <select name="profissional" defaultValue={profissional?.id ?? ""} style={entrada} disabled={!equipe.length}>
            {equipe.length ? equipe.map((item) => (
              <option key={item.id} value={item.id}>
                {item.apelido || item.nome}{item.ativo ? "" : " · arquivado"}
              </option>
            )) : <option value="">Cadastre a equipe primeiro</option>}
          </select>
        </Campo>
        <Campo rotulo="Competência">
          <input name="mes" type="month" defaultValue={periodo.mes} style={entrada} />
        </Campo>
        <button type="submit" style={{ ...botaoSecundario, height: 42 }}>Ver extrato</button>
      </form>

      {!profissional || !extrato ? (
        <section style={{ ...cartao, padding: "44px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 34, marginBottom: 12 }}>✂</div>
          <h2 style={{ margin: 0, fontSize: 18 }}>Nenhum profissional cadastrado</h2>
          <p style={{ color: "var(--muted)", fontSize: 13.5, margin: "8px auto 0", maxWidth: 460 }}>
            Cadastre a equipe antes de montar extratos e fazer fechamentos de comissão.
          </p>
        </section>
      ) : (
        <>
          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,175px),1fr))", gap: 12 }}>
            <Metrica rotulo="Serviços produzidos" valor={emReais(extrato.resumo.servicos_cent)} detalhe="base de serviço" />
            <Metrica rotulo="Produtos vendidos" valor={emReais(extrato.resumo.produtos_cent)} detalhe="base de produto" />
            <Metrica rotulo="Comissão gerada" valor={emReais(extrato.resumo.comissao_cent)} detalhe="percentual congelado na comanda" destaque />
            <Metrica rotulo="Vales e consumos" valor={emReais(extrato.resumo.lancamentos_cent)} detalhe="ajustes do período" negativo={extrato.resumo.lancamentos_cent < 0} />
            <Metrica rotulo="Líquido do mês" valor={emReais(extrato.resumo.liquido_cent)} detalhe={periodo.rotulo} principal />
          </section>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,460px),1fr))", gap: 18, alignItems: "start" }}>
            <section style={{ ...cartao, padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <h2 style={{ fontSize: 17, margin: 0 }}>Extrato de {profissional.apelido || profissional.nome}</h2>
                  <p style={{ color: "var(--muted)", fontSize: 12.5, margin: "5px 0 0" }}>{periodo.rotulo}</p>
                </div>
                <span style={{ fontSize: 12, color: "var(--muted-2)" }}>{extrato.movimentos.length} lançamentos</span>
              </div>

              {extrato.movimentos.length === 0 ? (
                <div style={{ padding: "44px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13.5 }}>
                  Nenhuma comissão ou ajuste nesta competência.
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 650 }}>
                    <thead>
                      <tr>
                        {[
                          ["Data", "left"], ["Movimento", "left"], ["Referência", "left"],
                          ["Base", "right"], ["Comissão / ajuste", "right"],
                        ].map(([rotulo, alinhar]) => (
                          <th key={rotulo} style={{ ...cabecalhoTabela, textAlign: alinhar as "left" | "right" }}>{rotulo}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {extrato.movimentos.map((movimento) => (
                        <tr key={`${movimento.categoria}-${movimento.id}`}>
                          <td style={celula}>{formatarData(movimento.data)}</td>
                          <td style={celula}>
                            <span style={{ display: "block", color: "var(--text)", fontWeight: 600 }}>{movimento.descricao}</span>
                            <span style={{ color: "var(--muted)", fontSize: 11.5 }}>{nomesCategoria[movimento.categoria]}</span>
                          </td>
                          <td style={{ ...celula, color: "var(--muted)" }}>{movimento.referencia || "—"}</td>
                          <td style={{ ...celula, textAlign: "right", color: "var(--muted-2)" }}>
                            {movimento.base_cent === null ? "—" : emReais(movimento.base_cent)}
                          </td>
                          <td style={{ ...celula, textAlign: "right", fontWeight: 750, color: movimento.valor_cent < 0 ? "#ff9f9f" : "#8fe0ae" }}>
                            {movimento.valor_cent > 0 ? "+ " : "− "}{emReais(Math.abs(movimento.valor_cent))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <aside style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <section style={cartao}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "var(--gold)", letterSpacing: ".12em", textTransform: "uppercase" }}>
                  Ajuste rápido
                </div>
                <h2 style={{ fontSize: 17, margin: "6px 0 4px" }}>Novo lançamento</h2>
                <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 16px", lineHeight: 1.5 }}>
                  O valor entra como desconto no líquido de {periodo.rotulo.toLowerCase()}.
                </p>
                <form action={acaoLancarAjuste} style={{ display: "grid", gap: 12 }}>
                  <input type="hidden" name="profissional_id" value={profissional.id} />
                  <input type="hidden" name="mes" value={periodo.mes} />
                  <Campo rotulo="Tipo">
                    <select name="tipo" defaultValue="vale" style={entrada} disabled={fechado}>
                      <option value="vale">Vale</option>
                      <option value="adiantamento">Adiantamento</option>
                      <option value="consumo">Consumo na casa</option>
                    </select>
                  </Campo>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <Campo rotulo="Valor">
                      <input name="valor" required inputMode="decimal" placeholder="R$ 0,00" style={entrada} disabled={fechado} />
                    </Campo>
                    <Campo rotulo="Data">
                      <input name="data" type="date" required defaultValue={dataPadrao} min={periodo.inicio} max={periodo.fim} style={entrada} disabled={fechado} />
                    </Campo>
                  </div>
                  <Campo rotulo="Descrição">
                    <input name="descricao" maxLength={240} placeholder="Ex.: produto retirado" style={entrada} disabled={fechado} />
                  </Campo>
                  <button type="submit" style={botaoSecundario} disabled={fechado}>
                    {fechado ? "Competência fechada" : "Incluir no extrato"}
                  </button>
                </form>
              </section>

              <section style={{ ...cartao, borderColor: fechado ? "rgba(111,211,155,.32)" : "rgba(201,162,39,.32)" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: fechado ? "#8fe0ae" : "var(--gold)", letterSpacing: ".12em", textTransform: "uppercase" }}>
                  {fechado ? "Conferência encerrada" : "Última etapa"}
                </div>
                <h2 style={{ fontSize: 17, margin: "6px 0 4px" }}>{fechado ? "Totais congelados" : "Fechar competência"}</h2>
                <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 15px", lineHeight: 1.5 }}>
                  {fechado
                    ? `O líquido de ${emReais(extrato.resumo.liquido_cent)} não será recalculado automaticamente.`
                    : "Depois do fechamento, novos ajustes não entram neste mês. Confira o extrato antes de continuar."}
                </p>
                {fechado ? (
                  <div style={{ padding: "11px 12px", background: "rgba(111,211,155,.08)", borderRadius: 10, color: "#9ae7b8", fontSize: 12.5 }}>
                    Fechado em {extrato.fechamento?.fechado_em ? formatarInstante(extrato.fechamento.fechado_em) : "data registrada"}.
                  </div>
                ) : (
                  <form action={acaoFecharMes} style={{ display: "grid", gap: 12 }}>
                    <input type="hidden" name="profissional_id" value={profissional.id} />
                    <input type="hidden" name="mes" value={periodo.mes} />
                    <Campo rotulo="Observação do acerto">
                      <textarea name="observacao" rows={3} maxLength={500} placeholder="Opcional" style={{ ...entrada, resize: "vertical" }} />
                    </Campo>
                    <label style={{ display: "flex", alignItems: "flex-start", gap: 8, color: "var(--muted-2)", fontSize: 12, lineHeight: 1.45 }}>
                      <input type="checkbox" name="confirmar" required style={{ marginTop: 2 }} />
                      Conferi o extrato e o líquido deste profissional.
                    </label>
                    <button type="submit" style={botaoPrimario}>Fechar {periodo.rotulo}</button>
                  </form>
                )}
              </section>
            </aside>
          </div>
        </>
      )}

      <p style={{ margin: 0, color: "var(--muted)", fontSize: 11.5, lineHeight: 1.5 }}>
        Acesso restrito ao dono. Comissões vêm das comandas fechadas; caixa e formas de pagamento não são alterados por esta tela.
      </p>
    </div>
  );
}

function Metrica({
  rotulo,
  valor,
  detalhe,
  principal = false,
  destaque = false,
  negativo = false,
}: {
  rotulo: string;
  valor: string;
  detalhe: string;
  principal?: boolean;
  destaque?: boolean;
  negativo?: boolean;
}) {
  return (
    <article style={{
      ...cartao,
      minHeight: 122,
      background: principal
        ? "linear-gradient(145deg,rgba(201,162,39,.2),rgba(201,162,39,.055))"
        : "rgba(255,255,255,.035)",
      borderColor: principal ? "rgba(201,162,39,.45)" : "var(--line)",
    }}>
      <div style={{ fontSize: 11.5, color: "var(--muted)", minHeight: 29 }}>{rotulo}</div>
      <strong style={{ display: "block", fontSize: principal ? 25 : 21, letterSpacing: "-.025em", color: negativo ? "#ffadad" : destaque || principal ? "#f3d57f" : "var(--text)" }}>
        {valor}
      </strong>
      <span style={{ display: "block", color: "var(--muted)", fontSize: 10.5, marginTop: 8 }}>{detalhe}</span>
    </article>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 5 }}>{rotulo}</span>
      {children}
    </label>
  );
}

function formatarData(data: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" })
    .format(new Date(`${data.slice(0, 10)}T12:00:00-03:00`));
}

function formatarInstante(instante: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(instante));
}

const cartao: React.CSSProperties = {
  background: "rgba(255,255,255,.04)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius)",
  padding: "18px 20px",
};

const entrada: React.CSSProperties = {
  width: "100%",
  minHeight: 42,
  padding: "9px 11px",
  borderRadius: 10,
  border: "1px solid var(--line)",
  background: "rgba(0,0,0,.24)",
  color: "var(--text)",
  fontSize: 13,
};

const botaoSecundario: React.CSSProperties = {
  minHeight: 42,
  padding: "9px 14px",
  borderRadius: 10,
  border: "1px solid var(--line)",
  background: "rgba(255,255,255,.055)",
  color: "var(--text)",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const botaoPrimario: React.CSSProperties = {
  minHeight: 43,
  padding: "10px 15px",
  borderRadius: 10,
  border: "1px solid rgba(244,211,120,.35)",
  background: "var(--gold)",
  color: "#1a1204",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
};

const selo: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid",
  background: "rgba(255,255,255,.035)",
  fontSize: 11.5,
  fontWeight: 750,
  letterSpacing: ".02em",
};

const cabecalhoTabela: React.CSSProperties = {
  padding: "10px 14px",
  background: "rgba(255,255,255,.025)",
  color: "var(--muted)",
  fontSize: 10.5,
  fontWeight: 750,
  letterSpacing: ".06em",
  textTransform: "uppercase",
  borderBottom: "1px solid var(--line)",
};

const celula: React.CSSProperties = {
  padding: "13px 14px",
  borderBottom: "1px solid var(--line)",
  fontSize: 12.5,
  verticalAlign: "middle",
};
