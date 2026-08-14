// Base de conhecimento da IA: o "cérebro" que a atendente usa pra responder com
// precisão sobre o negócio (o que vende, preços, horários, regras, FAQ).
// Guardada por ESCOPO pra já nascer pronta pro multi-tenant: hoje só existe o
// escopo 'default' (a própria Endereço Digital); amanhã cada cliente/número tem
// o seu (ex.: 'docepao') e a IA daquele número usa a base dele.
import { query, exec } from "@/lib/groow/db";

async function garantirTabela() {
  await exec(
    `CREATE TABLE IF NOT EXISTS ia_base_conhecimento (
      id INT AUTO_INCREMENT PRIMARY KEY,
      escopo VARCHAR(64) NOT NULL DEFAULT 'default',
      conteudo MEDIUMTEXT NULL,
      atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_escopo (escopo)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  );
}

export async function getBaseConhecimento(escopo = "default"): Promise<string> {
  try {
    await garantirTabela();
    const r = await query<{ conteudo: string | null }>(
      `SELECT conteudo FROM ia_base_conhecimento WHERE escopo = ? LIMIT 1`,
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
    `INSERT INTO ia_base_conhecimento (escopo, conteudo) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE conteudo = VALUES(conteudo)`,
    [escopo, conteudo.slice(0, 60000)]
  );
}
