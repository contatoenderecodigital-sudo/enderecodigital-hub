import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getNegocio, getHub } from "@/lib/data";
import { modulosEfetivos } from "@/lib/types";
import { activeNegocioId } from "@/lib/tenant";
import {
  listarVeiculos, raioX, resumoPatio, listarFiliais,
  emReais, kmEscrito, anoEscrito,
  CORTE_ATENCAO, CORTE_CRITICO,
  type LinhaRaioX,
} from "@/lib/veiculos";

// ============================================================================
//  PAINEL · VEICULOS
//
//  A tela abre pelo RAIO-X, nao pela lista. Sistema de revenda costuma abrir
//  numa grade de estoque, que e bonita e nao diz nada: o dono ja sabe quais
//  carros ele tem. O que ele nao sabe e QUAIS estao comendo a margem dele
//  agora, e por que.
//
//  Os cortes vem do mercado, nao de chute. O tempo medio de seminovo no Brasil
//  caiu pra 37 dias, e acima de 60 a rentabilidade despenca mesmo com a margem
//  individual parecendo boa. Margem liquida do setor fica entre 4% e 9%.
//
//  A LINHA DIZ O MOTIVO, nao so o sintoma. "Parado ha 96 dias" e sintoma.
//  "Parado ha 96 dias, 15% acima da FIPE, margem ja em R$ 7.900" e o motivo, e
//  e o que faz o dono baixar o preco na mesma tarde.
// ============================================================================

export const dynamic = "force-dynamic";

const COR = {
  critico: "#f08a8a",
  atencao: "#e6b45c",
  ok: "#6fd39b",
} as const;

