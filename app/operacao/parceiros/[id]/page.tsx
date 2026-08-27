"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Send, Check, Wallet, Download } from "lucide-react";
import PageHeader from "@/components/groow/admin/ed2/PageHeader";
import Card, { CardHead } from "@/components/groow/admin/ed2/Card";
import StatCard from "@/components/groow/admin/ed2/StatCard";
import KanbanParceiro from "@/components/groow/parceiro/KanbanParceiro";
import {
  ETAPA_POR_VALOR,
  RESULTADOS_CALL,
  type ParceiroLead,
  type Comissao,
  type PainelParceiro,
  type Parceiro,
  type ParceiroCall,
  type SituacaoLead,
} from "@/lib/groow/parceiros-etapas";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "0 12px 11px",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--ed2-ink-2)",
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  padding: "12px",
  fontSize: 14,
  color: "var(--ed2-ink)",
  borderTop: "1px solid var(--ed2-hair)",
};

type CallComLead = ParceiroCall & { lead_nome: string | null; lead_empresa: string | null };

const mmss = (seg: number) =>
  `${String(Math.floor(seg / 60)).padStart(2, "0")}:${String(seg % 60).padStart(2, "0")}`;

const tamanho = (b: number) =>
  b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;

const quandoLegivel = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
};

interface Detalhe {
  parceiro: Parceiro;
  leads: ParceiroLead[];
  comissoes: Comissao[];
  painel: PainelParceiro;
  calls: CallComLead[];
}

