"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import { useRouter } from "next/navigation";
import { Loader2, Search, Star, Globe, MapPin, Check, Target, X, Download, Megaphone, ScanSearch, ChevronDown, Mail, Sparkles, Layout, ExternalLink } from "lucide-react";
import { NICHOS, TOTAL_NICHOS } from "@/lib/groow/nichos";
import type { Centro } from "@/components/groow/admin/prospeccao/MapaRaio";

// ssr:false porque o Leaflet toca em window no import e derrubaria a pagina
// inteira no servidor. Mesma regra do recharts nas telas de grafico.
const MapaRaio = dynamic(() => import("@/components/groow/admin/prospeccao/MapaRaio"), {
  ssr: false,
  loading: () => (
    <div style={{ height: 320, borderRadius: 16, background: "var(--ed2-surface)", border: "1px solid var(--ed2-hair)" }} />
  ),
});

interface Empresa {
  place_id: string;
  nome: string;
  telefone: string;
  site: string;
  /** vem do Places; usado pra plotar no mapa e medir a distancia do centro */
  lat?: number | null;
  lng?: number | null;
  distanciaKm?: number | null;
  rating: number | null;
  avaliacoes: number;
  endereco: string;
  ativo: boolean;
  semSiteProprio?: boolean;
  jaImportado?: boolean;
  statusExistente?: string | null;
  score?: number;
  motivos?: string[];
  siteFora?: boolean;  // resultado do Escanear Sites
  email?: string;      // garimpado do site pelo Escanear Sites
  previaUrl?: string;  // link da prévia de site já montada pra esse prospect
}

type Presenca = "" | "telefone" | "site" | "instagram" | "semnada";

// Ângulos de email frio. Ordem = ordem de uso recomendada.
// Base: Desktop/EnderecoDigital/emails-prospeccao.md (os ids batem com os do /email/gerar).
const ANGULOS_EMAIL = [
  { id: "padrao", rotulo: "Padrão (site pronto esperando)", dica: "Serve pra 80% da lista. Mostra o trabalho que deu e pede só uma correção no texto." },
  { id: "perda", rotulo: "O que ele está perdendo (sem site)", dica: "Quem procura acha o concorrente. Medo de perder move mais que promessa de ganho." },
  { id: "prova", rotulo: "Avaliações dele (nota alta)", dica: "O de maior conversão. Preencha o campo abaixo com o que os clientes elogiam." },
  { id: "pegadinha", rotulo: "Desarma a desconfiança", dica: "Nomeia o 'qual é a pegadinha' antes dele pensar. Bom pra negócio maior." },
  { id: "prometido", rotulo: "Já prometeram e não entregaram", dica: "Verdade em cidade pequena. Você mostra o contraste sem falar mal de ninguém." },
  { id: "siteVelho", rotulo: "Site velho ou lento no celular", dica: "Fato observado, nunca crítica. Fecha dizendo que do lado dele é só aprovar." },
  { id: "operacao", rotulo: "Já tem site e anuncia (sem link)", dica: "Sai do site e vai pro WhatsApp fora do horário. Fecha com pergunta, não com oferta." },
  { id: "pergunta", rotulo: "Uma pergunta só (lista fria)", dica: "Sem link nenhum, cinco linhas. Resgata quem não abriu nada nos toques anteriores." },
];

function temInstagram(e: Empresa): boolean {
  return /instagram\.com/i.test(e.site || "");
}

function corDoScore(s: number): { bg: string; fg: string } {
  if (s >= 70) return { bg: "rgba(52,199,89,0.14)", fg: "var(--pill-green-fg)" };
  if (s >= 40) return { bg: "rgba(201,169,97,0.16)", fg: "var(--pill-gold-fg)" };
  return { bg: "var(--ed2-surface)", fg: "var(--ed2-ink-3)" };
}

let _toastId = 0;
interface Toast { id: number; text: string; icon: string }

/**
 * Tela de prospeccao, usada pelo dono e pelo parceiro.
 *
 * Componente unico de proposito: copiar as 758 linhas para o painel do parceiro
 * criaria duas telas que divergem na primeira mexida. O que muda entre os dois
 * e so o endpoint e quais acoes aparecem.
 *
 * O parceiro nao ve previa de site, e-mail nem disparo: aquilo sai em nome da
 * Endereco Digital e e decisao do dono. Ele ve a busca e o botao de mandar a
 * empresa para o proprio funil, que e o que ele precisa para ligar.
 */
