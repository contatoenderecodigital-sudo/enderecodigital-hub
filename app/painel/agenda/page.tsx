import { redirect } from "next/navigation";
import Link from "@/components/link";
import { getSession } from "@/lib/auth";
import { getNegocio, getHub } from "@/lib/data";
import { modulosEfetivos } from "@/lib/types";
import { activeNegocioId } from "@/lib/tenant";
import {
  agendaDoDia, listarProfissionais, listarServicos, movimentoDoDia,
  cadeiraVazia, faixasDoDia, emReais, FUSO,
  type ItemAgenda, type FaixaTrabalho, type Profissional, type Servico,
} from "@/lib/agenda";
import {
  acaoMarcar, acaoMudarStatus, acaoCancelar, acaoConcluir, acaoReabrir,
} from "./acoes";

// ============================================================================
//  PAINEL · AGENDA DO DIA
//
//  A tela que o dono abre de manha e deixa aberta o dia inteiro. Por isso ela
//  e uma LISTA em ordem de horario, e nao uma grade de colunas por barbeiro.
//
//  Grade e bonita na apresentacao e ruim no balcao: com quatro barbeiros ela
//  ja nao cabe na tela do celular, e o celular e onde o dono olha entre um
//  corte e outro. Lista em ordem de hora responde a unica pergunta que ele faz
//  o dia todo, que e "quem e o proximo".
//
//  O buraco na agenda aparece como buraco, com o tamanho dele em minutos. Sem
//  isso a lista mente por omissao: dez atendimentos seguidos e dez atendimentos
//  com duas horas mortas no meio parecem a mesma coisa.
//
//  CADA LINHA TERMINA NUMA ACAO. Agenda que so mostra obriga o dono a manter o
//  caderno do lado, e ai ele opera no caderno e o sistema vira enfeite.
// ============================================================================

export const dynamic = "force-dynamic";

const COR = {
  critico: "#f08a8a",
  atencao: "#e6b45c",
  ok: "#6fd39b",
} as const;

const ROTULO_STATUS: Record<string, string> = {
  pendente: "a confirmar",
  confirmado: "confirmado",
  em_atendimento: "na cadeira",
  concluido: "concluído",
  faltou: "faltou",
};

// Data de hoje no fuso da barbearia. `new Date()` no servidor devolve o fuso do
// container, e em UTC depois das 21h a agenda pularia pro dia seguinte sozinha.
function hojeNoFuso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(new Date());
}

function somaDias(dia: string, n: number): string {
  const d = new Date(dia + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function porExtenso(dia: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long", day: "2-digit", month: "long", timeZone: "UTC",
  }).format(new Date(dia + "T12:00:00Z"));
}

function hora(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit", minute: "2-digit", timeZone: FUSO,
  }).format(new Date(iso));
}

function minutosEntre(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
}

// Minuto do dia, no fuso da barbearia, para comparar com a jornada.
function minutoDoDia(iso: string): number {
  const [h, m] = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: FUSO,
  }).format(new Date(iso)).split(":");
  return Number(h) * 60 + Number(m);
}

const emMinutos = (hhmmss: string) => {
  const [h, m] = hhmmss.split(":");
  return Number(h) * 60 + Number(m);
};

// Quanto do intervalo entre dois atendimentos cai DENTRO da jornada.
//
// Sem isso a parada do almoço virava "90 min de cadeira vazia" na tela. O dono
// fecha pro almoço de propósito, e um número que trata a escolha dele como
// prejuízo queima a confiança no resto do painel logo na primeira olhada.
function buracoReal(fimAnterior: string, inicioSeguinte: string, faixas: FaixaTrabalho[]): number {
  const a = minutoDoDia(fimAnterior);
  const b = minutoDoDia(inicioSeguinte);
  if (b <= a) return 0;
  let dentro = 0;
  for (const f of faixas) {
    const ini = Math.max(a, emMinutos(f.inicio));
    const fim = Math.min(b, emMinutos(f.fim));
    if (fim > ini) dentro += fim - ini;
  }
  return dentro;
}

