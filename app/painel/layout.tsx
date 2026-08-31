import { redirect } from "next/navigation";
import Link from "@/components/link";
import { getSession } from "@/lib/auth";
import { getNegocio, getHub } from "@/lib/data";
import { modulosEfetivos } from "@/lib/types";
import { activeNegocioId, estaImpersonando } from "@/lib/tenant";
import { IcoShield } from "@/components/icons";
import PainelNav from "@/components/painel-nav";

// ============================================================================
//  PAINEL DO CLIENTE · a casca do workspace
//
//  Faltava. Ate aqui so owner_plataforma e parceiro tinham onde entrar: quem
//  loga como 'dono' ou 'operador' caia de volta no /login, porque nao existia
//  tela pra ele. Sem isso o cliente nao consegue usar modulo nenhum, e o
//  produto inteiro depende do cliente operar sozinho.
//
//  MORA EM /painel, NAO EM /ws. O /ws/[neg] ja existe e faz outra coisa: e o
//  owner abrindo, dentro de um iframe, o painel PROPRIO de um cliente que tem
//  dominio separado. Se este ficasse em /ws, a rota /ws/veiculos seria lida
//  pelo Next como o parametro [neg] valendo "veiculos".
//
//  QUEM ENTRA: dono e operador, no proprio negocio. O owner tambem entra, mas
//  so quando esta impersonando alguem, e aí leva a faixa MODO OWNER junto. Sem
//  impersonar, ele nao tem negocio nenhum pra ver e volta pro console.
//
//  A BARRA LATERAL SO MOSTRA MODULO LIGADO E PRONTO. Duas condicoes, nao uma.
//  Ligado e o cliente ter contratado; pronto e a tela existir de verdade. Site
//  e Funil ja vem ligados por padrao do hub e ainda nao tem tela aqui: se
//  aparecessem, seriam link pra 404. Link que nao leva a lugar nenhum ensina a
//  pessoa a nao clicar em mais nada.
// ============================================================================

export const dynamic = "force-dynamic";

type Modulo = {
  chave: string;
  rotulo: string;
  href: string;
  /** O cliente contratou. */
  ligado: boolean;
  /** A tela existe. Vira true quando o modulo for construido aqui. */
  pronto: boolean;
};

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  if (!s) redirect("/login");

  // A fonte do inquilino e a SESSAO, nunca a URL. Id de URL vem do usuario.
  const negocioId = activeNegocioId(s);
  if (!negocioId) {
    // Owner sem impersonar nao tem workspace. Volta pro console dele.
    redirect(s.papel === "owner_plataforma" ? "/owner" : "/login");
  }

  const negocio = await getNegocio(negocioId);
  if (!negocio) redirect(s.papel === "owner_plataforma" ? "/owner" : "/login");

  const nome = negocio.nome_fantasia || negocio.nome;

  // Modulo ligado e o par negocio + hub: a marca define o padrao, o cliente
  // pode ser excecao. Ler so o negocio ignoraria o padrao do hub.
  const hub = await getHub(negocio.hub_id);
  const mods = hub ? modulosEfetivos(negocio, hub) : null;

  const modulos: Modulo[] = [
    { chave: "geral", rotulo: "Visão geral", href: "/painel", ligado: true, pronto: true },
    { chave: "veiculos", rotulo: "Veículos", href: "/painel/veiculos", ligado: !!mods?.veiculos, pronto: true },
    { chave: "crm", rotulo: "Funil", href: "/painel/funil", ligado: !!mods?.crm, pronto: false },
    { chave: "site", rotulo: "Meu site", href: "/painel/site", ligado: !!mods?.site, pronto: false },
    { chave: "financeiro", rotulo: "Financeiro", href: "/painel/financeiro", ligado: !!mods?.financeiro, pronto: false },
  ].filter((m) => m.ligado && m.pronto);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {estaImpersonando(s) ? (
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            padding: "9px 16px", background: "linear-gradient(90deg,#0f2a1a,#123322)",
            color: "#c7f0d2", borderBottom: "1px solid rgba(111,211,155,0.3)",
            fontSize: 13, flexShrink: 0,
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <IcoShield width={16} height={16} />
            <strong style={{ color: "#eafff0" }}>MODO OWNER</strong>
            <span style={{ opacity: 0.85 }}>
              · dentro do workspace de <strong style={{ color: "#fff" }}>{nome}</strong>
            </span>
          </span>
          <Link href="/owner" style={{ color: "#c7f0d2" }}>Voltar ao console</Link>
        </div>
      ) : null}

      <div style={{ flex: 1, display: "flex", alignItems: "stretch" }}>
        <aside
          style={{
            width: 236, flexShrink: 0, padding: "22px 14px",
            borderRight: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 22,
          }}
        >
          <div style={{ padding: "0 10px" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", lineHeight: 1.2 }}>
              {nome}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
              {negocio.segmento || "Workspace"}
            </div>
          </div>

          <PainelNav itens={modulos.map(({ chave, rotulo, href }) => ({ chave, rotulo, href }))} />

          <div style={{ marginTop: "auto", padding: "0 10px" }}>
            <Link href="/logout" style={{ fontSize: 13, color: "var(--muted)" }}>Sair</Link>
          </div>
        </aside>

        <main style={{ flex: 1, minWidth: 0, padding: "28px 32px" }}>{children}</main>
      </div>
    </div>
  );
}
