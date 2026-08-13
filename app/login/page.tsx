import { resolveHubByHost, DEFAULT_BRAND } from "@/lib/branding";
import { login } from "./actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const hub = await resolveHubByHost().catch(() => null);
  const nome = hub?.login_titulo || hub?.nome || DEFAULT_BRAND.nome;
  const botao = hub?.login_botao || "Entrar";

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <div className="kpi-label gold">Plataforma</div>
        <h1>{nome}</h1>
        <p className="muted" style={{ marginTop: 4 }}>
          Acesse o seu painel.
        </p>

        <form action={login}>
          <label htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" autoComplete="username" required />

          <label htmlFor="senha">Senha</label>
          <input
            id="senha"
            name="senha"
            type="password"
            autoComplete="current-password"
            required
          />

          {erro ? <div className="err">E-mail ou senha incorretos.</div> : null}

          <button className="btn" type="submit" style={{ width: "100%", marginTop: 18 }}>
            {botao}
          </button>
        </form>
      </div>
    </div>
  );
}
