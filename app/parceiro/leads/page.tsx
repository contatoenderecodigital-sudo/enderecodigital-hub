"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, PhoneOutgoing } from "lucide-react";
import PageHeader from "@/components/groow/admin/ed2/PageHeader";
import LeadParceiroModal from "@/components/groow/parceiro/LeadParceiroModal";
import KanbanParceiro from "@/components/groow/parceiro/KanbanParceiro";
import LeadDrawer from "@/components/groow/parceiro/LeadDrawer";
import type { ParceiroLead, SituacaoLead } from "@/lib/groow/parceiros-etapas";

export default function LeadsDoParceiro() {
  const [leads, setLeads] = useState<ParceiroLead[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(false);
  const [aberto, setAberto] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch("/api/parceiro/leads");
      if (r.ok) {
        const j = (await r.json()) as { leads: ParceiroLead[] };
        setLeads(j.leads || []);
      }
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  /**
   * Move otimista: o card pula de coluna na hora e só volta se o servidor
   * recusar. Arrastar e esperar meio segundo pelo banco é o tipo de atrito que
   * faz o vendedor parar de usar o board.
   */
  const mover = useCallback(
    async (id: number, situacao: SituacaoLead) => {
      const antes = leads;
      setLeads((atual) => atual.map((l) => (l.id === id ? { ...l, situacao } : l)));
      const r = await fetch("/api/parceiro/leads/etapa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, situacao }),
      });
      if (!r.ok) setLeads(antes);
      else carregar();
    },
    [leads, carregar]
  );

  /**
   * A fila do dia: quem tem retorno vencido vem primeiro, depois quem nunca
   * recebeu ligação, depois quem não atendeu há mais tempo. É o que o "Ligar
   * para o próximo" segue, para o parceiro não perder tempo escolhendo.
   */
  const fila = useMemo(() => {
    const agora = Date.now();
    const venceu = (l: ParceiroLead) =>
      l.proximo_retorno ? new Date(l.proximo_retorno).getTime() <= agora : false;

    const retornos = leads.filter((l) => venceu(l) && l.situacao !== "recusou");
    const novos = leads.filter((l) => l.situacao === "a_ligar" && !venceu(l));
    const reagendar = leads
      .filter((l) => l.situacao === "nao_atendeu" && !venceu(l))
      .sort((a, b) =>
        String(a.ultima_tentativa || "").localeCompare(String(b.ultima_tentativa || ""))
      );

    return { retornos, novos, reagendar, lista: [...retornos, ...novos, ...reagendar] };
  }, [leads]);

  const leadAberto = leads.find((l) => l.id === aberto) ?? null;

  return (
    <>
      <PageHeader
        title="Minhas ligações"
        sub="Anote quem você vai ligar. Depois é só abrir e ligar por aqui, que fica tudo guardado."
        right={
          <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ position: "relative" }}>
              <Search
                size={15}
                style={{
                  position: "absolute",
                  left: 13,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--ed2-ink-2)",
                  pointerEvents: "none",
                }}
              />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome, empresa ou cidade"
                style={{
                  padding: "9px 15px 9px 34px",
                  borderRadius: 999,
                  border: "1px solid var(--ed2-hair)",
                  background: "var(--ed2-surface)",
                  color: "var(--ed2-ink)",
                  fontSize: 13.5,
                  minWidth: 250,
                  outline: "none",
                }}
              />
            </div>
            <button
              onClick={() => setModal(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "9px 18px",
                borderRadius: 999,
                border: "none",
                background: "#C9A961",
                color: "#0B1838",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              <Plus size={16} />
              Nova pessoa
            </button>
          </div>
        }
      />

      {fila.lista.length > 0 ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
            padding: "15px 20px",
            borderRadius: 16,
            background: "rgba(201,169,97,0.10)",
            border: "1px solid rgba(201,169,97,0.34)",
            marginBottom: 22,
          }}
        >
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ed2-ink)" }}>
              {fila.lista.length} na fila de hoje
            </div>
            <div style={{ fontSize: 13.5, color: "var(--ed2-ink-2)", marginTop: 3, lineHeight: 1.5 }}>
              {[
                fila.retornos.length > 0
                  ? `${fila.retornos.length} retorno${fila.retornos.length > 1 ? "s" : ""} no horário`
                  : null,
                fila.novos.length > 0 ? `${fila.novos.length} você ainda não ligou` : null,
                fila.reagendar.length > 0 ? `${fila.reagendar.length} para tentar de novo` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>
          <button
            onClick={() => setAberto(fila.lista[0].id)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "11px 20px",
              borderRadius: 999,
              border: "none",
              background: "#0B1838",
              color: "#FFFFFF",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            <PhoneOutgoing size={16} />
            Começar pelo {fila.lista[0].nome.split(" ")[0]}
          </button>
        </div>
      ) : null}

      {carregando ? (
        <div style={{ padding: "60px 0", textAlign: "center", color: "var(--ed2-ink-2)" }}>
          Carregando...
        </div>
      ) : leads.length === 0 ? (
        <div
          style={{
            padding: "70px 24px",
            textAlign: "center",
            border: "1px dashed var(--ed2-hair)",
            borderRadius: 20,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--ed2-ink)", marginBottom: 8 }}>
            Nenhuma pessoa anotada ainda
          </div>
          <p
            style={{
              fontSize: 14.5,
              color: "var(--ed2-ink-2)",
              lineHeight: 1.65,
              maxWidth: 440,
              margin: "0 auto 20px",
            }}
          >
            Anote quem você vai ligar antes de pegar o telefone. Depois a
            ligação, a gravação e o que ficou combinado ficam guardados ali.
          </p>
          <button
            onClick={() => setModal(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "11px 22px",
              borderRadius: 999,
              border: "none",
              background: "#C9A961",
              color: "#0B1838",
              fontSize: 14.5,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <Plus size={17} />
            Anotar a primeira
          </button>
        </div>
      ) : (
        <KanbanParceiro
          leads={leads}
          filtro={busca}
          onAbrir={(l) => setAberto(l.id)}
          onMover={mover}
        />
      )}

      {modal ? (
        <LeadParceiroModal
          lead={null}
          onFechar={() => setModal(false)}
          onSalvo={() => {
            setModal(false);
            carregar();
          }}
        />
      ) : null}

      {leadAberto ? (
        <LeadDrawer
          key={leadAberto.id}
          lead={leadAberto}
          onFechar={() => setAberto(null)}
          onMudou={carregar}
        />
      ) : null}
    </>
  );
}
