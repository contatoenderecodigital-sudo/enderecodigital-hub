import { redirect } from "next/navigation";
import Link from "@/components/link";
import { getSession } from "@/lib/auth";
import { getNegocio, getHub } from "@/lib/data";
import { modulosEfetivos } from "@/lib/types";
import { activeNegocioId } from "@/lib/tenant";
import { listarProfissionais, type Profissional } from "@/lib/agenda";
import { acaoCriarProfissional, acaoArquivarProfissional, acaoCriarFolga } from "../agenda/acoes";

// ============================================================================
//  PAINEL · EQUIPE
//
//  Quem senta atrás da cadeira. Sem esta tela o dono não consegue cadastrar
//  ninguém, e a barbearia inteira dependeria de eu rodar script, que é o
//  oposito de vender um sistema.
//
//  A JORNADA NÃO ESTÁ AQUI, está na ficha de cada um. Jornada é sete dias com
//  turno partido, e sete linhas por barbeiro dentro de uma lista de barbeiros
//  vira uma parede que ninguém edita direito.
// ============================================================================

export const dynamic = "force-dynamic";

export default async function PainelEquipe({
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

  const equipe = await listarProfissionais(negocioId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
      <header>
        <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>
          Equipe
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 14, margin: "6px 0 0" }}>
          Quem atende, a comissão de cada um e a jornada da semana.
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
          {equipe.length} {equipe.length === 1 ? "profissional" : "profissionais"}
        </h2>

        {equipe.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 13.5, margin: "16px 0 4px" }}>
            Ninguém cadastrado ainda. Comece pelo formulário abaixo.
          </p>
        ) : (
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column" }}>
            {equipe.map((p) => <LinhaProfissional key={p.id} p={p} />)}
          </div>
        )}
      </section>

      {/* ---------- novo profissional ---------- */}
      <details style={cartao}>
        <summary style={{ cursor: "pointer", fontSize: 15, fontWeight: 600, listStyle: "none" }}>
          + Novo profissional
        </summary>

        <form action={acaoCriarProfissional} style={{ marginTop: 18, display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>
            <Campo rotulo="Nome">
              <input name="nome" required style={entrada} placeholder="Nome completo" />
            </Campo>
            <Campo rotulo="Como aparece na agenda">
              {/* O card da agenda não cabe "Rafael Prux Bordignon". */}
              <input name="apelido" style={entrada} placeholder="Rafa" />
            </Campo>
            <Campo rotulo="WhatsApp">
              <input name="telefone" style={entrada} placeholder="49 99999 0000" inputMode="tel" />
            </Campo>
            <Campo rotulo="Comissão em serviço">
              {/* Em branco cai no padrão da casa, definido em Serviços. */}
              <input name="comissao" style={entrada} placeholder="50" inputMode="numeric" />
            </Campo>
            <Campo rotulo="Cor na agenda">
              <input name="cor" type="color" defaultValue="#c9a227"
                     style={{ ...entrada, width: 56, height: 42, padding: 4 }} />
            </Campo>
            <Campo rotulo="Ordem na lista">
              <input name="ordem" style={entrada} placeholder="0" inputMode="numeric" />
            </Campo>
          </div>

          <label style={{ fontSize: 13, color: "var(--muted-2)", display: "flex", gap: 7, alignItems: "center", justifySelf: "start", width: "fit-content" }}>
            <input type="checkbox" name="aceita_online" defaultChecked />
            Aceita agendamento pelo site e pelo WhatsApp
          </label>

          <div>
            <button type="submit" style={botaoPrimario}>Cadastrar</button>
          </div>
        </form>
      </details>

      {/* ---------- folga e feriado ---------- */}
      <details style={cartao}>
        <summary style={{ cursor: "pointer", fontSize: 15, fontWeight: 600, listStyle: "none" }}>
          + Marcar folga ou feriado
        </summary>

        <form action={acaoCriarFolga} style={{ marginTop: 18, display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>
            <Campo rotulo="Data">
              <input name="data" type="date" required style={entrada} />
            </Campo>
            <Campo rotulo="Quem">
              <select name="profissional_id" style={entrada} defaultValue="">
                {/* Vazio fecha a barbearia inteira. É como se marca feriado sem
                    editar a jornada de cada um. */}
                <option value="">A barbearia toda</option>
                {equipe.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </Campo>
            <Campo rotulo="Motivo">
              <input name="motivo" style={entrada} placeholder="Feriado, folga, viagem" />
            </Campo>
          </div>
          <div>
            <button type="submit" style={botaoPrimario}>Marcar</button>
          </div>
        </form>
      </details>

      <p style={{ fontSize: 12.5, color: "var(--muted)", margin: 0 }}>
        A jornada da semana de cada profissional fica na ficha dele. Sem jornada
        cadastrada, o cálculo de cadeira vazia não tem contra o que comparar, e o
        raio-X fica sem o número que mais vende.
      </p>
    </div>
  );
}

function LinhaProfissional({ p }: { p: Profissional }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "13px 0", borderTop: "1px solid var(--line)", flexWrap: "wrap",
    }}>
      <span style={{
        width: 9, height: 9, borderRadius: 999,
        background: p.cor || "var(--muted-2)", flexShrink: 0,
      }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <strong style={{ fontSize: 14.5 }}>{p.nome}</strong>
          {p.apelido ? (
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{p.apelido}</span>
          ) : null}
          {!p.aceita_online ? (
            <span style={{
              fontSize: 11, padding: "2px 8px", borderRadius: 999,
              border: "1px solid var(--line)", color: "var(--muted)",
            }}>
              só no balcão
            </span>
          ) : null}
          {p.usuario_id ? (
            <span style={{
              fontSize: 11, padding: "2px 8px", borderRadius: 999,
              border: "1px solid #6fd39b", color: "#6fd39b",
            }}>
              tem login
            </span>
          ) : null}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--muted-2)", marginTop: 3 }}>
          comissão {p.comissao_servico_pct === null ? "padrão da casa" : `${p.comissao_servico_pct}%`}
          {p.telefone ? ` · ${p.telefone}` : ""}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Link href={`/painel/equipe/${p.id}`} style={acaoLink}>Jornada e dados</Link>
        {/* Não existe apagar: a comissão dele, as comandas e o histórico iriam
            junto, e o fechamento do mês passado mudaria sozinho. */}
        <form action={acaoArquivarProfissional.bind(null, p.id)}>
          <button style={acaoBotao}>Arquivar</button>
        </form>
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

const acaoLink: React.CSSProperties = {
  padding: "6px 13px", borderRadius: 999, fontSize: 12.5,
  border: "1px solid var(--line)", color: "var(--text)", textDecoration: "none",
};

const entrada: React.CSSProperties = {
  width: "100%", marginTop: 5, padding: "9px 12px",
  borderRadius: "var(--radius-sm)", border: "1px solid var(--line)",
  background: "rgba(0,0,0,0.25)", color: "var(--text)", fontSize: 13.5,
};
