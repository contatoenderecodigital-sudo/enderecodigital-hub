import { NextResponse } from "next/server";
import { query, exec } from "@/lib/groow/db";
import { apurarComissoes, competenciaAtual } from "@/lib/groow/parceiros";
import { marcarDesfecho } from "@/lib/groow/reunioes";

/**
 * Fecha o ciclo do dinheiro: reuniao que deu em contrato vira cliente, e o
 * cliente e que faz a comissao nascer.
 *
 * Antes disto o dono marcava "Fechou" numa tela e precisava lembrar de cadastrar
 * o cliente noutra. Quem esquecia via R$ 0,00 no painel enquanto o parceiro
 * cobrava a comissao de uma venda que aconteceu.
 *
 * O card continua NAO gerando dinheiro sozinho. O que gera e o cliente, com
 * valor e data de inicio, que e o que esta rota cria.
 */
export const dynamic = "force-dynamic";

function num(v: unknown): number {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const calUid = String(body.cal_uid || "").trim();
  if (!calUid) return NextResponse.json({ error: "Reunião não informada." }, { status: 400 });

  const empresa = String(body.empresa || "").trim().slice(0, 150);
  if (!empresa) return NextResponse.json({ error: "Informe a empresa." }, { status: 400 });

  const inicio = String(body.inicio_contrato || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio)) {
    return NextResponse.json({ error: "Informe a data de início do contrato." }, { status: 400 });
  }

  const valorSetup = num(body.valor_setup);
  const valorMensal = num(body.valor_mensal);
  if (!valorSetup && !valorMensal) {
    return NextResponse.json(
      { error: "Informe ao menos um valor, de implantação ou mensalidade." },
      { status: 400 }
    );
  }

  // Os dados de contato vem do proprio agendamento: quem fechou ja preencheu
  // tudo isso no formulario, nao faz sentido digitar de novo.
  const ag = (
    await query<{
      parceiro_id: number | null;
      nome: string;
      email: string | null;
      telefone: string | null;
    }>(
      `SELECT parceiro_id, nome, email, telefone FROM cal_agendamentos WHERE cal_uid = $1 LIMIT 1`,
      [calUid]
    )
  )[0];
  if (!ag) return NextResponse.json({ error: "Reunião não encontrada." }, { status: 404 });

  // lead_id do card do parceiro, quando existe: e por ele que a operacao liga o
  // cliente ao funil de onde ele veio.
  const lead = (
    await query<{ lead_id: number | null }>(
      `SELECT lead_id FROM parceiro_leads WHERE cal_uid = $1 LIMIT 1`,
      [calUid]
    )
  )[0];

  try {
    const r = await exec(
      `INSERT INTO clientes
         (lead_id, empresa, responsavel, email, whatsapp, valor_mensal, valor_setup,
          inicio_contrato, status, parceiro_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'ativo',$9)
       RETURNING id`,
      [
        lead?.lead_id ?? null,
        empresa,
        ag.nome.slice(0, 120),
        ag.email,
        ag.telefone,
        valorMensal,
        valorSetup,
        inicio,
        ag.parceiro_id,
      ]
    );

    // Marca o desfecho junto: fechar o contrato e fechar a reuniao sao a mesma
    // coisa do ponto de vista de quem clica.
    await marcarDesfecho(calUid, "fechou", null);

    // Apura na competencia do inicio do contrato, nao na de hoje: contrato que
    // comeca dia 1 do mes que vem nao lanca comissao neste mes.
    const competencia = inicio.slice(0, 7);
    const apuracao = await apurarComissoes(
      /^\d{4}-(0[1-9]|1[0-2])$/.test(competencia) ? competencia : competenciaAtual()
    );

    return NextResponse.json({ ok: true, cliente: r.insertId, apuracao });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (/duplicate|unique/i.test(msg)) {
      return NextResponse.json(
        { error: "Esse lead já tem cliente cadastrado." },
        { status: 409 }
      );
    }
    console.error("[reunioes/cliente]:", err);
    return NextResponse.json({ error: "Não consegui cadastrar o cliente." }, { status: 500 });
  }
}
