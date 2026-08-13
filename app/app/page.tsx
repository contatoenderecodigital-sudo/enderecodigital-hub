import Link from "@/components/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { activeNegocioId } from "@/lib/tenant";
import { getNegocio, getHub, leadsResumo, usoResumo, getWaConexao } from "@/lib/data";
import { modulosEfetivos } from "@/lib/types";
import LiveClock from "@/components/live-clock";
import {
  IcoSparkles,
  IcoWhatsapp,
  IcoGlobe,
  IcoInstagram,
  IcoActivity,
  IcoSend,
} from "@/components/icons";

export const dynamic = "force-dynamic";

function StatusCard({
  Icon,
  label,
  titulo,
  sub,
  estado,
  href,
}: {
  Icon: typeof IcoGlobe;
  label: string;
  titulo: string;
  sub: string;
  estado: "ativo" | "vazio";
  href: string;
}) {
  return (
    <Link href={href} className="card" style={{ display: "block" }}>
      <div className="spread">
        <div className="icon-box">
          <Icon width={20} height={20} />
        </div>
        <span className={"badge " + (estado === "ativo" ? "gold" : "")}>
          {estado === "ativo" ? "ativo" : "vazio"}
        </span>
      </div>
      <div className="eyebrow" style={{ marginTop: 14 }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 16, marginTop: 3 }}>{titulo}</div>
      <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{sub}</div>
    </Link>
  );
}

const SUGESTOES = [
  "O que você sabe sobre a minha empresa?",
  "Resuma minha presença digital atual",
  "Que conteúdo devo postar essa semana?",
];

export default async function VisaoGeral() {
  const s = await getSession();
  const negId = activeNegocioId(s);
  if (!negId) redirect("/login");
  const negocio = await getNegocio(negId);
  if (!negocio) redirect("/login");
  const hub = await getHub(negocio.hub_id);
  const mods = hub
    ? modulosEfetivos(negocio, hub)
    : { site: false, instagram: false, financeiro: false, crm: false };
  const [leads, uso, wa] = await Promise.all([
    leadsResumo(negId),
    usoResumo(negId),
    getWaConexao(negId),
  ]);
  const waAtivo = !!(wa && (wa as { phone_number_id?: string }).phone_number_id);

  return (
    <>
      <div className="eyebrow">
        <IcoSparkles width={14} height={14} /> {hub?.nome || "Endereço Digital"}
      </div>
      <h1 style={{ marginTop: 8 }}>{negocio.nome_fantasia || negocio.nome}</h1>
      <p className="muted" style={{ marginTop: 4 }}>
        Tudo da sua presença digital, em tempo real.
      </p>

      <div className="cols-4" style={{ marginTop: 20 }}>
        <StatusCard
          Icon={IcoWhatsapp}
          label="Diferencial"
          titulo="WhatsApp oficial"
          sub={waAtivo ? "Número conectado" : "Aguardando conexão"}
          estado={waAtivo ? "ativo" : "vazio"}
          href="/app/whatsapp"
        />
        <StatusCard
          Icon={IcoGlobe}
          label="Meu site"
          titulo={mods.site && negocio.site_url ? "Site ativo" : "Sem site"}
          sub={negocio.site_url || "Adicione a URL no cadastro"}
          estado={mods.site && negocio.site_url ? "ativo" : "vazio"}
          href="/app/site"
        />
        <StatusCard
          Icon={IcoInstagram}
          label="Instagram"
          titulo={negocio.instagram_url ? "Conectado" : "Não conectado"}
          sub={negocio.instagram_url ? "Perfil vinculado — veja a aba" : "Vincule na aba Instagram"}
          estado={negocio.instagram_url ? "ativo" : "vazio"}
          href="/app/instagram"
        />
        <StatusCard
          Icon={IcoActivity}
          label="Assistente · IA"
          titulo={uso.interacoes > 0 ? `${uso.interacoes} conversas` : "Sem contexto ainda"}
          sub={negocio.ia_habilitada ? "IA habilitada" : "Aguardando ativação"}
          estado={negocio.ia_habilitada ? "ativo" : "vazio"}
          href="/app/assistente"
        />
      </div>

      <LiveClock />

      <div className="ws-chat" style={{ marginTop: 18 }}>
        <div className="ws-chat-empty">
          <div className="icon-box" style={{ width: 52, height: 52, margin: "0 auto 14px" }}>
            <IcoSparkles width={24} height={24} />
          </div>
          <h2 style={{ margin: 0, fontSize: 18 }}>Converse com o Claude</h2>
          <p className="muted" style={{ margin: "6px auto 0", maxWidth: 440, fontSize: 13.5 }}>
            Ela conhece os arquivos e os dados da sua empresa. Pergunte o que quiser —
            ou arraste arquivos aqui pra incluir.
          </p>
        </div>

        <div className="chat-suggest">
          {SUGESTOES.map((q) => (
            <Link key={q} href={"/app/assistente?q=" + encodeURIComponent(q)} style={{ display: "block" }}>
              <button type="button">{q}</button>
            </Link>
          ))}
        </div>

        <Link href="/app/assistente" style={{ display: "block", textDecoration: "none" }}>
          <div className="chat-input">
            <input placeholder="Peça algo ao Claude… (cole prints aqui)" readOnly />
            <button className="btn" style={{ padding: "8px 12px" }} tabIndex={-1}>
              <IcoSend width={16} height={16} />
            </button>
          </div>
        </Link>
        <p className="muted" style={{ textAlign: "center", fontSize: 11.5, marginTop: 10 }}>
          {leads.total} leads · {negocio.health_score}% de saúde · motor de IA por API Anthropic, custo medido.
        </p>
      </div>
    </>
  );
}
