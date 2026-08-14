import { getSession } from "@/lib/auth";
import { listAuditoriaFiltrada } from "@/lib/platform-config";

export const dynamic = "force-dynamic";

function csvCell(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  const sess = await getSession();
  if (!sess || sess.papel !== "owner_plataforma") return new Response("nao_autorizado", { status: 401 });

  const u = new URL(req.url);
  const logs = await listAuditoriaFiltrada({
    q: u.searchParams.get("q") || undefined,
    desde: u.searchParams.get("desde") || undefined,
    ate: u.searchParams.get("ate") || undefined,
    limite: 5000,
  });

  const header = ["id", "quando", "acao", "ator", "detalhe"];
  const linhas = logs.map((l) => [l.id, l.criado_em, l.acao, l.ator_usuario_id, l.detalhe ?? ""].map(csvCell).join(","));
  const csv = "﻿" + [header.join(","), ...linhas].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="auditoria-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
