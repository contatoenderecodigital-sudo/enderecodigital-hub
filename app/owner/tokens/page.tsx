import PageHead from "@/components/page-head";
import Link from "@/components/link";
import { hubOpId } from "@/lib/hub-ctx";
import {
  matrizUso,
  usoPorOrigem,
  usoPorDia,
  ultimasChamadas,
  clientesDoEscopo,
  usoPorConversa,
  decomporCusto,
  dobrar,
  totalizar,
  totalTokens,
  PERIODOS,
  type Celula,
  type Fatia,
  type FiltroUso,
} from "@/lib/uso-ia";
import {
  acharModelo,
  nomeEmpresa,
  COR_PROVEDOR,
  CACHE_MULT,
  USD_BRL,
  precoDoModelo,
  type ProvedorIA,
} from "@/lib/precos-ia";
import { IcoActivity } from "@/components/icons";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------------

// Número cheio, com separador de milhar. Em tabela técnica ninguém quer "74.6k"
// quando o que importa é bater com a fatura — o encurtamento fica só nos KPIs.
function num(n: number) {
  return n.toLocaleString("pt-BR");
}
function curto(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n);
}
// Reais com casas adaptativas: uma chamada de atendimento custa fração de
// centavo, e mostrar "R$ 0,00" nessa linha seria mentir por arredondamento.
function brl(v: number) {
  const abs = Math.abs(v);
  const casas = abs === 0 ? 2 : abs >= 1 ? 2 : abs >= 0.01 ? 3 : abs >= 0.0001 ? 5 : 6;
  return v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}
