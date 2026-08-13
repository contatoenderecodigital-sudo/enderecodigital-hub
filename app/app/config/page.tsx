import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { estaImpersonando } from "@/lib/tenant";
import { trocarSenha } from "./actions";

export const dynamic = "force-dynamic";

export default async function ConfigPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const { ok, erro } = await searchParams;
  const s = await getSession();
  if (!s) redirect("/login");
  const impersonando = estaImpersonando(s);

  return (
    <>
      <div className="eyebrow">Sua conta</div>
      <h1 style={{ margin: "4px 0 0" }}>Configurações</h1>
      <p className="muted">Perfil e senha de acesso.</p>

      <div className="card" style={{ marginTop: 16, maxWidth: 460 }}>
        <div className="kpi-label">E-mail de acesso</div>
        <p style={{ margin: "6px 0 0" }}>{s.email}</p>
      </div>

      {impersonando ? (
        <div className="card" style={{ marginTop: 16, maxWidth: 460 }}>
          <p className="muted" style={{ margin: 0 }}>
            Você está no modo owner. Para gerenciar o acesso do cliente, use a aba
            <strong> Config. do cliente</strong>.
          </p>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 16, maxWidth: 460 }}>
          <h2 style={{ margin: "0 0 10px", fontSize: 17 }}>Trocar senha</h2>
          {ok && <div className="owner-banner" style={{ marginBottom: 12 }}>Senha alterada.</div>}
          {erro === "atual" && <div className="err">Senha atual incorreta.</div>}
          {erro === "curta" && <div className="err">A nova senha precisa de ao menos 6 caracteres.</div>}
          <form action={trocarSenha}>
            <label htmlFor="atual">Senha atual</label>
            <input id="atual" name="atual" type="password" required />
            <label htmlFor="nova">Nova senha</label>
            <input id="nova" name="nova" type="password" required />
            <button className="btn" type="submit" style={{ marginTop: 16 }}>
              Salvar nova senha
            </button>
          </form>
        </div>
      )}
    </>
  );
}
