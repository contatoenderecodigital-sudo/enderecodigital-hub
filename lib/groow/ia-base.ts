// Base de conhecimento da IA: o "cérebro" que a atendente usa pra responder com
// precisão sobre o negócio (o que vende, preços, horários, regras, FAQ).
// Guardada por ESCOPO pra já nascer pronta pro multi-tenant: hoje só existe o
// escopo 'default' (a própria Endereço Digital); amanhã cada cliente/número tem
// o seu (ex.: 'docepao') e a IA daquele número usa a base dele.
import { query, exec } from "@/lib/groow/db";

async function garantirTabela() {
  // Schema em db/migrations/groow-postgres.sql, aplicado no deploy. O DDL em
  // runtime era do tempo do MySQL e não vale mais.
}

export async function getBaseConhecimento(escopo = "default"): Promise<string> {
  try {
    await garantirTabela();
    const r = await query<{ conteudo: string | null }>(
      `SELECT conteudo FROM ia_base_conhecimento WHERE escopo = $1 LIMIT 1`,
      [escopo]
    );
    return (r[0]?.conteudo ?? "").trim();
  } catch {
    return "";
  }
}

export async function setBaseConhecimento(conteudo: string, escopo = "default"): Promise<void> {
  await garantirTabela();
  await exec(
    `INSERT INTO ia_base_conhecimento (escopo, conteudo) VALUES ($1, $2)
     ON CONFLICT (escopo) DO UPDATE SET conteudo = EXCLUDED.conteudo`,
    [escopo, conteudo.slice(0, 60000)]
  );
}
