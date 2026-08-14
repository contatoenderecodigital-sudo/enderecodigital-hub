import PageHead from "@/components/page-head";
import { getHubConfig } from "@/lib/platform-config";
import { salvarConfigAction } from "@/app/owner/actions";
import { hubOpId } from "@/lib/hub-ctx";
import { IcoSparkles, IcoGlobe } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function ConfigOwnerPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const { ok } = await searchParams;
  const hub = await hubOpId();
  const cfg = await getHubConfig();
  const temChaveGlobal = !!process.env.ANTHROPIC_API_KEY;

  return (
    <>
      <PageHead eyebrow="Sistema" titulo="Configurações" sub="Identidade, domínio e IA do hub ativo." />

      {ok && <div className="owner-banner" style={{ borderRadius: 12, marginBottom: 16 }}>Configurações salvas.</div>}

      {!hub || !cfg ? (
        <div className="err">Entre em um hub para editar as configurações dele.</div>
      ) : (
        <>
          <form action={salvarConfigAction} className="card" style={{ marginBottom: 18 }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Identidade do hub</div>
            <div className="cols-2" style={{ gap: 14 }}>
              <div><label>Nome *</label><input name="nome" defaultValue={cfg.nome} required /></div>
              <div><label>Domínio</label><input name="dominio" defaultValue={cfg.dominio || ""} placeholder="hub.exemplo.com.br" /></div>
              <div style={{ gridColumn: "1 / -1" }}><label>Descrição</label><input name="descricao" defaultValue={cfg.descricao || ""} placeholder="Descrição curta (PWA)" /></div>
              <div><label>Cor de destaque</label><input name="cor_destaque" defaultValue={cfg.cor_destaque || "#C9A961"} placeholder="#C9A961" /></div>
              <div><label>Teto de IA / mês (US$)</label><input name="ia_limite_mensal_usd" inputMode="decimal" defaultValue={String(cfg.ia_limite_mensal_usd || 0)} /></div>
              <div><label>Título da tela de login</label><input name="login_titulo" defaultValue={cfg.login_titulo || ""} /></div>
              <div><label>Texto do botão de login</label><input name="login_botao" defaultValue={cfg.login_botao || ""} /></div>
            </div>
            <div style={{ marginTop: 16 }}><button className="btn" type="submit">Salvar configurações</button></div>
          </form>

          <div className="cols-2">
            <div className="card">
              <div className="row" style={{ gap: 11 }}>
                <div className="icon-box"><IcoSparkles width={18} height={18} /></div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 16 }}>Integração de IA</h2>
                  <p className="muted" style={{ margin: "2px 0 0", fontSize: 13 }}>Chave da Anthropic (motor dos assistentes).</p>
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <span className={"badge " + (cfg.tem_anthropic ? "ok" : "warn")}>
                  {cfg.tem_anthropic ? "chave do hub configurada" : "hub sem chave"}
                </span>{" "}
                <span className={"badge " + (temChaveGlobal ? "ok" : "")}>
                  {temChaveGlobal ? "API central disponível" : "sem API central"}
                </span>
              </div>
              <p className="muted" style={{ fontSize: 12.5, marginTop: 12, lineHeight: 1.6 }}>
                A chave do hub fica no banco (coluna <code>anthropic_api_key</code>); a central vem da env <code>ANTHROPIC_API_KEY</code> no servidor. Sem nenhuma das duas, a geração de conteúdo não roda.
              </p>
            </div>

            <div className="card">
              <div className="row" style={{ gap: 11 }}>
                <div className="icon-box"><IcoGlobe width={18} height={18} /></div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 16 }}>Endereço</h2>
                  <p className="muted" style={{ margin: "2px 0 0", fontSize: 13 }}>Slug interno e domínio do hub.</p>
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <div className="muted" style={{ fontSize: 12 }}>slug</div>
                <div style={{ fontWeight: 600 }}>{cfg.slug}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>domínio</div>
                <div style={{ fontWeight: 600 }}>{cfg.dominio || "— não configurado —"}</div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
