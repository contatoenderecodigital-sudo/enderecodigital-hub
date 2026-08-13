"use client";

import { useState } from "react";
import { criarClienteAction } from "@/app/owner/clientes/actions";
import {
  IcoPlus,
  IcoX,
  IcoBuilding,
  IcoUsers,
  IcoGlobe,
  IcoGrid,
  IcoSparkles,
  IcoInstagram,
  IcoFunnel,
  IcoActivity,
  IcoKey,
  IcoSettings,
} from "@/components/icons";

type Hub = { id: string; nome: string; slug: string };
type IconType = typeof IcoUsers;

function SecHead({ Icon, t, p }: { Icon: IconType; t: string; p: string }) {
  return (
    <div className="sec-head">
      <div className="icon-box sm"><Icon width={16} height={16} /></div>
      <div>
        <h3>{t}</h3>
        <p>{p}</p>
      </div>
    </div>
  );
}

function Switch({ name, defaultChecked, checked, onChange }: { name: string; defaultChecked?: boolean; checked?: boolean; onChange?: (v: boolean) => void }) {
  return (
    <span className="switch">
      <input
        type="checkbox"
        name={name}
        {...(onChange ? { checked, onChange: (e) => onChange(e.target.checked) } : { defaultChecked })}
      />
      <span className="track" />
    </span>
  );
}

function ModCard({ name, Icon, titulo, desc, on = true }: { name: string; Icon: IconType; titulo: string; desc: string; on?: boolean }) {
  return (
    <label className="toggle-card">
      <div className="spread">
        <div className="icon-box sm"><Icon width={16} height={16} /></div>
        <Switch name={name} defaultChecked={on} />
      </div>
      <div className="tc-title">{titulo}</div>
      <div className="tc-desc">{desc}</div>
    </label>
  );
}

function RadioCard({ name, value, titulo, sub, defaultChecked }: { name: string; value: string; titulo: string; sub: string; defaultChecked?: boolean }) {
  return (
    <label className="select-card">
      <input type="radio" name={name} value={value} defaultChecked={defaultChecked} />
      <div className="sc">
        <div className="sc-title">{titulo}</div>
        <div className="sc-sub">{sub}</div>
      </div>
    </label>
  );
}

