import { redirect } from "next/navigation";
import Link from "@/components/link";
import { getSession } from "@/lib/auth";
import { getNegocio, getHub } from "@/lib/data";
import { modulosEfetivos } from "@/lib/types";
import { activeNegocioId } from "@/lib/tenant";
import { resumoPatio, raioX, emReais, CORTE_CRITICO } from "@/lib/veiculos";
// emReais entra com apelido: o do modulo de Veiculos arredonda pro real
// inteiro, porque carro custa dezenas de milhares e centavo ali e ruido. Em
// barbearia, corte de R$ 45,00 virando "R$ 45" e o tipo de detalhe que faz o
// dono achar que o sistema arredonda o dinheiro dele.
import { resumoAgenda, clientesSumidos, emReais as emReaisAgenda } from "@/lib/agenda";

// ============================================================================
//  PAINEL · VISAO GERAL
//
//  A primeira tela do cliente. Ela nao lista tudo que existe: mostra o que
//  mudou e o que precisa de decisao hoje. Painel que abre com menu de modulos
//  obriga a pessoa a escolher onde procurar problema, e ela nao procura.
// ============================================================================

export const dynamic = "force-dynamic";

export default async function PainelInicio() {
  const s = await getSession();
  if (!s) redirect("/login");
  const negocioId = activeNegocioId(s);
  if (!negocioId) redirect(s.papel === "owner_plataforma" ? "/owner" : "/login");

  const negocio = await getNegocio(negocioId);
  if (!negocio) redirect("/login");

  const nome = negocio.nome_fantasia || negocio.nome;

  // Só busca dado de veículo se o módulo estiver ligado. Cliente de padaria não
  // paga consulta de pátio.
  const hub = await getHub(negocio.hub_id);
  const mods = hub ? modulosEfetivos(negocio, hub) : null;

  const veiculos = mods?.veiculos
    ? await Promise.all([resumoPatio(negocioId), raioX(negocioId)])
    : null;

  const criticos = veiculos ? veiculos[1].filter((l) => l.gravidade === "critico") : [];

  // Mesma regra do pátio: só consulta agenda se o módulo estiver ligado.
  const agenda = mods?.agenda
    ? await Promise.all([resumoAgenda(negocioId), clientesSumidos(negocioId, 300)])
    : null;

  const sumindo = agenda ? agenda[1].filter((c) => c.gravidade === "critico") : [];
  const nenhumModulo = !veiculos && !agenda;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <header>
        <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>
          Olá, {nome}
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 14, margin: "6px 0 0" }}>
          O que precisa de você hoje.
        </p>
      </header>

      {veiculos ? (
        <section style={cartao}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Pátio</h2>
            <Link href="/painel/veiculos" style={{ fontSize: 13, color: "var(--gold)" }}>
              Ver o raio-X
            </Link>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 26, marginTop: 14 }}>
            <Dado rotulo="No pátio" valor={String(veiculos[0].disponiveis)} />
            <Dado rotulo={`Parados +${CORTE_CRITICO}d`} valor={String(veiculos[0].parados)} alerta={veiculos[0].parados > 0} />
            <Dado rotulo="Capital parado" valor={emReais(Number(veiculos[0].capital_cent))} />
            <Dado rotulo="Vendidos no mês" valor={String(veiculos[0].vendidos_mes)} />
          </div>

          {criticos.length > 0 ? (
            <p style={{ marginTop: 16, fontSize: 13.5, color: "var(--muted-2)", lineHeight: 1.6 }}>
              <strong style={{ color: "#f08a8a" }}>
                {criticos.length === 1
                  ? `O ${criticos[0].marca} ${criticos[0].modelo} está há ${criticos[0].dias_parado} dias no pátio`
                  : `${criticos.length} carros passaram de ${CORTE_CRITICO} dias`}
              </strong>
              . Vale revisar preço antes que a margem vá embora.
            </p>
          ) : (
            <p style={{ marginTop: 16, fontSize: 13.5, color: "var(--muted)" }}>
              Nenhum carro passou de {CORTE_CRITICO} dias. Pátio girando.
            </p>
          )}
        </section>
      ) : null}

      {agenda ? (
        <section style={cartao}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Cadeira</h2>
            <Link href="/painel/agenda/raio-x" style={{ fontSize: 13, color: "var(--gold)" }}>
              Ver o raio-X
            </Link>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 26, marginTop: 14 }}>
            <Dado rotulo="Na agenda hoje" valor={String(agenda[0].hoje_agendados)} />
            <Dado rotulo="Caixa de hoje" valor={emReaisAgenda(agenda[0].hoje_faturado_cent)} />
            <Dado rotulo="Ocupação da semana" valor={`${agenda[0].semana_ocupacao_pct}%`}
                  alerta={agenda[0].semana_ocupacao_pct < 70} />
            <Dado rotulo="Voltaram em 30 dias" valor={`${agenda[0].retorno_pct}%`}
                  alerta={agenda[0].retorno_pct < 50} />
          </div>

          {/* A frase diz o que fazer, não o que aconteceu. "12 clientes
              sumidos" é dado; "12 clientes valendo R$ 640 e a terça está com
              buraco" é a decisão da semana. */}
          {sumindo.length > 0 ? (
            <p style={{ marginTop: 16, fontSize: 13.5, color: "var(--muted-2)", lineHeight: 1.6 }}>
              <strong style={{ color: "#f08a8a" }}>
                {sumindo.length === 1
                  ? `${sumindo[0].nome.split(" ")[0]} está há ${sumindo[0].dias_sem_vir} dias sem cortar`
                  : `${sumindo.length} clientes passaram do próprio ritmo`}
              </strong>
              , e a semana tem {emReaisAgenda(agenda[0].semana_potencial_cent)} de cadeira vazia.
              Chamar quem sumiu enche o buraco sem gastar com anúncio.
            </p>
          ) : (
            <p style={{ marginTop: 16, fontSize: 13.5, color: "var(--muted)" }}>
              Ninguém atrasado no próprio ritmo. A recorrência está de pé.
            </p>
          )}
        </section>
      ) : null}

      {nenhumModulo ? (
        <section style={cartao}>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
            Nenhum módulo ligado ainda. Fale com a Endereço Digital pra liberar.
          </p>
        </section>
      ) : null}
    </div>
  );
}

function Dado({ rotulo, valor, alerta = false }: { rotulo: string; valor: string; alerta?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{rotulo}</div>
      <div style={{ fontSize: 24, fontWeight: 700, marginTop: 2, color: alerta ? "#f08a8a" : "var(--text)" }}>
        {valor}
      </div>
    </div>
  );
}

const cartao: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius)",
  padding: "18px 20px",
};
