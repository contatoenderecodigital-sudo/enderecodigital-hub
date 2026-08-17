// ============================================================================
//  FUSO DO SERVIDOR.
//
//  O container roda em UTC, então todo horário renderizado no servidor saía 3
//  horas adiantado: a tela de tokens mostrava 01:26 quando aqui eram 22:26.
//  Corrigir isso em cada `toLocaleString` seria caçar 50 lugares e esquecer o
//  próximo — o certo é o processo nascer no fuso de quem usa o painel.
//
//  `register()` roda uma vez, antes de qualquer requisição.
// ============================================================================

export async function register() {
  process.env.TZ = process.env.TZ || "America/Sao_Paulo";
}
