import { redirect } from "next/navigation";
import crypto from "node:crypto";
import Link from "@/components/link";
import { getSession } from "@/lib/auth";
import { getNegocio } from "@/lib/data";
import { IcoShield, IcoChevronRight } from "@/components/icons";

export const dynamic = "force-dynamic";

// token SSO curto (5 min) assinado com SSO_SECRET — o painel resolve o dono pelo negocioId.
function ssoToken(negocioId: string): string {
  const secret = process.env.SSO_SECRET || "";
  const payload = Buffer.from(JSON.stringify({ negocioId, exp: Date.now() + 5 * 60 * 1000 })).toString("base64url");
  const mac = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${mac}`;
}

export default async function WorkspacePainel({ params }: { params: Promise<{ neg: string }> }) {
  const { neg } = await params;
  const s = await getSession();
  if (!s || s.papel !== "owner_plataforma") redirect("/login");
  const negocio = await getNegocio(neg);
  if (!negocio) redirect("/owner");
  if (!negocio.dominio) redirect("/owner"); // sem painel próprio ainda

  const src = `https://${negocio.dominio}/sso?t=${encodeURIComponent(ssoToken(neg))}`;
  const nome = negocio.nome_fantasia || negocio.nome;

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: "#0b1220" }}>
      {/* faixa MODO OWNER */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        padding: "9px 16px", background: "linear-gradient(90deg,#0f2a1a,#123322)", color: "#c7f0d2",
        borderBottom: "1px solid rgba(111,211,155,0.3)", fontSize: 13, flexShrink: 0,
      }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <IcoShield width={16} height={16} />
          <strong style={{ color: "#eafff0" }}>MODO OWNER</strong>
          <span style={{ opacity: 0.85 }}>· Editando o workspace de <strong style={{ color: "#fff" }}>{nome}</strong></span>
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 14 }}>
          <Link href="/owner" style={{ color: "#c7f0d2", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <IcoChevronRight width={15} height={15} style={{ transform: "scaleX(-1)" }} /> Voltar ao console
          </Link>
        </span>
      </div>
      {/* painel do cliente embutido (design dele, isolado) */}
      <iframe
        src={src}
        title={`Painel de ${nome}`}
        style={{ flex: 1, width: "100%", border: "none", background: "#fff" }}
      />
    </div>
  );
}
