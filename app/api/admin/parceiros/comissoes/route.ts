import { NextResponse } from "next/server";
import { exec } from "@/lib/groow/db";
import { construtorSql, clausulaWhere, clausulaSet } from "@/lib/groow/sql";
import {
  apurarComissoes,
  garantirTabelasParceiros,
  competenciaAtual,
  COMPETENCIA_RE,
} from "@/lib/groow/parceiros";

export const dynamic = "force-dynamic";

interface Body {
  acao?: "apurar" | "aprovar" | "pagar" | "cancelar";
  competencia?: string;
  parceiro_id?: number;
  /** ids específicos; quando vazio, aplica na competência inteira do parceiro */
  ids?: number[];
}

export async function POST(req: Request) {
  await garantirTabelasParceiros();
  const body = (await req.json().catch(() => ({}))) as Body;
  const acao = body.acao ?? "apurar";

  if (acao === "apurar") {
    const competencia = body.competencia && COMPETENCIA_RE.test(body.competencia)
      ? body.competencia
      : competenciaAtual();
    try {
      const r = await apurarComissoes(competencia);
      return NextResponse.json({ ok: true, ...r });
    } catch (err) {
      console.error("[parceiros] apurar:", err);
      const msg = err instanceof Error ? err.message : "Falha na apuração.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  const destino =
    acao === "aprovar" ? "aprovado" : acao === "pagar" ? "pago" : "cancelado";

  // Transições permitidas: previsto -> aprovado -> pago. Nunca volta, e pago
  // nunca é reescrito por uma apuração posterior.
  const origem =
    acao === "aprovar" ? ["previsto"] : acao === "pagar" ? ["previsto", "aprovado"] : ["previsto", "aprovado"];

  const ids = Array.isArray(body.ids) ? body.ids.filter((n) => Number.isInteger(n) && n > 0) : [];
  const parceiroId = Number(body.parceiro_id);

  if (!ids.length && (!Number.isInteger(parceiroId) || parceiroId <= 0)) {
    return NextResponse.json({ error: "Informe as comissões ou o parceiro." }, { status: 400 });
  }

  const { p, params } = construtorSql();
  const where: string[] = [`status IN (${origem.map((o) => p(o)).join(",")})`];

  if (ids.length) {
    where.push(`id IN (${ids.map((i) => p(i)).join(",")})`);
  } else {
    where.push(`parceiro_id = ${p(parceiroId)}`);
    if (body.competencia && COMPETENCIA_RE.test(body.competencia)) {
      where.push(`competencia = ${p(body.competencia)}`);
    }
  }

  const r = await exec(
    `UPDATE parceiro_comissoes
        SET status = ${p(destino)}, pago_em = ${destino === "pago" ? "CURRENT_DATE" : "pago_em"}
      WHERE ${where.join(" AND ")}`,
    params
  );

  return NextResponse.json({ ok: true, alteradas: r.affectedRows });
}
