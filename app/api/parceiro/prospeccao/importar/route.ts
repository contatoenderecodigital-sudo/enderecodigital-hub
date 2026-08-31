import { NextResponse } from "next/server";
import { exigirParceiro } from "@/lib/groow/parceiro-sessao";
import { salvarLeadDoParceiro, normalizarTelefone, moverFunil } from "@/lib/groow/parceiros";

/**
 * Empresa achada no Maps vira card no funil do parceiro.
 *
 * Nasce em "a ligar" e SEM opt-in, sempre. O telefone veio do Google, nao da
 * pessoa: ela nunca pediu contato. O opt-in so existe depois que ela autorizar
 * na ligacao, e e ele que libera o disparo de template. Marcar aqui seria
 * fabricar consentimento.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await exigirParceiro();
  if (!auth.ok) return auth.resposta;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const empresas = Array.isArray(body.empresas) ? body.empresas : [body];

  let criados = 0;
  const semTelefone: string[] = [];

  for (const bruto of empresas.slice(0, 40)) {
    const e = (bruto || {}) as Record<string, unknown>;
    const nome = String(e.nome || "").trim();
    if (!nome) continue;

    const telefone = normalizarTelefone(String(e.telefone || ""));
    if (!telefone) {
      // Sem telefone nao da para virar card: o funil e chaveado por telefone,
      // e um lead que nao da para ligar nao serve para call fria.
      semTelefone.push(nome);
      continue;
    }

    // Contexto que o parceiro usaria de gancho na abertura, ja escrito. Ele
    // abre o card e a primeira frase da ligacao esta pronta.
    const partes: string[] = [];
    if (e.endereco) partes.push(String(e.endereco));
    if (e.avaliacoes) {
      partes.push(
        `${e.avaliacoes} avaliações no Google${e.rating ? `, nota ${e.rating}` : ""}`
      );
    }
    if (!e.site) partes.push("Sem site nenhum");
    else if (e.semSiteProprio) partes.push(`Só rede social: ${e.site}`);
    else partes.push(`Site: ${e.site}`);

    try {
      const novoId = await salvarLeadDoParceiro(auth.parceiro.id, {
        nome: nome.slice(0, 160),
        empresa: nome.slice(0, 160),
        telefone,
        cidade: String(e.cidade || "").trim() || null,
        situacao: "a_ligar",
        observacao: partes.join(" · ").slice(0, 2000) || null,
      });
      // Entra na BASE, nao no funil: o kanban e o que ele escolheu trabalhar,
      // nao tudo que a busca devolveu.
      await moverFunil(novoId, auth.parceiro.id, false);
      criados++;
    } catch (err) {
      console.error("[prospeccao/importar]:", err);
    }
  }

  return NextResponse.json({ ok: true, criados, semTelefone });
}
