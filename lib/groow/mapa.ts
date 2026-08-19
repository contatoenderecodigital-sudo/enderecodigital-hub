
// Tabela do Mapa do Ecossistema (criada automaticamente no primeiro uso).
let tabelaOk = false;

export async function garantirTabelaMapa(): Promise<void> {
  if (tabelaOk) return;
  // O schema agora vive em db/migrations/groow-postgres.sql, aplicado no
  // deploy. Esta função virou marcador: o DDL em runtime era do tempo do MySQL.
  tabelaOk = true;
}
