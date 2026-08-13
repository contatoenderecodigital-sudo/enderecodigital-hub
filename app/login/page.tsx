import { resolveHubByHost, DEFAULT_BRAND } from "@/lib/branding";

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
        <div className="row" style={{ gap: 12, marginBottom: 18 }}>
          <div className="avatar">ED</div>
          <b style={{ fontSize: 16 }}>{nome}</b>
        </div>
        <div className="eyebrow">Plataforma</div>
        <h1 style={{ marginTop: 6 }}>Acesse o seu painel</h1>
        <p className="muted" style={{ marginTop: 4 }}>
          Entre com o seu e-mail e senha.
        </p>

        <form action="/api/login" method="post">
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
