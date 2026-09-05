import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getNegocio, getHub } from "@/lib/data";
import { modulosEfetivos } from "@/lib/types";
import { activeNegocioId } from "@/lib/tenant";
import {
  listarServicos, configDaAgenda, emReais,
  type Servico,
} from "@/lib/agenda";
import {
  acaoCriarServico, acaoAtualizarServico, acaoArquivarServico, acaoSalvarConfig,
} from "../agenda/acoes";

// ============================================================================
//  PAINEL · SERVIÇOS E REGRAS DA CASA
//
//  O que a barbearia vende e quanto tempo cada coisa ocupa a cadeira. É daqui
//  que sai a duração do agendamento, o preço da comanda e a base da comissão.
//
//  A CONFIGURAÇÃO DA CASA MORA AQUI JUNTO, e não numa tela própria de
//  Configurações: são seis campos que o dono mexe uma vez na vida. Tela própria
//  para seis campos vira item de menu que ninguém abre.
// ============================================================================

export const dynamic = "force-dynamic";

export default async function PainelServicos({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string }>;
}) {
  const { aviso } = await searchParams;

  const s = await getSession();
  if (!s) redirect("/login");
  const negocioId = activeNegocioId(s);
  if (!negocioId) redirect("/owner");

  const negocio = await getNegocio(negocioId);
  if (!negocio) redirect("/login");
  const hub = await getHub(negocio.hub_id);
  if (!hub || !modulosEfetivos(negocio, hub).agenda) redirect("/painel");

  const [servicos, config] = await Promise.all([
    listarServicos(negocioId),
    configDaAgenda(negocioId),
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
      <header>
        <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>
          Serviços
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 14, margin: "6px 0 0" }}>
          O que a casa vende, quanto tempo ocupa a cadeira e as regras da agenda.
        </p>
      </header>

      {aviso ? (
        <div style={{
          padding: "12px 16px", borderRadius: "var(--radius-sm)",
          border: "1px solid #6fd39b", color: "#6fd39b", fontSize: 13.5,
        }}>
          {aviso}
        </div>
      ) : null}

      <section style={cartao}>
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>
          {servicos.length} {servicos.length === 1 ? "serviço" : "serviços"}
        </h2>

        {servicos.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 13.5, margin: "16px 0 4px" }}>
            Nenhum serviço cadastrado. Sem serviço não dá pra marcar horário.
          </p>
        ) : (
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column" }}>
            {servicos.map((sv) => <LinhaServico key={sv.id} sv={sv} />)}
          </div>
        )}
      </section>

      {/* ---------- novo servico ---------- */}
      <details style={cartao}>
        <summary style={{ cursor: "pointer", fontSize: 15, fontWeight: 600, listStyle: "none" }}>
          + Novo serviço
        </summary>
        <form action={acaoCriarServico} style={{ marginTop: 18 }}>
          <CamposServico />
          <div style={{ marginTop: 16 }}>
            <button type="submit" style={botaoPrimario}>Cadastrar</button>
          </div>
        </form>
      </details>

      {/* ---------- regras da casa ---------- */}
      <section style={cartao}>
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Regras da casa</h2>
        <p style={{ color: "var(--muted)", fontSize: 13, margin: "6px 0 0" }}>
          Valem para o site, para o WhatsApp e para o balcão.
        </p>

        <form action={acaoSalvarConfig} style={{ marginTop: 16, display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
            <Campo rotulo="Grade da agenda, em minutos"
                   dica="15 para barbearia de corte de 30, 30 para sessão longa">
              <select name="grade_min" defaultValue={String(config.grade_min)} style={entrada}>
                {[5, 10, 15, 20, 30, 60].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </Campo>
            <Campo rotulo="Antecedência mínima, em horas"
                   dica="senão alguém marca pras 14h às 13h58">
              <input name="antecedencia_min_horas" defaultValue={config.antecedencia_min_horas}
                     style={entrada} inputMode="numeric" />
            </Campo>
            <Campo rotulo="Agenda aberta por, em dias"
                   dica="agenda infinita enche de marcação que ninguém lembra">
              <input name="antecedencia_max_dias" defaultValue={config.antecedencia_max_dias}
                     style={entrada} inputMode="numeric" />
            </Campo>
            <Campo rotulo="Cancelamento livre até, em horas">
              <input name="cancelamento_horas" defaultValue={config.cancelamento_horas}
                     style={entrada} inputMode="numeric" />
            </Campo>
            <Campo rotulo="Lembrete quantas horas antes">
              <input name="lembrete_horas_antes" defaultValue={config.lembrete_horas_antes}
                     style={entrada} inputMode="numeric" />
            </Campo>
            <Campo rotulo="Comissão padrão em serviço, em %"
                   dica="quem tiver comissão própria na ficha ignora esta">
              <input name="comissao_servico_pct" defaultValue={config.comissao_servico_pct}
                     style={entrada} inputMode="numeric" />
            </Campo>
            <Campo rotulo="Comissão padrão em produto, em %">
              <input name="comissao_produto_pct" defaultValue={config.comissao_produto_pct}
                     style={entrada} inputMode="numeric" />
            </Campo>
          </div>

          <label style={{ fontSize: 13, color: "var(--muted-2)", display: "flex", gap: 7, alignItems: "center", justifySelf: "start", width: "fit-content" }}>
            <input type="checkbox" name="pede_confirmacao" defaultChecked={config.pede_confirmacao} />
            Pedir confirmação no lembrete
          </label>
          <label style={{ fontSize: 13, color: "var(--muted-2)", display: "flex", gap: 7, alignItems: "center", justifySelf: "start", width: "fit-content" }}>
            <input type="checkbox" name="fidelidade_ativa" defaultChecked={config.fidelidade_ativa} />
            Acumular pontos de fidelidade a cada atendimento
          </label>

          <div>
            <button type="submit" style={botaoPrimario}>Salvar regras</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function LinhaServico({ sv }: { sv: Servico }) {
  return (
    <details style={{ borderTop: "1px solid var(--line)" }}>
      <summary style={{
        display: "flex", alignItems: "center", gap: 14, padding: "13px 0",
        cursor: "pointer", listStyle: "none", flexWrap: "wrap",
      }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <strong style={{ fontSize: 14.5 }}>{sv.nome}</strong>
            {!sv.online ? (
              <span style={{
                fontSize: 11, padding: "2px 8px", borderRadius: 999,
                border: "1px solid var(--line)", color: "var(--muted)",
              }}>
                só no balcão
              </span>
            ) : null}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--muted-2)", marginTop: 3 }}>
            {sv.duracao_min} min na cadeira
            {sv.intervalo_pos_min > 0 ? ` · ${sv.intervalo_pos_min} min de limpeza` : ""}
            {sv.retorno_dias ? ` · retorno sugerido em ${sv.retorno_dias} dias` : ""}
          </div>
        </div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{emReais(sv.preco_cent)}</div>
      </summary>

      <form action={acaoAtualizarServico.bind(null, sv.id)} style={{ padding: "4px 0 18px" }}>
        <CamposServico sv={sv} />
        <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="submit" style={botaoPrimario}>Salvar</button>
        </div>
      </form>
      {/* Formulário separado: botão de arquivar dentro do de salvar enviaria os
          dois de uma vez. */}
      <form action={acaoArquivarServico.bind(null, sv.id)} style={{ paddingBottom: 16 }}>
        <button style={acaoBotao}>Arquivar serviço</button>
      </form>
    </details>
  );
}

function CamposServico({ sv }: { sv?: Servico }) {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 14 }}>
        <Campo rotulo="Nome">
          <input name="nome" required defaultValue={sv?.nome ?? ""} style={entrada}
                 placeholder="Corte com barba" />
        </Campo>
        <Campo rotulo="Preço">
          <input name="preco" required inputMode="decimal" style={entrada}
                 defaultValue={sv ? (sv.preco_cent / 100).toFixed(2).replace(".", ",") : ""}
                 placeholder="45,00" />
        </Campo>
        <Campo rotulo="Duração, em minutos">
          <input name="duracao_min" required inputMode="numeric" style={entrada}
                 defaultValue={sv?.duracao_min ?? 30} />
        </Campo>
        <Campo rotulo="Limpeza depois, em minutos"
               dica="o tempo real entre um cliente e o próximo">
          {/* Sem isso a agenda promete um encaixe que na prática atrasa o dia
              inteiro. É o campo que some de todo sistema. */}
          <input name="intervalo_pos_min" inputMode="numeric" style={entrada}
                 defaultValue={sv?.intervalo_pos_min ?? 0} />
        </Campo>
        <Campo rotulo="Retorno sugerido, em dias"
               dica="ponto de partida; o raio-X usa o ritmo real de cada cliente">
          <input name="retorno_dias" inputMode="numeric" style={entrada}
                 defaultValue={sv?.retorno_dias ?? ""} placeholder="21" />
        </Campo>
        <Campo rotulo="Custo de insumo" dica="interno, nunca aparece pro cliente">
          <input name="custo" inputMode="decimal" style={entrada}
                 defaultValue={sv ? (sv.custo_cent / 100).toFixed(2).replace(".", ",") : ""} />
        </Campo>
      </div>

      <Campo rotulo="Descrição">
        <input name="descricao" defaultValue={sv?.descricao ?? ""} style={entrada}
               placeholder="Aparece no site, para o cliente escolher" />
      </Campo>

      <label style={{ fontSize: 13, color: "var(--muted-2)", display: "flex", gap: 7, alignItems: "center", justifySelf: "start", width: "fit-content" }}>
        <input type="checkbox" name="online" defaultChecked={sv ? sv.online : true} />
        O cliente pode escolher este serviço sozinho, no site e no WhatsApp
      </label>
    </div>
  );
}

function Campo({ rotulo, dica, children }: { rotulo: string; dica?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{rotulo}</span>
      {children}
      {dica ? (
        <span style={{ display: "block", fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>
          {dica}
        </span>
      ) : null}
    </label>
  );
}

const cartao: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius)",
  padding: "18px 20px",
};

const botaoPrimario: React.CSSProperties = {
  padding: "10px 22px", borderRadius: 999, background: "var(--gold)",
  color: "#1a1204", fontSize: 13.5, fontWeight: 700, border: "none", cursor: "pointer",
};

const acaoBotao: React.CSSProperties = {
  padding: "6px 13px", borderRadius: 999, fontSize: 12.5,
  border: "1px solid var(--line)", background: "transparent",
  color: "var(--muted-2)", cursor: "pointer",
};

const entrada: React.CSSProperties = {
  width: "100%", marginTop: 5, padding: "9px 12px",
  borderRadius: "var(--radius-sm)", border: "1px solid var(--line)",
  background: "rgba(0,0,0,0.25)", color: "var(--text)", fontSize: 13.5,
};
