"use client";

import { toggleFlagAction } from "@/app/owner/actions";

// Switch que salva o estado no banco (hub_flags) ao mudar. Sem JS de estado:
// o form dispara a server action e a página revalida.
export default function FlagToggle({ chave, ligado }: { chave: string; ligado: boolean }) {
  return (
    <form action={toggleFlagAction}>
      <input type="hidden" name="chave" value={chave} />
      <input type="hidden" name="ligado" value={ligado ? "0" : "1"} />
      <label className="switch" title={ligado ? "Ligado" : "Desligado"}>
        <input
          type="checkbox"
          checked={ligado}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
        />
        <span className="track" />
      </label>
    </form>
  );
}
