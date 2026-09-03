// ============================================================================
// Log estruturado.
//
// A auditoria apontou o buraco: quando um pedido falha na noite de sábado, não
// existe registro nenhum de que falhou. Nenhum `console` no módulo, nenhum
// agregador, nenhum Sentry. O dono liga reclamando e não há o que olhar.
//
// Isto aqui é o mínimo honesto: uma linha JSON por evento no stdout, que é o
// que o Docker e o Coolify já coletam. Sem dependência nova, sem serviço
// externo, sem dado pessoal no log.
//
// Quando um dia entrar Sentry ou equivalente, é este arquivo que muda, e só ele.
// ============================================================================

type Nivel = "info" | "aviso" | "erro";

export interface Contexto {
  /** de onde veio: "food.pedido", "food.kds", "food.pagamento" */
  onde: string;
  negocio?: string | null;
  loja?: string | null;
  /** o que estava sendo feito: "criarPedido", "moverItem" */
  acao?: string | null;
  [chave: string]: unknown;
}

/**
 * Nunca logar telefone, CPF, endereço ou nome de cliente final: o log é para
 * achar o defeito, não para guardar gente. Se um campo cheirar a dado pessoal,
 * ele é cortado aqui.
 */
const PROIBIDOS = /telefone|celular|cpf|email|endereco|nome_cliente|senha|pin|token|chave|authorization/i;

function limpar(dados: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(dados)) {
    if (PROIBIDOS.test(k)) { out[k] = "[omitido]"; continue; }
    if (v instanceof Error) { out[k] = v.message; continue; }
    if (typeof v === "string") { out[k] = v.slice(0, 500); continue; }
    if (v === null || ["number", "boolean", "undefined"].includes(typeof v)) { out[k] = v; continue; }
    try { out[k] = JSON.parse(JSON.stringify(v)); } catch { out[k] = "[nao serializavel]"; }
  }
  return out;
}

function escrever(nivel: Nivel, mensagem: string, ctx: Contexto) {
  const linha = JSON.stringify({
    t: new Date().toISOString(),
    nivel,
    msg: mensagem,
    ...limpar(ctx as Record<string, unknown>),
  });
  if (nivel === "erro") process.stderr.write(linha + "\n");
  else process.stdout.write(linha + "\n");
}

export const log = {
  info: (mensagem: string, ctx: Contexto) => escrever("info", mensagem, ctx),
  aviso: (mensagem: string, ctx: Contexto) => escrever("aviso", mensagem, ctx),
  erro: (mensagem: string, ctx: Contexto) => escrever("erro", mensagem, ctx),
};

/**
 * Registra a falha e devolve uma frase para o cliente. O erro cru do banco
 * (nome de tabela, nome de constraint) fica no log e NÃO vai para a tela.
 */
export function registrarFalha(e: unknown, ctx: Contexto): string {
  const bruto = e instanceof Error ? e.message : String(e);
  log.erro(bruto, { ...ctx, tipo: e instanceof Error ? e.name : typeof e });
  return bruto;
}