export default function TelaProspeccao({ modo = "dono" }: { modo?: "dono" | "parceiro" }) {
  const ehDono = modo === "dono";
  const rotaBusca = ehDono ? "/api/admin/prospeccao" : "/api/parceiro/prospeccao";
  const rotaImportar = ehDono
    ? "/api/admin/prospeccao/importar"
    : "/api/parceiro/prospeccao/importar";
  const [restantes, setRestantes] = useState<number | null>(null);
  const [teto, setTeto] = useState<number | null>(null);
  const [historico, setHistorico] = useState<
    { id: number; nicho: string; cidade: string | null; total: number; criado_em: string }[]
  >([]);

  // Historico: reabrir uma busca antiga nao custa nada. Sem isso um F5 jogava
  // fora o resultado com o dinheiro da API do Google ja gasto.
  const carregarHistorico = useCallback(async () => {
    try {
      const r = await fetch(rotaBusca);
      if (!r.ok) return;
      const d = await r.json();
      if (Array.isArray(d.historico)) setHistorico(d.historico);
      if (typeof d.restantes === "number") setRestantes(d.restantes);
      if (typeof d.teto === "number") setTeto(d.teto);
    } catch {
      // historico e conveniencia: falhar aqui nao pode travar a busca
    }
  }, [rotaBusca]);

  useEffect(() => {
    carregarHistorico();
  }, [carregarHistorico]);

  const reabrir = async (id: number) => {
    try {
      const r = await fetch(`${rotaBusca}?abrir=${id}`);
      if (!r.ok) return;
      const d = await r.json();
      setEmpresas(Array.isArray(d.empresas) ? d.empresas : []);
      if (d.nicho) setNicho(d.nicho);
      if (d.cidade) setCidade(d.cidade);
      setSelected(new Set());
    } catch {
      // idem
    }
  };


  const router = useRouter();
  const [nicho, setNicho] = useState("");
  const [cidade, setCidade] = useState("");
  const [bairro, setBairro] = useState("");
  const [centro, setCentro] = useState<Centro | null>(null);
  const [raioKm, setRaioKm] = useState(10);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<Toast[]>([]);
  // filtros
  const [minRating, setMinRating] = useState(0);
  const [minReviews, setMinReviews] = useState(0);
  const [onlyPhone, setOnlyPhone] = useState(true);
  const [semSite, setSemSite] = useState(false);
  const [maisResultados, setMaisResultados] = useState(false);
  // filtros pós-busca (estilo Kaptar)
  const [presenca, setPresenca] = useState<Presenca>("");
  const [minScore, setMinScore] = useState(0);
  // seletor de nichos
  const [nichosAberto, setNichosAberto] = useState(false);
  const [buscaNicho, setBuscaNicho] = useState("");
  const [escaneando, setEscaneando] = useState(false);
  const [gerandoPrevias, setGerandoPrevias] = useState(false);
  // email de prospecção
  const [emailAberto, setEmailAberto] = useState(false);
  const [assuntoEmail, setAssuntoEmail] = useState("");
  const [corpoEmail, setCorpoEmail] = useState("");
  const [anguloEmail, setAnguloEmail] = useState("padrao");
  const [observacoesEmail, setObservacoesEmail] = useState("");
  const [gerandoEmail, setGerandoEmail] = useState(false);
  const [enviandoEmail, setEnviandoEmail] = useState(false);

  // restaura a última busca (a lista não some ao navegar)
  useEffect(() => {
    try {
      const salvo = localStorage.getItem("prospeccao-resultados");
      if (salvo) {
        const d = JSON.parse(salvo);
        if (Array.isArray(d.empresas) && d.empresas.length) {
          setEmpresas(d.empresas);
          carregarHistorico();
          setNicho(d.nicho ?? "");
          setCidade(d.cidade ?? "");
          setBairro(d.bairro ?? "");
        }
      }
    } catch { /* */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistir = (lista: Empresa[], n = nicho, c = cidade, b = bairro) => {
    try { localStorage.setItem("prospeccao-resultados", JSON.stringify({ empresas: lista, nicho: n, cidade: c, bairro: b })); } catch { /* */ }
  };

  const showToast = useCallback((text: string, icon = "✓") => {
    const id = ++_toastId;
    setToasts((t) => [...t, { id, text, icon }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  }, []);

  const buscar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nicho.trim() || (!cidade.trim() && !centro)) return;
    setLoading(true);
    setError("");
    setEmpresas([]);
    setSelected(new Set());
    try {
      const res = await fetch(rotaBusca, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nicho, cidade, bairro, minRating, minReviews,
          onlyPhone: ehDono ? onlyPhone : true,
          semSite,
          maxPaginas: maisResultados ? 3 : 1,
          // Com ponto no mapa, cidade e bairro nao vao junto: mandar os dois
          // faria o texto pedir uma cidade e a area restringir a outra.
          ...(centro ? { lat: centro.lat, lng: centro.lng, raioKm, cidade: "", bairro: "" } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro na busca");
      setEmpresas(data.empresas || []);
      persistir(data.empresas || []);
      // pré-seleciona só quem tem telefone E ainda não está no banco
      setSelected(new Set((data.empresas || []).filter((x: Empresa) => x.telefone && !x.jaImportado).map((x: Empresa) => x.place_id)));
      if ((data.empresas || []).length === 0) setError(data.aviso || "Nenhuma empresa encontrada. Tenta outro termo.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtradas.length) setSelected(new Set());
    else setSelected(new Set(filtradas.map((e) => e.place_id)));
  };

  const escanearSites = async () => {
    const comSite = empresas.filter((e) => e.site && !/instagram\.com|facebook\.com/i.test(e.site));
    if (!comSite.length) { showToast("Nenhum resultado com site próprio pra escanear", "✗"); return; }
    setEscaneando(true);
    try {
      const res = await fetch("/api/admin/prospeccao/escanear", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: comSite.map((e) => e.site) }),
      });
      const d = await res.json();
      if (!res.ok || d.error) { showToast(d.error || "Erro no escaneamento", "✗"); return; }
      const porUrl = new Map((d.resultados as { url: string; ok: boolean; email?: string }[]).map((r) => [r.url, r]));
      const atualizadas = empresas.map((e) => {
        const r = e.site ? porUrl.get(e.site) : undefined;
        if (!r) return e;
        return {
          ...e,
          siteFora: r.ok ? e.siteFora : true,
          email: r.email || e.email,
          score: r.ok ? e.score : Math.min(100, (e.score ?? 0) + 15),
        };
      });
      setEmpresas(atualizadas);
      persistir(atualizadas);
      const mortos = atualizadas.filter((e) => e.siteFora).length;
      const achados = atualizadas.filter((e) => e.email).length;
      showToast(`${mortos} fora do ar · ${achados} email${achados === 1 ? "" : "s"} encontrado${achados === 1 ? "" : "s"}`);
    } catch { showToast("Erro no escaneamento", "✗"); } finally { setEscaneando(false); }
  };

  const selecionadasComEmail = useMemo(
    () => empresas.filter((e) => selected.has(e.place_id) && e.email),
    [empresas, selected]
  );

  // Prévia NÃO depende de email. Quem não tem site quase nunca tem email garimpável
  // (o email sai do HTML do site), e é justamente esse o melhor prospect: a prévia
  // vira a tela que você abre na ligação ou manda no WhatsApp depois que ele atende.
  const selecionadasSemPrevia = useMemo(
    () => empresas.filter((e) => selected.has(e.place_id) && !e.previaUrl),
    [empresas, selected]
  );
  // pro email, o que importa é se TODO destinatário com email já tem link
  const todasComPrevia =
    selecionadasComEmail.length > 0 && selecionadasComEmail.every((e) => e.previaUrl);

  const gerarPrevias = async () => {
    const alvos = selecionadasSemPrevia.slice(0, 20); // teto do backend (1 chamada de IA por empresa)
    if (!alvos.length) { showToast("Todas as selecionadas já têm prévia", "✓"); return; }
    setGerandoPrevias(true);
    try {
      const res = await fetch("/api/admin/prospeccao/previa", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nicho, cidade,
          empresas: alvos.map((e) => ({
            place_id: e.place_id, nome: e.nome, telefone: e.telefone, email: e.email,
            endereco: e.endereco, rating: e.rating, avaliacoes: e.avaliacoes,
          })),
        }),
      });
      const d = await res.json();
      if (!res.ok || d.error) { showToast(d.error || "Erro ao gerar prévias", "✗"); return; }

      const porPlace = new Map<string, string>(
        (d.previas as { place_id: string | null; url: string | null }[])
          .filter((r) => r.place_id && r.url)
          .map((r) => [r.place_id as string, r.url as string])
      );
      const atualizadas = empresas.map((e) => {
        const url = porPlace.get(e.place_id);
        return url ? { ...e, previaUrl: url } : e;
      });
      setEmpresas(atualizadas);
      persistir(atualizadas);

      const restantes = selecionadasSemPrevia.length - alvos.length;
      showToast(
        `${d.novas} prévia${d.novas === 1 ? "" : "s"} pronta${d.novas === 1 ? "" : "s"}` +
        `${d.reaproveitadas ? ` · ${d.reaproveitadas} já existiam` : ""}` +
        `${d.erros ? ` · ${d.erros} falharam` : ""}` +
        `${d.custo ? ` · custo ${d.custo}` : ""}` +
        `${restantes > 0 ? ` · faltam ${restantes}, roda de novo` : ""}`
      );
    } catch { showToast("Falha de conexão", "✗"); } finally { setGerandoPrevias(false); }
  };

  const escreverComIA = async () => {
    setGerandoEmail(true);
    try {
      const res = await fetch("/api/admin/prospeccao/email/gerar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nicho, cidade, comPrevia: todasComPrevia, angulo: anguloEmail, observacoes: observacoesEmail.trim() || undefined }),
      });
      const d = await res.json();
      if (!res.ok || d.error) { showToast(d.error || "Erro ao escrever com IA", "✗"); return; }
      if (d.aviso) showToast(d.aviso, "!");
      setAssuntoEmail(d.assunto);
      setCorpoEmail(d.corpo);
      showToast(`Email escrito pela IA${d.custo ? ` · custo ${d.custo}` : ""}`);
    } catch { showToast("Falha de conexão", "✗"); } finally { setGerandoEmail(false); }
  };

  const enviarEmails = async () => {
    if (!assuntoEmail.trim() || !corpoEmail.trim() || !selecionadasComEmail.length) return;
    setEnviandoEmail(true);
    try {
      const res = await fetch("/api/admin/prospeccao/email", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campanha: `${nicho.trim()} · ${cidade.trim()}`,
          assunto: assuntoEmail.trim(),
          corpo: corpoEmail,
          destinatarios: selecionadasComEmail.map((e) => ({ nome: e.nome, email: e.email, previaUrl: e.previaUrl })),
        }),
      });
      const d = await res.json();
      if (!res.ok || d.error) { showToast(d.error || "Erro no envio", "✗"); return; }
      showToast(`${d.enviados} enviado${d.enviados === 1 ? "" : "s"}${d.pulados ? ` · ${d.pulados} já contatados (30d)` : ""}${d.erros ? ` · ${d.erros} com erro` : ""}`);
      setEmailAberto(false);
    } catch { showToast("Falha de conexão", "✗"); } finally { setEnviandoEmail(false); }
  };

  const filtradas = useMemo(() => empresas.filter((e) => {
    if (minScore > 0 && (e.score ?? 0) < minScore) return false;
    if (presenca === "telefone" && !e.telefone) return false;
    if (presenca === "site" && (!e.site || e.semSiteProprio)) return false;
    if (presenca === "instagram" && !temInstagram(e)) return false;
    if (presenca === "semnada" && (e.site || e.telefone)) return false;
    return true;
  }), [empresas, minScore, presenca]);

  const nichosFiltrados = useMemo(() => {
    const q = buscaNicho.trim().toLowerCase();
    if (!q) return NICHOS;
    return NICHOS.map((c) => ({ categoria: c.categoria, itens: c.itens.filter((i) => i.toLowerCase().includes(q)) }))
      .filter((c) => c.itens.length);
  }, [buscaNicho]);

  const exportarCsv = () => {
    const escolhidas = empresas.filter((e) => selected.has(e.place_id));
    if (!escolhidas.length) return;
    const header = ["Nome", "Telefone", "Email", "Site", "Endereço", "Nota", "Avaliações", "Score"];
    const rows = escolhidas.map((e) => [e.nome, e.telefone, e.email ?? "", e.site, e.endereco, e.rating ?? "", e.avaliacoes, e.score ?? ""]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `prospeccao-${nicho.trim().replace(/\s+/g, "-")}.csv`; a.click();
    URL.revokeObjectURL(url);
    showToast(`${escolhidas.length} empresas exportadas`);
  };

  const criarDisparo = () => {
    const comZap = empresas.filter((e) => selected.has(e.place_id) && e.telefone);
    if (!comZap.length) { showToast("Nenhuma selecionada com telefone", "✗"); return; }
    // handoff pro módulo Disparos: CSV whatsapp,nome via sessionStorage
    const csv = ["whatsapp,nome", ...comZap.map((e) => `${e.telefone.replace(/\D/g, "")},${e.nome.replace(/,/g, " ")}`)].join("\n");
    sessionStorage.setItem("disparo-prefill", csv);
    sessionStorage.setItem("disparo-prefill-nome", `${nicho.trim()} · ${cidade.trim()}`);
    router.push("/operacao/disparos");
  };

  const importar = async () => {
    const escolhidas = empresas.filter((e) => selected.has(e.place_id));
    if (escolhidas.length === 0) return;
    setImporting(true);
    try {
      const res = await fetch(rotaImportar, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresas: escolhidas, setor: nicho, cidade }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro");
      showToast(`${data.inseridos} leads importados${data.duplicados ? ` · ${data.duplicados} já existiam` : ""}`, "✓");
      // remove importadas da lista
      setEmpresas((prev) => prev.filter((e) => !selected.has(e.place_id)));
      setSelected(new Set());
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Erro ao importar", "✗");
    } finally {
      setImporting(false);
    }
  };

  const inputStyle: React.CSSProperties = { display: "block", width: "100%", borderRadius: 12, border: "1px solid var(--ed2-hair)", background: "var(--ed2-card)", padding: "12px 16px", fontSize: 14, boxSizing: "border-box", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" };

  return (
    <div>
      {/* HEADER */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 42, fontWeight: 700, letterSpacing: "-0.035em", margin: "0 0 6px", lineHeight: 1.05 }}>Buscar empresas</h1>
        <div style={{ color: "var(--ed2-ink-2)", fontSize: 15 }}>
          Encontre negócios por nicho e cidade · importe direto como leads de prospecção
        </div>
      </div>

      {/* MAPA: centro e raio da busca */}
      <div style={{ marginBottom: 20, padding: 20, borderRadius: 20, background: "var(--ed2-card)", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
        <MapaRaio
          centro={centro}
          raioKm={raioKm}
          onCentroChange={setCentro}
          onRaioChange={setRaioKm}
          pins={empresas.map((e) => ({ lat: e.lat ?? null, lng: e.lng ?? null, nome: e.nome }))}
        />
      </div>

      {/* SEARCH FORM */}
      <form onSubmit={buscar} style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--ed2-ink-2)", marginBottom: 6, letterSpacing: "0.03em" }}>NICHO / TIPO DE NEGÓCIO</label>
          <div style={{ position: "relative" }}>
            <input value={nicho} onChange={(e) => setNicho(e.target.value)} placeholder="Ex: clínicas, petshops, advocacia" style={inputStyle} />
            <button type="button" onClick={() => setNichosAberto((v) => !v)} title={`Escolher entre ${TOTAL_NICHOS} nichos`}
              style={{ all: "unset", cursor: "pointer", position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "var(--pill-gold-fg)", display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12, fontWeight: 700 }}>
              nichos <ChevronDown size={13} style={{ transform: nichosAberto ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
            </button>
          </div>
        </div>
        {/* Cidade e bairro so aparecem quando NAO ha ponto no mapa. Com os dois
            preenchidos o pedido ao Google fica contraditorio: o texto diz uma
            cidade e o locationRestriction restringe ao retangulo de outra. O
            mapa ja tem a propria busca de cidade em cima, entao aqui e a
            alternativa para quem nao quer mexer no mapa, nao um complemento. */}
        {!centro ? (
          <>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--ed2-ink-2)", marginBottom: 6, letterSpacing: "0.03em" }}>CIDADE</label>
              <input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Ex: Florianópolis SC" style={inputStyle} />
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--ed2-ink-2)", marginBottom: 6, letterSpacing: "0.03em" }}>BAIRRO (OPCIONAL)</label>
              <input value={bairro} onChange={(e) => setBairro(e.target.value)} placeholder="Ex: Centro" style={inputStyle} />
            </div>
          </>
        ) : (
          <div style={{ flex: 1, minWidth: 220 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--ed2-ink-2)", marginBottom: 6, letterSpacing: "0.03em" }}>ÁREA</label>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                height: 46,
                padding: "0 14px",
                borderRadius: 12,
                background: "rgba(201,169,97,0.12)",
                border: "1px solid rgba(201,169,97,0.30)",
                fontSize: 13.5,
                color: "var(--ed2-ink)",
              }}
            >
              <MapPin size={15} style={{ color: "#C9A961", flexShrink: 0 }} />
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {raioKm} km do ponto no mapa
              </span>
              <button
                type="button"
                onClick={() => setCentro(null)}
                title="Voltar a buscar por cidade"
                style={{ all: "unset", cursor: "pointer", marginLeft: "auto", color: "var(--ed2-ink-2)", display: "inline-flex" } as React.CSSProperties}
              >
                <X size={15} />
              </button>
            </div>
          </div>
        )}
        <button type="submit" disabled={loading || !nicho.trim() || (!cidade.trim() && !centro)}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#C9A961", color: "#fff", border: "none", padding: "12px 24px", borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: loading ? "wait" : "pointer", opacity: (loading || !nicho.trim() || (!cidade.trim() && !centro)) ? 0.6 : 1, boxShadow: "0 4px 12px rgba(201,169,97,0.28)", height: 46 }}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          Buscar
        </button>
      </form>

      {/* SELETOR DE NICHOS */}
      {nichosAberto && (
        <div style={{ background: "var(--ed2-card)", border: "1px solid var(--ed2-hair)", borderRadius: 24, padding: "22px 24px 10px", boxShadow: "0 8px 28px rgba(7,15,38,0.10)", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ed2-ink-2)" }}>Categorias / Segmentos</span>
            <button type="button" onClick={() => setNichosAberto(false)} aria-label="Fechar" style={{ all: "unset", cursor: "pointer", color: "var(--ed2-ink-3)", padding: 4 }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ position: "relative", marginBottom: 18 }}>
            <Search size={15} style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)", color: "var(--ed2-ink-3)" }} />
            <input value={buscaNicho} onChange={(e) => setBuscaNicho(e.target.value)} autoFocus placeholder={`Digite pra filtrar os ${TOTAL_NICHOS} nichos...`}
              style={{ ...inputStyle, paddingLeft: 42, background: "var(--ed2-surface)", boxShadow: "none", border: "1px solid var(--ed2-hair)" }} />
          </div>
          <div style={{ maxHeight: 340, overflowY: "auto", paddingRight: 6 }}>
            {nichosFiltrados.map((cat) => (
              <div key={cat.categoria} style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--pill-gold-fg)", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 18, height: 2, background: "#C9A961", borderRadius: 2, display: "inline-block" }} />
                  {cat.categoria}
                </div>
                <div style={{ display: "flex", gap: "8px 8px", flexWrap: "wrap" }}>
                  {cat.itens.map((item) => {
                    const ativo = nicho === item;
                    return (
                      <button key={item} type="button"
                        onClick={() => { setNicho(item); setNichosAberto(false); setBuscaNicho(""); }}
                        style={{
                          all: "unset", cursor: "pointer", padding: "8px 16px", borderRadius: 999, fontSize: 13, fontWeight: 550,
                          background: ativo ? "#C9A961" : "transparent",
                          color: ativo ? "#0B1838" : "var(--ed2-ink)",
                          border: ativo ? "1px solid #C9A961" : "1px solid var(--ed2-hair)",
                          transition: "border-color .12s, background .12s",
                        } as React.CSSProperties}
                        onMouseEnter={(e) => { if (!ativo) e.currentTarget.style.borderColor = "#C9A961"; }}
                        onMouseLeave={(e) => { if (!ativo) e.currentTarget.style.borderColor = "var(--ed2-hair)"; }}>
                        {item}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {nichosFiltrados.length === 0 && <div style={{ fontSize: 13, color: "var(--ed2-ink-2)", paddingBottom: 14 }}>Nenhum nicho com esse nome. Digita direto no campo de busca.</div>}
          </div>
        </div>
      )}

      {/* BUSCAS ANTERIORES */}
      {historico.length > 0 && (
        <div
          style={{
            background: "var(--ed2-card)",
            borderRadius: 16,
            padding: "12px 18px",
            marginBottom: 16,
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--ed2-ink-2)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: 9,
            }}
          >
            Buscas anteriores · abrir não gasta busca nova
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {historico.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => reabrir(h.id)}
                title={new Date(h.criado_em).toLocaleString("pt-BR")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "7px 13px",
                  borderRadius: 999,
                  border: "1px solid var(--ed2-hair)",
                  background: "var(--ed2-surface)",
                  color: "var(--ed2-ink)",
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {h.nicho}
                {h.cidade ? (
                  <span style={{ color: "var(--ed2-ink-2)", fontWeight: 400 }}>· {h.cidade}</span>
                ) : null}
                <span
                  style={{
                    padding: "1px 7px",
                    borderRadius: 999,
                    background: "rgba(201,169,97,0.18)",
                    color: "#8a712d",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {h.total}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* FILTROS */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
          marginBottom: 20,
          flexWrap: "wrap",
          background: "var(--ed2-card)",
          borderRadius: 16,
          padding: "14px 20px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--ed2-ink-2)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          Filtros
        </span>

        {/* nowrap em cada item: sem isso a linha quebrava no meio das frases e
            saia "Sem site / proprio / (oportunidade)" em tres linhas. E cor
            explicita, senao o rotulo herda um cinza que mal da para ler. */}
        <label style={rotuloFiltro}>
          Nota mínima
          <select value={minRating} onChange={(e) => setMinRating(Number(e.target.value))} style={seletorFiltro}>
            <option value={0}>Qualquer</option>
            <option value={3}>3.0+</option>
            <option value={4}>4.0+</option>
            <option value={4.5}>4.5+</option>
          </select>
        </label>

        <label style={rotuloFiltro}>
          Avaliações
          <select value={minReviews} onChange={(e) => setMinReviews(Number(e.target.value))} style={seletorFiltro}>
            <option value={0}>Qualquer</option>
            <option value={10}>10+</option>
            <option value={50}>50+</option>
            <option value={100}>100+</option>
          </select>
        </label>

        {/* Escondido no painel do parceiro e sempre ligado: desmarcar so encheria
            a lista de empresa sem telefone, que ele nao tem como ligar, e o
            botao de mandar pro funil recusaria em silencio. */}
        {ehDono && (
          <label style={rotuloFiltro}>
            <input type="checkbox" checked={onlyPhone} onChange={(e) => setOnlyPhone(e.target.checked)} style={{ accentColor: "#C9A961", width: 16, height: 16 }} />
            Só com telefone
          </label>
        )}

        <label
          style={rotuloFiltro}
          title="Negócio sem site próprio, só Instagram ou nada. É o melhor alvo pra vender presença digital."
        >
          {/* Sem o icone entre a caixa e o texto: so este filtro tinha
              [caixa][icone][texto] e os outros [caixa][texto], o que empurrava
              a frase para a direita e tirava ela da linha dos demais. */}
          <input type="checkbox" checked={semSite} onChange={(e) => setSemSite(e.target.checked)} style={{ accentColor: "#C9A961", width: 16, height: 16 }} />
          Sem site próprio
        </label>

        {/* So no painel do dono. A rota do parceiro trava em uma pagina para
            segurar o custo, entao marcar aqui nao mudava nada e a caixa mentia
            na tela. */}
        {ehDono && (
          <label style={rotuloFiltro} title="Busca até 60 empresas em vez de 20. Demora mais.">
            <input type="checkbox" checked={maisResultados} onChange={(e) => setMaisResultados(e.target.checked)} style={{ accentColor: "#C9A961", width: 16, height: 16 }} />
            Mais resultados
          </label>
        )}
      </div>

      {error && <div style={{ background: "rgba(255,59,48,0.06)", border: "1px solid rgba(255,59,48,0.18)", borderRadius: 18, padding: "12px 18px", color: "#c8261c", fontSize: 13, marginBottom: 18 }}>{error}</div>}

      {/* FILTROS PÓS-BUSCA (estilo Kaptar) */}
      {empresas.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ed2-ink-2)" }}>Presença:</span>
          {([["", "Todas"], ["telefone", "Tem telefone"], ["site", "Tem site"], ["instagram", "Tem Instagram"], ["semnada", "Sem nada"]] as const).map(([k, lbl]) => (
            <button key={k || "todas"} type="button" onClick={() => setPresenca(k)}
              style={{ all: "unset", cursor: "pointer", padding: "6px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, background: presenca === k ? "#0B1838" : "var(--ed2-card)", color: presenca === k ? "#F5F2EA" : "var(--ed2-ink-2)", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" } as React.CSSProperties}>
              {lbl}
            </button>
          ))}
          <select value={minScore} onChange={(e) => setMinScore(Number(e.target.value))}
            style={{ borderRadius: 999, border: "1px solid var(--ed2-hair)", padding: "6px 12px", fontSize: 12.5, fontWeight: 600, background: "var(--ed2-card)", color: "var(--ed2-ink)", cursor: "pointer" }}>
            <option value={0}>Todos os scores</option>
            <option value={40}>Score 40+</option>
            <option value={70}>Score 70+ (quentes)</option>
          </select>
          {ehDono && <button type="button" onClick={escanearSites} disabled={escaneando}
            style={{ all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, background: "var(--ed2-card)", color: "var(--pill-gold-fg)", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", marginLeft: "auto" } as React.CSSProperties}>
            {escaneando ? <Loader2 size={13} className="animate-spin" /> : <ScanSearch size={13} />}
            {escaneando ? "Escaneando..." : "Escanear sites"}
          </button>}
        </div>
      )}

      {/* COMO FUNCIONA O EMAIL DE PROSPECÇÃO */}
      {ehDono && empresas.length > 0 && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 9, background: "rgba(201,169,97,0.08)", border: "1px solid rgba(201,169,97,0.22)", borderRadius: 14, padding: "11px 16px", marginBottom: 14, fontSize: 12.5, lineHeight: 1.5, color: "var(--ed2-ink-2)" }}>
          <Mail size={14} style={{ color: "var(--pill-gold-fg)", flexShrink: 0, marginTop: 2 }} />
          <span>
            <strong style={{ color: "var(--ed2-ink)" }}>Prospecção por email, na ordem:</strong> 1) <strong>Escanear sites</strong> garimpa o email de cada empresa (aparece em dourado).
            2) <strong>Gerar prévias</strong> monta o site de cada prospect com os dados reais dele. 3) <strong>Email</strong>: com a prévia pronta, a IA escreve o email de entrega e o link de cada um entra sozinho no lugar do <code>{"{{previa}}"}</code>.
            Quem recebeu nos últimos 30 dias é pulado automaticamente.
          </span>
        </div>
      )}

      {/* RESULTS */}
      {empresas.length > 0 && (
        <div style={{ background: "var(--ed2-card)", borderRadius: 28, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: "1px solid var(--ed2-hair)", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>{filtradas.length} empresas{filtradas.length !== empresas.length ? ` (de ${empresas.length})` : " encontradas"}</h3>
              <div style={{ fontSize: 13, color: "var(--ed2-ink-2)", marginTop: 2 }}>{selected.size} selecionadas pra importar</div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" onClick={toggleAll}
                style={{ all: "unset", cursor: "pointer", padding: "9px 16px", borderRadius: 999, background: "var(--ed2-surface)", fontSize: 13, fontWeight: 600 } as React.CSSProperties}>
                {selected.size === empresas.length ? "Desmarcar todas" : "Marcar todas"}
              </button>
              <button type="button" onClick={exportarCsv} disabled={selected.size === 0}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "var(--ed2-surface)", color: "var(--ed2-ink)", border: "none", padding: "9px 16px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: selected.size === 0 ? 0.5 : 1 }}>
                <Download size={14} /> CSV
              </button>
              {ehDono && (
              <button type="button" onClick={criarDisparo} disabled={selected.size === 0}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#0B1838", color: "#F5F2EA", border: "none", padding: "9px 18px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: selected.size === 0 ? 0.5 : 1 }}>
                <Megaphone size={14} /> Criar disparo
              </button>
              )}
              {ehDono && (
              <button type="button" onClick={gerarPrevias} disabled={gerandoPrevias || !selecionadasSemPrevia.length}
                title="Monta o site de cada prospect com os dados reais dele (nome, endereço, telefone, nota do Google). O link vai no email, ou você abre na ligação."
                style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#C9A961", color: "#0B1838", border: "none", padding: "9px 18px", borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: gerandoPrevias ? "wait" : "pointer", opacity: (gerandoPrevias || !selecionadasComEmail.length) ? 0.5 : 1 }}>
                {gerandoPrevias ? <Loader2 size={14} className="animate-spin" /> : <Layout size={14} />}
                {gerandoPrevias ? "Montando sites..." : `Gerar prévias (${selecionadasSemPrevia.length})`}
              </button>
              )}
              {ehDono && (
              <button type="button"
                onClick={() => {
                  if (!selecionadasComEmail.length) { showToast("Sem emails ainda: clica em Escanear sites, que o email sai de lá", "✗"); return; }
                  setEmailAberto(true);
                }}
                title="Prospecção por email pros selecionados que têm email (achado no Escanear sites)"
                style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#0B1838", color: "#F5F2EA", border: "none", padding: "9px 18px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: selected.size === 0 ? 0.5 : 1 }}>
                <Mail size={14} /> Email ({selecionadasComEmail.length})
              </button>
              )}
              <button type="button" onClick={importar} disabled={importing || selected.size === 0}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#34C759", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: importing ? "wait" : "pointer", opacity: (importing || selected.size === 0) ? 0.5 : 1 }}>
                {importing ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {ehDono ? `Importar ${selected.size} leads` : `Ligar pra ${selected.size}`}
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            {filtradas.map((emp) => {
              const isOn = selected.has(emp.place_id);
              return (
                <div key={emp.place_id} onClick={() => toggle(emp.place_id)}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 24px", borderBottom: "1px solid rgba(0,0,0,0.04)", cursor: "pointer", background: isOn ? "rgba(201,169,97,0.05)" : "var(--ed2-card)", transition: "background .12s" }}>
                  <div style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0, border: isOn ? "none" : "1.7px solid #C7C7CC", background: isOn ? "#C9A961" : "var(--ed2-card)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {isOn && <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="var(--ed2-card)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6l2.5 2.5L9.5 3.5" /></svg>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      {emp.score != null && (
                        <span title={(emp.motivos ?? []).join(" · ")}
                          style={{ padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 800, fontVariantNumeric: "tabular-nums", background: corDoScore(emp.score).bg, color: corDoScore(emp.score).fg, cursor: "help" }}>
                          {emp.score}
                        </span>
                      )}
                      <span style={{ fontSize: 15, fontWeight: 600 }}>{emp.nome}</span>
                      {emp.rating != null && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12, color: "#a85f00", fontWeight: 600 }}>
                          <Star size={12} fill="#FF9F0A" stroke="#FF9F0A" /> {emp.rating} ({emp.avaliacoes})
                        </span>
                      )}
                      {!emp.ativo && <span style={{ fontSize: 11, color: "#c8261c", background: "rgba(255,59,48,0.1)", padding: "2px 8px", borderRadius: 99, fontWeight: 600 }}>Fechado</span>}
                      {emp.jaImportado && (
                        <span style={{ fontSize: 11, color: emp.statusExistente === "recusado" ? "var(--pill-red-fg)" : "var(--pill-gold-fg)", background: emp.statusExistente === "recusado" ? "rgba(255,59,48,0.1)" : "rgba(201,169,97,0.14)", padding: "2px 8px", borderRadius: 99, fontWeight: 600 }}>
                          {emp.statusExistente === "recusado" ? "Recusado antes" : "já no banco"}
                        </span>
                      )}
                      {emp.semSiteProprio && !emp.jaImportado && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "#1d8a3a", background: "rgba(52,199,89,0.12)", padding: "2px 8px", borderRadius: 99, fontWeight: 600 }}><Target size={11} /> oportunidade</span>
                      )}
                      {emp.siteFora && (
                        <span style={{ fontSize: 11, color: "var(--pill-red-fg)", background: "rgba(255,59,48,0.10)", padding: "2px 8px", borderRadius: 99, fontWeight: 700 }}>site fora do ar</span>
                      )}
                      {emp.previaUrl && (
                        <a href={emp.previaUrl} target="_blank" rel="noopener noreferrer" onClick={(ev) => ev.stopPropagation()}
                          title="Abrir a prévia que o prospect vai receber"
                          style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "#0B1838", background: "rgba(201,169,97,0.28)", padding: "2px 9px", borderRadius: 99, textDecoration: "none" }}>
                          <Layout size={11} /> prévia pronta <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 16, marginTop: 4, flexWrap: "wrap", fontSize: 13, color: "var(--ed2-ink-2)" }}>
                      {emp.telefone && <span>{emp.telefone}</span>}
                      {emp.email && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--pill-gold-fg)", fontWeight: 600 }}><Mail size={12} /> {emp.email}</span>}
                      {emp.site && <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Globe size={12} /> {emp.site.replace(/^https?:\/\//, "").slice(0, 30)}</span>}
                      {emp.endereco && <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><MapPin size={12} /> {emp.endereco.slice(0, 40)}</span>}
                      {emp.distanciaKm != null && (
                        <span title="distância até o centro do mapa" style={{ display: "inline-flex", alignItems: "center", gap: 3, fontWeight: 600, color: "var(--pill-gold-fg)" }}>
                          {emp.distanciaKm} km
                        </span>
                      )}
                    </div>
                  </div>
                  {!emp.telefone && <span style={{ fontSize: 11, color: "var(--ed2-ink-3)", fontWeight: 600, flexShrink: 0 }}>sem telefone</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* EMPTY STATE */}
      {!loading && empresas.length === 0 && !error && (
        <div style={{ background: "var(--ed2-card)", borderRadius: 28, padding: 56, boxShadow: "0 2px 8px rgba(0,0,0,0.04)", textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: "linear-gradient(135deg,rgba(201,169,97,0.16),rgba(201,169,97,0.06))", margin: "0 auto 16px", display: "grid", placeItems: "center", color: "var(--pill-gold-fg)" }}>
            <Search size={28} strokeWidth={1.5} />
          </div>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Busque empresas pra prospectar</h3>
          <p style={{ margin: "8px auto 0", color: "var(--ed2-ink-2)", fontSize: 14, maxWidth: 440 }}>
            Digite o nicho e a cidade, ex: &ldquo;clínicas em Florianópolis&rdquo;, e importe os negócios encontrados direto como leads.
          </p>
        </div>
      )}

      {/* MODAL EMAIL DE PROSPECÇÃO */}
      {emailAberto && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(7,15,38,0.55)", display: "grid", placeItems: "center", padding: 20 }} onClick={() => !enviandoEmail && setEmailAberto(false)}>
          <div style={{ background: "var(--ed2-card)", borderRadius: 24, width: "100%", maxWidth: 680, maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.3)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--ed2-hair)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 17 }}>Email de prospecção</div>
                <div style={{ fontSize: 12.5, color: "var(--ed2-ink-2)", marginTop: 2 }}>
                  {selecionadasComEmail.length} destinatário{selecionadasComEmail.length === 1 ? "" : "s"} com email · quem recebeu nos últimos 30 dias é pulado automaticamente
                </div>
                {selecionadasComEmail.length > 0 && (
                  <div style={{ fontSize: 12.5, marginTop: 5, fontWeight: 600, color: todasComPrevia ? "var(--pill-green-fg)" : "var(--pill-gold-fg)" }}>
                    {todasComPrevia
                      ? "Todos têm prévia pronta: a IA vai escrever o email de entrega, com o link de cada um."
                      : `${selecionadasSemPrevia.length} sem prévia. Fecha aqui e clica em "Gerar prévias" primeiro: o email de entrega responde muito mais que o email de oferta.`}
                  </div>
                )}
              </div>
              <button type="button" onClick={() => setEmailAberto(false)} style={{ all: "unset", cursor: "pointer", color: "var(--ed2-ink-2)", padding: 6 }} aria-label="Fechar"><X size={18} /></button>
            </div>

            <div style={{ overflowY: "auto", padding: "18px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {selecionadasComEmail.slice(0, 6).map((e) => (
                  <span key={e.place_id} style={{ fontSize: 11.5, fontWeight: 600, padding: "4px 10px", borderRadius: 99, background: "var(--ed2-surface)", color: "var(--ed2-ink-2)" }}>
                    {e.nome.slice(0, 24)}
                  </span>
                ))}
                {selecionadasComEmail.length > 6 && (
                  <span style={{ fontSize: 11.5, fontWeight: 700, padding: "4px 10px", borderRadius: 99, background: "rgba(201,169,97,0.14)", color: "var(--pill-gold-fg)" }}>
                    +{selecionadasComEmail.length - 6}
                  </span>
                )}
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--ed2-ink-2)", marginBottom: 6, letterSpacing: "0.03em" }}>ÂNGULO</label>
                <select value={anguloEmail} onChange={(e) => setAnguloEmail(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                  {ANGULOS_EMAIL.map((a) => (
                    <option key={a.id} value={a.id}>{a.rotulo}</option>
                  ))}
                </select>
                <p style={{ fontSize: 11.5, color: "var(--ed2-ink-3)", margin: "6px 2px 0", lineHeight: 1.45 }}>
                  {ANGULOS_EMAIL.find((a) => a.id === anguloEmail)?.dica}
                </p>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--ed2-ink-2)", marginBottom: 6, letterSpacing: "0.03em" }}>
                  O QUE VOCÊ VIU <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>(opcional, mas é o que tira o email da cara de disparo em massa)</span>
                </label>
                <input value={observacoesEmail} onChange={(e) => setObservacoesEmail(e.target.value)}
                  placeholder='Ex: as avaliações elogiam muito o atendimento da Simone' style={inputStyle} />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--ed2-ink-2)", marginBottom: 6, letterSpacing: "0.03em" }}>ASSUNTO</label>
                <input value={assuntoEmail} onChange={(e) => setAssuntoEmail(e.target.value)} placeholder="Ex: seu concorrente aparece primeiro no Google" style={inputStyle} />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--ed2-ink-2)", marginBottom: 6, letterSpacing: "0.03em" }}>
                  MENSAGEM <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>({"{{nome}}"} vira o nome da empresa · {"{{previa}}"} vira o link da prévia de cada um)</span>
                </label>
                <textarea value={corpoEmail} onChange={(e) => setCorpoEmail(e.target.value)} rows={10}
                  placeholder={"Oi, tudo bem? Achei a {{nome}} no Google e...\n\nClica em Escrever com IA que ela monta um email pronto pro nicho da busca."}
                  style={{ ...inputStyle, resize: "vertical", lineHeight: 1.55, fontFamily: "inherit" }} />
              </div>
            </div>

            <div style={{ padding: "14px 24px 18px", borderTop: "1px solid var(--ed2-hair)", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <button type="button" onClick={escreverComIA} disabled={gerandoEmail || enviandoEmail}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "var(--ed2-surface)", color: "var(--pill-gold-fg)", border: "none", padding: "10px 18px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: gerandoEmail ? 0.6 : 1 }}>
                {gerandoEmail ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {gerandoEmail ? "Escrevendo..." : "Escrever com IA"}
              </button>
              <div style={{ flex: 1 }} />
              <button type="button" onClick={enviarEmails} disabled={enviandoEmail || !assuntoEmail.trim() || !corpoEmail.trim()}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#34C759", color: "#fff", border: "none", padding: "10px 22px", borderRadius: 999, fontSize: 13.5, fontWeight: 600, cursor: enviandoEmail ? "wait" : "pointer", opacity: (enviandoEmail || !assuntoEmail.trim() || !corpoEmail.trim()) ? 0.55 : 1 }}>
                {enviandoEmail ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                {enviandoEmail ? "Enviando..." : `Enviar ${selecionadasComEmail.length} email${selecionadasComEmail.length === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOASTS */}
      <div style={{ position: "fixed", bottom: 28, right: 28, zIndex: 999, display: "flex", flexDirection: "column", gap: 10, pointerEvents: "none" }}>
        {toasts.map((t) => (
          <div key={t.id} style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "#0B1838", color: "#F5F2EA", padding: "12px 18px", borderRadius: 14, fontSize: 13, fontWeight: 500, boxShadow: "0 8px 24px rgba(0,0,0,0.22)" }}>
            <span style={{ display: "inline-flex", color: t.icon === "✗" ? "#FF6B61" : "#34C759" }}>{t.icon === "✗" ? <X size={15} /> : <Check size={15} />}</span>
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}

const rotuloFiltro: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  // lineHeight e altura fixos: sem isso cada item se apoia na propria caixa de
  // texto e eles nao ficam na mesma linha de base.
  height: 32,
  lineHeight: "32px",
  fontSize: 13.5,
  fontWeight: 500,
  color: "var(--ed2-ink)",
  whiteSpace: "nowrap",
  cursor: "pointer",
  margin: 0,
};

const seletorFiltro: React.CSSProperties = {
  borderRadius: 9,
  border: "1px solid var(--ed2-hair)",
  padding: "6px 9px",
  fontSize: 13,
  background: "var(--ed2-surface)",
  color: "var(--ed2-ink)",
  cursor: "pointer",
};
