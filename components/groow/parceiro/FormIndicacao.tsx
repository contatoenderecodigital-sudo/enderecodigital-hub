"use client";

import { useState } from "react";
import AgendaCal from "./AgendaCal";
import { mascaraTelefone, telefoneE164, telefoneValido } from "@/lib/groow/telefone";
import { emailValido, nomeValido } from "@/lib/groow/validacao";

const campo: React.CSSProperties = {
  width: "100%",
  padding: "13px 15px",
  borderRadius: 12,
  border: "1px solid rgba(245,242,234,0.16)",
  background: "rgba(255,255,255,0.04)",
  color: "#F5F2EA",
  fontSize: 15,
  outline: "none",
};

const rotulo: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "rgba(245,242,234,0.55)",
  marginBottom: 7,
};

interface Dados {
  nome: string;
  telefone: string;
  email: string;
  empresa: string;
  cidade: string;
  dor: string;
}

export default function FormIndicacao({
  codigo,
  linkWhats,
  calLink,
}: {
  codigo: string;
  linkWhats: string | null;
  /** "enderecodigital/diagnostico". Sem isto o passo do calendário não aparece. */
  calLink: string | null;
}) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [dados, setDados] = useState<Dados | null>(null);
  // Controlado por causa da mascara. Solto, o campo aceitava
  // "49441422411241241241241" e so quebrava la no Cal, na ultima tela.
  const [telefone, setTelefone] = useState("");
  const [whatsFinal, setWhatsFinal] = useState<string | null>(linkWhats);

  async function enviar(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setErro(null);
    const fd = new FormData(ev.currentTarget);
    const d: Dados = {
      nome: String(fd.get("nome") || "").trim(),
      telefone,
      email: String(fd.get("email") || "").trim(),
      empresa: String(fd.get("empresa") || "").trim(),
      cidade: String(fd.get("cidade") || "").trim(),
      dor: String(fd.get("dor") || "").trim(),
    };
    // Ordem igual a dos campos na tela: o erro aponta pro primeiro problema que
    // a pessoa ve, nao pro ultimo.
    for (const c of [nomeValido(d.nome), telefoneValido(d.telefone), emailValido(d.email)]) {
      if (!c.ok) {
        setErro(c.motivo || "Confira os dados.");
        return;
      }
    }

    setEnviando(true);
    try {
      const resp = await fetch("/api/indicacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo, ...d }),
      });
      const resposta = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setErro(resposta.error || "Não consegui enviar. Tente de novo.");
        return;
      }
      if (resposta.whatsapp) setWhatsFinal(resposta.whatsapp);
      // Guarda o que ela digitou: é isso que vai preencher o calendário abaixo,
      // pra ela não digitar a mesma coisa duas vezes.
      setDados(d);
    } catch {
      setErro("Sem conexão. Tente de novo em instantes.");
    } finally {
      setEnviando(false);
    }
  }

  if (dados) {
    return (
      <div>
        <div
          className="ind-recebido"
          style={{
            padding: "22px 24px",
            borderRadius: 20,
            background: "rgba(201,169,97,0.10)",
            border: "1px solid rgba(201,169,97,0.30)",
            marginBottom: calLink ? 22 : 0,
          }}
        >
          <h3 style={{ margin: "0 0 8px", fontSize: 21, fontWeight: 600, color: "#F5F2EA" }}>
            {calLink ? "Recebido. Agora escolha um horário." : "Recebido. Vamos te chamar."}
          </h3>
          <p style={{ margin: 0, color: "rgba(245,242,234,0.72)", fontSize: 15, lineHeight: 1.6 }}>
            {calLink
              ? "São trinta minutos por vídeo. Seus dados já estão preenchidos, é só marcar o dia."
              : "Seu diagnóstico já entrou na fila e a gente te chama em breve."}
          </p>
        </div>

        {calLink ? (
          <AgendaCal
            calLink={calLink}
            altura={620}
            prefill={{
              name: dados.nome,
              email: dados.email,
              // E.164 obrigatorio: o campo do Cal recusa numero sem DDI.
              attendeePhoneNumber: telefoneE164(dados.telefone),
              empresa: dados.empresa,
              cidade: dados.cidade,
              notes: dados.dor,
              codigo,
            }}
          />
        ) : null}

        {whatsFinal ? (
          <div style={{ marginTop: calLink ? 20 : 18, textAlign: calLink ? "center" : "left" }}>
            <a
              href={whatsFinal}
              style={{
                display: "inline-block",
                padding: "13px 24px",
                borderRadius: 999,
                border: "1px solid rgba(201,169,97,0.42)",
                color: "#D9BE7E",
                fontWeight: 600,
                fontSize: 14.5,
                textDecoration: "none",
              }}
            >
              {calLink ? "Prefiro falar no WhatsApp" : "Chamar no WhatsApp"}
            </a>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <form onSubmit={enviar} style={{ display: "grid", gap: 16 }}>
      <div>
        <label style={rotulo} htmlFor="nome">
          Seu nome
        </label>
        <input id="nome" name="nome" required maxLength={160} style={campo} autoComplete="name" />
      </div>
      <div>
        <label style={rotulo} htmlFor="telefone">
          WhatsApp com DDD
        </label>
        <input
          id="telefone"
          name="telefone"
          required
          inputMode="tel"
          placeholder="(49) 99999-9999"
          value={telefone}
          onChange={(e) => setTelefone(mascaraTelefone(e.target.value))}
          maxLength={16}
          style={campo}
          autoComplete="tel"
        />
      </div>
      <div>
        <label style={rotulo} htmlFor="email">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          maxLength={190}
          style={campo}
          autoComplete="email"
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div>
          <label style={rotulo} htmlFor="empresa">
            Empresa
          </label>
          <input id="empresa" name="empresa" required maxLength={160} style={campo} />
        </div>
        <div>
          <label style={rotulo} htmlFor="cidade">
            Cidade
          </label>
          <input id="cidade" name="cidade" required maxLength={120} style={campo} />
        </div>
      </div>
      <div>
        <label style={rotulo} htmlFor="dor">
          O que mais te incomoda hoje <span style={{ opacity: 0.6 }}>(opcional)</span>
        </label>
        <textarea
          id="dor"
          name="dor"
          rows={3}
          maxLength={2000}
          placeholder="Escreva do seu jeito. É o que a gente vai olhar primeiro."
          style={{ ...campo, resize: "vertical", fontFamily: "inherit" }}
        />
      </div>

      {erro ? (
        <div
          style={{
            padding: "11px 14px",
            borderRadius: 12,
            background: "rgba(239,68,68,0.12)",
            border: "1px solid rgba(239,68,68,0.35)",
            color: "#FCA5A5",
            fontSize: 14,
          }}
        >
          {erro}
        </div>
      ) : null}

      <button
        type="submit"
        className="ind-cta"
        disabled={enviando}
        style={{
          marginTop: 4,
          padding: "16px 26px",
          borderRadius: 999,
          border: "none",
          // Dourado com volume, nao chapado: claro em cima, escuro embaixo, e um
          // fio de luz na aresta superior. Chapado ficava com cara de bege.
          background: enviando
            ? "linear-gradient(180deg, rgba(201,169,97,0.45), rgba(176,143,68,0.45))"
            : "linear-gradient(180deg, #EBD6A2 0%, #C9A961 54%, #AC8B41 100%)",
          color: "#0B1838",
          fontWeight: 700,
          fontSize: 16,
          letterSpacing: "0.005em",
          cursor: enviando ? "default" : "pointer",
        }}
      >
        {enviando ? "Enviando..." : calLink ? "Continuar e escolher horário" : "Quero meu diagnóstico"}
      </button>

      <p
        style={{
          margin: "2px auto 0",
          maxWidth: 330,
          textAlign: "center",
          fontSize: 12,
          color: "rgba(245,242,234,0.42)",
          lineHeight: 1.55,
        }}
      >
        Ao enviar, você autoriza a Endereço Digital a entrar em contato pelo WhatsApp
        informado. Sem custo e sem compromisso.
      </p>
    </form>
  );
}
