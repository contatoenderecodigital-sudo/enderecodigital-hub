import { NextResponse } from "next/server";
import { exigirParceiro } from "@/lib/groow/parceiro-sessao";
import {
  listarLeadsDoParceiro,
  salvarLeadDoParceiro,
  getLeadDoParceiro,
  type SituacaoLead,
} from "@/lib/groow/parceiros";
import { exec } from "@/lib/groow/db";

export const dynamic = "force-dynamic";

const SITUACOES_VALIDAS: SituacaoLead[] = ["ligou", "vai_chamar", "autorizou", "recusou"];

export async function GET() {
  const auth = await exigirParceiro();
  if (!auth.ok) return auth.resposta;
  const leads = await listarLeadsDoParceiro(auth.parceiro.id);
  return NextResponse.json({ leads });
}

export async function POST(req: Request) {
  const auth = await exigirParceiro();
  if (!auth.ok) return auth.resposta;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const situacaoBruta = String(body.situacao || "ligou") as SituacaoLead;
  const situacao = SITUACOES_VALIDAS.includes(situacaoBruta) ? situacaoBruta : "ligou";
  const optin = body.optin === true || situacao === "autorizou";

  if (optin && !String(body.optin_prova || "").trim()) {
    return NextResponse.json(
      { error: "Para marcar que autorizou, registre o que a pessoa disse na ligação." },
      { status: 400 }
    );
  }

  try {
    const id = await salvarLeadDoParceiro(auth.parceiro.id, {
      nome: String(body.nome || ""),
      empresa: String(body.empresa || "") || null,
      telefone: String(body.telefone || ""),
      email: String(body.email || "") || null,
      cidade: String(body.cidade || "") || null,
      setor: String(body.setor || "") || null,
      situacao,
      optin,
      optin_origem: optin ? "call" : null,
      optin_prova: optin ? String(body.optin_prova || "") : null,
      observacao: String(body.observacao || "") || null,
    });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Não consegui salvar.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  const auth = await exigirParceiro();
  if (!auth.ok) return auth.resposta;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Id inválido." }, { status: 400 });
  }

  // Confere a posse ANTES de escrever: o WHERE de baixo também filtra por
  // parceiro_id, mas assim o erro fica honesto.
  const atual = await getLeadDoParceiro(id, auth.parceiro.id);
  if (!atual) return NextResponse.json({ error: "Lead não encontrado." }, { status: 404 });

  const situacaoBruta = String(body.situacao || atual.situacao) as SituacaoLead;
  const situacao = SITUACOES_VALIDAS.includes(situacaoBruta) ? situacaoBruta : atual.situacao;
  const optin = body.optin === true || situacao === "autorizou";
  const prova = String(body.optin_prova || atual.optin_prova || "").trim();

  if (optin && !prova) {
    return NextResponse.json(
      { error: "Para marcar que autorizou, registre o que a pessoa disse na ligação." },
      { status: 400 }
    );
  }

  await exec(
    `UPDATE parceiro_leads
        SET situacao = $1,
            optin = $2,
            optin_em = COALESCE(optin_em, ${optin ? "NOW()" : "NULL"}),
            optin_origem = COALESCE(optin_origem, $3),
            optin_prova = $4,
            observacao = $5
      WHERE id = $6 AND parceiro_id = $7`,
    [
      situacao,
      optin ? 1 : 0,
      optin ? "call" : null,
      prova || null,
      String(body.observacao ?? atual.observacao ?? "") || null,
      id,
      auth.parceiro.id,
    ]
  );

  return NextResponse.json({ ok: true });
}
