"use client";

// Botão de Embedded Signup da Meta, por cliente.
//
// Como funciona: o FB.login abre a janela oficial da Meta. Ela devolve as
// informações por DOIS caminhos diferentes, e precisamos dos dois:
//   - um evento `message` da janela (WA_EMBEDDED_SIGNUP) traz phone_number_id
//     e waba_id;
//   - o callback do FB.login traz o `code`, que só o servidor pode trocar por
//     token (é lá que mora o App Secret).
// Por isso guardamos o que chega primeiro e só chamamos o servidor quando as
// duas metades estiverem na mão.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

declare global {
  interface Window {
    FB?: {
      init: (o: Record<string, unknown>) => void;
      login: (cb: (r: { authResponse?: { code?: string } }) => void, o: Record<string, unknown>) => void;
    };
    fbAsyncInit?: () => void;
  }
}

export default function ConectarWhatsApp({
  negocioId,
  nome,
  appId,
  configId,
}: {
  negocioId: string;
  nome: string;
  appId: string;
  configId: string;
}) {
  const router = useRouter();
  const [estado, setEstado] = useState<"pronto" | "abrindo" | "salvando">("pronto");
  const [msg, setMsg] = useState<string | null>(null);
  const dados = useRef<{ phoneNumberId?: string; wabaId?: string }>({});

  // Carrega o SDK uma vez por página
  useEffect(() => {
    if (document.getElementById("fb-sdk")) return;
    window.fbAsyncInit = () => window.FB?.init({ appId, autoLogAppEvents: true, xfbml: false, version: "v21.0" });
    const s = document.createElement("script");
    s.id = "fb-sdk";
    s.src = "https://connect.facebook.net/en_US/sdk.js";
    s.async = true;
    document.body.appendChild(s);
  }, [appId]);

  const finalizar = useCallback(
    async (code: string) => {
      const { phoneNumberId, wabaId } = dados.current;
      if (!phoneNumberId || !wabaId) {
        setEstado("pronto");
        setMsg("A Meta não devolveu o número/WABA. Refaça a conexão até o fim da janela.");
        return;
      }
      setEstado("salvando");
      try {
        const r = await fetch("/api/wa/conectar", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ negocioId, code, phoneNumberId, wabaId }),
        });
        const j = await r.json();
        if (!r.ok || j.erro) {
          setMsg(j.erro || "Falha ao salvar a conexão.");
        } else {
          setMsg(
            (j.avisos?.length ? `Conectado, com ressalvas: ${j.avisos.join(" ")}` : "Conectado.") +
              ` Número ${j.phoneNumberId}.`
          );
          router.refresh();
        }
      } catch (e) {
        setMsg(`Erro de rede: ${String(e).slice(0, 120)}`);
      }
      setEstado("pronto");
    },
    [negocioId, router]
  );

  // Metade 1: a janela da Meta manda phone_number_id e waba_id por postMessage
  useEffect(() => {
    function ouvir(ev: MessageEvent) {
      if (!/facebook\.com$/.test(new URL(ev.origin).hostname)) return;
      try {
        const d = typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data;
        if (d?.type !== "WA_EMBEDDED_SIGNUP") return;
        if (d.event === "FINISH" || d.event === "FINISH_ONLY_WABA") {
          dados.current = { phoneNumberId: d.data?.phone_number_id, wabaId: d.data?.waba_id };
        } else if (d.event === "CANCEL") {
          setMsg(`Conexão cancelada${d.data?.current_step ? ` em: ${d.data.current_step}` : ""}.`);
        } else if (d.event === "ERROR") {
          setMsg(`A Meta reportou erro: ${d.data?.error_message || "sem detalhe"}`);
        }
      } catch {
        /* mensagem de outro widget do Facebook, ignora */
      }
    }
    window.addEventListener("message", ouvir);
    return () => window.removeEventListener("message", ouvir);
  }, []);

  function abrir() {
    if (!window.FB) {
      setMsg("O SDK da Meta ainda não carregou. Aguarde um instante e tente de novo.");
      return;
    }
    setMsg(null);
    dados.current = {};
    setEstado("abrindo");
    window.FB.login(
      (r) => {
        const code = r?.authResponse?.code;
        if (!code) {
          setEstado("pronto");
          setMsg("A janela fechou sem concluir. Nenhuma conexão foi feita.");
          return;
        }
        void finalizar(code);
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: {}, featureType: "", sessionInfoVersion: "3" },
      }
    );
  }

  return (
    <div>
      <button className="btn btn-sm" onClick={abrir} disabled={estado !== "pronto"}>
        {estado === "salvando" ? "Salvando..." : estado === "abrindo" ? "Aguardando a Meta..." : `Conectar ${nome}`}
      </button>
      {msg && (
        <div className="muted" style={{ fontSize: 12, marginTop: 8, lineHeight: 1.5, maxWidth: 460 }}>
          {msg}
        </div>
      )}
    </div>
  );
}