export default async function PainelAgenda({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string; prof?: string; aviso?: string }>;
}) {
  const { dia: diaParam, prof, aviso } = await searchParams;

  const s = await getSession();
  if (!s) redirect("/login");
  const negocioId = activeNegocioId(s);
  if (!negocioId) redirect("/owner");

  const negocio = await getNegocio(negocioId);
  if (!negocio) redirect("/login");
  const hub = await getHub(negocio.hub_id);
  // Modulo desligado nao e 404 nem tela vazia: volta pra visao geral.
  if (!hub || !modulosEfetivos(negocio, hub).agenda) redirect("/painel");

  const hoje = hojeNoFuso();
  // Dia vindo da URL e do usuario. Se nao for uma data, cai em hoje.
  const dia = diaParam && /^\d{4}-\d{2}-\d{2}$/.test(diaParam) ? diaParam : hoje;

  // A semana entra por cadeiraVazia direto, e nao por resumoAgenda: o resumo
  // completo carrega junto a varredura de clientes sumidos e o cálculo de
  // retorno, que esta tela não usa. Essa é a tela que o dono deixa aberta o dia
  // inteiro, e ela não pode pagar por número que não mostra.
  const [itens, profissionais, servicos, movimento, semana, faixas] = await Promise.all([
    agendaDoDia(negocioId, dia, prof || null),
    listarProfissionais(negocioId),
    listarServicos(negocioId),
    movimentoDoDia(negocioId, dia, prof || null),
    cadeiraVazia(negocioId, 7),
    faixasDoDia(negocioId, dia, prof || null),
  ]);

  const capacidade = semana.reduce((t, d) => t + d.minutos_capacidade, 0);
  const ocupado = semana.reduce((t, d) => t + d.minutos_ocupados, 0);
  const ocupacaoSemana = capacidade === 0 ? 0 : Math.round((ocupado / capacidade) * 100);
  const potencialSemana = semana.reduce((t, d) => t + d.potencial_cent, 0);
  const ehHoje = dia === hoje;

  const base = (p: Record<string, string>) => {
    const q = new URLSearchParams({ ...(prof ? { prof } : {}), ...p });
    return `/painel/agenda?${q.toString()}`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
      <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>
            Agenda
          </h1>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: "6px 0 0", textTransform: "capitalize" }}>
            {porExtenso(dia)}
          </p>
        </div>
        <Link href="/painel/agenda/raio-x" style={{
          padding: "10px 20px", borderRadius: 999, background: "var(--gold)",
          color: "#1a1204", fontSize: 13.5, fontWeight: 700, textDecoration: "none",
        }}>
          Raio-X da cadeira
        </Link>
      </header>

      {/* Erro vira recado, não tela branca: quem opera isso está com um cliente
          na cadeira esperando. */}
      {aviso ? (
        <div style={{
          padding: "12px 16px", borderRadius: "var(--radius-sm)",
          border: `1px solid ${COR.atencao}`, color: COR.atencao, fontSize: 13.5,
        }}>
          {aviso}
        </div>
      ) : null}

      {/* ---------- navegacao de dia ---------- */}
      <nav style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Link href={base({ dia: somaDias(dia, -1) })} style={botao}>Dia anterior</Link>
        <Link href={base({ dia: hoje })} style={ehHoje ? botaoAceso : botao}>Hoje</Link>
        <Link href={base({ dia: somaDias(dia, 1) })} style={botao}>Próximo dia</Link>

        <span style={{ width: 1, height: 22, background: "var(--line)", margin: "0 6px" }} />

        <Link href={`/painel/agenda?dia=${dia}`} style={!prof ? botaoAceso : botao}>
          Todos
        </Link>
        {profissionais.map((p) => (
          <Link
            key={p.id}
            href={`/painel/agenda?dia=${dia}&prof=${p.id}`}
            style={prof === p.id ? botaoAceso : botao}
          >
            {p.apelido || p.nome}
          </Link>
        ))}
      </nav>

      {/* ---------- os quatro numeros ---------- */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 14 }}>
        <Numero rotulo={ehHoje ? "Na agenda hoje" : "Na agenda do dia"}
                valor={String(movimento.agendados)} />
        <Numero rotulo="Já atendidos" valor={String(movimento.concluidos)} />
        <Numero rotulo={ehHoje ? "Caixa de hoje" : "Caixa do dia"}
                valor={emReais(movimento.faturado_cent)} />
        {/* O numero que faz o dono sentar. Nao e "tem horario livre": e quanto
            de dinheiro evapora se a semana ficar como esta. */}
        <Numero
          rotulo="Cadeira vazia na semana"
          valor={emReais(potencialSemana)}
          alerta={ocupacaoSemana < 70}
        />
      </section>

      <FormularioMarcar dia={dia} profissionais={profissionais} servicos={servicos} />

      {/* ---------- a agenda ---------- */}
      <section style={cartao}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>
            {itens.length} {itens.length === 1 ? "horário" : "horários"}
          </h2>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            ocupação da semana {ocupacaoSemana}%
          </span>
        </div>

        {itens.length === 0 ? (
          <Vazio texto="Nenhum horário marcado neste dia." />
        ) : (
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column" }}>
            {itens.map((it, i) => (
              <div key={it.id}>
                {/* Buraco entre um atendimento e o proximo, com tamanho. So
                    conta o que cai DENTRO da jornada, e so acima de 15 minutos:
                    o intervalo de limpeza da cadeira nao e buraco, e parte do
                    servico, e o almoco nao e buraco, e escolha da casa. */}
                {i > 0 && buracoReal(itens[i - 1].fim, it.inicio, faixas) >= 15 ? (
                  <Buraco minutos={buracoReal(itens[i - 1].fim, it.inicio, faixas)} />
                ) : null}
                <Linha it={it} dia={dia} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
//  MARCAR
//
//  Fica fechado por padrão. A tela existe pra olhar o dia, e um formulário
//  aberto empurrando a agenda pra baixo atrapalha as vinte vezes em que o dono
//  só quer ver quem é o próximo.
//
//  Não tem seletor de horário livre ainda: o dono digita a hora e quem recusa
//  conflito é o banco, com a mensagem certa de volta. É honesto e funciona
//  desde já. A grade de horários entra junto com o site público, onde ela é
//  obrigatória, porque lá quem escolhe é o cliente e ele não conhece a agenda.
// ---------------------------------------------------------------------------
function FormularioMarcar({
  dia, profissionais, servicos,
}: { dia: string; profissionais: Profissional[]; servicos: Servico[] }) {
  if (profissionais.length === 0 || servicos.length === 0) {
    return (
      <section style={cartao}>
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--muted)" }}>
          Antes de marcar horário, cadastre{" "}
          {profissionais.length === 0 ? <Link href="/painel/equipe">a equipe</Link> : null}
          {profissionais.length === 0 && servicos.length === 0 ? " e " : null}
          {servicos.length === 0 ? <Link href="/painel/servicos">os serviços</Link> : null}.
        </p>
      </section>
    );
  }

  return (
    <details style={cartao}>
      <summary style={{ cursor: "pointer", fontSize: 15, fontWeight: 600, listStyle: "none" }}>
        + Marcar horário
      </summary>

      <form action={acaoMarcar} style={{ marginTop: 18, display: "grid", gap: 14 }}>
        <input type="hidden" name="dia" value={dia} />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>
          <Campo rotulo="Cliente">
            <input name="cliente_nome" required style={entrada} placeholder="Nome de quem vai sentar" />
          </Campo>
          <Campo rotulo="WhatsApp">
            {/* Sem o telefone o lembrete não sai e o cliente não entra na conta
                de quem sumiu. Não é obrigatório, mas é quase tudo. */}
            <input name="cliente_telefone" style={entrada} placeholder="49 99999 0000" inputMode="tel" />
          </Campo>
          <Campo rotulo="Hora">
            <input name="hora" type="time" required step={900} style={entrada} />
          </Campo>
          <Campo rotulo="Profissional">
            <select name="profissional_id" required style={entrada}>
              {profissionais.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </Campo>
        </div>

        <Campo rotulo="Serviços">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
            {servicos.map((sv) => (
              <label key={sv.id} style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                padding: "8px 13px", borderRadius: 999, border: "1px solid var(--line)",
                fontSize: 13, cursor: "pointer",
              }}>
                <input type="checkbox" name="servico_id" value={sv.id} />
                {sv.nome}
                <span style={{ color: "var(--muted)" }}>
                  {sv.duracao_min}min · {emReais(sv.preco_cent)}
                </span>
              </label>
            ))}
          </div>
        </Campo>

        <Campo rotulo="Observação">
          <input name="observacao" style={entrada} placeholder="Máquina 2 nas laterais, por exemplo" />
        </Campo>

        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <button type="submit" style={botaoPrimario}>Marcar</button>
          <label style={{ fontSize: 13, color: "var(--muted-2)", display: "flex", gap: 7, alignItems: "center", justifySelf: "start", width: "fit-content" }}>
            <input type="checkbox" name="origem" value="encaixe" />
            É encaixe, fora da grade
          </label>
        </div>
      </form>
    </details>
  );
}

// ---------------------------------------------------------------------------
function Linha({ it, dia }: { it: ItemAgenda; dia: string }) {
  const apagado = it.status === "faltou" || it.status === "concluido";
  const cor = it.status === "faltou" ? COR.critico
    : it.status === "em_atendimento" ? COR.ok
    : it.profissional_cor || "var(--muted-2)";

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 14,
      padding: "13px 0", borderTop: "1px solid var(--line)",
      opacity: apagado ? 0.6 : 1,
    }}>
      <div style={{ width: 52, flexShrink: 0, fontSize: 14, fontWeight: 700, paddingTop: 1 }}>
        {hora(it.inicio)}
      </div>
      <span style={{
        width: 7, height: 7, borderRadius: 999, background: cor,
        flexShrink: 0, marginTop: 7,
      }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <strong style={{ fontSize: 14.5 }}>{it.cliente_nome}</strong>
          <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
            {it.profissional_nome}
          </span>
          {it.status !== "confirmado" ? (
            <span style={{
              fontSize: 11, padding: "2px 8px", borderRadius: 999,
              border: `1px solid ${it.status === "faltou" ? COR.critico : "var(--line)"}`,
              color: it.status === "faltou" ? COR.critico : "var(--muted)",
            }}>
              {ROTULO_STATUS[it.status] ?? it.status}
            </span>
          ) : null}
        </div>
        <div style={{ fontSize: 13, color: "var(--muted-2)", marginTop: 3 }}>
          {it.servicos.length ? it.servicos.join(", ") : "sem serviço lançado"}
          <span style={{ color: "var(--muted)" }}>
            {" · "}{minutosEntre(it.inicio, it.fim)} min
          </span>
        </div>
        {/* Alerta e alergia, quimica, o que der problema. Vermelho e de
            proposito: e a linha que nao pode passar batido. */}
        {it.cliente_alerta ? (
          <div style={{ fontSize: 12.5, color: COR.critico, marginTop: 4 }}>
            {it.cliente_alerta}
          </div>
        ) : null}

        <Acoes it={it} dia={dia} />
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{emReais(it.preco_previsto_cent)}</div>
        {it.cliente_telefone ? (
          <a
            href={`https://wa.me/${it.cliente_telefone}`}
            style={{ fontSize: 12, color: "var(--muted)", textDecoration: "none" }}
          >
            WhatsApp
          </a>
        ) : null}
      </div>
    </div>
  );
}

// Só aparece o que faz sentido para o estado atual. Botão que não leva a nada
// ensina a pessoa a não clicar em mais nenhum.
function Acoes({ it, dia }: { it: ItemAgenda; dia: string }) {
  const mudar = (para: Parameters<typeof acaoMudarStatus>[1]) =>
    acaoMudarStatus.bind(null, it.id, para, dia);
  const aberto = it.status === "pendente" || it.status === "confirmado" || it.status === "em_atendimento";

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 9 }}>
      {it.status === "pendente" ? (
        <form action={mudar("confirmado")}><button style={acao}>Confirmar</button></form>
      ) : null}

      {it.status === "confirmado" ? (
        <form action={mudar("em_atendimento")}><button style={acao}>Na cadeira</button></form>
      ) : null}

      {aberto ? (
        <>
          <Concluir it={it} dia={dia} />
          <form action={mudar("faltou")}><button style={acao}>Faltou</button></form>
          <details style={{ display: "inline-block" }}>
            <summary style={{ ...acao, listStyle: "none", display: "inline-block" }}>Cancelar</summary>
            <form action={acaoCancelar.bind(null, it.id, dia)}
                  style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              <input name="motivo" placeholder="Motivo, opcional"
                     style={{ ...entrada, width: 190, marginTop: 0 }} />
              <button style={{ ...acao, borderColor: COR.critico, color: COR.critico }}>
                Confirmar cancelamento
              </button>
            </form>
          </details>
        </>
      ) : null}

      {/* Reabrir CANCELA a comanda, não apaga: comanda que some leva junto o
          faturamento do dia e a comissão que o barbeiro já conferiu. */}
      {it.status === "concluido" ? (
        <form action={acaoReabrir.bind(null, it.id, dia)}>
          <button style={acao}>Reabrir</button>
        </form>
      ) : null}

      {it.status === "faltou" ? (
        <form action={mudar("confirmado")}><button style={acao}>Desfazer falta</button></form>
      ) : null}
    </div>
  );
}

