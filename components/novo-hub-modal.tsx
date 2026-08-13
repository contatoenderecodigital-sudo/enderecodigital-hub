"use client";

import { useState } from "react";
import { criarHubAction } from "@/app/owner/hubs/actions";
import {
  IcoPlus,
  IcoX,
  IcoHub,
  IcoGrid,
  IcoGlobe,
  IcoInstagram,
  IcoActivity,
  IcoFunnel,
  IcoSettings,
} from "@/components/icons";

type IconType = typeof IcoHub;

function SecHead({ Icon, t, p }: { Icon: IconType; t: string; p: string }) {
  return (
    <div className="sec-head">
      <div className="icon-box sm"><Icon width={16} height={16} /></div>
      <div><h3>{t}</h3><p>{p}</p></div>
    </div>
  );
}
function Switch({ name, defaultChecked }: { name: string; defaultChecked?: boolean }) {
  return (
    <span className="switch">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} />
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
      <div className="sc"><div className="sc-title">{titulo}</div><div className="sc-sub">{sub}</div></div>
    </label>
  );
}

export default function NovoHubModal() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}>
        <IcoPlus width={16} height={16} /> Novo hub
      </button>

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="icon-box"><IcoHub width={20} height={20} /></div>
              <div>
                <h2>Novo hub</h2>
                <p>Uma marca white-label completa (tema, cores, módulos e domínio).</p>
              </div>
              <button className="modal-close" onClick={() => setOpen(false)} aria-label="Fechar"><IcoX width={18} height={18} /></button>
            </div>

            <form action={criarHubAction} style={{ display: "contents" }}>
              <div className="modal-body">
                {/* Identidade */}
                <section>
                  <SecHead Icon={IcoHub} t="Identidade" p="Nome, descrição e textos do login." />
                  <div className="cols-2">
                    <div>
                      <label htmlFor="nome">Nome do hub *</label>
                      <input id="nome" name="nome" placeholder="Ex.: ClinicDigital" required />
                    </div>
                    <div>
                      <label htmlFor="descricao">Descrição</label>
                      <input id="descricao" name="descricao" placeholder="Hub de clínicas..." />
                    </div>
                    <div>
                      <label htmlFor="login_titulo">Título do login</label>
                      <input id="login_titulo" name="login_titulo" placeholder="ClinicDigital" />
                    </div>
                    <div>
                      <label htmlFor="login_botao">Botão do login</label>
                      <input id="login_botao" name="login_botao" defaultValue="Entrar" />
                    </div>
                  </div>
                </section>

                {/* Visual */}
                <section>
                  <SecHead Icon={IcoGrid} t="Visual" p="Tema, cores e tipografia da marca." />
                  <label style={{ marginTop: 0 }}>Tema</label>
                  <div className="select-grid" style={{ marginBottom: 6 }}>
                    <RadioCard name="tema_modo" value="escuro" titulo="Escuro" sub="Fundo profundo" defaultChecked />
                    <RadioCard name="tema_modo" value="claro" titulo="Claro" sub="Fundo claro" />
                  </div>
                  <div className="cols-2">
                    <div>
                      <label htmlFor="cor_destaque">Cor de destaque</label>
                      <input id="cor_destaque" name="cor_destaque" defaultValue="#C9A961" />
                    </div>
                    <div>
                      <label htmlFor="cor_apoio">Cor de apoio</label>
                      <input id="cor_apoio" name="cor_apoio" defaultValue="#1B2A4A" />
                    </div>
                    <div>
                      <label htmlFor="cor_fundo">Cor de fundo</label>
                      <input id="cor_fundo" name="cor_fundo" defaultValue="#0B1838" />
                    </div>
                    <div>
                      <label htmlFor="cor_texto">Cor do texto</label>
                      <input id="cor_texto" name="cor_texto" defaultValue="#F5F3EE" />
                    </div>
                  </div>
                  <label>Tipografia</label>
                  <div className="select-grid">
                    <RadioCard name="tipografia" value="moderna" titulo="Moderna" sub="Sans clean" defaultChecked />
                    <RadioCard name="tipografia" value="classica" titulo="Clássica" sub="Serifada" />
                    <RadioCard name="tipografia" value="mono" titulo="Técnica" sub="Monoespaçada" />
                  </div>
                </section>

                {/* Módulos */}
                <section>
                  <SecHead Icon={IcoGrid} t="Módulos padrão" p="O que os clientes deste hub recebem por padrão." />
                  <div className="cols-2">
                    <ModCard name="mod_site" Icon={IcoGlobe} titulo="Meu site" desc="Aba do site + métricas." on />
                    <ModCard name="mod_instagram" Icon={IcoInstagram} titulo="Instagram" desc="Gerador de conteúdo." on />
                    <ModCard name="mod_financeiro" Icon={IcoActivity} titulo="Financeiro" desc="Caixa e faturas." on={false} />
                    <ModCard name="mod_crm" Icon={IcoFunnel} titulo="CRM" desc="Funil + WhatsApp." on={false} />
                  </div>
                </section>

                {/* Domínio */}
                <section>
                  <SecHead Icon={IcoSettings} t="Domínio" p="Onde este hub responde (opcional; dá pra configurar depois)." />
                  <label htmlFor="dominio">Domínio / subdomínio</label>
                  <input id="dominio" name="dominio" placeholder="clinicdigital.enderecodigital.com" />
                </section>
              </div>

              <div className="modal-foot">
                <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancelar</button>
                <button type="submit" className="btn">Criar hub</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
