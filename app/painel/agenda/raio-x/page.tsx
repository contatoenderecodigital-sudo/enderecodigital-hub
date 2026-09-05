import { redirect } from "next/navigation";
import Link from "@/components/link";
import { getSession } from "@/lib/auth";
import { getNegocio, getHub } from "@/lib/data";
import { modulosEfetivos } from "@/lib/types";
import { activeNegocioId } from "@/lib/tenant";
import {
  clientesSumidos, cadeiraVazia, faltosos, desempenhoProfissionais,
  resumoAgenda, emReais, FUSO,
  type ClienteSumido, type CadeiraVazia,
} from "@/lib/agenda";

// ============================================================================
//  PAINEL · RAIO-X DA CADEIRA
//
//  A tela que ganha a reuniao. Nao e relatorio: relatorio todo sistema tem, o
//  dono abre uma vez, acha bonito e nunca mais entra.
//
//  Barbearia vive de recorrencia, e o dono nao enxerga a sangria porque so olha
//  a agenda de hoje. A de hoje esta cheia. A de daqui a tres semanas esta
//  esvaziando e ninguem percebeu.
//
//  A LINHA DIZ O MOTIVO, nao so o sintoma. "Cliente sumido" e sintoma. "Joao
//  corta a cada 21 dias e esta em 38, ticket de R$ 65, cortava com o Alex" e o
//  motivo, e termina num botao que manda a mensagem pronta.
//
//  TODA LINHA CRITICA TEM ACAO. Lista sem botao vira lista que ninguem
//  trabalha, e ai o raio-X vira relatorio de novo.
// ============================================================================

export const dynamic = "force-dynamic";

const COR = {
  critico: "#f08a8a",
  atencao: "#e6b45c",
  ok: "#6fd39b",
} as const;

function hojeNoFuso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(new Date());
}

function somaDias(dia: string, n: number): string {
  const d = new Date(dia + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function diaCurto(dia: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short", day: "2-digit", timeZone: "UTC",
  }).format(new Date(dia + "T12:00:00Z"));
}

// A mensagem sai pronta e sem gíria, no tom de quem atende bem. Se o dono
// tiver que escrever cada uma, ele manda tres e para.
function convite(c: ClienteSumido, barbearia: string): string {
  const primeiro = c.nome.split(" ")[0];
  const com = c.profissional_nome ? ` com o ${c.profissional_nome.split(" ")[0]}` : "";
  return `Olá ${primeiro}, aqui é da ${barbearia}. Vi que faz ${c.dias_sem_vir} dias desde o seu último corte${com}. Quer que eu já separe um horário para você esta semana?`;
}