// Fechar o atendimento é o momento em que o serviço vira dinheiro: sai comanda
// e sai comissão. A forma de pagamento é perguntada aqui, e não depois, porque
// depois ninguém volta pra preencher e o mês fecha sem saber quanto foi cartão,
// que é justamente o que come a margem.
function Concluir({ it, dia }: { it: ItemAgenda; dia: string }) {
  return (
    <details style={{ display: "inline-block" }}>
      <summary style={{
        ...acao, listStyle: "none", display: "inline-block",
        borderColor: "var(--gold)", color: "var(--gold)",
      }}>
        Concluir
      </summary>
      <form action={acaoConcluir.bind(null, it.id, dia)}
            style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
        <select name="forma_pagamento" style={{ ...entrada, width: 130, marginTop: 0 }} defaultValue="pix">
          <option value="dinheiro">Dinheiro</option>
          <option value="pix">Pix</option>
          <option value="debito">Débito</option>
          <option value="credito">Crédito</option>
          <option value="pacote">Pacote</option>
          <option value="cortesia">Cortesia</option>
        </select>
        <input name="desconto" placeholder="Desconto" inputMode="decimal"
               style={{ ...entrada, width: 110, marginTop: 0 }} />
        <button style={{ ...acao, borderColor: "var(--gold)", color: "var(--gold)" }}>
          Fechar {emReais(it.preco_previsto_cent)}
        </button>
      </form>
    </details>
  );
}

