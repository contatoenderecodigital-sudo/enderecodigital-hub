"use client";

import { useState } from "react";
import { salvarModulosHubAction } from "@/app/owner/hubs/actions";
import { IcoGrid, IcoX, IcoGlobe, IcoInstagram, IcoActivity, IcoFunnel } from "@/components/icons";

type IconType = typeof IcoGrid;

function Mod({ name, Icon, t, d, on }: { name: string; Icon: IconType; t: string; d: string; on: boolean }) {
  return (
    <label className="toggle-card" style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
      <div className="icon-box sm"><Icon width={16} height={16} /></div>
      <div style={{ flex: 1 }}>
        <div className="tc-title" style={{ marginTop: 0 }}>{t}</div>
        <div className="tc-desc">{d}</div>
      </div>
      <span className="switch">
        <input type="checkbox" name={name} defaultChecked={on} />
        <span className="track" />
      </span>
    </label>
  );
}

export default function ModulosHubModal({
  hub,
}: {
  hub: { id: string; nome: string; mod_site: boolean; mod_instagram: boolean; mod_financeiro: boolean; mod_crm: boolean };
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
        <IcoGrid width={15} height={15} /> Módulos
      </button>
      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal-panel" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="icon-box"><IcoGrid width={20} height={20} /></div>
              <div>
                <h2>Módulos · {hub.nome}</h2>
                <p>O que os clientes deste hub recebem por padrão.</p>
              </div>
              <button className="modal-close" onClick={() => setOpen(false)} aria-label="Fechar"><IcoX width={18} height={18} /></button>
            </div>
            <form action={salvarModulosHubAction} style={{ display: "contents" }}>
              <input type="hidden" name="hub_id" value={hub.id} />
              <div className="modal-body">
                <Mod name="mod_site" Icon={IcoGlobe} t="Meu Site" d="Site + métricas de visitas." on={hub.mod_site} />
                <Mod name="mod_instagram" Icon={IcoInstagram} t="Instagram" d="Gerador de conteúdo e biblioteca." on={hub.mod_instagram} />
                <Mod name="mod_financeiro" Icon={IcoActivity} t="Financeiro" d="Painel de caixa e faturas." on={hub.mod_financeiro} />
                <Mod name="mod_crm" Icon={IcoFunnel} t="CRM" d="Funil de vendas + WhatsApp." on={hub.mod_crm} />
              </div>
              <div className="modal-foot">
                <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancelar</button>
                <button type="submit" className="btn">Salvar módulos</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