export default async function RaioXCadeira() {
  const s = await getSession();
  if (!s) redirect("/login");
  const negocioId = activeNegocioId(s);
  if (!negocioId) redirect("/owner");

  const negocio = await getNegocio(negocioId);
  if (!negocio) redirect("/login");
  const hub = await getHub(negocio.hub_id);
  if (!hub || !modulosEfetivos(negocio, hub).agenda) redirect("/painel");

  const nome = negocio.nome_fantasia || negocio.nome;
  const hoje = hojeNoFuso();

  const [resumo, sumidos, semana, faltas, equipe] = await Promise.all([
    resumoAgenda(negocioId),
    clientesSumidos(negocioId, 300),
    cadeiraVazia(negocioId, 7),
    faltosos(negocioId, 90),
    desempenhoProfissionais(negocioId, somaDias(hoje, -30), hoje),
  ]);

  const criticos = sumidos.filter((c) => c.gravidade === "critico");
  const receitaEmRisco = criticos.reduce((t, c) => t + c.ticket_medio_cent, 0);

  // Numa base de barbearia essa lista passa de cem nomes, e cem linhas com um
  // botão em cada vira parede: ninguém trabalha uma parede. Aparecem os mais
  // urgentes, e o tamanho do resto vira uma frase, que é a informação que o
  // dono precisa pra decidir se chama um a um ou se dispara uma campanha.
  const MOSTRAR = 15;
  const visiveis = sumidos.slice(0, MOSTRAR);
  const restantes = sumidos.length - visiveis.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
      <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>
            Raio-X da cadeira
          </h1>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: "6px 0 0" }}>
            O que fazer esta semana, com nome e sobrenome.
          </p>
        </div>
        <Link href="/painel/agenda" style={{
          padding: "10px 20px", borderRadius: 999, border: "1px solid var(--line)",
          color: "var(--text)", fontSize: 13.5, textDecoration: "none",
        }}>
          Voltar para a agenda
        </Link>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 14 }}>
        <Numero rotulo="Clientes indo embora" valor={String(criticos.length)} alerta={criticos.length > 0} />
        <Numero rotulo="Receita em risco" valor={emReais(receitaEmRisco)} />
        <Numero rotulo="Cadeira vazia na semana" valor={emReais(resumo.semana_potencial_cent)} />
        {/* Retorno em 30 dias e o numero que diz se a barbearia esta crescendo
            ou so trocando de cliente. Abaixo de 50% ela troca. */}
        <Numero rotulo="Voltaram em 30 dias" valor={`${resumo.retorno_pct}%`} alerta={resumo.retorno_pct < 50} />
      </section>

      {/* ---------- clientes sumidos ---------- */}
      <section style={cartao}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Clientes indo embora</h2>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            {sumidos.length} no total · comparado ao ritmo de cada um, não a prazo de tabela
          </span>
        </div>

        {sumidos.length === 0 ? (
          <Vazio texto="Ninguém atrasado no ritmo dele. Isso é bom." />
        ) : (
          <div style={{ overflowX: "auto", marginTop: 14 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 640 }}>
              <thead>
                <tr style={{ color: "var(--muted)", textAlign: "left" }}>
                  <th style={th}>Cliente</th>
                  <th style={{ ...th, textAlign: "right" }}>Sem vir</th>
                  <th style={{ ...th, textAlign: "right" }}>Costuma</th>
                  <th style={{ ...th, textAlign: "right" }}>Ticket</th>
                  <th style={{ ...th, textAlign: "right" }}>Chamar</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((c) => (
                  <LinhaSumido key={c.id} c={c} barbearia={nome} />
                ))}
              </tbody>
            </table>
            {restantes > 0 ? (
              <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "14px 0 0" }}>
                Mais {restantes} {restantes === 1 ? "cliente" : "clientes"} na mesma
                situação, fora os {MOSTRAR} mais urgentes acima. Acima de umas vinte
                pessoas, sai mais barato disparar uma campanha do que chamar uma a uma.
              </p>
            ) : null}
          </div>
        )}
      </section>

      {/* ---------- cadeira vazia ---------- */}
      <section style={cartao}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Cadeira vazia, próximos 7 dias</h2>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            valor pelo que a casa fatura por minuto, não pela tabela de preços
          </span>
        </div>

        {semana.every((d) => d.minutos_capacidade === 0) ? (
          <Vazio texto="Nenhuma jornada cadastrada ainda, então não dá para dizer o que está vazio." />
        ) : (
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 9 }}>
            {semana.map((d) => (
              <LinhaDia key={d.dia} d={d} />
            ))}
          </div>
        )}
      </section>

      {/* ---------- faltas ---------- */}
      <section style={cartao}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Quem falta</h2>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>últimos 90 dias</span>
        </div>

        {faltas.length === 0 ? (
          <Vazio texto="Nenhuma falta registrada no período." />
        ) : (
          <div style={{ overflowX: "auto", marginTop: 14 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 520 }}>
              <thead>
                <tr style={{ color: "var(--muted)", textAlign: "left" }}>
                  <th style={th}>Cliente</th>
                  <th style={{ ...th, textAlign: "right" }}>Faltas</th>
                  <th style={{ ...th, textAlign: "right" }}>Das marcações</th>
                  <th style={{ ...th, textAlign: "right" }}>Deixou de entrar</th>
                </tr>
              </thead>
              <tbody>
                {faltas.map((f) => (
                  <tr key={f.id} style={{ borderTop: "1px solid var(--line)" }}>
                    <td style={td}>{f.nome}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 600, color: f.faltas >= 3 ? COR.critico : "var(--text)" }}>
                      {f.faltas}
                    </td>
                    <td style={{ ...td, textAlign: "right", color: "var(--muted-2)" }}>{f.taxa_pct}%</td>
                    <td style={{ ...td, textAlign: "right", color: "var(--muted-2)" }}>{emReais(f.perdido_cent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* A conclusao vem escrita. O dono nao precisa deduzir a regra. */}
            <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "14px 0 0" }}>
              Cliente com três faltas ou mais é candidato a sinal na marcação, sem
              mexer no resto da clientela.
            </p>
          </div>
        )}
      </section>

      {/* ---------- equipe ---------- */}
      <section style={cartao}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>A equipe nos últimos 30 dias</h2>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>faturamento, ticket e o quanto vende de produto</span>
        </div>

        {equipe.length === 0 ? (
          <Vazio texto="Nenhum profissional cadastrado ainda." />
        ) : (
          <div style={{ overflowX: "auto", marginTop: 14 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 620 }}>
              <thead>
                <tr style={{ color: "var(--muted)", textAlign: "left" }}>
                  <th style={th}>Profissional</th>
                  <th style={{ ...th, textAlign: "right" }}>Atendeu</th>
                  <th style={{ ...th, textAlign: "right" }}>Faturou</th>
                  <th style={{ ...th, textAlign: "right" }}>Ticket</th>
                  <th style={{ ...th, textAlign: "right" }}>Produto</th>
                  <th style={{ ...th, textAlign: "right" }}>Nota</th>
                </tr>
              </thead>
              <tbody>
                {equipe.map((p) => (
                  <tr key={p.id} style={{ borderTop: "1px solid var(--line)" }}>
                    <td style={td}><strong>{p.nome}</strong></td>
                    <td style={{ ...td, textAlign: "right", color: "var(--muted-2)" }}>{p.atendimentos}</td>
                    <td style={{ ...td, textAlign: "right" }}>{emReais(p.faturamento_cent)}</td>
                    <td style={{ ...td, textAlign: "right", color: "var(--muted-2)" }}>{emReais(p.ticket_medio_cent)}</td>
                    {/* Barbeiro que corta bem e nunca vende pomada aparece
                        aqui. E conversa de treinamento, nao de demissao. */}
                    <td style={{ ...td, textAlign: "right", color: p.produto_pct < 5 ? COR.atencao : "var(--muted-2)" }}>
                      {p.produto_pct}%
                    </td>
                    <td style={{ ...td, textAlign: "right", color: "var(--muted-2)" }}>
                      {p.nota_media === null ? "·" : p.nota_media.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function LinhaSumido({ c, barbearia }: { c: ClienteSumido; barbearia: string }) {
  const cor = c.gravidade === "critico" ? COR.critico : COR.atencao;
  return (
    <tr style={{ borderTop: "1px solid var(--line)" }}>
      <td style={td}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: cor, flexShrink: 0 }} />
          <span>
            <strong>{c.nome}</strong>
            {c.profissional_nome ? (
              <span style={{ color: "var(--muted)" }}> corta com {c.profissional_nome}</span>
            ) : null}
          </span>
        </span>
      </td>
      <td style={{ ...td, textAlign: "right", color: cor, fontWeight: 600 }}>{c.dias_sem_vir}d</td>
      <td style={{ ...td, textAlign: "right", color: "var(--muted-2)" }}>a cada {c.intervalo_dias}d</td>
      <td style={{ ...td, textAlign: "right" }}>{emReais(c.ticket_medio_cent)}</td>
      <td style={{ ...td, textAlign: "right" }}>
        {c.telefone ? (
          <a
            href={`https://wa.me/${c.telefone}?text=${encodeURIComponent(convite(c, barbearia))}`}
            style={{
              padding: "6px 13px", borderRadius: 999, border: "1px solid var(--line)",
              fontSize: 12.5, color: "var(--text)", textDecoration: "none", whiteSpace: "nowrap",
            }}
          >
            WhatsApp
          </a>
        ) : (
          <span style={{ color: "var(--muted)", fontSize: 12.5 }}>sem telefone</span>
        )}
      </td>
    </tr>
  );
}

function LinhaDia({ d }: { d: CadeiraVazia }) {
  const cheio = d.minutos_capacidade === 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ width: 74, flexShrink: 0, fontSize: 13, color: "var(--muted-2)", textTransform: "capitalize" }}>
        {diaCurto(d.dia)}
      </span>
      <span style={{ flex: 1, height: 9, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "hidden", minWidth: 60 }}>
        <span style={{
          display: "block", height: "100%", width: `${d.ocupacao_pct}%`,
          background: d.ocupacao_pct >= 80 ? COR.ok : d.ocupacao_pct >= 50 ? COR.atencao : COR.critico,
        }} />
      </span>
      <span style={{ width: 46, textAlign: "right", fontSize: 13, color: "var(--muted-2)", flexShrink: 0 }}>
        {cheio ? "·" : `${d.ocupacao_pct}%`}
      </span>
      <span style={{ width: 92, textAlign: "right", fontSize: 13, flexShrink: 0 }}>
        {cheio ? <span style={{ color: "var(--muted)" }}>fechado</span> : emReais(d.potencial_cent)}
      </span>
    </div>
  );
}

function Numero({ rotulo, valor, alerta = false }: { rotulo: string; valor: string; alerta?: boolean }) {
  return (
    <div style={cartao}>
      <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{rotulo}</div>
      <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4, color: alerta ? COR.critico : "var(--text)" }}>
        {valor}
      </div>
    </div>
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

const th: React.CSSProperties = { padding: "0 10px 10px", fontWeight: 500, fontSize: 12 };
const td: React.CSSProperties = { padding: "11px 10px" };