function Buraco({ minutos }: { minutos: number }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "7px 0 7px 66px", borderTop: "1px solid var(--line)",
      fontSize: 12.5, color: "var(--muted)",
    }}>
      <span style={{ flex: 1, height: 1, background: "var(--line)", maxWidth: 40 }} />
      {minutos} min de cadeira vazia
    </div>
  );
}

function Numero({ rotulo, valor, alerta = false }: { rotulo: string; valor: string; alerta?: boolean }) {
  return (
    <div style={cartao}>
      <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{rotulo}</div>
      <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4, color: alerta ? COR.atencao : "var(--text)" }}>
        {valor}
      </div>
    </div>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{rotulo}</span>
      {children}
    </label>
  );
}

function Vazio({ texto }: { texto: string }) {
  return <p style={{ color: "var(--muted)", fontSize: 13.5, margin: "16px 0 4px" }}>{texto}</p>;
}

const cartao: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius)",
  padding: "18px 20px",
};

const botao: React.CSSProperties = {
  padding: "7px 14px", borderRadius: 999, fontSize: 13,
  border: "1px solid var(--line)", color: "var(--muted-2)", textDecoration: "none",
};

const botaoAceso: React.CSSProperties = {
  ...botao,
  color: "var(--text)",
  background: "rgba(255,255,255,0.07)",
  fontWeight: 600,
};

const botaoPrimario: React.CSSProperties = {
  padding: "10px 22px", borderRadius: 999, background: "var(--gold)",
  color: "#1a1204", fontSize: 13.5, fontWeight: 700, border: "none", cursor: "pointer",
};

const acao: React.CSSProperties = {
  padding: "5px 11px", borderRadius: 999, fontSize: 12,
  border: "1px solid var(--line)", background: "transparent",
  color: "var(--muted-2)", cursor: "pointer",
};

const entrada: React.CSSProperties = {
  width: "100%", marginTop: 5, padding: "9px 12px",
  borderRadius: "var(--radius-sm)", border: "1px solid var(--line)",
  background: "rgba(0,0,0,0.25)", color: "var(--text)", fontSize: 13.5,
};
