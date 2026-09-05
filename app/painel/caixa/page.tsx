import { redirect } from "next/navigation";
import Link from "@/components/link";
import { getSession } from "@/lib/auth";
import { getNegocio, getHub } from "@/lib/data";
import { activeNegocioId } from "@/lib/tenant";
import { modulosEfetivos } from "@/lib/types";
import { emReais } from "@/lib/agenda";
import { conferirCaixaDoDia, dataCaixaValida, hojeCaixa, formaCaixa, FORMAS_CAIXA } from "@/lib/agenda-caixa";
import styles from "./caixa.module.css";

export const dynamic = "force-dynamic";

export default async function PainelCaixa({ searchParams }: {
  searchParams: Promise<{ dia?: string | string[] }>;
}) {
  const sessao = await getSession();
  if (!sessao) redirect("/login");
  const negocioId = activeNegocioId(sessao);
  if (!negocioId) redirect(sessao.papel === "owner_plataforma" ? "/owner" : "/login");
  const negocio = await getNegocio(negocioId);
  if (!negocio) redirect("/login");
  const hub = await getHub(negocio.hub_id);
  if (!hub || !modulosEfetivos(negocio, hub).agenda) redirect("/painel");

  const { dia: parametro } = await searchParams;
  const hoje = hojeCaixa();
  const dia = dataCaixaValida(parametro) ? parametro : hoje;
  const invalido = parametro !== undefined && !dataCaixaValida(parametro);
  const caixa = await conferirCaixaDoDia(negocioId, dia);
  const dataExibida = dia.split("-").reverse().join("/");
  const semForma = caixa.formas.find((item) => item.forma === "sem_forma")!;

  return (
    <div className={styles.pagina}>
      <header className={styles.cabecalho}>
        <div>
          <h1>Caixa do dia</h1>
          <p className={styles.descricao}>Confira as comandas e os pagamentos antes de encerrar o expediente.</p>
        </div>
        <Link className={styles.botao} href={`/painel/agenda?dia=${dia}`}>Ver agenda do dia</Link>
      </header>

      <form method="get" className={styles.filtro}>
        <label htmlFor="dia-caixa">Dia da conferência
          <input id="dia-caixa" name="dia" type="date" required defaultValue={dia} className={styles.entrada} />
        </label>
        <button type="submit" className={styles.primario}>Conferir dia</button>
        {dia !== hoje && <Link className={styles.botao} href="/painel/caixa">Hoje</Link>}
        <span className={styles.dica}>Horário de Brasília</span>
      </form>
      {invalido && <p role="status" className={styles.aviso}>A data informada é inválida. Exibindo o dia de hoje.</p>}

      <section aria-labelledby="resumo-caixa" className={styles.secao}>
        <div className={styles.tituloLinha}>
          <h2 id="resumo-caixa">Conferência de {dataExibida}</h2>
          <span className={styles.dica}>{caixa.fechadas.length} {caixa.fechadas.length === 1 ? "comanda fechada" : "comandas fechadas"}</span>
        </div>
        <dl className={styles.resumo}>
          <div><dt>Total das comandas</dt><dd>{emReais(caixa.total_cent)}</dd><small>Após {emReais(caixa.desconto_cent)} em descontos</small></div>
          <div><dt>Taxas registradas</dt><dd>{emReais(caixa.taxa_cent)}</dd><small>Conforme informado nas comandas</small></div>
          <div><dt>Recebimento após taxas</dt><dd>{emReais(caixa.recebimento_cent)}</dd><small>Dinheiro, Pix, débito e crédito</small></div>
        </dl>
        <p className={styles.dica}>O recebimento é estimado pelos pagamentos registrados. Cartões podem cair em outra data. Não representa lucro nem saldo disponível em conta.</p>
      </section>

      {(caixa.abertas > 0 || semForma.quantidade > 0) && (
        <aside className={styles.aviso} aria-label="Pendências da conferência">
          <strong>Antes de encerrar</strong>
          {caixa.abertas > 0 && <p>{caixa.abertas} {caixa.abertas === 1 ? "comanda ainda aberta" : "comandas ainda abertas"}, no total de {emReais(caixa.aberto_cent)}. Inclui aberturas até este dia que continuam pendentes hoje; estes valores não entram no resumo.</p>}
          {semForma.quantidade > 0 && <p>{semForma.quantidade} {semForma.quantidade === 1 ? "comanda sem forma de pagamento" : "comandas sem forma de pagamento"}. Confira {emReais(semForma.total_cent)} antes de considerar esse valor recebido.</p>}
        </aside>
      )}

      <section aria-labelledby="formas-caixa" className={styles.secao}>
        <h2 id="formas-caixa">Por forma de pagamento</h2>
        <div className={styles.rolagem} role="region" aria-label="Valores por forma de pagamento" tabIndex={0}>
          <table className={styles.tabela}>
            <thead><tr><th scope="col">Forma</th><th scope="col">Comandas</th><th scope="col">Total</th><th scope="col">Taxas</th><th scope="col">Após taxas</th></tr></thead>
            <tbody>{caixa.formas.map((item) => (
              <tr key={item.forma}>
                <th scope="row">{item.rotulo}{!item.recebimento && <small>Fora da estimativa de recebimento</small>}</th>
                <td>{item.quantidade}</td><td>{emReais(item.total_cent)}</td><td>{emReais(item.taxa_cent)}</td>
                <td>{item.recebimento ? emReais(item.total_cent - item.taxa_cent) : "Não se aplica"}</td>
              </tr>
            ))}</tbody>
            <tfoot><tr><th scope="row">Total</th><td>{caixa.fechadas.length}</td><td>{emReais(caixa.total_cent)}</td><td>{emReais(caixa.taxa_cent)}</td><td>{emReais(caixa.recebimento_cent)}</td></tr></tfoot>
          </table>
        </div>
        <p className={styles.dica}>Fiado é valor a receber. Pacotes e cortesias não comprovam entrada de dinheiro neste dia. Pagamentos não informados aguardam conferência.</p>
      </section>

      <section aria-labelledby="comandas-caixa" className={styles.secao}>
        <h2 id="comandas-caixa">Comandas fechadas no dia</h2>
        {caixa.fechadas.length === 0 ? (
          <div className={styles.vazio}>
            <strong>Nenhuma comanda fechada em {dataExibida}.</strong>
            <p>Escolha outra data ou confira os atendimentos na agenda. Comandas abertas e canceladas não compõem o faturamento.</p>
          </div>
        ) : (
          <div className={styles.rolagem} role="region" aria-label="Comandas do dia" tabIndex={0}>
            <table className={styles.tabela}>
              <thead><tr>{["Comanda", "Fechada às", "Cliente", "Pagamento", "Total", "Taxa"].map((rotulo) => <th scope="col" key={rotulo}>{rotulo}</th>)}</tr></thead>
              <tbody>{caixa.fechadas.map((comanda) => (
                <tr key={comanda.id}>
                  <th scope="row">{comanda.numero == null ? comanda.id.slice(0, 8) : `#${comanda.numero}`}</th>
                  <td>{comanda.fechada_hora}</td><td>{comanda.cliente_nome || "Consumidor não identificado"}</td>
                  <td>{FORMAS_CAIXA[formaCaixa(comanda.forma_pagamento)]}</td>
                  <td>{emReais(comanda.total_cent)}</td><td>{emReais(comanda.taxa_cent)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
      <p className={styles.nota}>Esta tela é uma conferência: o fechamento do caixa e a contagem de dinheiro ainda não são salvos. Os valores refletem o estado atual das comandas e podem mudar após correções ou cancelamentos.</p>
    </div>
  );
}
