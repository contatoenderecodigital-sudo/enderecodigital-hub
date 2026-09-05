"use client";

import { useEffect, useMemo, useState } from "react";
import type { AgendamentoPublico } from "@/lib/agendamento-publico";

// A chave do negócio nunca sai do servidor. A página pública só recebe a
// vitrine necessária para a pessoa escolher, e a API resolve o tenant pelo
// slug novamente ao consultar ou reservar.
type CatalogoVisivel = Omit<AgendamentoPublico, "negocioId">;
type Props = { slug: string; catalogo: CatalogoVisivel };

const dinheiro = (cent: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cent / 100);
const hoje = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const acrescentarDias = (inicio: string, dias: number) => {
  const d = new Date(`${inicio}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

export default function AgendamentoPublico({ slug, catalogo }: Props) {
  const [servicos, setServicos] = useState<string[]>([]);
  const [profissional, setProfissional] = useState("");
  const [data, setData] = useState(hoje);
  const [horarios, setHorarios] = useState<string[]>([]);
  const [hora, setHora] = useState("");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [estado, setEstado] = useState<"idle" | "slots" | "saving" | "done">("idle");
  const [erro, setErro] = useState("");
  const escolhidos = useMemo(() => catalogo.servicos.filter((s) => servicos.includes(s.id)), [catalogo.servicos, servicos]);
  const total = escolhidos.reduce((s, item) => s + item.precoCent, 0);
  const minutos = escolhidos.reduce((s, item) => s + item.duracaoMin, 0);

  useEffect(() => {
    setHora("");
    if (!profissional || !servicos.length || !data) { setHorarios([]); return; }
    const controller = new AbortController();
    setEstado("slots"); setErro("");
    const p = new URLSearchParams({ profissional, servicos: servicos.join(","), data });
    fetch(`/api/agendar/${encodeURIComponent(slug)}/horarios?${p}`, { signal: controller.signal })
      .then(async (r) => ({ ok: r.ok, body: await r.json() as { horarios?: string[]; erro?: string } }))
      .then(({ ok, body }) => {
        if (!ok) throw new Error(body.erro || "Não foi possível consultar os horários.");
        setHorarios(body.horarios || []); setEstado("idle");
      })
      .catch((e: unknown) => {
        if ((e as { name?: string }).name === "AbortError") return;
        setHorarios([]); setEstado("idle"); setErro(e instanceof Error ? e.message : "Não foi possível consultar os horários.");
      });
    return () => controller.abort();
  }, [slug, profissional, servicos, data]);

  function alternarServico(id: string) {
    setServicos((atuais) => atuais.includes(id) ? atuais.filter((x) => x !== id) : [...atuais, id]);
  }

  async function reservar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!hora || !profissional || !servicos.length) { setErro("Escolha serviço, profissional e horário."); return; }
    setEstado("saving"); setErro("");
    try {
      const r = await fetch(`/api/agendar/${encodeURIComponent(slug)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, telefone, profissionalId: profissional, data, hora, servicoIds: servicos }),
      });
      const body = await r.json() as { erro?: string };
      if (!r.ok) throw new Error(body.erro || "Não foi possível concluir a reserva.");
      setEstado("done");
    } catch (e) {
      setEstado("idle"); setErro(e instanceof Error ? e.message : "Não foi possível concluir a reserva.");
    }
  }

  if (estado === "done") return (
    <main className="booking-shell" style={{ "--accent": catalogo.cor || "#c59147" } as React.CSSProperties}>
      <section className="booking-success"><div className="booking-mark">✓</div><p className="booking-kicker">Reserva confirmada</p><h1>Até breve, {nome.split(" ")[0]}.</h1><p>Seu horário foi guardado. A barbearia pode falar com você pelo WhatsApp para confirmar os detalhes.</p></section>
    </main>
  );

  return (
    <main className="booking-shell" style={{ "--accent": catalogo.cor || "#c59147" } as React.CSSProperties}>
      <section className="booking-card">
        <header className="booking-header">
          <div className="booking-brand">{catalogo.logo ? <img src={catalogo.logo} alt="" /> : <span>{catalogo.nome.slice(0, 1)}</span>}</div>
          <div><p className="booking-kicker">Agendamento online</p><h1>{catalogo.nome}</h1></div>
        </header>
        <form onSubmit={reservar}>
          <fieldset><legend>1. Escolha o serviço</legend><div className="booking-options">
            {catalogo.servicos.map((s) => <label className={`booking-service ${servicos.includes(s.id) ? "selected" : ""}`} key={s.id}>
              <input type="checkbox" checked={servicos.includes(s.id)} onChange={() => alternarServico(s.id)} />
              <span><b>{s.nome}</b>{s.descricao && <small>{s.descricao}</small>}</span><em>{s.duracaoMin} min<br />{dinheiro(s.precoCent)}</em>
            </label>)}
          </div></fieldset>
          <fieldset><legend>2. Com quem e quando?</legend>
            <div className="booking-grid"><label>Profissional<select value={profissional} onChange={(e) => setProfissional(e.target.value)} required><option value="">Selecione</option>{catalogo.profissionais.map((p) => <option value={p.id} key={p.id}>{p.apelido || p.nome}</option>)}</select></label>
            <label>Data<input type="date" min={hoje()} max={acrescentarDias(hoje(), catalogo.maxDias)} value={data} onChange={(e) => setData(e.target.value)} required /></label></div>
            {estado === "slots" ? <p className="booking-note">Consultando horários…</p> : profissional && servicos.length > 0 && <div className="booking-times">{horarios.length ? horarios.map((h) => <button type="button" className={hora === h ? "selected" : ""} onClick={() => setHora(h)} key={h}>{h}</button>) : <p className="booking-note">Não há horários livres nesta data.</p>}</div>}
          </fieldset>
          <fieldset><legend>3. Seus dados</legend><div className="booking-grid"><label>Seu nome<input value={nome} onChange={(e) => setNome(e.target.value)} minLength={2} maxLength={100} autoComplete="name" required /></label><label>WhatsApp<input value={telefone} onChange={(e) => setTelefone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="(11) 99999-9999" required /></label></div></fieldset>
          <footer className="booking-footer"><div>{escolhidos.length > 0 && <><b>{minutos} min · {dinheiro(total)}</b><span>Valores e duração confirmados pela barbearia.</span></>}</div><button className="booking-submit" disabled={estado === "saving"}>{estado === "saving" ? "Reservando…" : "Confirmar horário"}</button></footer>
          {erro && <p className="booking-error" role="alert">{erro}</p>}
        </form>
      </section>
      <style jsx>{`
        .booking-shell{min-height:100vh;padding:44px 20px;background:radial-gradient(circle at 7% 4%,color-mix(in srgb,var(--accent),transparent 72%),transparent 30%),#11100e;color:#f7f2e9;font-family:var(--font-jakarta),sans-serif}.booking-card,.booking-success{max-width:720px;margin:auto;background:#1b1915;border:1px solid #39342b;box-shadow:0 32px 90px #0008;border-radius:28px;padding:clamp(24px,5vw,46px)}.booking-header{display:flex;gap:16px;align-items:center;padding-bottom:30px;border-bottom:1px solid #39342b}.booking-brand{height:52px;width:52px;border-radius:16px;background:var(--accent);display:grid;place-items:center;overflow:hidden;color:#19130b;font-size:25px;font-weight:800}.booking-brand img{width:100%;height:100%;object-fit:cover}.booking-kicker{margin:0 0 4px;color:var(--accent);font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.16em}.booking-header h1,.booking-success h1{font-size:clamp(25px,4vw,36px);letter-spacing:-.045em;margin:0}fieldset{border:0;padding:30px 0 0;margin:0}legend{font-size:15px;font-weight:800;margin-bottom:14px}.booking-options{display:grid;gap:9px}.booking-service{display:flex;align-items:center;gap:12px;padding:14px;border:1px solid #39342b;border-radius:15px;cursor:pointer}.booking-service.selected,.booking-times button.selected{border-color:var(--accent);background:color-mix(in srgb,var(--accent),transparent 88%)}.booking-service input{accent-color:var(--accent)}.booking-service span{display:grid;gap:3px;flex:1}.booking-service small,.booking-service em,.booking-note,.booking-footer span{color:#aaa294;font-size:12px;font-style:normal}.booking-service em{text-align:right;line-height:1.55}.booking-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.booking-grid label{display:grid;gap:7px;font-size:12px;font-weight:700;color:#d8d0c2}select,input{box-sizing:border-box;width:100%;padding:12px;border:1px solid #4b453a;border-radius:10px;background:#12110f;color:#f7f2e9;font:inherit}.booking-times{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}.booking-times button{padding:9px 12px;background:#12110f;border:1px solid #4b453a;border-radius:9px;color:#f7f2e9;cursor:pointer}.booking-footer{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-top:30px;padding-top:22px;border-top:1px solid #39342b}.booking-footer div{display:grid;gap:4px}.booking-submit{border:0;border-radius:12px;background:var(--accent);padding:13px 18px;color:#17120b;font-weight:800;cursor:pointer}.booking-submit:disabled{opacity:.6}.booking-error{margin:16px 0 0;color:#ffa995}.booking-success{text-align:center;max-width:480px;margin-top:12vh}.booking-success p:last-child{color:#bfb6a5;line-height:1.7}.booking-mark{width:58px;height:58px;border-radius:50%;display:grid;place-items:center;margin:0 auto 20px;background:var(--accent);color:#19130b;font-size:28px;font-weight:800}@media(max-width:560px){.booking-shell{padding:16px}.booking-card{border-radius:20px;padding:24px 18px}.booking-grid{grid-template-columns:1fr}.booking-footer{align-items:stretch;flex-direction:column}.booking-submit{width:100%}}
      `}</style>
    </main>
  );
}
