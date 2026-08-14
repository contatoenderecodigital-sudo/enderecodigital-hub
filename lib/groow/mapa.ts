import { getPool } from "@/lib/groow/db";

// Tabela do Mapa do Ecossistema (criada automaticamente no primeiro uso).
let tabelaOk = false;

export async function garantirTabelaMapa(): Promise<void> {
  if (tabelaOk) return;
  await getPool().query(`CREATE TABLE IF NOT EXISTS mapas_ecossistema (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    nome VARCHAR(200) NOT NULL,
    dados MEDIUMTEXT NOT NULL,
    token VARCHAR(48) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_mapa_token (token)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  tabelaOk = true;
}
