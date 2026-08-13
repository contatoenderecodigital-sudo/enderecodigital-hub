import PageHead from "@/components/page-head";
import OpsSenhasList from "@/components/ops-senhas-list";
import { listSenhas } from "@/lib/ops";
import { temChaveCofre } from "@/lib/cofre";
import { novaSenhaAction } from "../actions";
import { IcoPlus, IcoLock } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function SenhasPage() {
  const senhas = await listSenhas();
  const temChave = temChaveCofre();

  return (
    <>
      <PageHead
        eyebrow="Agência · GROOW OS"
        titulo="Senhas"
        sub="Cofre de credenciais dos clientes — cifradas com AES-256 no banco, reveladas só sob demanda."
      />

      {!temChave ? (
        <div className="err">Falta a env <strong>SENHAS_CHAVE</strong> no servidor — sem ela o cofre não cifra nem abre.</div>
      ) : (
        <div className="card glass-soft" style={{ marginBottom: 16, fontSize: 12.5 }}>
          <span className="row" style={{ gap: 8 }}><IcoLock width={14} height={14} /> As senhas nunca ficam em texto puro: cifradas com AES-256-GCM. Só aparecem quando você clica em "Revelar".</span>
        </div>
      )}

      <details className="card" style={{ marginBottom: 16 }}>
        <summary style={{ cursor: "pointer", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
          <IcoPlus width={16} height={16} /> Nova credencial
        </summary>
        <form action={novaSenhaAction} className="cols-3" style={{ gap: 12, marginTop: 14 }}>
          <div><label>Serviço *</label><input name="servico" placeholder="Ex.: Instagram, Hostinger" required /></div>
          <div><label>Cliente</label><input name="cliente" /></div>
          <div><label>URL</label><input name="url" placeholder="https://" /></div>
          <div><label>Usuário / e-mail</label><input name="usuario" /></div>
          <div><label>Senha *</label><input name="senha" required /></div>
          <div><label>Notas</label><input name="notas" /></div>
          <div style={{ gridColumn: "1 / -1" }}><button className="btn" type="submit" disabled={!temChave}><IcoPlus width={15} height={15} /> Guardar no cofre</button></div>
        </form>
      </details>

      <OpsSenhasList senhas={senhas} />
    </>
  );
}
