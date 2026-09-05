import { redirect, notFound } from "next/navigation";
import Link from "@/components/link";
import { getSession } from "@/lib/auth";
import { getNegocio, getHub } from "@/lib/data";
import { modulosEfetivos } from "@/lib/types";
import { activeNegocioId } from "@/lib/tenant";
import { listarProfissionais, jornadaDoProfissional } from "@/lib/agenda";
import { acaoAtualizarProfissional, acaoSalvarJornada } from "../../agenda/acoes";

// ============================================================================
//  PAINEL · FICHA DO PROFISSIONAL
//
//  Dados e jornada da semana. A jornada mora aqui, e não na lista, porque são
//  sete dias com turno partido: sete linhas por barbeiro dentro de uma lista de
//  barbeiros vira uma parede que ninguém edita direito.
//
//  A JORNADA SALVA A SEMANA INTEIRA DE UMA VEZ. Editar faixa a faixa deixaria a
//  jornada pela metade se a tela quebrasse no meio, e meia jornada faz a agenda
//  oferecer horário que não existe.
// ============================================================================

export const dynamic = "force-dynamic";

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export default async function FichaProfissional({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aviso?: string }>;
}) {
  const { id } = await params;
  const { aviso } = await searchParams;

  const s = await getSession();
  if (!s) redirect("/login");
  const negocioId = activeNegocioId(s);
  if (!negocioId) redirect("/owner");

  const negocio = await getNegocio(negocioId);
  if (!negocio) redirect("/login");
  const hub = await getHub(negocio.hub_id);
  if (!hub || !modulosEfetivos(negocio, hub).agenda) redirect("/painel");

  // A busca passa pela lista escopada por negócio. Id vindo da URL é do
  // usuário, e usuário mente: se este id for de outra barbearia, não acha.
  const equipe = await listarProfissionais(negocioId, true);
  const p = equipe.find((x) => x.id === id);
  if (!p) notFound();

  const jornada = await jornadaDoProfissional(negocioId, id);

  // Duas faixas por dia. Elas são o PRIMEIRO e o SEGUNDO turno, não "manhã" e
  // "tarde": quem abre só à tarde tem um turno só, e chamar aquilo de manhã na
  // tela seria a coluna mentindo sobre o próprio conteúdo.
  const porDia = DIAS.map((_, dow) => {
    const faixas = jornada.filter((j) => j.dia_semana === dow).sort((a, b) => a.inicio.localeCompare(b.inicio));
    return {
      abre: faixas.length > 0,
      manha: faixas[0] ?? null,
      tarde: faixas[1] ?? null,
    };
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
      <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>
            {p.nome}
          </h1>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: "6px 0 0" }}>
            {p.ativo ? "Atendendo" : "Arquivado"}
            {p.filial_nome ? ` · ${p.filial_nome}` : ""}
          </p>
        </div>
        <Link href="/painel/equipe" style={{
          padding: "10px 20px", borderRadius: 999, border: "1px solid var(--line)",
          color: "var(--text)", fontSize: 13.5, textDecoration: "none",
        }}>
          Voltar para a equipe
        </Link>
      </header>

      {aviso ? (
        <div style={{
          padding: "12px 16px", borderRadius: "var(--radius-sm)",
          border: "1px solid #6fd39b", color: "#6fd39b", fontSize: 13.5,
        }}>
          {aviso}
        </div>
      ) : null}

      {/* ---------- dados ---------- */}
      <section style={cartao}>
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Dados</h2>
        <form action={acaoAtualizarProfissional.bind(null, p.id)}
              style={{ marginTop: 16, display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>
            <Campo rotulo="Nome">
              <input name="nome" required defaultValue={p.nome} style={entrada} />
            </Campo>
            <Campo rotulo="Como aparece na agenda">
              <input name="apelido" defaultValue={p.apelido ?? ""} style={entrada} />
            </Campo>
            <Campo rotulo="WhatsApp">
              <input name="telefone" defaultValue={p.telefone ?? ""} style={entrada} inputMode="tel" />
            </Campo>
            <Campo rotulo="Comissão em serviço">
              <input name="comissao" defaultValue={p.comissao_servico_pct ?? ""}
                     placeholder="padrão da casa" style={entrada} inputMode="numeric" />
            </Campo>
            <Campo rotulo="Cor na agenda">
              <input name="cor" type="color" defaultValue={p.cor ?? "#c9a227"}
                     style={{ ...entrada, width: 56, height: 42, padding: 4 }} />
            </Campo>
            <Campo rotulo="Ordem na lista">
              <input name="ordem" defaultValue={p.ordem} style={entrada} inputMode="numeric" />
            </Campo>
          </div>

          <label style={{ fontSize: 13, color: "var(--muted-2)", display: "flex", gap: 7, alignItems: "center", justifySelf: "start", width: "fit-content" }}>
            <input type="checkbox" name="aceita_online" defaultChecked={p.aceita_online} />
            Aceita agendamento pelo site e pelo WhatsApp
          </label>

          <div>
            <button type="submit" style={botaoPrimario}>Salvar dados</button>
          </div>
        </form>
      </section>

      {/* ---------- jornada ---------- */}
      <section style={cartao}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Jornada da semana</h2>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            quem não fecha pro almoço usa só o primeiro turno
          </span>
        </div>

        <form action={acaoSalvarJornada.bind(null, p.id)} style={{ marginTop: 16 }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 560 }}>
              <thead>
                <tr style={{ color: "var(--muted)", textAlign: "left" }}>
                  <th style={th}>Dia</th>
                  <th style={th}>Abre</th>
                  <th style={th}>Primeiro turno</th>
                  <th style={th}>Segundo turno</th>
                </tr>
              </thead>
              <tbody>
                {DIAS.map((nome, dow) => {
                  const d = porDia[dow];
                  return (
                    <tr key={dow} style={{ borderTop: "1px solid var(--line)" }}>
                      <td style={td}>{nome}</td>
                      <td style={td}>
                        <input type="checkbox" name={`abre_${dow}`} defaultChecked={d.abre} />
                      </td>
                      <td style={td}>
                        <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                          <input type="time" name={`manha_ini_${dow}`} step={900}
                                 defaultValue={d.manha?.inicio.slice(0, 5) ?? "09:00"} style={hora} />
                          <span style={{ color: "var(--muted)" }}>até</span>
                          <input type="time" name={`manha_fim_${dow}`} step={900}
                                 defaultValue={d.manha?.fim.slice(0, 5) ?? "12:00"} style={hora} />
                        </span>
                      </td>
                      <td style={td}>
                        <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                          <input type="time" name={`tarde_ini_${dow}`} step={900}
                                 defaultValue={d.tarde?.inicio.slice(0, 5) ?? ""} style={hora} />
                          <span style={{ color: "var(--muted)" }}>até</span>
                          <input type="time" name={`tarde_fim_${dow}`} step={900}
                                 defaultValue={d.tarde?.fim.slice(0, 5) ?? ""} style={hora} />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 18 }}>
            <button type="submit" style={botaoPrimario}>Salvar jornada</button>
          </div>
        </form>

        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "16px 0 0" }}>
          A jornada é o que define a capacidade da cadeira. Sem ela, o raio-X não
          tem contra o que comparar e o número de cadeira vazia some da tela.
        </p>
      </section>
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

const entrada: React.CSSProperties = {
  width: "100%", marginTop: 5, padding: "9px 12px",
  borderRadius: "var(--radius-sm)", border: "1px solid var(--line)",
  background: "rgba(0,0,0,0.25)", color: "var(--text)", fontSize: 13.5,
};

const hora: React.CSSProperties = {
  padding: "7px 10px", borderRadius: "var(--radius-sm)",
  border: "1px solid var(--line)", background: "rgba(0,0,0,0.25)",
  color: "var(--text)", fontSize: 13,
};

const th: React.CSSProperties = { padding: "0 10px 10px", fontWeight: 500, fontSize: 12 };
const td: React.CSSProperties = { padding: "11px 10px" };
