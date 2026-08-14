import { NextResponse } from "next/server";
import { getDailyTasks } from "@/lib/groow/queries";
import { exec, query } from "@/lib/groow/db";

export const dynamic = "force-dynamic";

// Auto-migração: garante a coluna cliente_id (roda 1x por processo).
let clienteColEnsured = false;
async function ensureClienteCol() {
  if (clienteColEnsured) return;
  try {
    await exec(`ALTER TABLE tarefas ADD COLUMN cliente_id INT NULL`);
  } catch { /* coluna já existe - ok */ }
  clienteColEnsured = true;
}

interface ManualRow {
  id: number;
  titulo: string;
  prioridade: "alta" | "media" | "baixa";
  status: string;
  lead_id: number | null;
  cliente_id: number | null;
  data_vencimento: string | null;
  created_at: string;
}

export async function GET() {
  try {
    await ensureClienteCol();
    const tasks = await getDailyTasks();
    // Busca tarefas manuais do banco (com fallback se cliente_id ainda não existir)
    let manual: ManualRow[] = [];
    try {
      manual = await query<ManualRow>(
        `SELECT id, titulo, prioridade, status, lead_id, cliente_id, data_vencimento, created_at
         FROM tarefas ORDER BY prioridade = 'alta' DESC, created_at DESC`
      );
    } catch {
      try {
        manual = await query<ManualRow>(
          `SELECT id, titulo, prioridade, status, lead_id, data_vencimento, created_at
           FROM tarefas ORDER BY prioridade = 'alta' DESC, created_at DESC`
        );
        manual = manual.map((m) => ({ ...m, cliente_id: null }));
      } catch { /* tabela pode não existir ainda */ }
    }
    return NextResponse.json({ tasks, manual });
  } catch (err) {
    console.error("[admin/tarefas]", err);
    return NextResponse.json(
      { error: "Não foi possível carregar as tarefas." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  let body: { titulo: string; prioridade?: string; lead_id?: number; cliente_id?: number; data_vencimento?: string; status?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!body.titulo?.trim()) {
    return NextResponse.json({ error: "Título obrigatório" }, { status: 400 });
  }
  const prioridade = ["alta", "media", "baixa"].includes(body.prioridade || "") ? body.prioridade! : "media";
  const concluida = body.status === "concluida";
  const concluidaEm = concluida ? new Date().toISOString().slice(0, 19).replace("T", " ") : null;
  try {
    await ensureClienteCol();
    let result;
    try {
      result = await exec(
        `INSERT INTO tarefas (titulo, prioridade, lead_id, cliente_id, data_vencimento, status, concluida_em)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [body.titulo.trim(), prioridade, body.lead_id || null, body.cliente_id || null, body.data_vencimento || null, concluida ? "concluida" : "pendente", concluidaEm]
      );
    } catch {
      // fallback: coluna cliente_id ainda não criada
      result = await exec(
        `INSERT INTO tarefas (titulo, prioridade, lead_id, data_vencimento, status, concluida_em)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [body.titulo.trim(), prioridade, body.lead_id || null, body.data_vencimento || null, concluida ? "concluida" : "pendente", concluidaEm]
      );
    }
    return NextResponse.json({ ok: true, id: result.insertId });
  } catch (err) {
    console.error("[admin/tarefas]", err);
    return NextResponse.json({ error: "Erro ao processar a requisição." }, { status: 500 });
  }
}
