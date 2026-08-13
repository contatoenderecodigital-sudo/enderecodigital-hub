import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { activeNegocioId, estaImpersonando } from "@/lib/tenant";
import { getNegocio } from "@/lib/data";
import { trocarSenha } from "./actions";
import { IcoBuilding, IcoShield, IcoBell, IcoGlobe, IcoInstagram, IcoWhatsapp } from "@/components/icons";

export const dynamic = "force-dynamic";

function Campo({ Icon, label, valor }: { Icon: typeof IcoGlobe; label: string; valor: string }) {
  return (
    <div>
      <div className="kpi-label" style={{ marginBottom: 6 }}>{label}</div>
      <div className="glass-soft" style={{ borderRadius: 11, padding: "11px 13px", display: "flex", alignItems: "center", gap: 9, fontSize: 13.5 }}>
        <Icon width={15} height={15} style={{ opacity: 0.7, flexShrink: 0 }} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{valor}</span>
      </div>
    </div>
  );
}

function Toggle({ label, sub, on }: { label: string; sub: string; on?: boolean }) {
  return (
    <div className="spread" style={{ padding: "12px 0", borderTop: "1px solid var(--line)" }}>
      <div>
        <strong style={{ fontSize: 13.5 }}>{label}</strong>
        <div className="muted" style={{ fontSize: 12 }}>{sub}</div>
      </div>
      <label className="switch">
        <input type="checkbox" defaultChecked={on} />
        <span className="track" />
      </label>
    </div>
  );
}

export default async function ConfigPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const { ok, erro } = await searchParams;
  const s = await getSession();
  if (!s) redirect("/login");
  const impersonando = estaImpersonando(s);
  const negId = activeNegocioId(s);
  const negocio = negId ? await getNegocio(negId) : null;

  return (
    <>
      <div className="eyebrow">Sua conta</div>
      <h1 style={{ margin: "4px 0 0" }}>Privacidade &amp; Perfil</h1>
      <p className="muted">Gerencie seu acesso e dados corporativos.</p>

      {/* Perfil corporativo */}
      <div className="card" style={{ marginTop: 18 }}>
        <div className="row" style={{ gap: 11, marginBottom: 16 }}>
          <div className="icon-box sm"><IcoBuilding width={16} height={16} /></div>
          <strong style={{ fontSize: 15 }}>Perfil corporativo</strong>
        </div>
        <div className="cols-2" style={{ gap: 14 }}>
          <Campo Icon={IcoBuilding} label="Razão social" valor={negocio?.nome || "—"} />
          <Campo Icon={IcoGlobe} label="Identidade web" valor={negocio?.dominio || negocio?.site_url || "Pendente"} />
          <Campo Icon={IcoInstagram} label="Instagram" valor={negocio?.instagram_url || "Não vinculado"} />
          <Campo Icon={IcoWhatsapp} label="Contato" valor={negocio?.wpp_comercial || negocio?.resp_whatsapp || "N/A"} />
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 14, marginBottom: 0 }}>
          Dados estruturais. Para alterações, fale com o suporte.
        </p>
      </div>

      {/* Acesso & segurança */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="row" style={{ gap: 11, marginBottom: 16 }}>
          <div className="icon-box sm"><IcoShield width={16} height={16} /></div>
          <strong style={{ fontSize: 15 }}>Acesso &amp; Segurança</strong>
        </div>
        <div className="kpi-label">E-mail de acesso</div>
        <p style={{ margin: "6px 0 16px" }}>{s.email}</p>

        {impersonando ? (
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Você está no modo owner. Para gerenciar o acesso do cliente, use a aba <strong>Config. do cliente</strong>.
          </p>
        ) : (
          <>
            {ok && <div className="owner-banner" style={{ marginBottom: 12 }}>Senha alterada.</div>}
            {erro === "atual" && <div className="err">Senha atual incorreta.</div>}
            {erro === "curta" && <div className="err">A nova senha precisa de ao menos 6 caracteres.</div>}
            <form action={trocarSenha}>
              <div className="cols-2" style={{ gap: 14 }}>
                <div>
                  <label htmlFor="atual">Senha atual</label>
                  <input id="atual" name="atual" type="password" required />
                </div>
                <div>
                  <label htmlFor="nova">Nova senha</label>
                  <input id="nova" name="nova" type="password" placeholder="No mínimo 6 dígitos" required />
                </div>
              </div>
              <button className="btn" type="submit" style={{ marginTop: 16 }}>Atualizar credencial</button>
            </form>
          </>
        )}
      </div>

      {/* Notificações */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="row" style={{ gap: 11, marginBottom: 6 }}>
          <div className="icon-box sm"><IcoBell width={16} height={16} /></div>
          <strong style={{ fontSize: 15 }}>Notificações</strong>
        </div>
        <Toggle label="E-mail de alertas" sub="Relatórios e faturas" on />
        <Toggle label="WhatsApp live" sub="Avisos de suporte" on />
        <Toggle label="Segurança 2FA" sub="Login em duas etapas" on />
      </div>
    </>
  );
}
