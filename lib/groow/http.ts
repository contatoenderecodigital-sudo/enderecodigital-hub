/**
 * Respostas de erro padronizadas para as rotas de API.
 *
 * Motivo: antes as rotas devolviam err.message cru para o navegador, o que
 * expunha nomes de tabela/coluna e mensagens do MySQL para qualquer um.
 * Agora o detalhe vai só para o log do servidor; o cliente recebe uma
 * mensagem genérica.
 */
import { NextResponse } from "next/server";

export function apiError(
  contexto: string,
  err: unknown,
  status = 500,
  mensagemPublica = "Erro ao processar a requisição."
) {
  console.error(`[${contexto}]`, err);
  return NextResponse.json({ error: mensagemPublica }, { status });
}