export default function NovoClienteModal({ hubs }: { hubs: Hub[] }) {
  const [open, setOpen] = useState(false);
  const [exp, setExp] = useState(false);

  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}>
        <IcoPlus width={16} height={16} /> Novo cliente
      </button>

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="icon-box"><IcoBuilding width={20} height={20} /></div>
              <div>
                <h2>Cadastrar novo cliente</h2>
                <p>Preencha os dados para criar o cliente e o workspace.</p>
              </div>
              <button className="modal-close" onClick={() => setOpen(false)} aria-label="Fechar"><IcoX width={18} height={18} /></button>
            </div>

            <form action={criarClienteAction} style={{ display: "contents" }}>
              <div className="modal-body">
                {/* Plataforma */}
                <section>
                  <SecHead Icon={IcoGrid} t="Plataforma" p="Em qual hub este cliente vive?" />
                  <div className="select-grid">
                    {hubs.map((h, i) => (
                      <RadioCard key={h.id} name="hub_id" value={h.id} titulo={h.nome} sub={`/${h.slug}`} defaultChecked={i === 0} />
                    ))}
                  </div>
                </section>

                {/* Experimental */}
                <label className="toggle-card" style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <Switch name="experimental" checked={exp} onChange={setExp} />
                  <div>
                    <div className="tc-title" style={{ marginTop: 0 }}>Cliente experimental</div>
                    <div className="tc-desc">Sem login — criado só pra testar o fluxo. Só você acessa, abrindo o workspace pelo painel.</div>
                  </div>
                </label>

                {/* Identidade */}
                <section>
                  <SecHead Icon={IcoBuilding} t="Identidade do cliente" p="Marca, nome e cor que aparecem no hub." />
                  <div className="cols-2">
                    <div>
                      <label htmlFor="nome">Nome da empresa *</label>
                      <input id="nome" name="nome" placeholder="Razão social" required />
                    </div>
                    <div>
                      <label htmlFor="nome_fantasia">Nome comercial / apelido</label>
                      <input id="nome_fantasia" name="nome_fantasia" placeholder="Nome fantasia" />
                    </div>
                    <div>
                      <label htmlFor="segmento">Segmento / nicho</label>
                      <input id="segmento" name="segmento" placeholder="Ex.: Padaria" />
                    </div>
                    <div>
                      <label htmlFor="marca_cor">Cor principal da marca</label>
                      <input id="marca_cor" name="marca_cor" placeholder="#C0392B" />
                    </div>
                    <div>
                      <label htmlFor="marca_logo">Logo (URL)</label>
                      <input id="marca_logo" name="marca_logo" placeholder="https://..." />
                    </div>
                  </div>
                </section>

                {/* Responsável */}
                <section>
                  <SecHead Icon={IcoUsers} t="Responsável principal" p="Quem fala pela empresa no dia a dia." />
                  <div className="cols-2">
                    <div>
                      <label htmlFor="resp_nome">Nome do responsável</label>
                      <input id="resp_nome" name="resp_nome" />
                    </div>
                    <div>
                      <label htmlFor="resp_cargo">Cargo / função</label>
                      <input id="resp_cargo" name="resp_cargo" />
                    </div>
                    <div>
                      <label htmlFor="resp_email">E-mail de contato</label>
                      <input id="resp_email" name="resp_email" type="email" />
                    </div>
                    <div>
                      <label htmlFor="resp_whatsapp">WhatsApp / telefone</label>
                      <input id="resp_whatsapp" name="resp_whatsapp" placeholder="+55 49 99999-9999" />
                    </div>
                  </div>
                </section>

                {/* Presença digital */}
                <section>
                  <SecHead Icon={IcoGlobe} t="Presença digital" p="Site, redes e contato do cliente." />
                  <div className="cols-2">
                    <div>
                      <label htmlFor="dominio">Domínio principal</label>
                      <input id="dominio" name="dominio" placeholder="empresa.com.br" />
                    </div>
                    <div>
                      <label htmlFor="site_url">Site atual (URL)</label>
                      <input id="site_url" name="site_url" placeholder="https://..." />
                    </div>
                    <div>
                      <label htmlFor="instagram_url">Instagram (URL)</label>
                      <input id="instagram_url" name="instagram_url" />
                    </div>
                    <div>
                      <label htmlFor="wpp_comercial">WhatsApp comercial</label>
                      <input id="wpp_comercial" name="wpp_comercial" />
                    </div>
                  </div>
                </section>

                {/* Módulos */}
                <section>
                  <SecHead Icon={IcoGrid} t="Módulos do cliente" p="Ligue só o que este cliente usa — dá pra religar depois em Config. do cliente." />
                  <div className="cols-2">
                    <ModCard name="mod_site" Icon={IcoGlobe} titulo="Meu site" desc="Aba do site + métricas." on />
                    <ModCard name="mod_instagram" Icon={IcoInstagram} titulo="Instagram" desc="Gerador de conteúdo e biblioteca." on />
                    <ModCard name="mod_financeiro" Icon={IcoActivity} titulo="Financeiro" desc="Painel de caixa e faturas." on={false} />
                    <ModCard name="mod_crm" Icon={IcoFunnel} titulo="CRM" desc="Funil de vendas + WhatsApp." on />
                  </div>
                </section>

                {/* Configuração operacional */}
                <section>
                  <SecHead Icon={IcoSettings} t="Configuração operacional" p="Tipo de cliente, status e observações internas." />
                  <div className="select-grid" style={{ marginBottom: 14 }}>
                    <RadioCard name="tipo_cliente" value="recorrente" titulo="Recorrente" sub="Geração de conteúdo ativa" />
                    <RadioCard name="tipo_cliente" value="nao_recorrente" titulo="Não recorrente" sub="Apenas biblioteca de posts" />
                    <RadioCard name="tipo_cliente" value="nao_definido" titulo="Não definido" sub="A definir" defaultChecked />
                  </div>
                  <div className="cols-2">
                    <div>
                      <label htmlFor="status">Status inicial</label>
                      <select id="status" name="status" defaultValue="ativo">
                        <option value="ativo">Ativo</option>
                        <option value="em_configuracao">Em configuração</option>
                        <option value="arquivado">Arquivado</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="health_score">Health Score (0-100)</label>
                      <input id="health_score" name="health_score" type="number" min={0} max={100} defaultValue={100} />
                    </div>
                  </div>
                  <label htmlFor="observacoes">Observações internas</label>
                  <textarea id="observacoes" name="observacoes" rows={3} placeholder="Informações relevantes para o atendimento..." />
                </section>

                {/* Claude IA */}
                <section>
                  <SecHead Icon={IcoSparkles} t="Assistente de IA (Claude)" p="Se este cliente terá o assistente no workspace, e qual assinatura." />
                  <div className="select-grid">
                    <RadioCard name="ia_modo" value="sem_ia" titulo="Sem IA" sub="O cliente não terá o assistente." />
                    <RadioCard name="ia_modo" value="api_plataforma" titulo="IA da plataforma" sub="API Anthropic, custo medido (recomendado)." defaultChecked />
                    <RadioCard name="ia_modo" value="claude_cliente" titulo="Claude do cliente" sub="O cliente traz a própria assinatura." />
                  </div>
                </section>

                {/* Acesso (se não experimental) */}
                {!exp && (
                  <section>
                    <SecHead Icon={IcoKey} t="Acesso do cliente" p="Uma conta de login para o cliente entrar no workspace dele." />
                    <div className="cols-2">
                      <div>
                        <label htmlFor="email">E-mail de login</label>
                        <input id="email" name="email" type="email" placeholder="cliente@empresa.com" />
                      </div>
                      <div>
                        <label htmlFor="senha">Senha inicial</label>
                        <input id="senha" name="senha" type="text" placeholder="mín. 8 caracteres" />
                      </div>
                    </div>
                  </section>
                )}
              </div>

              <div className="modal-foot">
                <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancelar</button>
                <button type="submit" className="btn">Criar cadastro</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