export default async function PainelVeiculos() {
  const s = await getSession();
  if (!s) redirect("/login");
  const negocioId = activeNegocioId(s);
  if (!negocioId) redirect("/owner");

  const negocio = await getNegocio(negocioId);
  if (!negocio) redirect("/login");
  const hub = await getHub(negocio.hub_id);
  // Modulo desligado nao e 404 nem tela vazia: volta pra visao geral.
  if (!hub || !modulosEfetivos(negocio, hub).veiculos) redirect("/painel");

  const [resumo, linhas, estoque, filiais] = await Promise.all([
    resumoPatio(negocioId),
    raioX(negocioId),
    listarVeiculos(negocioId, { status: "disponivel" }),
    listarFiliais(negocioId),
  ]);

  const criticos = linhas.filter((l) => l.gravidade === "critico");
  const atencao = linhas.filter((l) => l.gravidade === "atencao");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
      <header>
        <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>
          Veículos
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 14, margin: "6px 0 0" }}>
          O que está no pátio e o que está custando dinheiro parado.
        </p>
      </header>

      {/* ---------- os quatro numeros ---------- */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 14 }}>
        <Numero rotulo="No pátio" valor={String(resumo.disponiveis)} />
        <Numero
          rotulo={`Parados +${CORTE_CRITICO} dias`}
          valor={String(resumo.parados)}
          alerta={resumo.parados > 0}
        />
        {/* Capital parado e o numero que faz o dono sentar. Nao e "valor do
            estoque": e dinheiro dele que nao esta girando. */}
        <Numero rotulo="Capital parado" valor={emReais(Number(resumo.capital_cent))} />
        <Numero rotulo="Média no pátio" valor={`${resumo.media_dias} dias`} />
      </section>

      {/* ---------- raio-x ---------- */}
      <section style={cartao}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Raio-X do pátio</h2>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            atenção a partir de {CORTE_ATENCAO} dias · crítico a partir de {CORTE_CRITICO}
          </span>
        </div>

        {linhas.length === 0 ? (
          <Vazio texto="Nenhum veículo disponível no pátio ainda." />
        ) : (
          <div style={{ overflowX: "auto", marginTop: 14 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 620 }}>
              <thead>
                <tr style={{ color: "var(--muted)", textAlign: "left" }}>
                  <th style={th}>Veículo</th>
                  <th style={{ ...th, textAlign: "right" }}>Parado</th>
                  <th style={{ ...th, textAlign: "right" }}>Preço</th>
                  <th style={{ ...th, textAlign: "right" }}>Margem</th>
                  <th style={{ ...th, textAlign: "right" }}>vs FIPE</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <Linha key={l.id} l={l} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* A leitura pronta, pra ninguem precisar interpretar tabela. */}
        {criticos.length > 0 ? (
          <p style={{ marginTop: 14, fontSize: 13.5, color: "var(--muted-2)", lineHeight: 1.6 }}>
            <strong style={{ color: COR.critico }}>
              {criticos.length === 1 ? "1 carro passou" : `${criticos.length} carros passaram`} de {CORTE_CRITICO} dias
            </strong>
            {atencao.length > 0 ? ` e outros ${atencao.length} estão chegando lá` : ""}. Juntos eles
            seguram {emReais(criticos.reduce((t, c) => t + c.preco_cent, 0))} do seu capital.
          </p>
        ) : null}
      </section>

      {/* ---------- estoque ---------- */}
      <section style={cartao}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Estoque disponível</h2>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            {estoque.length} {estoque.length === 1 ? "veículo" : "veículos"}
          </span>
        </div>

        {estoque.length === 0 ? (
          <Vazio texto="Cadastre o primeiro veículo pra ele aparecer aqui e no site." />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 12, marginTop: 14 }}>
            {estoque.map((v) => (
              <article key={v.id} style={cartaoCarro}>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>
                  {v.marca} {v.modelo}
                </div>
                <div style={{ color: "var(--muted)", fontSize: 12.5 }}>
                  {v.versao ?? "Versão não informada"}
                </div>
                <div style={{ color: "var(--muted-2)", fontSize: 12.5, marginTop: 4 }}>
                  {anoEscrito(v)} · {kmEscrito(v.km)}
                </div>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginTop: 8 }}>
                  <strong style={{ fontSize: 16 }}>{emReais(v.preco_cent)}</strong>
                  <span style={{ fontSize: 12, color: v.dias_parado >= CORTE_CRITICO ? COR.critico : "var(--muted)" }}>
                    {v.dias_parado}d
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 6, fontSize: 11.5, color: "var(--muted)" }}>
                  <span>{v.filial_nome ?? "Sem filial"}</span>
                  {/* Foto zero e problema de verdade: anuncio sem foto nao
                      recebe clique nenhum no portal. Entao aparece em vermelho. */}
                  <span style={{ marginLeft: "auto", color: v.qtd_fotos === 0 ? COR.critico : "var(--muted)" }}>
                    {v.qtd_fotos === 0 ? "sem foto" : `${v.qtd_fotos} fotos`}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* ---------- filiais ---------- */}
      {filiais.length > 0 ? (
        <section style={cartao}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Lojas</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
            {filiais.map((f) => (
              <div key={f.id} style={{ ...cartaoCarro, minWidth: 180 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{f.nome}</div>
                <div style={{ color: "var(--muted)", fontSize: 12.5 }}>
                  {f.cidade}, {f.uf}
                </div>
                <div style={{ color: "var(--muted-2)", fontSize: 12.5, marginTop: 4 }}>
                  {f.veiculos} no pátio
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

// ----------------------------------------------------------------------------
function Linha({ l }: { l: LinhaRaioX }) {
  const cor = COR[l.gravidade];
  return (
    <tr style={{ borderTop: "1px solid var(--line)" }}>
      <td style={td}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: cor, flexShrink: 0 }} />
          <span>
            <strong>{l.marca} {l.modelo}</strong>
            {l.versao ? <span style={{ color: "var(--muted)" }}> {l.versao}</span> : null}
          </span>
        </span>
      </td>
      <td style={{ ...td, textAlign: "right", color: l.gravidade === "ok" ? "var(--muted-2)" : cor, fontWeight: 600 }}>
        {l.dias_parado}d
      </td>
      <td style={{ ...td, textAlign: "right" }}>{emReais(l.preco_cent)}</td>
      <td style={{ ...td, textAlign: "right", color: l.margem_cent <= 0 ? COR.critico : "var(--muted-2)" }}>
        {/* Sem custo lancado nao da pra afirmar margem. Melhor um traco do que
            um numero errado que o dono vai levar pra reuniao. */}
        {l.custo_total_cent === 0 ? "—" : emReais(l.margem_cent)}
      </td>
      <td style={{ ...td, textAlign: "right" }}>
        {l.desvio_fipe === null ? (
          <span style={{ color: "var(--muted)" }}>—</span>
        ) : (
          <span style={{ color: l.desvio_fipe > 5 ? COR.atencao : "var(--muted-2)" }}>
            {l.desvio_fipe > 0 ? "+" : ""}{l.desvio_fipe}%
          </span>
        )}
      </td>
    </tr>
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
  return (
    <p style={{ color: "var(--muted)", fontSize: 13.5, margin: "16px 0 4px" }}>{texto}</p>
  );
}

const cartao: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius)",
  padding: "18px 20px",
};

const cartaoCarro: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius-sm)",
  padding: "12px 14px",
};

const th: React.CSSProperties = { padding: "0 10px 10px", fontWeight: 500, fontSize: 12 };
const td: React.CSSProperties = { padding: "11px 10px" };
