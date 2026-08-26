/**
 * Conferencias de campo que valem nos dois lados.
 *
 * Sem dependencia de banco de proposito: e importado por componente cliente e
 * por route handler. Validar so no formulario nao serve, porque a API e publica
 * e aceita POST direto.
 */

/**
 * E-mail.
 *
 * O `type="email"` do navegador exige apenas um arroba, entao "aaa@aaa" passa
 * e vira convite de calendario que nunca chega em ninguem. Aqui exige dominio
 * com ponto e uma terminacao de pelo menos duas letras.
 *
 * Nao e o RFC inteiro de proposito: o objetivo e barrar erro de digitacao, nao
 * aceitar todo endereco exotico que existe no papel.
 */
export function emailValido(bruto: string): { ok: boolean; motivo?: string } {
  const e = String(bruto || "").trim();
  if (!e) return { ok: false, motivo: "Informe o e-mail." };
  if (e.length > 190) return { ok: false, motivo: "E-mail longo demais." };
  if (/\s/.test(e)) return { ok: false, motivo: "E-mail não pode ter espaço." };
  if (!/^[^@]+@[^@]+$/.test(e)) {
    return { ok: false, motivo: "E-mail inválido. Confira o arroba." };
  }
  const [local, dominio] = e.split("@");
  if (!local || local.length > 64) return { ok: false, motivo: "E-mail inválido." };
  if (/^\.|\.$|\.\./.test(local) || /^\.|\.$|\.\./.test(dominio)) {
    return { ok: false, motivo: "E-mail inválido. Confira os pontos." };
  }
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(dominio)) {
    return { ok: false, motivo: "Faltou o domínio, algo como seunome@gmail.com." };
  }
  if (!/\.[a-z]{2,}$/i.test(dominio)) {
    return { ok: false, motivo: "Domínio incompleto. Faltou o final, tipo .com ou .br." };
  }
  return { ok: true };
}

/** Nome de pessoa: duas letras no minimo e pelo menos uma letra de verdade. */
export function nomeValido(bruto: string): { ok: boolean; motivo?: string } {
  const n = String(bruto || "").trim();
  if (n.length < 2) return { ok: false, motivo: "Informe o seu nome." };
  if (!/\p{L}{2}/u.test(n)) return { ok: false, motivo: "Nome inválido." };
  return { ok: true };
}