function pct(parte: number, total: number) {
  if (total <= 0) return "0%";
  const p = (parte / total) * 100;
  return (p >= 10 ? p.toFixed(0) : p.toFixed(1)) + "%";
}
function dataHora(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function diaCurto(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

const ROTULO_ORIGEM: Record<string, string> = {
  chat: "Chat do painel",
  whatsapp: "WhatsApp",
  gerador: "Gerador de conteúdo",
  agente_crm: "Agente do CRM",
};

// ---------------------------------------------------------------------------
// Peças visuais
// ---------------------------------------------------------------------------

function Kpi({ valor, rotulo, nota, cor }: { valor: string; rotulo: string; nota: string; cor?: string }) {
  return (
    <div className="card">
      <div className="kpi" style={cor ? { background: "none", color: cor, WebkitTextFillColor: cor } : undefined}>
        {valor}
      </div>
      <div className="kpi-label">{rotulo}</div>
      <div className="muted" style={{ fontSize: 11.5, marginTop: 7, lineHeight: 1.5 }}>
        {nota}
      </div>
    </div>
  );
}

function Barra({ v, total, cor }: { v: number; total: number; cor: string }) {
  const p = total > 0 ? Math.max(v > 0 ? 2 : 0, (v / total) * 100) : 0;
  return (
    <div style={{ height: 6, borderRadius: 99, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${p}%`, background: cor, borderRadius: 99 }} />
    </div>
  );
}

function Ponto({ cor }: { cor: string }) {
  return (
    <span
      aria-hidden
      style={{ width: 8, height: 8, borderRadius: 99, background: cor, flex: "none", display: "inline-block" }}
    />
  );
}

// Ranking genérico (por cliente, por empresa de IA, por modelo).
function Ranking({
  titulo,
  explica,
  fatias,
  corDe,
  legendaDe,
}: {
  titulo: string;
  explica: string;
  fatias: Fatia[];
  corDe: (f: Fatia) => string;
  legendaDe?: (f: Fatia) => string;
}) {
  const totalCusto = fatias.reduce((a, f) => a + f.custo_brl, 0);
  return (
    <div className="card">
      <strong style={{ fontSize: 14.5 }}>{titulo}</strong>
      <p className="muted" style={{ fontSize: 11.5, margin: "5px 0 14px", lineHeight: 1.5 }}>
        {explica}
      </p>
      {fatias.length === 0 && <p className="muted" style={{ fontSize: 13, margin: 0 }}>Nada no período.</p>}
      {fatias.map((f) => (
        <div key={f.chave} style={{ marginBottom: 13 }}>
          <div className="spread" style={{ gap: 8, marginBottom: 5 }}>
            <span className="row" style={{ gap: 7, minWidth: 0, fontSize: 13 }}>
              <Ponto cor={corDe(f)} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.rotulo}</span>
            </span>
            <span style={{ fontSize: 12.5, fontVariantNumeric: "tabular-nums", flex: "none" }}>
              R$ {brl(f.custo_brl)} <span className="muted">· {pct(f.custo_brl, totalCusto)}</span>
            </span>
          </div>
          <Barra v={f.custo_brl} total={totalCusto} cor={corDe(f)} />
          <div className="muted" style={{ fontSize: 11, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
            {num(f.chamadas)} chamada(s) · {num(totalTokens(f))} tokens
            {legendaDe ? ` · ${legendaDe(f)}` : ""}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

interface Params {
  p?: string;
  c?: string;
  e?: string;
  m?: string;
  o?: string;
}

export default async function TokensPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const hub = await hubOpId();

  const dias = PERIODOS.some((x) => String(x.v) === sp.p) ? Number(sp.p) : 30;
  const filtro: FiltroUso = {
    dias,
    negocioId: sp.c || null,
    provedor: sp.e || null,
    modelo: sp.m || null,
    origem: sp.o || null,
    // Dentro de um hub a tela mostra só aquele hub; no nível plataforma
    // (nenhum hub aberto) mostra a soma de todos. O cabeçalho diz qual é o caso.
    hubId: hub,
  };

  // Com filtro de dimensão ligado, as opções dos selects precisam sair de uma
  // consulta SEM esses filtros. Senão escolher "OpenAI" num período sem OpenAI
  // apagaria a própria opção e o select voltaria pra "Todas" com o filtro ainda
  // ligado. Sem filtro ligado as duas consultas seriam idênticas, então reusamos.
  const temFiltroDim = !!(sp.c || sp.e || sp.m || sp.o);
  const semDimensao: FiltroUso = { ...filtro, negocioId: null, provedor: null, modelo: null, origem: null };

  let dados;
  try {
    dados = await Promise.all([
      matrizUso(filtro),
      usoPorOrigem(filtro),
      usoPorDia(filtro),
      ultimasChamadas(filtro, 40),
      clientesDoEscopo(hub),
      usoPorConversa(filtro, 100),
      temFiltroDim ? matrizUso(semDimensao) : null,
      temFiltroDim ? usoPorOrigem(semDimensao) : null,
    ]);
  } catch (e) {
    // Caso típico: o role do banco não pôde rodar o ALTER TABLE que cria as
    // colunas de detalhe. Em vez de 500 branco, mostra o que rodar.
    return (
      <>
        <PageHead eyebrow="Plataforma" titulo="Consumo de Tokens" sub="Estrutura do banco desatualizada" />
        <div className="err" style={{ borderRadius: 14, padding: 18, lineHeight: 1.7 }}>
          <strong>A tabela uso_ia ainda não tem as colunas de detalhe.</strong>
          <p style={{ margin: "8px 0" }}>
            A aplicação tenta criá-las sozinha ao abrir a tela, mas o usuário do banco não teve permissão. Rode a
            migração <code>db/migrations/uso-ia-detalhe.sql</code> no Postgres do hub e recarregue.
          </p>
          <code style={{ fontSize: 12 }}>{String(e).slice(0, 300)}</code>
        </div>
      </>
    );
  }
  const [matrizBruta, porOrigem, porDia, chamadas, clientes, conversas, matrizSemDim, origensSemDim] = dados;
  const matrizOpcoes = matrizSemDim ?? matrizBruta;
  const origensOpcoes = origensSemDim ?? porOrigem;

  // Todos os recortes saem da mesma matriz — por isso os cards sempre fecham
  // com a tabela detalhada.
  const total = totalizar(matrizBruta);
  const porCliente = dobrar(matrizBruta, (c) => c.negocio_id, (c) => c.cliente);

  // Reordena a matriz para a tabela: clientes na ordem do ranking, e dentro de
  // cada cliente os modelos do mais caro pro mais barato. Assim as linhas do
  // mesmo cliente ficam coladas e dá pra recolher o nome repetido.
  const ordemCliente = new Map(porCliente.map((f, i) => [f.chave, i]));
  const matriz = [...matrizBruta].sort(
    (a, b) =>
      (ordemCliente.get(a.negocio_id) ?? 0) - (ordemCliente.get(b.negocio_id) ?? 0) ||
      b.custo_brl - a.custo_brl
  );
  const porEmpresa = dobrar(matrizBruta, (c) => c.provedor, (c) => nomeEmpresa(c.provedor));
  const porModelo = dobrar(matrizBruta, (c) => c.modelo, (c) => acharModelo(c.modelo)?.nome || c.modelo);
  const modelosVistos = [...new Set(matrizOpcoes.map((c) => c.modelo))].sort();
  const empresasVistas = [...new Set(matrizOpcoes.map((c) => c.provedor))];
  const origensVistas = origensOpcoes.map((f) => f.chave);

  const tokensTotal = totalTokens(total);
  const semDados = matriz.length === 0;
  const temFiltro = !!(sp.c || sp.e || sp.m || sp.o) || dias !== 30;
  const maxDia = Math.max(1, ...porDia.map((d) => d.custo_brl));

  // Link de período preservando os demais filtros.
  const qs = (over: Partial<Params>) => {
    const q = new URLSearchParams();
    const v = { p: String(dias), c: sp.c, e: sp.e, m: sp.m, o: sp.o, ...over };
    if (v.p && v.p !== "30") q.set("p", v.p);
    if (v.c) q.set("c", v.c);
    if (v.e) q.set("e", v.e);
    if (v.m) q.set("m", v.m);
    if (v.o) q.set("o", v.o);
    const s = q.toString();
    return "/owner/tokens" + (s ? `?${s}` : "");
  };

  // As quatro faixas de token, cada uma com o multiplicador de preço aplicado.
  // Serve para responder "por que a conta deu isso" sem abrir o banco.
  const faixas = [
    { k: "in", rotulo: "Entrada (sem cache)", tokens: total.tokens_in, mult: "1,00x entrada", cor: "#0A84FF" },
    { k: "cw", rotulo: "Escrita de cache", tokens: total.cache_write, mult: "1,25x entrada", cor: "#e6b45c" },
    { k: "cr", rotulo: "Leitura de cache", tokens: total.cache_read, mult: "0,10x entrada", cor: "#6fd39b" },
    { k: "out", rotulo: "Saída (gerado)", tokens: total.tokens_out, mult: "preço de saída", cor: "#C9A961" },
  ];

  return (
    <>
      <PageHead
        eyebrow="Plataforma"
        titulo="Consumo de Tokens"
        sub={
          `${hub ? "Escopo: hub aberto" : "Escopo: plataforma inteira (todos os hubs)"} · ` +
          `fonte: tabela uso_ia, uma linha por chamada de IA · ` +
          `${num(total.chamadas)} chamada(s), ${num(tokensTotal)} tokens, R$ ${brl(total.custo_brl)}`
        }
      />

      {/* ---------------- FILTROS ---------------- */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="row" style={{ gap: 4, flexWrap: "wrap", marginBottom: 14 }}>
          <span className="muted" style={{ fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.09em", marginRight: 6 }}>
            Período
          </span>
          {PERIODOS.map((p) => (
            <Link
              key={p.v}
              href={qs({ p: String(p.v) })}
              className={"wsnav-tab" + (p.v === dias ? " active" : "")}
              style={{ padding: "6px 13px", textDecoration: "none", fontSize: 13 }}
            >
              {p.label}
            </Link>
          ))}
        </div>

        <form method="get" action="/owner/tokens" className="cols-4" style={{ gap: 12, alignItems: "end" }}>
          <input type="hidden" name="p" value={String(dias)} />
          <div>
            <label style={{ marginTop: 0 }}>Cliente</label>
            <select name="c" defaultValue={sp.c || ""}>
              <option value="">Todos os clientes</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ marginTop: 0 }}>Empresa de IA</label>
            <select name="e" defaultValue={sp.e || ""}>
              <option value="">Todas as empresas</option>
              {empresasVistas.map((e) => (
                <option key={e} value={e}>
                  {nomeEmpresa(e)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ marginTop: 0 }}>Modelo</label>
            <select name="m" defaultValue={sp.m || ""}>
              <option value="">Todos os modelos</option>
              {modelosVistos.map((m) => (
                <option key={m} value={m}>
                  {acharModelo(m)?.nome || m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ marginTop: 0 }}>Origem</label>
            <select name="o" defaultValue={sp.o || ""}>
              <option value="">Todas as origens</option>
              {origensVistas.map((o) => (
                <option key={o} value={o}>
                  {ROTULO_ORIGEM[o] || o}
                </option>
              ))}
            </select>
          </div>
          <div className="row" style={{ gap: 10, gridColumn: "1 / -1" }}>
            <button className="btn btn-sm" type="submit">
              Aplicar filtros
            </button>
            {temFiltro && (
              <Link href="/owner/tokens" className="btn btn-ghost btn-sm" style={{ textDecoration: "none" }}>
                Limpar
              </Link>
            )}
            <span className="muted" style={{ fontSize: 11.5 }}>
              Os filtros valem para todos os blocos desta página, inclusive o extrato do fim.
            </span>
          </div>
        </form>
      </div>

      {/* ---------------- KPIs ---------------- */}
      <div className="cols-5">
        <Kpi
          valor={curto(total.chamadas)}
          rotulo="Chamadas de IA"
          nota={
            total.falhas > 0
              ? `${num(total.falhas)} falharam (0 token cobrado)`
              : "nenhuma falha registrada no período"
          }
        />
        <Kpi
          valor={curto(tokensTotal)}
          rotulo="Tokens processados"
          nota={`entrada + saída + cache · ${num(tokensTotal)} exatos`}
        />
        <Kpi
          valor={`R$ ${brl(total.custo_brl)}`}
          rotulo="Custo calculado"
          nota={`tokens x preço de lista x câmbio ${USD_BRL.toFixed(2)}`}
        />
        <Kpi
          valor={`R$ ${brl(total.custo_faturado_brl)}`}
          rotulo="Custo faturado"
          nota={
            total.linhas_faturadas > 0
              ? `${num(total.linhas_faturadas)} chamada(s) já conciliadas com a fatura`
              : "faturamento do provedor ainda não conectado"
          }
          cor={total.linhas_faturadas > 0 ? undefined : "rgba(244,239,230,0.45)"}
        />
        <Kpi
          valor={`R$ ${brl(total.economia_cache_brl)}`}
          rotulo="Economia com cache"
          nota={`${num(total.cache_read)} tokens lidos do cache a 0,10x`}
          cor={total.economia_cache_brl > 0 ? "#6fd39b" : undefined}
        />
      </div>

      {/* ---------------- AVISOS DE PROCEDÊNCIA ---------------- */}
      {total.custo_reconstruido && (
        <div className="card" style={{ marginTop: 18, borderColor: "rgba(230,180,92,0.35)" }}>
          <strong style={{ fontSize: 14 }}>Parte do custo foi reconstruída, não medida</strong>
          <p className="muted" style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.65 }}>
            Existem chamadas gravadas antes da tela passar a registrar custo por linha. Nelas o valor em R$ foi
            recalculado agora, com a tabela de preço atual e o câmbio atual — não é o preço que valia no dia da
            chamada. As linhas afetadas aparecem marcadas como <strong>reconstruído</strong> no extrato. Chamadas
            novas já gravam preço e câmbio na própria linha, então esse aviso some sozinho com o tempo.
          </p>
        </div>
      )}

      {semDados ? (
        <div className="card" style={{ marginTop: 18 }}>
          <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
            Nenhuma chamada de IA no período/filtro selecionado. Se você acabou de aplicar um filtro, tente
            &quot;Tudo&quot; no período. Se está zerado mesmo, é porque nenhuma conversa passou pela IA ainda — a
            gravação acontece no momento em que o agente responde (rotas <code>/api/assistente</code> e
            <code> /api/whatsapp/webhook</code>).
          </p>
        </div>
      ) : (
        <>
          {/* ---------------- ONDE O DINHEIRO FOI ---------------- */}
          <div className="card" style={{ marginTop: 18 }}>
            <div className="spread" style={{ marginBottom: 4 }}>
              <strong style={{ fontSize: 15 }}>Para onde foi a conta, por faixa de token</strong>
              <span className="badge">4 faixas com preço diferente</span>
            </div>
            <p className="muted" style={{ fontSize: 12.5, margin: "0 0 16px", lineHeight: 1.6 }}>
              O provedor não cobra &quot;token&quot;: cobra quatro coisas diferentes com preços diferentes. Entrada
              nova é o texto que a IA nunca viu. Escrita de cache é gravar o prompt fixo (identidade + base de
              conhecimento do cliente) para reaproveitar depois — custa mais caro uma vez. Leitura de cache é
              reaproveitar esse prompt nas próximas conversas, e custa um décimo. Saída é o que a IA escreveu.
            </p>
            <div className="cols-4">
              {faixas.map((f) => (
                <div key={f.k} className="glass-soft" style={{ borderRadius: 12, padding: "12px 14px" }}>
                  <div className="row" style={{ gap: 7, marginBottom: 8 }}>
                    <Ponto cor={f.cor} />
                    <span style={{ fontSize: 12.5 }}>{f.rotulo}</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 19, fontVariantNumeric: "tabular-nums" }}>
                    {num(f.tokens)}
                  </div>
                  <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>
                    {pct(f.tokens, tokensTotal)} dos tokens · {f.mult}
                  </div>
                  <div style={{ marginTop: 9 }}>
                    <Barra v={f.tokens} total={tokensTotal} cor={f.cor} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ---------------- TABELA PRINCIPAL ---------------- */}
          <div className="card" style={{ marginTop: 18 }}>
            <div className="spread" style={{ marginBottom: 4 }}>
              <strong style={{ fontSize: 15 }}>Cliente x empresa de IA x modelo</strong>
              <span className="badge">{matriz.length} combinação(ões)</span>
            </div>
            <p className="muted" style={{ fontSize: 12.5, margin: "0 0 14px", lineHeight: 1.6 }}>
              Cada linha é uma combinação de cliente, empresa de IA e modelo. É aqui que se responde
              &quot;quem gastou o quê, em qual modelo, de qual empresa, e quanto isso custou&quot;. O preço unitário
              mostrado é o de lista do provedor em US$ por 1 milhão de tokens (entrada/saída).
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Empresa</th>
                    <th>Modelo</th>
                    <th style={{ textAlign: "right" }}>Chamadas</th>
                    <th style={{ textAlign: "right" }}>Entrada</th>
                    <th style={{ textAlign: "right" }}>Cache grav.</th>
                    <th style={{ textAlign: "right" }}>Cache lido</th>
                    <th style={{ textAlign: "right" }}>Saída</th>
                    <th style={{ textAlign: "right" }}>Preço US$/1M</th>
                    <th style={{ textAlign: "right" }}>Latência</th>
                    <th style={{ textAlign: "right" }}>Custo R$</th>
                    <th style={{ textAlign: "right" }}>% conta</th>
                  </tr>
                </thead>
                <tbody>
                  {matriz.map((c: Celula, i) => {
                    const mm = acharModelo(c.modelo);
                    const p = precoDoModelo(c.modelo);
                    const mesmoCliente = i > 0 && matriz[i - 1].negocio_id === c.negocio_id;
                    return (
                      <tr key={`${c.negocio_id}-${c.provedor}-${c.modelo}`}>
                        <td style={{ fontWeight: mesmoCliente ? 400 : 600 }}>
                          {mesmoCliente ? <span className="muted">↳</span> : c.cliente}
                        </td>
                        <td>
                          <span className="row" style={{ gap: 7 }}>
                            <Ponto cor={COR_PROVEDOR[c.provedor]} />
                            {nomeEmpresa(c.provedor)}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12.5 }}>{c.modelo}</span>
                          {mm?.nota && (
                            <div className="muted" style={{ fontSize: 11 }}>
                              {mm.nota}
                            </div>
                          )}
                          {!mm && (
                            <div style={{ fontSize: 11, color: "var(--warn)" }}>
                              fora do catálogo — preço estimado pelo teto
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                          {num(c.chamadas)}
                          {c.falhas > 0 && (
                            <div style={{ fontSize: 11, color: "var(--danger)" }}>{num(c.falhas)} com erro</div>
                          )}
                        </td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{num(c.tokens_in)}</td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{num(c.cache_write)}</td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: c.cache_read > 0 ? "#6fd39b" : undefined }}>
                          {num(c.cache_read)}
                        </td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{num(c.tokens_out)}</td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: 12.5 }}>
                          {p.inUsd} / {p.outUsd}
                        </td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: 12.5 }}>
                          {c.latencia_ms == null ? <span className="muted">—</span> : `${num(c.latencia_ms)} ms`}
                        </td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                          {brl(c.custo_brl)}
                          {c.custo_reconstruido && (
                            <div style={{ fontSize: 10.5, color: "var(--warn)" }}>reconstruído</div>
                          )}
                        </td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                          {pct(c.custo_brl, total.custo_brl)}
                        </td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td colSpan={4} style={{ fontWeight: 700 }}>
                      Total ({num(total.chamadas)} chamadas)
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{num(total.tokens_in)}</td>
                    <td style={{ textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{num(total.cache_write)}</td>
                    <td style={{ textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{num(total.cache_read)}</td>
                    <td style={{ textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{num(total.tokens_out)}</td>
                    <td />
                    <td />
                    <td style={{ textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{brl(total.custo_brl)}</td>
                    <td style={{ textAlign: "right", fontWeight: 700 }}>100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ---------------- RANKINGS ---------------- */}
          <div className="cols-3" style={{ marginTop: 18 }}>
            <Ranking
              titulo="Quanto cada cliente gastou"
              explica="Soma de todos os modelos daquele cliente, em R$ calculado."
              fatias={porCliente}
              corDe={() => "var(--gold)"}
              legendaDe={(f) => `${f.modelos.size} modelo(s)`}
            />
            <Ranking
              titulo="Quanto foi para cada empresa de IA"
              explica="Para qual fornecedor o dinheiro saiu: Anthropic, OpenAI ou Google."
              fatias={porEmpresa}
              corDe={(f) => COR_PROVEDOR[f.chave as ProvedorIA] || "var(--gold)"}
              legendaDe={(f) => `cache lê a ${CACHE_MULT[f.chave as ProvedorIA]?.leitura ?? 1}x`}
            />
            <Ranking
              titulo="Quanto cada modelo custou"
              explica="Mesmo cliente pode rodar em mais de um modelo; aqui a conta é por modelo."
              fatias={porModelo}
              corDe={(f) => COR_PROVEDOR[acharModelo(f.chave)?.provedor ?? "claude"]}
              legendaDe={(f) => {
                const m = acharModelo(f.chave);
                return m ? `US$ ${m.inUsd} entrada / ${m.outUsd} saída por 1M` : "preço estimado";
              }}
            />
          </div>

          {/* ---------------- ORIGEM + EVOLUÇÃO ---------------- */}
          <div className="cols-2" style={{ marginTop: 18 }}>
            <Ranking
              titulo="De onde saiu a chamada"
              explica="Qual parte do produto consumiu IA: chat do painel, WhatsApp, gerador de conteúdo."
              fatias={porOrigem.map((f) => ({ ...f, rotulo: ROTULO_ORIGEM[f.chave] || f.chave }))}
              corDe={() => "var(--copper-l)"}
              legendaDe={(f) => `campo uso_ia.origem = "${f.chave}"`}
            />

            <div className="card">
              <strong style={{ fontSize: 14.5 }}>Custo por dia</strong>
              <p className="muted" style={{ fontSize: 11.5, margin: "5px 0 16px", lineHeight: 1.5 }}>
                Cada barra é um dia com chamada registrada. Dia sem chamada não aparece.
              </p>
              {porDia.length === 0 ? (
                <p className="muted" style={{ fontSize: 13, margin: 0 }}>Sem histórico no período.</p>
              ) : (
                <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 130, overflowX: "auto" }}>
                  {porDia.map((d) => (
                    <div key={d.dia} style={{ flex: "1 0 26px", textAlign: "center", minWidth: 26 }}>
                      <div
                        title={`${d.dia}: R$ ${brl(d.custo_brl)} · ${num(d.chamadas)} chamada(s) · ${num(d.tokens)} tokens`}
                        style={{
                          height: Math.max(4, (d.custo_brl / maxDia) * 96),
                          background: "linear-gradient(180deg, var(--gold-l), var(--gold-d))",
                          borderRadius: "6px 6px 2px 2px",
                        }}
                      />
                      <div className="muted" style={{ fontSize: 10, marginTop: 6 }}>
                        {diaCurto(d.dia)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {porDia.length > 0 && (
                <div className="muted" style={{ fontSize: 11.5, marginTop: 12 }}>
                  Pico: R$ {brl(maxDia)} num dia · média R$ {brl(total.custo_brl / porDia.length)} por dia com uso
                </div>
              )}
            </div>
          </div>

          {/* ---------------- CUSTO POR CONVERSA ---------------- */}
          <div className="card" style={{ marginTop: 18 }}>
            <div className="spread" style={{ marginBottom: 4 }}>
              <strong style={{ fontSize: 15 }}>Custo por conversa</strong>
              <span className="badge">{conversas.length} conversa(s)</span>
            </div>
            <p className="muted" style={{ fontSize: 12.5, margin: "0 0 14px", lineHeight: 1.6 }}>
              Quanto a IA gastou atendendo cada pessoa. Uma conversa é a soma de todas as respostas
              dadas para o mesmo contato — o número de WhatsApp do cliente final, ou o usuário no chat
              do painel.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Contato</th>
                    <th style={{ textAlign: "right" }}>Respostas</th>
                    <th style={{ textAlign: "right" }}>Tokens</th>
                    <th style={{ textAlign: "right" }}>Custo R$</th>
                    <th style={{ textAlign: "right" }}>Média/resposta</th>
                    <th style={{ textAlign: "right" }}>Latência</th>
                    <th>Última</th>
                  </tr>
                </thead>
                <tbody>
                  {conversas.map((c) => (
                    <tr key={`${c.negocio_id}-${c.contato ?? "sem"}`}>
                      <td style={{ fontWeight: 600 }}>{c.cliente}</td>
                      <td>
                        {c.contato ? (
                          <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12.5 }}>{c.contato}</span>
                        ) : (
                          <span className="muted" style={{ fontSize: 12.5 }}>
                            sem identificação
                            <div style={{ fontSize: 11, color: "var(--warn)" }}>
                              gravada antes do registro por conversa
                            </div>
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{num(c.chamadas)}</td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{num(totalTokens(c))}</td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                        {brl(c.custo_brl)}
                      </td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {brl(c.chamadas > 0 ? c.custo_brl / c.chamadas : 0)}
                      </td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: 12.5 }}>
                        {c.latencia_ms == null ? <span className="muted">—</span> : `${num(c.latencia_ms)} ms`}
                      </td>
                      <td style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>
                        {c.ultimo ? dataHora(c.ultimo) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {conversas.some((c) => !c.contato) && (
              <p className="muted" style={{ fontSize: 12, margin: "12px 0 0", lineHeight: 1.6 }}>
                A coluna de contato passou a ser gravada em 16/08/2026. Chamadas anteriores não têm como
                ser atribuídas a uma conversa específica — elas aparecem juntas na linha
                &quot;sem identificação&quot; em vez de serem chutadas para alguém.
              </p>
            )}
          </div>

          {/* ---------------- EXTRATO ---------------- */}
          <div className="card" style={{ marginTop: 18 }}>
            <div className="spread" style={{ marginBottom: 4 }}>
              <strong style={{ fontSize: 15 }}>Extrato: últimas 40 chamadas</strong>
              <span className="badge">linha a linha, como está no banco</span>
            </div>
            <p className="muted" style={{ fontSize: 12.5, margin: "0 0 14px", lineHeight: 1.6 }}>
              O <strong>request-id</strong> é o identificador que o provedor devolve em cada chamada. É por ele que
              se bate uma linha desta tabela com uma linha do extrato da Anthropic quando houver contestação.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Quando</th>
                    <th>Cliente</th>
                    <th>Origem</th>
                    <th>Modelo</th>
                    <th style={{ textAlign: "right" }}>Ent.</th>
                    <th style={{ textAlign: "right" }}>C.grav</th>
                    <th style={{ textAlign: "right" }}>C.lido</th>
                    <th style={{ textAlign: "right" }}>Saída</th>
                    <th style={{ textAlign: "right" }}>Latência</th>
                    <th style={{ textAlign: "right" }}>Custo R$</th>
                    <th>Request-id</th>
                  </tr>
                </thead>
                <tbody>
                  {chamadas.map((c) => (
                    <tr key={c.id}>
                      <td style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", fontSize: 12.5 }}>
                        {dataHora(c.criado_em)}
                      </td>
                      <td>{c.cliente}</td>
                      <td style={{ fontSize: 12.5 }}>{ROTULO_ORIGEM[c.origem] || c.origem}</td>
                      <td>
                        <span className="row" style={{ gap: 7 }}>
                          <Ponto cor={COR_PROVEDOR[c.provedor]} />
                          <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}>{c.modelo}</span>
                        </span>
                        {c.erro && (
                          <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 3 }}>falhou: {c.erro}</div>
                        )}
                      </td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{num(c.tokens_in)}</td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{num(c.cache_write)}</td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: c.cache_read > 0 ? "#6fd39b" : undefined }}>
                        {num(c.cache_read)}
                      </td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{num(c.tokens_out)}</td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: 12.5 }}>
                        {c.latencia_ms == null ? <span className="muted">—</span> : `${num(c.latencia_ms)} ms`}
                      </td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                        {brl(c.custo_brl)}
                        {/* a decomposição responde "gastou por quê": mostra quanto
                            de cada real veio de prompt novo, cache e resposta. */}
                        <div style={{ fontSize: 10.5, fontWeight: 400, color: "var(--muted)", marginTop: 2 }}>
                          {decomporCusto(c.modelo, c)
                            .filter((d) => d.tokens > 0)
                            .map((d) => `${d.rotulo.toLowerCase()} ${brl(d.brl)}`)
                            .join(" · ")}
                        </div>
                        {c.custo_reconstruido && (
                          <div style={{ fontSize: 10.5, fontWeight: 400, color: "var(--warn)" }}>reconstruído</div>
                        )}
                      </td>
                      <td>
                        <span className="muted" style={{ fontFamily: "ui-monospace, monospace", fontSize: 11.5 }}>
                          {c.req_id || "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ---------------- COMO LER ESTA TELA ---------------- */}
      <div className="card" style={{ marginTop: 18 }}>
        <div className="row" style={{ gap: 9, marginBottom: 6 }}>
          <IcoActivity width={16} height={16} />
          <strong style={{ fontSize: 15 }}>Como cada número desta tela é produzido</strong>
        </div>

        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 13.5 }}>
            A conta do custo, passo a passo
          </summary>
          <div className="muted" style={{ fontSize: 13, lineHeight: 1.75, marginTop: 10 }}>
            <p style={{ margin: "0 0 10px" }}>
              O provedor cobra por 1 milhão de tokens, em dólar, e cada faixa tem um preço:
            </p>
            <pre
              style={{
                background: "rgba(0,0,0,0.28)",
                border: "1px solid var(--line)",
                borderRadius: 10,
                padding: "12px 14px",
                overflowX: "auto",
                fontSize: 12.5,
                color: "var(--muted-2)",
                margin: "0 0 10px",
              }}
            >
{`custo_US$ = (entrada      / 1.000.000) x preco_entrada
          + (cache_gravado / 1.000.000) x preco_entrada x 1,25
          + (cache_lido    / 1.000.000) x preco_entrada x 0,10
          + (saida         / 1.000.000) x preco_saida

custo_R$  = custo_US$ x ${USD_BRL.toFixed(2)}   (câmbio configurado em USD_BRL)`}
            </pre>
            <p style={{ margin: 0 }}>
              A conta roda no momento da chamada e é gravada na linha junto com o preço e o câmbio usados. Se a
              tabela de preço mudar amanhã, o histórico não muda — cada chamada carrega o preço que valia no dia
              dela. Quem faz esse cálculo é <code>custoBRL()</code> em <code>lib/precos-ia.ts</code>.
            </p>
          </div>
        </details>

        <details style={{ marginTop: 10 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 13.5 }}>
            Custo calculado x custo faturado — por que são dois números
          </summary>
          <div className="muted" style={{ fontSize: 13, lineHeight: 1.75, marginTop: 10 }}>
            <p style={{ margin: "0 0 8px" }}>
              <strong style={{ color: "var(--text)" }}>Custo calculado</strong> é a nossa conta: tokens medidos x
              preço de tabela x câmbio. Serve para saber na hora quanto um cliente está consumindo e para
              precificar plano.
            </p>
            <p style={{ margin: "0 0 8px" }}>
              <strong style={{ color: "var(--text)" }}>Custo faturado</strong> é o que a Anthropic realmente cobrou,
              vindo da Admin API (<code>cost_report</code>). Esse é o número que vale para dinheiro. Enquanto o
              pipeline não estiver ligado ele fica zerado e a tela diz isso — nunca vai apresentar o calculado
              como se fosse a fatura.
            </p>
            <p style={{ margin: 0 }}>
              As duas contas divergem por três motivos previsíveis: câmbio (a fatura vem em dólar e converte na data
              do fechamento), descontos ou créditos da conta, e arredondamento do provedor. Quando o
              <code> cost_report</code> entrar, esta tela passa a mostrar a diferença explícita entre os dois.
            </p>
          </div>
        </details>

        <details style={{ marginTop: 10 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 13.5 }}>
            O que é cache e por que ele aparece separado
          </summary>
          <div className="muted" style={{ fontSize: 13, lineHeight: 1.75, marginTop: 10 }}>
            Todo atendimento manda junto o mesmo bloco fixo: quem é a empresa, como falar e a base de conhecimento
            daquele cliente. Repetir isso em toda conversa sairia caro. O cache guarda esse bloco: a primeira
            chamada paga 1,25x para gravar, e todas as seguintes pagam 0,10x para ler — dez vezes mais barato que
            mandar o texto de novo. Por isso as colunas <strong>cache gravado</strong> e <strong>cache lido</strong>
            existem separadas da entrada: elas têm preço diferente, e é a proporção entre elas que mostra se o
            cache está de fato trabalhando. Muita gravação e pouca leitura significa cache expirando antes de ser
            aproveitado — a janela é de 5 minutos.
            <p style={{ margin: "10px 0 0" }}>
              Se as duas colunas estão zeradas, quase sempre é tamanho: o provedor só cacheia um bloco a partir de
              um mínimo de tokens (no Haiku 4.5 são 4.096). Base de conhecimento curta não atinge esse piso e a
              chamada roda sem cache, sem erro nenhum. Encher a base do cliente é o que liga a economia.
            </p>
          </div>
        </details>

        <details style={{ marginTop: 10 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 13.5 }}>
            De onde vem cada coluna (mapa técnico)
          </summary>
          <div style={{ marginTop: 10 }} className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Na tela</th>
                  <th>No banco</th>
                  <th>Escrito por</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Chamadas", "count(*) de uso_ia", "toda resposta da IA"],
                  ["Entrada (sem cache)", "uso_ia.tokens_in", "usage.input_tokens da API"],
                  ["Escrita de cache", "uso_ia.cache_write", "usage.cache_creation_input_tokens"],
                  ["Leitura de cache", "uso_ia.cache_read", "usage.cache_read_input_tokens"],
                  ["Saída", "uso_ia.tokens_out", "usage.output_tokens"],
                  ["Empresa de IA", "uso_ia.provedor", "gravado na chamada"],
                  ["Modelo", "uso_ia.modelo", "modelo configurado no cliente"],
                  ["Custo calculado", "uso_ia.custo_brl", "custoBRL() no momento da chamada"],
                  ["Custo faturado", "uso_ia.custo_faturado_brl", "conciliação com a fatura (pendente)"],
                  ["Preço US$/1M", "uso_ia.preco_in_usd / preco_out_usd", "tabela em lib/precos-ia.ts"],
                  ["Latência", "uso_ia.latencia_ms", "tempo de parede da chamada"],
                  ["Request-id", "uso_ia.req_id", "cabeçalho request-id da Anthropic"],
                  ["Origem", "uso_ia.origem", "rota que chamou (chat, whatsapp, ...)"],
                ].map(([a, b, c]) => (
                  <tr key={b}>
                    <td>{a}</td>
                    <td style={{ fontFamily: "ui-monospace, monospace", fontSize: 12.5 }}>{b}</td>
                    <td className="muted" style={{ fontSize: 12.5 }}>
                      {c}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </>
  );
}
