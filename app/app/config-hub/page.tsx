import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { activeNegocioId, ehOwner } from "@/lib/tenant";
import { getNegocio, getHub, getCerebro, getWaConexao } from "@/lib/data";
import { modulosEfetivos } from "@/lib/types";
import {
  salvarIdentidade,
  salvarModulos,
  salvarIA,
  salvarCerebro,
  resetarSenhaCliente,
  definirStatus,
  salvarWhatsApp,
  removerWhatsApp,
} from "./actions";

export const dynamic = "force-dynamic";

const MENSAGENS: Record<string, string> = {
  identidade: "Identidade salva.",
  modulos: "Módulos atualizados.",
  ia: "Configuração de IA salva.",
  cerebro: "Base de conhecimento salva.",
  senha: "Senha do cliente redefinida.",
  status: "Status atualizado.",
  whatsapp: "WhatsApp conectado.",
  whatsapp_off: "WhatsApp desconectado.",
};
const ERROS: Record<string, string> = {
  senha: "A senha precisa de ao menos 6 caracteres.",
  sem_dono: "Este cliente ainda não tem usuário de login.",
  wa: "Preencha WABA ID, Phone Number ID e token de acesso.",
};

export default async function ConfigHubPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const { ok, erro } = await searchParams;
  const s = await getSession();
  if (!s || !ehOwner(s)) redirect("/app");
  const neg = activeNegocioId(s);
  if (!neg) redirect("/owner");

  const negocio = await getNegocio(neg);
  if (!negocio) redirect("/owner/clientes");
  const hub = await getHub(negocio.hub_id);
  const cerebro = await getCerebro(neg);
  const wa = await getWaConexao(neg);
  const host = (await headers()).get("host") || "seu-dominio";
  const webhookUrl = `https://${host}/api/whatsapp/webhook`;
  const mods = hub
    ? modulosEfetivos(negocio, hub)
    : { site: false, instagram: false, financeiro: false, crm: false };

  return (
    <>
      <div className="eyebrow">Visível só pro administrador</div>
      <h1 style={{ margin: "4px 0 0" }}>Configurações · {negocio.nome_fantasia || negocio.nome}</h1>
      <p className="muted">O cliente não vê esta aba.</p>

      {ok && MENSAGENS[ok] && (
        <div className="owner-banner" style={{ marginTop: 8 }}>
          {MENSAGENS[ok]}
        </div>
      )}
      {erro && ERROS[erro] && <div className="err">{ERROS[erro]}</div>}

      <div className="cols-2" style={{ alignItems: "start", marginTop: 16 }}>
        {/* Identidade */}
        <div className="card">
          <h2 style={{ margin: "0 0 12px", fontSize: 17 }}>Identidade</h2>
          <form action={salvarIdentidade}>
            <label htmlFor="nome_fantasia">Nome comercial</label>
            <input id="nome_fantasia" name="nome_fantasia" defaultValue={negocio.nome_fantasia || ""} />
            <label htmlFor="segmento">Segmento</label>
            <input id="segmento" name="segmento" defaultValue={negocio.segmento || ""} />
            <label htmlFor="marca_cor">Cor da marca</label>
            <input id="marca_cor" name="marca_cor" defaultValue={negocio.marca_cor || ""} placeholder="#C0392B" />
            <button className="btn" type="submit" style={{ marginTop: 16 }}>
              Salvar identidade
            </button>
          </form>
        </div>

        {/* Modulos */}
        <div className="card">
          <h2 style={{ margin: "0 0 12px", fontSize: 17 }}>Módulos do cliente</h2>
          <form action={salvarModulos}>
            <div className="grid" style={{ gap: 10 }}>
              <label className="row" style={{ margin: 0 }}>
                <input type="checkbox" name="site" defaultChecked={mods.site} style={{ width: "auto" }} /> Meu site
              </label>
              <label className="row" style={{ margin: 0 }}>
                <input type="checkbox" name="instagram" defaultChecked={mods.instagram} style={{ width: "auto" }} />{" "}
                Instagram
              </label>
              <label className="row" style={{ margin: 0 }}>
                <input type="checkbox" name="crm" defaultChecked={mods.crm} style={{ width: "auto" }} /> CRM
              </label>
              <label className="row" style={{ margin: 0 }}>
                <input type="checkbox" name="financeiro" defaultChecked={mods.financeiro} style={{ width: "auto" }} />{" "}
                Financeiro
              </label>
            </div>
            <button className="btn" type="submit" style={{ marginTop: 16 }}>
              Salvar módulos
            </button>
          </form>
        </div>

        {/* IA */}
        <div className="card">
          <h2 style={{ margin: "0 0 12px", fontSize: 17 }}>Inteligência (Claude)</h2>
          <form action={salvarIA}>
            <label className="row" style={{ margin: "0 0 10px" }}>
              <input type="checkbox" name="ia_habilitada" defaultChecked={negocio.ia_habilitada} style={{ width: "auto" }} />{" "}
              IA habilitada
            </label>
            <label htmlFor="ia_modelo_chat">Modelo do chat</label>
            <select id="ia_modelo_chat" name="ia_modelo_chat" defaultValue={negocio.ia_modelo_chat || "claude-haiku-4-5"}>
              <option value="claude-haiku-4-5">Haiku (mais barato)</option>
              <option value="claude-sonnet-4-6">Sonnet (equilíbrio)</option>
              <option value="claude-opus-4-8">Opus (premium)</option>
            </select>
            <label htmlFor="ia_limite_tokens">Limite de tokens (0 = ilimitado)</label>
            <input id="ia_limite_tokens" name="ia_limite_tokens" type="number" min={0} defaultValue={negocio.ia_limite_tokens || 0} />
            <button className="btn" type="submit" style={{ marginTop: 16 }}>
              Salvar IA
            </button>
          </form>
        </div>

        {/* Acesso do cliente */}
        <div className="card">
          <h2 style={{ margin: "0 0 12px", fontSize: 17 }}>Acesso & status</h2>
          <form action={resetarSenhaCliente}>
            <label htmlFor="nova_senha">Redefinir senha do cliente</label>
            <input id="nova_senha" name="nova_senha" type="text" placeholder="nova senha (mín. 6)" />
            <button className="btn btn-ghost" type="submit" style={{ marginTop: 12 }}>
              Redefinir senha
            </button>
          </form>
          <form action={definirStatus} style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--cor-borda)" }}>
            <label htmlFor="status">Status do cliente</label>
            <select id="status" name="status" defaultValue={negocio.status}>
              <option value="ativo">Ativo</option>
              <option value="em_configuracao">Em configuração</option>
              <option value="arquivado">Arquivado</option>
            </select>
            <button className="btn btn-ghost" type="submit" style={{ marginTop: 12 }}>
              Salvar status
            </button>
          </form>
        </div>
      </div>

      {/* WhatsApp oficial */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="spread">
          <h2 style={{ margin: 0, fontSize: 17 }}>WhatsApp oficial (Cloud API)</h2>
          {wa ? (
            <span className="badge ok">conectado</span>
          ) : (
            <span className="badge warn">não conectado</span>
          )}
        </div>
        <p className="muted" style={{ marginTop: 6 }}>
          No app da Meta, configure o webhook para esta URL e assine o campo <strong>messages</strong>:
        </p>
        <pre
          style={{
            background: "rgba(0,0,0,0.3)",
            border: "1px solid var(--cor-borda)",
            borderRadius: 10,
            padding: "10px 14px",
            overflowX: "auto",
            fontSize: 12.5,
            margin: "0 0 12px",
          }}
        >
          {webhookUrl}
        </pre>
        {wa ? (
          <div className="row" style={{ gap: 14, flexWrap: "wrap" }}>
            <div>
              <div className="muted" style={{ fontSize: 12 }}>Phone Number ID</div>
              <div>{wa.phone_number_id}</div>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12 }}>WABA ID</div>
              <div>{wa.waba_id}</div>
            </div>
            <form action={removerWhatsApp} style={{ marginLeft: "auto" }}>
              <button className="btn btn-ghost btn-sm" type="submit">Desconectar</button>
            </form>
          </div>
        ) : (
          <form action={salvarWhatsApp}>
            <div className="cols-2">
              <div>
                <label htmlFor="phone_number_id">Phone Number ID</label>
                <input id="phone_number_id" name="phone_number_id" />
              </div>
              <div>
                <label htmlFor="waba_id">WABA ID</label>
                <input id="waba_id" name="waba_id" />
              </div>
            </div>
            <label htmlFor="access_token">Token de acesso (do número)</label>
            <input id="access_token" name="access_token" />
            <button className="btn" type="submit" style={{ marginTop: 14 }}>
              Conectar WhatsApp
            </button>
          </form>
        )}
      </div>

      {/* Cerebro */}
      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ margin: "0 0 6px", fontSize: 17 }}>Base de conhecimento (cérebro da IA)</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Tudo que a IA deste cliente precisa saber: cardápio, serviços, preços, horários, tom de voz.
        </p>
        <form action={salvarCerebro}>
          <label htmlFor="titulo">Título</label>
          <input id="titulo" name="titulo" defaultValue={cerebro?.titulo || ""} placeholder="Ex.: Cérebro Padaria Aroma" />
          <label htmlFor="conteudo">Conteúdo</label>
          <textarea id="conteudo" name="conteudo" rows={14} defaultValue={cerebro?.conteudo || ""} placeholder="Cole aqui o conhecimento do negócio..." />
          <button className="btn" type="submit" style={{ marginTop: 14 }}>
            Salvar cérebro
          </button>
        </form>
      </div>
    </>
  );
}
