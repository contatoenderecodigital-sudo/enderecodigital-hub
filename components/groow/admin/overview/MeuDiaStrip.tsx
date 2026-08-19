import Link from "next/link";
import { MessageSquare, UserPlus, AlertTriangle, CheckCircle2, Clock, CheckCheck } from "lucide-react";
import type { MeuDia } from "@/lib/groow/queries";

const brl0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

interface Item {
  chave: keyof MeuDia;
  href: string;
  label: (n: number) => string;
  sub?: string;
  Icone: typeof MessageSquare;
  cor: string;
  bg: string;
}

// Central "meu dia": o que precisa da sua atenção agora, puxado de vários módulos.
export default function MeuDiaStrip({ data }: { data: MeuDia }) {
  const itens: Item[] = [
    { chave: "conversasEsperando", href: "/operacao/conversas", Icone: MessageSquare, cor: "#c8261c", bg: "rgba(255,59,48,0.10)",
      label: (n) => `${n} conversa${n === 1 ? "" : "s"} esperando você`, sub: "cliente respondeu e a IA passou pra humano" },
    { chave: "leadsNovos", href: "/operacao/leads", Icone: UserPlus, cor: "var(--pill-gold-fg)", bg: "rgba(201,169,97,0.14)",
      label: (n) => `${n} lead${n === 1 ? "" : "s"} novo${n === 1 ? "" : "s"} sem contato`, sub: "responda rápido, a chance cai a cada hora" },
    { chave: "cobrancasVencidas", href: "/operacao/cobrancas", Icone: AlertTriangle, cor: "#c8261c", bg: "rgba(255,59,48,0.10)",
      label: (n) => `${n} cobrança${n === 1 ? "" : "s"} vencida${n === 1 ? "" : "s"}`, sub: `R$ ${brl0.format(data.totalAtrasado)} atrasado` },
    { chave: "aprovacoesPendentes", href: "/operacao/aprovacoes", Icone: CheckCircle2, cor: "var(--pill-blue-fg)", bg: "rgba(10,132,255,0.10)",
      label: (n) => `${n} conteúdo${n === 1 ? "" : "s"} esperando seu OK`, sub: "blog, social e campanhas em rascunho" },
    { chave: "tarefasVencidas", href: "/operacao/tarefas", Icone: Clock, cor: "#a8760a", bg: "rgba(201,169,97,0.14)",
      label: (n) => `${n} tarefa${n === 1 ? "" : "s"} pra hoje ou atrasada${n === 1 ? "" : "s"}`, sub: "seu quadro de pendências" },
  ];

  const ativos = itens.filter((i) => Number(data[i.chave]) > 0);

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ed2-ink-3)" }}>Meu dia</span>
        <span style={{ fontSize: 12, color: "var(--ed2-ink-3)" }}>o que precisa de você agora</span>
      </div>

      {ativos.length === 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "16px 18px", borderRadius: 18, background: "var(--ed2-card)", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <span style={{ width: 38, height: 38, borderRadius: 12, background: "var(--ed2-green-soft)", color: "#1d8a3a", display: "grid", placeItems: "center" }}>
            <CheckCheck size={19} />
          </span>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 650 }}>Tudo em dia</div>
            <div style={{ fontSize: 12.5, color: "var(--ed2-ink-2)" }}>Nenhuma pendência esperando você. Bom trabalho.</div>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
          {ativos.map((i) => {
            const n = Number(data[i.chave]);
            const Icone = i.Icone;
            return (
              <Link key={i.chave} href={i.href} style={{ textDecoration: "none", color: "inherit" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 13, padding: "15px 17px", borderRadius: 18, background: "var(--ed2-card)", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", height: "100%", transition: "transform 0.1s" }}>
                  <span style={{ width: 42, height: 42, borderRadius: 13, background: i.bg, color: i.cor, display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <Icone size={20} strokeWidth={1.9} aria-hidden />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 650, lineHeight: 1.25 }}>{i.label(n)}</div>
                    {i.sub && <div style={{ fontSize: 12, color: "var(--ed2-ink-2)", marginTop: 2 }}>{i.sub}</div>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
