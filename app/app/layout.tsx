import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { activeNegocioId, estaImpersonando } from "@/lib/tenant";
import { getNegocio, getHub } from "@/lib/data";
import { modulosEfetivos } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const s = await getSession();
  if (!s) redirect("/login");

  const negId = activeNegocioId(s);
  if (!negId) {
    // Owner sem cliente aberto -> volta pro console.
    if (s.papel === "owner_plataforma") redirect("/owner");
    redirect("/login");
  }

  const negocio = await getNegocio(negId as string);
  if (!negocio) {
    if (s.papel === "owner_plataforma") redirect("/owner/clientes");
    redirect("/login");
  }
  const hub = await getHub(negocio.hub_id);
  const mods = hub ? modulosEfetivos(negocio, hub) : { site: false, instagram: false, financeiro: false, crm: false };

  const accent = negocio.marca_cor || hub?.cor_destaque || "#C9A961";
  const shellStyle = { ["--cor-destaque" as string]: accent } as React.CSSProperties;
  const impersonando = estaImpersonando(s);

  return (
    <div className="shell" style={shellStyle}>
      <nav className="side">
        <div className="brand">{negocio.nome_fantasia || negocio.nome}</div>
        <Link href="/app">Visão geral</Link>
        {mods.site && <Link href="/app/site">Meu site</Link>}
        {mods.instagram && <Link href="/app/instagram">Instagram</Link>}
        {mods.crm && <Link href="/app/crm">CRM</Link>}
        <Link href="/app/whatsapp">WhatsApp</Link>
        {mods.financeiro && <Link href="/app/financeiro">Financeiro</Link>}
        <Link href="/app/assistente">Assistente</Link>
        <Link href="/app/config">Configurações</Link>
        <div style={{ flex: 1 }} />
        {impersonando ? (
          <Link href="/sair-modo-owner">Voltar ao console</Link>
        ) : (
          <Link href="/logout">Sair</Link>
        )}
      </nav>
      <main className="content">
        {impersonando && (
          <div className="owner-banner">
            MODO OWNER · editando o workspace de{" "}
            <strong>{negocio.nome_fantasia || negocio.nome}</strong>. O cliente não vê esta
            faixa.
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