export default function DetalheParceiro({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [d, setD] = useState<Detalhe | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState<number | string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [template, setTemplate] = useState("");
  const [busca, setBusca] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await fetch(`/api/admin/parceiros/${id}`);
      if (r.ok) setD(await r.json());
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function flash(msg: string) {
    setAviso(msg);
    setTimeout(() => setAviso(null), 5000);
  }

  async function acaoLead(plId: number, apenasPromover: boolean) {
    if (!apenasPromover && !template.trim()) {
      flash("Informe o nome do template aprovado antes de disparar.");
      return;
    }
    setOcupado(plId);
    try {
      const r = await fetch("/api/admin/parceiros/disparar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parceiro_lead_id: plId,
          apenasPromover,
          templateName: template.trim(),
        }),
      });
      const res = await r.json().catch(() => ({}));
      flash(
        r.ok
          ? apenasPromover
            ? "Lead promovido para a operação."
            : "Template enviado e conversa aberta no inbox."
          : res.error || "Falha na ação."
      );
      carregar();
    } finally {
      setOcupado(null);
    }
  }

  // O dono move o card do parceiro pela rota de admin: a de /api/parceiro e
  // escopada pela sessao dele e devolveria 401 aqui.
  async function moverCard(id: number, situacao: SituacaoLead) {
    if (!d) return;
    setD({
      ...d,
      leads: d.leads.map((l) => (l.id === id ? { ...l, situacao } : l)),
    });
    const r = await fetch("/api/admin/parceiros/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, parceiro_id: d.parceiro.id, situacao }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      flash(j.error || "Não consegui mover o card.");
    }
    carregar();
  }

  async function acaoComissao(acao: "aprovar" | "pagar") {
    setOcupado(acao);
    try {
      const r = await fetch("/api/admin/parceiros/comissoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao, parceiro_id: Number(id) }),
      });
      const res = await r.json().catch(() => ({}));
      flash(r.ok ? `${res.alteradas} linha(s) atualizada(s).` : res.error || "Falha.");
      carregar();
    } finally {
      setOcupado(null);
    }
  }

  if (carregando && !d) {
    return <div style={{ padding: "60px 0", color: "var(--ed2-ink-2)" }}>Carregando...</div>;
  }
  if (!d) {
    return <div style={{ padding: "60px 0", color: "var(--ed2-ink-2)" }}>Parceiro não encontrado.</div>;
  }

  return (
    <>
      <Link
        href="/operacao/parceiros"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          fontSize: 14,
          color: "var(--ed2-ink-2)",
          textDecoration: "none",
          marginBottom: 14,
        }}
      >
        <ArrowLeft size={16} />
        Parceiros
      </Link>

      <PageHeader
        title={d.parceiro.nome}
        sub={`${d.parceiro.email} · código ${d.parceiro.codigo} · ${
          d.parceiro.comissao_fixa > 0
            ? `R$ ${brl(d.parceiro.comissao_fixa)} por venda fechada`
            : `${d.parceiro.comissao_setup_pct}% implantação e ${d.parceiro.comissao_mensal_pct}% mensalidade por ${d.parceiro.comissao_meses} meses`
        }`}
      />

      {aviso ? (
        <div
          style={{
            padding: "13px 17px",
            borderRadius: 14,
            background: "rgba(201,169,97,0.14)",
            color: "#8a712d",
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 20,
          }}
        >
          {aviso}
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <StatCard label="Cliques" value={String(d.painel.cliques)} />
        <StatCard label="Leads" value={String(d.painel.leads)} desc={`${d.painel.autorizados} com opt-in`} />
        <StatCard label="Na operação" value={String(d.painel.promovidos)} />
        <StatCard label="Clientes" value={String(d.painel.clientes)} />
        <StatCard label="A pagar" value={brl(d.painel.comissao.aprovado)} currency="R$" />
      </div>

      <Card style={{ marginBottom: 22 }} padding={22}>
        <CardHead
          title="Funil dele"
          sub="O mesmo quadro que o parceiro enxerga. Arrastar aqui move lá também."
          right={
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="filtrar por nome, empresa ou cidade"
              style={{
                padding: "9px 13px",
                borderRadius: 999,
                border: "1px solid var(--ed2-hair)",
                background: "var(--ed2-surface)",
                color: "var(--ed2-ink)",
                fontSize: 13.5,
                minWidth: 250,
                outline: "none",
              }}
            />
          }
        />
        {d.leads.length === 0 ? (
          <div style={{ padding: "34px 0", textAlign: "center", color: "var(--ed2-ink-2)" }}>
            Ele ainda não cadastrou nenhum lead.
          </div>
        ) : (
          <KanbanParceiro
            leads={d.leads}
            filtro={busca}
            onMover={moverCard}
            // O drawer chama rotas de /api/parceiro, que o dono nao acessa.
            // A tabela logo abaixo ja mostra o detalhe e as acoes dele.
            onAbrir={() => {}}
          />
        )}
      </Card>

      <Card style={{ marginBottom: 22 }}>
        <CardHead
          title="Disparo do template"
          sub="Só dispara quem tem autorização registrada. Sem prova, o botão fica travado."
          right={
            <input
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              placeholder="nome do template aprovado"
              style={{
                padding: "9px 13px",
                borderRadius: 999,
                border: "1px solid var(--ed2-hair)",
                background: "var(--ed2-surface)",
                color: "var(--ed2-ink)",
                fontSize: 13.5,
                minWidth: 230,
                outline: "none",
              }}
            />
          }
        />
        {d.leads.length === 0 ? (
          <div style={{ padding: "36px 0", textAlign: "center", color: "var(--ed2-ink-2)" }}>
            Ele ainda não cadastrou nenhum lead.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
              <thead>
                <tr>
                  <th style={th}>Contato</th>
                  <th style={th}>Situação</th>
                  <th style={th}>Autorização</th>
                  <th style={th}>Disparo</th>
                  <th style={th} />
                </tr>
              </thead>
              <tbody>
                {d.leads.map((l) => (
                  <tr key={l.id}>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{l.nome}</div>
                      <div style={{ fontSize: 12.5, color: "var(--ed2-ink-2)", marginTop: 2 }}>
                        {[l.empresa, l.cidade, l.telefone].filter(Boolean).join(" · ")}
                      </div>
                    </td>
                    <td style={{ ...td, color: "var(--ed2-ink-2)" }}>
                      {ETAPA_POR_VALOR.get(l.situacao)?.label || l.situacao}
                      {l.tentativas > 0 ? (
                        <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>
                          {l.tentativas} tentativa{l.tentativas > 1 ? "s" : ""}
                          {(l.gravacoes ?? 0) > 0 ? ` · ${l.gravacoes} gravada${(l.gravacoes ?? 0) > 1 ? "s" : ""}` : ""}
                        </div>
                      ) : null}
                    </td>
                    <td style={{ ...td, maxWidth: 280, fontSize: 13, color: "var(--ed2-ink-2)" }}>
                      {l.optin_prova ? `"${l.optin_prova}"` : "sem prova"}
                    </td>
                    <td style={{ ...td, fontSize: 13, color: "var(--ed2-ink-2)" }}>
                      {l.lead_id ? `lead #${l.lead_id} · ` : ""}
                      {l.disparo_status}
                    </td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                      {!l.lead_id ? (
                        <button
                          onClick={() => acaoLead(l.id, true)}
                          disabled={ocupado === l.id}
                          style={btnSec}
                        >
                          Promover
                        </button>
                      ) : null}
                      <button
                        onClick={() => acaoLead(l.id, false)}
                        disabled={ocupado === l.id || !l.optin || !l.optin_prova}
                        title={!l.optin ? "Sem autorização registrada" : ""}
                        style={{
                          ...btnPri,
                          marginLeft: 8,
                          opacity: !l.optin || !l.optin_prova ? 0.4 : 1,
                          cursor: !l.optin || !l.optin_prova ? "not-allowed" : "pointer",
                        }}
                      >
                        <Send size={14} />
                        Disparar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card style={{ marginBottom: 22 }}>
        <CardHead
          title="Ligações gravadas"
          sub="O que ele falou nas calls. Serve para corrigir abordagem e para transcrever depois."
        />
        {d.calls.length === 0 ? (
          <div style={{ padding: "36px 0", textAlign: "center", color: "var(--ed2-ink-2)" }}>
            Nenhuma ligação registrada ainda.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {d.calls.map((c) => {
              const res = RESULTADOS_CALL.find((r) => r.valor === c.resultado);
              return (
                <article
                  key={c.id}
                  style={{
                    border: "1px solid var(--ed2-hair)",
                    borderRadius: 14,
                    padding: "13px 16px",
                  }}
                >
                  <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14.5, fontWeight: 700, color: "var(--ed2-ink)" }}>
                      {c.lead_nome || "lead removido"}
                    </span>
                    {c.lead_empresa ? (
                      <span style={{ fontSize: 13, color: "var(--ed2-ink-2)" }}>{c.lead_empresa}</span>
                    ) : null}
                    <span style={{ fontSize: 12.5, color: "var(--ed2-ink-2)", marginLeft: "auto" }}>
                      {res?.label || c.resultado} · {quandoLegivel(c.criado_em)}
                      {c.duracao_seg > 0 ? ` · ${mmss(c.duracao_seg)}` : ""}
                    </span>
                  </div>

                  {c.anotacao ? (
                    <p
                      style={{
                        margin: "9px 0 0",
                        fontSize: 13.5,
                        color: "var(--ed2-ink-2)",
                        lineHeight: 1.6,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {c.anotacao}
                    </p>
                  ) : null}

                  {c.audio_path ? (
                    <div style={{ marginTop: 11 }}>
                      <audio
                        controls
                        preload="none"
                        src={`/api/admin/parceiros/calls/${c.id}/audio`}
                        style={{ width: "100%", height: 36 }}
                      />
                      <a
                        href={`/api/admin/parceiros/calls/${c.id}/audio?download=1`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          marginTop: 8,
                          fontSize: 13,
                          fontWeight: 600,
                          color: "var(--ed2-ink-2)",
                          textDecoration: "none",
                        }}
                      >
                        <Download size={14} />
                        Baixar ({tamanho(c.audio_bytes)})
                      </a>
                    </div>
                  ) : (
                    <p style={{ margin: "9px 0 0", fontSize: 12.5, color: "var(--ed2-ink-2)", opacity: 0.75 }}>
                      Sem gravação nesta ligação.
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </Card>

      <Card>
        <CardHead
          title="Comissões"
          sub="Previsto vira aprovado, aprovado vira pago. Uma nova apuração nunca reescreve o que já foi aprovado."
          right={
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => acaoComissao("aprovar")} disabled={ocupado === "aprovar"} style={btnSec}>
                <Check size={14} />
                Aprovar previstas
              </button>
              <button onClick={() => acaoComissao("pagar")} disabled={ocupado === "pagar"} style={btnPri}>
                <Wallet size={14} />
                Marcar como pago
              </button>
            </div>
          }
        />
        {d.comissoes.length === 0 ? (
          <div style={{ padding: "36px 0", textAlign: "center", color: "var(--ed2-ink-2)" }}>
            Nenhuma comissão apurada ainda.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
              <thead>
                <tr>
                  <th style={th}>Competência</th>
                  <th style={th}>Cliente</th>
                  <th style={th}>Tipo</th>
                  <th style={{ ...th, textAlign: "right" }}>Base</th>
                  <th style={{ ...th, textAlign: "right" }}>%</th>
                  <th style={{ ...th, textAlign: "right" }}>Valor</th>
                  <th style={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {d.comissoes.map((c) => (
                  <tr key={c.id}>
                    <td style={td}>{c.competencia}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{c.empresa || "sem vínculo"}</td>
                    <td style={{ ...td, color: "var(--ed2-ink-2)" }}>{c.tipo}</td>
                    <td style={{ ...td, textAlign: "right" }}>R$ {brl(c.base_valor)}</td>
                    <td style={{ ...td, textAlign: "right", color: "var(--ed2-ink-2)" }}>
                      {c.percentual}%
                    </td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>R$ {brl(c.valor)}</td>
                    <td style={{ ...td, color: "var(--ed2-ink-2)" }}>{c.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

const btnBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 16px",
  borderRadius: 999,
  fontSize: 13.5,
  fontWeight: 600,
  cursor: "pointer",
};

const btnSec: React.CSSProperties = {
  ...btnBase,
  border: "1px solid var(--ed2-hair)",
  background: "transparent",
  color: "var(--ed2-ink)",
};

const btnPri: React.CSSProperties = {
  ...btnBase,
  border: "none",
  background: "#C9A961",
  color: "#0B1838",
  fontWeight: 700,
};
